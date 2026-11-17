import { texto } from "../_shared/http.ts";
import { perguntar, lerJSON, MODELOS_RAPIDOS } from "../_shared/gemini.ts";
import { CATS, FONTES, ESQUEMA_FOTO, ESQUEMA_CATS, instrucoesFoto, instrucoesCats, instrucoesFrase, limparGastos, limparCats } from "../_shared/regras.ts";
import { reais, hojeSP, NOME_CAT, NOME_FONTE, semAcento, chaveServico, rest, sha256 } from "../_shared/banco.ts";
import { lancarImagem } from "../_shared/imagem.ts";
import { alertarSePreciso } from "../_shared/avisos.ts";

// Depois de lançar: alerta de limite pelo Telegram, se a pessoa conectou e a semana passou de 80% ou do limite
const alertar = (uid) => alertarSePreciso(uid).catch((e) => console.error("atalho alerta:", e?.message ?? e));

// Versão do código, para conferir qual está publicada (aparece nas mensagens de erro).
export const VERSAO = "v11";

// ---------------------------------------------------------------------------------------------
// Atalhos do iPhone (sem login): autenticados pela "chave do atalho" (leve_…), criada em Ajustes.
// A tabela atalhos guarda só o SHA-256 da chave. As escritas usam a chave de serviço, que fica no
// servidor, sempre presas ao user_id dono da chave. A resposta é texto puro, para o atalho mostrar
// numa notificação.
// ---------------------------------------------------------------------------------------------
const novoId = (prefixo = "at") => prefixo + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
function catDe(s) {
  const t = semAcento(s);
  if (CATS.includes(t)) return t;
  return { role: "lazer", "rolê": "lazer", alimentacao: "comida", mercado: "comida", "familia": "familia", "saude": "saude", uber: "transporte" }[t]
    ?? Object.keys(NOME_CAT).find((k) => semAcento(NOME_CAT[k]) === t) ?? "outros";
}
function fonteDe(s) {
  const t = semAcento(s);
  return { conta: "conta", debito: "conta", pix: "conta", cartao: "cartao", credito: "cartao", vr: "vr", "vale refeicao": "vr", "vale-refeicao": "vr", "vale": "vr", mobilidade: "mob", mob: "mob", vt: "mob" }[t] ?? "conta";
}
const ESQUEMA_CAIXA = {
  type: "object",
  properties: { e_caixinha: { type: "boolean" }, bruto: { type: "number" }, liquido: { type: "number" } },
  required: ["e_caixinha", "bruto", "liquido"],
};
const INSTRUCOES_CAIXA = `Esta é uma captura de tela do app de um banco brasileiro (geralmente o Nubank), que deveria estar na tela de uma caixinha ou investimento (RDB) com o saldo.
Extraia:
- e_caixinha: true se a tela mostra o saldo de uma caixinha ou investimento; false se for outra tela.
- bruto: o "Total bruto" em reais. Se não houver esse rótulo, o saldo principal mostrado. 0 se não der para ler.
- liquido: o "Total líquido" (ou "se resgatar hoje") em reais, se aparecer; senão 0.
Números positivos, com ponto como separador decimal (ex.: 10612.4).
Responda só com o JSON {"e_caixinha":..,"bruto":..,"liquido":..}.`;

export async function atalho(bruto, chaveIA) {
  // nomes de campo sem espaços e em minúsculas: o teclado do iPhone costuma pôr espaço no fim ("acao ")
  const corpo = Object.fromEntries(Object.entries(bruto ?? {}).map(([k, v]) => [k.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, ""), v]));
  const token = String(corpo?.chave ?? "").trim();
  if (!/^leve_[A-Za-z0-9_-]{30,}$/.test(token)) return texto("Chave do atalho ausente ou inválida. Crie uma em Ajustes → Atalhos do iPhone.");
  if (!chaveServico()) return texto("A função não tem acesso ao banco (chave de serviço ausente).");
  const linhas = await rest(`atalhos?token_hash=eq.${await sha256(token)}&select=user_id`);
  const uid = linhas?.[0]?.user_id;
  if (!uid) return texto("Essa chave do atalho não vale mais. Crie outra em Ajustes → Atalhos do iPhone.");
  // só letras a–z, sem depender de acentos (o editor do Supabase pode estragar caracteres especiais)
  let acao = String(corpo?.acao ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (acao === "print" || acao === "extrato") acao = "foto";
  const hoje = hojeSP();
  const imagem = typeof corpo?.imagem === "string" ? corpo.imagem.replace(/\s/g, "") : "";

  // Lançar gasto digitado
  if (acao === "gasto" || acao === "digitar") {
    const valor = Math.round(Math.abs(Number(String(corpo?.valor ?? "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."))) * 100) / 100;
    if (!(valor > 0 && valor < 1e7)) return texto("Digite um valor maior que zero.");
    const fonte = fonteDe(corpo?.fonte);
    const descricao = String(corpo?.descricao ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    // sem categoria: a IA escolhe pela descrição (se falhar, fica "outros")
    let cat = String(corpo?.categoria ?? "").trim() ? catDe(corpo.categoria) : "outros";
    if (!String(corpo?.categoria ?? "").trim() && descricao && chaveIA) {
      const r = await perguntar(chaveIA, instrucoesCats([{ i: 0, descricao, valor }]), ESQUEMA_CATS, null, MODELOS_RAPIDOS);
      try { cat = (r.texto && limparCats(r.texto, new Set([0]))[0]?.categoria) || "outros"; } catch { cat = "outros"; }
    }
    await rest("gastos", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify([{ user_id: uid, id: novoId(), data: hoje, valor, cat, fonte, descricao }]) });
    await alertar(uid);
    return texto(`Registrada: ${reais(valor)} em ${NOME_CAT[cat]} (${NOME_FONTE[fonte]})${descricao ? ` · ${descricao}` : ""}.`);
  }

  if (!chaveIA) return texto("A chave do Gemini não está configurada no Supabase.");

  // Lançar gastos ditos (ação "Ditar Texto" do atalho) ou escritos numa frase
  if (acao === "falar" || acao === "frase" || acao === "voz") {
    const frase = String(corpo?.texto ?? corpo?.frase ?? "").replace(/\s+/g, " ").trim();
    if (!frase) return texto("Não ouvi nada. Tente de novo falando o valor e o que foi, ex.: almoço 32 no vale-refeição.");
    const r = await perguntar(chaveIA, instrucoesFrase(hoje, frase), ESQUEMA_FOTO, null, MODELOS_RAPIDOS);
    if (!r.texto) { console.error("atalho falar:", r.detalhe); return texto(/429|quota/i.test(r.detalhe) ? "O limite grátis do Gemini acabou por hoje." : "Não deu para entender agora. Tente de novo."); }
    let gastos = [];
    try { gastos = limparGastos(r.texto, hoje).slice(0, 10); } catch { return texto("Não entendi a frase. Tente de novo."); }
    if (!gastos.length) return texto(`Não achei uma saída com valor em "${frase.slice(0, 60)}". Fale o valor e o que foi, ex.: almoço 32 no vale-refeição.`);
    await rest("gastos", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(gastos.map((g) => ({ user_id: uid, id: novoId(), data: g.data, valor: g.valor, cat: g.categoria, fonte: g.fonte, descricao: g.descricao }))) });
    await alertar(uid);
    const lista = gastos.slice(0, 4).map((g) => `${g.descricao || NOME_CAT[g.categoria]} ${reais(g.valor)} (${NOME_CAT[g.categoria]}, ${NOME_FONTE[g.fonte]}${g.data !== hoje ? `, ${g.data.slice(8)}/${g.data.slice(5, 7)}` : ""})`).join("; ");
    return texto(`${gastos.length > 1 ? `${gastos.length} saídas registradas` : "Registrada"}: ${lista}${gastos.length > 4 ? "…" : "."}`);
  }

  if (!imagem || imagem.length > 8_000_000) return texto("A imagem não chegou ou é grande demais.");
  const tipo = imagem.startsWith("iVBOR") ? "image/png" : "image/jpeg";

  // Lançar gastos de uma foto (cupom, comprovante, print)
  if (acao === "foto") {
    const r = await lancarImagem(uid, { data: imagem, tipo }, hoje, chaveIA);
    if (r.novos.length) await alertar(uid);
    return texto(r.msg);
  }

  // Conferir o saldo da caixinha a partir do print do banco
  if (acao === "caixinha") {
    const r = await perguntar(chaveIA, INSTRUCOES_CAIXA, ESQUEMA_CAIXA, { data: imagem, tipo });
    if (!r.texto) { console.error("atalho caixinha:", r.detalhe); return texto(/429|quota/i.test(r.detalhe) ? "O limite grátis do Gemini acabou por hoje." : "Não deu para ler o print agora. Tente de novo."); }
    let j;
    try { j = lerJSON(r.texto); } catch { return texto("A leitura veio num formato inesperado. Tente de novo."); }
    const bruto = Math.round(Math.abs(+j?.bruto || 0) * 100) / 100, liq = Math.round(Math.abs(+j?.liquido || 0) * 100) / 100;
    if (!j?.e_caixinha || !(bruto > 0)) return texto("Não achei o saldo da caixinha nesse print. Abra a tela da caixinha no banco e tente de novo.");
    const movs = await rest(`caixinha?user_id=eq.${uid}&data=lte.${hoje}&select=valor`) ?? [];
    const soma = Math.round(movs.reduce((s, m) => s + (+m.valor || 0), 0) * 100) / 100;
    if (soma > 100 && (bruto < soma * 0.6 || bruto > soma * 1.6)) {
      return texto(`Li ${reais(bruto)}, muito longe do saldo que o app conhece (cerca de ${reais(soma)}). Não registrei nada. Se estiver certo, confira pelo app.`);
    }
    const diff = Math.round((bruto - soma) * 100) / 100;
    if (Math.abs(diff) >= 0.005) {
      await rest("caixinha", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify([{ user_id: uid, id: novoId(), data: hoje, valor: diff, tipo: "ajuste", mes: null, nota: "Pelo atalho" }]) });
    }
    let extra = "";
    if (liq > 0 && liq <= bruto) {
      const p = await rest(`perfis?user_id=eq.${uid}&select=config`);
      const cfg = p?.[0]?.config;
      if (cfg && typeof cfg === "object") {
        cfg.cxLiq = { data: hoje, imp: Math.round((bruto - liq) * 100) / 100 };
        await rest(`perfis?user_id=eq.${uid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ config: cfg, updated_at: new Date().toISOString() }) });
        extra = ` · líquido ${reais(liq)}`;
      }
    }
    return texto(`Caixinha conferida: ${reais(bruto)} bruto${extra}.`);
  }

  // diagnóstico: mostra o que chegou (sem a chave e sem a imagem) para achar erro no atalho
  const recebido = Object.keys(corpo ?? {}).filter((k) => k !== "chave").map((k) => k === "imagem" ? `imagem(${imagem.length})` : `${k}=${JSON.stringify(corpo[k]).slice(0, 30)}`).join(", ");
  console.error("atalho ação desconhecida:", recebido);
  return texto(`Ação desconhecida (${recebido || "nenhum campo"}). Use acao = gasto, falar, print ou caixinha. [${VERSAO}]`);
}
