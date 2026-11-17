// Leitura de gastos (e resgates da caixinha) numa imagem ou PDF, com pareamento "resgatei e paguei" e trava
// de duplicado. Usada pelo atalho do iPhone e pela conversa (WhatsApp e Telegram).
import { perguntar, lerJSON } from "./gemini.ts";
import { CATS, FONTES, instrucoesFoto, limparGastos } from "./regras.ts";
import { reais, NOME_CAT, rest } from "./banco.ts";

const novoId = (prefixo = "at") => prefixo + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// Print do atalho: gastos (com hora) e resgates da caixinha, para parear "resgatei e paguei"
const ESQUEMA_PRINT = {
  type: "object",
  properties: {
    gastos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          valor: { type: "number" }, data: { type: "string" }, hora: { type: "string" }, descricao: { type: "string" },
          categoria: { type: "string", enum: CATS }, fonte: { type: "string", enum: FONTES },
        },
        required: ["valor", "data", "hora", "descricao", "categoria", "fonte"],
      },
    },
    resgates: {
      type: "array",
      items: { type: "object", properties: { valor: { type: "number" }, data: { type: "string" }, hora: { type: "string" } }, required: ["valor", "data", "hora"] },
    },
  },
  required: ["gastos", "resgates"],
};
const instrucoesPrint = (hoje) => instrucoesFoto(hoje).replace(/Responda só com o JSON[\s\S]*$/, "") + `- hora: HH:MM se a imagem mostrar o horário do lançamento; senão "".
- Liste também em "resgates" o dinheiro que VOLTOU de uma caixinha ou investimento para a conta ("Dinheiro resgatado", "Resgate RDB", "Resgate da caixinha"), com valor, data e hora. Resgate NÃO é gasto: não coloque em "gastos". Aplicação ou dinheiro guardado também não é gasto.

Responda só com o JSON no formato {"gastos":[{"valor":..,"data":"..","hora":"..","descricao":"..","categoria":"..","fonte":".."}],"resgates":[{"valor":..,"data":"..","hora":".."}]}.`;

// Resgate seguido de gasto: o gasto (da conta) feito depois de um resgate, no mesmo dia, foi pago com a caixinha.
// Cada resgate cobre gastos até o valor dele, em ordem de horário; o gasto maior que o que sobra do resgate é
// dividido em duas partes (caixinha + conta). Sobra de resgate fica na conta e não vira gasto.
function parearResgates(gastos, resgates) {
  const ord = (x, padrao) => `${x.data} ${/^\d{2}:\d{2}$/.test(x.hora ?? "") ? x.hora : padrao}`;
  const saida = gastos.map((g) => ({ ...g }));
  for (const r of [...resgates].sort((a, b) => ord(a, "00:00").localeCompare(ord(b, "00:00")))) {
    let resta = r.valor;
    const candidatos = saida.filter((g) => g.fonte === "conta" && g.data === r.data && ord(g, "23:59") >= ord(r, "00:00"))
      .sort((a, b) => ord(a, "23:59").localeCompare(ord(b, "23:59")));
    for (const g of candidatos) {
      if (resta < 0.005) break;
      if (g.valor <= resta + 0.005) { g.fonte = "caixinha"; g.doResgate = true; resta -= g.valor; }
      else {
        const parte = Math.round(resta * 100) / 100;
        saida.push({ ...g, valor: parte, fonte: "caixinha", doResgate: true, descricao: g.descricao });
        g.valor = Math.round((g.valor - parte) * 100) / 100; g.resto = true; resta = 0;
      }
    }
  }
  return saida;
}

// Lê os gastos (e resgates da caixinha) de uma imagem e lança o que ainda não está no app.
// Devolve a mensagem para a pessoa (texto simples) e os gastos lançados.
export async function lancarImagem(uid, midia, hoje, chaveIA, { prefixo = "at", nota = "Pelo atalho", dica = "", final = " Confira no app." } = {}) {
  const r = await perguntar(chaveIA, instrucoesPrint(hoje) + (dica ? `\nA pessoa escreveu junto com a imagem (use só como pista da forma de pagamento ou da descrição): ${JSON.stringify(String(dica).slice(0, 200))}` : ""), ESQUEMA_PRINT, midia);
  if (!r.texto) { console.error("atalho foto:", r.detalhe); return { msg: /429|quota/i.test(r.detalhe) ? "O limite grátis do Gemini acabou por hoje." : "Não deu para ler a foto agora. Tente de novo.", novos: [] }; }
  let gastos = [], resgates = [];
  try {
    const j = lerJSON(r.texto);
    // mesmo filtro de limparGastos antes, para a hora de cada item continuar alinhada
    const validos = (Array.isArray(j?.gastos) ? j.gastos : []).filter((g) => { const v = Math.abs(Number(String(g?.valor).replace(",", "."))); return v > 0 && v < 1e7; }).slice(0, 20);
    gastos = limparGastos(JSON.stringify({ gastos: validos }), hoje).map((g, i) => ({ ...g, hora: String(validos[i]?.hora ?? "") }));
    resgates = (Array.isArray(j?.resgates) ? j.resgates : []).map((x) => ({
      valor: Math.round(Math.abs(+x?.valor || 0) * 100) / 100,
      data: /^\d{4}-\d{2}-\d{2}$/.test(String(x?.data)) ? String(x.data) : hoje,
      hora: String(x?.hora ?? ""),
    })).filter((x) => x.valor > 0 && x.valor < 1e7).slice(0, 10);
  } catch { return { msg: "A leitura veio num formato inesperado. Tente de novo.", novos: [] }; }
  if (!gastos.length && !resgates.length) return { msg: "Não encontrei nenhuma saída nessa imagem.", novos: [] };
  gastos = parearResgates(gastos, resgates);
  const datas = [...new Set([...gastos, ...resgates].map((g) => g.data))];
  const ja = await rest(`gastos?user_id=eq.${uid}&data=in.(${datas.join(",")})&select=data,valor`) ?? [];
  const novos = gastos.filter((g) => !ja.some((x) => x.data === g.data && Math.abs(+x.valor - g.valor) < 0.005));
  if (novos.length) {
    await rest("gastos", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(novos.map((g) => ({ user_id: uid, id: novoId(prefixo), data: g.data, valor: g.valor, cat: g.categoria, fonte: g.fonte, descricao: g.descricao }))) });
  }
  // resgates entram na caixinha (sem repetir um que já esteja lá com a mesma data e valor)
  let resgNovos = [];
  if (resgates.length) {
    const jc = await rest(`caixinha?user_id=eq.${uid}&tipo=eq.resgate&data=in.(${[...new Set(resgates.map((x) => x.data))].join(",")})&select=data,valor`) ?? [];
    resgNovos = resgates.filter((x) => !jc.some((m) => m.data === x.data && Math.abs(Math.abs(+m.valor) - x.valor) < 0.005));
    if (resgNovos.length) await rest("caixinha", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(resgNovos.map((x) => ({ user_id: uid, id: novoId(prefixo), data: x.data, valor: -x.valor, tipo: "resgate", mes: null, nota }))) });
  }
  const pulou = gastos.length - novos.length;
  const partes = [];
  if (novos.length) {
    const lista = novos.slice(0, 4).map((g) => `${g.descricao || NOME_CAT[g.categoria]} ${reais(g.valor)} (${NOME_CAT[g.categoria]}${g.fonte === "caixinha" ? ", pago com a caixinha" : g.resto ? ", resto pela conta" : ""})`).join("; ");
    partes.push(`${novos.length > 1 ? `${novos.length} saídas registradas` : "Registrada"}: ${lista}${novos.length > 4 ? "…" : "."}`);
  }
  if (resgNovos.length) partes.push(`Resgate${resgNovos.length > 1 ? "s" : ""} de ${resgNovos.map((x) => reais(x.valor)).join(" e ")} registrado${resgNovos.length > 1 ? "s" : ""} na caixinha.`);
  if (pulou) partes.push(`Pulei ${pulou} saída${pulou > 1 ? "s" : ""} que parece${pulou > 1 ? "m" : ""} já registrada${pulou > 1 ? "s" : ""}.`);
  if (!novos.length && !resgNovos.length) return { msg: `Nada registrado: ${gastos.length === 1 ? "a saída parece" : "as saídas parecem"} já estar no app.`, novos: [] };
  return { msg: partes.join(" ") + final, novos };
}
