// Regras do orçamento no servidor, para o WhatsApp responder "quanto ainda posso gastar".
// É uma CÓPIA da lógica central do app.js (períodos, blocos, plano, limBloco, benMes). Se mudar lá, mude aqui:
// o teste de paridade compara as duas (ver "Como testar" no CLAUDE.md).
// As datas são de calendário (ano, mês, dia), sem fuso: "hoje" chega como AAAA-MM-DD de São Paulo.
const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ym = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const parseD = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
export const addMonths = (m, n) => { const [y, mo] = m.split("-").map(Number); return ym(new Date(y, mo - 1 + n, 1)); };
const dia0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const diasEntre = (a, b) => Math.round((b - a) / 864e5);

function pascoa(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mo = Math.floor((h + l - 7 * m + 114) / 31), dd = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mo - 1, dd);
}
const FER = {};
function ehFeriado(d) {
  const y = d.getFullYear();
  if (!FER[y]) {
    const p = pascoa(y);
    FER[y] = new Set(["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25", "12-31"].map((x) => `${y}-${x}`)
      .concat([-48, -47, -2, 60].map((n) => ymd(addDays(p, n)))));
  }
  return FER[y].has(ymd(d));
}
const diaUtil = (d) => { const w = d.getDay(); return w !== 0 && w !== 6 && !ehFeriado(d); };
// Dia do salário: último dia útil do mês
export function pagamento(m) { const [y, mo] = m.split("-").map(Number); let d = new Date(y, mo, 0); while (!diaUtil(d)) d = addDays(d, -1); return d; }

export const FORA = ["vr", "mob", "caixinha"];

// config = perfis.config; gastos = linhas da tabela gastos ({data, valor, fonte, …}); hoje = "AAAA-MM-DD".
export function orcamento(config, gastos, hoje) {
  const c = { salario: 0, meta: 0, vr: 0, mob: 0, ...(config ?? {}) };
  c.fixos = Array.isArray(c.fixos) ? c.fixos : [];
  c.ajustes = c.ajustes && typeof c.ajustes === "object" ? c.ajustes : {};
  ["salario", "meta", "vr", "mob"].forEach((k) => { c[k] = +c[k] || 0; });
  const hj = parseD(hoje);
  const domingoIni = c.semana === "dom", usaPagto = c.pagto === "ultimo-util";
  const inicioSemana = (d) => domingoIni ? addDays(d, -d.getDay()) : mondayOf(d);
  const sabadoDa = (d) => addDays(inicioSemana(d), domingoIni ? 6 : 5);
  function weeksOfMonth(m) {
    const [y, mo] = m.split("-").map(Number); let d = new Date(y, mo - 1, 1);
    while (d.getDay() !== 6) d = addDays(d, 1);
    const out = []; while (ym(d) === m) { out.push(addDays(d, domingoIni ? -6 : -5)); d = addDays(d, 7); } return out;
  }
  function periodo(m) {
    if (usaPagto) return { ini: pagamento(addMonths(m, -1)), fim: addDays(pagamento(m), -1) };
    const w = weeksOfMonth(m); return { ini: w[0], fim: addDays(w[w.length - 1], 6) };
  }
  function mesDoDia(d) { d = dia0(d); if (!usaPagto) return ym(sabadoDa(d)); const m = ym(d); return d >= pagamento(m) ? addMonths(m, 1) : m; }
  function blocos(m) {
    const p = periodo(m), out = []; let a = p.ini;
    while (a <= p.fim) { let b = addDays(inicioSemana(a), 6); if (b > p.fim) b = p.fim; out.push({ ini: a, fim: b, dias: diasEntre(a, b) + 1 }); a = addDays(b, 1); }
    return out;
  }
  function blocoDe(d) { d = dia0(d); const m = mesDoDia(d); return Object.assign({ m }, blocos(m).find((b) => d >= b.ini && d <= b.fim)); }
  const conta = (g) => !FORA.includes(g.fonte);
  const gastoEntre = (a, b) => { const ka = ymd(a), kb = ymd(b); return gastos.filter((g) => conta(g) && g.data >= ka && g.data <= kb).reduce((s, g) => s + (+g.valor || 0), 0); };
  const gastoMes = (m) => { const p = periodo(m); return gastoEntre(p.ini, p.fim); };
  function plano(m) {
    const at = c.fixos.filter((f) => f.inicio && f.inicio <= m && (!f.fim || f.fim >= m));
    const sum = (a) => a.reduce((s, f) => s + (+f.valor || 0), 0);
    const aj = c.ajustes[m], ajustado = aj !== undefined && aj !== null && aj !== "";
    const cartao = ajustado ? +aj : sum(at.filter((f) => f.onde !== "debito"));
    const debito = sum(at.filter((f) => f.onde === "debito"));
    const livre = c.salario - c.meta - cartao - debito, bl = blocos(m), dias = bl.reduce((s, b) => s + b.dias, 0), porDia = dias ? livre / dias : 0;
    return { m, cartao, debito, livre, blocos: bl, dias, porDia, porSemana: porDia * 7, ajustado, fixos: at };
  }
  // Limite que se reajusta: (livre − gasto do período antes do bloco) ÷ dias que faltam × dias do bloco.
  function limBloco(p, b) {
    const pr = periodo(p.m);
    if (hj >= pr.ini && hj <= pr.fim && b.ini > hj) {
      const cur = blocoDe(hj);
      if (b.ini > cur.fim) {
        const resto = p.livre - gastoEntre(pr.ini, addDays(cur.ini, -1)) - Math.max(limBloco(p, cur), gastoEntre(cur.ini, cur.fim)), dr = diasEntre(cur.fim, pr.fim);
        return resto > 0 && dr > 0 ? resto * b.dias / dr : 0;
      }
    }
    const resto = p.livre - gastoEntre(pr.ini, addDays(b.ini, -1)), dr = diasEntre(b.ini, pr.fim) + 1;
    return resto > 0 && dr > 0 ? resto * b.dias / dr : 0;
  }
  // VR e mobilidade: com o salário no último dia útil renovam junto com ele; senão, no dia 1
  const benMes = (m, f) => gastos.filter((g) => g.fonte === f && (usaPagto ? mesDoDia(parseD(g.data)) : String(g.data).slice(0, 7)) === m).reduce((s, g) => s + (+g.valor || 0), 0);
  const mesBen = usaPagto ? mesDoDia(hj) : ym(hj);
  return { c, hj, usaPagto, inicioSemana, periodo, mesDoDia, blocos, blocoDe, plano, limBloco, gastoEntre, gastoMes, benMes, mesBen, conta };
}
