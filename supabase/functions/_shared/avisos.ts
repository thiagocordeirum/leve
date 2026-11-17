// Avisos do bot do Telegram: resumo da noite, semana nova, dia do salário (começo do mês do plano) e alerta de
// limite. Os números vêm de _shared/orcamento.ts (as regras do app). Cada aviso sai uma vez só: a tabela
// avisos_enviados guarda a chave (ex.: "noite:2026-11-13") e a primeira inserção ganha.
// Quem dispara: o pg_cron do banco chama a função telegram a cada hora ({acao:"avisos"}); o alerta também sai
// logo depois de um gasto lançado pelo bot, pelo atalho ou pelo app.
import { reais, rest } from "./banco.ts";
import { addDays, addMonths, ymd } from "./orcamento.ts";
import { orcamento } from "./orcamento.ts";
import { carregar, neg, dm, DIAS, DIA3, nomeMes } from "./conversa.ts";
import { enviar, temTelegram } from "./tgapi.ts";

export const TIPOS = [
  { k: "noite", nome: "Resumo da noite", quando: "todo dia às 21h" },
  { k: "semana", nome: "Semana nova", quando: "no primeiro dia da semana, às 8h" },
  { k: "mes", nome: "Dia do salário", quando: "no começo do mês do plano, às 9h" },
  { k: "alerta", nome: "Alerta de limite", quando: "quando a semana passa de 80% ou do limite" },
];
export const ligado = (prefs, k) => !(prefs && typeof prefs === "object" && prefs[k] === false);
const HORA = { noite: 21, semana: 8, mes: 9 };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Dia e hora em São Paulo
export function agoraSP(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { hoje: `${p.year}-${p.month}-${p.day}`, hora: +p.hour % 24 };
}

async function marcar(uid, chave) {
  const r = await rest("avisos_enviados?on_conflict=user_id,chave", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify([{ user_id: uid, chave }]) });
  return !!r?.length;
}
const desmarcar = (uid, chave) => rest(`avisos_enviados?user_id=eq.${uid}&chave=eq.${encodeURIComponent(chave)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => null);

// Situação de hoje, como o Início do app mostra. null se o plano não está preenchido ou ainda não começou.
export function estado({ config, gastos }, hoje) {
  const o = orcamento(config, gastos, hoje), c = o.c, hj = o.hj;
  if (!(c.salario > 0)) return null;
  const m = o.mesDoDia(hj);
  if (c.inicio && m < c.inicio) return null;
  const p = o.plano(m), bl = o.blocoDe(hj), lim = o.limBloco(p, bl), gasto = o.gastoEntre(bl.ini, bl.fim), per = o.periodo(m), gastoMes = o.gastoMes(m);
  return { o, c, hj, hoje, m, p, bl, lim, gasto, resta: lim - gasto, per, gastoMes, restoMes: p.livre - gastoMes, prox: addDays(per.fim, 1), gastos };
}
const beneficios = (e) => [
  e.c.vr > 0 && `Vale-refeição: restam ${reais(e.c.vr - e.o.benMes(e.o.mesBen, "vr"))}.`,
  e.c.mob > 0 && `Mobilidade: restam ${reais(e.c.mob - e.o.benMes(e.o.mesBen, "mob"))}.`,
].filter(Boolean).join(" ");

export function textoNoite(e) {
  const doDia = e.gastos.filter((g) => g.data === e.hoje), dentro = doDia.filter(e.o.conta), fora = doDia.filter((g) => !e.o.conta(g));
  const soma = (a) => a.reduce((s, g) => s + (+g.valor || 0), 0);
  const t = [`${neg("Resumo de hoje")}: ${dentro.length ? `você gastou ${neg(reais(soma(dentro)))} em ${dentro.length} saída${dentro.length > 1 ? "s" : ""}` : "nenhuma saída que conte no limite"}${fora.length ? `, mais ${reais(soma(fora))} no vale-refeição, na mobilidade ou na caixinha` : ""}.`];
  if (e.restoMes < 0) t.push(`O livre de ${nomeMes(e.m)} já passou em ${reais(-e.restoMes)}. O ideal é segurar até ${dm(e.prox)} (${DIAS[e.prox.getDay()]}).`);
  else if (Math.abs(e.resta) < 0.005) t.push(`O limite da semana já foi todo usado. O que for gasto até ${DIA3[e.bl.fim.getDay()]} (${dm(e.bl.fim)}) sai das próximas semanas.`);
  else if (e.resta > 0) {
    const faltam = Math.round((e.bl.fim - e.hj) / 864e5);
    t.push(faltam > 0
      ? `Ainda dá para gastar ${neg(reais(e.resta))} nesta semana, até ${DIA3[e.bl.fim.getDay()]} (${dm(e.bl.fim)}): ${reais(e.resta / faltam)} por dia.`
      : `A semana fecha hoje com ${reais(e.resta)} de sobra. Amanhã começa outra.`);
  } else t.push(`A semana passou ${reais(-e.resta)} do limite de ${reais(e.lim)}. As próximas se ajustam sozinhas.`);
  return t.join("\n");
}

export function textoSemana(e) {
  const t = [];
  if (e.restoMes < 0) t.push(`${neg("Semana nova")}, de ${dm(e.bl.ini)} a ${dm(e.bl.fim)}. O livre de ${nomeMes(e.m)} já acabou (passou ${reais(-e.restoMes)}): o ideal é segurar até ${dm(e.prox)}.`);
  else t.push(`${neg("Semana nova")}, de ${dm(e.bl.ini)} a ${dm(e.bl.fim)}: você pode gastar ${neg(reais(e.lim))}.`);
  const ant = e.o.blocoDe(addDays(e.bl.ini, -1));
  if (ant?.ini) {
    const pa = e.o.plano(ant.m), la = e.o.limBloco(pa, ant), ga = e.o.gastoEntre(ant.ini, ant.fim);
    if (la > 0 || ga > 0) t.push(`Semana passada: ${reais(ga)} de ${reais(la)}${ga <= la + 0.005 ? (la - ga >= 0.01 ? `. Sobraram ${reais(la - ga)}${ant.m === e.m ? ", que já entraram nas próximas semanas" : ""}.` : ".") : `. Passou ${reais(ga - la)}.`}`);
  }
  const b = beneficios(e);
  if (b) t.push(b);
  return t.join("\n");
}

export function textoMes(e) {
  const t = [e.o.usaPagto ? `${neg("Dia do salário")}. Hoje começa ${nomeMes(e.m)} no Leve.` : `${neg("Mês novo")} no Leve: ${nomeMes(e.m)}.`];
  const fazer = [
    e.p.cartao > 0 && `• Fatura do cartão: ${neg(reais(e.p.cartao))}${e.p.ajustado ? "" : " (pela soma dos fixos; se a fatura veio diferente, ajuste no app)"}`,
    e.c.meta > 0 && `• Guardar na caixinha: ${neg(reais(e.c.meta))}`,
    e.p.debito > 0 && `• Débitos fixos do mês: ${reais(e.p.debito)}`,
  ].filter(Boolean);
  if (fazer.length) t.push(fazer.join("\n"));
  t.push(`Livre de ${nomeMes(e.m)}: ${reais(e.p.livre)}. Primeira semana: ${reais(e.lim)}, até ${dm(e.bl.fim)}.`);
  const ma = addMonths(e.m, -1);
  if (!e.c.inicio || ma >= e.c.inicio) {
    const la = e.o.plano(ma).livre, ga = e.o.gastoMes(ma);
    t.push(`${cap(nomeMes(ma))} fechou com ${reais(ga)} de ${reais(la)} livres${ga <= la + 0.005 ? `: sobraram ${reais(la - ga)}.` : `: passou ${reais(ga - la)}.`}`);
  }
  return t.join("\n\n");
}

// Alerta de limite: 80% e 100% da semana (uma vez cada por semana) e o livre do mês esgotado (uma vez por mês).
// Já marca como enviado. Devolve null ou { texto, curto }: "texto" é a mensagem sozinha; "curto" completa a
// resposta do bot depois de um lançamento, que já diz quanto sobrou.
export async function alertaTexto(uid, e) {
  if (!e) return null;
  if (e.restoMes < -0.005) {
    if (!(await marcar(uid, `amês:${e.m}`))) return null;
    const ate = `O ideal é segurar até ${dm(e.prox)} (${DIAS[e.prox.getDay()]}), quando começa o mês seguinte.`;
    return { texto: `O livre de ${nomeMes(e.m)} acabou: as saídas passaram ${neg(reais(-e.restoMes))}. ${ate}`, curto: ate };
  }
  if (!(e.lim > 0)) return null;
  const k = ymd(e.bl.ini), ate = `${DIA3[e.bl.fim.getDay()]} (${dm(e.bl.fim)})`;
  if (e.gasto >= e.lim - 0.005) {
    if (!(await marcar(uid, `a100:${k}`))) return null;
    await marcar(uid, `a80:${k}`);
    const ajusta = "Tudo bem: as próximas semanas se ajustam sozinhas e o limite delas fica um pouco menor.";
    if (e.gasto > e.lim + 0.005) return { texto: `Esta semana passou ${neg(reais(e.gasto - e.lim))} do limite de ${reais(e.lim)}. ${ajusta}`, curto: ajusta };
    return { texto: `Você chegou ao limite da semana (${reais(e.lim)}). O que for gasto até ${ate} sai das próximas semanas.`, curto: `O que for gasto até ${ate} sai das próximas semanas.` };
  }
  if (e.gasto >= 0.8 * e.lim - 0.005) {
    if (!(await marcar(uid, `a80:${k}`))) return null;
    return { texto: `O limite da semana está perto: restam ${neg(reais(e.lim - e.gasto))} de ${reais(e.lim)} até ${ate}. Que tal priorizar o essencial?`, curto: "O limite da semana está perto. Que tal priorizar o essencial?" };
  }
  return null;
}

// Depois de um gasto lançado fora do bot (app ou atalho): manda o alerta pelo Telegram, se for o caso.
export async function alertarSePreciso(uid, agora = new Date()) {
  if (!temTelegram()) return false;
  const l = (await rest(`telegram?user_id=eq.${uid}&chat_id=not.is.null&select=chat_id,avisos`))?.[0];
  if (!l?.chat_id || !ligado(l.avisos, "alerta")) return false;
  const { hoje } = agoraSP(agora);
  const a = await alertaTexto(uid, estado(await carregar(uid, hoje), hoje));
  return a ? enviar(l.chat_id, a.texto) : false;
}

// Rodada de hora em hora (pg_cron): manda o que estiver na hora e ainda não foi mandado.
export async function rodarAvisos(agora = new Date()) {
  if (!temTelegram()) return { pessoas: 0, enviados: 0 };
  const { hoje, hora } = agoraSP(agora);
  const linhas = (await rest("telegram?chat_id=not.is.null&select=user_id,chat_id,avisos")) ?? [];
  let enviados = 0;
  for (const l of linhas) {
    try {
      const e = estado(await carregar(l.user_id, hoje), hoje);
      if (!e) continue;
      const fila = [];
      if (ligado(l.avisos, "alerta")) { const a = await alertaTexto(l.user_id, e); if (a) fila.push([null, a.texto]); }
      const inicioMes = ymd(e.per.ini) === hoje;
      if (ligado(l.avisos, "mes") && hora >= HORA.mes && inicioMes) fila.push([`mes:${e.m}`, () => textoMes(e)]);
      // semana nova: no primeiro dia da semana (pela configuração da pessoa); no dia do salário, o aviso do mês já traz a semana
      if (ligado(l.avisos, "semana") && hora >= HORA.semana && !inicioMes && ymd(e.o.inicioSemana(e.hj)) === hoje && ymd(e.bl.ini) === hoje) fila.push([`semana:${hoje}`, () => textoSemana(e)]);
      if (ligado(l.avisos, "noite") && hora >= HORA.noite) fila.push([`noite:${hoje}`, () => textoNoite(e)]);
      for (const [chave, txt] of fila) {
        if (chave && !(await marcar(l.user_id, chave))) continue;
        const ok = await enviar(l.chat_id, typeof txt === "function" ? txt() : txt);
        if (ok) enviados++; else if (chave) await desmarcar(l.user_id, chave);
      }
    } catch (err) { console.error("avisos:", l.user_id, err?.message ?? err); }
  }
  // limpeza das marcas antigas
  if (Math.random() < 0.05) await rest(`avisos_enviados?criado=lt.${encodeURIComponent(new Date(Date.now() - 70 * 864e5).toISOString())}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => null);
  return { pessoas: linhas.length, enviados };
}

// Painel /avisos: texto e botões para ligar e desligar cada aviso
export function painel(prefs) {
  return {
    texto: `${neg("Seus avisos")}\nToque para ligar ou desligar. Eles valem só para você.\n\n` + TIPOS.map((t) => `${ligado(prefs, t.k) ? "Ligado" : "Desligado"}: ${t.nome}, ${t.quando}.`).join("\n"),
    teclado: { inline_keyboard: TIPOS.map((t) => [{ text: `${t.nome}: ${ligado(prefs, t.k) ? "ligado" : "desligado"}`, callback_data: `av:${t.k}` }]) },
  };
}
