const http=require('http');const fs=require('fs');const path=require('path');
const {spawn}=require('child_process');
const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const P=8125,D=9335,PROF=path.join(require('os').tmpdir(),'dbg-'+Date.now());
const ROOT=path.resolve(__dirname,'..');
const MIME={'.html':'text/html;charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png'};
const wait=(p,t,n)=>new Promise((res,rej)=>{const f=k=>{if(k<=0)return rej(new Error('x'));http.get({host:'127.0.0.1',port:p,path:t},r=>{r.resume();res()}).on('error',()=>setTimeout(()=>f(k-1),400))};f(n)});
(async()=>{
  const srv=http.createServer((q,s)=>{let f=q.url==='/'?'/index.html':decodeURIComponent(q.url.split('?')[0]);const fp=path.join(ROOT,'dist',f);
    fs.readFile(fp,(e,d)=>{if(e){s.writeHead(404);return s.end('nf');}s.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream'});s.end(d)})});
  await new Promise(r=>srv.listen(P,'127.0.0.1',r));
  const c=spawn(EDGE,['--headless=new','--disable-gpu','--no-sandbox','--remote-debugging-port='+D,'--user-data-dir='+PROF,'http://127.0.0.1:'+P+'/'],{stdio:'ignore'});
  try{
    await wait(D,'/json/version',25);
    const l=await new Promise((res,rej)=>{http.get({host:'127.0.0.1',port:D,path:'/json/list'},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>res(JSON.parse(d)))}).on('error',rej)});
    const pg=l.find(t=>t.type==='page');
    const WebSocket=require('ws');const ws=new WebSocket(pg.webSocketDebuggerUrl,{perMessageDeflate:false});
    let id=0;const pend=new Map();
    ws.on('message',raw=>{const m=JSON.parse(raw.toString());if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}});
    const send=(me,p={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:me,params:p}))});
    await new Promise(r=>ws.on('open',r));
    await send('Page.enable');await send('Runtime.enable');
    await send('Page.navigate',{url:'http://127.0.0.1:'+P+'/'});
    await new Promise(r=>setTimeout(r,4000));
    const r=await send('Runtime.evaluate',{expression:`(function(){
      var img=document.querySelector('.auth-banner-img');
      var cs=img?getComputedStyle(img):null;
      var pane=document.querySelector('.auth-pane-brand');
      var banner=document.querySelector('.auth-banner');
      var pr=pane?getComputedStyle(pane):null;
      return JSON.stringify({
        imgDisplay: cs?cs.display:'-', imgSrc: img?img.getAttribute('src'):'-', imgComplete: img?img.complete:null, inlineStyle: img?(img.getAttribute("style")||"(none)"):"-", naturalW: img?img.naturalWidth:null, imgInlineStyle: img?img.getAttribute('style')||'(none)', naturalW: img?img.naturalWidth:null, currentSrc: img?img.currentSrc:'-', imgLoading: img?img.loading:'-',
        imgVisibility: cs?cs.visibility:'-',
        imgRect: img?JSON.stringify(img.getBoundingClientRect().toJSON()):'-',
        bannerDisplay: banner?getComputedStyle(banner).display:'-',
        bannerH: banner?Math.round(banner.getBoundingClientRect().height):'-',
        paneW: pr?Math.round(pr.width):'-',
        paneH: pr?Math.round(pr.height):'-',
        authBoot: document.documentElement.className
      });
    })()`,returnByValue:true});
    console.log(r.result.result.value);
    ws.close();
  }catch(e){console.log('err',e.message)}
  finally{c.kill();srv.close();try{fs.rmSync(PROF,{recursive:true,force:true})}catch(e){}setTimeout(()=>process.exit(0),300)}
})();
