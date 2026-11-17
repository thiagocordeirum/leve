// Bot API do Telegram: chamadas, envio com HTML e proteção do token nos logs.
// Usada pela função telegram (conversa) e pelos avisos (_shared/avisos.ts), inclusive a partir do atalho.
import { paraHTML, semMarcas } from "./conversa.ts";

const env = (k) => Deno.env.get(k) ?? "";
export const temTelegram = () => !!env("TELEGRAM_TOKEN");
// o token do bot vai no endereço da Bot API: nunca deixar aparecer nos logs
export const ocultar = (s) => { const t = env("TELEGRAM_TOKEN"); return t ? String(s).split(t).join("<token>") : String(s); };

export async function tg(metodo, corpo = {}) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${env("TELEGRAM_TOKEN")}/${metodo}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(15_000),
    });
    const j = await r.json().catch(() => null);
    if (!j?.ok) console.error("telegram", metodo, r.status, ocultar(JSON.stringify(j)).slice(0, 300));
    return j;
  } catch (e) {
    console.error("telegram", metodo, ocultar(e));
    return null;
  }
}
// Texto com negrito e itálico (HTML do Telegram). Se o Telegram recusar a formatação, vai sem ela.
// extra: campos a mais do sendMessage (ex.: reply_markup com botões). Devolve true se a mensagem saiu.
export async function enviar(chat, texto, extra = {}) {
  const t = String(texto).slice(0, 3800);
  const j = await tg("sendMessage", { chat_id: chat, text: paraHTML(t), parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...extra });
  if (j?.ok) return true;
  const k = await tg("sendMessage", { chat_id: chat, text: semMarcas(t), link_preview_options: { is_disabled: true }, ...extra });
  return !!k?.ok;
}
