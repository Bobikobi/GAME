/**
 * The image library page's style and script (see `library.ts`, which puts them in the page). The script is plain browser
 * JavaScript kept in a raw template literal: no backtick and no dollar-brace inside it, so what is written here is what the
 * browser reads. A test compiles it, and the headless proof in the pull request drives it.
 *
 * Sorting by hand (issue #658): every card and the lightbox carry the state buttons; a click is one POST to `review` on
 * `tools/art-library/serve.py`, and the page shows a state only after the server has saved it.
 */

export const CSS = String.raw`:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#15171a;color:#e8e6e1;font:15px/1.45 system-ui,sans-serif}
header{padding:10px 16px;border-bottom:1px solid #30343a}#top{position:sticky;top:0;z-index:5;background:#15171af7;padding:6px 16px;border-bottom:1px solid #30343a}h1{font-size:19px;margin:0 0 2px}
.row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}button{font:inherit;color:inherit;background:#262a30;border:1px solid #3b4047;border-radius:6px;padding:5px 10px;cursor:pointer}button.on{background:#e0b34e;color:#191712;border-color:#e0b34e;font-weight:600}
input{font:inherit;color:inherit;background:#22252a;border:1px solid #3b4047;border-radius:6px;padding:5px 10px;min-width:220px}input[type=date]{min-width:0}label{font-size:13px;color:#a5a39d;display:flex;gap:6px;align-items:center}main{padding:8px 16px 60px}h2{font-size:17px;margin:24px 0 2px}.d{color:#a5a39d;margin:0 0 10px;font-size:13px}
#prog{display:flex;gap:10px;align-items:center;font-size:14px}#bar{flex:0 0 160px;height:8px;background:#30343a;border-radius:4px;overflow:hidden}#bar i{display:block;height:100%;background:#6fbf73}
#sv{font-size:13px;color:#a5a39d}#sv.bad{color:#ff8a80;font-weight:600}#sv button{padding:2px 8px}
#nosrv{display:none;background:#5a2a2a;border:1px solid #ff8a80;border-radius:6px;padding:6px 10px;margin-top:6px}#nosrv.on{display:block}
#sel{display:none;background:#2a2f38;border:1px solid #5aa0e0;border-radius:6px;padding:6px 10px;margin-top:4px;gap:6px;flex-wrap:wrap;align-items:center}#sel.on{display:flex}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}
.c{position:relative;background:#1f2226;border:1px solid #2d3136;border-radius:6px;padding:6px;cursor:pointer;min-width:0;border-inline-start:4px solid #2d3136}.c:hover{border-color:#e0b34e}.c{scroll-margin-top:110px;user-select:none;-webkit-user-select:none}
.c img,.c .ph{display:block;width:100%;aspect-ratio:1;object-fit:contain;background:#30343a}.c .ph{display:flex;align-items:center;justify-content:center;color:#a5a39d;font-size:13px;direction:ltr}
.c div.t{font-size:12px;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr;text-align:left}
.c .w{font-size:12px;margin-top:2px;color:#a5a39d;min-height:18px}.c .w b{color:#e8e6e1}.c .w .nt{color:#e0b34e}
.bs{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}.bs button{padding:2px 7px;font-size:12px;border-radius:5px}
.s-keep{border-inline-start-color:#6fbf73}.s-reuse-parts{border-inline-start-color:#5aa0e0}.s-rework{border-inline-start-color:#e0933e}.s-archive{border-inline-start-color:#8a8f98}
button.b-keep.on{background:#6fbf73;border-color:#6fbf73}button.b-reuse-parts.on{background:#5aa0e0;border-color:#5aa0e0}button.b-rework.on{background:#e0933e;border-color:#e0933e}button.b-archive.on{background:#8a8f98;border-color:#8a8f98}
.c.dim{opacity:.38}.c.pd{opacity:.6}.c.fail{border-color:#ff8a80;background:#2c1d1d}.c .er{color:#ff8a80;font-size:12px;margin-top:4px}
.c .ck{position:absolute;top:10px;inset-inline-start:10px;width:22px;height:22px;border-radius:5px;background:#000a;border:1px solid #888;display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1;opacity:.55}.c:hover .ck,.c.sl .ck{opacity:1}.c.sl{outline:2px solid #5aa0e0}.c.sl .ck{background:#5aa0e0;color:#10161c;border-color:#5aa0e0}
.nosave .bs button,.nosave .ck{opacity:.35;pointer-events:none}.more{margin:12px 0}
#lb{position:fixed;inset:0;background:#000e;display:none;z-index:9;padding:16px;overflow:auto}#lb.on{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;align-items:flex-start}
#lb img,#lb .ph{width:min(92vw,560px);aspect-ratio:1;object-fit:contain;image-rendering:pixelated;background:#30343a;display:flex;align-items:center;justify-content:center}
#lb .i{max-width:400px;width:min(92vw,400px);direction:ltr;text-align:left;font-size:13px;white-space:pre-wrap;word-break:break-word}#lb .i .h{direction:rtl;text-align:right;white-space:normal}
#lb .lbs{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}#lb .lbs button{font-size:14px;padding:6px 12px}#lb .lbs kbd{opacity:.7;font-size:11px;margin-inline-start:4px}
#lb .nt{width:100%;margin:4px 0;direction:rtl}#lb .nav{display:flex;gap:6px;align-items:center;margin:6px 0;direction:rtl}#lb .st{color:#a5a39d;font-size:12px;direction:rtl}
`;

export const SCRIPT = String.raw`
const CFG=JSON.parse(document.getElementById('cfg').textContent),DATA=JSON.parse(document.getElementById('data').textContent);
const RV=CFG.reviews,BUILT=CFG.builtAt,TL=CFG.tools,STATES=CFG.states;
const BY=new Map(DATA.map(x=>[x.id,x]));
const LABEL={keep:'שמור',['reuse-parts']:'חלקים',rework:'לתקן',archive:'ארכיון',unreviewed:'לא נבדק'};
const STATE_NAME={keep:'נשמר',['reuse-parts']:'חלקים',rework:'לתקן',archive:'בארכיון',unreviewed:'לא נבדק'};
let tool='all',rv='all',own=false,q='',from='',to='',nodate=false,shown={};const PAGE=120;
let canSave=false,cur=null,lastSel=null,chain=Promise.resolve(),pending=0;
const stay=new Set(),sel=new Set(),fails=new Map();
const $=s=>document.querySelector(s);const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pad=n=>String(n).padStart(2,'0');const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=new Date();const ago=n=>{const d=new Date(today);d.setDate(d.getDate()-n);return ymd(d)};
const months={};DATA.forEach(x=>{if(x.d){const k=x.d.slice(0,7);months[k]=(months[k]||0)+1}});const undated=DATA.filter(x=>!x.d).length;
const GROUP={};TL.forEach(t=>{GROUP[t.key]=[]});DATA.forEach(x=>{(GROUP[x.t]||(GROUP[x.t]=[])).push(x)});

/* ---- filters. skip: 'r' leaves out the review filter, 'o' the "not sorted by hand" filter, 't' the tool ---- */
const inDate=x=>nodate?!x.d:((!from&&!to)||(x.d&&(!from||x.d>=from)&&(!to||x.d<=to)));
function f(x,skip){skip=skip||'';
 return (skip.includes('t')||tool==='all'||x.t===tool)&&(skip.includes('r')||rv==='all'||x.r===rv)&&(skip.includes('o')||!own||!x.o)&&(!q||(x.n+' '+x.g).toLowerCase().includes(q))&&inDate(x)}
/* a card the owner just sorted stays, dimmed, until the next filter change, so nothing jumps under the mouse */
const show=x=>f(x)||(stay.has(x.id)&&f(x,'ro'));
const dimmed=x=>stay.has(x.id)&&!f(x);
const sameFilterReset=()=>{stay.clear()};

/* ---- the cards ---- */
function who(x){if(x.r==='unreviewed')return '';return x.o?'אתה':(x.by?'סוכן':'ללא מקור')}
function btns(x){return STATES.filter(s=>s!=='unreviewed').map(s=>'<button data-s="'+s+'" class="b-'+s+(x.r===s&&x.o?' on':'')+'" title="'+LABEL[s]+'">'+LABEL[s]+'</button>').join('')
 +'<button data-s="unreviewed" title="חזרה ללא נבדק">↺</button>'+'<button data-nt="1" title="הערה">✎</button>'}
function cell(x){const im=x.th?'<img loading="lazy" src="thumb/'+x.id+'.webp" alt="">':'<div class="ph">'+esc(x.x)+'</div>';
 const fl=fails.get(x.id);const w=who(x);
 const cls='c'+(x.r!=='unreviewed'?' s-'+x.r:'')+(dimmed(x)?' dim':'')+(x.pd?' pd':'')+(fl?' fail':'')+(sel.has(x.id)?' sl':'');
 return '<div class="'+cls+'" data-i="'+x.id+'" title="'+esc(x.d)+'"><span class="ck" data-k="1">'+(sel.has(x.id)?'✓':'')+'</span>'+im+'<div class="t">'+esc(x.n)+'</div>'
 +'<div class="w">'+(x.r!=='unreviewed'?'<b>'+STATE_NAME[x.r]+'</b> · '+w:'לא נבדק')+(x.note?' <span class="nt" title="'+esc(x.note)+'">✎ '+esc(x.note.slice(0,24))+'</span>':'')+(x.pd?' · שומר...':'')+'</div>'
 +'<div class="bs">'+btns(x)+'</div>'+(fl?'<div class="er">לא נשמר'+(fl.job.ids.length>1?' (מתוך '+fl.job.ids.length+' בבת אחת)':'')+': '+esc(fl.msg)+' <button data-retry="1">נסה שוב</button></div>':'')+'</div>'}
function refresh(x){document.querySelectorAll('.c[data-i="'+x.id+'"]').forEach(el=>{const t=document.createElement('template');t.innerHTML=cell(x);el.replaceWith(t.content.firstElementChild)});
 if(cur===x.id)renderLb(true);head()}

/* ---- the header: chips with counts, the counter, the save line ---- */
let headQueued=false;function head(){if(headQueued)return;headQueued=true;setTimeout(()=>{headQueued=false;chips()},0)}
function quick(){const cnt=(a,b)=>DATA.filter(x=>x.d&&x.d>=a&&x.d<=b).length;const t=ymd(today);
 const on=(a,b)=>!nodate&&from===a&&to===b;
 let h='<button data-q="all" class="'+(!nodate&&!from&&!to?'on':'')+'">כל התאריכים</button> <button data-q="'+t+'|'+t+'" class="'+(on(t,t)?'on':'')+'">היום ('+cnt(t,t)+')</button> <button data-q="'+ago(6)+'|'+t+'" class="'+(on(ago(6),t)?'on':'')+'">7 ימים ('+cnt(ago(6),t)+')</button> <button data-q="'+ago(29)+'|'+t+'" class="'+(on(ago(29),t)?'on':'')+'">30 יום ('+cnt(ago(29),t)+')</button> ';
 for(const k of Object.keys(months).sort().reverse()){const a=k+'-01',b=k+'-31';h+='<button data-q="'+a+'|'+b+'" class="'+(on(a,b)?'on':'')+'">'+k+' ('+months[k]+')</button> '}
 h+='<button data-q="none" class="'+(nodate?'on':'')+'">ללא תאריך ('+undated+')</button>';$('#quick').innerHTML=h}
function chips(){const c={};DATA.forEach(x=>{if(f(x,'t'))c[x.t]=(c[x.t]||0)+1});const tot=Object.values(c).reduce((a,b)=>a+b,0);
 $('#tools').innerHTML='<button data-t="all" class="'+(tool==='all'?'on':'')+'">הכול ('+tot+')</button>'+TL.map(t=>'<button data-t="'+t.key+'" class="'+(tool===t.key?'on':'')+'">'+t.label+' ('+(c[t.key]||0)+')</button>').join('');
 const rc={};let all=0,unsorted=0;DATA.forEach(x=>{if(f(x,'r')){all++;rc[x.r]=(rc[x.r]||0)+1}if(f(x,'o')&&!x.o)unsorted++});
 $('#rv').innerHTML=RV.map(([k,l])=>'<button data-r="'+k+'" class="'+(rv===k?'on':'')+'">'+l+' ('+(k==='all'?all:(rc[k]||0))+')</button>').join(' ')
  +' <button data-own="1" class="'+(own?'on':'')+'">לא מוין ידנית ('+unsorted+')</button>';
 quick();
 const mine=DATA.filter(x=>x.o).length;
 $('#cnt').textContent='מיינת '+mine+' מתוך '+DATA.length;$('#bar').firstElementChild.style.width=(DATA.length?mine*100/DATA.length:0)+'%';
 $('#upd').textContent='עודכן ב'+new Date(BUILT).toLocaleString('he-IL')+' - '+DATA.length+' תמונות';
 const nf=fails.size;const sv=$('#sv');
 if(nf){sv.className='bad';sv.innerHTML=nf+' בחירות לא נשמרו <button data-retryall="1">נסה שוב הכול</button>'}
 else if(pending){sv.className='';sv.textContent='שומר...'}
 else{sv.className='';sv.textContent=canSave?'כל הבחירות שמורות':''}
 $('#nosrv').className=canSave?'':'on';document.body.classList.toggle('nosave',!canSave);
 const n=sel.size;$('#sel').className=n?'on':'';$('#selcount').textContent=n+' נבחרו';
 $('#selshown').textContent='בחר את כל המוצגים ('+seq().length+')';
}

/* ---- the list, in the order the sections show it ---- */
function seq(){const out=[];for(const t of TL){if(tool!=='all'&&tool!==t.key)continue;for(const x of GROUP[t.key])if(show(x))out.push(x)}return out}
function draw(){let h='';for(const t of TL){if(tool!=='all'&&tool!==t.key)continue;const a=GROUP[t.key].filter(show);if(!a.length)continue;const n=shown[t.key]||(tool==='all'?24:PAGE);
 h+='<h2>'+t.label+' ('+a.length+')</h2><p class="d">'+t.note+'</p><div class="g">'+a.slice(0,n).map(cell).join('')+'</div>';
 if(a.length>n)h+='<button class="more" data-m="'+t.key+'" data-n="'+n+'">עוד (נשארו '+(a.length-n)+')</button>';}
 $('#m').innerHTML=h||'<p>אין תוצאות</p>';chips()}
function filterChanged(){sameFilterReset();draw()}
function setRange(a,b){from=a;to=b;nodate=false;$('#from').value=a;$('#to').value=b}

/* ---- saving. One queue, so two quick clicks reach the server in the order they were made ---- */
function setLocal(x,review,note,at){x.r=review;x.note=note;x.by='owner';x.o=review!=='unreviewed';x.sa=at||''}
function choose(ids,review,note){
 if(!canSave){return false}
 const list=ids.map(id=>BY.get(id)).filter(Boolean);if(!list.length)return false;
 list.forEach(x=>{x.wasShown=show(x)});
 enqueue({ids:list.map(x=>x.id),review:review,note:note||''});return true}
function enqueue(job){
 job.ids.forEach(id=>{const x=BY.get(id);x.pd=(x.pd||0)+1;fails.delete(id);refresh(x)});pending++;head();
 chain=chain.then(()=>send(job))}
async function send(job){
 let msg='',at='';
 try{
  const body=job.ids.length===1?{id:job.ids[0],review:job.review,note:job.note}:{ids:job.ids,review:job.review,note:job.note};
  const r=await fetch('review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  let j={};try{j=await r.json()}catch(e){}
  if(!r.ok||!(j.saved>=1))msg=(j&&j.error)||('השרת ענה '+r.status);else at=j.at||''
 }catch(e){msg='השרת לא עונה'}
 pending--;
 for(const id of job.ids){const x=BY.get(id);x.pd=Math.max(0,(x.pd||1)-1);
  if(msg===''){const was=x.wasShown;setLocal(x,job.review,job.note,at);fails.delete(id);if(was&&!f(x))stay.add(id)}
  else fails.set(id,{msg:msg,job:job});
  refresh(x)}
 head()}
/* a batch is one request, so a failed batch is retried as one: every card of it shows the failure until it is saved */
function retry(ids){const jobs=new Set();ids.forEach(id=>{const fl=fails.get(id);if(fl)jobs.add(fl.job)});
 jobs.forEach(job=>{job.ids.forEach(id=>{const x=BY.get(id);x.wasShown=show(x)});enqueue(job)})}
window.addEventListener('beforeunload',e=>{if(pending||fails.size){e.preventDefault();e.returnValue=''}});

/* ---- the lightbox ---- */
function openLb(id){cur=id;renderLb(false);$('#lb').className='on'}
function closeLb(){cur=null;$('#lb').className='';$('#lb').innerHTML=''}
function step(d){if(cur===null)return false;const s=seq();const i=s.findIndex(y=>y.id===cur);const n=s[i+d];if(!n)return false;cur=n.id;renderLb(false);return true}
function renderLb(keepNote){const x=BY.get(cur);if(!x)return;const prev=keepNote&&$('#lbnote')?$('#lbnote').value:null;const typing=keepNote&&document.activeElement&&document.activeElement.id==='lbnote';
 const s=seq();const i=s.findIndex(y=>y.id===cur);
 const im=x.th?'<img src="thumb/'+x.id+'.webp" alt="">':'<div class="ph">'+esc(x.x)+'</div>';
 const rvl=STATE_NAME[x.r]||x.r;const fl=fails.get(x.id);
 const bs=STATES.map((s2,k)=>'<button data-ls="'+s2+'" class="b-'+s2+(x.r===s2&&(x.o||s2==='unreviewed')?' on':'')+'">'+LABEL[s2]+'<kbd>'+(s2==='unreviewed'?0:k+1)+'</kbd></button>').join('');
 $('#lb').innerHTML=im+'<div class="i"><div class="h"><b>'+esc(x.n)+'</b> <span class="st">('+(i+1)+' / '+s.length+')</span></div><div class="lbs h">'+bs+'</div>'
  +'<input id="lbnote" class="nt" maxlength="300" placeholder="הערה קצרה (Enter שומר אותה)" autocomplete="off">'
  +'<div class="nav"><button data-nav="-1">→ הקודמת</button><button data-nav="1">← הבאה</button><button data-x="1">סגור</button><span class="st">1-4 בוחרים ועוברים לבאה, 0 לא נבדק, חצים עוברים בלי לבחור</span></div>'
  +(fl?'<div class="h" style="color:#ff8a80">לא נשמר: '+esc(fl.msg)+'</div>':'')+(x.pd?'<div class="h st">שומר...</div>':'')
  +'\nreview: '+esc(x.r)+' ('+esc(rvl)+')'+(x.o?' - נבחר על ידך':(x.by?' - '+esc(x.by):''))+(x.sa?' ('+esc(x.sa)+')':'')+'\ngroup: '+esc(x.g)+'\ndate: '+esc(x.d||'none')+(x.ds?' ('+esc(x.ds)+')':'')+'\nmodel: '+esc(x.m)+'\nseed: '+esc(x.seed)+'\ncanvas: '+esc(x.c)+'\nstore: '+esc(x.tag)+'\nid: '+esc(x.id)+'\n\n'+esc(x.p)+'</div>';
 const inp=$('#lbnote');inp.value=prev!==null?prev:x.note;if(typing)inp.focus();
 const nx=s[i+1];if(nx&&nx.th){const p=new Image();p.src='thumb/'+nx.id+'.webp'}}
function lbChoose(review,advance){const x=BY.get(cur);if(!x)return;if(!canSave){return}
 const note=$('#lbnote').value.trim();
 /* a note typed for a picture the owner has not sorted yet goes with the state he picks; one already sorted keeps its own */
 choose([cur],review,note);if(advance)step(1)}

/* ---- selection ---- */
function toggleSel(id,range){
 if(range&&lastSel&&lastSel!==id){const ids=[...document.querySelectorAll('.c[data-i]')].map(e=>e.dataset.i);const a=ids.indexOf(lastSel),b=ids.indexOf(id);
  if(a>=0&&b>=0){const [lo,hi]=a<b?[a,b]:[b,a];ids.slice(lo,hi+1).forEach(i=>sel.add(i));ids.slice(lo,hi+1).forEach(i=>refresh(BY.get(i)));lastSel=id;head();return}}
 if(sel.has(id))sel.delete(id);else sel.add(id);lastSel=id;refresh(BY.get(id));head()}
function selClear(){sel.clear();document.querySelectorAll('.c.sl').forEach(el=>refresh(BY.get(el.dataset.i)));head()}

/* ---- events ---- */
document.addEventListener('click',e=>{
 const lb=e.target.closest('#lb');
 if(lb){
  if(e.target===lb||e.target.closest('[data-x]')){closeLb();return}
  const b=e.target.closest('[data-ls]');if(b){lbChoose(b.dataset.ls,true);return}
  const n=e.target.closest('[data-nav]');if(n){step(+n.dataset.nav);return}
  return}
 const t=e.target.closest('button,.c');if(!t)return;
 const card=e.target.closest('.c');
 if(e.target.closest('[data-k]')){toggleSel(card.dataset.i,e.shiftKey);return}
 const s=e.target.closest('[data-s]');if(s&&card){choose([card.dataset.i],s.dataset.s,(BY.get(card.dataset.i).o?BY.get(card.dataset.i).note:''));return}
 if(e.target.closest('[data-nt]')&&card){openLb(card.dataset.i);$('#lbnote').focus();return}
 if(e.target.closest('[data-retry]')&&card){retry([card.dataset.i]);return}
 if(e.target.closest('[data-retryall]')){retry([...fails.keys()]);return}
 const bs=e.target.closest('[data-bs]');if(bs){const ids=[...sel];const note=$('#selnote').value.trim();
  if(choose(ids,bs.dataset.bs,note)){sel.clear();$('#selnote').value=''}
  document.querySelectorAll('.c[data-i]').forEach(el=>refresh(BY.get(el.dataset.i)));head();return}
 if(e.target.closest('[data-selall]')){seq().forEach(x=>sel.add(x.id));document.querySelectorAll('.c[data-i]').forEach(el=>refresh(BY.get(el.dataset.i)));head();return}
 if(e.target.closest('[data-selclear]')){selClear();return}
 if(t.dataset.t){tool=t.dataset.t;filterChanged()}else if(t.dataset.r){rv=t.dataset.r;filterChanged()}else if(t.dataset.own){own=!own;filterChanged()}
 else if(t.dataset.m){shown[t.dataset.m]=+t.dataset.n+PAGE*2;draw()}
 else if(t.dataset.q){const v=t.dataset.q;if(v==='none'){setRange('','');nodate=true}else if(v==='all'){setRange('','')}else{const [a,b]=v.split('|');setRange(a,b)}filterChanged()}
 else if(card&&card.dataset.i){openLb(card.dataset.i)}});
$('#q').addEventListener('input',e=>{q=e.target.value.trim().toLowerCase();filterChanged()});
$('#from').addEventListener('change',e=>{from=e.target.value;nodate=false;filterChanged()});$('#to').addEventListener('change',e=>{to=e.target.value;nodate=false;filterChanged()});
document.addEventListener('keydown',e=>{
 const typing=e.target&&e.target.tagName==='INPUT';
 if(cur===null){if(e.key==='Escape'&&!typing&&sel.size)selClear();return}
 if(typing){
  if(e.target.id==='lbnote'&&e.key==='Enter'){e.preventDefault();const x=BY.get(cur);if(x&&x.o&&canSave)choose([cur],x.r,e.target.value.trim());e.target.blur()}
  else if(e.key==='Escape'){e.target.blur()}
  return}
 if(e.ctrlKey||e.metaKey||e.altKey)return;
 const k=e.key;
 if(k==='Escape'){closeLb();return}
 const i={'1':'keep','2':'reuse-parts','3':'rework','4':'archive','0':'unreviewed'}[k];
 if(i){e.preventDefault();lbChoose(i,true);return}
 /* the page is right to left: the next picture is to the left */
 if(k==='ArrowLeft'){e.preventDefault();step(1)}else if(k==='ArrowRight'){e.preventDefault();step(-1)}});

/* ---- start: the owner's saved choices over the page, then the first draw ---- */
async function start(){
 try{
  const ctl=new AbortController();const tm=setTimeout(()=>ctl.abort(),2500);
  const r=await fetch('reviews',{cache:'no-store',signal:ctl.signal});clearTimeout(tm);
  if(r.ok){const j=await r.json();canSave=true;for(const id in j){const x=BY.get(id);if(x)setLocal(x,j[id].review,j[id].note||'',j[id].at||'')}}
 }catch(e){canSave=false}
 draw()}
start();
`;
