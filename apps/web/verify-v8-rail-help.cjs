const puppeteer=require('puppeteer-core'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
const OUT='D:/ProgramData/others/cucumber-inventory-project/apps/web/_verify';
(async()=>{
 const b=await puppeteer.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:'new',args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:1600,height:1000});
 const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,180)));
 await p.goto('http://127.0.0.1:8080/',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>sessionStorage.setItem('cmg_session_v1',JSON.stringify({token:'t',userId:'u_admin',username:'admin',role:'admin',features:['finance-ledger'],mustChangePwd:false,exp:Date.now()+86400000,lastSeen:Date.now()})));
 await p.goto('http://127.0.0.1:8080/#/finance-records',{waitUntil:'networkidle2'});
 await wait(2600);
 await p.evaluate(()=>{const g=document.getElementById('authGate'); if(g)g.remove();
  document.querySelectorAll('.modal-overlay').forEach(m=>{m.classList.remove('show');m.style.display='none';});
  const a=document.querySelector('.app-layout'); if(a){a.style.visibility='visible';a.style.opacity='1';a.style.pointerEvents='';}});
 await wait(1600);
 const R={};
 // ① 固定栏文字
 R.labels=await p.evaluate(()=>Array.from(document.querySelectorAll('.app-rail-item')).map(x=>{
   const t=x.querySelector('.app-rail-text');
   const r=t?t.getBoundingClientRect():null;
   const ico=x.querySelector('.app-rail-ico').getBoundingClientRect();
   return {g:x.getAttribute('data-rail-group'),label:t?t.textContent.trim():null,
     visible:!!r&&r.height>0, belowIcon:!!r&&ico.bottom<=r.top+1};
 }));
 await p.screenshot({path:OUT+'/v8-expanded.png',clip:{x:0,y:0,width:380,height:1000}});
 // ② 收起态按钮位置
 await p.evaluate(()=>document.getElementById('sidebarToggle').click());
 await wait(900);
 R.toggle=await p.evaluate(()=>{
   const btn=document.getElementById('sidebarToggle'); const r=btn.getBoundingClientRect();
   const rail=document.getElementById('appRail'); const rr=rail.getBoundingClientRect();
   const cx=r.left+r.width/2, rcx=rr.left+rr.width/2;
   return {btnCx:Math.round(cx),railCx:Math.round(rcx),offset:Math.round(cx-rcx),
     insideRail: r.left>=rr.left-1 && r.right<=rr.right+1};
 });
 await p.screenshot({path:OUT+'/v8-collapsed.png',clip:{x:0,y:0,width:220,height:1000}});
 // ③ 收起态点击图标应展开列表
 await p.evaluate(()=>{const x=document.querySelector('.app-rail-item[data-rail-group="wh"]'); if(x)x.click();});
 await wait(1000);
 R.expandOnClick=await p.evaluate(()=>({
   collapsed:document.getElementById('menuShell').classList.contains('is-collapsed'),
   active:(document.querySelector('.app-rail-item.is-active')||{}).dataset?.railGroup,
   panelTitle:(document.getElementById('sidebarPanelTitle')||{}).textContent,
   visibleItems:Array.from(document.querySelectorAll('#sidebarMenu .menu-group:not([hidden]) .menu-item')).map(i=>i.textContent.trim().replace(/\s+/g,' ')),
   pageTitle:document.getElementById('pageTitle').textContent}));
 await p.screenshot({path:OUT+'/v8-after-icon-click.png',clip:{x:0,y:0,width:380,height:1000}});
 // ④ 帮助页跳转
 await p.evaluate(()=>document.getElementById('btnAccountHelp').click());
 await wait(1000);
 R.help=await p.evaluate(()=>({hash:location.hash,title:document.getElementById('pageTitle').textContent,
   active:(document.querySelector('.page-section.active')||{}).id}));
 R.errors=errs;
 const ok = R.labels.every(l=>l.visible&&l.belowIcon) && Math.abs(R.toggle.offset)<2 && R.toggle.insideRail
   && !R.expandOnClick.collapsed && R.expandOnClick.active==='wh'
   && R.help.active==='page-help' && errs.length===0;
 console.log(JSON.stringify(R,null,2));
 console.log('PASS:',ok);
 await b.close();
 process.exit(ok?0:1);
})();
