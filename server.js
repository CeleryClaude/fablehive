/* FABLEHIVE ROOM SERVER — one process, the whole game.
   Serves the game page over HTTP and the authoritative sim over WebSocket on the SAME port.
   Punch the URL, press RISE, you're online. */
const fs=require('fs'),vm=require('vm'),path=require('path'),http=require('http');
/* --- TEMP DIAGNOSTIC TELEMETRY: event-loop lag + GC pauses + heap, to locate the multi-second freezes --- */
const {PerformanceObserver}=require('perf_hooks');
const DIAG={gcCount:0,gcTotalMs:0,gcMaxMs:0,elLagMaxMs:0,maxBufBytes:0,dropped:0};
try{new PerformanceObserver(l=>{for(const e of l.getEntries()){DIAG.gcCount++;DIAG.gcTotalMs+=e.duration;if(e.duration>DIAG.gcMaxMs)DIAG.gcMaxMs=e.duration;}}).observe({entryTypes:['gc']});}catch(e){}
const STALLS=[]; /* the SPIKE LEDGER: every event-loop freeze >300ms is logged with its moment, so a live healthz poll during a playtest shows exactly WHEN the world hitched and how hard */
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

function start(port,htmlPath){
 const {WebSocketServer}=require('ws');
 const HTML=htmlPath||path.join(__dirname,fs.existsSync(path.join(__dirname,'index.html'))?'index.html':'BROOD.html');
 let G=makeGame(HTML);G.unlockAll&&G.unlockAll();
 const SEATS=[0,1,2,3,4,5];
 const seats={};
 let lastEmpty=Date.now();
 /* THE WILD & THE FRESH MEADOW: unoccupied seats play as the wild (bots); an EMPTY room IDLES
    instead of grinding a bot war for nobody; and the first arrival into an empty room begins in a
    FRESH, light meadow rather than an hours-old, overgrown one no 60Hz tick can hold. */
 function applyWild(){for(const t of SEATS){const sw=G.swarms.find(z=>z.team===t&&!z.ally);
  if(sw){if(seats[t]!==undefined){sw.bot=false;}else{sw.bot=true;delete sw.forceAim;if(t===0)sw.name='Wilder';}}}}
 function freshWorld(){G=makeGame(HTML);G.unlockAll&&G.unlockAll();applyWild();}
 applyWild();
 const httpSrv=http.createServer((req,res)=>{
  const u=(req.url||'/').split('?')[0];
  if(u==='/'||u==='/index.html'||u==='/BROOD.html'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
   res.end(fs.readFileSync(HTML));
  } else if(u==='/healthz'){ /* TELEMETRY: lag is measured here, never guessed again */
   const h=TICKS.hist.slice().sort((a,b)=>a-b);
   const p95=h.length?h[Math.min(h.length-1,(h.length*0.95)|0)]:0;
   let souls=0;for(const s2 of G.swarms)if(!s2.dead)souls+=s2.units.length;
   const mu=process.memoryUsage();
   const elLag=DIAG.elLagMaxMs,gcMax=DIAG.gcMaxMs,mbuf=DIAG.maxBufBytes;DIAG.elLagMaxMs=0;DIAG.gcMaxMs=0;DIAG.maxBufBytes=0; /* per-interval maxes since last poll */
   res.writeHead(200,{'Content-Type':'application/json'});
   res.end(JSON.stringify({ok:1,seats:Object.keys(seats).length,souls,
    tickAvg:+(TICKS.n?TICKS.sum/TICKS.n:0).toFixed(2),tickP95:p95,upMin:((Date.now()-BOOT)/60000)|0,
    ticks:TICKS.n,elLagMaxMs:elLag,gcCount:DIAG.gcCount,gcMaxMs:+gcMax.toFixed(0),gcTotalMs:+DIAG.gcTotalMs.toFixed(0),
    stalls:STALLS.map(z=>({ago:((Date.now()-z.t)/1000)|0,ms:z.ms,heap:z.heap})),netLateMax:DIAG.netLateMax||0,rateSkips:DIAG.rateSkips||0,
    heapMB:(mu.heapUsed/1048576)|0,rssMB:(mu.rss/1048576)|0,maxBufKB:(mbuf/1024)|0,dropped:DIAG.dropped}));}
  else{res.writeHead(404);res.end('the meadow has no such door');}
 });
 const wss=new WebSocketServer({server:httpSrv});
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
    if(wasEmpty&&Date.now()-lastEmpty>15000)freshWorld(); /* only reset a LONG-empty room, so devices/friends joining close together SHARE the world */ /* a lone arrival into an empty room begins in a clean, light meadow */
    const s=G.swarms.find(z=>z.team===team&&!z.ally);
    if(s){s.bot=false;s.name=(''+(m.n||'Queen')).slice(0,16).replace(/[<>&"']/g,'');delete s.forceAim;
     s.dead=false;try{G.reviveSwarm(s);}catch(e){}s.honey=150;
     {const okc=v=>(typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v))?v:null; /* SHE ARRIVES DRESSED: colour + wardrobe ride the join (sanitized), so every frame shows the player as they chose to look - not as the seat's random bot */
      const c9=okc(m.c);if(c9)s.col=c9;s.col2=okc(m.c2);
      let q9=null;if(m.q&&typeof m.q==='object'&&!Array.isArray(m.q)){q9={};for(const k of ['pattern','crown','trail','wings','body','tail','fleet','aura']){const v=m.q[k];if(typeof v==='string'&&v.length<=24&&/^[a-zA-Z0-9_-]+$/.test(v))q9[k]=v;}if(!Object.keys(q9).length)q9=null;}
      s.cosEq=q9;}} /* FRESH QUEEN on join: never the wild bot's grown body - and she arrives with 150 honey, enough for her FIRST SOLDIER or two foragers, so the opening minute is choices, not poverty (30 was famine) */
    ws.send(JSON.stringify({k:'init',you:team,world:G.netWorldInit()}));
   } else if(m.k==='cmd'&&team!==null){try{G.applyInput(team,m.c||{});}catch(e){}}
   else if(m.k==='p'){try{ws.send(JSON.stringify({k:'p',t:m.t}));}catch(e){}}
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
 const DT=1/30;let acc=0,last=Date.now(); /* 30Hz authoritative sim: HALVES sustained CPU so the shared-cpu-1x burst credits stop draining (was 60Hz=~36% CPU nonstop -> throttle -> multi-second stalls). Queen physics verified dt-robust (4px/3s drift vs 60Hz); client predicts her at 60fps + interpolates troops, so nothing looks slower. */
 const simI=setInterval(()=>{const now=Date.now();
  if(Object.keys(seats).length===0){last=now;acc=0;return;} /* IDLE when the room is empty: no humans, no grind - the meadow simply waits */
  acc+=(now-last)/1000;last=now;
  if(acc>0.25)acc=0.25;let n=0;
  /* TRUE PER-STEP TIMING: a catch-up burst of 5 steps must never be counted as one slow tick */
  while(acc>=DT&&n<3){ /* catch-up capped at 3 (was 5): after a GC or timer hiccup a 5-step burst cost 75ms+ in one gulp, starving the very next net frame - the 1000ms ping SPIKES. Better a hair of time-dilation than a spike */
   const t0=process.hrtime.bigint();
   G.step(DT);
   const el=Number(process.hrtime.bigint()-t0)/1e6;
   TICKS.n++;TICKS.sum+=el;TICKS.hist.push(el);if(TICKS.hist.length>300)TICKS.hist.shift();
   acc-=DT;n++;}},16);
 let fN=0,_lastNet=Date.now();
 const AOI2=2400*2400; /* AREA OF INTEREST (#3b): each seat receives the units/drops/shots/wasps within 2400px of HER queen - beyond that lies pure invisible bandwidth. 2400 covers the widest screen at the zoom cap (~1830px half-width) plus the 520px troop leash, with margin. Queens/headers of ALL swarms still flow every frame (minimap + war-sense need them); authority is untouched - the FULL world simulates server-side, culling is presentation only */
 const netI=setInterval(()=>{ if(Object.keys(seats).length===0)return; /* 30Hz heartbeat: souls every beat, the slow world every third */
  {const nn=Date.now(),gp=nn-_lastNet;if(gp>66&&gp>(DIAG.netLateMax||0))DIAG.netLateMax=gp;_lastNet=nn;} /* how late do net beats actually run? */
  let base;try{base=(fN++%3===0)?G.netDyn():G.netDynLite();}catch(e){return;}
  for(const t in seats){const _w=seats[t];if(!_w)continue;
   const _b0=_w.bufferedAmount||0; /* GRACEFUL DEGRADATION: a strained pipe gets FEWER, LIGHTER beats instead of falling off the 64KB silence cliff. 16KB backed up -> 15Hz; 40KB -> 10Hz; and past 8KB, OTHER swarms' unit lists ride every second beat only (headers+own troops always flow) */
   if(_b0>40960&&(fN%3)){DIAG.rateSkips=(DIAG.rateSkips||0)+1;continue;}
   if(_b0>16384&&(fN%2)){DIAG.rateSkips=(DIAG.rateSkips||0)+1;continue;}
   const _diet=_b0>8192&&(fN%2===1);
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
     if(o.dr)o.dr=o.dr.filter(d9=>{const dx=d9[0]-qx,dy=d9[1]-qy;return dx*dx+dy*dy<AOI2;});
     if(o.sh)o.sh=o.sh.filter(d9=>{const dx=d9[0]-qx,dy=d9[1]-qy;return dx*dx+dy*dy<AOI2;});
     if(o.wp)o.wp=o.wp.filter(d9=>{const dx=d9[0]-qx,dy=d9[1]-qy;return dx*dx+dy*dy<AOI2;});
     f=JSON.stringify({k:'f',...o});}
   }catch(e){try{f=JSON.stringify({k:'f',...base});}catch(e2){continue;}}
   const _b=_w.bufferedAmount||0;if(_b>DIAG.maxBufBytes)DIAG.maxBufBytes=_b;
   if(_b<65536){try{_w.send(f);}catch(e){}}else{DIAG.dropped++;}}},33); /* BACKPRESSURE GUARD: skip a client whose send buffer is already backed up (>64KB) rather than piling stale frames on it */
 httpSrv.listen(port,()=>console.log('FABLEHIVE room + page on :'+port));
 return {close(){clearInterval(simI);clearInterval(netI);clearInterval(reapI);try{wss.close();}catch(e){}try{httpSrv.close();}catch(e){}},get G(){return G;},seats};
}
if(require.main===module)start(process.env.PORT||8081);
module.exports={start,makeGame};
