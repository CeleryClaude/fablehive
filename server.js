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
 const G=makeGame(HTML);
 {const s0=G.swarms.find(z=>z.team===0&&!z.ally);if(s0){s0.bot=true;s0.name='Wilder';}}
 const SEATS=[0,1,2,3,4,5];
 const seats={};
 const httpSrv=http.createServer((req,res)=>{
  const u=(req.url||'/').split('?')[0];
  if(u==='/'||u==='/index.html'||u==='/BROOD.html'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});
   res.end(fs.readFileSync(HTML));
  } else if(u==='/healthz'){res.writeHead(200);res.end('alive');}
  else{res.writeHead(404);res.end('the meadow has no such door');}
 });
 const wss=new WebSocketServer({server:httpSrv});
 wss.on('connection',ws=>{
  let team=null;
  ws.on('message',buf=>{let m;try{m=JSON.parse(buf);}catch(e){return;}
   if(m.k==='join'&&team===null){
    for(const t of SEATS)if(seats[t]===undefined){team=t;break;}
    if(team===null){ws.send(JSON.stringify({k:'full'}));ws.close();return;}
    seats[team]=ws;
    const s=G.swarms.find(z=>z.team===team&&!z.ally);
    if(s){s.bot=false;s.name=(''+(m.n||'Queen')).slice(0,16).replace(/[<>&"']/g,'');delete s.forceAim;}
    ws.send(JSON.stringify({k:'init',you:team,world:G.netWorldInit()}));
   } else if(m.k==='cmd'&&team!==null){try{G.applyInput(team,m.c||{});}catch(e){}}
  });
  ws.on('close',()=>{if(team!==null){delete seats[team];
   const s=G.swarms.find(z=>z.team===team&&!z.ally);
   if(s){s.bot=true;delete s.forceAim;}}});
 });
 const DT=1/60;let acc=0,last=Date.now();
 const simI=setInterval(()=>{const now=Date.now();acc+=(now-last)/1000;last=now;
  if(acc>0.25)acc=0.25;let n=0;
  while(acc>=DT&&n<5){G.step(DT);acc-=DT;n++;}},8);
 const netI=setInterval(()=>{
  let f;try{f=JSON.stringify({k:'f',...G.netDyn()});}catch(e){return;}
  for(const t in seats){try{seats[t].send(f);}catch(e){}}},66);
 httpSrv.listen(port,()=>console.log('FABLEHIVE room + page on :'+port));
 return {close(){clearInterval(simI);clearInterval(netI);try{wss.close();}catch(e){}try{httpSrv.close();}catch(e){}},G,seats};
}
if(require.main===module)start(process.env.PORT||8081);
module.exports={start,makeGame};
