// Função "atalho": atalhos do iPhone (Lançar gasto, Conferir caixinha), sem login.
// Autenticada pela chave do atalho; Verify JWT desligado. Ver atalho.ts.
import { CORS, texto } from "../_shared/http.ts";
import { atalho, VERSAO } from "./atalho.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return texto("Use POST.", 405);
  const corpo = await req.json().catch(() => ({}));
  try { return await atalho(corpo, Deno.env.get("GEMINI_API_KEY")); }
  catch (e) { console.error("atalho:", e); return texto(`Algo deu errado no servidor. Tente de novo em instantes. [${VERSAO}]`); }
});
