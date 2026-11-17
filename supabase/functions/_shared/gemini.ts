// Gemini (plano grátis): pedido com troca de modelo quando um está lotado ou sem cota.
// A chave fica no segredo GEMINI_API_KEY do Supabase, nunca no app. O Google pode usar o conteúdo enviado
// para melhorar os produtos dele (escolha do autor).
export const MODELO = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash";
// Se um modelo estiver lotado (503) ou sem cota (429), tenta o próximo. Cada um tem a própria cota grátis.
export const MODELOS = [...new Set([MODELO, "gemini-3.6-flash", "gemini-3.5-flash-lite"])];
// Tarefas simples (frase falada, categoria, conversa de texto): a Flash-Lite primeiro. É bem mais rápida (raciocínio
// mínimo por padrão) e tem cota grátis maior (500 pedidos/dia, contra 20 das Flash). Trocável por GEMINI_MODELO_RAPIDO.
const RAPIDO = Deno.env.get("GEMINI_MODELO_RAPIDO") ?? "gemini-3.5-flash-lite";
export const MODELOS_RAPIDOS = [...new Set([RAPIDO, ...MODELOS])];
// Raciocínio (thinking): as Flash raciocinam no nível "medium" por padrão, o que custa alguns segundos por pedido.
// Para ler gastos e conversar, "low" basta. A Flash-Lite já vem no mínimo e fica como está. Trocável por GEMINI_THINKING
// ("" = padrão do modelo). Se um modelo recusar o nível, o pedido é refeito sem ele.
const NIVEL = Deno.env.get("GEMINI_THINKING") ?? "low";
const nivelDe = (m) => (NIVEL && !/lite/.test(m) ? NIVEL : "");

// Procura o texto da resposta em qualquer formato conhecido da API (Interactions ou generateContent).
export function extrairTexto(b) {
  if (!b || typeof b !== "object") return null;
  if (typeof b.output_text === "string") return b.output_text;
  const parts = b.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const t = parts.map((p) => p?.text).filter((x) => typeof x === "string").join("");
    if (t) return t;
  }
  let achado = null;
  (function busca(o) {
    if (achado || !o || typeof o !== "object") return;
    if (typeof o.text === "string" && o.text.trim().startsWith("{")) { achado = o.text; return; }
    for (const v of Object.values(o)) busca(v);
  })(b.outputs ?? b.steps ?? b.output ?? b);
  return achado;
}

export const lerJSON = (texto) => JSON.parse(String(texto).replace(/^```(?:json)?\s*|\s*```$/g, ""));

// Tipo do anexo na Interactions API, pelo tipo do arquivo: foto, áudio (mensagem de voz) ou PDF.
const tipoMidia = (mime) => mime.startsWith("audio/") ? "audio" : mime === "application/pdf" ? "document" : "image";

// Pede ao Gemini, passando pelos modelos da lista. Devolve { texto } ou { detalhe } com os erros.
// "imagem" é o anexo ({ data: base64, tipo: mime }): foto, áudio ou PDF. "modelos" troca a ordem de tentativa.
export async function perguntar(chave, prompt, esquema, imagem = null, modelos = MODELOS) {
  let detalhe = "", ultimo = 0, ultimoErro = "";
  async function pedir(url, corpo, extra = {}) {
    const t0 = Date.now(), qual = `${corpo.model ?? url.split("/").pop().split(":")[0]} ${url.includes("interactions") ? "interactions" : "generateContent"}`;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "x-goog-api-key": chave, "Content-Type": "application/json", ...extra },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(20_000),
      });
      const b = await r.json().catch(() => null);
      ultimo = r.status;
      // tempo de cada pedido nos logs da função, para achar o que demora
      console.log(`gemini ${qual} ${r.status} ${Date.now() - t0}ms`);
      if (r.ok) return extrairTexto(b);
      ultimoErro = JSON.stringify(b)?.slice(0, 300) ?? "";
      detalhe += ` | ${url.split("/").pop()} ${r.status}: ${ultimoErro.slice(0, 200)}`;
    } catch (e) {
      ultimo = 0; ultimoErro = String(e);
      console.log(`gemini ${qual} falhou ${Date.now() - t0}ms`);
      detalhe += ` | ${url.split("/").pop()}: ${e}`;
    }
    return null;
  }
  // pede com o nível de raciocínio; se o modelo recusar o nível (400 citando thinking), refaz sem ele
  async function pedirComNivel(url, corpo, comNivel, extra) {
    const texto = await pedir(url, comNivel(corpo), extra);
    if (texto || ultimo !== 400 || !/thinking/i.test(ultimoErro)) return texto;
    return pedir(url, corpo, extra);
  }

  for (const m of modelos) {
    // 1) Interactions API (formato atual da documentação do Gemini)
    const input = [{ type: "text", text: prompt }];
    if (imagem) input.push({ type: tipoMidia(imagem.tipo), data: imagem.data, mime_type: imagem.tipo });
    const nivel = nivelDe(m);
    let texto = await pedirComNivel("https://generativelanguage.googleapis.com/v1beta/interactions", {
      model: m,
      input,
      response_format: { type: "text", mime_type: "application/json", schema: esquema },
    }, (c) => nivel ? { ...c, generation_config: { thinking_level: nivel } } : c, { "Api-Revision": "2026-05-20" });
    if (texto) return { texto };
    // Lotado, sem cota ou demorou: o mesmo modelo pelo outro formato também falharia, então vai para o próximo
    if ([0, 429, 500, 503].includes(ultimo)) continue;
    // 2) generateContent (formato anterior), se o problema foi o formato do pedido
    const parts = [{ text: prompt }];
    if (imagem) parts.push({ inline_data: { mime_type: imagem.tipo, data: imagem.data } });
    texto = await pedirComNivel(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      contents: [{ role: "user", parts }],
      generationConfig: { responseMimeType: "application/json" },
    }, (c) => nivel ? { ...c, generationConfig: { ...c.generationConfig, thinkingConfig: { thinkingLevel: nivel } } } : c);
    if (texto) return { texto };
  }
  return { detalhe };
}
