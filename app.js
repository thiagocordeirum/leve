(function(){
"use strict";
/* ---------- helpers ---------- */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const ym=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
const parseD=s=>{const[y,m,d]=String(s).split('-').map(Number);return new Date(y,(m||1)-1,d||1)};
const addDays=(d,n)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+n);return x};
const mondayOf=d=>addDays(d,-((d.getDay()+6)%7));
const monthOfWeek=mon=>ym(addDays(mon,5));
const domingoIni=()=>!!(S&&S.config&&S.config.semana==='dom');
const inicioSemana=d=>domingoIni()?addDays(d,-d.getDay()):mondayOf(d);
const sabadoDa=d=>addDays(inicioSemana(d),domingoIni()?6:5);
const addMonths=(m,n)=>{const[y,mo]=m.split('-').map(Number);return ym(new Date(y,mo-1+n,1))};
const BRL=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const money=v=>BRL.format(Math.round((+v||0)*100)/100).replace(/ /g,' ');
const mesLongo=m=>new Date(+m.slice(0,4),+m.slice(5,7)-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).replace(' de ',' ');
// Mês em texto: "novembro" no ano corrente e "nov. 2027" nos outros. ("nov/26" parecia o dia 26 de novembro.)
const mesCurto=m=>{const d=new Date(+m.slice(0,4),+m.slice(5,7)-1,1);return d.getFullYear()===new Date().getFullYear()?d.toLocaleDateString('pt-BR',{month:'long'}):d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','')+'. '+d.getFullYear()};
// Três letras, para rótulos estreitos de gráfico ("nov")
const mes3=m=>new Date(+m.slice(0,4),+m.slice(5,7)-1,1).toLocaleDateString('pt-BR',{month:'short'}).replace('.','');
const diaCurto=d=>d.toLocaleDateString('pt-BR',{day:'numeric',month:'short'}).replace('.','').replace(' de ','/');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);

function weeksOfMonth(m){
  const[y,mo]=m.split('-').map(Number);let d=new Date(y,mo-1,1);
  while(d.getDay()!==6)d=addDays(d,1);
  const out=[];while(ym(d)===m){out.push(addDays(d,domingoIni()?-6:-5));d=addDays(d,7)}return out;
}

/* ---------- períodos do plano ----------
   Padrão: o mês do plano são as semanas (seg–dom) cujo sábado cai no mês.
   config.pagto === 'ultimo-util': o mês m vai do último dia útil de m−1 (dia do salário) até a véspera do último dia
   útil de m. Os blocos são as semanas seg–dom cortadas nas pontas do período; o limite de cada bloco é proporcional
   aos dias (livre ÷ dias do período × dias do bloco). Sem pagto, todo bloco tem 7 dias e o resultado é o de antes. */
const dia0=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
function pascoa(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),dd=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,dd)}
const FER={};
function ehFeriado(d){const y=d.getFullYear();if(!FER[y]){const p=pascoa(y);
  FER[y]=new Set(['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25','12-31'].map(x=>`${y}-${x}`).concat([-48,-47,-2,60].map(n=>ymd(addDays(p,n)))))}
  return FER[y].has(ymd(d))}
const diaUtil=d=>{const w=d.getDay();return w!==0&&w!==6&&!ehFeriado(d)};
function pagamento(m){const[y,mo]=m.split('-').map(Number);let d=new Date(y,mo,0);while(!diaUtil(d))d=addDays(d,-1);return d}
const usaPagto=()=>!!(S.config&&S.config.pagto==='ultimo-util');
function periodo(m){if(usaPagto())return{ini:pagamento(addMonths(m,-1)),fim:addDays(pagamento(m),-1)};
  const w=weeksOfMonth(m);return{ini:w[0],fim:addDays(w[w.length-1],6)}}
function mesDoDia(d){d=dia0(d);if(!usaPagto())return ym(sabadoDa(d));const m=ym(d);return d>=pagamento(m)?addMonths(m,1):m}
function blocos(m){const p=periodo(m),out=[];let a=p.ini;
  while(a<=p.fim){let b=addDays(inicioSemana(a),6);if(b>p.fim)b=p.fim;out.push({ini:a,fim:b,dias:Math.round((b-a)/864e5)+1});a=addDays(b,1)}return out}
function blocoDe(d){d=dia0(d);const m=mesDoDia(d);return Object.assign({m},blocos(m).find(b=>d>=b.ini&&d<=b.fim))}
const NOME_DIA=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];

const ICON={
  transporte:'<path d="M4 13l2-5h12l2 5v4H4z"/><circle cx="8" cy="17" r="1.6"/><circle cx="16" cy="17" r="1.6"/>',
  comida:'<path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-2.2 2-2.2 7 0 9v9"/>',
  lazer:'<path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/>',
  compras:'<path d="M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0"/>',
  assinatura:'<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4"/>',
  familia:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  saude:'<path d="M12 5v14M5 12h14"/>',
  outros:'<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>'
};
const CATS=[
  {k:'transporte',n:'Transporte',bg:'var(--cat-transporte)'},
  {k:'comida',n:'Comida',bg:'var(--cat-comida)'},
  {k:'lazer',n:'Rolê',bg:'var(--cat-lazer)'},
  {k:'compras',n:'Compras',bg:'var(--cat-compras)'},
  {k:'assinatura',n:'Assinatura',bg:'var(--cat-assinatura)'},
  {k:'familia',n:'Família',bg:'var(--cat-familia)'},
  {k:'saude',n:'Saúde',bg:'var(--cat-saude)'},
  {k:'outros',n:'Outros',bg:'var(--cat-outros)'}
];
const catOf=k=>CATS.find(c=>c.k===k)||CATS[CATS.length-1];
const svg=(p,sw=2)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const FONTE={conta:'Conta',cartao:'Crédito',vr:'Vale-refeição',mob:'Mobilidade',caixinha:'Caixinha'};
const BEN=['vr','mob'],FORA=['vr','mob','caixinha'];

/* ---------- store (Supabase) ---------- */
const S={config:null,gastos:[],caixa:[],uid:null,email:'',q:Promise.resolve(),loaded:false};
let sb=null;
const CAT_KEYS=['transporte','comida','lazer','compras','assinatura','familia','saude','outros'];
const FONTES=['conta','cartao','vr','mob','caixinha'],TIPOS=['deposito','resgate','ajuste'];
const isDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));
const isMonth=s=>/^\d{4}-\d{2}$/.test(String(s||''));
const round2=v=>Math.round((+v||0)*100)/100;
function errMsg(e){const m=String(e&&(e.message||e.error_description||e)||'');
  if(/jwt|session|token|auth/i.test(m))return 'Sua sessão expirou. Entre de novo.';
  if(/network|fetch|failed/i.test(m))return 'Sem conexão. O lançamento não foi salvo.';
  return 'Não deu para salvar. Tente de novo.'}
function queue(fn){S.q=S.q.then(async()=>{const r=await fn();if(r&&r.error)throw r.error;return r}).catch(e=>{console.error(e);toast(errMsg(e));reload()});return S.q}
const toRowG=(id,g)=>({user_id:S.uid,id:String(id).slice(0,160),data:g.data,valor:round2(g.valor),cat:CAT_KEYS.includes(g.cat)?g.cat:'outros',fonte:FONTES.includes(g.fonte)?g.fonte:'conta',descricao:String(g.desc||'').slice(0,200),criado:new Date(g.criado||Date.now()).toISOString()});
const fromRowG=r=>({id:r.id,data:r.data,valor:+r.valor,cat:r.cat,fonte:r.fonte,desc:r.descricao||'',criado:Date.parse(r.criado)||0});
const toRowM=(id,m)=>({user_id:S.uid,id:String(id).slice(0,160),data:m.data,valor:round2(m.valor),tipo:TIPOS.includes(m.tipo)?m.tipo:'ajuste',mes:isMonth(m.mes)?m.mes:null,nota:String(m.nota||'').slice(0,200),criado:new Date(m.criado||Date.now()).toISOString()});
const fromRowM=r=>({id:r.id,data:r.data,valor:+r.valor,tipo:r.tipo,mes:r.mes||'',nota:r.nota||'',criado:Date.parse(r.criado)||0});

async function selectAll(table){
  const out=[];for(let from=0;;from+=1000){
    const {data,error}=await sb.from(table).select('*').order('data',{ascending:false}).order('id').range(from,from+999);
    if(error)throw error;out.push(...data);if(data.length<1000)break}
  return out}
async function reload(){
  if(!S.uid)return;
  try{
    const [p,g,c]=await Promise.all([sb.from('perfis').select('config').maybeSingle(),selectAll('gastos'),selectAll('caixinha')]);
    if(p.error)throw p.error;
    S.config=p.data?normalize(p.data.config):null;S.gastos=g.map(fromRowG);S.caixa=c.map(fromRowM);S.loaded=true;S.doCache=0;render();
  }catch(e){console.error(e);
    if(S.doCache){const d=new Date(S.doCache);toast(`Sem conexão. Mostrando seus dados de ${d.toDateString()===new Date().toDateString()?'hoje, ':diaCurto(d)+', '}${pad(d.getHours())}:${pad(d.getMinutes())}.`)}
    else toast('Não deu para carregar seus dados. Confira a internet.')}
}
/* ---------- abrir na hora ----------
   O último estado (plano, saídas e caixinha) fica guardado neste aparelho, por pessoa. Ao abrir, o app mostra isso
   na hora (atrás do Face ID, se ligado) e busca o atual no Supabase por trás. Sai junto com a conta. */
const CACHE_KEY='leve-dados-v1';let tCache=0;
function cacheLer(uid){try{const j=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');return j&&j.v===1&&j.uid===uid&&Array.isArray(j.gastos)?j:null}catch(e){return null}}
function cacheGravar(){clearTimeout(tCache);tCache=setTimeout(()=>{if(!S.uid||!S.loaded||!S.config)return;
  try{localStorage.setItem(CACHE_KEY,JSON.stringify({v:1,uid:S.uid,em:Date.now(),config:S.config,gastos:S.gastos,caixa:S.caixa}))}catch(e){}},600)}
function cacheApagar(){clearTimeout(tCache);try{localStorage.removeItem(CACHE_KEY)}catch(e){}}
function normalize(c){c=JSON.parse(JSON.stringify(c||{}));c.fixos=Array.isArray(c.fixos)?c.fixos:[];c.ajustes=c.ajustes&&typeof c.ajustes==='object'?c.ajustes:{};delete c.guardados;
  ['salario','meta','vr','mob','objetivo','cdi','pctCdi'].forEach(k=>{if(k in c||['salario','meta','vr','mob'].includes(k))c[k]=+c[k]||0});
  c.nome=String(c.nome||'').slice(0,40);c.inicio=isMonth(c.inicio)?c.inicio:ym(new Date());return c}
function saveConfig(cfg){S.config=normalize(cfg);render();
  const body=JSON.parse(JSON.stringify(S.config));
  return queue(()=>sb.from('perfis').upsert({user_id:S.uid,config:body,updated_at:new Date().toISOString()}))}
function addGasto(g,id){id=id||uid();g=Object.assign({criado:Date.now()},g);
  S.gastos=S.gastos.filter(x=>x.id!==id).concat([Object.assign({id},g)]);render();
  return queue(()=>sb.from('gastos').upsert(toRowG(id,g))).then(r=>{if(!FORA.includes(g.fonte))avisarTelegram();return r})}
// Alerta de limite pelo Telegram (se a pessoa conectou o bot): a função telegram confere e manda, se for o caso.
// Espera uns segundos para juntar vários lançamentos seguidos num pedido só.
let avisoT=0;
function avisarTelegram(){clearTimeout(avisoT);avisoT=setTimeout(()=>{if(!S.uid||!sb)return;
  sb.functions.invoke('telegram',{body:{acao:'alerta'}}).catch(()=>{})},4000)}
function delGasto(id){S.gastos=S.gastos.filter(x=>x.id!==id);render();
  return queue(()=>sb.from('gastos').delete().eq('id',id))}
function addMov(m,id){id=id||uid();m=Object.assign({},m,{criado:Date.now()});
  S.caixa=S.caixa.filter(x=>x.id!==id).concat([Object.assign({id},m)]);render();
  return queue(()=>sb.from('caixinha').upsert(toRowM(id,m)))}
function delMov(id){S.caixa=S.caixa.filter(x=>x.id!==id);render();
  return queue(()=>sb.from('caixinha').delete().eq('id',id))}
async function bulkUpsert(table,rows){for(let i=0;i<rows.length;i+=500){const r=await sb.from(table).upsert(rows.slice(i,i+500));if(r.error)throw r.error}}

/* ---------- login ---------- */
const gate=$('#gate');let gEmail='';
function gMsg(t,err){const m=$('#g-msg');m.textContent=t||'';m.classList.toggle('err',!!err)}
function showGate(mode){gate.hidden=false;$('#g-email').hidden=mode!=='email';$('#g-code').hidden=mode!=='code';
  if(mode==='setup'){$('#g-tag').textContent='Falta conectar o banco de dados. Preencha o arquivo config.js com a URL e a chave pública do seu projeto no Supabase.'}
  if(mode==='email')setTimeout(()=>$('#g-mail').focus(),50);if(mode==='code')setTimeout(()=>$('#g-otp').focus(),50)}
function keyIsSecret(k){k=String(k||'');if(/^sb_secret_/.test(k))return true;
  try{const p=JSON.parse(atob(k.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return p.role==='service_role'}catch(e){return false}}
$('#g-email').addEventListener('submit',async e=>{e.preventDefault();
  const email=$('#g-mail').value.trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){gMsg('Digite um e-mail válido.',true);return}
  const btn=$('#g-send');btn.disabled=true;gMsg('Enviando…');
  const {error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:false}});btn.disabled=false;
  if(error){const m=String(error.message||'');
    gMsg(/signup|not allowed|not found|otp_disabled/i.test(m)?'Esse e-mail não tem acesso ao Leve.':(error.status===429||/rate|seconds/i.test(m))?'Muitas tentativas. Espere um minuto e tente de novo.':'Não deu para enviar o código. Tente de novo.',true);return}
  gEmail=email;$('#g-sent').textContent=`Enviamos um código para ${email}. Ele vale por alguns minutos.`;gMsg('');showGate('code')});
$('#g-code').addEventListener('submit',async e=>{e.preventDefault();
  const token=$('#g-otp').value.replace(/\D/g,'');if(token.length<6){gMsg('O código tem pelo menos 6 números.',true);return}
  const btn=$('#g-verify');btn.disabled=true;gMsg('Conferindo…');
  const {error}=await sb.auth.verifyOtp({email:gEmail,token,type:'email'});btn.disabled=false;
  if(error){gMsg(error.status===429?'Muitas tentativas. Espere um minuto.':'Código errado ou vencido. Confira ou peça outro.',true);return}
  $('#g-otp').value='';gMsg('')});
$('#g-back').onclick=()=>{gMsg('');$('#g-otp').value='';showGate('email')};
function enter(session){if(S.uid===session.user.id)return;S.uid=session.user.id;S.email=session.user.email||'';
  $('#acc-email').textContent=S.email;gate.hidden=true;drawLockCard();
  const c=cacheLer(S.uid);if(c){S.config=normalize(c.config);S.gastos=c.gastos;S.caixa=Array.isArray(c.caixa)?c.caixa:[];S.loaded=true;S.doCache=c.em||Date.now();render()}
  if(lockOn()){showLock();autoUnlock()}else reload()}
function leave(){lockCfgSet(null);hideLock();cacheApagar();S.uid=null;S.config=null;S.gastos=[];S.caixa=[];S.loaded=false;S.doCache=0;mesSel=null;closeSheet();mostrarTela(0);history.replaceState({leve:1,tela:0,n:0},'');showGate('email')}
async function init(){
  history.replaceState({leve:1,tela:0,n:0},'');
  const cfg=window.SOBRA_CONFIG||{};
  if(!window.supabase||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.url||'')||!cfg.key||/SUA-CHAVE/.test(cfg.key)){showGate('setup');return}
  if(keyIsSecret(cfg.key)){showGate('setup');$('#g-tag').textContent='A chave em config.js é a chave SECRETA. Troque pela chave pública (anon ou publishable) e apague a secreta de qualquer lugar onde ela apareça.';return}
  sb=window.supabase.createClient(cfg.url.replace(/\/$/,''),cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'sobra-auth'}});
  sb.auth.onAuthStateChange((ev,session)=>{setTimeout(()=>{if(session&&session.user)enter(session);else if(ev==='SIGNED_OUT')leave()},0)});
  const {data}=await sb.auth.getSession();
  if(data&&data.session)enter(data.session);else showGate('email');
}
$('#logout').onclick=async()=>{await sb.auth.signOut();leave();toast('Você saiu da conta')};
let hiddenAt=0;const LOCK_AFTER_MS=60000;
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){hiddenAt=Date.now();if(lockOn()&&!locked)document.body.classList.add('is-locked');return}
  if(!S.uid)return;
  if(lockOn()&&(locked||Date.now()-hiddenAt>LOCK_AFTER_MS)){showLock();autoUnlock();return}
  document.body.classList.remove('is-locked');if(tab!==3)reload();else drawCanais(true)});

/* ---------- bloqueio com Face ID (WebAuthn) ---------- */
const LOCK_KEY='sobra-lock-v1';
const b64e=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const b64d=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4)),c=>c.charCodeAt(0));
function lockCfg(){try{return JSON.parse(localStorage.getItem(LOCK_KEY)||'null')}catch(e){return null}}
function lockCfgSet(v){try{v?localStorage.setItem(LOCK_KEY,JSON.stringify(v)):localStorage.removeItem(LOCK_KEY)}catch(e){}}
const lockSupported=()=>!!(window.PublicKeyCredential&&navigator.credentials&&window.isSecureContext&&window.crypto&&crypto.getRandomValues);
const lockOn=()=>{const c=lockCfg();return !!(c&&c.id&&c.uid&&c.uid===S.uid)};
let locked=false,unlocking=false;
function showLock(){locked=true;document.body.classList.add('is-locked');$('#lock').hidden=false;$('#lock-msg').textContent='Use o Face ID para abrir.'}
function hideLock(){locked=false;$('#lock').hidden=true;document.body.classList.remove('is-locked')}
async function tryUnlock(){
  if(unlocking)return;const c=lockCfg();if(!lockOn()){hideLock();reload();return}
  unlocking=true;
  try{
    await navigator.credentials.get({publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),rpId:location.hostname,allowCredentials:[{type:'public-key',id:b64d(c.id)}],userVerification:'required',timeout:60000}});
    hideLock();reload();
  }catch(e){$('#lock-msg').textContent=e&&e.name==='NotAllowedError'?'Toque em qualquer lugar para usar o Face ID.':'Não deu para confirmar. Toque para tentar de novo.'}
  finally{unlocking=false}
}
// Abre o Face ID sozinho, mas só com a tela já ativa: chamado no instante em que o app volta do
// segundo plano, o iPhone recusa. Se mesmo assim recusar, qualquer toque na tela de bloqueio tenta de novo.
function autoUnlock(){
  const vai=()=>setTimeout(()=>{if(locked&&document.visibilityState==='visible')tryUnlock()},300);
  if(document.hasFocus())vai();else addEventListener('focus',vai,{once:true});
}
$('#lock').onclick=e=>{if(!e.target.closest('#lock-out'))tryUnlock()};
$('#lock-out').onclick=async()=>{try{await sb.auth.signOut()}catch(e){}leave()};
async function enableLock(){
  if(!lockSupported()){toast('Este aparelho não permite Face ID no navegador.');return}
  const btn=$('#lk-linha');btn.disabled=true;
  try{
    const cred=await navigator.credentials.create({publicKey:{
      challenge:crypto.getRandomValues(new Uint8Array(32)),
      rp:{name:'Leve',id:location.hostname},
      user:{id:crypto.getRandomValues(new Uint8Array(16)),name:S.email||'leve',displayName:(S.config&&S.config.nome)||'Leve'},
      pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
      authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'discouraged'},
      timeout:60000,attestation:'none'}});
    lockCfgSet({id:b64e(cred.rawId),uid:S.uid,em:new Date().toISOString()});toast('Face ID ativado neste aparelho');
  }catch(e){toast(e&&e.name==='NotAllowedError'?'Ativação cancelada.':'Não deu para ativar o Face ID.')}
  finally{btn.disabled=false;drawLockCard()}
}
function disableLock(){lockCfgSet(null);drawLockCard();toast('Bloqueio desativado')}
function drawLockCard(){const on=lockOn(),ok=lockSupported(),l=$('#lk-linha'),e=$('#lk-est');
  e.textContent=on?'Ligado':ok?'Desligado':'Indisponível';e.classList.toggle('off',!on);
  l.disabled=!on&&!ok;l.setAttribute('aria-label',on?'Face ID ligado. Tocar desliga':ok?'Face ID desligado. Tocar liga':'Face ID indisponível neste navegador');
  l.onclick=on?disableLock:enableLock}
function netBanner(){const b=$('#banner');b.hidden=navigator.onLine;b.textContent='Sem internet. O que você lançar agora pode não ser salvo.'}
addEventListener('online',()=>{netBanner();reload()});addEventListener('offline',netBanner);

/* ---------- money logic ---------- */
function plano(m){
  const c=S.config;const at=c.fixos.filter(f=>f.inicio&&f.inicio<=m&&(!f.fim||f.fim>=m));
  const sum=a=>a.reduce((s,f)=>s+(+f.valor||0),0);
  const aj=c.ajustes[m];const cartao=(aj!==undefined&&aj!==null&&aj!=='')?+aj:sum(at.filter(f=>f.onde!=='debito'));
  const debito=sum(at.filter(f=>f.onde==='debito'));
  const livre=c.salario-c.meta-cartao-debito,bl=blocos(m),dias=bl.reduce((s,b)=>s+b.dias,0),porDia=dias?livre/dias:0;
  return{m,cartao,debito,livre,blocos:bl,dias,porDia,porSemana:porDia*7,ajustado:aj!==undefined&&aj!==null&&aj!=='',fixos:at};
}
// Limite de um bloco (semana): o que sobra do livre depois do gasto antes dele, dividido pelos dias que faltam
// no período, vezes os dias do bloco. Gastar menos aumenta as próximas semanas; gastar mais as reduz.
// Semanas futuras do período atual: supõem que a semana de hoje gaste o limite dela (ou o que já passou dele),
// então ficam iguais entre si e só mudam quando o gasto real muda.
function limBloco(p,b){const pr=periodo(p.m),hj=dia0(new Date());
  if(hj>=pr.ini&&hj<=pr.fim&&b.ini>hj){const cur=blocoDe(hj);
    if(b.ini>cur.fim){const resto=p.livre-gastoEntre(pr.ini,addDays(cur.ini,-1))-Math.max(limBloco(p,cur),gastoEntre(cur.ini,cur.fim)),dr=Math.round((pr.fim-cur.fim)/864e5);
      return resto>0&&dr>0?resto*b.dias/dr:0}}
  const resto=p.livre-gastoEntre(pr.ini,addDays(b.ini,-1)),dr=Math.round((pr.fim-b.ini)/864e5)+1;return resto>0&&dr>0?resto*b.dias/dr:0}
const conta=g=>!FORA.includes(g.fonte);
const gastoEntre=(a,b)=>{const ka=ymd(a),kb=ymd(b);return S.gastos.filter(g=>conta(g)&&g.data>=ka&&g.data<=kb).reduce((s,g)=>s+(+g.valor||0),0)};
const gastoDia=(d)=>{const k=ymd(d);return S.gastos.filter(g=>conta(g)&&g.data===k).reduce((s,g)=>s+(+g.valor||0),0)};
const gastoMes=m=>{const p=periodo(m);return gastoEntre(p.ini,p.fim)};
// VR e mobilidade: com o salário no último dia útil renovam junto com ele; senão, no dia 1
const benMes=(m,f)=>S.gastos.filter(g=>g.fonte===f&&(usaPagto()?mesDoDia(parseD(g.data)):String(g.data).slice(0,7))===m).reduce((s,g)=>s+(+g.valor||0),0);
const somaMov=ate=>S.caixa.filter(m=>!ate||m.data<=ate).reduce((s,m)=>s+(+m.valor||0),0);
const saldoCaixa=()=>cxEstado().saldo;

/* ---------- rendimento da caixinha ----------
   CDI diário do Banco Central (SGS 12). A taxa do dia D entra no saldo no dia D+1.
   Cada "Acertar saldo" é uma âncora: o saldo real ali é a soma dos movimentos até ele.
   O saldo acompanhado é o TOTAL BRUTO do banco, que rende CDI × % do CDI sem desconto.
   O líquido (se resgatar hoje) parte dos impostos informados no último acerto (config.cxLiq)
   e soma IR_NOVO sobre o que rendeu depois; resgates levam a parte proporcional dos impostos. */
const CDI_KEY='sobra-cdi-v1',IR_NOVO=0.2;
const CDI=(()=>{try{const j=JSON.parse(localStorage.getItem(CDI_KEY));if(j&&j.r&&typeof j.r==='object')return j}catch(e){}return{r:{},de:'',ate:'',em:0}})();
let cdiBusy=false,cdiTry=0,cdiErro=false,cxMemo=null;
const brD=d=>`${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
async function loadCdi(){
  if(cdiBusy||!S.caixa.length)return;
  const first=S.caixa.reduce((m,x)=>x.data<m?x.data:m,'9999-12-31');if(!isDate(first))return;
  const de=ymd(addDays(parseD(first),-7)),cobre=CDI.de&&CDI.de<=de&&CDI.ate;
  if(cobre&&Date.now()-CDI.em<6*36e5)return;
  if(Date.now()-cdiTry<5*6e4)return;
  cdiBusy=true;cdiTry=Date.now();
  try{
    const ini=cobre?addDays(parseD(CDI.ate),-10):parseD(de);
    const res=await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${brD(ini)}&dataFinal=${brD(new Date())}`,{credentials:'omit',cache:'no-store'});
    // período sem taxa publicada: o BC responde 404 com {"erro":...}; não é falha, só não há nada novo
    const rows=res.status===404?[]:(res.ok?await res.json():null);if(!Array.isArray(rows))throw new Error('CDI '+res.status);
    rows.forEach(x=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(x&&x.data||'')),v=parseFloat(x&&x.valor);if(m&&v>=0&&v<1)CDI.r[`${m[3]}-${m[2]}-${m[1]}`]=v/100});
    const ks=Object.keys(CDI.r).sort();CDI.ate=ks[ks.length-1]||'';if(!CDI.de||de<CDI.de)CDI.de=de;CDI.em=Date.now();cdiErro=false;
    try{localStorage.setItem(CDI_KEY,JSON.stringify(CDI))}catch(e){}
    render();
  }catch(e){console.error(e);cdiErro=true;render()}finally{cdiBusy=false}
}
function ultimoCdi(){const ks=Object.keys(CDI.r).sort(),k=ks[ks.length-1];if(k)return{k,t:CDI.r[k]};
  const a=+(S.config&&S.config.cdi)||0;return a>0?{k:'',t:Math.pow(1+a/100,1/252)-1}:null}
// Taxa do dia k: publicada; 0 em fim de semana/feriado; a última conhecida se ainda não saiu.
function taxaDia(k,fb){
  if(k in CDI.r)return CDI.r[k];
  if(CDI.ate&&k>=CDI.de&&k<=CDI.ate)return 0;
  const w=parseD(k).getDay();return !w||w===6?0:fb;
}
/* Depósitos (lotes) do RDB, a partir de uma foto tirada no banco (config.cxLotes = {data, lotes:[{dep, bruto, ganho}]}).
   Cada depósito tem o próprio imposto: IR pela idade (tabela regressiva) e IOF nos primeiros 30 dias, sobre o ganho
   ainda não tributado. Resgates saem do depósito mais novo (é o que o Nubank faz) e levam o imposto daquela parte;
   aos 730 dias o depósito vence, o banco paga o IR e o valor recomeça como depósito novo. */
const IOF_T=[96,93,90,86,83,80,76,73,70,66,63,60,56,53,50,46,43,40,36,33,30,26,23,20,16,13,10,6,3,0];
const diasEntre=(a,b)=>Math.round((parseD(b)-parseD(a))/864e5);
const aliqIR=d=>d<=180?.225:d<=360?.2:d<=720?.175:.15;
function impLote(l,k){const d=Math.max(0,diasEntre(l.dep,k)),g=Math.max(0,l.g),iof=d<30?g*IOF_T[d]/100:0;return iof+(g-iof)*aliqIR(d)}
function ajustaLotes(ls,alvo){const tot=ls.reduce((s,l)=>s+l.B,0),dif=alvo-tot;if(!(tot>0)||Math.abs(dif)<0.005)return;
  ls.forEach(l=>{const p=dif*l.B/tot;l.B+=p;l.g=Math.max(0,l.g+p)})}
function resgLotes(ls,v,k){let imp=0;const ord=ls.map((l,i)=>[l,i]).sort((a,b)=>b[0].dep.localeCompare(a[0].dep)||b[1]-a[1]);
  for(const [l] of ord){if(v<=0.004)break;const tx=impLote(l,k),liq=l.B-tx;if(liq<=0)continue;
    if(v>=liq-0.004){imp+=tx;v-=liq;l.B=0;l.g=0}else{const f=v/liq;imp+=tx*f;l.B*=1-f;l.g*=1-f;v=0}}
  for(let i=ls.length-1;i>=0;i--)if(ls[i].B<=0.004)ls.splice(i,1);
  return imp}
function simCaixa(ate){
  const pc=(+(S.config&&S.config.pctCdi)||100)/100,u=ultimoCdi(),fb=u?u.t:0,lq=S.config&&S.config.cxLiq,LT=S.config&&S.config.cxLotes;
  const mv=[...S.caixa].sort((a,b)=>String(a.data).localeCompare(String(b.data))||(a.criado||0)-(b.criado||0));
  const out={saldo:0,imp:null,mv,dias:[],rend:{},prev:{},anc:{},vencs:[],resgImp:{},lotes:null};
  if(!mv.length||!isDate(mv[0].data))return out;
  const end=ymd(ate||new Date()),lqOk=lq&&isDate(lq.data)&&isFinite(+lq.imp),ltOk=LT&&isDate(LT.data)&&Array.isArray(LT.lotes);
  let B=0,soma=0,i=0,I=null,lotes=null;
  for(let d=parseD(mv[0].data);ymd(d)<=end;d=addDays(d,1)){
    const k=ymd(d),kp=ymd(addDays(d,-1));
    if(B>0){const t=taxaDia(kp,fb);if(t>0){const y=B*t*pc;B+=y;out.rend[k]=y;if(I!==null)I+=y*IR_NOVO;if(!(kp in CDI.r))out.prev[k]=true;
      if(lotes)lotes.forEach(l=>{const yl=l.B*t*pc;l.B+=yl;l.g+=yl})}}
    if(lotes)for(const l of lotes)if(diasEntre(l.dep,k)>=730){const tx=impLote(l,k);l.B-=tx;B-=tx;out.vencs.push({k,dep:l.dep,v:tx});l.dep=k;l.g=0}
    for(;i<mv.length&&mv[i].data===k;i++){const m=mv[i],v=+m.valor||0,antes=B;soma+=v;
      const depois=lotes&&k>LT.data;
      if(depois&&m.tipo==='deposito')lotes.push({dep:k,B:v,g:0});
      if(depois&&m.tipo==='resgate'){const imp=resgLotes(lotes,-v,k);B-=imp;out.resgImp[m.id]=imp}
      if(m.tipo==='ajuste'){out.anc[m.id]={antes:B,saldo:soma,data:k};B=soma;if(depois)ajustaLotes(lotes,B)}else B+=v;
      if(m.tipo==='resgate'&&I!==null&&antes>0)I*=Math.max(0,B/antes)}
    if(ltOk&&!lotes&&k===LT.data){lotes=LT.lotes.filter(l=>isDate(l.dep)&&+l.bruto>0).map(l=>({dep:l.dep,B:+l.bruto,g:Math.max(0,+l.ganho||0)}));ajustaLotes(lotes,B)}
    if(lqOk&&k===lq.data){I=+lq.imp;
      // líquido conferido depois da foto: recalibra o ganho ainda não tributado dos depósitos
      if(lotes&&k>LT.data){const mod=lotes.reduce((s,l)=>s+impLote(l,k),0);if(mod>0.01)lotes.forEach(l=>{l.g*=I/mod})}}
    out.dias.push({d,v:B});
  }
  if(lotes){out.imp=lotes.reduce((s,l)=>s+impLote(l,end),0);out.lotes=lotes.map(l=>Object.assign({},l))}else out.imp=I;
  out.saldo=B;return out;
}
function cxEstado(){
  const c=S.config||{},k=[S.caixa,CDI.em,c.pctCdi,c.cdi,c.cxLiq,c.cxLotes,ymd(new Date())];
  if(cxMemo&&cxMemo.k.every((x,i)=>x===k[i]))return cxMemo.v;
  const v=simCaixa();cxMemo={k,v};return v;
}
const movMes=(x,m)=>(x.mes||mesDoDia(parseD(x.data)))===m;
const guardadoMes=m=>S.caixa.filter(x=>x.tipo==='deposito'&&movMes(x,m)).reduce((s,x)=>s+(+x.valor||0),0);
const resgatadoMes=m=>-S.caixa.filter(x=>x.tipo==='resgate'&&movMes(x,m)).reduce((s,x)=>s+(+x.valor||0),0);
const planMonth=d=>{const m=mesDoDia(d);return m<S.config.inicio?S.config.inicio:m};

/* ---------- animated numbers ---------- */
function countTo(el,to,fmt=money){
  if(!el)return;
  const from=parseFloat(el.dataset.v);el.dataset.v=to;
  if(reduce||isNaN(from)||from===to){el.textContent=fmt(to);return}
  const t0=performance.now(),dur=900;
  cancelAnimationFrame(el._raf);
  const step=t=>{const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,4);el.textContent=fmt(from+(to-from)*e);if(p<1)el._raf=requestAnimationFrame(step)};
  el._raf=requestAnimationFrame(step);
}

/* ---------- render ---------- */
let tab=0,mesSel=null,openItem=null;
let gPer='mes',gSem=null,gMesRef=null,gCat=null,gBusca='',gFonte='';
// Busca no Extrato: cada palavra precisa aparecer na descrição, na categoria ou na forma de pagamento; número procura
// pelo valor ("32" acha R$ 32,xx; "32,90" acha exatamente R$ 32,90). Sem acento e sem maiúscula.
const semAc=t=>String(t||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
function bateBusca(g,termos){const alvo=semAc(`${g.desc} ${catOf(g.cat).n} ${FONTE[g.fonte]||''}`),v=+g.valor||0;
  return termos.every(t=>{const n=/^\d+(?:[.,]\d{1,2})?$/.test(t)?t.replace(',','.'):null;
    if(n!==null&&/[.,]/.test(t)&&Math.abs(v-+n)<0.005)return true;if(n!==null&&!/[.,]/.test(t)&&Math.floor(v)===+n)return true;return alvo.includes(t)})}
function render(){
  const now=new Date();
  if(!S.config){
    if(!S.uid||!S.loaded)return;
    S.config=normalize({nome:'',salario:0,meta:0,vr:0,mob:0,inicio:ym(now),fixos:[],ajustes:{}});
  }
  const c=S.config;
  $('#avatar-l').textContent=(c.nome||'L').trim().charAt(0).toUpperCase()||'L';
  if(mesSel===null)mesSel=c.inicio>mesDoDia(now)?c.inicio:mesDoDia(now);
  renderHome(now);riscar();renderHomeResumo();renderMes();renderGastos();renderCaixa();if((tab!==3&&tab!==6)||!ajDirty)renderAjustes();if(tab===5)renderResumo();drawHead();
  cacheGravar();
}
// cabeçalho: linha pequena + título de cada tela (no Início, saudação e uma frase sobre a semana)
let frase='Tudo no seu ritmo.';
function drawHead(){const h=new Date().getHours(),nome=S.config&&S.config.nome;
  const ola=(h>=5&&h<12?'Bom dia':h>=12&&h<18?'Boa tarde':'Boa noite')+(nome?`, ${nome}`:'');
  const T={0:[ola,frase],1:['Seu dinheiro','Extrato'],2:['Seu dinheiro','Extrato'],3:[nome?`Conta de ${nome}`:'Sua conta','Ajustes'],6:['Ajustes','Seu plano'],4:['leve / seu dinheiro','Sua caixinha'],5:['Seu dinheiro','Extrato']}[tab]||[ola,frase];
  $('#hello-s').textContent=T[0];$('#hello-t').textContent=T[1]}

let riscoV=null,tDia=0;
// tocar num dia da semana mostra o que saiu nele; volta sozinho depois de 4 s
$('#h-pace').addEventListener('click',e=>{const b=e.target.closest('.dia');if(!b)return;e.stopPropagation();
  const k=b.dataset.dia,d=parseD(k),gs=S.gastos.filter(g=>g.data===k&&conta(g)),t=gs.reduce((a,g)=>a+(+g.valor||0),0),sub=$('#h-sub');
  const nome=d.toLocaleDateString('pt-BR',{weekday:'long'}),Nome=nome.charAt(0).toUpperCase()+nome.slice(1);
  if(sub.dataset.orig===undefined)sub.dataset.orig=sub.textContent;
  $$('#h-pace .dia').forEach(x=>x.classList.toggle('sel',x===b));
  sub.textContent=k>ymd(new Date())?`${Nome}, ${diaCurto(d)}: ainda não chegou.`:gs.length?`${Nome}, ${diaCurto(d)}: ${money(t)} em ${gs.length} saída${gs.length>1?'s':''}.`:`${Nome}, ${diaCurto(d)}: nenhuma saída que conte no limite.`;
  clearTimeout(tDia);tDia=setTimeout(()=>{if(sub.dataset.orig!==undefined){sub.textContent=sub.dataset.orig;delete sub.dataset.orig}$$('#h-pace .dia').forEach(x=>x.classList.remove('sel'))},4000)});
function riscar(){const r=$('#hero .risco'),v=$('#h-big').dataset.v;if(!r||v===riscoV)return;riscoV=v;
  r.classList.remove('vai');void r.getBoundingClientRect();r.classList.add('vai')}
function renderHome(now){
  const c=S.config,hero=$('#hero'),m=mesDoDia(now);delete $('#h-sub').dataset.orig;clearTimeout(tDia);
  const pace=$('#h-pace');
  if(!(c.salario>0)){
    hero.className='hero idle';hero.onclick=()=>abrirIni();hero.style.cursor='pointer';
    if(!iniMostrado&&S.loaded&&!S.doCache&&!$('.sheet.on')){iniMostrado=true;setTimeout(()=>{if(!(S.config&&S.config.salario>0))abrirIni()},500)}
    $('#h-lbl').textContent='Vamos montar seu plano';$('#h-big').dataset.v='';$('#h-big').textContent='Começar';
    $('#h-sub').textContent='Toque aqui: em quatro passos curtos o Leve monta o seu limite da semana.';
    pace.innerHTML='';$('#tiles').innerHTML='';$('#h-bar').hidden=true;$('#h-tag').textContent='Primeiro passo';$('#h-faixa').textContent='';frase='Vamos começar.';
    $('#recent').innerHTML='<div class="empty"><strong>Tudo pronto para começar</strong>Depois de salvar o plano, toque em "Nova saída" para registrar o que você gastar.</div>';
    return;
  }
  hero.onclick=null;hero.style.cursor='';
  if(m<c.inicio){
    const start=periodo(c.inicio).ini;const dias=Math.round((start-dia0(now))/864e5);
    hero.className='hero idle';$('#h-bar').hidden=true;$('#h-tag').textContent='Contagem regressiva';$('#h-faixa').textContent='';frase='Quase lá.';
    $('#h-lbl').textContent='Seu plano começa '+start.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
    countTo($('#h-big'),dias,v=>`${Math.round(v)} ${Math.round(v)===1?'dia':'dias'}`);
    const p=plano(c.inicio),b1=p.blocos[0];
    $('#h-sub').textContent=`Primeira semana: ${money(b1?limBloco(p,b1):p.porSemana)} para gastar. Até lá, só o essencial.`;
    pace.innerHTML='';
  }else{
    // semana = bloco do período que contém hoje (pode ser parcial, ex.: do dia do salário até domingo)
    const p=plano(m),today=dia0(now),bl=blocoDe(today),lim=limBloco(p,bl),spent=gastoEntre(bl.ini,bl.fim),left=lim-spent;
    const diasRest=Math.round((bl.fim-today)/864e5)+1,restoMes=p.livre-gastoMes(m),prox=addDays(periodo(m).fim,1);
    hero.className='hero'+(restoMes<0||left<0?' over':'');
    $('#h-tag').textContent=restoMes<0?'Seu mês':'Sua semana';$('#h-faixa').textContent=`${diaCurto(bl.ini)} – ${diaCurto(bl.fim)}`;
    frase=restoMes<0?'Hora de respirar fundo.':left<0?'Semana mais apertada.':spent<=lim*0.8?'Tudo no seu ritmo.':'Quase no limite.';
    const hb=$('#h-bar');hb.hidden=false;const hpc=lim>0?Math.max(0,Math.min(100,spent/lim*100)):100;requestAnimationFrame(()=>{hb.firstChild.style.width=hpc+'%'});
    if(restoMes<0){
      // o mês inteiro já estourou: não há mais limite para a semana
      $('#h-lbl').textContent='Passou do limite do mês';
      countTo($('#h-big'),-restoMes);
      $('#h-sub').textContent=`Você gastou ${money(-restoMes)} a mais do que o livre de ${mesCurto(m)}. O ideal é não gastar mais até ${prox.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'numeric'})}.`;
    }else{
      $('#h-lbl').textContent=left<0?'Passou do limite da semana':'Você ainda pode gastar';
      countTo($('#h-big'),Math.abs(left));
      $('#h-sub').textContent=left<0
        ?`Gastou ${money(spent)} de ${money(lim)}. As próximas semanas já diminuem para compensar.`
        :`limite de ${money(lim)} · ${money(left/diasRest)} por dia`;
    }
    // barras por dia: altura = o que saiu no dia (só o que conta no limite); tracejado = ritmo do limite.
    // Violeta: até ali a semana está no ritmo; rosado: passou do ritmo; clara: hoje; apagada: dias que ainda vêm.
    const L=['D','S','T','Q','Q','S','S'],ritmo=lim/bl.dias,vals=Array.from({length:bl.dias},(_,i)=>gastoDia(addDays(bl.ini,i))),mx=Math.max(ritmo*1.5,...vals,1);let acc=0;
    pace.classList.add('barras');pace.style.setProperty('--n',bl.dias);pace.style.setProperty('--ritmo',Math.min(1,ritmo/mx).toFixed(3));
    pace.innerHTML=vals.map((v,i)=>{const d=addDays(bl.ini,i);acc+=v;
      const cls=d>today?'fut':+d===+today?'hoje':acc<=ritmo*(i+1)+0.005?'ok':'acima';
      const nome=d.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
      return `<button type="button" class="dia ${cls}" data-dia="${ymd(d)}" aria-label="${esc(nome)}: ${esc(money(v))}${cls==='acima'?', acima do ritmo':''}"><span class="b" style="--h:${(v/mx*100).toFixed(1)}"></span><span class="l">${L[d.getDay()]}</span></button>`}).join('');
  }
  // tiles
  const mm=m<c.inicio?c.inicio:m,p=plano(mm),gm=gastoMes(mm),restMes=p.livre-gm;
  const guardMes=guardadoMes(mm),guardou=guardMes>=c.meta-0.005,tot=saldoCaixa(),vrm=usaPagto()?mm:ym(now),vrRest=c.vr-benMes(vrm,'vr'),mobRest=c.mob-benMes(vrm,'mob');
  const pct=x=>Math.max(0,Math.min(100,x));
  $('#tiles').innerHTML=`
   <button class="tile y" data-go="1"><span class="t">${svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',1.8)}Livre em ${esc(mesCurto(mm))}</span><span class="v num" data-n="mes"></span><span class="bar"><b style="--w:${pct(gm/Math.max(1,p.livre)*100)}%"></b></span><span class="s num">de ${money(p.livre)}</span></button>
   <div class="tile p tem-olho" data-go="4" role="button" tabindex="0"><span class="t">${svg('<path d="M5 10h14v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',1.8)}Na caixinha</span><button class="olho olho-mini" type="button" aria-pressed="${document.body.classList.contains('cx-oculto')}" aria-label="${document.body.classList.contains('cx-oculto')?'Mostrar':'Esconder'} o saldo"><svg class="olho-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg><svg class="olho-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.6A9.6 9.6 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-3.2 3.9M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg></button><span class="v num" data-n="poup"></span><button class="save-btn ${guardou?'done':''}" id="save-btn">${guardou?'Meta de '+esc(mesCurto(mm))+' guardada':'Guardei '+money(c.meta-guardMes)}</button></div>
   ${c.vr>0?`<div class="tile g"><span class="t">${svg(ICON.comida,1.8)}Vale-refeição</span><span class="v num" data-n="vr"></span><span class="bar"><b style="--w:${pct(benMes(vrm,'vr')/Math.max(1,c.vr)*100)}%"></b></span><span class="s num">de ${money(c.vr)}</span></div>`:''}
   ${c.mob>0?`<div class="tile b"><span class="t">${svg(ICON.transporte,1.8)}Mobilidade</span><span class="v num" data-n="mob"></span><span class="bar"><b style="--w:${pct(benMes(vrm,'mob')/Math.max(1,c.mob)*100)}%"></b></span><span class="s num">de ${money(c.mob)}</span></div>`:''}`;
  countTo($('[data-n=mes]'),restMes);countTo($('[data-n=poup]'),tot);countTo($('[data-n=vr]'),vrRest);countTo($('[data-n=mob]'),mobRest);
  requestAnimationFrame(()=>$$('#tiles .bar b').forEach(b=>b.style.width=b.style.getPropertyValue('--w')));
  $('#save-btn').onclick=e=>{e.stopPropagation();if(guardou){switchTab(4);return}
    const v=Math.round((c.meta-guardMes)*100)/100;addMov({data:ymd(now),valor:v,tipo:'deposito',mes:mm,nota:'Meta de '+mesCurto(mm)});
    confetti();toast(`${money(v)} guardados. Caixinha: ${money(tot+v)}`)};
  // recent
  const rec=[...S.gastos].sort(sortG).slice(0,matchMedia('(min-width:960px)').matches?10:5);  // no computador cabe mais
  $('#recent').innerHTML=rec.length?rec.map((g,i)=>itemHTML(g,i)).join(''):`<div class="empty"><strong>Nenhuma saída ainda</strong>Toque em "Nova saída" para registrar a primeira. Saídas no vale-refeição e na mobilidade aparecem aqui, mas não contam no seu limite.</div>`;
}
const sortG=(a,b)=>String(b.data).localeCompare(String(a.data))||(b.criado||0)-(a.criado||0);
function itemHTML(g,i){const c=catOf(g.cat);const d=parseD(g.data);
  return `<div class="item" style="--i:${i}" data-id="${esc(g.id)}" role="button" tabindex="0">
    <span class="ico" style="--c:${c.bg}">${svg(ICON[c.k])}</span>
    <span style="min-width:0"><div class="n">${esc(g.desc||c.n)}</div><div class="m">${esc(diaCurto(d))} · ${esc(FONTE[g.fonte]||'Conta')}${g.desc?' · '+esc(c.n):''}</div></span>
    <span class="val num">− ${money(g.valor)}</span>
  </div>`}

function renderMes(){
  const c=S.config,m=mesSel,p=plano(m),gm=gastoMes(m);
  $('#m-name').textContent=mesLongo(m);
  $('#m-prev').disabled=m<=c.inicio;
  const total=Math.max(c.salario,1),gastoLivre=Math.max(0,Math.min(gm,p.livre)),sobrando=Math.max(0,p.livre-gm);
  const parts=[
    {n:'Guardar',v:c.meta,col:'var(--rosa)'},
    {n:p.ajustado?'Fatura (valor exato)':'Fatura: fixos',v:p.cartao,col:'var(--roxo)'},
    {n:'Débito fixo',v:p.debito,col:'var(--azul)'},
    {n:'Já saiu do livre',v:gastoLivre,col:'var(--laranja)'},
    {n:'Ainda livre',v:sobrando,col:'var(--amarelo)'}];
  const C=2*Math.PI*60;let off=0;
  $('#donut').innerHTML=`<circle cx="80" cy="80" r="60" stroke="var(--surface-2)"/>`+parts.map(x=>{const len=Math.max(0,x.v)/total*C;const s=`<circle cx="80" cy="80" r="60" stroke="${x.col}" stroke-dasharray="0 ${C}" data-da="${Math.max(0,len-2)} ${C}" stroke-dashoffset="${-off}" stroke-linecap="butt"/>`;off+=len;return s}).join('');
  requestAnimationFrame(()=>requestAnimationFrame(()=>$$('#donut [data-da]').forEach(el=>el.style.strokeDasharray=el.dataset.da)));
  countTo($('#d-center'),p.livre-gm);$('#d-center-l').textContent=p.livre-gm<0?'acima do livre':'livre no mês';
  $('#d-sal').textContent=money(c.salario);
  $('#legend').innerHTML=parts.map(x=>`<div class="lg"><i style="background:${x.col}"></i><span>${esc(x.n)}</span><small class="num">${c.salario>0?Math.round(Math.max(0,x.v)/c.salario*100)+'%':''}</small><b class="num">${money(x.v)}</b></div>`).join('');
  {const hj=dia0(new Date()),pr=periodo(m);
    if(hj>=pr.ini&&hj<=pr.fim){const resto=p.livre-gastoMes(m),fut=p.blocos.find(b=>b.ini>blocoDe(hj).fim);
      $('#m-porsem').textContent=resto<0?`${money(-resto)} acima do livre`:fut?`${money(limBloco(p,fut)/fut.dias*7)} por semana nas próximas`:`${money(limBloco(p,blocoDe(hj)))} nesta última semana`}
    else $('#m-porsem').textContent=`${money(p.porSemana)} por semana`}
  const hoje=dia0(new Date());
  $('#weeks').innerHTML=p.blocos.map(b=>{const lim=limBloco(p,b),g=gastoEntre(b.ini,b.fim),pc=lim>0?Math.min(100,g/lim*100):0;
    return `<div class="wk ${hoje>=b.ini&&hoje<=b.fim?'now':''}"><span>${esc(diaCurto(b.ini))}–${esc(diaCurto(b.fim))}</span><span class="track"><b class="${g>lim?'over':''}" data-w="${pc}"></b></span><span class="r num">${money(lim-g)}</span></div>`}).join('');
  requestAnimationFrame(()=>$$('#weeks [data-w]').forEach(b=>b.style.width=b.dataset.w+'%'));
  const months=[];for(let i=0;i<14;i++)months.push(addMonths(c.inicio,i));
  const vals=months.map(x=>plano(x).livre),mx=Math.max(1,...vals);
  $('#future').innerHTML=months.map((x,i)=>`<button class="fb ${x===m?'sel':''}" data-m="${x}" style="--i:${i}" aria-label="${esc(mesLongo(x))}"><em class="num">${Math.round(vals[i])}</em><i style="height:${Math.max(4,vals[i]/mx*90)}px"></i><span>${esc(mes3(x))}</span></button>`).join('');
  $$('#future .fb').forEach(b=>b.onclick=()=>{mesSel=b.dataset.m;renderMes()});
  const fx=p.fixos;
  $('#fixos-mes').innerHTML=(p.ajustado?`<div class="fixo"><span><b>Fatura deste mês</b><br><small>valor exato definido em Ajustes</small></span><b class="num">${money(p.cartao)}</b></div>`:'')+
    (fx.length?fx.filter(f=>!(p.ajustado&&f.onde!=='debito')).map(f=>`<div class="fixo"><span>${esc(f.nome)}<span class="chip">${f.onde==='debito'?'débito':'crédito'}</span><br><small>${f.fim?'até '+esc(mesCurto(f.fim)):'sem fim'}</small></span><b class="num">${money(f.valor)}</b></div>`).join(''):'')||'<div class="empty">Nenhum custo fixo neste mês.</div>';
}

function renderGastos(){
  // período: semana (seg–dom) ou mês do plano (semanas cujo sábado cai no mês)
  const c=S.config,now=new Date();
  if(!gSem)gSem=inicioSemana(now);if(!gMesRef)gMesRef=mesDoDia(now);
  let ini,fim,nome,faixa,lim=null,limDias=null;
  if(gPer==='semana'){ini=gSem;fim=addDays(gSem,6);nome=+gSem===+inicioSemana(now)?'Esta semana':+gSem===+addDays(inicioSemana(now),-7)?'Semana passada':`Semana de ${diaCurto(gSem)}`;faixa=`${diaCurto(ini)} – ${diaCurto(fim)}`;
    // semana do calendário: cada dia usa o limite diário do mês do plano a que pertence
    if(c.salario>0){let t=0;limDias=new Set();for(let i=0;i<7;i++){const d=addDays(gSem,i),m=mesDoDia(d);if(m>=c.inicio){const b=blocoDe(d);t+=limBloco(plano(m),b)/b.dias;limDias.add(ymd(d))}}if(limDias.size)lim=t}}
  else{const pr=periodo(gMesRef);ini=pr.ini;fim=pr.fim;nome=mesLongo(gMesRef).replace(/^./,x=>x.toUpperCase());faixa=`${diaCurto(ini)} – ${diaCurto(fim)}`;
    if(c.salario>0&&gMesRef>=c.inicio)lim=plano(gMesRef).livre}
  $('#g-nome').textContent=nome;$('#g-faixa').textContent=faixa;
  $('#g-next').disabled=ymd(addDays(fim,1))>ymd(now);
  const k0=ymd(ini),k1=ymd(fim),doPer=S.gastos.filter(g=>g.data>=k0&&g.data<=k1);
  // no limite só entram os dias que têm limite (numa semana que cruza o dia do salário, os de antes do plano ficam de fora)
  const tot=doPer.reduce((s,g)=>s+(+g.valor||0),0),noLim=doPer.filter(g=>conta(g)&&(!limDias||limDias.has(g.data))).reduce((s,g)=>s+(+g.valor||0),0),ben=doPer.filter(g=>!conta(g)).reduce((s,g)=>s+(+g.valor||0),0);
  countTo($('#g-total'),tot);
  $('#g-det').textContent=doPer.length?`${doPer.length} lançamento${doPer.length>1?'s':''}`+(ben>0.005?` · ${money(ben)} fora do limite (vale-refeição, mobilidade, caixinha)`:''):'Nenhum lançamento';
  $('#g-lim').classList.toggle('over',lim!==null&&noLim>lim);
  if(lim!==null)$('#g-lim').textContent=noLim>lim?`${money(noLim-lim)} acima do limite de ${money(lim)}`:`${money(lim-noLim)} ainda livres ${gPer==='semana'?'na semana':'no mês'}`;
  else $('#g-lim').textContent='';
  // categorias do período; tocar filtra a lista
  const porCat={};doPer.forEach(g=>{const k=catOf(g.cat).k;porCat[k]=(porCat[k]||0)+(+g.valor||0)});
  const ks=Object.keys(porCat).sort((a,b)=>porCat[b]-porCat[a]);
  if(gCat&&!ks.includes(gCat))gCat=null;
  // barra empilhada: cada categoria ocupa a parte dela do limite (ou do total, sem limite)
  const st=$('#g-bar'),base=Math.max(tot,lim||0);st.hidden=!(tot>0);st.classList.toggle('over',lim!==null&&noLim>lim);
  st.innerHTML=ks.map(k=>`<b data-w="${(porCat[k]/Math.max(base,0.01)*100).toFixed(2)}" style="background:${catOf(k).bg}" title="${esc(catOf(k).n)}"></b>`).join('');
  requestAnimationFrame(()=>$$('#g-bar [data-w]').forEach(b=>b.style.width=b.dataset.w+'%'));
  $('#g-cats').innerHTML=ks.length?ks.map((k,i)=>{const ct=catOf(k),v=porCat[k],pc=tot>0?v/tot*100:0;
    return `<button class="cat-row${gCat===k?' on':gCat?' off':''}" data-gc="${k}" style="--i:${i}" aria-pressed="${gCat===k}"><span class="ico" style="--c:${ct.bg}">${svg(ICON[ct.k])}</span><span class="cat-n"><span>${esc(ct.n)}</span><small>${Math.round(pc)}% do total</small></span><span class="cat-v num">${money(v)}</span></button>`}).join('')
    :'<div class="empty">As saídas do período aparecem aqui, separadas por categoria.</div>';
  $('#g-mes').hidden=!!gCat;
  $('#g-limpa').hidden=!gCat;
  // lista por dia: com busca, procura em todas as datas; sem busca, no período (e na categoria tocada)
  const termos=semAc(gBusca).split(/\s+/).filter(Boolean),buscando=termos.length>0;
  $('#s-gastos').classList.toggle('buscando',buscando);$('#g-busca-x').hidden=!gBusca;
  $$('#g-fontes button').forEach(b=>{const on=b.dataset.gf===gFonte;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
  const base0=buscando?S.gastos.filter(g=>bateBusca(g,termos)):doPer.filter(g=>!gCat||catOf(g.cat).k===gCat);
  const todos=base0.filter(g=>!gFonte||g.fonte===gFonte).sort(sortG),list=todos.slice(0,300);
  const res=$('#g-res'),somaL=todos.reduce((s,g)=>s+(+g.valor||0),0),qtd=n=>`${n} saída${n===1?'':'s'}`;
  if(buscando)res.textContent=todos.length?`${qtd(todos.length)} com "${gBusca.trim()}"${gFonte?' no '+FONTE[gFonte].toLowerCase():''} · ${money(somaL)}${todos.length>list.length?' · mostrando as 300 mais recentes':''}`:'';
  else if(gFonte)res.textContent=todos.length?`${FONTE[gFonte]}: ${money(somaL)} em ${qtd(todos.length)} neste período`:'';
  else res.textContent='';
  res.hidden=!res.textContent;
  if(!list.length){$('#all').innerHTML=buscando?`<div class="empty"><strong>Nada encontrado</strong>Nenhuma saída com "${esc(gBusca.trim())}"${gFonte?' no '+esc(FONTE[gFonte].toLowerCase()):''}. Tente outra palavra ou o valor, ex.: 32,90.</div>`
      :`<div class="empty"><strong>Nada por aqui</strong>${gFonte&&doPer.length?'Nenhuma saída com essa forma de pagamento neste período.':doPer.length?'Nenhuma saída nessa categoria.':'Toque no + para lançar ou importe a fatura em Ajustes.'}</div>`;return}
  const dias={};list.forEach(g=>{(dias[g.data]=dias[g.data]||[]).push(g)});
  const hoje=ymd(now),ontem=ymd(addDays(now,-1));let i=0;
  $('#all').innerHTML=Object.keys(dias).sort().reverse().map(k=>{const d=parseD(k),t=dias[k].reduce((s,g)=>s+(+g.valor||0),0);
    const rot=k===hoje?'Hoje':k===ontem?'Ontem':d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','')+', '+diaCurto(d);
    return `<div class="group-h"><span>${esc(rot)}</span><span class="num">${money(t)}</span></div>`+dias[k].map(g=>itemHTML(g,i++)).join('')}).join('');
}
$('#g-per').onclick=e=>{const b=e.target.closest('[data-p]');if(!b||b.dataset.p===gPer)return;gPer=b.dataset.p;
  $('#g-per .thumb').style.transform=`translateX(${gPer==='mes'?100:0}%)`;$$('#g-per button').forEach(x=>x.classList.toggle('on',x===b));renderGastos()};
$('#g-per .thumb').style.transform='translateX(100%)';
let tBusca=0;
$('#g-busca').addEventListener('input',e=>{clearTimeout(tBusca);const v=e.target.value;tBusca=setTimeout(()=>{gBusca=v;if(S.config)renderGastos()},120)});
$('#g-busca').addEventListener('keydown',e=>{if(e.key==='Escape'&&e.target.value){e.stopPropagation();$('#g-busca-x').click()}else if(e.key==='Enter')e.target.blur()});
$('#g-busca-x').onclick=()=>{$('#g-busca').value='';gBusca='';if(S.config)renderGastos();$('#g-busca').focus()};
$('#g-fontes').onclick=e=>{const b=e.target.closest('[data-gf]');if(!b)return;gFonte=b.dataset.gf;if(S.config)renderGastos()};
$('#g-prev').onclick=()=>{if(gPer==='semana')gSem=addDays(gSem,-7);else gMesRef=addMonths(gMesRef,-1);renderGastos()};
$('#g-next').onclick=()=>{if(gPer==='semana')gSem=addDays(gSem,7);else gMesRef=addMonths(gMesRef,1);renderGastos()};
$('#g-cats').onclick=e=>{const b=e.target.closest('[data-gc]');if(!b)return;gCat=gCat===b.dataset.gc?null:b.dataset.gc;renderGastos()};
$('#g-limpa').onclick=()=>{gCat=null;renderGastos()};

/* ---------- caixinha ---------- */
const TIPO={deposito:'Depósito',resgate:'Resgate',ajuste:'Acerto de saldo'};
function renderCaixa(){
  const c=S.config,now=new Date(),mm=planMonth(now),cx=cxEstado(),saldo=cx.saldo,obj=+c.objetivo||0,hoje=ymd(now),mesCal=ym(now);
  countTo($('#cx-saldo'),saldo);
  // anel do objetivo
  const pf=obj>0?Math.max(0,Math.min(1,saldo/obj)):0;
  $('#cx-ring').hidden=!(obj>0);
  $('#cx-ring-p').textContent=obj>0?`${(saldo/obj*100).toFixed(1).replace('.',',').replace(/,0$/,'')}%`:'';
  $('#cx-meta-v').textContent=money(saldo).replace(/,00$/,'');$('#cx-meta-de').textContent=obj>0?`de ${money(obj).replace(/,00$/,'')}`:'';
  requestAnimationFrame(()=>{$('#cx-ring-v').style.width=(pf*100).toFixed(1)+'%'});
  $('#cx-obj').textContent=obj>0?(saldo>=obj?'Objetivo alcançado':`Faltam ${money(obj-saldo)}`):'';
  // resumo do mês
  const g=guardadoMes(mm),r=resgatadoMes(mm),pct=x=>Math.max(0,Math.min(100,x));
  const rk=Object.keys(cx.rend).sort(),corr=Object.values(cx.anc).filter(a=>a.antes>0.005).map(a=>({k:a.data,v:a.saldo-a.antes}));
  const rMes=rk.filter(k=>k.startsWith(mesCal)).reduce((s,k)=>s+cx.rend[k],0)+corr.filter(a=>a.k.startsWith(mesCal)).reduce((s,a)=>s+a.v,0);
  $('#cx-tiles').innerHTML=`
    <div class="st"><span>Guardado</span><b class="num" data-n="cxg"></b><span class="bar" style="--ac:var(--verde)"><b style="--w:${pct(g/Math.max(1,c.meta)*100)}%"></b></span><small>meta ${money(c.meta).replace(/,00$/,'')}</small></div>
    <div class="st"><span>Resgatado</span><b class="num${r>0?' neg':''}" data-n="cxr"></b><small>${esc(mesCurto(mm))}</small></div>
    <div class="st"><span>Rendeu</span><b class="num pos" data-n="cxy"></b><small>${esc(mesCurto(mesCal))}</small></div>`;
  countTo($('[data-n=cxg]'),g);countTo($('[data-n=cxr]'),r);countTo($('[data-n=cxy]'),rMes);
  requestAnimationFrame(()=>$$('#cx-tiles .bar b').forEach(b=>b.style.width=b.style.getPropertyValue('--w')));
  drawChart(cx);
  // lista agrupada por mês: movimentos + rendimento por dia (mês atual) ou do mês (meses anteriores)
  const lista=S.caixa.map(m=>({m,data:m.data,criado:m.criado||0})).concat(cx.vencs.map(x=>({venc:x,data:x.k,criado:-0.5})));
  const porMes={};rk.forEach(k=>{if(k.startsWith(mesCal))lista.push({rend:{k,v:cx.rend[k],prev:!!cx.prev[k]},data:k,criado:-1});else{const mk=k.slice(0,7);(porMes[mk]=porMes[mk]||{k,v:0,n:0}).v+=cx.rend[k];porMes[mk].k=k;porMes[mk].n++}});
  corr.forEach(a=>{const mk=a.k.slice(0,7);if(mk===mesCal)return;(porMes[mk]=porMes[mk]||{k:a.k,v:0,n:0}).v+=a.v;if(a.k>porMes[mk].k)porMes[mk].k=a.k});
  Object.keys(porMes).forEach(mk=>lista.push({rmes:Object.assign({m:mk},porMes[mk]),data:porMes[mk].k,criado:-1}));
  lista.sort(sortG);
  const grupos={};lista.forEach(x=>{(grupos[String(x.data).slice(0,7)]=grupos[String(x.data).slice(0,7)]||[]).push(x)});
  const meses=Object.keys(grupos).sort().reverse();
  if(cxAbertos===null)cxAbertos=new Set(meses.slice(0,1));
  const anos=[...new Set(meses.map(mk=>mk.slice(0,4)))];
  if(cxAnos===null)cxAnos=new Set(anos.slice(0,1));
  const saldoFim={};cx.dias.forEach(p=>{saldoFim[ym(p.d)]=p.v});
  // totais de um período (prefixo "2026" ou "2026-10")
  const tot=pre=>({
    rend:rk.filter(k=>k.startsWith(pre)).reduce((s,k)=>s+cx.rend[k],0)+corr.filter(a=>a.k.startsWith(pre)).reduce((s,a)=>s+a.v,0),
    ent:S.caixa.filter(m=>m.tipo==='deposito'&&m.data.startsWith(pre)).reduce((s,m)=>s+(+m.valor||0),0),
    sai:-S.caixa.filter(m=>m.tipo==='resgate'&&m.data.startsWith(pre)).reduce((s,m)=>s+(+m.valor||0),0)});
  const detalhe=(saldo,t)=>[saldo!==undefined?`saldo ${money(saldo)}`:'',t.ent>0?`entrou ${money(t.ent)}`:'',t.sai>0?`saiu ${money(t.sai)}`:''].filter(Boolean).join(' · ');
  const rendTxt=v=>Math.abs(v)>=0.005?`${v>0?'+':'−'} ${money(Math.abs(v))}`:'';
  const SETA=svg('<path d="M6 9l6 6 6-6"/>',2.4);
  $('#cx-list').innerHTML=anos.length?anos.map(a=>{
    const abA=cxAnos.has(a),ta=tot(a),mesesA=meses.filter(mk=>mk.startsWith(a)),fimA=saldoFim[mesesA[0]];
    return `<button class="cx-ano${abA?' on':''}" data-cxa="${esc(a)}" aria-expanded="${abA}">
      <span style="min-width:0"><span class="n">${esc(a)}</span><span class="m">${esc(detalhe(fimA,ta))}</span></span>
      <span class="val num">${rendTxt(ta.rend)}</span>${SETA}</button>`+(abA?mesesA.map(mk=>{
      const it=grupos[mk],ab=cxAbertos.has(mk),t=tot(mk);
      const nome=mesLongo(mk).replace(/ \d{4}$/,'').replace(/^./,c=>c.toUpperCase());
      return `<button class="cx-mes${ab?' on':''}" data-cxm="${esc(mk)}" aria-expanded="${ab}">
        <span style="min-width:0"><span class="n">${esc(nome)}</span><span class="m">${esc(detalhe(saldoFim[mk],t))}</span></span>
        <span class="val num">${rendTxt(t.rend)}</span>${SETA}</button>`+(ab?it.map((x,i)=>x.m?movHTML(x.m,i,cx.anc[x.m.id],cx.resgImp[x.m.id]):x.venc?vencHTML(x.venc,i):rendHTML(x,i)).join(''):'')}).join(''):'')}).join('')
    :'<div class="empty"><strong>Nenhum movimento ainda</strong>Toque em "Atualizar" e digite quanto tem hoje na caixinha.</div>';
  const alvo=$('#cx-alvo');if(document.activeElement!==alvo)alvo.value=obj||'';
  const pctEl=$('#cx-pct');if(document.activeElement!==pctEl)pctEl.value=c.pctCdi||'';
  // texto do rendimento
  const u=ultimoCdi(),pc=+c.pctCdi||100;
  let txt='';
  if(!S.caixa.length)txt='';
  else if(!u)txt=cdiErro?'Não deu para buscar o CDI. O rendimento aparece quando a internet voltar.':'Buscando o CDI no Banco Central…';
  else if(saldo>0){
    const yH=cx.rend[hoje],ult=rk[rk.length-1];
    txt=yH!==undefined?`Hoje rendeu + ${money(yH)}${cx.prev[hoje]?' (previsto)':''}`:ult?`Último rendimento: + ${money(cx.rend[ult])} em ${diaCurto(parseD(ult))}`:'Começa a render no próximo dia útil';
  }
  $('#cx-rend').textContent=txt;
  $('#cx-liq-v').textContent=cx.imp!==null&&saldo>0?`Líquido ≈ ${money(Math.max(0,saldo-cx.imp))} se resgatar hoje`:'';
  let prox='';if(cx.lotes&&cx.lotes.length){const l=cx.lotes.map(l=>({l,v:ymd(addDays(parseD(l.dep),730))})).filter(x=>x.v>hoje).sort((a,b)=>a.v.localeCompare(b.v))[0];
    if(l)prox=` Próximo vencimento: ${diaCurto(parseD(l.v))}, com imposto de ≈ ${money(Math.max(0,l.l.g)*0.15)}.`}
  $('#cx-cdi-info').textContent=u?`${u.k?`CDI de ${diaCurto(parseD(u.k))}, do Banco Central`:'CDI digitado antes'}: ${(Math.pow(1+u.t,252)*100-100).toFixed(2).replace('.',',')}% ao ano. O total bruto rende ${pc}% disso todo dia útil.`+(cx.imp===null&&S.caixa.length?' Para ver o líquido, preencha o "Total líquido" no próximo acerto.':'')+(cx.lotes?` Impostos calculados depósito por depósito (${cx.lotes.length} depósitos).`+prox:''):'';
  if(!$('#cx-data').value)$('#cx-data').value=ymd(now);
  loadCdi();
}
/* ---------- gráfico da caixinha: Total (padrão) ou Mês ---------- */
let gModo='total',gMes=null,drawRaf=0,drawObs=null;
function niceTicks(lo,hi,n){
  const raw=((hi-lo)||Math.abs(hi)||1)/n,p=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/p;
  const st=(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p,out=[];
  for(let v=Math.floor(lo/st)*st;v<=Math.ceil(hi/st)*st+st/2;v+=st)out.push(Math.round(v*100)/100);
  return out}
const compacto=v=>Math.abs(v)>=1000?`${(v/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})} mil`:String(Math.round(v));
const MOV_COR={deposito:'var(--verde)',resgate:'var(--laranja)',ajuste:'var(--amarelo)'},MOV_NOME={deposito:'Entrada',resgate:'Resgate',ajuste:'Conferência'};
// Largura do desenho dos gráficos = largura real do quadro (no computador a coluna é mais larga), para o texto
// não crescer junto. No celular fica a largura de sempre.
const largGraf=(box,padrao)=>Math.round(Math.min(760,Math.max(padrao,(box.clientWidth||0)-28)));
function drawChart(cx){
  const box=$('#cx-chart'),dias=cx.dias;
  if(dias.length<2){box.innerHTML='<div class="empty" style="padding:8px">O gráfico aparece quando houver movimentos em dias diferentes.</div>';return}
  const meses=[...new Set(dias.map(p=>ym(p.d)))];
  if(!gMes||!meses.includes(gMes))gMes=meses[meses.length-1];
  const mes=gModo==='mes',pts=mes?dias.filter(p=>ym(p.d)===gMes):dias;
  const movDia={};S.caixa.forEach(m=>{(movDia[m.data]=movDia[m.data]||[]).push(m)});
  const W=largGraf(box,340),H=190,L=46,R=12,T=16,B=26;
  const fimMes=new Date(+gMes.slice(0,4),+gMes.slice(5,7),0);
  const t0=mes?+parseD(gMes+'-01'):+pts[0].d,t1=Math.max(mes?+fimMes:+pts[pts.length-1].d,t0+864e5);
  const vs=pts.map(p=>p.v);let lo=mes?Math.min(...vs):0,hi=Math.max(...vs,1);
  if(mes){const pad=Math.max((hi-lo)*0.15,1);lo=Math.max(0,lo-pad);hi+=pad}
  const tk=niceTicks(lo,hi,mes?3:4),y0=tk[0],y1=tk[tk.length-1];
  const x=t=>L+(t-t0)/(t1-t0)*(W-L-R),y=v=>T+(1-(v-y0)/((y1-y0)||1))*(H-T-B);
  // linha com no máximo o primeiro e o último ponto de cada pixel (o Total tem mais de mil dias)
  const lin=pts.filter((p,i)=>i===0||i===pts.length-1||Math.round(x(+p.d))!==Math.round(x(+pts[i-1].d))||Math.round(x(+p.d))!==Math.round(x(+pts[i+1].d)));
  const d=lin.map((p,i)=>(i?'L':'M')+x(+p.d).toFixed(1)+' '+y(p.v).toFixed(1)).join(' ');
  const last=pts[pts.length-1],lx=x(+last.d),ly=y(last.v);
  const grid=tk.map(v=>`<line class="gl" x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text x="${L-6}" y="${(y(v)+4).toFixed(1)}" text-anchor="end">${esc(compacto(v))}</text>`).join('');
  let xt=[];
  if(mes)xt=[1,10,20,fimMes.getDate()].map(n=>({t:+new Date(fimMes.getFullYear(),fimMes.getMonth(),n),l:String(n)}));
  else if(t1-t0>300*864e5){for(let a=new Date(t0).getFullYear()+1;a<=new Date(t1).getFullYear();a++)xt.push({t:+new Date(a,0,1),l:String(a),g:1})}
  else xt=[{t:t0,l:diaCurto(new Date(t0))},{t:t1,l:diaCurto(new Date(t1))}];
  const xl=xt.map((o,i)=>{const px=x(o.t),an=mes&&i===0?'start':mes&&i===xt.length-1?'end':'middle';
    return (o.g?`<line class="gl" x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="${T}" y2="${H-B}"/>`:'')+`<text x="${px.toFixed(1)}" y="${H-6}" text-anchor="${an}">${esc(o.l)}</text>`}).join('');
  let mk='';const tipos=new Set();
  if(mes)pts.forEach(p=>{const ms=movDia[ymd(p.d)]||[];ms.forEach((m,j)=>{tipos.add(m.tipo);
    mk+=`<circle cx="${(x(+p.d)+(j-(ms.length-1)/2)*8).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="5" fill="${MOV_COR[m.tipo]||MOV_COR.ajuste}" stroke="var(--surface)" stroke-width="2"/>`})});
  const nav=mes?`<div class="cx-gnav"><button data-gm="-1" aria-label="Mês anterior"${meses.indexOf(gMes)>0?'':' disabled'}>${svg('<path d="M15 5l-7 7 7 7"/>',2.5)}</button><span>${esc(mesLongo(gMes).replace(/^./,c=>c.toUpperCase()))}</span><button data-gm="1" aria-label="Próximo mês"${meses.indexOf(gMes)<meses.length-1?'':' disabled'}>${svg('<path d="M9 5l7 7-7 7"/>',2.5)}</button></div>`:'';
  const leg=mes&&tipos.size?`<div class="cx-leg">${['deposito','resgate','ajuste'].filter(t=>tipos.has(t)).map(t=>`<span><i style="background:${MOV_COR[t]}"></i>${MOV_NOME[t]}</span>`).join('')}</div>`:'';
  box.innerHTML=nav+`<svg class="plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo da caixinha ${mes?'em '+esc(mesLongo(gMes)):'desde o começo'}">${grid}${xl}
    <defs><clipPath id="cx-rev"><rect x="0" y="0" width="${reduce?W:L}" height="${H}"/></clipPath></defs>
    <g clip-path="url(#cx-rev)">
    <path class="ar" d="${d} L${lx.toFixed(1)} ${y(y0).toFixed(1)} L${x(+pts[0].d).toFixed(1)} ${y(y0).toFixed(1)}Z"/>
    <path class="ln" d="${d}"/>
    <circle class="dot" cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="5"/>${mk}
    <text class="end" x="${Math.min(lx,W-R).toFixed(1)}" y="${Math.max(T+8,ly-12).toFixed(1)}" text-anchor="end">${esc(money(last.v))}</text></g>
    <line class="hair" x1="0" x2="0" y1="${T}" y2="${H-B}"/><circle class="hdot" r="5" cx="0" cy="0"/></svg><div class="cx-tip" hidden><strong></strong><span></span></div>`+leg;
  box.querySelectorAll('[data-gm]').forEach(b=>b.onclick=()=>{const m=meses[meses.indexOf(gMes)+ +b.dataset.gm];if(m){gMes=m;drawChart(cxEstado())}});
  // toque/arraste: linha vertical no dia mais próximo + saldo e movimentos do dia
  const sv=box.querySelector('svg.plot'),hair=sv.querySelector('.hair'),hd=sv.querySelector('.hdot'),tip=box.querySelector('.cx-tip');
  const esconde=()=>{tip.hidden=true;hair.style.opacity=0;hd.style.opacity=0};
  // Revela o gráfico da esquerda para a direita (recorte que cresce). Desenhar a linha com
  // stroke-dasharray falha no Safari do iPhone em linhas com muitos degraus, como a do Total.
  // Só começa quando o gráfico está visível: ao abrir a caixinha ele fica abaixo da dobra.
  const rv=sv.querySelector('#cx-rev rect');cancelAnimationFrame(drawRaf);if(drawObs)drawObs.disconnect();
  if(!reduce){const dur=1400;
    const comeca=()=>{const ini=performance.now();
      const passo=t=>{const p=Math.min(1,Math.max(0,(t-ini)/dur)),e=1-Math.pow(1-p,3);rv.setAttribute('width',(L+(W-L)*e).toFixed(1));
        if(p<1)drawRaf=requestAnimationFrame(passo)};
      drawRaf=requestAnimationFrame(passo)};
    if('IntersectionObserver' in window){drawObs=new IntersectionObserver(es=>{if(es.some(x=>x.isIntersecting)){drawObs.disconnect();comeca()}},{threshold:0.6});drawObs.observe(sv)}
    else comeca()}
  sv.onpointerdown=e=>{try{sv.setPointerCapture(e.pointerId)}catch(err){}sv.onpointermove(e)};
  sv.onpointermove=e=>{
    const r=sv.getBoundingClientRect(),t=t0+((e.clientX-r.left)/r.width*W-L)/(W-L-R)*(t1-t0);
    let best=pts[0];for(const p of pts)if(Math.abs(+p.d-t)<Math.abs(+best.d-t))best=p;
    const px=x(+best.d),py=y(best.v);
    hair.setAttribute('x1',px);hair.setAttribute('x2',px);hd.setAttribute('cx',px);hd.setAttribute('cy',py);hair.style.opacity=1;hd.style.opacity=1;
    const ms=movDia[ymd(best.d)]||[];
    tip.querySelector('strong').textContent=money(best.v);
    tip.querySelector('span').textContent=diaCurto(best.d)+(mes?'':'/'+String(best.d.getFullYear()).slice(2))+ms.map(m=>` · ${MOV_NOME[m.tipo]||'Movimento'}${m.tipo==='ajuste'?'':' '+money(Math.abs(+m.valor||0))}`).join('');
    tip.hidden=false;const br=box.getBoundingClientRect(),tw=tip.offsetWidth;
    tip.style.left=Math.max(tw/2+4,Math.min(br.width-tw/2-4,r.left-br.left+px/W*r.width))+'px';tip.style.top=(r.top-br.top+2)+'px';
  };
  sv.onpointerleave=sv.onpointercancel=sv.onlostpointercapture=esconde;
}
function rendHTML(x,i){const r=x.rend,mm=x.rmes,v=r?r.v:mm.v;
  return `<div class="item" style="--i:${Math.min(i,12)}" data-kind="rend">
    <span class="ico" style="--c:var(--menta)">${svg('<path d="M4 17l5-5 4 4 7-7M14 9h6v6"/>',2.4)}</span>
    <span style="min-width:0"><div class="n">${r?'Rendimento':esc('Rendimento de '+mesCurto(mm.m))}</div><div class="m">${r?esc(diaCurto(parseD(r.k)))+' · CDI'+(r.prev?' previsto':''):`${mm.n} ${mm.n>1?'dias úteis':'dia útil'} · CDI`}</div></span>
    <span class="val num" style="color:var(--verde)">+ ${money(v)}</span></div>`}
function vencHTML(x,i){const d=parseD(x.dep);
  return `<div class="item" style="--i:${Math.min(i,12)}" data-kind="rend">
    <span class="ico" style="--c:var(--laranja)">${svg('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 9h6M9 13h4"/>',2.2)}</span>
    <span style="min-width:0"><div class="n">Imposto do vencimento</div><div class="m">${esc(diaCurto(parseD(x.k)))} · depósito de ${esc(diaCurto(d))}/${String(d.getFullYear()).slice(2)}</div></span>
    <span class="val num" style="color:var(--laranja)">− ${money(x.v)}</span></div>`}
function movHTML(m,i,anc,imp){let v=+m.valor||0;const t=m.tipo||'deposito',dia=diaCurto(parseD(m.data));
  let nome=m.nota||TIPO[t],meta=TIPO[t]+(t==='resgate'&&imp>=0.005?` · imposto ${money(imp)}`:''),valTxt='',cor='';
  // acerto depois de já haver saldo: mostra o saldo do banco; a diferença para a estimativa entra no rendimento do mês
  if(t==='ajuste'&&anc&&anc.antes>0.005){v=anc.saldo-anc.antes;nome=m.nota||'Saldo conferido';
    meta=Math.abs(v)<0.005?'bateu com o banco':`rendimento corrigido em ${v>0?'+':'−'} ${money(Math.abs(v))}`;valTxt=money(anc.saldo);cor='var(--ink)'}
  const pos=v>=0;
  const bg=t==='resgate'?'var(--laranja)':t==='ajuste'?'var(--amarelo)':'var(--verde)',fg=t==='ajuste'?'var(--on-color)':'var(--white)';
  const ic=t==='resgate'?'<path d="M12 5v14M6 13l6 6 6-6"/>':t==='ajuste'?'<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4"/>':'<path d="M12 19V5M6 11l6-6 6 6"/>';
  return `<div class="item" style="--i:${Math.min(i,12)}" data-id="${esc(m.id)}" data-kind="mov" role="button" tabindex="0">
    <span class="ico" style="--c:${bg}">${svg(ic,2.4)}</span>
    <span style="min-width:0"><div class="n">${esc(nome)}</div><div class="m">${esc(dia)} · ${esc(meta)}</div></span>
    <span class="val num" style="color:${cor||(pos?'var(--verde)':'var(--laranja)')}">${valTxt?esc(valTxt):`${pos?'+':'−'} ${money(Math.abs(v))}`}</span>
    ${openItem===m.id?`<div class="del-row"><button data-act="cancel">Manter</button><button class="danger" data-act="del">Apagar movimento</button></div>`:''}</div>`}
let cxTipo='deposito',cxAbertos=null,cxAnos=null;
$('#cx-gmodo').onclick=e=>{const b=e.target.closest('[data-g]');if(!b||b.dataset.g===gModo)return;gModo=b.dataset.g;
  $('#cx-gmodo .thumb').style.transform=`translateX(${gModo==='mes'?100:0}%)`;$$('#cx-gmodo button').forEach(x=>x.classList.toggle('on',x===b));drawChart(cxEstado())};
const CX_HINT={deposito:['Quanto você colocou na caixinha.','Valor (R$)'],resgate:['Quanto você tirou da caixinha. Isso diminui o que está guardado.','Valor (R$)'],ajuste:['Digite o Total bruto que aparece hoje no app do banco. O Total líquido é opcional: com ele, o app mostra quanto você receberia se resgatasse.','Total bruto (R$)']};
$('#cx-tipo').onclick=e=>{const b=e.target.closest('[data-t]');if(!b)return;cxTipo=b.dataset.t;const i=['deposito','resgate','ajuste'].indexOf(cxTipo);
  $('#cx-tipo .thumb').style.transform=`translateX(${i*100}%)`;$$('#cx-tipo button').forEach(x=>x.classList.toggle('on',x===b));
  $('#cx-hint').textContent=CX_HINT[cxTipo][0];$('#cx-valor-l').textContent=CX_HINT[cxTipo][1];$('#cx-liq-f').hidden=cxTipo!=='ajuste';$('#cx-gasto-f').hidden=cxTipo!=='resgate';$('#cx-gcat').hidden=cxTipo!=='resgate'||!$('#cx-gasto').checked;$('#cx-sheet-t').textContent=CX_TIT[cxTipo]};
$('#cx-ok').onclick=async()=>{
  const v=+$('#cx-valor').value,data=$('#cx-data').value||ymd(new Date()),nota=$('#cx-nota').value.trim();
  if(!(v>0)&&!(cxTipo==='ajuste'&&v>=0&&$('#cx-valor').value!=='')){toast('Digite um valor maior que zero.');return}
  let valor=v;
  if(cxTipo==='resgate')valor=-v;
  const comoGasto=cxTipo==='resgate'&&$('#cx-gasto').checked;
  if(comoGasto&&!cxCat){toast('Escolha a categoria da saída.');return}
  const liqTxt=$('#cx-liq').value,liq=+liqTxt;
  if(cxTipo==='ajuste'){
    if(liqTxt!==''&&!(liq>0&&liq<=v)){toast('O total líquido precisa ser maior que zero e até o total bruto.');return}
    if(liqTxt!==''){const cfg=JSON.parse(JSON.stringify(S.config));cfg.cxLiq={data,imp:round2(v-liq)};saveConfig(cfg)}
    if(Math.abs(v-simCaixa(parseD(data)).saldo)<0.005){$('#cx-valor').value='';$('#cx-liq').value='';closeSheet();toast(liqTxt!==''?'Bruto já estava igual. Líquido atualizado.':'O saldo já está igual.');return}
    valor=round2(v-somaMov(data))}
  $('#cx-valor').value='';$('#cx-nota').value='';$('#cx-liq').value='';closeSheet();
  await addMov({data,valor,tipo:cxTipo,mes:planMonth(parseD(data)),nota});
  if(cxTipo==='deposito'){confetti(90);toast(`${money(v)} guardados`)}
  else if(cxTipo==='resgate'){const j=$('.cx-card');j.classList.remove('shake');void j.offsetWidth;j.classList.add('shake');
    if(comoGasto){await addGasto({data,valor:v,cat:cxCat,fonte:'caixinha',desc:nota||'Resgate da caixinha'});toast(`Resgate de ${money(v)} registrado e lançado em ${catOf(cxCat).n}`)}
    else toast(`Resgate de ${money(v)} registrado`)}
  else toast(`Saldo conferido: ${money(v)}`);
};
let cxCat=null;
function drawCxCat(){$('#cx-gcat').innerHTML=CATS.map(c=>`<button type="button" class="cat-b${cxCat===c.k?' sel':''}" data-c="${c.k}" style="--c:${c.bg}" aria-pressed="${cxCat===c.k}"><i>${svg(ICON[c.k])}</i><span>${esc(c.n)}</span></button>`).join('')}
$('#cx-gcat').onclick=e=>{const b=e.target.closest('[data-c]');if(!b)return;cxCat=b.dataset.c;drawCxCat()};
$('#cx-gasto').onchange=e=>{$('#cx-gcat').hidden=!e.target.checked;if(e.target.checked)drawCxCat()};
$('#cx-alvo-ok').onclick=()=>{const cfg=JSON.parse(JSON.stringify(S.config));cfg.objetivo=+$('#cx-alvo').value||0;cfg.pctCdi=+$('#cx-pct').value||100;saveConfig(cfg);document.activeElement&&document.activeElement.blur();closeSheet();toast('Salvo')};
const CX_TIT={deposito:'Guardar na caixinha',resgate:'Resgatar da caixinha',ajuste:'Atualizar o saldo com o banco'};
function openCx(t){$('#cx-gasto').checked=false;cxCat=null;$(`#cx-tipo [data-t="${t}"]`).click();$('#cx-data').value=ymd(new Date());openPanel('#sheet-cx');setTimeout(()=>$('#cx-valor').focus(),380)}
$('#cx-acoes').onclick=e=>{const b=e.target.closest('[data-cx]');if(b)openCx(b.dataset.cx)};
$('#cx-cfg').onclick=()=>openPanel('#sheet-cxcfg');

/* ---------- ajustes ---------- */
// Lista no estilo dos Ajustes do iPhone. Cada mudança salva na hora (sem botão "Salvar ajustes").
let ajDirty=false;
const PLANO_CAMPOS={'c-nome':'nome','c-inicio':'inicio','c-sal':'salario','c-meta':'meta','c-vr':'vr','c-mob':'mob'};
const CHEV=svg('<path d="M9 5l7 7-7 7"/>',2.4).replace('<svg ','<svg class="chev" ');
function renderAjustes(){
  const c=S.config;if(!c)return;
  {const nf=c.fixos.filter(f=>f.inicio&&f.inicio<=mesDoDia(new Date())&&(!f.fim||f.fim>=mesDoDia(new Date()))).length;
   $('#plano-resumo').textContent=c.salario>0?`${money(c.salario)} · guardar ${money(c.meta)} · ${nf} fixo${nf===1?'':'s'}`:'Ainda não montado'}
  $('#c-pagto').value=c.pagto==='ultimo-util'?'ultimo-util':'';$('#c-semana').value=c.semana==='dom'?'dom':'';
  Object.entries(PLANO_CAMPOS).forEach(([id,k])=>{const el=document.getElementById(id);if(document.activeElement===el)return;
    el.value=el.classList.contains('moeda')?(+c[k]>0?money(c[k]):''):(c[k]??'')});
  // custos fixos
  const m=mesDoDia(new Date()),ativo=f=>f.inicio<=m&&(!f.fim||f.fim>=m);
  const tot=c.fixos.filter(ativo).reduce((s,f)=>s+(+f.valor||0),0);
  $('#fx-tot').textContent=c.fixos.length?`${money(tot)}/mês agora`:'';
  const per=f=>`${f.onde==='debito'?'Débito':'Crédito'} · ${mesCurto(f.inicio)}${f.fim?' até '+mesCurto(f.fim):', sem fim'}`;
  $('#fx-list').innerHTML=c.fixos.map((f,i)=>`<button class="row link-row${ativo(f)?'':' fora'}" data-fx="${i}"><span>${esc(f.nome||'Sem nome')}<small>${esc(per(f))}</small></span><b class="row-v num">${money(f.valor)}</b>${CHEV}</button>`).join('')
    +`<button class="row add-row" data-fx="novo"><span>${svg('<path d="M12 5v14M5 12h14"/>',2.4)}Adicionar custo fixo</span></button>`;
  // faturas com valor exato
  const ks=Object.keys(c.ajustes).sort();
  $('#aj-list').innerHTML=ks.map(k=>`<button class="row link-row" data-aj="${esc(k)}"><span>${esc(mesLongo(k))}</span><b class="row-v num">${money(c.ajustes[k])}</b>${CHEV}</button>`).join('')
    +`<button class="row add-row" data-aj="novo"><span>${svg('<path d="M12 5v14M5 12h14"/>',2.4)}Adicionar mês</span></button>`;
}
// valores em reais: mostra "R$ 1.641,00"; ao tocar vira "1641,00" para editar
const lerReais=t=>{t=String(t||'').replace(/[R$\s]/g,'');if(t.includes(','))t=t.replace(/\./g,'').replace(',','.');const v=parseFloat(t);return isFinite(v)?round2(v):0};
$$('#s-plano .moeda').forEach(el=>{
  el.addEventListener('focus',()=>{const v=S.config[PLANO_CAMPOS[el.id]];el.value=+v>0?String(round2(v)).replace('.',','):'';setTimeout(()=>el.select(),0)});
  el.addEventListener('blur',()=>setTimeout(renderAjustes,0))});
Object.entries(PLANO_CAMPOS).forEach(([id,k])=>document.getElementById(id).addEventListener('change',e=>{
  const cfg=JSON.parse(JSON.stringify(S.config)),v=e.target.value;
  if(k==='nome')cfg.nome=v.trim();else if(k==='inicio'){if(!isMonth(v))return;cfg.inicio=v}else cfg[k]=lerReais(v);
  if(JSON.stringify(cfg[k])===JSON.stringify(S.config[k]))return;
  saveConfig(cfg);toast('Salvo')}));
$('#c-pagto').addEventListener('change',e=>{const cfg=JSON.parse(JSON.stringify(S.config));
  if(e.target.value==='ultimo-util')cfg.pagto='ultimo-util';else delete cfg.pagto;
  mesSel=null;gMesRef=null;saveConfig(cfg);toast(cfg.pagto?'O mês agora começa no dia do salário':'O mês volta a começar na semana do 1º sábado')});
$('#c-semana').addEventListener('change',e=>{const cfg=JSON.parse(JSON.stringify(S.config));
  if(e.target.value==='dom')cfg.semana='dom';else delete cfg.semana;
  mesSel=null;gMesRef=null;gSem=null;saveConfig(cfg);toast(cfg.semana?'A semana agora começa no domingo':'A semana agora começa na segunda')});
// painel de custo fixo
let fxIdx=null,fxOnde='cartao',fxArm=false;
function setFxOnde(o){fxOnde=o;$('#fx-onde .thumb').style.transform=`translateX(${o==='debito'?100:0}%)`;$$('#fx-onde button').forEach(b=>b.classList.toggle('on',b.dataset.o===o))}
$('#fx-onde').onclick=e=>{const b=e.target.closest('[data-o]');if(b)setFxOnde(b.dataset.o)};
function openFx(i){const f=i===null?{nome:'',valor:'',onde:'cartao',inicio:mesSel||ym(new Date()),fim:'',chave:''}:S.config.fixos[i];
  fxIdx=i;fxArm=false;$('#fx-t').textContent=i===null?'Novo custo fixo':'Editar custo fixo';
  $('#fx-nome').value=f.nome||'';$('#fx-valor').value=f.valor===''?'':(+f.valor||'');setFxOnde(f.onde==='debito'?'debito':'cartao');
  $('#fx-ini').value=f.inicio||'';$('#fx-fim').value=f.fim||'';$('#fx-chave').value=f.chave||'';
  const d=$('#fx-del');d.hidden=i===null;d.textContent='Apagar custo fixo';d.classList.remove('armed');
  openPanel('#sheet-fx');if(i===null)setTimeout(()=>$('#fx-nome').focus(),380)}
$('#fx-list').onclick=e=>{const b=e.target.closest('[data-fx]');if(b)openFx(b.dataset.fx==='novo'?null:+b.dataset.fx)};
$('#fx-ok').onclick=()=>{const nome=$('#fx-nome').value.trim(),ini=$('#fx-ini').value,fim=$('#fx-fim').value;
  if(!nome){toast('Dê um nome para o custo.');return}if(!isMonth(ini)){toast('Escolha o mês de início.');return}
  if(fim&&fim<ini){toast('O fim precisa ser depois do início.');return}
  const cfg=JSON.parse(JSON.stringify(S.config)),velho=fxIdx===null?{id:uid()}:cfg.fixos[fxIdx];
  const f=Object.assign({},velho,{nome,valor:+$('#fx-valor').value||0,onde:fxOnde,inicio:ini,fim:fim||'',chave:$('#fx-chave').value.trim()});
  if(fxIdx===null)cfg.fixos.push(f);else cfg.fixos[fxIdx]=f;
  closeSheet();saveConfig(cfg);toast(fxIdx===null?'Custo fixo adicionado':'Custo fixo salvo')};
$('#fx-del').onclick=()=>{if(fxIdx===null)return;const b=$('#fx-del');
  if(!fxArm){fxArm=true;b.textContent='Toque de novo para apagar';b.classList.add('armed');return}
  const cfg=JSON.parse(JSON.stringify(S.config));cfg.fixos.splice(fxIdx,1);closeSheet();saveConfig(cfg);toast('Custo fixo apagado')};
// painel de fatura com valor exato
let ajMes=null,ajArm=false;
function openAj(k){ajMes=k;ajArm=false;let m=k||mesSel||ym(new Date());if(!k)while(S.config.ajustes[m]!==undefined)m=addMonths(m,1);
  $('#aj-mes').value=m;$('#aj-valor').value=k?S.config.ajustes[k]:'';const d=$('#aj-del');d.hidden=!k;d.textContent='Apagar';d.classList.remove('armed');
  openPanel('#sheet-aj');if(!k)setTimeout(()=>$('#aj-valor').focus(),380)}
$('#aj-list').onclick=e=>{const b=e.target.closest('[data-aj]');if(b)openAj(b.dataset.aj==='novo'?null:b.dataset.aj)};
$('#aj-ok').onclick=()=>{const m=$('#aj-mes').value,v=$('#aj-valor').value;
  if(!isMonth(m)){toast('Escolha o mês da fatura.');return}if(v===''||!(+v>=0)){toast('Digite o valor da fatura.');return}
  const cfg=JSON.parse(JSON.stringify(S.config));if(ajMes)delete cfg.ajustes[ajMes];cfg.ajustes[m]=round2(+v);
  closeSheet();saveConfig(cfg);toast('Fatura salva')};
$('#aj-del').onclick=()=>{if(!ajMes)return;const b=$('#aj-del');
  if(!ajArm){ajArm=true;b.textContent='Toque de novo para apagar';b.classList.add('armed');return}
  const cfg=JSON.parse(JSON.stringify(S.config));delete cfg.ajustes[ajMes];closeSheet();saveConfig(cfg);toast('Fatura apagada')};

/* ---------- CSV import ---------- */
function parseCSV(text){
  const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch}
    else if(ch==='"')q=true;else if(ch===','){row.push(cur);cur=''}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cur);rows.push(row);row=[];cur=''}
    else cur+=ch}
  if(cur||row.length){row.push(cur);rows.push(row)}
  return rows.filter(r=>r.some(x=>x.trim()));
}
const num=s=>{s=String(s).replace(/\s/g,'').replace(/R\$/,'');if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');return parseFloat(s)};
function guessCat(t){t=t.toLowerCase();
  if(/uber|\b99\b|99 tecnologia|cabify|posto|combust|ipiranga|shell|estacion/.test(t))return'transporte';
  if(/ifood|restaur|burguer|burger|lanch|padaria|mercado|supermerc|food|pizz|pasta|a[cç]a[ií]|sorvet|caf[eé]|churras|bistr/.test(t))return'comida';
  if(/drogaria|droga |drogasil|raia|pague menos|farm|clinic|vet|hospital|laborat/.test(t))return'saude';
  if(/spotify|netflix|apple|google|prog|stream|disney|hbo|prime video|youtube/.test(t))return'assinatura';
  if(/zig|\bbar\b|evento|ingresso|ticket|sympla|cinema|show/.test(t))return'lazer';
  return'compras'}
// extrato da conta: nomes em maiúsculas viram "Nome Próprio"; preposições ficam minúsculas
const nomeBonito=t=>String(t||'').toLowerCase().replace(/(^|\s)(\S)/g,(m,a,b)=>a+b.toUpperCase()).replace(/\s(De|Da|Do|Das|Dos|E)(?=\s)/g,m=>m.toLowerCase()).trim();
function lerExtrato(desc){const partes=desc.split(' - ').map(x=>x.trim()),tipo=partes[0]||'',nome=nomeBonito(partes[1]||tipo);
  const pessoa=/•••\.|\*\*\*\./.test(desc);   // CPF mascarado = Pix para pessoa
  if(/compra no d[eé]bito/i.test(tipo))return{desc:nome,cat:guessCat(nome)};
  if(/pix/i.test(tipo))return{desc:'Pix · '+nome,cat:pessoa?'outros':guessCat(nome),pessoa};
  if(/boleto/i.test(tipo))return{desc:'Boleto · '+nome,cat:guessCat(nome)};
  return{desc:nomeBonito(desc).slice(0,80),cat:guessCat(desc)}}
let pending=[];
/* Categorias pela IA (função ia, modo texto). Não trava a tela: a lista já aparece com o palpite do app e
   as categorias mudam quando a resposta chega, menos as que a pessoa já trocou à mão. Pix para pessoa e itens já
   importados não vão para a IA; números longos (CPF, conta) são tirados do texto antes de enviar. */
let iaVez=0;
async function categoriasIA(lista,selId){
  const vez=++iaVez,aviso=$('#imp-ia');
  const env=lista.map((p,i)=>({i,descricao:String(p.desc).replace(/[•*]{2,}[\d•*.\-]*/g,' ').replace(/\d{4,}/g,' ').replace(/\s+/g,' ').trim(),valor:p.valor,p}))
    .filter(x=>!x.p.semIA&&x.descricao).slice(0,300);
  if(!env.length){if(aviso)aviso.remove();return}
  try{const {data,error}=await sb.functions.invoke('ia',{body:{itens:env.map(({i,descricao,valor})=>({i,descricao,valor}))}});
    if(error)throw error;if(vez!==iaVez)return;
    let n=0;(Array.isArray(data&&data.categorias)?data.categorias:[]).forEach(c=>{const p=lista[c.i];
      if(!p||p.semIA||p.manual||!CAT_KEYS.includes(c.categoria))return;if(p.cat!==c.categoria)n++;p.cat=c.categoria;
      const s=$('#'+selId(c.i));if(s)s.value=c.categoria});
    if(aviso)aviso.textContent=n?`A IA revisou as categorias e trocou ${n===1?'1':n}. Confira antes de importar.`:'Categorias conferidas pela IA.'}
  catch(err){console.error(err);if(vez===iaVez&&aviso)aviso.textContent='A IA não respondeu agora. As categorias ficaram pelo palpite do app.'}}
const iaLinha='<p class="imp-ia" id="imp-ia"><span class="spin"></span>Ajustando categorias com IA…</p>';
/* Extrato da conta do Nubank (Data dd/mm/aaaa, Valor com sinal, Identificador único, Descrição).
   Saídas viram gastos da conta; Resgate/Aplicação RDB viram movimentos da caixinha; entradas e pagamento de
   fatura ficam de fora. Ida e volta com a mesma pessoa e o mesmo valor em até 3 dias vem desmarcada. */
function importarExtrato(rows,xD,xV,xI,xT){
  const lin=[];let entradas=0,faturas=0,erros=0;
  rows.forEach((r,n)=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec((r[xD]||'').trim()),v=num(r[xV]),t=(r[xT]||'').trim();
    if(!m||isNaN(v)||!t||Math.abs(v)>=1e7){erros++;return}
    const d=`${m[3]}-${m[2]}-${m[1]}`,cod=String((xI>=0&&r[xI])||`${d}-${t}-${v}`).trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').slice(0,100);
    lin.push({n,d,v,t,id:'ext-'+cod,quem:(t.split(' - ')[1]||'').toLowerCase().replace(/\s+/g,' ').trim()})});
  const gastos=[],caixa=[];
  lin.forEach(l=>{
    if(/resgate rdb|dinheiro resgatado|resgate.*caixinha/i.test(l.t)&&l.v>0){caixa.push({id:l.id,data:l.d,valor:l.v,tipo:'resgate',n:l.n});return}
    if(/aplica[cç][aã]o rdb|dinheiro guardado|aplica.*caixinha/i.test(l.t)&&l.v<0){caixa.push({id:l.id,data:l.d,valor:-l.v,tipo:'deposito'});return}
    if(l.v>0){entradas++;return}
    if(/pagamento (de|da) fatura/i.test(l.t)){faturas++;return}
    const x=lerExtrato(l.t),val=-l.v,dt=parseD(l.d);
    const volta=l.quem&&lin.some(o=>o.v>0&&Math.abs(o.v-val)<0.005&&o.quem===l.quem&&Math.abs(parseD(o.d)-dt)<=3*864e5);
    const ja=S.gastos.some(g=>g.id===l.id),parece=!ja&&S.gastos.some(g=>g.data===l.d&&Math.abs(+g.valor-val)<0.005&&(g.fonte==='conta'||g.fonte==='caixinha'));
    gastos.push({id:l.id,n:l.n,data:l.d,desc:x.desc,valor:val,cat:x.cat,fonte:'conta',semIA:ja||!!x.pessoa,on:!ja&&!parece&&!volta,nota:ja?'já importado':parece?'parece já lançado':volta?'ida e volta':''})});
  // Resgate seguido de gasto no mesmo dia: o gasto foi pago com a caixinha (fica fora do limite). O CSV não tem hora,
  // então vale o gasto mais perto do resgate no arquivo. Gasto maior que o resgate é dividido (caixinha + conta).
  caixa.filter(c=>c.tipo==='resgate').forEach(c=>{let resta=c.valor;
    gastos.filter(g=>g.on&&g.fonte==='conta'&&g.data===c.data).sort((a,b)=>Math.abs(a.n-c.n)-Math.abs(b.n-c.n)).forEach(g=>{
      if(resta<0.005)return;
      if(g.valor<=resta+0.005){g.fonte='caixinha';g.nota='pago com a caixinha';resta-=g.valor}
      else{const parte=round2(resta);gastos.push(Object.assign({},g,{id:g.id+'-cx',valor:parte,fonte:'caixinha',nota:'pago com a caixinha'}));
        g.valor=round2(g.valor-parte);g.nota='resto pela conta';resta=0}})});
  caixa.forEach(c=>{const ja=S.caixa.some(m=>m.id===c.id),parece=!ja&&S.caixa.some(m=>m.data===c.data&&m.tipo===c.tipo&&Math.abs(Math.abs(+m.valor)-c.valor)<0.005);
    c.on=!ja&&!parece;c.nota=ja?'já importado':parece?'parece já lançado':''});
  const box=$('#imp-box');box.hidden=false;setTimeout(()=>box.scrollIntoView({block:'center',behavior:reduce?'auto':'smooth'}),60);
  const fora=[entradas&&`${entradas} entrada(s)`,faturas&&`${faturas} pagamento(s) de fatura`,erros&&`${erros} linha(s) ilegível(is)`].filter(Boolean).join(', ');
  box.innerHTML=`<p>Extrato da conta: ${gastos.length} saída(s)${caixa.length?` e ${caixa.length} movimento(s) da caixinha`:''}.${fora?` Ficaram de fora: ${fora}.`:''} Desmarcados: já lançados e idas e voltas. Saída logo depois de um resgate da caixinha entra como paga com a caixinha.</p>`+(gastos.length?iaLinha:'')+
    (gastos.length?`<h3 class="imp-h">Saídas da conta</h3>`+gastos.map((p,i)=>`<div class="imp"><input type="checkbox" id="ix-${i}" ${p.on?'checked':''} aria-label="Importar ${esc(p.desc)}"><label for="ix-${i}" style="min-width:0"><b>${esc(p.desc)}</b><br><span style="color:var(--muted)">${esc(diaCurto(parseD(p.data)))} · ${money(p.valor)}${p.nota?' · '+esc(p.nota):''}</span></label><select id="ix-c-${i}" aria-label="Categoria">${CATS.map(c=>`<option value="${c.k}" ${c.k===p.cat?'selected':''}>${esc(c.n)}</option>`).join('')}</select></div>`).join(''):'')+
    (caixa.length?`<h3 class="imp-h">Caixinha</h3>`+caixa.map((c,i)=>`<div class="imp" style="grid-template-columns:auto minmax(0,1fr)"><input type="checkbox" id="ic-${i}" ${c.on?'checked':''} aria-label="Importar movimento da caixinha"><label for="ic-${i}" style="min-width:0"><b>${c.tipo==='resgate'?'Resgate da caixinha':'Guardado na caixinha'}</b><br><span style="color:var(--muted)">${esc(diaCurto(parseD(c.data)))} · ${money(c.valor)}${c.nota?' · '+esc(c.nota):''}</span></label></div>`).join(''):'')+
    (gastos.length||caixa.length?`<button class="primary" id="imp-ok" style="margin-top:10px">Importar selecionados</button>`:'');
  gastos.forEach((p,i)=>{$('#ix-'+i).onchange=e=>p.on=e.target.checked;$('#ix-c-'+i).onchange=e=>{p.cat=e.target.value;p.manual=true}});
  caixa.forEach((c,i)=>{$('#ic-'+i).onchange=e=>c.on=e.target.checked});
  const ok=$('#imp-ok');if(ok)ok.onclick=async()=>{const sg=gastos.filter(p=>p.on),sc=caixa.filter(c=>c.on);ok.disabled=true;
    try{const now=Date.now();
      await bulkUpsert('gastos',sg.map((p,i)=>toRowG(p.id,{data:p.data,desc:p.desc,valor:p.valor,cat:p.cat,fonte:p.fonte||'conta',criado:now+i})));
      await bulkUpsert('caixinha',sc.map((c,i)=>toRowM(c.id,{data:c.data,valor:c.tipo==='resgate'?-c.valor:c.valor,tipo:c.tipo,mes:planMonth(parseD(c.data)),nota:'Pelo extrato',criado:now+i})));
      await reload();box.hidden=true;toast(`${sg.length} saída(s)${sc.length?` e ${sc.length} movimento(s) da caixinha`:''} importado(s)`)}
    catch(err){console.error(err);ok.disabled=false;toast('Não deu para importar. Tente de novo.')}};
  categoriasIA(gastos,i=>'ix-c-'+i);
}
$('#csv').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;const text=await file.text();e.target.value='';
  const rows=parseCSV(text);const head=rows.shift()||[];const idx=k=>head.findIndex(h=>h.trim().toLowerCase()===k);
  const xD=idx('data'),xV=idx('valor'),xI=idx('identificador'),xT=head.findIndex(h=>/^descri/i.test(h.trim()));
  if(xD>=0&&xV>=0&&xT>=0){importarExtrato(rows,xD,xV,xI,xT);return}
  const iD=idx('date'),iT=idx('title'),iA=idx('amount');
  if(iD<0||iT<0||iA<0){toast('Esse arquivo não parece a fatura nem o extrato da conta do Nubank.');return}
  const keys=S.config.fixos.map(f=>(f.chave||'').toLowerCase().trim()).filter(Boolean);
  let skipped=0;pending=[];
  rows.forEach(r=>{const t=(r[iT]||'').trim(),v=num(r[iA]),d=(r[iD]||'').trim();
    if(!isDate(d)||isNaN(v)||v<=0||v>=1e7){skipped++;return}
    if(/pagamento|iof|juros|rotativo|valor pendente|parcela|estorno|cr[eé]dito de/i.test(t)){skipped++;return}
    if(keys.some(k=>t.toLowerCase().includes(k))){skipped++;return}
    const id='csv-'+(d+'-'+t+'-'+v).toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,120);
    const ja=S.gastos.some(g=>g.id===id);
    pending.push({id,data:d,desc:t,valor:v,cat:guessCat(t),fonte:'cartao',on:!ja,semIA:ja})});
  const box=$('#imp-box');box.hidden=false;setTimeout(()=>box.scrollIntoView({block:'center',behavior:reduce?'auto':'smooth'}),60);
  box.innerHTML=`<p>${pending.length} saída(s) nova(s) encontrada(s). ${skipped} linha(s) ignorada(s) por serem pagamento, juros, parcela ou fixo.</p>`+(pending.length?iaLinha:'')+
    pending.map((p,i)=>`<div class="imp"><input type="checkbox" id="imp-${i}" ${p.on?'checked':''} aria-label="Importar ${esc(p.desc)}"><label for="imp-${i}" style="min-width:0"><b>${esc(p.desc)}</b><br><span style="color:var(--muted)">${esc(diaCurto(parseD(p.data)))} · ${money(p.valor)}${S.gastos.some(g=>g.id===p.id)?' · já importado':''}</span></label><select id="imp-c-${i}" aria-label="Categoria">${CATS.map(c=>`<option value="${c.k}" ${c.k===p.cat?'selected':''}>${esc(c.n)}</option>`).join('')}</select></div>`).join('')+
    (pending.length?`<button class="primary" id="imp-ok" style="margin-top:10px">Importar selecionados</button>`:'');
  pending.forEach((p,i)=>{$('#imp-'+i).onchange=e=>p.on=e.target.checked;$('#imp-c-'+i).onchange=e=>{p.cat=e.target.value;p.manual=true}});
  const ok=$('#imp-ok');if(ok)ok.onclick=async()=>{const sel=pending.filter(p=>p.on);ok.disabled=true;
    try{const now=Date.now();const items=sel.map((p,i)=>({id:p.id,data:p.data,desc:p.desc,valor:p.valor,cat:p.cat,fonte:'cartao',criado:now+i}));
      await bulkUpsert('gastos',items.map(g=>toRowG(g.id,g)));await reload();
      box.hidden=true;toast(`${sel.length} saída(s) importada(s)`)}
    catch(err){console.error(err);ok.disabled=false;toast('Não deu para importar. Tente de novo.')}};
  categoriasIA(pending,i=>'imp-c-'+i);
};

/* ---------- list interactions ---------- */
document.addEventListener('click',e=>{
  const go=e.target.closest('[data-go]');if(go&&!e.target.closest('#save-btn')){switchTab(+go.dataset.go);return}
  const ca=e.target.closest('[data-cxa]');if(ca){const k=ca.dataset.cxa;cxAnos.has(k)?cxAnos.delete(k):cxAnos.add(k);openItem=null;renderCaixa();return}
  const cm=e.target.closest('[data-cxm]');if(cm){const k=cm.dataset.cxm;cxAbertos.has(k)?cxAbertos.delete(k):cxAbertos.add(k);openItem=null;renderCaixa();return}
  const it=e.target.closest('.item');if(!it||it.dataset.kind==='rend')return;
  if(it.dataset.kind!=='mov'){const g=S.gastos.find(x=>x.id===it.dataset.id);if(g)openSheet(g);return}
  const act=e.target.closest('[data-act]');
  if(act){if(act.dataset.act==='del'){const id=it.dataset.id;openItem=null;if(it.dataset.kind==='mov'){const v=S.caixa.find(x=>x.id===id),a=v&&Object.assign({},v);delMov(id);toast('Movimento apagado',a?()=>{addMov(a,id);toast('Movimento de volta')}:null)}
      else{const v=S.gastos.find(x=>x.id===id),a=v&&Object.assign({},v);delGasto(id);toast('Saída apagada',a?()=>{addGasto(a,id);toast('Saída de volta')}:null)}}else{openItem=null;render()}return}
  openItem=openItem===it.dataset.id?null:it.dataset.id;render();
});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList&&(e.target.classList.contains('item')||e.target.classList.contains('tile'))&&e.target.getAttribute('role')==='button'){e.preventDefault();e.target.click()}});

/* ---------- tabs ---------- */
function moveBlob(){}
/* Cada tela e cada painel entra no histórico do navegador: o voltar do Android, o botão do navegador e o arrasto
   da borda esquerda (no app da Tela de Início do iPhone) fecham o painel aberto ou voltam à tela anterior.
   history.state = {leve:1, tela, n (quantos passos acima do Início), painel?}. Trocar entre Extrato e Caixinha
   (e entre as três partes do Extrato) substitui o passo em vez de empilhar, como nos apps com abas. */
// grupo de cada tela: as três do Extrato (Lançamentos 2, Plano 1, Resumo 5) acendem a aba Extrato
const GRUPO={0:'inicio',1:'extrato',2:'extrato',5:'extrato',4:'caixa',3:'ajustes',6:'ajustes'},ABA_DO={1:2,5:2,6:3};
const principal=i=>GRUPO[i]==='extrato'||GRUPO[i]==='caixa';let navPend=false;
const hs=()=>history.state&&history.state.leve?history.state:{leve:1,tela:tab,n:0};
function switchTab(i){
  if(i===tab&&!hs().painel)return mostrarTela(i);
  const st=hs();
  if(i===0){const n=st.n||0;if(n>0){navPend=true;history.go(-n);return}history.replaceState({leve:1,tela:0,n:0},'');return mostrarTela(0)}
  if(st.painel){history.replaceState({leve:1,tela:i,n:st.n},'');return mostrarTela(i)}
  if(principal(i)&&principal(tab))history.replaceState({leve:1,tela:i,n:st.n||1},'');
  else history.pushState({leve:1,tela:i,n:(st.n||0)+1},'');
  mostrarTela(i);
}
window.addEventListener('popstate',e=>{navPend=false;const st=e.state&&e.state.leve?e.state:{leve:1,tela:0,n:0};
  if(!st.painel&&$('.sheet.on'))fechaPaineis();
  if(st.painel&&!$('.sheet.on')){history.back();return}
  if(st.tela!==tab)mostrarTela(st.tela)});
// arrastar da borda esquerda volta (só no app da Tela de Início do iPhone; no Safari o próprio navegador já faz)
if(navigator.standalone){let x0=null,y0=0;
  document.addEventListener('touchstart',e=>{const t=e.touches[0];x0=t.clientX<22&&(hs().n>0||hs().painel)?t.clientX:null;y0=t.clientY},{passive:true});
  document.addEventListener('touchend',e=>{if(x0===null)return;const t=e.changedTouches[0];if(t.clientX-x0>70&&Math.abs(t.clientY-y0)<60)history.back();x0=null},{passive:true})}
function mostrarTela(i){
  const dir=i>tab?1:-1;tab=i;
  $$('.screen').forEach(s=>{const on=+s.dataset.tab===i;s.hidden=!on;s.classList.remove('enter');if(on){s.style.setProperty('--dir',dir);void s.offsetWidth;s.classList.add('enter')}});
  const aba=ABA_DO[i]??i;$$('.tab').forEach(t=>t.classList.toggle('on',+t.dataset.go===aba));moveBlob();
  $$('.subnav button').forEach(b=>{const on=+b.dataset.go===i;b.classList.toggle('on',on);b.setAttribute('aria-current',on?'page':'false')});
  if(i===1&&S.config)renderMes();if(i===2&&S.config)renderGastos();if(i===4&&S.config)renderCaixa();if((i===3||i===6)&&S.config&&!ajDirty)renderAjustes();if(i===3){drawAtalho();drawCanais()}else{$('#at-box').hidden=true;$('#at-box').innerHTML='';fechaCanais()}if(i===5&&S.config)renderResumo();
  drawHead();window.scrollTo({top:0,behavior:reduce?'auto':'smooth'});
}
// Mudou bastante a largura da janela (computador): redesenha os gráficos da tela aberta
let largJan=innerWidth,tRes=0;
window.addEventListener('resize',()=>{clearTimeout(tRes);tRes=setTimeout(()=>{if(Math.abs(innerWidth-largJan)<40)return;largJan=innerWidth;
  if(!S.config)return;if(tab===4)drawChart(cxEstado());if(tab===5)renderResumo()},250)});
// atalhos do Início
$('#quick').onclick=e=>{const b=e.target.closest('[data-q]');if(!b)return;const q=b.dataset.q;
  if(q==='lancar')openSheet();
  else if(q==='foto')abrirFoto();
  else if(q==='guardar'){switchTab(4);setTimeout(()=>openCx('deposito'),250)}
  else if(q==='fatura'){$('#csv').click();switchTab(3)}};
$('#m-prev').onclick=()=>{mesSel=addMonths(mesSel,-1);renderMes()};
$('#m-next').onclick=()=>{mesSel=addMonths(mesSel,1);renderMes()};

/* ---------- cartão do topo ---------- */
const hero=$('#hero');

/* ---------- sheet ---------- */
let cents=0,cat=null,fonte='conta';
const KEYS=['1','2','3','4','5','6','7','8','9','00','0','del'];
$('#keys').innerHTML=KEYS.map(k=>`<button data-k="${k}" aria-label="${k==='del'?'Apagar dígito':k}">${k==='del'?svg('<path d="M9 6h11v12H9l-5-6z"/><path d="M13 10l4 4M17 10l-4 4"/>'):k}</button>`).join('');
function drawAmt(){const el=$('#amt');el.textContent=money(cents/100);el.classList.toggle('zero',cents===0);el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');$('#l-ok').disabled=!(cents>0&&cat)}
function key(k){if(k==='del')cents=Math.floor(cents/10);else if(cents<1e8)cents=Math.min(99999999,cents*(k==='00'?100:10)+(k==='00'?0:+k));drawAmt()}
$('#keys').onclick=e=>{const b=e.target.closest('[data-k]');if(b)key(b.dataset.k)};
function setFonte(f){fonte=f;const i=['conta','cartao','vr','mob'].indexOf(f);$('#thumb').style.opacity=i<0?0:1;if(i>=0)$('#thumb').style.transform=`translateX(${i*100}%)`;$$('#fonte button').forEach(b=>b.classList.toggle('on',b.dataset.f===f))}
$('#fonte').onclick=e=>{const b=e.target.closest('[data-f]');if(b)setFonte(b.dataset.f)};
function drawPills(){
  $('#pills').innerHTML=CATS.map(c=>`<button class="cat-b${cat===c.k?' sel':''}" data-c="${c.k}" style="--c:${c.bg}" aria-pressed="${cat===c.k}"><i>${svg(ICON[c.k])}</i><span>${esc(c.n)}</span></button>`).join('');
}
$('#pills').onclick=e=>{const b=e.target.closest('[data-c]');if(!b)return;cat=b.dataset.c;
  $$('#pills .cat-b').forEach(p=>{const on=p.dataset.c===cat;p.classList.toggle('sel',on);p.setAttribute('aria-pressed',on)});
  if(cat==='comida'&&fonte==='conta')setFonte('vr');if(cat==='transporte'&&fonte==='conta')setFonte('mob');$('#l-ok').disabled=!(cents>0&&cat)};
// data: atalhos Hoje / Ontem ou um dia qualquer
function marcaDia(){const v=$('#l-data').value,h=ymd(new Date()),o=ymd(addDays(new Date(),-1));
  $$('#l-dias [data-d]').forEach(b=>b.classList.toggle('on',(b.dataset.d==='0'&&v===h)||(b.dataset.d==='1'&&v===o)));
  $('#l-dias .dpick').classList.toggle('on',!!v&&v!==h&&v!==o)}
$('#l-dias').onclick=e=>{const b=e.target.closest('[data-d]');if(!b)return;$('#l-data').value=ymd(addDays(new Date(),-b.dataset.d));marcaDia()};
$('#l-data').addEventListener('change',marcaDia);
let editId=null,delArm=false;
function openSheet(g){if(!S.config){toast('Configure o plano em Ajustes primeiro.');return}
  editId=g&&g.id?g.id:null;delArm=false;
  cents=g?Math.round((+g.valor||0)*100):0;cat=g?catOf(g.cat).k:null;setFonte(g?g.fonte||'conta':'conta');
  $('#l-desc').value=g?g.desc||'':'';$('#l-data').value=g?g.data:ymd(new Date());marcaDia();drawAmt();drawPills();$('#l-tit').textContent=g?'Editar saída':'Nova saída';
  $('#l-ok').textContent=editId?'Salvar alterações':'Lançar';const del=$('#l-del');del.hidden=!editId;del.textContent='Apagar saída';del.classList.remove('armed');
  $('#sheet').setAttribute('aria-label',editId?'Editar saída':'Nova saída');
  openPanel('#sheet');}
$('#l-del').onclick=()=>{if(!editId)return;
  const id=editId,velho=S.gastos.find(x=>x.id===id);closeSheet();delGasto(id);
  toast('Saída apagada',velho?()=>{addGasto(Object.assign({},velho),id);toast('Saída de volta')}:null)};
function openPanel(sel){$('#scrim').classList.add('on');$(sel).classList.add('on');
  const st=hs();if(st.painel)history.replaceState(st,'');else history.pushState({leve:1,tela:tab,n:(st.n||0)+1,painel:1},'')}
function fechaPaineis(){$('#scrim').classList.remove('on');$$('.sheet.on').forEach(x=>x.classList.remove('on'))}
// fecha e tira o painel do histórico; se outro painel abrir logo em seguida, ele aproveita o mesmo passo
function closeSheet(){fechaPaineis();setTimeout(()=>{if(!navPend&&!$('.sheet.on')&&hs().painel){navPend=true;history.back()}},0)}
$('#g-add').onclick=()=>openSheet();$('#scrim').onclick=closeSheet;
document.addEventListener('keydown',e=>{if(!$('#sheet').classList.contains('on'))return;if(e.target.tagName==='INPUT')return;
  if(/^[0-9]$/.test(e.key))key(e.key);else if(e.key==='Backspace')key('del');else if(e.key==='Escape')closeSheet();else if(e.key==='Enter'&&!$('#l-ok').disabled)$('#l-ok').click()});
// swipe down to close
$$('.sheet').forEach(s=>{let y0=null;s.addEventListener('touchstart',e=>{if(e.target.closest('.grab,.amount,.sheet-t'))y0=e.touches[0].clientY},{passive:true});
  s.addEventListener('touchmove',e=>{if(y0===null)return;const dy=Math.max(0,e.touches[0].clientY-y0);s.style.transition='none';s.style.transform=`translateY(${dy}px)`},{passive:true});
  s.addEventListener('touchend',e=>{if(y0===null)return;const dy=e.changedTouches[0].clientY-y0;s.style.transition='';s.style.transform='';y0=null;if(dy>90)closeSheet()})});
$('#l-ok').onclick=async()=>{
  const g={data:$('#l-data').value||ymd(new Date()),valor:cents/100,cat,fonte,desc:$('#l-desc').value.trim()};
  if(editId){const id=editId,velho=S.gastos.find(x=>x.id===id),antes=velho&&Object.assign({},velho);if(velho)g.criado=velho.criado;closeSheet();await addGasto(g,id);
    toast('Saída atualizada',antes?()=>{addGasto(antes,id);toast('Alteração desfeita')}:null);return}
  closeSheet();if(tab!==0)switchTab(0);
  const novoId=uid();await addGasto(g,novoId);
  const now=new Date(),m=mesDoDia(now),bl=blocoDe(now);
  if(S.config&&m>=S.config.inicio&&conta(g)){const left=limBloco(plano(m),bl)-gastoEntre(bl.ini,bl.fim);if(left<0){hero.classList.remove('shake');void hero.offsetWidth;hero.classList.add('shake')}}
  toast(`Saída registrada: ${money(g.valor)} em ${catOf(g.cat).n}${FORA.includes(g.fonte)?' ('+FONTE[g.fonte]+')':''}`,()=>{delGasto(novoId);toast('Saída desfeita')});
};

/* ---------- foto vira gasto (Edge Function ia + Gemini) ---------- */
// A foto é reduzida no celular (lado maior 1600 px, JPEG) e vai para a função do Supabase, que guarda a chave
// do Gemini. Com um gasto, abre o painel de lançar preenchido; com vários, mostra a lista para escolher.
function abrirFoto(){const i=$('#foto-in');i.value='';i.click()}
$('#l-foto').onclick=()=>{closeSheet();setTimeout(abrirFoto,50)};
async function reduzirFoto(file){const url=URL.createObjectURL(file);
  try{const img=await new Promise((ok,nao)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=()=>nao(new Error('imagem'));i.src=url});
    const k=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(img.naturalWidth*k));c.height=Math.max(1,Math.round(img.naturalHeight*k));
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.85).split(',')[1]}
  finally{URL.revokeObjectURL(url)}}
function fotoMsg(t,botao,origem){$('#foto-box').innerHTML=`<p class="sheet-p" style="text-align:center">${esc(t)}</p>`+(botao?`<button class="ghost" id="foto-outra">${origem==='voz'?'Tentar de novo':'Tentar outra foto'}</button>`:'');
  const b=$('#foto-outra');if(b)b.onclick=()=>{closeSheet();if(origem==='voz')abrirVoz();else setTimeout(abrirFoto,50)}}
// Gastos lidos pela IA (foto ou frase): um abre o painel de lançar preenchido; vários, a lista para conferir.
function mostrarLidos(lidos,origem){
  const gastos=lidos.filter(g=>+g.valor>0&&isDate(g.data)).map(g=>({data:g.data,valor:round2(g.valor),cat:CAT_KEYS.includes(g.categoria)?g.categoria:'outros',fonte:['conta','cartao','vr','mob'].includes(g.fonte)?g.fonte:'conta',desc:String(g.descricao||'').slice(0,80)}));
  if(!gastos.length){fotoMsg(origem==='voz'?'Não achei uma saída com valor nessa frase. Diga o valor e o que foi, ex.: almoço 32 no vale-refeição.':'Não encontrei nenhuma saída nessa imagem.',true,origem);return}
  if(gastos.length===1){closeSheet();setTimeout(()=>{openSheet(gastos[0]);toast('Confira os dados e toque em Lançar')},380);return}
  gastos.forEach(g=>{g.parece=origem!=='voz'&&S.gastos.some(x=>x.data===g.data&&Math.abs(+x.valor-g.valor)<0.005);g.on=!g.parece});
  const desenha=()=>{const n=gastos.filter(g=>g.on).length;
    $('#foto-box').innerHTML=`<p class="sheet-p">${gastos.length} saídas encontradas. Confira as categorias e desmarque o que não for lançar.</p>`+
      gastos.map((g,i)=>`<div class="imp"><input type="checkbox" id="fg-${i}" ${g.on?'checked':''} aria-label="Lançar ${esc(g.desc)}"><label for="fg-${i}" style="min-width:0"><b>${esc(g.desc||catOf(g.cat).n)}</b><br><span style="color:var(--muted)">${esc(diaCurto(parseD(g.data)))} · ${money(g.valor)} · ${esc(FONTE[g.fonte])}${g.parece?' · parece já lançado':''}</span></label><select id="fg-c-${i}" aria-label="Categoria">${CATS.map(c=>`<option value="${c.k}" ${c.k===g.cat?'selected':''}>${esc(c.n)}</option>`).join('')}</select></div>`).join('')+
      `<button class="primary" id="foto-ok" ${n?'':'disabled'} style="margin-top:10px">Registrar ${n} saída${n===1?'':'s'}</button>`;
    gastos.forEach((g,i)=>{$('#fg-'+i).onchange=e=>{g.on=e.target.checked;desenha()};$('#fg-c-'+i).onchange=e=>{g.cat=e.target.value}});
    $('#foto-ok').onclick=async()=>{const sel=gastos.filter(g=>g.on);if(!sel.length)return;$('#foto-ok').disabled=true;
      try{const now=Date.now(),ids=sel.map(()=>uid());await bulkUpsert('gastos',sel.map((g,i)=>toRowG(ids[i],Object.assign({},g,{criado:now+i}))));await reload();avisarTelegram();closeSheet();
        toast(sel.length===1?'Saída registrada':`${sel.length} saídas registradas`,()=>{ids.forEach(id=>delGasto(id));toast(sel.length===1?'Saída desfeita':'Saídas desfeitas')})}
      catch(err){console.error(err);$('#foto-ok').disabled=false;toast('Não deu para lançar. Tente de novo.')}}};
  desenha()}
async function lerComIA(body,origem){
  $('#sheet-foto .sheet-t').textContent=origem==='voz'?'Saídas da frase':'Saídas da foto';
  openPanel('#sheet-foto');$('#foto-box').innerHTML=`<div class="foto-lendo"><span class="spin"></span>${origem==='voz'?'Entendendo a frase…':'Lendo a imagem…'}</div>`;
  try{const {data,error}=await sb.functions.invoke('ia',{body:Object.assign({hoje:ymd(new Date())},body)});
    if(error){let m='';const st=error.context&&error.context.status;try{m=(await error.context.json()).erro||''}catch(err){}
      throw new Error(m||(st===404?'A leitura com IA ainda não foi ativada no Supabase.':'Não deu para falar com a IA. Confira a internet e tente de novo.'))}
    mostrarLidos(Array.isArray(data&&data.gastos)?data.gastos:[],origem)}
  catch(err){console.error(err);fotoMsg(err&&err.message&&!/^imagem$/.test(err.message)?err.message:'Não deu para abrir essa imagem.',true,origem)}}
$('#foto-in').onchange=async e=>{const f=e.target.files[0];if(!f)return;
  if(!S.config){toast('Configure o plano em Ajustes primeiro.');return}
  let imagem;try{imagem=await reduzirFoto(f)}catch(err){openPanel('#sheet-foto');fotoMsg('Não deu para abrir essa imagem.',true,'foto');return}
  lerComIA({imagem,tipo:'image/jpeg'},'foto')};
// Falar: o ditado do teclado do iPhone vira texto (no aparelho) e a IA entende valor, o que foi, fonte e data.
function abrirVoz(){if(!S.config){toast('Configure o plano em Ajustes primeiro.');return}
  fechaPaineis();openPanel('#sheet-voz');const t=$('#voz-txt');t.value='';t.focus()}
$('#l-voz').onclick=abrirVoz;
$('#voz-ok').onclick=()=>{const frase=$('#voz-txt').value.trim();if(!frase){toast('Diga ou escreva o que gastou, ex.: almoço 32 no vale-refeição.');$('#voz-txt').focus();return}
  $('#voz-txt').blur();closeSheet();setTimeout(()=>lerComIA({frase},'voz'),300)};

/* ---------- resumo (mês ou semana) com IA ----------
   O app calcula todos os números (exatos) e monta uma lista de "fatos" com peso em reais. A IA (função ia,
   modo resumo) só escolhe os 3–4 mais relevantes para o objetivo e escreve; se falhar, o app mostra os fatos de
   maior peso. Só entra o que sai do limite (sem VR, mobilidade e caixinha). Cache por período em localStorage. */
let rPer='mes',rMes=null,rSem=null,rVez=0;
const R_KEY='leve-resumo-v1';
const SPARK='<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>';
function rCache(){try{return JSON.parse(localStorage.getItem(R_KEY)||'{}')||{}}catch(e){return{}}}
function rCacheSet(k,v){try{const c=rCache();c[k]=v;const ks=Object.keys(c).sort((a,b)=>(c[b].t||0)-(c[a].t||0));ks.slice(12).forEach(x=>delete c[x]);localStorage.setItem(R_KEY,JSON.stringify(c))}catch(e){}}
// nome do estabelecimento para agrupar: tira prefixo de adquirente (IFD*, DL*…), números e cidade em maiúsculas no fim
// Pix: só vira "Pix para pessoas" quando a categoria é Outros (é assim que a importação do extrato marca Pix para
// CPF); Pix para loja ou posto aparece com o nome de quem recebeu.
function rNome(g){let t=String(g.desc||catOf(g.cat).n).trim();
  if(/^pix\b/i.test(t)){if(g.cat==='outros')return{k:'pix-pessoa',n:'Pix para pessoas'};t=t.replace(/^pix\s*[·:\-]?\s*/i,'')||'Pix'}
  t=t.replace(/^[A-Za-z]{1,4}\s?\*\s?/,'').replace(/\d+/g,' ').replace(/\s+(sao paulo|rio de janeiro|sp|rj|br)\b.*$/i,'').replace(/\s+/g,' ').trim();
  return{k:t.toLowerCase(),n:nomeBonito(t).slice(0,40)||'Sem descrição'}}
function rJanela(){const c=S.config,now=new Date(),hoje=dia0(now);
  if(rPer==='mes'){if(!rMes)rMes=planMonth(now);const m=rMes,pr=periodo(m);
    return{tipo:'mes',key:'mes:'+m,ini:pr.ini,fim:pr.fim,m,nome:mesLongo(m).replace(/^./,x=>x.toUpperCase()),lim:m>=c.inicio&&c.salario>0?plano(m).livre:null,
      ant:[1,2,3].map(i=>periodo(addMonths(m,-i))),antN:'3 meses'}}
  if(!rSem)rSem=inicioSemana(now);const ini=rSem,fim=addDays(ini,6);let lim=null;
  if(c.salario>0){let t=0,n=0;for(let i=0;i<7;i++){const d=addDays(ini,i),m=mesDoDia(d);if(m>=c.inicio){const b=blocoDe(d);t+=limBloco(plano(m),b)/b.dias;n++}}if(n)lim=t}
  const nome=+ini===+inicioSemana(now)?'Esta semana':+ini===+addDays(inicioSemana(now),-7)?'Semana passada':`Semana de ${diaCurto(ini)}`;
  return{tipo:'semana',key:'sem:'+ymd(ini),ini,fim,nome,lim,ant:[1,2,3,4].map(i=>({ini:addDays(ini,-7*i),fim:addDays(fim,-7*i)})),antN:'4 semanas'}}
const rGastos=(a,b)=>{const ka=ymd(a),kb=ymd(b);return S.gastos.filter(g=>conta(g)&&g.data>=ka&&g.data<=kb)};
const soma=l=>l.reduce((s,g)=>s+(+g.valor||0),0);
function resumoDados(){
  const c=S.config,J=rJanela(),hoje=dia0(new Date()),N=Math.round((J.fim-J.ini)/864e5)+1;
  const k=hoje<J.ini?0:hoje>J.fim?N:Math.round((hoje-J.ini)/864e5)+1,aberto=k>0&&k<N;
  const atual=k?rGastos(J.ini,addDays(J.ini,k-1)):[],G=soma(atual),L=J.lim;
  // janelas anteriores no mesmo ponto (mesmo número de dias desde o início), só depois do primeiro gasto registrado
  // (antes disso não há dado; depois, uma janela sem gasto conta como zero)
  const prim=S.gastos.reduce((m,g)=>!m||g.data<m?g.data:m,'');
  const ants=prim?J.ant.filter(w=>ymd(w.fim)>=prim).map(w=>{const n=Math.round((w.fim-w.ini)/864e5)+1;return rGastos(w.ini,addDays(w.ini,Math.min(k,n)-1))}):[];
  const media=f=>ants.length?ants.reduce((s,l)=>s+f(l),0)/ants.length:null;
  const proj=aberto?G/k*N:G;
  const fatos=[];const F=(id,tipo,peso,titulo,texto)=>fatos.push({id,tipo,peso,titulo,texto});
  const quando=J.tipo==='mes'?'o mês':'a semana',livreN=J.tipo==='mes'?'do livre':'do limite da semana',pt=J.tipo==='mes'?`dos últimos ${J.antN}`:`das últimas ${J.antN}`;
  // 0) livre do mês já acabou: as semanas restantes têm limite zero; diz isso em vez de "acima do limite de R$ 0,00"
  let esgotado=null;
  if(J.tipo==='semana'&&L!==null&&L<0.005){const m=mesDoDia(hoje>=J.ini&&hoje<=J.fim?hoje:J.ini);
    if(m>=c.inicio){const resto=plano(m).livre-gastoMes(m);if(resto<0)esgotado={m,ex:-resto}}}
  if(esgotado){F('ritmo','alerta',esgotado.ex+500,'O livre do mês acabou',`O livre de ${mesCurto(esgotado.m)} já acabou: o mês está ${money(esgotado.ex)} acima. Nesta semana saíram ${money(G)} do limite, e cada saída nova aumenta essa diferença.`)}
  // 1) ritmo contra o livre
  if(L!==null&&k&&!esgotado){
    if(aberto){if(proj>L+1)F('ritmo','alerta',(proj-L)+L*0.2,J.tipo==='mes'?'Ritmo acima do livre':'Ritmo acima do limite',`No ritmo atual, ${quando} fecha em ${money(proj)}: ${money(proj-L)} acima ${livreN} de ${money(L)}.`);
      else F('ritmo','positivo',(L-proj)*0.6,'Dentro do ritmo',`No ritmo atual, ${quando} fecha em ${money(proj)} e sobram cerca de ${money(L-proj)} ${livreN} de ${money(L)}.`)}
    else{if(G>L+1)F('ritmo','alerta',(G-L)+L*0.2,J.tipo==='mes'?'Passou do livre':'Passou do limite',`${J.nome} fechou em ${money(G)}, ${money(G-L)} acima ${livreN} de ${money(L)}.`);
      else F('ritmo','positivo',(L-G)*0.6,J.tipo==='mes'?'Fechou dentro do livre':'Fechou dentro do limite',`${J.nome} fechou em ${money(G)}, com ${money(L-G)} de sobra do livre de ${money(L)}.`)}}
  // 2) categorias contra a média no mesmo ponto
  const porCat=l=>{const o={};l.forEach(g=>{const x=catOf(g.cat).k;o[x]=(o[x]||0)+(+g.valor||0)});return o};
  const cur=porCat(atual),avg={};if(ants.length)CAT_KEYS.forEach(x=>{avg[x]=media(l=>porCat(l)[x]||0)});
  const cats=CAT_KEYS.map(x=>({k:x,v:cur[x]||0,a:ants.length?avg[x]:null})).filter(x=>x.v>0.005||(x.a||0)>0.005).sort((a,b)=>b.v-a.v||(b.a||0)-(a.a||0));
  cats.forEach(x=>{const n=catOf(x.k).n;if(x.a===null){return}
    const d=x.v-x.a,lim=Math.max(30,x.a*0.25);
    if(x.a>0.005&&d>lim)F('cat-'+x.k,'alerta',d,`${n} acima do normal`,`${n}: ${money(x.v)} até agora, ${money(d)} a mais que a média ${pt} no mesmo ponto (${money(x.a)}).`);
    else if(x.a>0.005&&-d>lim)F('cat-'+x.k,'positivo',-d*0.7,`Menos em ${n.toLowerCase()}`,`${n}: ${money(x.v)} até agora, ${money(-d)} a menos que a média ${pt} no mesmo ponto (${money(x.a)}).`);
    else if(x.a<=0.005&&x.v>50)F('cat-'+x.k,'info',x.v*0.4,`${n} apareceu agora`,`${n}: ${money(x.v)} neste período, sem saídas nessa categoria ${pt} no mesmo ponto.`)});
  if(G>100&&cats[0]&&cats[0].v/G>0.35)F('peso-'+cats[0].k,'info',cats[0].v*0.3,`${catOf(cats[0].k).n} pesa mais`,`${catOf(cats[0].k).n} é ${Math.round(cats[0].v/G*100)}% do que saiu do limite (${money(cats[0].v)} de ${money(G)}).`);
  // 3) onde mais foi (estabelecimentos e Pix para pessoas)
  const grp={};atual.forEach(g=>{const r=rNome(g);const o=grp[r.k]=grp[r.k]||{k:r.k,n:r.n,v:0,q:0,cat:{}};o.v+=+g.valor||0;o.q++;o.cat[g.cat]=(o.cat[g.cat]||0)+1});
  const top=Object.values(grp).sort((a,b)=>b.v-a.v).slice(0,5);
  top.forEach(t=>{t.cat=Object.keys(t.cat).sort((a,b)=>t.cat[b]-t.cat[a])[0];
    const qa=media(l=>l.filter(g=>rNome(g).k===t.k).length);t.qa=qa});
  top.filter(t=>t.q>=3).slice(0,2).forEach(t=>{const vezes=x=>x<0.95?'menos de 1 vez':`cerca de ${Math.round(x)} ${Math.round(x)===1?'vez':'vezes'}`;
    F('lugar-'+t.k,'info',t.v*0.5,`${t.n}: ${t.q} vezes`,`${t.n}: ${t.q} vezes neste período, ${money(t.v)} no total (${money(t.v/t.q)} por vez).`+(t.qa!==null&&t.qa!==undefined?` ${J.tipo==='mes'?'Nos meses anteriores':'Nas semanas anteriores'}, até este mesmo ponto, foram ${vezes(t.qa)} em média.`:''))});
  // 4) maior gasto único
  const maior=atual.slice().sort((a,b)=>b.valor-a.valor)[0];
  if(maior&&L&&maior.valor>L*0.15)F('maior','info',maior.valor*0.4,'Maior saída',`Maior gasto: ${rNome(maior).n}, ${money(maior.valor)} em ${diaCurto(parseD(maior.data))} (${Math.round(maior.valor/L*100)}% do livre).`);
  // 5) fim de semana
  const fds=soma(atual.filter(g=>[0,5,6].includes(parseD(g.data).getDay())));
  if(G>150&&fds/G>0.55)F('fds','info',fds*0.25,'Saídas concentradas no fim de semana',`${Math.round(fds/G*100)}% do que saiu (${money(fds)}) foi de sexta a domingo.`);
  // 6) semanas do mês acima do limite
  if(J.tipo==='mes'&&L!==null){const p=plano(J.m),passadas=p.blocos.filter(b=>b.fim<hoje);const acima=passadas.map(b=>({b,ex:gastoEntre(b.ini,b.fim)-limBloco(p,b)})).filter(x=>x.ex>1);
    if(acima.length)F('semanas','alerta',acima.reduce((s,x)=>s+x.ex,0),`${acima.length} semana${acima.length>1?'s':''} acima do limite`,`${acima.length} de ${passadas.length} semanas já fechadas passaram do limite, somando ${money(acima.reduce((s,x)=>s+x.ex,0))} a mais. As próximas ficaram menores para compensar.`)}
  // 7) meta de guardar e objetivo da caixinha
  const ctx={limite:L!==null?money(L):null,gasto:money(G),projecao:aberto?money(proj):null,dias_passados:k,dias_total:N};
  if(J.tipo==='mes'&&c.meta>0&&J.m<=planMonth(new Date())){const g=guardadoMes(J.m);ctx.meta_guardar=money(c.meta);ctx.guardado=money(g);
    if(g<c.meta-0.005)F('meta','alerta',(c.meta-g)*0.5,'Meta de guardar',`Guardado em ${mesCurto(J.m)}: ${money(g)} de ${money(c.meta)}. Faltam ${money(c.meta-g)}.`);
    else F('meta','positivo',c.meta*0.25,'Meta guardada',`A meta de guardar ${money(c.meta)} em ${mesCurto(J.m)} já foi cumprida (${money(g)}).`)}
  const obj=+c.objetivo||0,saldo=saldoCaixa();
  // ritmo de guardar = a meta mensal do plano (a média real pode vir inflada pelo saldo inicial transferido)
  if(obj>saldo&&J.tipo==='mes'&&c.meta>0){const rit=c.meta;
    ctx.objetivo=money(obj);ctx.saldo_caixinha=money(saldo);
    {const n=Math.ceil((obj-saldo)/rit),quando2=mesLongo(addMonths(planMonth(new Date()),n));
      F('objetivo','info',60+Math.min(200,(obj-saldo)/n*0.2),'Objetivo da caixinha',`Faltam ${money(obj-saldo)} para o objetivo de ${money(obj)}. Guardando a meta de ${money(rit)} por mês, chega em ${n} ${n===1?'mês':'meses'} (${quando2}).`+(aberto&&L!==null&&proj<L?` Guardar também a sobra prevista de ${money(L-proj)} adiantaria isso.`:''))}}
  fatos.sort((a,b)=>b.peso-a.peso);
  if(esgotado){ctx.limite=null;ctx.livre_do_mes_acabou=true;ctx.mes_acima_do_livre=money(esgotado.ex)}
  return{J,k,N,aberto,G,L:esgotado?null:L,esgotado,proj,atual,cats,top,ants:ants.length,fatos,ctx}}

function rIco(tipo){return tipo==='alerta'?['var(--laranja)','<path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/>']:tipo==='positivo'?['var(--verde)','<path d="M5 12l4 4 10-10"/>']:['var(--roxo)','<path d="M12 11v5M12 7.5v.5"/><circle cx="12" cy="12" r="9"/>']}
const nbsp=t=>esc(t).replace(/R\$\s/g,()=>'R$&nbsp;');
function rDestaques(lista,sug,nota){const box=$('#r-ia-list');
  box.innerHTML=lista.length?lista.map((d,i)=>{const[c,ic]=rIco(d.tipo);return `<div class="r-d" style="--i:${i}"><span class="ico" style="--c:${c}">${svg(ic,1.8)}</span><span><b>${nbsp(d.titulo)}</b><p>${nbsp(d.texto)}</p></span></div>`}).join('')
    :'<div class="empty" style="padding:12px">Ainda não há saídas suficientes neste período para um resumo.</div>';
  const s=$('#r-sug');s.hidden=!sug;s.innerHTML=sug?`<b>Sugestão</b><p>${nbsp(sug)}</p>`:'';$('#r-nota').textContent=nota||''}
async function rIA(D,forcar){const vez=++rVez,J=D.J;
  const payload={periodo:{tipo:J.tipo,nome:J.nome,encerrado:!D.aberto},plano:D.ctx,fatos:D.fatos.slice(0,10).map(f=>({id:f.id,tipo:f.tipo,texto:f.texto}))};
  const h=JSON.stringify(payload),ca=rCache()[J.key];
  const local=()=>D.fatos.slice(0,4).map(f=>({tipo:f.tipo,titulo:f.titulo,texto:f.texto}));
  if(!D.fatos.length){rDestaques([],'','');$('#r-ia-btn').hidden=true;return}
  $('#r-ia-btn').hidden=false;
  if(ca&&ca.h===h&&!forcar){rDestaques(ca.r.destaques,ca.r.sugestao,'Escrito pela IA a partir dos seus números.');return}
  rDestaques(local(),'','');$('#r-nota').innerHTML='<span class="spin"></span>A IA está lendo seus números…';
  try{const {data,error}=await sb.functions.invoke('ia',{body:{resumo:payload}});if(error)throw error;if(vez!==rVez)return;
    const by={};D.fatos.forEach(f=>by[f.id]=f);
    const ds=(Array.isArray(data&&data.destaques)?data.destaques:[]).filter(d=>by[d.id]).slice(0,4).map(d=>({tipo:by[d.id].tipo,titulo:String(d.titulo||by[d.id].titulo).slice(0,60),texto:String(d.texto||by[d.id].texto).slice(0,240)}));
    if(!ds.length)throw new Error('vazio');
    const r={destaques:ds,sugestao:String(data.sugestao||'').slice(0,280)};rCacheSet(J.key,{h,r,t:Date.now()});
    rDestaques(r.destaques,r.sugestao,'Escrito pela IA a partir dos seus números.');renderHomeResumo()}
  catch(err){console.error(err);if(vez!==rVez)return;rDestaques(local(),'','A IA não respondeu agora. Estes são os destaques calculados pelo app.')}}

function rRitmo(D){const box=$('#r-ritmo'),W=largGraf(box,330),H=150,l=8,r=8,t=14,b=22,w=W-l-r,h=H-t-b;
  const dia=i=>addDays(D.J.ini,i),porDia=Array.from({length:D.N},(_,i)=>i<D.k?soma(D.atual.filter(g=>g.data===ymd(dia(i)))):0);
  if(D.J.tipo==='semana'){const lim=D.L!==null?D.L/7:null,mx=Math.max(...porDia,lim||0,1)*1.1,bw=w/7;
    const L2=['D','S','T','Q','Q','S','S'];
    box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Saídas por dia na semana">`+porDia.map((v,i)=>{const bh=v/mx*h,x=l+i*bw+bw*0.2;return `<rect x="${x.toFixed(1)}" y="${(t+h-bh).toFixed(1)}" width="${(bw*0.6).toFixed(1)}" height="${Math.max(bh,v>0?2:0).toFixed(1)}" rx="5" fill="${lim!==null&&v>lim?'var(--laranja)':'var(--roxo)'}" opacity="${i<D.k?1:.25}"/><text x="${(l+i*bw+bw/2).toFixed(1)}" y="${H-6}" text-anchor="middle">${L2[dia(i).getDay()]}</text>`}).join('')
      +(lim!==null?`<line class="r-lim" x1="${l}" x2="${W-r}" y1="${(t+h-lim/mx*h).toFixed(1)}" y2="${(t+h-lim/mx*h).toFixed(1)}"/><text x="${W-r}" y="${(t+h-lim/mx*h-5).toFixed(1)}" text-anchor="end">${esc(money(lim))}/dia</text>`:'')+'</svg>';
    $('#r-ritmo-s').textContent=D.esgotado?`${money(D.G)} na semana. O livre de ${mesCurto(D.esgotado.m)} já acabou, então não há limite por dia.`:D.L!==null?`${money(D.G)} de ${money(D.L)} na semana. Barras em vermelho passaram do limite do dia.`:`${money(D.G)} na semana.`;return}
  let acc=0;const cum=porDia.map((v,i)=>i<D.k?(acc+=v):null);
  const mx=Math.max(D.L||0,D.proj,D.G,1)*1.08,X=i=>l+(D.N>1?i/(D.N-1):0)*w,Y=v=>t+h-v/mx*h;
  const pts=cum.map((v,i)=>v===null?null:`${X(i).toFixed(1)},${Y(v).toFixed(1)}`).filter(Boolean);
  const ult=D.k-1;
  box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Saídas acumuladas no mês comparadas ao ritmo ideal">`
    +(D.L!==null?`<line class="r-ideal" x1="${X(0)}" y1="${Y(0)}" x2="${X(D.N-1)}" y2="${Y(D.L)}"/><text x="${W-r}" y="${(Y(D.L)-6).toFixed(1)}" text-anchor="end">livre ${esc(money(D.L))}</text>`:'')
    +(pts.length>1?`<polygon class="r-area" points="${X(0)},${Y(0)} ${pts.join(' ')} ${X(ult).toFixed(1)},${Y(0)}"/><polyline class="r-linha" points="${pts.join(' ')}"/>`:'')
    +(D.aberto&&ult>=0?`<line class="r-proj" x1="${X(ult).toFixed(1)}" y1="${Y(cum[ult]).toFixed(1)}" x2="${X(D.N-1)}" y2="${Y(D.proj).toFixed(1)}"/><circle class="r-dot" cx="${X(ult).toFixed(1)}" cy="${Y(cum[ult]).toFixed(1)}" r="4"/>`:'')
    +`<text x="${l}" y="${H-6}">${esc(diaCurto(D.J.ini))}</text><text x="${W-r}" y="${H-6}" text-anchor="end">${esc(diaCurto(D.J.fim))}</text></svg>`;
  const ideal=D.L!==null&&D.k?D.L*D.k/D.N:null;
  $('#r-ritmo-s').textContent=!D.k?'O período ainda não começou.':D.L===null?`${money(D.G)} até agora.`:D.aberto?`${money(D.G)} até hoje; o ritmo ideal seria ${money(ideal)}. A linha cinza é o ritmo ideal; a pontilhada, onde o mês fecha se continuar assim (${money(D.proj)}).`:`Fechou em ${money(D.G)} de ${money(D.L)}.`}

function renderResumo(){if(!S.config)return;const D=resumoDados(),J=D.J;
  $('#r-nome').textContent=J.nome;$('#r-faixa').textContent=`${diaCurto(J.ini)} – ${diaCurto(J.fim)}`;
  $('#r-next').disabled=ymd(addDays(J.fim,1))>ymd(new Date());
  rRitmo(D);$('#r-graf-t').textContent=J.tipo==='mes'?'Ritmo do mês':'Dia a dia';
  // categorias contra a média
  const mx=Math.max(1,...D.cats.map(x=>Math.max(x.v,x.a||0)));
  $('#r-cat-s').textContent=D.ants?`vs. média ${J.tipo==='mes'?'de '+J.antN:'de '+J.antN}`:'sem histórico para comparar';
  $('#r-cats').innerHTML=D.cats.length?D.cats.slice(0,6).map((x,i)=>{const ct=catOf(x.k),d=x.a===null?null:x.v-x.a;
    return `<div class="rc" style="--i:${i}"><span class="ico" style="--c:${ct.bg}">${svg(ICON[ct.k])}</span><div class="rc-b"><div class="rc-h"><span>${esc(ct.n)}</span><b class="num">${money(x.v)}</b></div>
      <div class="rc-t"><b data-w="${(x.v/mx*100).toFixed(1)}" style="background:${ct.bg}"></b>${x.a!==null?`<i style="left:${(x.a/mx*100).toFixed(1)}%"></i>`:''}</div>
      ${x.a!==null?`<small class="num">média ${money(x.a)}${Math.abs(d)>=1?` · <span class="${d>0?'mais':'menos'}">${d>0?'+':'−'} ${money(Math.abs(d))}</span>`:''}</small>`:''}</div></div>`}).join('')
    :'<div class="empty">Nenhuma saída neste período.</div>';
  requestAnimationFrame(()=>$$('#r-cats [data-w]').forEach(b=>b.style.width=b.dataset.w+'%'));
  $('#r-top').innerHTML=D.top.length?D.top.map((t,i)=>{const ct=catOf(t.cat);return `<div class="item" style="--i:${i}"><span class="ico" style="--c:${ct.bg}">${svg(ICON[ct.k])}</span><span style="min-width:0"><div class="n">${esc(t.n)}</div><div class="m">${t.q} ${t.q===1?'vez':'vezes'} · ${money(t.v/t.q)} por vez</div></span><span class="val num">${money(t.v)}</span></div>`}).join('')
    :'<div class="empty">Nenhuma saída neste período.</div>';
  rIA(D,false)}
function renderHomeResumo(){const cta=$('#r-cta');if(!S.config||!(S.config.salario>0)){cta.hidden=true;return}
  const sv=[rPer,rMes,rSem];rPer='mes';rMes=planMonth(new Date());let D;try{D=resumoDados()}finally{[rPer,rMes,rSem]=sv}
  cta.hidden=!D.fatos.length;if(!D.fatos.length)return;
  const ca=rCache()[D.J.key],d=ca&&ca.r&&ca.r.destaques&&ca.r.destaques[0]||D.fatos[0];
  $('#r-cta-t').textContent=`Resumo de ${mesLongo(D.J.m).replace(/ \d{4}$/,'')}`;$('#r-cta-p').innerHTML=nbsp(d.texto)}
$('#r-cta').onclick=()=>{rPer='mes';rMes=planMonth(new Date());$('#r-per .thumb').style.transform='translateX(100%)';$$('#r-per button').forEach(x=>x.classList.toggle('on',x.dataset.p==='mes'));switchTab(5)};
$('#r-per').onclick=e=>{const b=e.target.closest('[data-p]');if(!b||b.dataset.p===rPer)return;rPer=b.dataset.p;
  $('#r-per .thumb').style.transform=`translateX(${rPer==='mes'?100:0}%)`;$$('#r-per button').forEach(x=>x.classList.toggle('on',x===b));drawHead();renderResumo()};
$('#r-per .thumb').style.transform='translateX(100%)';
$('#r-prev').onclick=()=>{if(rPer==='semana')rSem=addDays(rSem,-7);else rMes=addMonths(rMes,-1);renderResumo()};
$('#r-next').onclick=()=>{if(rPer==='semana')rSem=addDays(rSem,7);else rMes=addMonths(rMes,1);renderResumo()};
$('#r-ia-btn').onclick=()=>{if(S.config)rIA(resumoDados(),true)};

/* ---------- toast & confetti ---------- */
// Aviso no topo. Com "desfazer" (função), mostra o botão Desfazer e fica 6 s na tela.
let tt;function toast(msg,desfazer){const t=$('#toast');t.textContent='';const s=document.createElement('span');s.textContent=msg;t.appendChild(s);
  if(typeof desfazer==='function'){const b=document.createElement('button');b.type='button';b.textContent='Desfazer';
    b.onclick=()=>{clearTimeout(tt);t.classList.remove('on');desfazer()};t.appendChild(b)}
  t.classList.toggle('acao',typeof desfazer==='function');t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),typeof desfazer==='function'?6000:2600)}
function confetti(n=140){
  if(reduce)return;const cv=$('#confetti'),ctx=cv.getContext('2d');const dpr=window.devicePixelRatio||1;
  cv.width=innerWidth*dpr;cv.height=innerHeight*dpr;ctx.scale(dpr,dpr);
  const cs=getComputedStyle(document.documentElement);const cols=['--roxo','--rosa','--amarelo','--verde','--laranja','--azul'].map(v=>cs.getPropertyValue(v).trim());
  const P=Array.from({length:n},()=>({x:innerWidth/2+(Math.random()-.5)*80,y:innerHeight*.35,vx:(Math.random()-.5)*14,vy:-Math.random()*14-4,r:Math.random()*Math.PI,vr:(Math.random()-.5)*.4,w:6+Math.random()*8,h:4+Math.random()*6,c:cols[Math.floor(Math.random()*cols.length)],round:Math.random()<.3}));
  let f=0;(function tick(){ctx.clearRect(0,0,innerWidth,innerHeight);P.forEach(p=>{p.vy+=.38;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.c;
    if(p.round){ctx.beginPath();ctx.arc(0,0,p.w/2,0,7);ctx.fill()}else ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore()});
    if(++f<160)requestAnimationFrame(tick);else ctx.clearRect(0,0,innerWidth,innerHeight)})();
}

/* ---------- backup ---------- */
$('#bk-out').onclick=()=>{
  const data={app:'sobra',versao:1,exportado:new Date().toISOString(),config:S.config,gastos:S.gastos,caixa:S.caixa};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`leve-backup-${ymd(new Date())}.json`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),4000);toast('Backup baixado. Guarde em lugar seguro.')};
$('#bk-in').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;const box=$('#bk-box');
  let j;try{if(f.size>5e6)throw 0;j=JSON.parse(await f.text());if(j.app!=='sobra'||(j.config!=null&&typeof j.config!=='object'))throw 0}catch(err){toast('Esse arquivo não é um backup do Sobra.');return}
  const gastos=(Array.isArray(j.gastos)?j.gastos:[]).filter(g=>g&&isDate(g.data)&&+g.valor>=0&&+g.valor<1e7).slice(0,20000);
  const caixa=(Array.isArray(j.caixa)?j.caixa:[]).filter(m=>m&&isDate(m.data)&&Math.abs(+m.valor)<1e8&&TIPOS.includes(m.tipo)).slice(0,20000);
  const LTi=j.cxLotes,soLotes=j.config==null&&!Array.isArray(j.caixa)&&LTi&&isDate(LTi.data)&&Array.isArray(LTi.lotes);
  const soCaixa=j.config==null&&!soLotes;
  box.hidden=false;
  if(soLotes){
    const ls=LTi.lotes.filter(l=>l&&isDate(l.dep)&&+l.bruto>0&&+l.bruto<1e8).slice(0,500).map(l=>({dep:l.dep,bruto:round2(l.bruto),ganho:Math.max(0,Math.round((+l.ganho||0)*1e4)/1e4)}));
    const tot=round2(ls.reduce((s,l)=>s+l.bruto,0));
    box.innerHTML=`<p>O arquivo tem ${ls.length} depósito(s) do banco em ${esc(diaCurto(parseD(LTi.data)))}, somando ${money(tot)} de bruto. Importar não apaga nada: o app passa a calcular imposto, resgates e vencimentos por depósito.</p>
      <div class="row-btns"><button class="ghost" id="bk-no">Cancelar</button><button class="primary" id="bk-yes">Importar</button></div>`;
    $('#bk-no').onclick=()=>{box.hidden=true};
    $('#bk-yes').onclick=async()=>{const b=$('#bk-yes');b.disabled=true;
      try{
        const est=simCaixa(parseD(LTi.data)).saldo;
        const cfg=JSON.parse(JSON.stringify(S.config));cfg.cxLotes={data:LTi.data,lotes:ls};
        await sb.from('perfis').upsert({user_id:S.uid,config:normalize(cfg),updated_at:new Date().toISOString()}).then(r=>{if(r.error)throw r.error});
        if(Math.abs(tot-est)>=0.005){const id=uid();await bulkUpsert('caixinha',[toRowM(id,{data:LTi.data,valor:round2(tot-somaMov(LTi.data)),tipo:'ajuste',mes:planMonth(parseD(LTi.data)),nota:'Conferido com os depósitos do banco',criado:Date.now()})])}
        await reload();box.hidden=true;toast('Depósitos importados')}
      catch(err){console.error(err);b.disabled=false;toast('Não deu para importar. Tente de novo.')}};
    return}
  // nunca apaga a caixinha para trocar por nada: arquivo sem movimentos não substitui
  if(soCaixa&&!caixa.length){box.hidden=true;toast('Esse arquivo não tem movimentos da caixinha. Nada foi alterado.');return}
  const lotesArq=LTi&&isDate(LTi.data)&&Array.isArray(LTi.lotes)?LTi.lotes.filter(l=>l&&isDate(l.dep)&&+l.bruto>0&&+l.bruto<1e8).slice(0,500).map(l=>({dep:l.dep,bruto:round2(l.bruto),ganho:Math.max(0,Math.round((+l.ganho||0)*1e4)/1e4)})):null;
  if(soCaixa)box.innerHTML=`<p>O arquivo tem ${caixa.length} movimento(s) da caixinha${lotesArq?` e ${lotesArq.length} depósito(s) do banco`:''}. Importar <strong>apaga a caixinha atual e recomeça com este arquivo</strong>. O plano e os gastos não mudam.</p>
    <div class="row-btns"><button class="ghost" id="bk-no">Cancelar</button><button class="primary" id="bk-yes">Importar</button></div>`;
  else box.innerHTML=`<p>O backup tem o plano, ${gastos.length} gasto(s) e ${caixa.length} movimento(s) da caixinha. Restaurar substitui o seu plano e junta os lançamentos com os que já estão aqui.</p>
    <div class="row-btns"><button class="ghost" id="bk-no">Cancelar</button><button class="primary" id="bk-yes">Restaurar</button></div>`;
  $('#bk-no').onclick=()=>{box.hidden=true};
  $('#bk-yes').onclick=async()=>{const b=$('#bk-yes');b.disabled=true;
    try{
      if(soCaixa){
        const r=await sb.from('caixinha').delete().eq('user_id',S.uid);if(r.error)throw r.error;
        // recomeça do zero: o líquido conferido e os depósitos antigos saem; entram os do arquivo, se houver
        const lq=j.cxLiq,cfg=JSON.parse(JSON.stringify(S.config));delete cfg.cxLiq;delete cfg.cxLotes;
        if(lq&&isDate(lq.data)&&isFinite(+lq.imp))cfg.cxLiq={data:lq.data,imp:round2(lq.imp)};
        if(lotesArq&&lotesArq.length)cfg.cxLotes={data:LTi.data,lotes:lotesArq};
        await sb.from('perfis').upsert({user_id:S.uid,config:normalize(cfg),updated_at:new Date().toISOString()}).then(r=>{if(r.error)throw r.error});
      }else{
        await sb.from('perfis').upsert({user_id:S.uid,config:normalize(j.config),updated_at:new Date().toISOString()}).then(r=>{if(r.error)throw r.error});
        await bulkUpsert('gastos',gastos.map(g=>toRowG(g.id||uid(),g)));
      }
      await bulkUpsert('caixinha',caixa.map(m=>toRowM(m.id||uid(),m)));
      await reload();box.hidden=true;ajDirty=false;renderAjustes();toast(soCaixa?'Caixinha importada':'Backup restaurado');
    }catch(err){console.error(err);b.disabled=false;toast('Não deu para restaurar. Tente de novo.')}};
};

/* ---------- chave dos atalhos do iPhone ----------
   A chave (leve_…) é criada aqui, aparece uma vez para colar nos atalhos e só o SHA-256 vai para a tabela atalhos.
   A função atalho usa a chave para lançar gastos e conferir a caixinha sem login (ver supabase/functions). */
let atArm=false;
const sha256hex=async t=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))].map(x=>x.toString(16).padStart(2,'0')).join('');
async function drawAtalho(){if(!S.uid)return;atArm=false;$('#at-del').querySelector('span').textContent='Desativar chave';$('#at-del').classList.remove('armed');
  const {data,error}=await sb.from('atalhos').select('criado').maybeSingle();
  if(error){$('#at-state').textContent=/atalhos/.test(error.message||'')?'Falta criar a tabela no Supabase (schema.sql)':'Não deu para verificar agora';$('#at-btn').hidden=true;$('#at-del').hidden=true;return}
  {const e=$('#at-est');e.textContent=data?'Ativo':'Nenhum';e.classList.toggle('off',!data)}
  $('#at-btn').hidden=false;$('#at-state').textContent=data?'Ativa desde '+diaCurto(new Date(data.criado)):'Nenhuma';$('#at-btn').textContent=data?'Trocar':'Criar';$('#at-del').hidden=!data}
function copiar(id){const el=$(id);el.select();try{navigator.clipboard.writeText(el.value).then(()=>toast('Copiado'),()=>{document.execCommand('copy');toast('Copiado')})}catch(e){document.execCommand('copy');toast('Copiado')}}
$('#at-btn').onclick=async()=>{const b=$('#at-btn');b.disabled=true;
  try{const token='leve_'+b64e(crypto.getRandomValues(new Uint8Array(32)));
    const {error}=await sb.from('atalhos').upsert({user_id:S.uid,token_hash:await sha256hex(token),criado:new Date().toISOString()});if(error)throw error;
    const url=(window.SOBRA_CONFIG.url||'').replace(/\/$/,'')+'/functions/v1/atalho',box=$('#at-box');box.hidden=false;
    box.innerHTML=`<h3>Sua chave do atalho</h3><p>Ela aparece só agora. Copie e cole nos atalhos, no campo "chave". Se perder, é só trocar.</p>
      <div class="field"><label for="at-k">Chave</label><input id="at-k" readonly value="${esc(token)}"></div>
      <div class="row-btns"><button class="ghost" id="at-ck">Copiar chave</button></div>
      <div class="field"><label for="at-u">Endereço (URL) dos atalhos</label><input id="at-u" readonly value="${esc(url)}"></div>
      <div class="row-btns"><button class="ghost" id="at-cu">Copiar endereço</button></div>
      <p>O passo a passo para montar os atalhos está no arquivo ATALHOS.md do projeto.</p>`;
    $('#at-ck').onclick=()=>copiar('#at-k');$('#at-cu').onclick=()=>copiar('#at-u');
    await drawAtalho();toast('Chave criada. A anterior parou de valer.')}
  catch(err){console.error(err);toast('Não deu para criar a chave. Confira a internet e tente de novo.')}
  finally{b.disabled=false}};
$('#at-del').onclick=async()=>{const b=$('#at-del');if(!atArm){atArm=true;b.querySelector('span').textContent='Toque de novo para desativar';b.classList.add('armed');return}
  const {error}=await sb.from('atalhos').delete().eq('user_id',S.uid);if(error){toast('Não deu para desativar agora.');return}
  $('#at-box').hidden=true;$('#at-box').innerHTML='';await drawAtalho();toast('Chave desativada. Os atalhos pararam de funcionar.')};

/* ---------- conversar pelo Telegram ou WhatsApp ----------
   O Leve responde por mensagem (funções telegram e whatsapp no Supabase). Para ligar uma conversa à conta, o app
   cria um código de uso único (só o SHA-256 vai para a tabela, com validade de 15 min) e abre o Telegram ou o
   WhatsApp com o código pronto para enviar. Quem grava o chat ou o número é a função, nunca o app.
   O grupo do Telegram aparece quando o bot está pronto no Supabase (a função devolve o nome dele); o do WhatsApp,
   quando o número do Leve está em config.js (SOBRA_CONFIG.whatsapp). */
const CFG_CANAL=window.SOBRA_CONFIG||{};
const CANAIS_UI=[
  {k:'tg',tabela:'telegram',nome:'Telegram',col:'chat_id',alvo:'',
    // pergunta à função se o bot está pronto (ela registra o webhook no Telegram na primeira vez)
    descobrir:async()=>{try{const {data,error}=await sb.functions.invoke('telegram',{body:{acao:'status'}});if(error)throw error;
      if(data&&!data.pronto&&data.erro)console.warn('Telegram:',data.erro);return data&&data.pronto?String(data.bot||'').replace(/[^A-Za-z0-9_]/g,''):''}catch(e){console.error(e);return ''}},
    link:(a,cod)=>`https://t.me/${a}?start=${cod}`,msg:cod=>'/start '+cod,
    estado:d=>'Conectado'+(d.ligado?' desde '+diaCurto(new Date(d.ligado)):''),
    passos:'Toque no botão e, no Telegram, em Iniciar. O código vale 15 minutos e só funciona uma vez.',
    manual:a=>`Se o botão não abrir, copie a mensagem abaixo e mande para @${a} no Telegram.`},
  {k:'wa',tabela:'whatsapp',nome:'WhatsApp',col:'telefone',alvo:String(CFG_CANAL.whatsapp||'').replace(/\D/g,''),
    link:(a,cod)=>`https://wa.me/${a}?text=${encodeURIComponent('Conectar meu Leve: '+cod)}`,msg:cod=>'Conectar meu Leve: '+cod,
    estado:d=>'Conectado ao número com final '+String(d.telefone).slice(-4),
    passos:'Toque no botão e envie a mensagem que já vem escrita. O código vale 15 minutos e só funciona uma vez.',
    manual:a=>`Se o botão não abrir, copie a mensagem e mande para o número +${a}.`}
];
// manter=true: ao voltar do Telegram/WhatsApp, deixa as instruções abertas se ainda não conectou
async function drawCanal(c,manter){const g=$(`#${c.k}-grp`);
  if(S.uid&&!c.alvo&&c.descobrir&&!(Date.now()-(c.tentou||0)<5*6e4)){c.tentou=Date.now();c.alvo=await c.descobrir()}
  if(!c.alvo||!S.uid){g.hidden=true;return}
  c.arm=false;$(`#${c.k}-del`).querySelector('span').textContent='Desconectar';$(`#${c.k}-del`).classList.remove('armed');
  const {data,error}=await sb.from(c.tabela).select(c.col+',ligado').maybeSingle();g.hidden=false;
  if(error){$(`#${c.k}-state`).textContent=new RegExp(c.tabela).test(error.message||'')?'Falta criar a tabela no Supabase (schema.sql)':'Não deu para verificar agora';$(`#${c.k}-btn`).hidden=true;$(`#${c.k}-del`).hidden=true;return}
  const on=!!(data&&data[c.col]),box=$(`#${c.k}-box`);
  if(on&&!box.hidden){box.hidden=true;box.innerHTML='';toast(c.nome+' conectado')}
  if(!on&&!manter){box.hidden=true;box.innerHTML=''}
  $(`#${c.k}-state`).textContent=on?c.estado(data):'Não conectado';
  const est=$(`#${c.k}-est`);if(est){est.textContent=on?'Conectado':'Não conectado';est.classList.toggle('off',!on)}
  $(`#${c.k}-btn`).hidden=false;$(`#${c.k}-btn`).textContent=on?'Trocar':'Conectar';$(`#${c.k}-del`).hidden=!on}
const drawCanais=manter=>CANAIS_UI.forEach(c=>drawCanal(c,manter));
const fechaCanais=()=>CANAIS_UI.forEach(c=>{$(`#${c.k}-box`).hidden=true;$(`#${c.k}-box`).innerHTML=''});
CANAIS_UI.forEach(c=>{
  $(`#${c.k}-btn`).onclick=async()=>{const b=$(`#${c.k}-btn`);b.disabled=true;
    try{const cod=[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
      const linha={codigo_hash:await sha256hex(cod),codigo_expira:new Date(Date.now()+15*6e4).toISOString()};
      const ja=await sb.from(c.tabela).select('user_id').maybeSingle();if(ja.error)throw ja.error;
      const {error}=ja.data?await sb.from(c.tabela).update(linha).eq('user_id',S.uid):await sb.from(c.tabela).insert({user_id:S.uid,...linha});if(error)throw error;
      const box=$(`#${c.k}-box`);box.hidden=false;
      box.innerHTML=`<h3>Conectar o ${esc(c.nome)}</h3><p>${esc(c.passos)}</p>
        <a class="primary" href="${esc(c.link(c.alvo,cod))}" target="_blank" rel="noopener">Abrir o ${esc(c.nome)}</a>
        <p>${esc(c.manual(c.alvo))}</p>
        <div class="field"><label for="${c.k}-k">Mensagem</label><input id="${c.k}-k" readonly value="${esc(c.msg(cod))}"></div>
        <div class="row-btns"><button class="ghost" id="${c.k}-ck">Copiar mensagem</button></div>`;
      $(`#${c.k}-ck`).onclick=()=>copiar(`#${c.k}-k`)}
    catch(err){console.error(err);toast('Não deu para criar o código. Confira a internet e tente de novo.')}
    finally{b.disabled=false}};
  $(`#${c.k}-del`).onclick=async()=>{const b=$(`#${c.k}-del`);if(!c.arm){c.arm=true;b.querySelector('span').textContent='Toque de novo para desconectar';b.classList.add('armed');return}
    const {error}=await sb.from(c.tabela).delete().eq('user_id',S.uid);if(error){toast('Não deu para desconectar agora.');return}
    await drawCanal(c);toast(c.nome+' desconectado. O Leve não responde mais por lá.')};
});

/* ---------- esconder o saldo da caixinha ----------
   O olho do cartão da Caixinha troca os valores por "R$ ••••••" (saldo, objetivo e o quadro do Início) e some com o
   líquido e o "rendeu". A escolha fica neste aparelho. */
const OCULTA_KEY='leve-caixa-oculta';
function aplicaOculto(on){document.body.classList.toggle('cx-oculto',on);
  $$('.olho').forEach(b=>{b.setAttribute('aria-pressed',on);b.setAttribute('aria-label',on?'Mostrar o saldo':'Esconder o saldo')})}
aplicaOculto((()=>{try{return localStorage.getItem(OCULTA_KEY)==='1'}catch(e){return false}})());
function alternaOculto(e){e.stopPropagation();e.preventDefault();const on=!document.body.classList.contains('cx-oculto');aplicaOculto(on);
  try{on?localStorage.setItem(OCULTA_KEY,'1'):localStorage.removeItem(OCULTA_KEY)}catch(err){}}
$('#cx-olho').onclick=alternaOculto;
// o quadro do Início é redesenhado a cada render: o clique é pego no contêiner, antes de chegar ao "abrir a Caixinha"
$('#tiles').addEventListener('click',e=>{if(e.target.closest('.olho'))alternaOculto(e)});
$('#tiles').addEventListener('keydown',e=>{if(e.target.closest('.olho')&&(e.key==='Enter'||e.key===' '))alternaOculto(e)});

// linhas de Ajustes que abrem um painel com os detalhes
document.addEventListener('click',e=>{const b=e.target.closest('[data-painel]');if(!b||b.disabled)return;e.preventDefault();openPanel(b.dataset.painel)});

/* ---------- tema ---------- */
// Escolha por aparelho (localStorage). O tema.js aplica antes de a página aparecer; aqui só a troca e a cor da barra.
const TEMA_KEY='leve-tema';
function temaAtual(){let t='';try{t=localStorage.getItem(TEMA_KEY)||''}catch(e){}return t==='light'||t==='dark'?t:''}
function aplicaTema(t){const r=document.documentElement;if(t)r.setAttribute('data-theme',t);else r.removeAttribute('data-theme');
  const escuro=t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches);
  $('#theme-color').setAttribute('content',escuro?'#17141C':'#F8F7F3');$('#c-tema').value=t}
$('#c-tema').onchange=e=>{const t=e.target.value;try{t?localStorage.setItem(TEMA_KEY,t):localStorage.removeItem(TEMA_KEY)}catch(err){}aplicaTema(t)};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>aplicaTema(temaAtual()));
aplicaTema(temaAtual());

/* ---------- primeiro uso: montar o plano em 4 passos ----------
   1) nome, quando o salário cai e quando a semana começa; 2) salário e quanto guardar; 3) contas fixas; 4) vale-refeição
   e mobilidade. Do passo 2 em diante, uma prévia mostra quanto vai dar para gastar por semana (com as regras do app:
   plano() calculado com o plano em montagem). Ao terminar, salva tudo de uma vez. Ajustes continua para mudar depois. */
const INI={p:1,pagto:'ultimo-util',semana:'',onde:'cartao',quando:'agora',fixos:[]};let iniMostrado=false;
function segIni(id,v){const el=$('#'+id),bs=[...el.querySelectorAll('button')],i=Math.max(0,bs.findIndex(b=>b.dataset.v===v));
  bs.forEach((b,k)=>{b.classList.toggle('on',k===i);b.setAttribute('aria-pressed',k===i)});el.querySelector('.thumb').style.transform=`translateX(${i*100}%)`}
function cfgIni(){const c=normalize({nome:$('#ini-nome').value.trim(),salario:lerReais($('#ini-sal').value),meta:lerReais($('#ini-meta').value),
    vr:lerReais($('#ini-vr').value),mob:lerReais($('#ini-mob').value),fixos:[],ajustes:{}});
  if(INI.pagto)c.pagto=INI.pagto;if(INI.semana)c.semana=INI.semana;
  const velho=S.config;S.config=c;try{const m=mesDoDia(new Date());c.inicio=INI.quando==='prox'?addMonths(m,1):m}finally{S.config=velho}
  c.fixos=INI.fixos.map(f=>({id:uid(),nome:f.nome,valor:f.valor,onde:f.onde,inicio:c.inicio,fim:'',chave:''}));return c}
// prévia: começando agora, o limite real desta semana (o livre do mês fica para os dias que faltam) e a média do mês;
// começando no próximo mês, a média por semana e a data de início
function previaIni(){const pv=$('#ini-previa'),c=cfgIni();if(INI.p<2||!(c.salario>0)){pv.hidden=true;return}
  const velho=S.config;let p,sem=0,ini=null;S.config=c;
  try{p=plano(c.inicio);ini=periodo(c.inicio).ini;if(INI.quando!=='prox'){const b=blocoDe(new Date());sem=limBloco(p,b)}}finally{S.config=velho}
  pv.hidden=false;pv.classList.toggle('neg',!(p.livre>0));
  const fixos=p.cartao+p.debito>0?` · contas fixas: ${money(p.cartao+p.debito)}`:'';
  if(!(p.livre>0)){$('#ini-prev-l').textContent='Assim não sobra nada para gastar';$('#ini-prev-v').textContent=money(p.livre);
    $('#ini-prev-s').textContent=`Guardar e as contas fixas passam do salário em ${money(-p.livre)}. Diminua um dos dois.`;return}
  if(INI.quando==='prox'){$('#ini-prev-l').textContent='Você poderá gastar cerca de';$('#ini-prev-v').textContent=`${money(p.porSemana)} por semana`;
    $('#ini-prev-s').textContent=`Começa em ${diaCurto(ini)} · livre no mês: ${money(p.livre)}${fixos}`}
  else{$('#ini-prev-l').textContent='Nesta semana você poderá gastar';$('#ini-prev-v').textContent=money(sem);
    $('#ini-prev-s').textContent=`Média do mês: ${money(p.porSemana)} por semana · livre no mês: ${money(p.livre)}${fixos}`}
  const d=$('#ini-quando-d');if(d)d.textContent=INI.quando==='prox'?`Até ${diaCurto(ini)}, o Início mostra a contagem regressiva.`
    :'Começando agora, o livre do mês inteiro fica para os dias que faltam. Se já gastou boa parte do salário, prefira o próximo mês.'}
function fixosIni(){$('#ini-fixos').innerHTML=INI.fixos.map((f,i)=>`<div class="ini-fx"><span><b>${esc(f.nome)}</b><small>${f.onde==='debito'?'Débito':'Crédito'}</small></span><b class="num">${money(f.valor)}</b><button type="button" data-rm="${i}" aria-label="Tirar ${esc(f.nome)}">${svg('<path d="M6 6l12 12M18 6L6 18"/>',2)}</button></div>`).join('')}
function passoIni(n){INI.p=n;$$('#sheet-ini .ini-p').forEach(x=>x.hidden=+x.dataset.p!==n);
  $$('#sheet-ini .ini-prog i').forEach((x,i)=>x.classList.toggle('f',i<n));$('#ini-n').textContent=`Passo ${n} de 4`;
  $('#ini-volta').hidden=n===1;$('#sheet-ini .ini-bts').classList.toggle('um',n===1);$('#ini-ok').textContent=n===4?'Começar':'Continuar';previaIni()}
function abrirIni(){const c=S.config||{};$('#ini-nome').value=c.nome||'';
  ['sal:salario','meta:meta','vr:vr','mob:mob'].forEach(x=>{const[id,k]=x.split(':');$('#ini-'+id).value=+c[k]>0?money(c[k]):''});
  INI.pagto=c.salario>0?(c.pagto==='ultimo-util'?'ultimo-util':''):'ultimo-util';INI.semana=c.semana==='dom'?'dom':'';INI.fixos=[];INI.onde='cartao';INI.quando='agora';segIni('ini-quando','agora');
  segIni('ini-pagto',INI.pagto);segIni('ini-semana',INI.semana);segIni('ini-fx-onde','cartao');fixosIni();passoIni(1);openPanel('#sheet-ini')}
$('#ini-pagto').onclick=e=>{const b=e.target.closest('button');if(!b)return;INI.pagto=b.dataset.v;segIni('ini-pagto',INI.pagto);previaIni()};
$('#ini-semana').onclick=e=>{const b=e.target.closest('button');if(!b)return;INI.semana=b.dataset.v;segIni('ini-semana',INI.semana);previaIni()};
$('#ini-quando').onclick=e=>{const b=e.target.closest('button');if(!b)return;INI.quando=b.dataset.v;segIni('ini-quando',INI.quando);previaIni()};
$('#ini-fx-onde').onclick=e=>{const b=e.target.closest('button');if(!b)return;INI.onde=b.dataset.v;segIni('ini-fx-onde',INI.onde)};
$$('#sheet-ini .ini-r').forEach(el=>{el.addEventListener('input',previaIni);
  el.addEventListener('blur',()=>{const v=lerReais(el.value);el.value=v>0?money(v):''});
  el.addEventListener('focus',()=>{const v=lerReais(el.value);el.value=v>0?String(v).replace('.',','):'';setTimeout(()=>el.select(),0)})});
$('#ini-pct').onclick=e=>{const b=e.target.closest('[data-pct]');if(!b)return;const sal=lerReais($('#ini-sal').value);
  if(!(sal>0)){toast('Digite o salário primeiro.');$('#ini-sal').focus();return}
  $('#ini-meta').value=money(Math.round(sal*+b.dataset.pct/100));previaIni()};
$('#ini-fx-add').onclick=()=>{const nome=$('#ini-fx-nome').value.trim(),valor=lerReais($('#ini-fx-valor').value);
  if(!nome){toast('Dê um nome à conta fixa.');$('#ini-fx-nome').focus();return}
  if(!(valor>0)){toast('Digite o valor da conta fixa.');$('#ini-fx-valor').focus();return}
  INI.fixos.push({nome:nome.slice(0,60),valor,onde:INI.onde});$('#ini-fx-nome').value='';$('#ini-fx-valor').value='';fixosIni();previaIni();$('#ini-fx-nome').focus()};
$('#ini-fixos').onclick=e=>{const b=e.target.closest('[data-rm]');if(!b)return;INI.fixos.splice(+b.dataset.rm,1);fixosIni();previaIni()};
$('#ini-volta').onclick=()=>passoIni(Math.max(1,INI.p-1));
$('#ini-ok').onclick=()=>{
  if(INI.p===2&&!(lerReais($('#ini-sal').value)>0)){toast('Digite o salário para continuar.');$('#ini-sal').focus();return}
  if(INI.p===3&&$('#ini-fx-nome').value.trim()&&lerReais($('#ini-fx-valor').value)>0)$('#ini-fx-add').click();
  if(INI.p<4){passoIni(INI.p+1);return}
  const c=cfgIni();mesSel=null;gMesRef=null;closeSheet();saveConfig(c);
  toast(c.inicio>mesDoDia(new Date())?`Plano pronto. Ele começa em ${diaCurto(periodo(c.inicio).ini)}.`:`Plano pronto. Nesta semana dá para gastar até ${money(limBloco(plano(mesDoDia(new Date())),blocoDe(new Date())))}.`)};

/* ---------- movimento ----------
   Cartão da semana: inclina um pouco na direção do dedo ou do mouse e as formas do fundo se movem junto.
   Puxar para atualizar (celular): no topo da tela, arrastar para baixo desenha o símbolo do Leve; soltar depois
   do ponto atualiza os dados. Barra lateral: o símbolo se desenha de novo ao passar o mouse.
   Com "reduzir movimento" ligado, nada inclina nem flutua; puxar para atualizar continua funcionando. */
if(!reduce){
  const inclina=e=>{const r=hero.getBoundingClientRect(),x=Math.max(-.5,Math.min(.5,(e.clientX-r.left)/r.width-.5)),y=Math.max(-.5,Math.min(.5,(e.clientY-r.top)/r.height-.5));
    hero.style.setProperty('--rx',(-y*8).toFixed(2)+'deg');hero.style.setProperty('--ry',(x*10).toFixed(2)+'deg');
    hero.style.setProperty('--px',x.toFixed(3));hero.style.setProperty('--py',y.toFixed(3));hero.classList.add('mexe')};
  const solta=()=>{hero.classList.remove('mexe');['--rx','--ry'].forEach(k=>hero.style.setProperty(k,'0deg'));['--px','--py'].forEach(k=>hero.style.setProperty(k,'0'))};
  hero.addEventListener('pointermove',inclina);hero.addEventListener('pointerdown',inclina);
  ['pointerleave','pointercancel','pointerup'].forEach(ev=>hero.addEventListener(ev,solta));
  const tb=$('.tb-marca');if(tb)tb.addEventListener('mouseenter',()=>{tb.classList.remove('redesenha');void tb.offsetWidth;tb.classList.add('redesenha')});
}
(function puxarParaAtualizar(){
  const ind=$('#puxar');if(!ind||!('ontouchstart' in window))return;
  const LIM=86;let y0=null,dy=0,ocupado=false;
  const pode=()=>S.uid&&S.loaded&&window.scrollY<=0&&!$('.sheet.on')&&$('#gate').hidden&&!document.body.classList.contains('is-locked');
  const zera=()=>{ind.classList.remove('on','pronto','girando');ind.style.setProperty('--p','0');ind.style.setProperty('--y','0px')};
  document.addEventListener('touchstart',e=>{y0=!ocupado&&pode()&&e.touches.length===1&&e.touches[0].clientX>24?e.touches[0].clientY:null;dy=0},{passive:true});
  document.addEventListener('touchmove',e=>{if(y0===null)return;dy=e.touches[0].clientY-y0;
    if(dy<=0||window.scrollY>0){zera();return}
    if(e.cancelable)e.preventDefault();
    const p=Math.min(1,dy/LIM);ind.classList.add('on');ind.classList.toggle('pronto',p>=1);
    ind.style.setProperty('--p',p.toFixed(3));ind.style.setProperty('--y',Math.min(dy*.85,100).toFixed(1)+'px')},{passive:false});
  document.addEventListener('touchend',async()=>{if(y0===null)return;y0=null;
    if(dy>=LIM&&!ocupado){ocupado=true;ind.classList.add('girando');ind.style.setProperty('--y','76px');
      try{await reload()}finally{await new Promise(r=>setTimeout(r,450));ocupado=false;zera()}}
    else zera();dy=0},{passive:true});
})();

/* ---------- atalhos de teclado (computador) ----------
   N nova saída · / buscar no Extrato · 1, 2, 3 trocam de aba · Esc fecha o painel. Não valem enquanto se digita. */
document.addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey||e.altKey||e.defaultPrevented)return;const t=e.target;
  if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable))return;
  if(!S.uid||!S.config||!$('#gate').hidden||document.body.classList.contains('is-locked'))return;
  if($('.sheet.on')){if(e.key==='Escape'&&!$('#sheet').classList.contains('on'))closeSheet();return}
  const k=e.key.toLowerCase();
  if(k==='n'){e.preventDefault();openSheet()}
  else if(k==='/'){e.preventDefault();if(tab!==2)switchTab(2);setTimeout(()=>$('#g-busca').focus(),60)}
  else if(k==='1')switchTab(0);else if(k==='2')switchTab(2);else if(k==='3')switchTab(4)});

/* ---------- boot ---------- */
requestAnimationFrame(moveBlob);netBanner();
init().catch(e=>{console.error(e);showGate('email');gMsg('Não deu para conectar. Confira a internet.',true)});
})();
