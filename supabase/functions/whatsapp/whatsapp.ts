// Leve no WhatsApp (API oficial da Meta, WhatsApp Cloud API). Ainda não está em uso (a conta de desenvolvedor
// da Meta exige uma conta do Facebook ativa); o canal em uso é o Telegram. A conversa em si está em
// _shared/conversa.ts; aqui fica só o que é da Meta: assinatura, envio, anexos e o vínculo pelo número.
// Segredos no Supabase: WHATSAPP_TOKEN, WHATSAPP_APP_SECRET, WHATSAPP_PHONE_ID, WHATSAPP_VERIFY_TOKEN.
import { hojeSP, chaveServico, rest, sha256, base64 } from "../_shared/banco.ts";
import { CANAIS, responder, boasVindas, paraWhats, semMarcas } from "../_shared/conversa.ts";

export const VERSAO = "w2";
const CANAL = CANAIS.whatsapp;
const env = (k) => Deno.env.get(k) ?? "";
const GRAPH = () => `https://graph.facebook.com/${env("WHATSAPP_API_VERSION") || "v23.0"}`;
const enc = new TextEncoder();

// A Meta assina o corpo do pedido com o "App Secret" (HMAC-SHA256). Sem assinatura válida, nada é lido.
export async function assinaturaOk(bytes, cabecalho) {
  const segredo = env("WHATSAPP_APP_SECRET"), m = /^sha256=([0-9a-f]{64})$/.exec(String(cabecalho ?? ""));
  if (!segredo || !m) return false;
  const chave = await crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = [...new Uint8Array(await crypto.subtle.sign("HMAC", chave, bytes))].map((x) => x.toString(16).padStart(2, "0")).join("");
  let dif = 0;
  for (let i = 0; i < 64; i++) dif |= mac.charCodeAt(i) ^ m[1].charCodeAt(i);
  return dif === 0;
}
async function meta(corpo) {
  const r = await fetch(`${GRAPH()}/${env("WHATSAPP_PHONE_ID")}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...corpo }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) console.error("whatsapp envio", r.status, (await r.text()).slice(0, 300));
  return r.ok;
}
const enviar = (para, texto) => meta({ recipient_type: "individual", to: para, type: "text", text: { preview_url: false, body: paraWhats(texto).slice(0, 3500) } });
// marca como lida e mostra "digitando…" enquanto a resposta é preparada
const lida = (id) => meta({ status: "read", message_id: id, typing_indicator: { type: "text" } }).catch(() => false);

// Baixa um anexo: a Meta devolve um endereço temporário, que só abre com o token.
async function baixar(idMidia, limite) {
  const auth = { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}` };
  const r1 = await fetch(`${GRAPH()}/${encodeURIComponent(idMidia)}`, { headers: auth, signal: AbortSignal.timeout(15_000) });
  const j = await r1.json().catch(() => null);
  if (!r1.ok || typeof j?.url !== "string") throw new Error(`midia ${r1.status}`);
  if (+j.file_size > limite) return { grande: true };
  // o token só vai para endereços da própria Meta
  const u = new URL(j.url);
  if (u.protocol !== "https:" || !/(^|\.)(fbsbx\.com|fbcdn\.net|facebook\.com|whatsapp\.net|whatsapp\.com)$/.test(u.hostname)) throw new Error("midia: endereço inesperado");
  const arq = await fetch(u, { headers: auth, signal: AbortSignal.timeout(20_000) });
  if (!arq.ok) throw new Error(`midia download ${arq.status}`);
  const bytes = new Uint8Array(await arq.arrayBuffer());
  if (bytes.length > limite) return { grande: true };
  return { data: base64(bytes), tipo: String(j.mime_type || arq.headers.get("content-type") || "").split(";")[0].trim().toLowerCase() };
}

export async function tratar(msg, chaveIA) {
  const de = String(msg?.from ?? ""), id = String(msg?.id ?? "");
  if (!/^\d{8,20}$/.test(de) || !id || id.length > 200) return;
  let ligado = false;
  try {
    // a Meta repete a entrega quando não recebe resposta a tempo: cada mensagem é tratada uma vez só
    const nova = await rest("mensagens_vistas?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify([{ id: "wa:" + id }]) });
    if (!nova?.length) return;
    if (Math.random() < 0.05) await rest(`mensagens_vistas?criado=lt.${encodeURIComponent(new Date(Date.now() - 3 * 864e5).toISOString())}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => null);
    const tipo = String(msg?.type ?? ""), corpoTexto = tipo === "text" ? String(msg?.text?.body ?? "").trim() : "";

    // Conectar: a pessoa manda o código criado no app (Ajustes → WhatsApp). Só o hash dele fica no banco.
    const cod = /(?:^|[^0-9a-f])([0-9a-f]{32})(?![0-9a-f])/i.exec(corpoTexto)?.[1]?.toLowerCase();
    if (cod) {
      const l = (await rest(`whatsapp?codigo_hash=eq.${await sha256(cod)}&select=user_id,codigo_expira`))?.[0];
      if (!l || !(Date.parse(l.codigo_expira) > Date.now())) { await enviar(de, "Esse código não vale mais. No Leve, toque no avatar, vá em WhatsApp e toque em Conectar para criar outro."); return; }
      await rest(`whatsapp?telefone=eq.${de}&user_id=neq.${l.user_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ telefone: null, ligado: null, historico: [] }) });
      await rest(`whatsapp?user_id=eq.${l.user_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ telefone: de, ligado: new Date().toISOString(), codigo_hash: null, codigo_expira: null, historico: [] }) });
      const cfg = (await rest(`perfis?user_id=eq.${l.user_id}&select=config`))?.[0]?.config;
      await enviar(de, boasVindas(CANAL, String(cfg?.nome ?? "").trim().split(" ")[0].slice(0, 30)));
      return;
    }

    const lig = (await rest(`whatsapp?telefone=eq.${de}&select=user_id,historico`))?.[0];
    // número que não está ligado a ninguém: sem resposta (no WhatsApp cada mensagem enviada custa)
    if (!lig?.user_id) { console.log("whatsapp: número não conectado, final", de.slice(-4)); return; }
    ligado = true;
    const uid = lig.user_id, historico = (Array.isArray(lig.historico) ? lig.historico : []).filter((h) => h && typeof h.t === "string").slice(-8);
    if (["reaction", "system", "unsupported", "interactive", "button", "order"].includes(tipo)) return;
    await lida(id);
    if (!chaveIA) { await enviar(de, "A chave da IA não está configurada no servidor."); return; }
    const ts = +msg?.timestamp > 0 ? new Date(+msg.timestamp * 1000) : new Date(), hoje = hojeSP(ts);
    let m;
    if (tipo === "text") m = { tipo: "texto", texto: corpoTexto };
    else if (tipo === "audio") m = { tipo: "audio", baixar: (lim) => baixar(msg.audio?.id, lim) };
    else if (tipo === "image" || tipo === "document") {
      const anexo = msg.image ?? msg.document;
      m = { tipo: "imagem", rotulo: tipo === "image" ? "foto" : "arquivo", legenda: anexo?.caption, baixar: (lim) => baixar(anexo?.id, lim) };
    } else m = { tipo: "outro", rotulo: tipo };
    const r = await responder(uid, historico, m, hoje, chaveIA, CANAL);
    if (!r?.resposta) return;
    await enviar(de, r.resposta);
    const novoHist = [...historico, { q: "u", t: semMarcas(r.disse).slice(0, 300) }, { q: "l", t: semMarcas(r.resposta).slice(0, 300) }].slice(-8);
    await rest(`whatsapp?user_id=eq.${uid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ historico: novoHist }) });
  } catch (e) {
    console.error("whatsapp:", e);
    if (ligado) await enviar(de, `Algo deu errado por aqui. Tente de novo em instantes. [${VERSAO}]`).catch(() => null);
  }
}

// Entrada HTTP: verificação do endereço (GET) e mensagens (POST)
export async function receber(req) {
  const url = new URL(req.url);
  if (req.method === "GET") {
    // a Meta confere o endereço uma vez, com o "token de verificação" combinado
    const tok = env("WHATSAPP_VERIFY_TOKEN");
    if (tok && url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === tok) {
      return new Response(url.searchParams.get("hub.challenge") ?? "", { headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Proibido", { status: 403 });
  }
  if (req.method !== "POST") return new Response("Use POST", { status: 405 });
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > 500_000) return new Response("Grande demais", { status: 413 });
  if (!(await assinaturaOk(bytes, req.headers.get("x-hub-signature-256")))) return new Response("Assinatura inválida", { status: 401 });
  if (!env("WHATSAPP_TOKEN") || !env("WHATSAPP_PHONE_ID") || !chaveServico()) { console.error("whatsapp: faltam segredos (WHATSAPP_TOKEN, WHATSAPP_PHONE_ID ou chave de serviço)"); return new Response("ok"); }
  let corpo;
  try { corpo = JSON.parse(new TextDecoder().decode(bytes)); } catch { return new Response("JSON inválido", { status: 400 }); }
  const msgs = [];
  for (const e of Array.isArray(corpo?.entry) ? corpo.entry : []) {
    for (const c of Array.isArray(e?.changes) ? e.changes : []) {
      if (c?.field !== "messages" || c.value?.metadata?.phone_number_id !== env("WHATSAPP_PHONE_ID")) continue;
      for (const m of Array.isArray(c.value?.messages) ? c.value.messages : []) msgs.push(m);
    }
  }
  // responde logo (a Meta espera poucos segundos) e trata as mensagens em seguida, uma de cada vez
  const chaveIA = env("GEMINI_API_KEY");
  const trabalho = (async () => { for (const m of msgs.slice(0, 10)) await tratar(m, chaveIA); })();
  if (globalThis.EdgeRuntime?.waitUntil) globalThis.EdgeRuntime.waitUntil(trabalho); else await trabalho;
  return new Response("ok");
}
