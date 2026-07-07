/* FABLEHIVE ROOM SERVER — one process, the whole game.
   Serves the game page over HTTP and the authoritative sim over WebSocket on the SAME port.
   Punch the URL, press RISE, you're online. */
const fs=require('fs'),vm=require('vm'),path=require('path'),http=require('http');

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
 let G=makeGame(HTML);
 const SEATS=[0,1,2,3,4,5];
 const seats={};
 let lastEmpty=Date.now();
 /* THE WILD & THE FRESH MEADOW: unoccupied seats play as the wild (bots); an EMPTY room IDLES
    instead of grinding a bot war for nobody; and the first arrival into an empty room begins in a
    FRESH, light meadow rather than an hours-old, overgrown one no 60Hz tick can hold. */
 function applyWild(){for(const t of SEATS){const sw=G.swarms.find(z=>z.team===t&&!z.ally);
  if(sw){if(seats[t]!==undefined){sw.bot=false;}else{sw.bot=true;delete sw.forceAim;if(t===0)sw.name='Wilder';}}}}
 function freshWorld(){G=makeGame(HTML);applyWild();}
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
   res.writeHead(200,{'Content-Type':'application/json'});
   res.end(JSON.stringify({ok:1,seats:Object.keys(seats).length,souls,
    tickAvg:+(TICKS.n?TICKS.sum/TICKS.n:0).toFixed(2),tickP95:p95,upMin:((Date.now()-BOOT)/60000)|0}));}
  else{res.writeHead(404);res.end('the meadow has no such door');}
 });
 const wss=new WebSocketServer({server:httpSrv});
 wss.on('connection',ws=>{
  try{ws._socket&&ws._socket.setNoDelay&&ws._socket.setNoDelay(true);}catch(e){} /* no Nagle: frames leave the MOMENT they exist */
  let team=null;
  ws.on('message',buf=>{let m;try{m=JSON.parse(buf);}catch(e){return;}
   if(m.k==='join'&&team===null){
    const wasEmpty=Object.keys(seats).length===0;
    for(const t of SEATS)if(seats[t]===undefined){team=t;break;}
    if(team===null){ws.send(JSON.stringify({k:'full'}));ws.close();return;}
    seats[team]=ws;
    if(wasEmpty&&Date.now()-lastEmpty>15000)freshWorld(); /* only reset a LONG-empty room, so devices/friends joining close together SHARE the world */ /* a lone arrival into an empty room begins in a clean, light meadow */
    const s=G.swarms.find(z=>z.team===team&&!z.ally);
    if(s){s.bot=false;s.name=(''+(m.n||'Queen')).slice(0,16).replace(/[<>&"']/g,'');delete s.forceAim;}
    ws.send(JSON.stringify({k:'init',you:team,world:G.netWorldInit()}));
   } else if(m.k==='cmd'&&team!==null){try{G.applyInput(team,m.c||{});}catch(e){}}
   else if(m.k==='p'){try{ws.send(JSON.stringify({k:'p',t:m.t}));}catch(e){}}
  });
  ws.on('close',()=>{if(team!==null){delete seats[team];if(!Object.keys(seats).length)lastEmpty=Date.now();
   const s=G.swarms.find(z=>z.team===team&&!z.ally);
   if(s){s.bot=true;delete s.forceAim;}}});
 });
 const BOOT=Date.now(),TICKS={n:0,sum:0,hist:[]};
 const DT=1/60;let acc=0,last=Date.now();
 const simI=setInterval(()=>{const now=Date.now();
  if(Object.keys(seats).length===0){last=now;acc=0;return;} /* IDLE when the room is empty: no humans, no grind - the meadow simply waits */
  acc+=(now-last)/1000;last=now;
  if(acc>0.25)acc=0.25;let n=0;
  /* TRUE PER-STEP TIMING: a catch-up burst of 5 steps must never be counted as one slow tick */
  while(acc>=DT&&n<5){
   const t0=process.hrtime.bigint();
   G.step(DT);
   const el=Number(process.hrtime.bigint()-t0)/1e6;
   TICKS.n++;TICKS.sum+=el;TICKS.hist.push(el);if(TICKS.hist.length>300)TICKS.hist.shift();
   acc-=DT;n++;}},8);
 let fN=0;
 const netI=setInterval(()=>{ if(Object.keys(seats).length===0)return; /* 20Hz heartbeat: souls every beat, the slow world every third */
  let f;try{f=JSON.stringify({k:'f',...((fN++%3===0)?G.netDyn():G.netDynLite())});}catch(e){return;}
  for(const t in seats){try{seats[t].send(f);}catch(e){}}},33);
 httpSrv.listen(port,()=>console.log('FABLEHIVE room + page on :'+port));
 return {close(){clearInterval(simI);clearInterval(netI);try{wss.close();}catch(e){}try{httpSrv.close();}catch(e){}},get G(){return G;},seats};
}
if(require.main===module)start(process.env.PORT||8081);
module.exports={start,makeGame};
