// Função "telegram": recebe as mensagens do bot do Leve no Telegram (webhook) e responde. Ver telegram.ts.
// Verify JWT desligado: o Telegram não manda login. Mensagens do Telegram são conferidas pelo segredo do
// webhook; pedidos do app, pelo login (/auth/v1/user).
import { receber } from "./telegram.ts";

Deno.serve(async (req) => {
  try { return await receber(req); }
  catch (e) { console.error("telegram: erro inesperado"); return new Response("ok"); }
});
