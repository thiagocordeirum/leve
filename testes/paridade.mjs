// Confere se supabase/functions/_shared/orcamento.ts dá os mesmos números que o app.js.
// Uso: node testes/paridade.mjs   (Node 24+, que lê .ts sem tipos direto)
import { readFileSync } from "node:fs";
import { orcamento, ymd } from "../supabase/functions/_shared/orcamento.ts";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const trecho = (de, ate) => { const i = app.indexOf(de), j = app.indexOf(ate, i); if (i < 0 || j < 0) throw new Error("app.js mudou: não achei " + de); return app.slice(i, app.indexOf("\n", j) + 1); };
const fonte = [
  trecho("const pad=", "const addMonths="),
  trecho("function weeksOfMonth(m){", "const out=[];while(ym(d)===m)") + "}\n",
  trecho("const dia0=", "function blocoDe(d){"),
  "const FORA=['vr','mob','caixinha'];\n",
  trecho("function plano(m){", "const benMes="),
  "return {plano,limBloco,blocoDe,periodo,mesDoDia,gastoEntre,gastoMes,benMes,usaPagto,ymd,ym};",
].join("");
// o app usa "new Date()" como hoje: aqui a data sem argumentos vira o dia do teste
function doApp(config, gastos, hoje) {
  const [y, m, d] = hoje.split("-").map(Number);
  class Data extends Date { constructor(...a) { if (a.length) super(...a); else super(y, m - 1, d, 12); } }
  return new Function("S", "Date", fonte)({ config, gastos }, Data);
}

let rnd = 7; const r = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
const fixos = [
  { id: "a", nome: "Internet", valor: 99.9, onde: "cartao", inicio: "2026-01", fim: "" },
  { id: "b", nome: "Academia", valor: 120, onde: "debito", inicio: "2026-08", fim: "2027-01" },
  { id: "c", nome: "Parcela", valor: 210.35, onde: "cartao", inicio: "2026-10", fim: "2026-12" },
];
const fontes = ["conta", "conta", "cartao", "vr", "mob", "caixinha"];
const gastos = [];
for (let i = 0; i < 700; i++) {
  const d = new Date(2026, 7, 1 + Math.floor(r() * 230));
  gastos.push({ data: ymd(d), valor: Math.round(r() * 9000) / 100, fonte: fontes[Math.floor(r() * fontes.length)], cat: "outros" });
}
const configs = [
  { salario: 3200, meta: 600, vr: 1000, mob: 287, inicio: "2026-08", fixos, ajustes: { "2026-11": 512.4 } },
  { salario: 3200, meta: 600, vr: 1000, mob: 287, inicio: "2026-08", fixos, ajustes: {}, pagto: "ultimo-util" },
  { salario: 2100, meta: 300, vr: 0, mob: 0, inicio: "2026-08", fixos, ajustes: {}, semana: "dom" },
  { salario: 1500, meta: 600, vr: 500, mob: 100, inicio: "2026-08", fixos, ajustes: { "2026-12": 0 }, pagto: "ultimo-util", semana: "dom" },
];
const perto = (a, b) => Math.abs(a - b) < 1e-6;
let n = 0, erros = 0;
const confere = (nome, a, b, ctx) => { n++; if (!(typeof a === "number" ? perto(a, b) : a === b)) { erros++; if (erros < 12) console.log("DIFERENTE", nome, a, b, ctx); } };
configs.forEach((config, ci) => {
  for (let k = 0; k < 250; k++) {
    const hoje = ymd(new Date(2026, 7, 20 + k));
    const A = doApp(config, gastos, hoje), B = orcamento(config, gastos, hoje), ctx = `config ${ci} hoje ${hoje}`;
    const hj = new Date(2026, 7, 20 + k), m = A.mesDoDia(hj);
    confere("mesDoDia", m, B.mesDoDia(hj), ctx);
    const pa = A.plano(m), pb = B.plano(m), ba = A.blocoDe(hj), bb = B.blocoDe(hj);
    ["cartao", "debito", "livre", "dias", "porDia"].forEach((x) => confere("plano." + x, pa[x], pb[x], ctx));
    confere("periodo.ini", ymd(A.periodo(m).ini), ymd(B.periodo(m).ini), ctx);
    confere("periodo.fim", ymd(A.periodo(m).fim), ymd(B.periodo(m).fim), ctx);
    confere("bloco.ini", ymd(ba.ini), ymd(bb.ini), ctx); confere("bloco.fim", ymd(ba.fim), ymd(bb.fim), ctx);
    confere("blocos", pa.blocos.length, pb.blocos.length, ctx);
    pa.blocos.forEach((b, i) => confere("limBloco " + i, A.limBloco(pa, b), B.limBloco(pb, pb.blocos[i]), ctx));
    confere("gastoBloco", A.gastoEntre(ba.ini, ba.fim), B.gastoEntre(bb.ini, bb.fim), ctx);
    confere("gastoMes", A.gastoMes(m), B.gastoMes(m), ctx);
    const mb = A.usaPagto() ? m : A.ym(hj);
    confere("mesBen", mb, B.mesBen, ctx);
    ["vr", "mob"].forEach((f) => confere("benMes " + f, A.benMes(mb, f), B.benMes(B.mesBen, f), ctx));
  }
});
console.log(erros ? `FALHOU: ${erros} de ${n} comparações diferentes` : `ok: ${n} comparações iguais entre o app.js e o orcamento.ts`);
process.exit(erros ? 1 : 0);
