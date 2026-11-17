// Função "whatsapp": recebe as mensagens do WhatsApp (webhook da Meta) e responde. Ver whatsapp.ts.
// Sem login: quem garante a origem é a assinatura da Meta; Verify JWT desligado.
import { receber } from "./whatsapp.ts";

Deno.serve(async (req) => {
  try { return await receber(req); }
  catch (e) { console.error("whatsapp:", e); return new Response("ok"); }
});
