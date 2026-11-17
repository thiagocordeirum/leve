// Testa a função whatsapp no Node, com banco, Gemini e Meta de mentira.
// Uso: npx esbuild supabase/functions/whatsapp/index.ts --bundle --platform=neutral --format=esm --outfile=/tmp/fn-whatsapp.mjs
//      node testes/whatsapp.mjs /tmp/fn-whatsapp.mjs
import { createHmac } from "node:crypto";
const SEG = "segredo-do-app", FONE = "5511988887777", PID = "PID1";
const envs = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "eyJ", GEMINI_API_KEY: "g", WHATSAPP_TOKEN: "tok", WHATSAPP_APP_SECRET: SEG, WHATSAPP_PHONE_ID: PID, WHATSAPP_VERIFY_TOKEN: "verif" };
globalThis.Deno = { env: { get: (k) => envs[k] }, serve: (h) => { globalThis.H = h; } };
// banco de mentira com os filtros do PostgREST usados pela função
const hojeD = new Date(), iso = (d) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const HOJE = iso(hojeD), ONTEM = iso(new Date(hojeD - 864e5));
const db = {
  perfis: [{ user_id: "u1", config: { nome: "Bruno Lima", salario: 3200, meta: 600, vr: 1000, mob: 287, inicio: "2026-01", pagto: "ultimo-util", objetivo: 20000, fixos: [{ id: "a", nome: "Net", valor: 100, onde: "cartao", inicio: "2026-01", fim: "" }], ajustes: {} } }],
  gastos: [
    { user_id: "u1", id: "g1", data: HOJE, valor: 40, cat: "comida", fonte: "conta", descricao: "Mercado", criado: new Date().toISOString() },
    { user_id: "u1", id: "g2", data: ONTEM, valor: 25.5, cat: "transporte", fonte: "conta", descricao: "Uber", criado: new Date().toISOString() },
    { user_id: "u1", id: "g3", data: HOJE, valor: 200, cat: "comida", fonte: "vr", descricao: "Restaurante", criado: new Date().toISOString() },
  ],
  caixinha: [{ user_id: "u1", valor: 5000 }, { user_id: "u1", valor: 612.4 }],
  whatsapp: [{ user_id: "u1", codigo_hash: null, codigo_expira: null, telefone: null, ligado: null, historico: [] }],
  mensagens_vistas: [],
};
const ops = { eq: (a, b) => String(a) === b, neq: (a, b) => String(a) !== b, gte: (a, b) => String(a) >= b, lte: (a, b) => String(a) <= b, lt: (a, b) => String(a) < b,
  like: (a, b) => new RegExp("^" + b.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$").test(String(a)),
  in: (a, b) => b.slice(1, -1).split(",").map((x) => x.replace(/^"|"$/g, "")).includes(String(a)) };
function banco(url, init) {
  const u = new URL(url), t = u.pathname.split("/").pop(), tab = db[t]; if (!tab) return new Response("sem tabela " + t, { status: 404 });
  const filtros = [...u.searchParams].filter(([k]) => !["select", "order", "limit", "on_conflict"].includes(k)).map(([k, v]) => { const i = v.indexOf("."); return [k, v.slice(0, i), v.slice(i + 1)]; });
  const bate = (r) => filtros.every(([k, op, v]) => { if (!ops[op]) throw new Error("op " + op); return r[k] !== null && r[k] !== undefined ? ops[op](r[k], v) : op === "neq"; });
  const m = init.method ?? "GET"; escritas.push(m + " " + t);
  if (m === "GET") { let rows = tab.filter(bate); const o = u.searchParams.get("order");
    if (o) { const [c, d] = o.split("."); rows = [...rows].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (d === "desc" ? -1 : 1)); }
    return Response.json(rows.slice(0, +(u.searchParams.get("limit") ?? 1e9))); }
  if (m === "POST") { const novos = []; for (const r of JSON.parse(init.body)) { if (t === "mensagens_vistas" && tab.some((x) => x.id === r.id)) continue; const l = { criado: new Date().toISOString(), ...r }; tab.push(l); novos.push(l); }
    return /representation/.test(init.headers?.Prefer ?? "") ? Response.json(novos, { status: 201 }) : new Response(null, { status: 201 }); }
  if (m === "PATCH") { tab.filter(bate).forEach((r) => Object.assign(r, JSON.parse(init.body))); return new Response(null, { status: 204 }); }
  if (m === "DELETE") { db[t] = tab.filter((r) => !bate(r)); return new Response(null, { status: 204 }); }
}
let gem, enviados = [], escritas = [], pedidosIA = [], metaCalls = [];
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.includes("/rest/v1/")) return banco(url, init);
  if (url.includes("generativelanguage")) { const b = JSON.parse(init.body); pedidosIA.push(b); return Response.json({ output_text: JSON.stringify(typeof gem === "function" ? gem(b) : gem) }); }
  if (url.includes("graph.facebook.com")) {
    if (init.headers?.Authorization !== "Bearer tok") return new Response("sem token", { status: 401 });
    if (url.endsWith("/messages")) { const b = JSON.parse(init.body); metaCalls.push(b); if (b.type === "text") enviados.push(b.text.body); return Response.json({}); }
    return Response.json({ url: "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=1", mime_type: url.includes("AUD") ? "audio/ogg; codecs=opus" : "image/jpeg", file_size: url.includes("GRANDE") ? 9e6 : 1234 });
  }
  if (url.includes("lookaside.fbsbx.com")) return new Response(new Uint8Array([1, 2, 3, 4, 5]));
  throw new Error("fetch inesperado " + url);
};
await import(process.argv[2]);
let seq = 0;
const assina = (corpo) => "sha256=" + createHmac("sha256", SEG).update(corpo).digest("hex");
async function manda(m, { de = FONE, pid = PID, id = "wamid." + ++seq, assinatura } = {}) {
  enviados = []; pedidosIA = []; escritas = []; metaCalls = [];
  const corpo = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: pid }, messages: [{ from: de, id, timestamp: String(Math.floor(Date.now() / 1000)), ...m }] } }] }] });
  const r = await H(new Request("https://f/whatsapp", { method: "POST", body: corpo, headers: { "x-hub-signature-256": assinatura ?? assina(corpo) } }));
  return r.status;
}
const txt = (body) => ({ type: "text", text: { body } });
let falhas = 0;
const ok = (nome, cond, extra = "") => { if (!cond) falhas++; console.log((cond ? "ok   " : "FALHA") + " " + nome + (cond ? "" : "\n      " + extra)); };
const mostra = (rot) => console.log("      " + rot + " → " + JSON.stringify(enviados.join(" ⏎ ")));

// verificação do endereço
let r = await H(new Request("https://f/whatsapp?hub.mode=subscribe&hub.verify_token=verif&hub.challenge=12345"));
ok("GET com o token certo devolve o desafio", r.status === 200 && (await r.text()) === "12345");
r = await H(new Request("https://f/whatsapp?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=1")); ok("GET com token errado: 403", r.status === 403);
ok("POST com assinatura errada: 401 e nada acontece", (await manda(txt("oi"), { assinatura: "sha256=" + "0".repeat(64) })) === 401 && !escritas.length);
ok("POST sem assinatura: 401", (await manda(txt("oi"), { assinatura: "" })) === 401);

// número não conectado
await manda(txt("almoço 32")); ok("número não conectado: sem resposta e sem IA", !enviados.length && !pedidosIA.length);
// conectar
const cod = "0123456789abcdef0123456789abcdef", sha = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((x) => x.toString(16).padStart(2, "0")).join("");
db.whatsapp[0].codigo_hash = await sha(cod); db.whatsapp[0].codigo_expira = new Date(Date.now() - 1000).toISOString();
await manda(txt("Conectar meu Leve: " + cod)); ok("código vencido: avisa e não conecta", /não vale mais/.test(enviados[0]) && !db.whatsapp[0].telefone);
db.whatsapp[0].codigo_expira = new Date(Date.now() + 9e5).toISOString();
await manda(txt("Conectar meu Leve: " + cod)); ok("código certo: conecta, apaga o código e dá boas-vindas", db.whatsapp[0].telefone === FONE && db.whatsapp[0].codigo_hash === null && /^Pronto, Bruno\./.test(enviados[0]), enviados[0]); mostra("boas-vindas");
await manda(txt("Conectar meu Leve: " + cod)); ok("o mesmo código não vale de novo", /não vale mais/.test(enviados[0]));

// lançar por texto
const vazio = { transcricao: "", gastos: [], alvos: [], consulta: { de: "", ate: "", categoria: "todas", fonte: "todas", texto: "" }, resposta: "" };
gem = { ...vazio, acao: "lancar", gastos: [{ valor: 32, data: HOJE, descricao: "Almoço", categoria: "comida", fonte: "vr" }, { valor: 18, data: ONTEM, descricao: "Uber", categoria: "transporte", fonte: "conta" }] };
await manda(txt("almoço 32 no VR e uber 18 ontem"), { id: "wamid.REPETE" });
const wa = () => db.gastos.filter((g) => g.id.startsWith("wa-"));
ok("texto com 2 gastos: lança os dois com id wa-", wa().length === 2 && wa()[0].user_id === "u1" && wa()[0].cat === "comida", JSON.stringify(wa())); mostra("lançar");
ok("resposta traz o que sobrou da semana e do VR", /nesta semana/.test(enviados[0]) && /Restam R\$ 768,00 no vale-refeição/.test(enviados[0]), enviados[0]);
ok("texto começa pelo modelo de mais cota (flash-lite) e marca como lida", pedidosIA[0].model === "gemini-3.5-flash-lite" && metaCalls[0].status === "read");
ok("o pedido leva os fatos calculados e a mensagem", /FATOS/.test(pedidosIA[0].input[0].text) && /Ainda pode gastar nesta semana: R\$/.test(pedidosIA[0].input[0].text) && /almoço 32 no VR/.test(pedidosIA[0].input[0].text));
await manda(txt("almoço 32 no VR e uber 18 ontem"), { id: "wamid.REPETE" }); ok("entrega repetida da Meta: ignorada", !enviados.length && wa().length === 2);
ok("histórico guardado (pergunta e resposta)", db.whatsapp[0].historico.length === 2 && db.whatsapp[0].historico[0].q === "u");

// áudio
gem = { ...vazio, acao: "lancar", transcricao: "padaria doze reais", gastos: [{ valor: 12, data: HOJE, descricao: "Padaria", categoria: "comida", fonte: "conta" }] };
await manda({ type: "audio", audio: { id: "AUD1", mime_type: "audio/ogg; codecs=opus", voice: true } });
ok("áudio: vai para a IA como áudio (audio/ogg), no modelo principal", pedidosIA[0].input[1]?.type === "audio" && pedidosIA[0].input[1].mime_type === "audio/ogg" && pedidosIA[0].input[1].data === "AQIDBAU=" && pedidosIA[0].model === "gemini-3.8-flash", JSON.stringify(pedidosIA[0].input[1]));
ok("áudio: mostra o que ouviu e lança", /^_Ouvi: "padaria doze reais"_\nRegistrada: \*Padaria\* R\$ 12,00/.test(enviados[0]) && wa().length === 3, enviados[0]); mostra("áudio");
await manda({ type: "audio", audio: { id: "AUDGRANDE" } }); ok("áudio longo: pede um menor, sem IA", /longo demais/.test(enviados[0]) && !pedidosIA.length);

// situação: números conferidos
gem = (b) => { const m = /Ainda pode gastar nesta semana: (R\$ [\d.,]+)/.exec(b.input[0].text); return { ...vazio, acao: "situacao", resposta: `Você ainda pode gastar ${m[1]} nesta semana.` }; };
await manda(txt("quanto ainda posso gastar?")); ok("situação com número dos fatos: passa a resposta da IA", /^Você ainda pode gastar R\$ [\d.,]+ nesta semana\.$/.test(enviados[0]), enviados[0]); mostra("situação");
gem = { ...vazio, acao: "situacao", resposta: "Você ainda pode gastar R$ 9.999,99 nesta semana." };
await manda(txt("e agora?")); ok("situação com número inventado: troca pelo resumo do código", !/9\.999/.test(enviados[0]) && /\*Semana\*/.test(enviados[0]) && /\*Caixinha\*: cerca de R\$ 5\.612,40/.test(enviados[0]), enviados[0]); mostra("resumo do código");

// consultar
gem = { ...vazio, acao: "consultar", consulta: { de: ONTEM, ate: HOJE, categoria: "comida", fonte: "todas", texto: "" } };
await manda(txt("quanto gastei com comida de ontem pra hoje?"));
ok("consulta: soma por código, separa o que é fora do limite", /em Comida: \*R\$ 52,00\* em 2 saídas \(o que conta no limite\)/.test(enviados[0]) && /Fora do limite \(vale-refeição, mobilidade, caixinha\): R\$ 232,00 em 2 saídas/.test(enviados[0]), enviados[0]); mostra("consulta");
gem = { ...vazio, acao: "consultar", consulta: { de: "2026-01-01", ate: HOJE, categoria: "todas", fonte: "todas", texto: "Uber" } };
await manda(txt("quanto gastei de uber?")); ok("consulta por lugar", /com "uber": \*R\$ 43,50\* em 2 saídas/.test(enviados[0]), enviados[0]);

// corrigir e apagar (só o que foi lançado por aqui)
gem = { ...vazio, acao: "corrigir", alvos: [1], gastos: [{ valor: 15, data: HOJE, descricao: "Padaria", categoria: "comida", fonte: "conta" }] };
await manda(txt("na verdade foi 15")); ok("corrigir o último", /Corrigi:\n• \*Padaria\* R\$ 15,00 · Comida · Conta \(era R\$ 12,00\)/.test(enviados[0]) && db.gastos.find((g) => g.descricao === "Padaria").valor === 15, enviados[0]); mostra("corrigir");
gem = { ...vazio, acao: "apagar", alvos: [1] };
await manda(txt("apaga o último")); ok("apagar o último", /^Apaguei: \*Padaria\*/.test(enviados[0]) && wa().length === 2 && db.gastos.some((g) => g.id === "g1"), enviados[0]); mostra("apagar");
gem = { ...vazio, acao: "apagar", alvos: [7, 99] };
await manda(txt("apaga aquele")); ok("apagar sem alvo válido: lista os recentes e não apaga nada", /Me diga qual/.test(enviados[0]) && wa().length === 2 && db.gastos.length === 5, enviados[0]);

// foto
gem = { gastos: [{ valor: 58.9, data: HOJE, hora: "12:30", descricao: "iFood", categoria: "comida", fonte: "cartao" }, { valor: 40, data: HOJE, hora: "", descricao: "Mercado", categoria: "comida", fonte: "conta" }], resgates: [] };
await manda({ type: "image", image: { id: "IMG1", mime_type: "image/jpeg", caption: "no crédito" } });
ok("foto: lança o novo, pula o que já existe e usa a legenda como pista", /Registrada: iFood R\$ 58,90/.test(enviados[0]) && /Pulei 1 saída/.test(enviados[0]) && /nesta semana/.test(enviados[0]) && /no crédito/.test(pedidosIA[0].input[0].text) && pedidosIA[0].input[1].type === "image", enviados[0]); mostra("foto");
await manda({ type: "sticker", sticker: { id: "S1" } }); ok("figurinha: explica o que entende, sem IA", /texto, áudio, foto e PDF/.test(enviados[0]) && !pedidosIA.length);
await manda({ type: "reaction", reaction: { emoji: "👍" } }); ok("reação: ignora", !enviados.length);
await manda(txt("oi"), { pid: "OUTRO" }); ok("mensagem de outro número da Meta: ignorada", !enviados.length && !escritas.length);
gem = { ...vazio, acao: "conversa", resposta: "Oi, Bruno. Posso lançar um gasto ou dizer quanto ainda dá para gastar." };
await manda(txt("oi")); ok("conversa", /^Oi, Bruno/.test(enviados[0])); 
ok("histórico limitado a 8", db.whatsapp[0].historico.length === 8);
ok("nenhuma escrita em outro usuário", db.gastos.every((g) => g.user_id === "u1"));
console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo ok");
process.exit(falhas ? 1 : 0);
