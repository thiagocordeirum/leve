// Respostas HTTP comuns às funções do Leve.
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const responder = (corpo, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
// Texto puro: usado pelos atalhos do iPhone, que mostram a resposta direto numa notificação.
export const texto = (t, status = 200) => new Response(t, { status, headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } });
