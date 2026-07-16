/* FABLEHIVE ROOM SERVER - one process, the whole game.
   CRASH CONFESSION: any uncaught throw writes its full stack to crash.log before systemd revives us -
   the next 'random boot' will name its own killer. */
process.on('uncaughtException',e=>{try{require('fs').appendFileSync('/opt/fablehive/crash.log',new Date().toISOString()+' '+((e&&e.stack)||e)+'\n');}catch(_){}process.exit(1);});
/* ============ THE REMEMBERING, stage 0: the meadow remembers souls ============
   Zero dependencies by law (autodeploy never npm-installs): a JSON ledger + HMAC tokens.
   A soul = {xp, ow[], eq, skin, name}. The token is id.sig - unforgeable, minted at first join.
   The HIVE CODE (first 10 hex of the id) reunites devices until the email claim arrives. */
const _cr=require('crypto'),_fsS=require('fs');
const SOULP=(process.env.SOULS||'/opt/fablehive/souls.json'),KEYP=(process.env.SOULKEY||'/opt/fablehive/soul.key');
let SKEY='';try{SKEY=_fsS.readFileSync(KEYP,'utf8').trim();}catch(e){SKEY=_cr.randomBytes(24).toString('hex');try{_fsS.writeFileSync(KEYP,SKEY);}catch(e2){}}
const SUPKEYP=(process.env.SUPKEY||'/opt/fablehive/sup.key'); /* THE KEEPER'S KEY: cat /opt/fablehive/sup.key on the droplet once, then read /supportz?k=KEY in a browser */
let SUPK='';try{SUPK=_fsS.readFileSync(SUPKEYP,'utf8').trim();}catch(e){SUPK=_cr.randomBytes(6).toString('hex');try{_fsS.writeFileSync(SUPKEYP,SUPK);}catch(e2){}}
const KEEPERP=(process.env.KEEPERPW||'/opt/fablehive/keeper.pw'); /* r73: the OWNER's own dashboard password - they set it ONCE in the dashboard; unset until then, never a machine-generated key */
let KSALT='',KWH='';try{const _kk=_fsS.readFileSync(KEEPERP,'utf8').trim().split(':');if(_kk.length===2){KSALT=_kk[0];KWH=_kk[1];}}catch(e){}
let SOULS={},DEEDS=null;
try{const _raw=JSON.parse(_fsS.readFileSync(SOULP,'utf8'))||{};
 if(_raw&&_raw.souls){SOULS=_raw.souls||{};DEEDS=_raw.deeds||null;}else SOULS=_raw;}catch(e){SOULS={};}
const DEDGE={h:[0,50,120,250,500,1000,2000,4000,8000,16000],p:[0,3,6,10,16,24,40,60,90,120],qk:[0,1,2,3,5,8,12],bk:[0,1,2,3,5],wk:[0,1,2,4,8,16],wl:[0,2,5,10,20,40],tf:[0,5,12,25,50,100],sp:[0,1,2,4,8],m:[0,1,2,5,10,20,40]};
if(!DEEDS||!DEEDS.hist){DEEDS={tot:0,hist:{},tops:{},day:''};for(const k in DEDGE)DEEDS.hist[k]=DEDGE[k].map(()=>0);}
for(const k in DEDGE)if(!DEEDS.hist[k])DEEDS.hist[k]=DEDGE[k].map(()=>0); /* r61: NEW deed keys (wl,tf) join a LIVING ledger - the old guard only rebuilt when hist was missing entirely */
const DEEDBASE={};for(const k in DEDGE)DEEDBASE[k]=DEDGE[k].map((_,j)=>Math.max(1,Math.round(8*Math.pow(0.55,j)))); /* r69 THE DEEDS READ FAIR: a small synthetic 'prior' (most players low, few high) so a tiny live cohort still yields a REAL percentile instead of 0%/50% - compute-time only, never persisted into the ledger */
const deedDay=()=>new Date().toISOString().slice(0,10);
function deedFlight(sid,st){ /* THE LEDGER OF DEEDS: every flight buckets into the world's histogram - percentiles, not a lone arcade number */
 if(DEEDS.day!==deedDay()){DEEDS.day=deedDay();DEEDS.tops={};}
 DEEDS.tot++;const S=SOULS[sid];const nm=(S&&S.name)||'a queen';
 for(const k in DEDGE){const v=Math.max(0,Math.min(1e7,+st[k]||0));
  let i=0;const E=DEDGE[k];while(i<E.length-1&&v>=E[i+1])i++;DEEDS.hist[k][i]++;
  const tp=DEEDS.tops[k];if(!tp||v>tp.v)DEEDS.tops[k]={v:v,n:nm};}
 if(S){S.life=S.life||{n:0,best:{}};S.life.n++;S.tot=S.tot||{};
  for(const k in DEDGE){const v=Math.max(0,Math.min(1e7,+st[k]||0));S.life.best[k]=Math.max(S.life.best[k]||0,v);S.tot[k]=Math.min(1e9,(S.tot[k]||0)+v);}}
 soulDirty=1;}
function deedPct(st){const out={};for(const k in DEDGE){const v=Math.max(0,+st[k]||0);const E=DEDGE[k],H=DEEDS.hist[k],B=DEEDBASE[k];
 let i=0;while(i<E.length-1&&v>=E[i+1])i++;let below=0,tot=0;for(let j=0;j<H.length;j++){const c=H[j]+B[j];tot+=c;if(j<i)below+=c;else if(j===i)below+=c*0.5;} /* r69 THE DEEDS READ FAIR: your OWN bucket counts HALF (within-bucket/tie credit) so tying the floor is never a flat 0%, and the baseline B smooths a tiny cohort - every death screen now finds at least one dimension you beat */
 out[k]=Math.round(100*below/Math.max(1,tot));}return out;}
function deedTop(){const a=[];for(const id in SOULS){const s=SOULS[id],t=s.tot; /* TOP PLAYERS by decree: ranks 1-10, name, TOTAL honey banked, TOTAL queens felled - lifetime, per soul */
 if(!t||!((t.h|0)||(t.qk|0)))continue;a.push([String(s.name||s.user||'a queen').slice(0,16),(t.h||0)|0,(t.qk||0)|0]);}
 a.sort((x,y)=>y[1]-x[1]);const _sn={},_dt=[];for(const _r of a){if(!_sn[_r[0]]){_sn[_r[0]]=1;_dt.push(_r);}}return _dt.slice(0,10);}
let soulDirty=0;try{for(const _id in SOULS){const _s=SOULS[_id];if(_s&&(_s.user==='zz_r86probe'||_s.name==='zz_r86probe'||_id==='zz_r86probe')){delete SOULS[_id];soulDirty=1;}}}catch(e){} /* r93: one-time removal of the /idz test soul */setInterval(()=>{if(!soulDirty)return;soulDirty=0;try{const _s0=process.hrtime.bigint();_fsS.writeFileSync(SOULP,JSON.stringify({souls:SOULS,deeds:DEEDS}));const _sd=Number(process.hrtime.bigint()-_s0)/1e6;if(_sd>(DIAG.saveMaxMs||0))DIAG.saveMaxMs=_sd;}catch(e){}},4000).unref&&setInterval(()=>{},1e9);
const soulSig=id=>_cr.createHmac('sha256',SKEY).update(id).digest('hex').slice(0,20);
const soulMint=()=>{const id=_cr.randomBytes(9).toString('hex');SOULS[id]={xp:0,ow:[],eq:null,skin:0,name:'',mk:Date.now(),seen:Date.now()};soulDirty=1;return id;};
const soulOf=tok=>{if(typeof tok!=='string'||tok.length>80)return null;const i=tok.indexOf('.');if(i<1)return null;const id=tok.slice(0,i);if(!/^[a-f0-9]{18}$/.test(id))return null;if(soulSig(id)!==tok.slice(i+1))return null;return SOULS[id]?id:null;};
const soulPack=id=>{const s=SOULS[id];return {tok:id+'.'+soulSig(id),code:id.slice(0,10),meta:{xp:s.xp|0,ow:s.ow||[],eq:s.eq||null,skin:s.skin|0,name:s.name||''}};};
const wordHash=(pw,salt)=>_cr.scryptSync(String(pw),salt,32).toString('hex');
const keeperOk=cred=>{if(!KWH||!KSALT||!cred)return false;try{return wordHash(cred,KSALT)===KWH;}catch(e){return false;}}; /* r73: does this credential match the owner's own dashboard password? */
const userOk=u=>typeof u==='string'&&/^[a-z0-9_]{3,16}$/.test(u);
const userFind=u=>{for(const id in SOULS)if(SOULS[id].user===u)return id;return null;};
const soulEqOk=q=>{if(!q||typeof q!=='object'||Array.isArray(q))return null;const o={};for(const k of ['pattern','crown','trail','wings','body','tail','fleet','aura','plate','eye']){const v=q[k];if(typeof v==='string'&&v.length<=24&&/^[a-zA-Z0-9_-]+$/.test(v))o[k]=v;}return Object.keys(o).length?o:null;};
/*
   Serves the game page over HTTP and the authoritative sim over WebSocket on the SAME port.
   Punch the URL, press RISE, you're online. */
const fs=require('fs'),vm=require('vm'),path=require('path'),http=require('http');
/* --- TEMP DIAGNOSTIC TELEMETRY: event-loop lag + GC pauses + heap, to locate the multi-second freezes --- */
const {PerformanceObserver}=require('perf_hooks');
const DIAG={gcCount:0,gcTotalMs:0,gcMaxMs:0,elLagMaxMs:0,maxBufBytes:0,dropped:0,netMaxMs:0,joinMaxMs:0,genMaxMs:0,tickMaxMs:0,saveMaxMs:0};
try{new PerformanceObserver(l=>{for(const e of l.getEntries()){DIAG.gcCount++;DIAG.gcTotalMs+=e.duration;if(e.duration>DIAG.gcMaxMs)DIAG.gcMaxMs=e.duration;}}).observe({entryTypes:['gc']});}catch(e){}
const STALLS=[],BUYS=[],IDR={}; /* the SPIKE LEDGER: every event-loop freeze >300ms is logged with its moment, so a live healthz poll during a playtest shows exactly WHEN the world hitched and how hard */
{let _t=Date.now();setInterval(()=>{const n=Date.now(),lag=n-_t-100;if(lag>DIAG.elLagMaxMs)DIAG.elLagMaxMs=lag;
 if(lag>300){STALLS.push({t:n,ms:lag|0,heap:(process.memoryUsage().heapUsed/1048576)|0});if(STALLS.length>10)STALLS.shift();}
 _t=n;},100);}

function makeGame(htmlPath){
 const html=fs.readFileSync(htmlPath,'utf8');
 const js=html.match(/<script>([\s\S]*)<\/script>/)[1];
 const mkctx=()=>new Proxy({},{get:(t,k)=>{
  if(k==='measureText')return()=>({width:10});
  if(k==='canvas')return{width:900,height:600};
  if(k==='createRadialGradient'||k==='createLinearGradient'||k==='createPattern')return()=>({addColorStop:()=>{}});
  return()=>{};},set:()=>true});
 const el=()=>({style:{},innerHTML:'',textContent:'',getContext:mkctx,addEventListener:()=>{},setAttribute:()=>{},appendChild:()=>{},querySelectorAll:()=>[],width:0,height:0,getAttribute:()=>null,parentNode:null});
 const doc={getElementById:el,createElement:el,querySelectorAll:()=>[],body:{appendChild:()=>{}}};
 const ctx={document:doc,window:{},addEventListener:()=>{},innerWidth:900,innerHeight:600,devicePixelRatio:1,
  navigator:{maxTouchPoints:0},performance:{now:()=>Date.now()},requestAnimationFrame:()=>{},
  localStorage:undefined,setInterval:()=>0,clearInterval:()=>{},setTimeout:()=>0,clearTimeout:()=>{},
  console,Math,Date,JSON,isFinite,parseInt,parseFloat};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(js,ctx);
 return ctx.window.__G;
}

const HTMLCACHE={buf:null,t:0};
function start(port,htmlPath){
 const {WebSocketServer}=require('ws');
 const HTML=htmlPath||path.join(__dirname,fs.existsSync(path.join(__dirname,'index.html'))?'index.html':'BROOD.html');
 let G=makeGame(HTML);G.unlockAll&&G.unlockAll();G.setRoom&&G.setRoom(true);
 const SEATS=[0,1,2,3,4,5];
 const seats={};
 let lastEmpty=Date.now();
 /* THE WILD & THE FRESH MEADOW: unoccupied seats play as the wild (bots); an EMPTY room IDLES
    instead of grinding a bot war for nobody; and the first arrival into an empty room begins in a
    FRESH, light meadow rather than an hours-old, overgrown one no 60Hz tick can hold. */
 function applyWild(){for(const t of SEATS){const sw=G.swarms.find(z=>z.team===t&&!z.ally);
  if(sw){if(seats[t]!==undefined){sw.bot=false;}else{sw.bot=true;delete sw.forceAim;if(t===0)sw.name='Wilder';}}}}
 function freshWorld(){G=makeGame(HTML);G.unlockAll&&G.unlockAll();G.setRoom&&G.setRoom(true);applyWild();} /* the BAKERY is reverted: pre-baking spare worlds cost ~400ms ON THE MAIN LOOP whenever it ran - a stall generator hitting OCCUPIED rooms, plus a permanently-parked spare VM (~100MB RSS). The original "cost" it cured only ever hit an EMPTY room's first joiner, once */
 applyWild();
 const httpSrv=http.createServer((req,res)=>{
  const u=(req.url||'/').split('?')[0];
  res.setHeader('Access-Control-Allow-Origin','*'); /* r64 THE OPEN WINDOW: read endpoints (healthz/deployz/roster) readable by the Hive Monitor dashboard from any origin */
  if(u==='/'||u==='/index.html'||u==='/BROOD.html'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
   if(!HTMLCACHE.buf||HTMLCACHE.t!==fs.statSync(HTML).mtimeMs){HTMLCACHE.buf=fs.readFileSync(HTML);HTMLCACHE.t=fs.statSync(HTML).mtimeMs;} /* the page lives in RAM: a 300KB synchronous disk read per refresh was a mid-session stall */
   res.end(HTMLCACHE.buf);
  } else if(u==='/healthz'){ /* TELEMETRY: lag is measured here, never guessed again */
   const h=TICKS.hist.slice().sort((a,b)=>a-b);
   const p95=h.length?h[Math.min(h.length-1,(h.length*0.95)|0)]:0;
   let souls=0;for(const s2 of G.swarms)if(!s2.dead)souls+=s2.units.length;
   const mu=process.memoryUsage();
   const elLag=DIAG.elLagMaxMs,gcMax=DIAG.gcMaxMs,mbuf=DIAG.maxBufBytes,netMx=DIAG.netMaxMs,joinMx=DIAG.joinMaxMs,genMx=DIAG.genMaxMs,tickMx=DIAG.tickMaxMs,saveMx=DIAG.saveMaxMs;DIAG.elLagMaxMs=0;DIAG.gcMaxMs=0;DIAG.maxBufBytes=0;DIAG.netMaxMs=0;DIAG.joinMaxMs=0;DIAG.genMaxMs=0;DIAG.tickMaxMs=0;DIAG.saveMaxMs=0; /* per-interval maxes since last poll */
   res.writeHead(200,{'Content-Type':'application/json'});
   res.end(JSON.stringify({ok:1,seats:Object.keys(seats).length,souls,
    tickAvg:+(TICKS.n?TICKS.sum/TICKS.n:0).toFixed(2),tickP95:p95,upMin:((Date.now()-BOOT)/60000)|0,
    ticks:TICKS.n,elLagMaxMs:elLag,gcCount:DIAG.gcCount,gcMaxMs:+gcMax.toFixed(0),gcTotalMs:+DIAG.gcTotalMs.toFixed(0),
    stalls:STALLS.map(z=>({ago:((Date.now()-z.t)/1000)|0,ms:z.ms,heap:z.heap})),netLateMax:(()=>{const v9=DIAG.netLateMax||0;DIAG.netLateMax=0;return v9;})(),rateSkips:DIAG.rateSkips||0,netMaxMs:+netMx.toFixed(0),joinMaxMs:+joinMx.toFixed(0),genMaxMs:+genMx.toFixed(0),tickMaxMs:+tickMx.toFixed(0),saveMaxMs:+saveMx.toFixed(0),
    buys:BUYS.map(z=>({ago:((Date.now()-z.t)/1000)|0,tm:z.tm,r:z.r,ok:z.ok,u:z.u,h:z.h})),
    seatNet:Object.keys(seats).map(t9=>{const w9=seats[t9],r9=(w9&&w9._rttMax||0)|0;if(w9)w9._rttMax=0;return Object.assign({t:+t9,rtt:(w9&&w9._rttS||0)|0,rttMax:r9,buf:(w9&&w9.bufferedAmount||0)|0},(w9&&w9._cli)||{});}),
    ver:'r101-sixty-hertz',keeperSet:(KWH?1:0),souls:Object.keys(SOULS).length,support:(()=>{try{return _fsS.readFileSync((process.env.SUPPORT||'/opt/fablehive/support.log'),'utf8').split('\n').filter(Boolean).length;}catch(e){return 0;}})(),
    heapMB:(mu.heapUsed/1048576)|0,rssMB:(mu.rss/1048576)|0,maxBufKB:(mbuf/1024)|0,dropped:DIAG.dropped}));}
  else if(req.url.indexOf('/crashz')===0){let c='';try{c=_fsS.readFileSync('/opt/fablehive/crash.log','utf8').slice(-4000);}catch(e){c='(no crashes logged)';}res.writeHead(200,{'Content-Type':'text/plain'});res.end(c);} /* the CONFESSOR reads aloud */
  else if(req.url.indexOf('/deployz')===0){let c='';try{c=_fsS.readFileSync('/var/log/fablehive-deploy.log','utf8').slice(-4000);}catch(e){c='(no deploys logged)';}res.writeHead(200,{'Content-Type':'text/plain'});res.end(c);} /* and the deploy ledger too - 'updates without updates' becomes a lookup */
  else if(req.url.indexOf('/supportz')===0){ /* THE KEEPER'S POST: the support notes, key-gated */
   let k9='';try{k9=(req.headers['x-keeper']||((req.url.split('k=')[1]||'').split('&')[0])||'').trim();}catch(e){}
   if((SUPK&&k9===SUPK)||keeperOk(k9)){let c='';try{c=_fsS.readFileSync((process.env.SUPPORT||'/opt/fablehive/support.log'),'utf8').slice(-8000);}catch(e){c='(no support notes yet)';}res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});res.end(c);}
   else{res.writeHead(403);res.end('the keeper alone reads these');}}
  else if(u==='/roster'){ /* THE HIVE'S NAMED SOULS: read-only, additive, touches nothing else - Celery's dashboard */
   const list=[];
   for(const id in SOULS){
    const s=SOULS[id];
    if(!s||!s.name)continue; // only players who actually claimed a name
    const t=s.tot||{};
    list.push({name:String(s.name).slice(0,16),xp:s.xp|0,wardrobe:(s.ow||[]).length,
     honey:(t.h||0)|0,queensFelled:(t.qk||0)|0,flights:(s.life&&s.life.n)||0});
   }
   list.sort((a,b)=>b.honey-a.honey);{const _sn={},_dl=[];for(const _p of list){if(!_sn[_p.name]){_sn[_p.name]=1;_dl.push(_p);}}list.length=0;for(const _p of _dl)list.push(_p);}
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-cache'});
   res.end(JSON.stringify({count:list.length,players:list.slice(0,200)}));}
  else if(u==='/dash'){ /* r64 THE OPEN WINDOW: one page that watches the whole hive - served from disk, same-origin (no key ever leaves the browser) */
   try{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(_fsS.readFileSync(path.join(__dirname,'dash.html')));}
   catch(e){res.writeHead(404);res.end('dashboard not installed');}}
  else if(req.url.indexOf('/chatz')===0){ /* r73 GLOBAL CHAT: the room's recent speech, keeper-gated */
   let k9='';try{k9=(req.headers['x-keeper']||((req.url.split('k=')[1]||'').split('&')[0])||'').trim();}catch(e){}
   if((SUPK&&k9===SUPK)||keeperOk(k9)){let c='';try{c=_fsS.readFileSync((process.env.CHATLOG||'/opt/fablehive/chat.log'),'utf8').slice(-8000);}catch(e){c='';}res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8'});res.end(c);}
   else{res.writeHead(403);res.end('the keeper alone reads these');}}
  else if(req.url.indexOf('/keeperset')===0){ /* r73: the owner sets their dashboard password ONCE (claim-on-first-use); never overwritten once set */
   let pw='';try{pw=(req.headers['x-keeper']||decodeURIComponent(((req.url.split('pw=')[1]||'').split('&')[0])||'')||'').trim();}catch(e){}
   if(KWH){res.writeHead(200,{'Content-Type':'text/plain'});res.end('set');}
   else if(pw.length<4){res.writeHead(400);res.end('too short');}
   else{KSALT=_cr.randomBytes(12).toString('hex');KWH=wordHash(pw,KSALT);try{_fsS.writeFileSync(KEEPERP,KSALT+':'+KWH);}catch(e){}res.writeHead(200,{'Content-Type':'text/plain'});res.end('ok');}}
  else if(u==='/idz'&&req.method==='POST'){let body='',bad=false;req.on('data',ch=>{body+=ch;if(body.length>1200){bad=true;try{req.destroy();}catch(e){}}});req.on('end',()=>{if(bad)return;let m;try{m=JSON.parse(body);}catch(e){res.writeHead(400);res.end('{}');return;}const ip=(''+(req.headers['x-forwarded-for']||(req.socket&&req.socket.remoteAddress)||'?')).split(',')[0].trim();const nt=Date.now();IDR[ip]=(IDR[ip]||[]).filter(t=>nt-t<60000);res.writeHead(200,{'Content-Type':'application/json'});if(IDR[ip].length>=12){res.end(JSON.stringify({deny:'too many tries - wait a minute'}));return;}IDR[ip].push(nt);const uu=(''+(m.u||'')).toLowerCase().trim(),pw=''+(m.p||'');if(!userOk(uu)||pw.length<6){res.end(JSON.stringify({deny:'name: 3-16 letters/numbers, word: 6+ characters'}));return;}const existing=userFind(uu);if(existing){if(SOULS[existing].wh===wordHash(pw,SOULS[existing].salt)){SOULS[existing].seen=nt;soulDirty=1;res.end(JSON.stringify(Object.assign({ok:1},soulPack(existing))));}else res.end(JSON.stringify({deny:'wrong word (or that name is taken)'}));}else{let sid=soulOf(m.tok)||soulMint();if(!SOULS[sid])sid=soulMint();const S=SOULS[sid];S.user=uu;S.salt=_cr.randomBytes(12).toString('hex');S.wh=wordHash(pw,S.salt);if(!S.name)S.name=uu;S.seen=nt;soulDirty=1;res.end(JSON.stringify(Object.assign({ok:1,claimed:1},soulPack(sid))));}});try{req.on('error',()=>{});}catch(e){}}
  else{res.writeHead(404);res.end('the meadow has no such door');}
 });
 const wss=new WebSocketServer({server:httpSrv,maxPayload:1<<20,
  perMessageDeflate:{threshold:600,concurrencyLimit:4, /* THE GREAT COMPRESSION: JSON frames are digit-soup with identical keys every beat - a shared deflate window turns 196KB/s into ~44KB/s per client (probe-measured 4.5x). Level 1: the CPU cost is ~1.5ms/frame, the WiFi cost of NOT doing it was the whole ms hellhole */
   zlibDeflateOptions:{level:1,memLevel:7}}});
 wss.on('connection',ws=>{
  try{ws._socket&&ws._socket.setNoDelay&&ws._socket.setNoDelay(true);}catch(e){} /* no Nagle: frames leave the MOMENT they exist */
  let team=null;
  ws._seen=Date.now(); /* THE PULSE: every living client pings ~2s; a seat that goes silent is a ghost, not a guest */
  ws.on('message',buf=>{let m;try{m=JSON.parse(buf);}catch(e){return;}
   ws._seen=Date.now();
   if(m.k==='join'&&team===null){
    const wasEmpty=Object.keys(seats).length===0;
    for(const t of SEATS)if(seats[t]===undefined){team=t;break;}
    if(team===null){ws.send(JSON.stringify({k:'full'}));ws.close();return;}
    seats[team]=ws;
    if(wasEmpty&&Date.now()-lastEmpty>15000){const _g0=process.hrtime.bigint();freshWorld();const _gd=Number(process.hrtime.bigint()-_g0)/1e6;if(_gd>(DIAG.genMaxMs||0))DIAG.genMaxMs=_gd;} /* only reset a LONG-empty room, so devices/friends joining close together SHARE the world */ /* a lone arrival into an empty room begins in a clean, light meadow */
    const s=G.swarms.find(z=>z.team===team&&!z.ally);
    if(s){s.bot=false;s.name=(''+(m.n||'Queen')).slice(0,16).replace(/[<>&"']/g,'');delete s.forceAim;
     s.dead=false;try{G.reviveSwarm(s);}catch(e){}s.honey=150;
     {const okc=v=>(typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v))?v:null; /* SHE ARRIVES DRESSED: colour + wardrobe ride the join (sanitized), so every frame shows the player as they chose to look - not as the seat's random bot */
      const c9=okc(m.c);if(c9)s.col=c9;s.col2=okc(m.c2);
      let q9=null;if(m.q&&typeof m.q==='object'&&!Array.isArray(m.q)){q9={};for(const k of ['pattern','crown','trail','wings','body','tail','fleet','aura','plate','eye']){const v=m.q[k];if(typeof v==='string'&&v.length<=24&&/^[a-zA-Z0-9_-]+$/.test(v))q9[k]=v;}if(!Object.keys(q9).length)q9=null;}
      s.cosEq=q9;}} /* FRESH QUEEN on join: never the wild bot's grown body - and she arrives with 150 honey, enough for her FIRST SOLDIER or two foragers, so the opening minute is choices, not poverty (30 was famine) */
    let sid=soulOf(m.tok)||ws._soul||soulMint();if(!SOULS[sid])sid=soulMint();ws._soul=sid; /* token first (returning device), then a soul claimed at the menu before RISE, then fresh */SOULS[sid].seen=Date.now();soulDirty=1; /* the meadow remembers you now */
    if(m.ref&&typeof m.ref==='string'&&/^[a-f0-9]{10}$/.test(m.ref)&&!SOULS[sid].ref&&!SOULS[sid].refPaid&&(Date.now()-SOULS[sid].mk)<604800000&&m.ref!==sid.slice(0,10)){SOULS[sid].ref=m.ref;soulDirty=1;} /* r71 THE FRIEND ARRIVES: a soul within its first WEEK may name who sent it - once, never itself (was 1h, too tight for a friend who first tried the game days ago) */
    {const _j0=process.hrtime.bigint();ws.send(JSON.stringify({k:'init',you:team,world:G.netWorldInit(),soul:soulPack(sid)}));const _jd=Number(process.hrtime.bigint()-_j0)/1e6;if(_jd>(DIAG.joinMaxMs||0))DIAG.joinMaxMs=_jd;}
   } else if(m.k==='cmd'&&team!==null){try{
    if(m.c&&m.c.buy){ /* THE BUY LEDGER: every recruit order is receipted - "I paid and nothing spawned" becomes a lookup, not a mystery */
     const s9=G.swarms.find(z=>z.team===team&&!z.ally);const b4=s9?s9.units.length:-1,h4=s9?(s9.honey|0):-1;
     G.applyInput(team,m.c||{});
     const a4=s9?s9.units.length:-1;
     BUYS.push({t:Date.now(),tm:team,r:(''+m.c.buy).slice(0,10),ok:a4>b4?1:0,u:a4,h:h4});if(BUYS.length>24)BUYS.shift();
     if(a4<=b4){try{ws.send(JSON.stringify({k:'deny',r:(''+m.c.buy).slice(0,10)}));}catch(e){}}} /* a refused order is SAID, not swallowed - 'the button did nothing' becomes a message */
    else{if(m.c&&typeof m.c.say==='string'&&m.c.say.trim()){ws._sayN=(ws._sayN||0)+1;if(ws._sayN<=250){try{const _cs=G.swarms.find(z=>z.team===team&&!z.ally);_fsS.appendFileSync((process.env.CHATLOG||'/opt/fablehive/chat.log'),JSON.stringify({t:new Date().toISOString(),name:(_cs&&_cs.name)||'a queen',msg:(''+m.c.say).slice(0,80)})+'\n');}catch(e){}}} /* r73 GLOBAL CHAT: log each spoken line (name + text) so the keeper can read the room; capped 250/connection */G.applyInput(team,m.c||{});}}catch(e){}}
   else if(m.k==='dress'&&team!==null){try{ /* MID-FLIGHT WARDROBE: sanitized exactly like the join - the NEST's changes land on the live queen and ride the next full beat */
    const s=G.swarms.find(z=>z.team===team&&!z.ally);
    if(s){if(typeof m.n==='string'&&m.n.trim())s.name=(''+m.n).slice(0,16).replace(/[<>&"']/g,''); /* r72 RENAME WHILE PLAYING: the name rides dress now, sanitized exactly like the join */
     const okc=v=>(typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v))?v:null;
     const c9=okc(m.c);if(c9)s.col=c9;s.col2=okc(m.c2);
     let q9=null;if(m.q&&typeof m.q==='object'&&!Array.isArray(m.q)){q9={};for(const k of ['pattern','crown','trail','wings','body','tail','fleet','aura','plate','eye']){const v=m.q[k];if(typeof v==='string'&&v.length<=24&&/^[a-zA-Z0-9_-]+$/.test(v))q9[k]=v;}if(!Object.keys(q9).length)q9=null;}
     s.cosEq=q9;}}catch(e){}}
   else if(m.k==='meta'&&ws._soul&&SOULS[ws._soul]){const S=SOULS[ws._soul]; /* progression climbs, never teleports: grow-only, capped per push */
    const nx=+m.xp;if(isFinite(nx)&&nx>S.xp)S.xp=Math.min(nx|0,S.xp+20000,5e6);
    if(Array.isArray(m.ow)){const seen={};for(const o of S.ow)seen[o]=1;
     for(const o of m.ow.slice(0,80)){if(typeof o==='string'&&o.length<=24&&/^[a-zA-Z0-9_-]+$/.test(o)&&!seen[o]){S.ow.push(o);seen[o]=1;if(S.ow.length>200)break;}}}
    const q=soulEqOk(m.eq);if(q)S.eq=q;
    const sk=+m.skin;if(isFinite(sk)&&sk>=0&&sk<48)S.skin=sk|0;
    if(typeof m.name==='string')S.name=m.name.slice(0,16);
    S.seen=Date.now();soulDirty=1;}
   else if(m.k==='flight'&&ws._soul&&m.st&&typeof m.st==='object'){
    if(!ws._flN)ws._flN=0;if(++ws._flN<=30){deedFlight(ws._soul,m.st);
     {const S0=SOULS[ws._soul]; /* THE REFERRAL PROOF: the friend must actually FLY (3+ minutes) before anyone is paid - capped 5/day per referrer */
      if(S0&&S0.ref&&!S0.refPaid){S0.refMin=(S0.refMin||0)+Math.max(0,+m.st.m||0);soulDirty=1;} /* r72 SOFTER FRIEND REWARD: minutes accrue ACROSS sittings - the 3-min proof needn't happen in one go */
      if(S0&&S0.ref&&!S0.refPaid&&(S0.refMin||0)>=3){let rid=null;for(const id in SOULS){if(id.slice(0,10)===S0.ref){rid=id;break;}}
       if(rid&&rid!==ws._soul){const R0=SOULS[rid];if(R0.refDay!==deedDay()){R0.refDay=deedDay();R0.refD=0;}
        if((R0.refD||0)<3){R0.refD=(R0.refD||0)+1;R0.xp=Math.min((R0.xp|0)+1000,5e6);S0.refPaid=1;soulDirty=1;
         for(const t9 in seats){const w0=seats[t9];if(w0&&w0._soul===rid){try{w0.send(JSON.stringify({k:'refpay',n:(S0.name||'a friend')}));}catch(e){}break;}}}}}}
     try{ws.send(JSON.stringify({k:'deeds',pct:deedPct(m.st),tops:DEEDS.tops,tot:DEEDS.tot,top:deedTop()}));}catch(e){}}}
   else if(m.k==='deeds'){try{ws.send(JSON.stringify({k:'deeds',pct:null,tops:DEEDS.tops,tot:DEEDS.tot,top:deedTop()}));}catch(e){}}
   else if(m.k==='claim'){ if(!ws._soul||!SOULS[ws._soul]){ws._soul=soulMint();} /* NAME + WORD: claim a soul - minted RIGHT HERE if the menu is fresh, so saving a name never requires entering the game first. The word is UNRECOVERABLE: write it down */
    const u=(''+(m.u||'')).toLowerCase().trim(),pw=''+(m.p||'');
    if(!userOk(u)){try{ws.send(JSON.stringify({k:'deny',r:'name: 3-16 letters, numbers, _'}));}catch(e){}}
    else if(pw.length<6){try{ws.send(JSON.stringify({k:'deny',r:'word: 6+ characters'}));}catch(e){}}
    else{const holder=userFind(u);
     if(holder&&holder!==ws._soul){try{ws.send(JSON.stringify({k:'deny',r:'name taken'}));}catch(e){}}
     else{const S=SOULS[ws._soul];S.user=u;S.salt=_cr.randomBytes(12).toString('hex');S.wh=wordHash(pw,S.salt);soulDirty=1;
      try{ws.send(JSON.stringify({k:'claimed',u:u}));}catch(e){}}}}
   else if(m.k==='signin'){ws._siN=(ws._siN||0)+1; /* 5 tries a sitting */
    const u=(''+(m.u||'')).toLowerCase().trim(),pw=''+(m.p||'');
    if(ws._siN>5||!userOk(u)||pw.length<6){try{ws.send(JSON.stringify({k:'deny',r:'sign in'}));}catch(e){}}
    else{const id=userFind(u);
     if(id&&SOULS[id].wh===wordHash(pw,SOULS[id].salt)){ws._soul=id;SOULS[id].seen=Date.now();soulDirty=1;
      try{ws.send(JSON.stringify({k:'soul',...soulPack(id)}));}catch(e){}}
     else{try{ws.send(JSON.stringify({k:'deny',r:'sign in'}));}catch(e){}}}}
   else if(m.k==='support'){ws._supN=(ws._supN||0)+1; /* CONTACT THE KEEPER: a message and a way back - Celery answers personally at this scale */
    if(ws._supN<=3&&typeof m.msg==='string'&&m.msg.trim()){
     const line=JSON.stringify({t:new Date().toISOString(),soul:ws._soul||null,code:(ws._soul||'').slice(0,10),name:(SOULS[ws._soul]&&SOULS[ws._soul].name)||'',contact:(''+(m.contact||'')).slice(0,60),msg:(''+m.msg).slice(0,400)});
     try{_fsS.appendFileSync((process.env.SUPPORT||'/opt/fablehive/support.log'),line+'\n');}catch(e){}
     try{ws.send(JSON.stringify({k:'supported'}));}catch(e){}}
    else{try{ws.send(JSON.stringify({k:'deny',r:'support'}));}catch(e){}}}
   else if(m.k==='adopt'){ws._adoptN=(ws._adoptN||0)+1; /* 5 guesses per sitting - a hive code is a KEY */
    if(ws._adoptN<=5&&typeof m.code==='string'&&/^[a-f0-9]{10}$/.test(m.code.trim().toLowerCase())){
     const c=m.code.trim().toLowerCase();let hit=null;for(const id in SOULS){if(id.slice(0,10)===c){hit=id;break;}}
     if(hit){ws._soul=hit;SOULS[hit].seen=Date.now();soulDirty=1;try{ws.send(JSON.stringify({k:'soul',...soulPack(hit)}));}catch(e){}}
     else{try{ws.send(JSON.stringify({k:'deny',r:'hive code'}));}catch(e){}}}
    else{try{ws.send(JSON.stringify({k:'deny',r:'hive code'}));}catch(e){}}}
   else if(m.k==='p'){const r9=+m.r||0;if(r9>0&&r9<60000){ws._rttS=(ws._rttS==null?r9:ws._rttS*0.7+r9*0.3);if(r9>(ws._rttMax||0))ws._rttMax=r9;}
    ws._cli={d:(+m.d||0)|0,f:(+m.f||0)|0,q:(+m.q||0)|0,s:(+m.s||0)|0}; /* the client CONFESSES everything: ping, draw ms, fps, quality, sim - per-seat truth on the ledger */
    try{ws.send(JSON.stringify({k:'p',t:m.t}));}catch(e){}}
  });
  ws.on('close',()=>{if(team!==null){delete seats[team];if(!Object.keys(seats).length)lastEmpty=Date.now();
   const s=G.swarms.find(z=>z.team===team&&!z.ally);
   if(s){s.bot=true;delete s.forceAim;}}});
 });
 const reapI=setInterval(()=>{ /* GHOST REAPER: a phone that dropped WiFi leaves a socket that never says close - it would HOLD ITS SEAT for minutes while its player rejoins into a second seat, two half-alive queens tangling. 45s of silence (clients ping every 2s on a REAL timer; phones that dim the screen stop ticking for a while and must not be executed for it) = terminate, seat frees, world moves on */
  const now=Date.now();
  for(const t in seats){const w=seats[t];if(w&&now-(w._seen||0)>45000){try{w.terminate();}catch(e){}}}
 },5000);
 const BOOT=Date.now(),TICKS={n:0,sum:0,hist:[]};
 const DT=1/60;let acc=0,last=Date.now(); /* r101 SIXTY HERTZ: the 30Hz sim was a Fly shared-cpu survival diet (60Hz=~36% CPU -> burst credits drained -> throttle -> the multi-second stalls). The Sydney droplet owns a real core (~10% sustained at 30Hz), so the diet ends: 60Hz halves input-apply + snapshot-sampling quantization (~16ms off every action, everyone). Physics verified dt-robust (4px/3s drift). NET BEATS STAY 30Hz - the client jitter buffer assumes 33ms spacing (NET.clock+=33); only the sim clock doubles. */
 const simI=setInterval(()=>{const now=Date.now();
  if(Object.keys(seats).length===0){last=now;acc=0;return;} /* IDLE when the room is empty: no humans, no grind - the meadow simply waits */
  acc+=(now-last)/1000;last=now;
  if(acc>0.25)acc=0.25;let n=0;
  /* TRUE PER-STEP TIMING: a catch-up burst of 5 steps must never be counted as one slow tick */
  while(acc>=DT&&n<2){ /* catch-up capped at 2: burst gulps starve the beat pipeline - better a hair of time-dilation than a spike */
   const t0=process.hrtime.bigint();
   G.step(DT);
   try{if(G.drainRoomOut){const _ev=G.drainRoomOut();if(_ev)for(const _e of _ev){const _w=seats[_e.seat];if(_w&&_w.readyState===1){try{_w.send(JSON.stringify(_e.m));}catch(_){}}}}}catch(_){} /* R62 THE TRUE CREDIT */
   const el=Number(process.hrtime.bigint()-t0)/1e6;if(el>(DIAG.tickMaxMs||0))DIAG.tickMaxMs=el;
   TICKS.n++;TICKS.sum+=el;TICKS.hist.push(el);if(TICKS.hist.length>300)TICKS.hist.shift();
   acc-=DT;n++;
   if(el>22){acc=Math.min(acc,DT);break;}}},16); /* THE PRESSURE VALVE: a monster brawl can cost 40ms+ per tick (probe: Elder=42ms vs 8 normal). When a tick runs hot, SHED THE SIM BACKLOG, never the net beats - the meadow slows a few percent under an Elder's fury; the wire never chokes behind it */
 let fN=0,_lastNet=Date.now();
 const AOI2=2400*2400; /* AREA OF INTEREST (#3b): each seat receives the units/drops/shots/wasps within 2400px of HER queen - beyond that lies pure invisible bandwidth. 2400 covers the widest screen at the zoom cap (~1830px half-width) plus the 520px troop leash, with margin. Queens/headers of ALL swarms still flow every frame (minimap + war-sense need them); authority is untouched - the FULL world simulates server-side, culling is presentation only */
 const netI=setInterval(()=>{ if(Object.keys(seats).length===0){_lastNet=Date.now();return;} /* 30Hz heartbeat: souls every beat, the slow world every third */
  {const nn=Date.now(),gp=nn-_lastNet;if(gp>66&&gp<30000&&gp>(DIAG.netLateMax||0))DIAG.netLateMax=gp;_lastNet=nn;} /* how late do net beats actually run? (idle/boot gaps excluded - the first samples used to be garbage) */
  const _n0=process.hrtime.bigint();let base;try{base=(fN++%3===0)?G.netDyn():G.netDynLite();}catch(e){return;}
  for(const t in seats){const _w=seats[t];if(!_w)continue;
   const _b0=_w.bufferedAmount||0,_rt0=_w._rttS||0; /* GRACEFUL DEGRADATION: strain is a backed-up buffer OR a confessed high ping (bufferbloat queues in the router where bufferedAmount cannot see). Strained pipes get FEWER, LIGHTER beats until the ping heals - a crude congestion controller, not a cliff */
   const _lvl=(_b0>40960||_rt0>340)?2:(_b0>16384||_rt0>170)?1:0;
   if(_lvl===2&&(fN%3)){DIAG.rateSkips=(DIAG.rateSkips||0)+1;continue;}
   if(_lvl===1&&(fN%2)){DIAG.rateSkips=(DIAG.rateSkips||0)+1;continue;}
   const _diet=(_lvl>0||_b0>8192)&&(fN%2===1);
   let f;
   try{
    const me9=G.swarms.find(z=>z.team===+t&&!z.ally);
    if(!me9||me9.dead){f=JSON.stringify({k:'f',...base});} /* dead or seatless: see everything (the death-cam owes you the whole meadow) */
    else{
     const qx=me9.x,qy=me9.y;
     const o={...base};
     o.sw=base.sw.map(w=>{if(w.d||w.i===+t)return w; /* your own team (kin included) is never culled */
      const dx=w.x-qx,dy=w.y-qy;
      if(dx*dx+dy*dy>=AOI2)return {id:w.id,i:w.i,n:w.n,c:w.c,c2:w.c2,q:w.q,p:w.p,x:w.x,y:w.y,h:w.h,H:w.H,a:w.a,y2:w.y2,f:w.f,w:w.w,u:[]}; /* far swarm: header stays (minimap, war arrows), units stay home */
      if(_diet)return {id:w.id,i:w.i,n:w.n,c:w.c,c2:w.c2,q:w.q,p:w.p,x:w.x,y:w.y,h:w.h,H:w.H,a:w.a,y2:w.y2,f:w.f,w:w.w}; /* diet beat: u OMITTED (not emptied) - the client keeps its bodies */
      return w;});
     if(o.gv)o.gv=o.gv.filter(g9=>{const dx=g9[0]-qx,dy=g9[1]-qy;return dx*dx+dy*dy<AOI2;}); /* groves were HALF the full frame (5.6KB of 10.9KB at 131 souls) - beyond the horizon they are pure invisible bandwidth */
     if(o.dr)o.dr=o.dr.filter(d9=>{const dx=d9[0]-qx,dy=d9[1]-qy;return dx*dx+dy*dy<AOI2;});
     if(o.sh)o.sh=o.sh.filter(d9=>{const dx=d9[0]-qx,dy=d9[1]-qy;return dx*dx+dy*dy<AOI2;});
     if(o.wp)o.wp=o.wp.filter(d9=>{const dx=d9[0]-qx,dy=d9[1]-qy;return dx*dx+dy*dy<AOI2;});
     f=JSON.stringify({k:'f',...o});}
   }catch(e){try{f=JSON.stringify({k:'f',...base});}catch(e2){continue;}}
   const _b=_w.bufferedAmount||0;if(_b>DIAG.maxBufBytes)DIAG.maxBufBytes=_b;
   if(_b<65536){try{_w.send(f);}catch(e){}}else{DIAG.dropped++;}}try{const _nd=Number(process.hrtime.bigint()-_n0)/1e6;if(_nd>(DIAG.netMaxMs||0))DIAG.netMaxMs=_nd;}catch(_){}},33); /* BACKPRESSURE GUARD: skip a client whose send buffer is already backed up (>64KB) rather than piling stale frames on it */
 httpSrv.listen(port,()=>console.log('FABLEHIVE room + page on :'+port));
 return {close(){clearInterval(simI);clearInterval(netI);clearInterval(reapI);try{wss.close();}catch(e){}try{httpSrv.close();}catch(e){}},get G(){return G;},seats};
}
if(require.main===module)start(process.env.PORT||8081);
module.exports={start,makeGame};
