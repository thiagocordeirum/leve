// Leve no Telegram (Bot API, grátis). O Telegram entrega cada mensagem aqui (webhook) com um segredo no
// cabeçalho X-Telegram-Bot-Api-Secret-Token. A função descobre de quem é a conversa (tabela telegram),
// entende texto, áudio, foto ou PDF (_shared/conversa.ts) e responde pelo próprio Telegram.
// Segredo no Supabase: só TELEGRAM_TOKEN (do @BotFather). O segredo do webhook é derivado dele (HMAC), então
// só quem tem o token sabe calculá-lo. O app (logado) chama { acao: "status" }: a função registra o webhook no
// Telegram se preciso e devolve o nome do bot, para o app montar o link de conectar.
// Avisos: { acao: "avisos" } (pg_cron, de hora em hora, sem login: só manda o que está na hora e ainda não
// foi mandado) e { acao: "alerta" } (app logado, depois de lançar um gasto). Ver _shared/avisos.ts.
import { CORS } from "../_shared/http.ts";
import { hojeSP, chaveServico, rest, sha256, base64, iguais } from "../_shared/banco.ts";
import { CANAIS, responder, boasVindas, ajuda, paraHTML, semMarcas, carregar } from "../_shared/conversa.ts";
import { tg, enviar, ocultar } from "../_shared/tgapi.ts";
import { TIPOS, ligado as avisoLigado, painel, estado, alertaTexto, alertarSePreciso, rodarAvisos } from "../_shared/avisos.ts";

export const VERSAO = "t4";
const ATUALIZACOES = ["message", "callback_query"];
const CANAL = CANAIS.telegram;
const env = (k) => Deno.env.get(k) ?? "";
// Baixa um anexo pela Bot API (até 20 MB pelo Telegram; aqui o limite é bem menor)
async function baixar(fileId, limite, tipo) {
  const j = await tg("getFile", { file_id: fileId });
  if (!j?.ok) { if (/too big/i.test(String(j?.description))) return { grande: true }; throw new Error("getFile falhou"); }
  if (+j.result?.file_size > limite) return { grande: true };
  const caminho = String(j.result?.file_path ?? "");
  if (!caminho || caminho.includes("..")) throw new Error("getFile sem caminho");
  let r;
  try { r = await fetch(`https://api.telegram.org/file/bot${env("TELEGRAM_TOKEN")}/${caminho}`, { signal: AbortSignal.timeout(20_000) }); }
  catch (e) { throw new Error(ocultar(e)); }
  if (!r.ok) throw new Error(`download ${r.status}`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.length > limite) return { grande: true };
  return { data: base64(bytes), tipo: String(tipo || "").split(";")[0].trim().toLowerCase() };
}

const NAO_CONECTADO = `Oi. Eu sou o Leve e só converso com quem conectou a conta.

No app Leve, toque no avatar, vá em Telegram e toque em Conectar.`;

// Botões do painel /avisos (liga e desliga cada aviso)
async function botao(cq, idUp) {
  const chat = cq?.message?.chat?.id;
  if (typeof cq?.id !== "string" || !Number.isSafeInteger(idUp)) return;
  // o Telegram mostra o botão "carregando" até receber esta resposta: ela sai sempre, mesmo se algo falhar
  let aviso = "Não deu agora. Tente de novo em instantes.";
  try {
    if (cq.message?.chat?.type !== "private" || !Number.isSafeInteger(chat)) return;
    const nova = await rest("mensagens_vistas?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify([{ id: "tg:" + idUp }]) });
    if (!nova?.length) { aviso = ""; return; }
    const lig = (await rest(`telegram?chat_id=eq.${chat}&select=user_id,avisos`))?.[0];
    const k = /^av:([a-z]+)$/.exec(String(cq.data ?? ""))?.[1], tipo = TIPOS.find((t) => t.k === k);
    if (!lig?.user_id) { aviso = "Conecte pelo app primeiro."; return; }
    if (!tipo) { aviso = "Esse botão não vale mais. Mande /avisos de novo."; return; }
    const prefs = { ...(lig.avisos && typeof lig.avisos === "object" && !Array.isArray(lig.avisos) ? lig.avisos : {}) };
    prefs[k] = !avisoLigado(prefs, k);
    await rest(`telegram?user_id=eq.${lig.user_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ avisos: prefs }) });
    aviso = `${tipo.nome}: ${prefs[k] ? "ligado" : "desligado"}`;
    const pn = painel(prefs);
    await tg("editMessageText", { chat_id: chat, message_id: cq.message.message_id, text: paraHTML(pn.texto), parse_mode: "HTML", reply_markup: pn.teclado });
  } finally {
    if (aviso) await tg("answerCallbackQuery", { callback_query_id: cq.id, text: aviso });
  }
}

export async function tratar(u, chaveIA) {
  if (u?.callback_query) { try { await botao(u.callback_query, u.update_id); } catch (e) { console.error("telegram botão:", ocultar(e?.stack ?? e)); } return; }
  const msg = u?.message, chat = msg?.chat?.id, idUp = u?.update_id;
  // só conversas privadas com pessoas (grupos e outros bots ficam de fora)
  if (!msg || msg.chat?.type !== "private" || msg.from?.is_bot || !Number.isSafeInteger(chat) || !Number.isSafeInteger(idUp)) return;
  let ligado = false;
  try {
    // o Telegram repete a entrega quando não recebe resposta a tempo: cada atualização é tratada uma vez só
    const nova = await rest("mensagens_vistas?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify([{ id: "tg:" + idUp }]) });
    if (!nova?.length) return;
    if (Math.random() < 0.05) await rest(`mensagens_vistas?criado=lt.${encodeURIComponent(new Date(Date.now() - 3 * 864e5).toISOString())}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => null);
    const texto = typeof msg.text === "string" ? msg.text.trim() : "";
    const start = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/i.exec(texto);

    // Conectar: o botão do app abre t.me/<bot>?start=<código> e o Telegram manda "/start <código>".
    // O código (32 hex, 15 min, uso único) é criado no app; só o hash dele fica no banco.
    const cod = (start?.[1] ?? /(?:^|[^0-9a-f])([0-9a-f]{32})(?![0-9a-f])/i.exec(texto)?.[1] ?? "").toLowerCase();
    if (/^[0-9a-f]{32}$/.test(cod)) {
      const l = (await rest(`telegram?codigo_hash=eq.${await sha256(cod)}&select=user_id,codigo_expira`))?.[0];
      if (!l || !(Date.parse(l.codigo_expira) > Date.now())) { await enviar(chat, "Esse código não vale mais. No Leve, toque no avatar, vá em Telegram e toque em Conectar para criar outro."); return; }
      await rest(`telegram?chat_id=eq.${chat}&user_id=neq.${l.user_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ chat_id: null, ligado: null, historico: [] }) });
      await rest(`telegram?user_id=eq.${l.user_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ chat_id: chat, ligado: new Date().toISOString(), codigo_hash: null, codigo_expira: null, historico: [] }) });
      const cfg = (await rest(`perfis?user_id=eq.${l.user_id}&select=config`))?.[0]?.config;
      await enviar(chat, boasVindas(CANAL, String(cfg?.nome ?? "").trim().split(" ")[0].slice(0, 30)));
      return;
    }

    const lig = (await rest(`telegram?chat_id=eq.${chat}&select=user_id,historico,avisos`))?.[0];
    if (!lig?.user_id) { await enviar(chat, NAO_CONECTADO); return; }
    ligado = true;
    if (start || /^\/(ajuda|help)\b/i.test(texto)) { await enviar(chat, ajuda(CANAL)); return; }
    if (/^\/avisos\b/i.test(texto)) {
      // os botões só funcionam se o Telegram mandar os toques para cá: confere o registro antes de mostrar
      await garantirWebhook().catch(() => false);
      const pn = painel(lig.avisos); await enviar(chat, pn.texto, { reply_markup: pn.teclado }); return;
    }
    if (!chaveIA) { await enviar(chat, "A chave da IA não está configurada no servidor."); return; }
    const uid = lig.user_id, historico = (Array.isArray(lig.historico) ? lig.historico : []).filter((h) => h && typeof h.t === "string").slice(-8);
    const hoje = hojeSP(+msg.date > 0 ? new Date(+msg.date * 1000) : new Date());

    let m;
    if (texto) m = { tipo: "texto", texto };
    else if (msg.voice || msg.audio) {
      const a = msg.voice ?? msg.audio;
      m = { tipo: "audio", duracao: +a.duration || 0, baixar: (lim) => baixar(a.file_id, lim, a.mime_type || "audio/ogg") };
    } else if (Array.isArray(msg.photo) && msg.photo.length) {
      // o Telegram manda a foto em vários tamanhos: usa o maior que caiba no limite
      const fotos = [...msg.photo].sort((a, b) => (+a.file_size || 0) - (+b.file_size || 0));
      const f = fotos.filter((p) => !(+p.file_size > 6_000_000)).pop() ?? fotos[0];
      m = { tipo: "imagem", rotulo: "foto", legenda: msg.caption, baixar: (lim) => baixar(f.file_id, lim, "image/jpeg") };
    } else if (msg.document) {
      m = { tipo: "imagem", rotulo: "arquivo", legenda: msg.caption, baixar: (lim) => baixar(msg.document.file_id, lim, msg.document.mime_type) };
    } else m = { tipo: "outro", rotulo: msg.sticker ? "figurinha" : msg.video || msg.video_note ? "vídeo" : "mensagem" };

    if (m.tipo !== "outro") await tg("sendChatAction", { chat_id: chat, action: "typing" });
    const r = await responder(uid, historico, m, hoje, chaveIA, CANAL);
    if (!r?.resposta) return;
    // lançou: se a semana passou de 80% ou do limite, o alerta vai junto na resposta
    if (r.lancou && avisoLigado(lig.avisos, "alerta")) {
      const a = await alertaTexto(uid, estado(await carregar(uid, hoje), hoje)).catch(() => null);
      if (a) r.resposta += " " + a.curto;
    }
    await enviar(chat, r.resposta);
    const novoHist = [...historico, { q: "u", t: semMarcas(r.disse).slice(0, 300) }, { q: "l", t: semMarcas(r.resposta).slice(0, 300) }].slice(-8);
    await rest(`telegram?user_id=eq.${uid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ historico: novoHist }) });
  } catch (e) {
    console.error("telegram:", ocultar(e?.stack ?? e));
    if (ligado) await enviar(chat, `Algo deu errado por aqui. Tente de novo em instantes. [${VERSAO}]`).catch(() => null);
  }
}

// Segredo do webhook: HMAC-SHA256 do texto fixo com o token do bot (64 hex, aceito pelo Telegram)
async function segredoWebhook() {
  const t = env("TELEGRAM_TOKEN");
  if (!t) return "";
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(t), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const b = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode("leve-telegram-webhook-v1"));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Confere o registro do bot no Telegram (endereço, segredo e tipos de atualização: mensagens e toques em botões)
// e corrige o que faltar. Roda quando o app pede o status, quando alguém manda /avisos e na rodada de hora em hora.
async function garantirWebhook(forcar = false) {
  const url = `${env("SUPABASE_URL")}/functions/v1/telegram`;
  const info = (await tg("getWebhookInfo"))?.result;
  if (!info) return false;
  const novo = info.url !== url || !ATUALIZACOES.every((x) => (info.allowed_updates ?? []).includes(x));
  // de vez em quando registra de novo: se o token mudar, o segredo derivado muda junto
  if (novo || forcar || Math.random() < 0.05) {
    const wh = await tg("setWebhook", { url, secret_token: await segredoWebhook(), allowed_updates: ATUALIZACOES, max_connections: 10 });
    if (!wh?.ok) return false;
    if (novo) {
      await tg("setMyCommands", { commands: [{ command: "start", description: "Começar" }, { command: "avisos", description: "Ligar e desligar os avisos" }, { command: "ajuda", description: "O que eu sei fazer" }] });
      await tg("setMyShortDescription", { short_description: "Suas saídas por mensagem, áudio ou foto." });
      await tg("setMyDescription", { description: "Eu sou o Leve. Registro suas saídas por texto, áudio ou foto e digo quanto ainda dá para gastar na semana.\n\nPara usar, conecte pelo app: avatar → Telegram → Conectar." });
    }
  } else if (info.last_error_message) console.error("telegram webhook:", info.last_error_message);
  return true;
}

// Status para o app: confere o bot e o registro e devolve o nome do bot.
let nomeBot = "";
async function status() {
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { ...CORS, "Content-Type": "application/json" } });
  if (!env("TELEGRAM_TOKEN")) return json({ pronto: false, erro: "Falta o TELEGRAM_TOKEN nos segredos do Supabase." });
  if (!nomeBot) {
    const me = await tg("getMe");
    if (!me?.ok) return json({ pronto: false, erro: "O TELEGRAM_TOKEN não foi aceito pelo Telegram. Confira se copiou o token inteiro." });
    nomeBot = String(me.result?.username ?? "");
  }
  if (!(await garantirWebhook())) return json({ pronto: false, erro: "O Telegram não aceitou o endereço da função." });
  return json({ pronto: !!nomeBot, bot: nomeBot });
}

export async function receber(req) {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Use POST", { status: 405 });
  // Mensagem do Telegram: traz o segredo no cabeçalho
  const veio = req.headers.get("x-telegram-bot-api-secret-token");
  if (veio === null) {
    const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { ...CORS, "Content-Type": "application/json" } });
    const b = await req.json().catch(() => ({}));
    // Rodada dos avisos (pg_cron, de hora em hora). Sem login de propósito: só manda o que está na hora e ainda
    // não foi mandado, então chamar a mais não muda nada.
    if (b?.acao === "avisos") {
      if (!chaveServico()) return json({ erro: "falta a chave de serviço" }, 500);
      // responde logo e trabalha em segundo plano (o pg_net não precisa esperar)
      const rodada = (env("TELEGRAM_TOKEN") ? garantirWebhook().catch(() => false) : Promise.resolve()).then(() => rodarAvisos()).catch((e) => { console.error("avisos:", ocultar(e?.stack ?? e)); return { erro: true }; });
      if (globalThis.EdgeRuntime?.waitUntil) { globalThis.EdgeRuntime.waitUntil(rodada); return json({ ok: true }); }
      return json(await rodada);
    }
    // Pedidos do app: só para quem está logado
    const auth = req.headers.get("Authorization") ?? "";
    const apikey = req.headers.get("apikey") ?? env("SUPABASE_ANON_KEY");
    const quem = await fetch(`${env("SUPABASE_URL")}/auth/v1/user`, { headers: { Authorization: auth, apikey } }).catch(() => null);
    const eu = quem?.ok ? await quem.json().catch(() => null) : null;
    if (!eu?.id) return json({ erro: "Entre no Leve." }, 401);
    if (b?.acao === "alerta") {
      if (!chaveServico() || !/^[0-9A-Za-z-]{1,64}$/.test(String(eu.id))) return json({ ok: false });
      return json({ ok: await alertarSePreciso(eu.id).catch((e) => { console.error("alerta:", ocultar(e)); return false; }) });
    }
    return status();
  }
  const seg = await segredoWebhook();
  if (!seg || !iguais(veio, seg)) return new Response("Proibido", { status: 401 });
  if (!chaveServico()) { console.error("telegram: falta a chave de serviço"); return new Response("ok"); }
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > 500_000) return new Response("Grande demais", { status: 413 });
  let corpo;
  try { corpo = JSON.parse(new TextDecoder().decode(bytes)); } catch { return new Response("JSON inválido", { status: 400 }); }
  // responde logo (o Telegram reenvia se demorar) e trata a mensagem em seguida
  const trabalho = tratar(corpo, env("GEMINI_API_KEY"));
  if (globalThis.EdgeRuntime?.waitUntil) globalThis.EdgeRuntime.waitUntil(trabalho); else await trabalho;
  return new Response("ok");
}
