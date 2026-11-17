// Função "ia" (app logado). Ver ia.ts.
import { CORS, responder } from "../_shared/http.ts";
import { tratarIA } from "./ia.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder({ erro: "Use POST." }, 405);
  const corpo = await req.json().catch(() => ({}));
  return tratarIA(req, corpo);
});
