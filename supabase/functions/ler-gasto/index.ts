// Função antiga "ler-gasto": mantida só durante a troca. Encaminha para o mesmo código das funções
// "ia" (app logado) e "atalho" (atalhos do iPhone). Pode ser apagada quando os atalhos usarem /functions/v1/atalho.
import { CORS, responder, texto } from "../_shared/http.ts";
import { tratarIA } from "../ia/ia.ts";
import { atalho, VERSAO } from "../atalho/atalho.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ erro: "Use POST." }, 405);
  const corpo = await req.json().catch(() => ({}));
  if (Object.keys(corpo ?? {}).some((k) => k.trim().toLowerCase() === "chave")) {
    try { return await atalho(corpo, Deno.env.get("GEMINI_API_KEY")); }
    catch (e) { console.error("atalho:", e); return texto(`Algo deu errado no servidor. Tente de novo em instantes. [${VERSAO}]`); }
  }
  return tratarIA(req, corpo);
});
