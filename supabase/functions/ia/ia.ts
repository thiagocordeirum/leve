// IA do app logado: ler foto de gasto, categorias da importação e resumo do período.
// Pedidos sem login são barrados pelo Supabase (Verify JWT ligado) e de novo aqui (/auth/v1/user).
import { responder } from "../_shared/http.ts";
import { perguntar, lerJSON, MODELOS_RAPIDOS } from "../_shared/gemini.ts";
import { ESQUEMA_FOTO, ESQUEMA_CATS, instrucoesFoto, instrucoesCats, instrucoesFrase, limparGastos, limparCats } from "../_shared/regras.ts";

const ESQUEMA_RESUMO = {
  type: "object",
  properties: {
    destaques: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, titulo: { type: "string" }, texto: { type: "string" } },
        required: ["id", "titulo", "texto"],
      },
    },
    sugestao: { type: "string" },
  },
  required: ["destaques", "sugestao"],
};

function instrucoesResumo(dados) {
  return `Você ajuda uma pessoa no Brasil a cumprir o próprio plano de gastos. O objetivo dela é, nesta ordem: gastar dentro do "livre" do período (o que sobra do salário depois da meta de guardar e dos custos fixos), cumprir a meta de guardar do mês e chegar ao objetivo da caixinha (reserva).

Abaixo estão os dados do período, já calculados pelo app, e uma lista de fatos candidatos com id.

Tarefa:
- Escolha de 3 a 4 fatos que mais importam para esse objetivo, do mais para o menos relevante. Priorize impacto em reais e o que ainda dá para mudar no período (se ele não estiver encerrado). Evite dois fatos que digam a mesma coisa.
- Para cada um, escreva "titulo" (até 40 caracteres) e "texto" (até 160 caracteres), em português do Brasil, direto e gentil, sem julgamento e sem exclamações.
- Use SOMENTE os números que aparecem nos dados, escritos exatamente como estão (ex.: "R$ 1.234,56"). Não calcule números novos, não arredonde e não invente.
- "sugestao": uma ação concreta e realista para o resto do período (ou para o próximo, se este estiver encerrado), ligada a um dos fatos escolhidos e ao objetivo, com até 200 caracteres. Se usar valor, use um que esteja nos dados.

Dados (JSON):
${JSON.stringify(dados)}

Responda só com o JSON no formato {"destaques":[{"id":"..","titulo":"..","texto":".."}],"sugestao":".."}, usando os ids da lista de fatos.`;
}

function falhou(detalhe) {
  console.error("ia sem resposta:", detalhe);
  const limite = /429|RESOURCE_EXHAUSTED|quota/i.test(detalhe);
  const lotado = /503|UNAVAILABLE|high demand|overloaded/i.test(detalhe);
  const erro = limite ? "O limite grátis do Gemini acabou por hoje. Tente amanhã."
    : lotado ? "O Gemini está sobrecarregado agora. Tente de novo em alguns minutos."
    : "Não deu para ler agora. Tente de novo.";
  return responder({ erro, detalhe }, 502);
}

// Modos: { itens } categorias; { resumo } resumo do período; { frase, hoje } gastos ditos; { imagem, tipo, hoje } foto.
export async function tratarIA(req, corpo) {
  // Só para quem está logado no app
  const auth = req.headers.get("Authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const quem = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
  if (!quem.ok) return responder({ erro: "Entre no Leve para usar a IA." }, 401);

  const chave = Deno.env.get("GEMINI_API_KEY");
  if (!chave) return responder({ erro: "A chave do Gemini não está configurada no Supabase." }, 500);

  // Modo 2: categorias dos gastos importados
  if (Array.isArray(corpo?.itens)) {
    const itens = corpo.itens.slice(0, 300).map((x) => ({
      i: Number.isInteger(x?.i) ? x.i : -1,
      descricao: String(x?.descricao ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
      valor: Math.round(Math.abs(Number(x?.valor)) * 100) / 100 || 0,
    })).filter((x) => x.i >= 0 && x.descricao);
    if (!itens.length) return responder({ categorias: [] });
    const r = await perguntar(chave, instrucoesCats(itens), ESQUEMA_CATS, null, MODELOS_RAPIDOS);
    if (!r.texto) return falhou(r.detalhe);
    try {
      return responder({ categorias: limparCats(r.texto, new Set(itens.map((x) => x.i))) });
    } catch (e) {
      console.error("ia resposta inválida:", String(r.texto).slice(0, 300));
      return responder({ erro: "A resposta veio num formato inesperado. Tente de novo." }, 502);
    }
  }

  // Modo 3: resumo do período
  if (corpo?.resumo && typeof corpo.resumo === "object") {
    const dados = corpo.resumo;
    const fatos = Array.isArray(dados.fatos) ? dados.fatos.slice(0, 12).map((f) => ({
      id: String(f?.id ?? "").slice(0, 60),
      tipo: String(f?.tipo ?? "").slice(0, 12),
      texto: String(f?.texto ?? "").slice(0, 300),
    })).filter((f) => f.id && f.texto) : [];
    if (!fatos.length) return responder({ destaques: [], sugestao: "" });
    const limpo = { periodo: dados.periodo ?? {}, plano: dados.plano ?? {}, fatos };
    if (JSON.stringify(limpo).length > 20_000) return responder({ erro: "Dados demais para o resumo." }, 400);
    const r = await perguntar(chave, instrucoesResumo(limpo), ESQUEMA_RESUMO);
    if (!r.texto) return falhou(r.detalhe);
    try {
      const j = lerJSON(r.texto), ids = new Set(fatos.map((f) => f.id)), vistos = new Set();
      const destaques = (Array.isArray(j?.destaques) ? j.destaques : [])
        .filter((d) => ids.has(d?.id) && !vistos.has(d.id) && vistos.add(d.id)).slice(0, 4)
        .map((d) => ({ id: d.id, titulo: String(d.titulo ?? "").trim().slice(0, 60), texto: String(d.texto ?? "").trim().slice(0, 240) }));
      return responder({ destaques, sugestao: String(j?.sugestao ?? "").trim().slice(0, 280) });
    } catch (e) {
      console.error("ia resposta inválida:", String(r.texto).slice(0, 300));
      return responder({ erro: "A resposta veio num formato inesperado. Tente de novo." }, 502);
    }
  }

  // Modo 4: frase (ditada ou escrita)
  if (typeof corpo?.frase === "string") {
    const frase = corpo.frase.replace(/\s+/g, " ").trim();
    const hoje = /^\d{4}-\d{2}-\d{2}$/.test(corpo?.hoje) ? corpo.hoje : new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    if (!frase) return responder({ gastos: [] });
    const r = await perguntar(chave, instrucoesFrase(hoje, frase), ESQUEMA_FOTO, null, MODELOS_RAPIDOS);
    if (!r.texto) return falhou(r.detalhe);
    try { return responder({ gastos: limparGastos(r.texto, hoje).slice(0, 10) }); }
    catch { console.error("ia frase inválida:", String(r.texto).slice(0, 300)); return responder({ erro: "Não entendi a frase. Tente de novo." }, 502); }
  }

  // Modo 1: foto
  const imagem = corpo?.imagem, tipo = /^image\/(jpeg|png|webp|heic|heif)$/.test(corpo?.tipo) ? corpo.tipo : "image/jpeg";
  const hoje = /^\d{4}-\d{2}-\d{2}$/.test(corpo?.hoje) ? corpo.hoje : new Date().toISOString().slice(0, 10);
  if (typeof imagem !== "string" || !imagem || imagem.length > 8_000_000) {
    return responder({ erro: "A imagem não chegou ou é grande demais." }, 400);
  }
  const r = await perguntar(chave, instrucoesFoto(hoje), ESQUEMA_FOTO, { data: imagem, tipo });
  if (!r.texto) return falhou(r.detalhe);
  try {
    return responder({ gastos: limparGastos(r.texto, hoje) });
  } catch (e) {
    console.error("ia resposta inválida:", String(r.texto).slice(0, 300));
    return responder({ erro: "A leitura veio num formato inesperado. Tente de novo." }, 502);
  }
}
