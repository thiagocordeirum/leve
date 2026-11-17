// Testa a função telegram no Node, com banco, Gemini e Telegram de mentira.
// Uso: npx esbuild supabase/functions/telegram/index.ts --bundle --platform=neutral --format=esm --outfile=/tmp/fn-telegram.mjs
//      node testes/telegram.mjs /tmp/fn-telegram.mjs
import { createHmac } from "node:crypto";
const TOKEN = "123456:ABCdefGhIJKlmNoPQRsTUVwxyZ-1234567890";
const SEG = createHmac("sha256", TOKEN).update("leve-telegram-webhook-v1").digest("hex");  // mesmo cálculo da função
const envs = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "eyJ", GEMINI_API_KEY: "g", TELEGRAM_TOKEN: TOKEN };
globalThis.Deno = { env: { get: (k) => envs[k] }, serve: (h) => { globalThis.H = h; } };
// relógio fixo (sexta, 13/11/2026, meio-dia em São Paulo): os números esperados não mudam com o dia em que o teste roda
const RealDate = Date;
const relogio = (iso) => { const t = RealDate.parse(iso); globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [t])); } static now() { return t; } }; };
relogio("2026-11-13T15:00:00Z");
const iso = (d) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const HOJE = iso(new Date()), ONTEM = iso(new Date(Date.now() - 864e5));
const db = {
  perfis: [{ user_id: "u1", config: { nome: "Bruno Lima", salario: 3200, meta: 600, vr: 1000, mob: 287, inicio: "2026-01", pagto: "ultimo-util", fixos: [{ id: "a", nome: "Net", valor: 100, onde: "cartao", inicio: "2026-01", fim: "" }], ajustes: {} } },
    { user_id: "u2", config: { nome: "Carla", salario: 2000, meta: 200, vr: 0, mob: 0, inicio: "2026-01", fixos: [], ajustes: {} } }],
  gastos: [
    { user_id: "u1", id: "g1", data: HOJE, valor: 40, cat: "comida", fonte: "conta", descricao: "Mercado", criado: new Date().toISOString() },
    { user_id: "u2", id: "g9", data: HOJE, valor: 99, cat: "lazer", fonte: "conta", descricao: "Show", criado: new Date().toISOString() },
  ],
  caixinha: [{ user_id: "u1", valor: 1000 }],
  telegram: [{ user_id: "u1", codigo_hash: null, codigo_expira: null, chat_id: null, ligado: null, historico: [] },
    { user_id: "u2", codigo_hash: null, codigo_expira: null, chat_id: null, ligado: null, historico: [] }],
  mensagens_vistas: [],
  avisos_enviados: [],
};
const ops = { eq: (a, b) => String(a) === b, neq: (a, b) => String(a) !== b, gte: (a, b) => String(a) >= b, lte: (a, b) => String(a) <= b, lt: (a, b) => String(a) < b,
  like: (a, b) => new RegExp("^" + b.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$").test(String(a)),
  not: (a, b) => b === "is.null" ? a !== null && a !== undefined : (() => { throw new Error("not " + b); })(),
  in: (a, b) => b.slice(1, -1).split(",").map((x) => x.replace(/^"|"$/g, "")).includes(String(a)) };
let escritas = [];
function banco(url, init) {
  const u = new URL(url), t = u.pathname.split("/").pop(), tab = db[t]; if (!tab) return new Response("sem tabela " + t, { status: 404 });
  const filtros = [...u.searchParams].filter(([k]) => !["select", "order", "limit", "on_conflict"].includes(k)).map(([k, v]) => { const i = v.indexOf("."); return [k, v.slice(0, i), v.slice(i + 1)]; });
  const bate = (r) => filtros.every(([k, op, v]) => { if (!ops[op]) throw new Error("op " + op); return r[k] !== null && r[k] !== undefined ? ops[op](r[k], v) : op === "neq"; });
  const m = init.method ?? "GET"; escritas.push(m + " " + t);
  if (m === "GET") { let rows = tab.filter(bate); const o = u.searchParams.get("order");
    if (o) { const [c, d] = o.split("."); rows = [...rows].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (d === "desc" ? -1 : 1)); }
    return Response.json(rows.slice(0, +(u.searchParams.get("limit") ?? 1e9))); }
  if (m === "POST") { const novos = []; for (const r of JSON.parse(init.body)) { if (t === "mensagens_vistas" && tab.some((x) => x.id === r.id)) continue; if (t === "avisos_enviados" && tab.some((x) => x.user_id === r.user_id && x.chave === r.chave)) continue; const l = { criado: new Date().toISOString(), ...r }; tab.push(l); novos.push(l); }
    return /representation/.test(init.headers?.Prefer ?? "") ? Response.json(novos, { status: 201 }) : new Response(null, { status: 201 }); }
  if (m === "PATCH") { tab.filter(bate).forEach((r) => Object.assign(r, JSON.parse(init.body))); return new Response(null, { status: 204 }); }
  if (m === "DELETE") { db[t] = tab.filter((r) => !bate(r)); return new Response(null, { status: 204 }); }
}
let gem, enviados = [], pedidosIA = [], tgCalls = [], recusarHTML = false, webhook = {};
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.includes("/rest/v1/")) return banco(url, init);
  if (url.endsWith("/auth/v1/user")) return init.headers?.Authorization === "Bearer jwt-valido" ? Response.json({ id: "u1" }) : new Response("{}", { status: 401 });
  if (url.includes("generativelanguage")) { const b = JSON.parse(init.body); pedidosIA.push(b); return Response.json({ output_text: JSON.stringify(typeof gem === "function" ? gem(b) : gem) }); }
  if (url.startsWith(`https://api.telegram.org/file/bot${TOKEN}/`)) return new Response(new Uint8Array([1, 2, 3, 4, 5]));
  const m = new RegExp(`^https://api\\.telegram\\.org/bot${TOKEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(\\w+)$`).exec(url);
  if (!m) return Response.json({ ok: false, description: "Unauthorized" }, { status: 401 });
  const b = JSON.parse(init.body || "{}"); tgCalls.push([m[1], b]);
  if (m[1] === "sendMessage") {
    if (b.parse_mode === "HTML" && (recusarHTML || /<(?!\/?(b|i)>)/.test(b.text))) return Response.json({ ok: false, description: "Bad Request: can't parse entities" }, { status: 400 });
    enviados.push(b); return Response.json({ ok: true, result: {} });
  }
  if (m[1] === "getFile") return b.file_id === "GRANDE" ? Response.json({ ok: false, description: "Bad Request: file is too big" }, { status: 400 }) : Response.json({ ok: true, result: { file_id: b.file_id, file_size: 5, file_path: "voice/file_1.oga" } });
  if (m[1] === "getMe") return Response.json({ ok: true, result: { id: 1, is_bot: true, username: "leve_teste_bot" } });
  if (m[1] === "setWebhook") { webhook = b; return Response.json({ ok: true, result: true }); }
  if (m[1] === "getWebhookInfo") return Response.json({ ok: true, result: { url: webhook.url ?? "", pending_update_count: 0, ...(webhook.allowed_updates ? { allowed_updates: webhook.allowed_updates } : {}) } });
  return Response.json({ ok: true, result: true });
};
const logs = []; const errOrig = console.error; console.error = (...a) => { logs.push(a.join(" ")); };
await import(process.argv[2]);
let upd = 100;
async function manda(message, { segredo = SEG, chat = 555, tipo = "private", id = ++upd } = {}) {
  enviados = []; pedidosIA = []; escritas = []; tgCalls = [];
  const corpo = { update_id: id, message: { message_id: id, from: { id: chat, is_bot: false, first_name: "T" }, chat: { id: chat, type: tipo }, date: Math.floor(Date.now() / 1000), ...message } };
  const h = segredo === null ? {} : { "x-telegram-bot-api-secret-token": segredo };
  const r = await H(new Request("https://f/telegram", { method: "POST", body: JSON.stringify(corpo), headers: h }));
  return r.status;
}
const txt = (text) => ({ text });
const ult = () => enviados.map((e) => e.text).join(" ⏎ ");
let falhas = 0;
const ok = (nome, cond, extra = "") => { if (!cond) falhas++; console.log((cond ? "ok   " : "FALHA") + " " + nome + (cond ? "" : "\n      " + extra)); };
const mostra = (rot) => console.log("      " + rot + " → " + JSON.stringify(ult()));
const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((x) => x.toString(16).padStart(2, "0")).join("");
const vazio = { transcricao: "", gastos: [], alvos: [], consulta: { de: "", ate: "", categoria: "todas", fonte: "todas", texto: "" }, resposta: "" };
const tg = () => db.gastos.filter((g) => g.id.startsWith("tg-") && g.user_id === "u1");

// segurança da entrada
ok("GET: 405", (await H(new Request("https://f/telegram"))).status === 405);
ok("sem o segredo e sem login: 401 e nada acontece", (await manda(txt("oi"), { segredo: null })) === 401 && !escritas.length && !webhook.url);
ok("segredo errado: 401", (await manda(txt("oi"), { segredo: "outro" })) === 401 && !escritas.length);
const status = async (auth) => { const r = await H(new Request("https://f/telegram", { method: "POST", headers: auth ? { Authorization: auth } : {}, body: JSON.stringify({ acao: "status" }) })); return [r.status, await r.json(), r.headers.get("access-control-allow-origin")]; };
let [st, js, cors] = await status("Bearer jwt-falso");
ok("status do app sem login válido: 401, sem registrar webhook", st === 401 && !webhook.url);
[st, js, cors] = await status("Bearer jwt-valido");
ok("status do app logado: registra o webhook com o segredo derivado e devolve o bot", st === 200 && js.pronto && js.bot === "leve_teste_bot" && webhook.url === "https://x.supabase.co/functions/v1/telegram" && webhook.secret_token === SEG && webhook.allowed_updates?.join() === "message,callback_query" && cors === "*", JSON.stringify(js));
ok("status não devolve o token nem o segredo", !JSON.stringify(js).includes(TOKEN) && !JSON.stringify(js).includes(SEG));
ok("segredo do webhook só tem caracteres aceitos pelo Telegram", /^[0-9a-f]{64}$/.test(SEG));
await manda(txt("oi"), { tipo: "group" }); ok("grupo: ignorado", !escritas.length && !enviados.length);

// conversa não conectada
await manda(txt("almoço 32")); ok("não conectado: explica como conectar, sem IA", /conectou a conta/.test(ult()) && !pedidosIA.length, ult());
await manda(txt("/start")); ok("/start sem código: mesma explicação", /Conectar/.test(ult()));

// conectar pelo link t.me/<bot>?start=<código>
const cod = "fedcba9876543210fedcba9876543210";
db.telegram[0].codigo_hash = await sha(cod); db.telegram[0].codigo_expira = new Date(Date.now() - 1000).toISOString();
await manda(txt("/start " + cod)); ok("código vencido: avisa e não conecta", /não vale mais/.test(ult()) && db.telegram[0].chat_id === null);
db.telegram[0].codigo_expira = new Date(Date.now() + 9e5).toISOString();
await manda(txt("/start " + cod)); ok("código certo: conecta, apaga o código, boas-vindas", db.telegram[0].chat_id === 555 && db.telegram[0].codigo_hash === null && /^Pronto, Bruno\. Este Telegram/.test(ult()), ult()); mostra("boas-vindas");
await manda(txt("/start " + cod)); ok("o mesmo código não vale de novo", /não vale mais/.test(ult()));
await manda(txt("/start")); ok("/start já conectado: ajuda", /Eu registro suas saídas/.test(ult()) && !pedidosIA.length);
// a outra pessoa conecta a própria conta noutro chat
const cod2 = "0123456789abcdef0123456789abcdef"; db.telegram[1].codigo_hash = await sha(cod2); db.telegram[1].codigo_expira = new Date(Date.now() + 9e5).toISOString();
await manda(txt("/start " + cod2), { chat: 777 }); ok("segunda pessoa conecta o próprio chat", db.telegram[1].chat_id === 777 && db.telegram[0].chat_id === 555 && /Pronto, Carla/.test(ult()));

// lançar por texto
gem = { ...vazio, acao: "lancar", gastos: [{ valor: 32, data: HOJE, descricao: "Almoço <b>", categoria: "comida", fonte: "vr" }, { valor: 18, data: ONTEM, descricao: "Uber & 99", categoria: "transporte", fonte: "conta" }] };
await manda(txt("almoço 32 no VR e uber 18 ontem"), { id: 9001 });
ok("texto: lança 2 gastos com id tg- na conta certa", tg().length === 2 && tg().every((g) => g.user_id === "u1"), JSON.stringify(tg()));
ok("envia em HTML, com negrito e texto de fora escapado", enviados[0]?.parse_mode === "HTML" && /<b>Almoço &lt;b&gt;<\/b>/.test(ult()) && /Uber &amp; 99/.test(ult()) && /<b>R\$ [\d.,]+<\/b> nesta semana/.test(ult()), ult()); mostra("lançar");
ok("mostra 'digitando' antes", tgCalls[0]?.[0] === "sendChatAction");
await manda(txt("almoço 32 no VR e uber 18 ontem"), { id: 9001 }); ok("entrega repetida: ignorada", !enviados.length && tg().length === 2);
gem = { ...vazio, acao: "lancar", gastos: [{ valor: 99, data: HOJE, descricao: "Show", categoria: "lazer", fonte: "conta" }] };
await manda(txt("gastei 99 no show"), { chat: 777, id: 9002 }); ok("cada chat lança na própria conta", db.gastos.filter((g) => g.user_id === "u2" && g.id.startsWith("tg-")).length === 1 && tg().length === 2);

// áudio do Telegram (voz, ogg)
gem = { ...vazio, acao: "lancar", transcricao: "padaria doze reais", gastos: [{ valor: 12, data: HOJE, descricao: "Padaria", categoria: "comida", fonte: "conta" }] };
await manda({ voice: { file_id: "V1", duration: 3, mime_type: "audio/ogg", file_size: 5 } });
ok("áudio: baixa pelo getFile e manda ao Gemini como audio/ogg", pedidosIA[0]?.input[1]?.type === "audio" && pedidosIA[0].input[1].mime_type === "audio/ogg" && pedidosIA[0].input[1].data === "AQIDBAU=", JSON.stringify(pedidosIA[0]?.input[1]));
ok("áudio: mostra o que ouviu (itálico) e lança", /^<i>Ouvi: "padaria doze reais"<\/i>\nRegistrada: <b>Padaria<\/b> R\$ 12,00/.test(ult()) && tg().length === 3, ult()); mostra("áudio");
await manda({ voice: { file_id: "V2", duration: 400, mime_type: "audio/ogg" } }); ok("áudio longo: recusa sem baixar nem IA", /longo demais/.test(ult()) && !pedidosIA.length && !tgCalls.some(([m]) => m === "getFile"));
await manda({ audio: { file_id: "GRANDE", duration: 60, mime_type: "audio/mpeg" } }); ok("arquivo grande demais no Telegram: recusa", /longo demais/.test(ult()) && !pedidosIA.length);

// perguntas
gem = (b) => { const m = /Ainda pode gastar nesta semana: (R\$ [\d.,]+)/.exec(b.input[0].text); return { ...vazio, acao: "situacao", resposta: `Você ainda pode gastar ${m[1]} nesta semana.` }; };
await manda(txt("quanto ainda posso gastar?")); ok("situação: número dos fatos passa", /^Você ainda pode gastar R\$ [\d.,]+ nesta semana\.$/.test(ult()), ult());
ok("pedido à IA cita o canal Telegram", /conversa pelo Telegram/.test(pedidosIA[0].input[0].text));
gem = { ...vazio, acao: "situacao", resposta: "Você pode gastar R$ 5.000,00." };
await manda(txt("e agora?")); ok("situação com número inventado: vai o resumo do código", !/5\.000,00/.test(ult()) && /<b>Semana<\/b>/.test(ult()), ult()); mostra("resumo");
gem = { ...vazio, acao: "consultar", consulta: { de: ONTEM, ate: HOJE, categoria: "todas", fonte: "todas", texto: "show" } };
await manda(txt("quanto gastei no show?")); ok("consulta só vê os gastos da própria conta", /não achei saídas/.test(ult()), ult());

// corrigir e apagar
gem = { ...vazio, acao: "corrigir", alvos: [1], gastos: [{ valor: 15, data: HOJE, descricao: "Padaria", categoria: "comida", fonte: "conta" }] };
await manda(txt("na verdade foi 15")); ok("corrigir o último", /Corrigi:/.test(ult()) && tg().find((g) => g.descricao === "Padaria").valor === 15, ult());
gem = { ...vazio, acao: "apagar", alvos: [1] };
await manda(txt("apaga o último")); ok("apagar o último (só da própria conta)", /^Apaguei: <b>Padaria<\/b>/.test(ult()) && tg().filter((g) => g.user_id === "u1").length === 2 && db.gastos.some((g) => g.id === "g9"), ult());

// foto e PDF
gem = { gastos: [{ valor: 58.9, data: HOJE, hora: "", descricao: "IFD*iFood", categoria: "comida", fonte: "cartao" }], resgates: [] };
await manda({ photo: [{ file_id: "P_peq", file_size: 2000 }, { file_id: "P_gde", file_size: 90000 }], caption: "no crédito" });
ok("foto: usa o maior tamanho, lê e lança", tgCalls.some(([m, b]) => m === "getFile" && b.file_id === "P_gde") && pedidosIA[0]?.input[1]?.type === "image" && /Registrada: IFD\*iFood R\$ 58,90/.test(ult()) && /no crédito/.test(pedidosIA[0].input[0].text), ult()); mostra("foto");
gem = { gastos: [{ valor: 120, data: HOJE, hora: "", descricao: "Conta de luz", categoria: "outros", fonte: "conta" }], resgates: [] };
await manda({ document: { file_id: "D1", mime_type: "application/pdf", file_name: "boleto.pdf" } });
ok("PDF: vai como document ao Gemini e lança", pedidosIA[0]?.input[1]?.type === "document" && /Conta de luz R\$ 120,00/.test(ult()), JSON.stringify(pedidosIA[0]?.input[1]?.type) + " " + ult());
await manda({ document: { file_id: "D2", mime_type: "application/zip" } }); ok("arquivo de outro tipo: recusa sem IA", /Não consegui abrir/.test(ult()) && !pedidosIA.length);
await manda({ sticker: { file_id: "S1" } }); ok("figurinha: explica, sem IA", /texto, áudio, foto e PDF/.test(ult()) && !pedidosIA.length);

// Telegram recusa a formatação: manda sem
recusarHTML = true; gem = { ...vazio, acao: "conversa", resposta: "Oi, Bruno." };
await manda(txt("oi")); ok("se o HTML for recusado, reenvia como texto simples", enviados.length === 1 && !enviados[0].parse_mode && enviados[0].text === "Oi, Bruno.", JSON.stringify(enviados)); recusarHTML = false;

// ---------------- avisos ----------------
const avisos = async () => { enviados = []; tgCalls = []; const r = await H(new Request("https://f/telegram", { method: "POST", body: JSON.stringify({ acao: "avisos" }) })); return [r.status, await r.json()]; };
const para = (chat) => enviados.filter((e) => e.chat_id === chat).map((e) => e.text).join(" ⏎ ");
db.gastos = [];  // cenário controlado: Bruno (u1, salário no último dia útil, semana de segunda) e Carla (u2, semana de domingo)
db.perfis[1].config.semana = "dom";
const G = (u, data, valor, fonte = "conta") => db.gastos.push({ user_id: u, id: "x" + db.gastos.length, data, valor, cat: "comida", fonte, descricao: "Teste", criado: new RealDate().toISOString() });
G("u1", "2026-11-10", 300);

relogio("2026-11-16T11:30:00Z");  // segunda 16/11, 8h30 em São Paulo
let [stA, rA] = await avisos();
ok("rodada sem login funciona e devolve o resumo", stA === 200 && rA.pessoas === 2, JSON.stringify(rA));
ok("segunda 8h30: Bruno recebe 'Semana nova' (semana de segunda) com a semana passada", /<b>Semana nova<\/b>, de 16\/11 a 22\/11: você pode gastar <b>R\$ [\d.,]+<\/b>/.test(para(555)) && /Semana passada: R\$ 300,00 de R\$/.test(para(555)) && /Vale-refeição: restam R\$ 1\.000,00/.test(para(555)), para(555)); console.log("      semana nova → " + JSON.stringify(para(555)));
ok("Carla (semana de domingo) não recebe semana nova na segunda", !para(777));
await avisos(); ok("a mesma rodada de novo não repete", !enviados.length);

relogio("2026-11-17T00:30:00Z");  // segunda 16/11, 21h30
G("u1", "2026-11-16", 950);  // ~86% do limite da semana (R$ 1.100,00)
await avisos();
ok("21h30: resumo da noite para os dois", /<b>Resumo de hoje<\/b>: você gastou <b>R\$ 950,00<\/b> em 1 saída/.test(para(555)) && /Resumo de hoje<\/b>: nenhuma saída/.test(para(777)), para(555) + " | " + para(777)); console.log("      noite → " + JSON.stringify(para(555)));
ok("passou de 80%: alerta de limite perto", /O limite da semana está perto: restam <b>R\$ 150,00<\/b> de R\$ 1\.100,00 até dom \(22\/11\)/.test(para(555)), para(555));
await avisos(); ok("alerta e resumo não se repetem", !enviados.length);
G("u1", "2026-11-16", 450);
await avisos(); ok("passou do limite: alerta de 100% (uma vez)", /^Esta semana passou <b>R\$ 300,00<\/b> do limite de R\$ 1\.100,00/.test(para(555)) && enviados.length === 1, para(555)); console.log("      alerta 100% → " + JSON.stringify(para(555)));

// pedido do app depois de um gasto (logado): manda só se houver alerta novo
enviados = [];
let rr = await H(new Request("https://f/telegram", { method: "POST", headers: { Authorization: "Bearer jwt-valido" }, body: JSON.stringify({ acao: "alerta" }) }));
ok("alerta pedido pelo app: nada novo, nada enviado", rr.status === 200 && (await rr.json()).ok === false && !enviados.length);
rr = await H(new Request("https://f/telegram", { method: "POST", body: JSON.stringify({ acao: "alerta" }) }));
ok("alerta sem login: 401", rr.status === 401);

// painel /avisos e botões
relogio("2026-11-18T15:00:00Z");
webhook.allowed_updates = ["message"];  // registro antigo, de antes dos botões
await manda(txt("/avisos"));
const pn = enviados[0];
ok("/avisos corrige o registro antigo para o Telegram mandar os toques nos botões", webhook.allowed_updates.includes("callback_query") && webhook.secret_token === SEG, JSON.stringify(webhook.allowed_updates));
ok("/avisos mostra os 4 avisos com botões", pn?.reply_markup?.inline_keyboard?.length === 4 && /Seus avisos/.test(pn.text) && pn.reply_markup.inline_keyboard[0][0].callback_data === "av:noite", JSON.stringify(pn));
const cb = async (data, chat = 555) => { enviados = []; tgCalls = []; const corpo = { update_id: ++upd, callback_query: { id: "cb" + upd, from: { id: chat }, data, message: { message_id: 42, chat: { id: chat, type: "private" } } } }; return (await H(new Request("https://f/telegram", { method: "POST", body: JSON.stringify(corpo), headers: { "x-telegram-bot-api-secret-token": SEG } }))).status; };
await cb("av:noite");
const resp = tgCalls.find(([m]) => m === "answerCallbackQuery")?.[1], edit = tgCalls.find(([m]) => m === "editMessageText")?.[1];
ok("botão desliga o resumo da noite, atualiza o painel e confirma", db.telegram[0].avisos?.noite === false && resp?.text === "Resumo da noite: desligado" && /Desligado: Resumo da noite/.test(edit?.text) && edit?.reply_markup?.inline_keyboard[0][0].text === "Resumo da noite: desligado", JSON.stringify([resp, edit?.text]));
await cb("av:qualquer"); ok("botão inválido: só responde", tgCalls.some(([m, b]) => m === "answerCallbackQuery" && /não vale mais/.test(b.text)) && db.telegram[0].avisos.noite === false);
await cb("av:noite"); ok("tocar de novo religa", db.telegram[0].avisos.noite === true && tgCalls.some(([m, b]) => m === "answerCallbackQuery" && b.text === "Resumo da noite: ligado"));
await cb("av:noite"); ok("e desliga de novo", db.telegram[0].avisos.noite === false);
const patchOrig = globalThis.fetch; globalThis.fetch = async (url, init = {}) => String(url).includes("/rest/v1/telegram") && init.method === "PATCH" ? new Response("erro", { status: 500 }) : patchOrig(url, init);
await cb("av:semana"); globalThis.fetch = patchOrig;
ok("se der erro ao salvar, o botão ainda recebe resposta (não fica carregando)", tgCalls.some(([m, b]) => m === "answerCallbackQuery" && /Não deu agora/.test(b.text)) && db.telegram[0].avisos.semana === undefined);
await cb("av:noite", 999); ok("botão de chat não conectado: não muda nada", tgCalls.some(([m, b]) => m === "answerCallbackQuery" && /Conecte/.test(b.text)));
relogio("2026-11-19T00:30:00Z");  // quarta 18/11, 21h30
await avisos(); ok("resumo desligado: Bruno não recebe, Carla recebe", !/Resumo de hoje/.test(para(555)) && /Resumo de hoje/.test(para(777)), para(555));

relogio("2026-11-22T11:10:00Z");  // domingo 22/11, 8h10
await avisos(); ok("domingo 8h: Carla (semana de domingo) recebe semana nova; Bruno não", /<b>Semana nova<\/b>, de 22\/11 a 28\/11/.test(para(777)) && !/Semana nova/.test(para(555)), para(777) + " | " + para(555));

relogio("2026-11-30T12:05:00Z");  // segunda 30/11, 9h05: último dia útil, salário do Bruno
await avisos();
ok("dia do salário: fatura, caixinha, livre e o mês que fechou; sem 'semana nova' repetida", /<b>Dia do salário<\/b>\. Hoje começa dezembro no Leve\./.test(para(555)) && /• Fatura do cartão: <b>R\$ 100,00<\/b>/.test(para(555)) && /• Guardar na caixinha: <b>R\$ 600,00<\/b>/.test(para(555)) && /Novembro fechou com R\$ 1\.700,00 de R\$ 2\.500,00 livres: sobraram R\$ 800,00\./.test(para(555)) && !/Semana nova/.test(para(555)), para(555)); console.log("      salário → " + JSON.stringify(para(555)));
relogio("2026-11-13T15:00:00Z");

// lançar pelo bot já leva o alerta junto
db.avisos_enviados = []; db.gastos = db.gastos.filter((g) => g.user_id !== "u1");
gem = { ...vazio, acao: "lancar", gastos: [{ valor: 2400, data: HOJE, descricao: "Notebook", categoria: "compras", fonte: "conta" }] };
await manda(txt("notebook 2400"));
ok("lançou pelo bot e estourou: a resposta diz quanto passou e completa com o alerta, sem repetir", enviados.length === 1 && /Registrada: <b>Notebook<\/b>/.test(ult()) && /Você passou <b>R\$ 1\.566,67<\/b> do limite da semana\. Tudo bem: as próximas semanas se ajustam sozinhas/.test(ult()) && (ult().match(/1\.566,67/g) || []).length === 1, ult());
// semana exatamente no limite
db.avisos_enviados = []; db.gastos = db.gastos.filter((g) => g.user_id !== "u1");
gem = { ...vazio, acao: "lancar", gastos: [{ valor: 833.33, data: HOJE, descricao: "Mercado do mês", categoria: "comida", fonte: "conta" }] };
await manda(txt("mercado 833,33"));
ok("chegou exatamente ao limite: sem 'R$ 0,00'", /Você chegou ao limite da semana \(até dom, 15\/11\)\. O que for gasto até dom \(15\/11\) sai das próximas semanas\./.test(ult()) && !/R\$ 0,00/.test(ult()), ult()); console.log("      lançar + alerta → " + JSON.stringify(ult()));

ok("histórico guardado sem marcas e limitado a 8", db.telegram[0].historico.length === 8 && !db.telegram[0].historico.some((h) => /[\ue000-\ue003]/.test(h.t)));
ok("nenhum log com o token do bot", !logs.some((l) => l.includes(TOKEN)), logs.find((l) => l.includes(TOKEN)));
console.error = errOrig;
console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo ok");
process.exit(falhas ? 1 : 0);
