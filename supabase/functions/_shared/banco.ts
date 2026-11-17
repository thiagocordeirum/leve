// Acesso ao banco com a chave de serviço (só no servidor) e formatos comuns às funções sem login
// (atalhos do iPhone e WhatsApp). Toda escrita fica presa ao user_id de quem a função identificou.
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const reais = (v) => BRL.format(Math.round((+v || 0) * 100) / 100).replace(/\s/g, " ");
export const hojeSP = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
export const NOME_CAT = { transporte: "Transporte", comida: "Comida", lazer: "Rolê", compras: "Compras", assinatura: "Assinatura", familia: "Família", saude: "Saúde", outros: "Outros" };
export const NOME_FONTE = { conta: "Conta", cartao: "Crédito", vr: "Vale-refeição", mob: "Mobilidade", caixinha: "Caixinha" };
export const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

export function chaveServico() {
  const k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (k) return k;
  try { const j = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}"); return Object.values(j)[0] ?? ""; } catch { return ""; }
}
export async function rest(caminho, init = {}) {
  const k = chaveServico();
  const headers = { apikey: k, "Content-Type": "application/json", ...(init.headers ?? {}) };
  if (k.startsWith("eyJ")) headers.Authorization = `Bearer ${k}`;
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/${caminho}`, { ...init, headers });
  if (!r.ok) throw new Error(`rest ${caminho.split("?")[0]} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}
export async function sha256(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export function base64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
// Compara segredos sem vazar, pelo tempo de resposta, quantos caracteres bateram
export function iguais(a, b) {
  a = String(a ?? ""); b = String(b ?? "");
  let dif = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) dif |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return dif === 0 && a.length > 0;
}
