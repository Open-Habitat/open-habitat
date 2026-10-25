// Synthetic owner-only content. No product API or routing is implemented.
const files = ['Myyntiraportti.html', 'Myynnin tilannekuva'];
let selection = 0, originButton = null, activeDirection = 0;
const variants = [0,1,2].map(direction => () => render(direction));
const btn = (text, action, extra='') => `<button data-action="${action}" ${extra}>${text}</button>`;
const placeName = value => value === 'tab' ? 'välilehdelle' : 'paneeliin';
function stored(key) { try { return sessionStorage.getItem('riff-'+key) === 'tab' ? 'tab' : 'panel'; } catch { return 'panel'; } }
function save(key,value) { try { sessionStorage.setItem('riff-'+key,value); return true; } catch { document.getElementById('preference-feedback').textContent='Selain ei salli muistamista. Seuraava avaus käyttää paneelia.'; return false; } }
function destination() { return activeDirection===1 ? stored('last') : activeDirection===2 ? stored('default') : 'panel'; }
function directionHelp(d) {
 return `<div class="choice-bar">${d===0 ? '<strong>Kaksi suoraa valintaa</strong><span>Jokainen avaus on oma valintasi. Avaa käyttää aina paneelia.</span>' : d===1 ? '<strong>Muistava avaus</strong><span>Viimeinen kortilta valittu paikka koskee myös seuraavaa näkymää. Ei sisällön lajin mukaan.</span>' : `<label>Oma oletus <select id="default-place"><option value="panel" ${stored('default')==='panel'?'selected':''}>Paneeli</option><option value="tab" ${stored('default')==='tab'?'selected':''}>Oma välilehti</option></select></label><span>Kortin ohitus koskee vain yhtä avausta. Oletus ei muutu.</span>`}<small>Puhelimessa paneeli korvaa keskustelun. Välilehti avaa erillisen sivun selaimeen.</small><p id="preference-feedback" role="status"></p></div>`;
}
function stateFor(i) {
 const offerState=document.getElementById('offer-state').value;
 if(offerState==='expired') return 'Tarjous vanhentui. Pyydä agentilta uusi näkymä.';
 if(offerState==='offline') return 'Ei saatavilla. Palvelimeen ei saada yhteyttä.';
 if(i===1) return {running:'Käynnissä · Vain sinulle', stopped:'Pysähtynyt · Pyydä agenttia käynnistämään palvelin.', unavailable:'Ei saatavilla · Osoite ei vastaa. Pyydä agenttia tarkistamaan yhteys.'}[document.getElementById('live-state').value];
 return 'Jäädytetty HTML · 24 kt · Vain sinulle';
}
function available(i) { return document.getElementById('offer-state').value==='ready' && (i===0 || document.getElementById('live-state').value==='running'); }
function cardActions(i) {
 const disabled=available(i)?'':'disabled', dest=destination();
 const open=btn(activeDirection===0?'Avaa':`Avaa ${placeName(dest)}`, 'open', `id="open-${i}" data-file="${i}" class="primary" ${disabled}`);
 if(activeDirection===0) return open+btn('Avaa omalle välilehdelle ↗','tab',`data-file="${i}" ${disabled}`);
 return open+`<details class="open-options"><summary aria-label="Valitse avauspaikka: ${files[i]}">${activeDirection===1?'Vaihda':'Avaa muualla'}</summary><div>${btn('Paneeliin','choose-panel',`data-file="${i}" ${disabled}`)}${btn('Omalle välilehdelle ↗','choose-tab',`data-file="${i}" ${disabled}`)}<small>${activeDirection===1?'Muistaa seuraaville avauksille tässä selainvälilehdessä.':'Vain tämä avaus. Oma oletus säilyy.'}</small></div></details>`;
}
function offer(i) {
 return `<article class="offer" data-offer="${i}"><span class="file-mark" aria-hidden="true">&lt;/&gt;</span><div class="offer-body"><small>Agentti tarjoaa näytettäväksi:</small><strong>${files[i]}</strong><p class="offer-note">${stateFor(i)}</p><div class="actions">${cardActions(i)}</div><p class="open-feedback" role="status" id="feedback-${i}"></p></div></article>`;
}
function render(direction) {
  selection = 0; originButton = null; activeDirection = direction;
  return `<div class="habitat direction-1 riff-${direction}"><aside class="rail"><div class="brand"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true"><path d="M3 9 10 3l7 6v8H3V9Z"/><path d="M8 17v-6h4v6"/></svg><b>Habitat</b></div><span class="meta">TYÖTILAT</span><div class="workspace">Kauppa-analyysi <small>~/src/kauppa-analyysi</small></div><div class="rail-conv">Myynnin lokakuu <small>Pi · valmis</small></div><div class="rail-bottom">JM <span>Jaana Mallinen</span></div></aside><div class="workbench" data-direction="1">
<section class="conversation" aria-label="Keskustelu"><header class="conversation-head"><div><span class="meta">Kauppa-analyysi / Pi</span><h1>Myynnin lokakuu</h1></div><span class="status">● Valmis</span></header>
${directionHelp(direction)}<div class="feed"><div class="user-message">Vertaa lokakuun myyntiä syyskuuhun. Tee myös näkymä, jolla voin kokeilla kanavien rajaamista.</div><div class="agent-message"><div class="agent-label"><b>Pi</b><span>14.32</span></div><p>Lokakuun myynti oli <strong>84 600 €</strong>, kasvua 12,8 %. Verkkokauppa kasvoi eniten. Kokosin luvut raporttiin ja käynnissä olevaan tilannekuvaan.</p><div class="tool-row">Luettu myynti-2026.csv · 240 riviä</div>${offer(0)}<p>Tilannekuvassa voit kokeilla samoja lukuja. Valitset itse, missä kumpaakin katsot.</p>${offer(1)}<p class="meta">Valmis · 38 s · 3 tiedostoa</p></div></div>
<div class="composer"><label for="message">Jatka keskustelua</label><div><textarea id="message" placeholder="Kysy luvuista tai pyydä muutoksia…" rows="1"></textarea>${btn('Lähetä', 'send')}</div><p class="meta" id="send-feedback" role="status">Pi · Claude Sonnet · Synteettinen keskustelu</p></div></section>
<div class="splitter" role="separator" aria-label="Näkymän leveys" aria-orientation="vertical" aria-valuemin="30" aria-valuemax="70" aria-valuenow="52" tabindex="0" hidden></div>
<section class="viewer" aria-label="HTML-näkymä" hidden><header class="viewer-head"><h2 tabindex="-1" id="view-title">${files[0]}</h2><div class="viewer-actions">${btn('Avaa välilehdellä ↗', 'popout')}${btn('Laajenna', 'expand', 'aria-expanded="false"')}${btn('Sulje', 'close', 'aria-label="Sulje näkymä"')}</div></header><div class="view-tabs" role="group" aria-label="Tarjotut näkymät">${files.map((name,i)=>btn(name,'switch',`data-file="${i}" aria-pressed="${i===0}"`)).join('')}</div><p class="isolation">Vain sinulle · Sisältö on erillään Habitatista.</p><iframe title="Myyntiraportti" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe><footer class="view-footer">Kauppa-analyysi · Vain sinulle</footer><p id="panel-feedback" role="status" class="isolation" hidden></p></section>
<button class="conversation-strip" data-action="expand" hidden>← Takaisin keskustelun rinnalle</button>
</div></div>`;
}
function reportDoc(i) {
  // The chart itself has no network or browser integration authority.
  const dark = document.documentElement.dataset.theme === 'dark';
  return `<!doctype html><html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'"><style>
:root{color-scheme:${dark?'dark':'light'};--bg:${dark?'#1b1f23':'#fff'};--ink:${dark?'#e6e9ec':'#16191d'};--muted:${dark?'#98a0a8':'#61676f'};--line:${dark?'#3a424a':'#e2e6e9'};--accent:${dark?'#4fa6b4':'#2b7f8c'}}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 system-ui,sans-serif}main{padding:clamp(18px,4vw,44px);max-width:900px;margin:auto}small,p{color:var(--muted)}h1{font-size:clamp(22px,3vw,32px);font-weight:600;line-height:1.2;margin:12px 0}h2{font-size:17px;font-weight:600}.metric{font-size:36px;letter-spacing:-1px;margin:20px 0 0}.gain{color:var(--accent)}.chart{margin:28px 0;border-bottom:1px solid var(--line);display:flex;align-items:end;gap:clamp(10px,4vw,36px);height:190px;padding:0 12px}.column{height:100%;flex:1;display:flex;flex-direction:column;justify-content:end;text-align:center;gap:8px}.bar{background:var(--accent);border-radius:4px 4px 0 0;min-height:20px}.column span{font-size:12px}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{padding:10px 4px;text-align:left;border-bottom:1px solid var(--line)}th:last-child,td:last-child{text-align:right}button{font:inherit;padding:6px 12px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:6px;cursor:pointer}button:focus-visible{outline:2px solid var(--accent)}button[aria-pressed=true]{background:var(--accent);color:${dark?'#0f1417':'white'}}.switch{display:flex;gap:8px} .foot{margin-top:28px;font-size:12px}</style></head><body><main><small>KAUPPA-ANALYYSI / LOKAKUU 2026</small><h1>${i?'Myynnin tilannekuva':'Myynti kasvaa verkossa'}</h1><p>${i?'Käynnissä olevan prototyypin simulaatio · Kokeile mittaria':'Jäädytetty 25.10.2026 · 14.32 · Sisältö ei päivity'}</p><div class="switch"><button aria-pressed="true" id="euros">Eurot</button><button aria-pressed="false" id="orders">Tilaukset</button></div><div class="metric" id="metric">84 600 €</div><span class="gain" id="gain">+12,8 % syyskuusta</span><div class="chart" aria-label="Myynti kanavittain: verkko 46800, myymälä 28800, kumppanit 9000 euroa">${[['Verkko','46 800',100],['Myymälä','28 800',62],['Kumppanit','9 000',20]].map(([label,value,height])=>`<div class="column"><span>${value} €</span><div class="bar" style="height:${height}px;opacity:${i&&label!=='Verkko'?'.4':'1'}"></div><span>${label}</span></div>`).join('')}</div><h2>Kanavien muutos</h2><table><tr><th>Kanava</th><th>Syyskuu → lokakuu</th></tr><tr><td>Verkkokauppa</td><td>+18,2 %</td></tr><tr><td>Myymälä</td><td>+7,5 %</td></tr><tr><td>Kumppanit</td><td>+4,7 %</td></tr></table><p class="foot">Lähde: myynti-2026.csv · Keksityt luvut prototyypin arviointiin.</p></main><script>const a=document.getElementById('euros'),b=document.getElementById('orders');function set(orders){a.setAttribute('aria-pressed',!orders);b.setAttribute('aria-pressed',orders);document.getElementById('metric').textContent=orders?'1 410 tilausta':'84 600 €';document.getElementById('gain').textContent=orders?'+9,3 % syyskuusta':'+12,8 % syyskuusta';document.querySelectorAll('.column>span:first-child').forEach((el,i)=>el.textContent=(orders?['780','480','150']:['46 800 €','28 800 €','9 000 €'])[i]);document.querySelector('.chart').setAttribute('aria-label',orders?'Tilaukset: verkko 780, myymälä 480, kumppanit 150':'Myynti: verkko 46800, myymälä 28800, kumppanit 9000 euroa')}a.onclick=()=>set(false);b.onclick=()=>set(true);<\/script></body></html>`;
}

function updateFrame() {
 const frame=document.querySelector('.viewer iframe');
 if(frame){frame.srcdoc=reportDoc(selection);frame.title=files[selection];}
}
function setSelection(i) {
 if(!available(i))return;
 selection=i;
 document.getElementById('view-title').textContent=files[i];
 document.querySelectorAll('.view-tabs button').forEach((b,j)=>{b.setAttribute('aria-pressed',j===i);b.disabled=!available(j);});
 updateFrame();document.getElementById('view-title').focus();
 document.querySelector('.view-footer').textContent=stateFor(i);
}
function openView(i,trigger) {
 originButton=trigger;document.querySelector('.workbench').classList.add('opened');
 document.querySelector('.viewer').hidden=false;document.querySelector('.splitter').hidden=false;
 document.getElementById('panel-feedback').hidden=true;setSelection(i);syncConversation();
}
function syncConversation() {
 const bench=document.querySelector('.workbench'),collapsed=bench.classList.contains('collapsed');
 document.querySelector('.conversation').inert=collapsed || (bench.classList.contains('opened') && matchMedia('(max-width:800px)').matches);
 document.querySelector('.conversation-strip').hidden=!collapsed;
 const expand=document.querySelector('.viewer [data-action="expand"]');
 expand.textContent=collapsed?'Pienennä':'Laajenna';expand.setAttribute('aria-expanded',collapsed);
}
function closeView() {
 document.querySelector('.workbench').classList.remove('opened','collapsed');
 document.querySelector('.viewer').hidden=true;document.querySelector('.splitter').hidden=true;syncConversation();
 originButton?.focus();
}
function openTab(i,fromPanel=false) {
 const host=`oh-view-jaana-${i?'live':'frozen'}-demo.example.invalid`;
 const banner=`<div style="padding:12px 18px;border-bottom:1px solid var(--line);overflow-wrap:anywhere"><strong>${i?'Käynnissä oleva prototyyppi':'Jäädytetty HTML'} · Vain sinulle</strong><br><code>https://${host}/</code><br><small>Simuloitu omistajan osoite. Oikea osoite on blob:. Offline-koe ei toteuta pääsynvalvontaa.</small></div>`;
 const url=URL.createObjectURL(new Blob([reportDoc(i).replace('<main>',banner+'<main>')],{type:'text/html'}));
 const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
 const note='Avaus pyydetty omalle välilehdelle. Jos selain esti avauksen, salli se ja yritä uudelleen.';
 if(fromPanel){const el=document.getElementById('panel-feedback');el.hidden=false;el.textContent=note+' Paneeli jää auki; voit sulkea sen itse.';}
 else document.getElementById('feedback-'+i).textContent=note;
}
function refreshActions() {
 document.querySelectorAll('.offer').forEach(card=>{const i=Number(card.dataset.offer);card.querySelector('.actions').innerHTML=cardActions(i);});
}
function installPrototype() {
 const lab=document.querySelector('.lab');new ResizeObserver(()=>document.documentElement.style.setProperty('--lab-height',lab.getBoundingClientRect().height+'px')).observe(lab);
 new MutationObserver(()=>{const divider=document.querySelector('.splitter');if(divider)wireSplitter(divider);}).observe(document.getElementById('stage'),{childList:true});
 const theme=document.getElementById('theme');
 function applyTheme(dark){document.documentElement.dataset.theme=dark?'dark':'light';theme.textContent=dark?'Vaalea':'Tumma';updateFrame();}
 applyTheme(matchMedia('(prefers-color-scheme: dark)').matches);
 theme.onclick=()=>applyTheme(document.documentElement.dataset.theme!=='dark');
 document.getElementById('offer-state').onchange=document.getElementById('live-state').onchange=()=>mount(current);
 document.getElementById('stage').addEventListener('change',e=>{if(e.target.id==='default-place'){save('default',e.target.value);refreshActions();}});
 document.getElementById('stage').addEventListener('click',e=>{
 const b=e.target.closest('button[data-action]');if(!b)return;const i=Number(b.dataset.file);
 switch(b.dataset.action){
 case 'open': if(available(i)){if(destination()==='tab')openTab(i);else openView(i,b);}break;
 case 'tab': if(available(i))openTab(i);break;
 case 'choose-panel':case 'choose-tab': {
  if(!available(i))break;
  const dest=b.dataset.action==='choose-tab'?'tab':'panel';
  if(activeDirection===1){save('last',dest);refreshActions();}
  document.querySelectorAll('.open-options').forEach(el=>el.open=false);
  const trigger=document.getElementById('open-'+i);
  if(dest==='tab'){openTab(i);trigger.focus();}else openView(i,trigger);break;
 }
 case 'popout':openTab(selection,true);break;
 case 'switch':setSelection(i);break;
 case 'close':closeView();break;
 case 'expand':document.querySelector('.workbench').classList.toggle('collapsed');syncConversation();document.getElementById('view-title').focus();break;
 case 'send':document.getElementById('send-feedback').textContent=document.getElementById('message').value.trim()?'Koetilassa viestiä ei lähetetä agentille.':'Kirjoita ensin viesti.';document.getElementById('message').focus();break;
 }
 });
 window.addEventListener('resize',()=>{if(document.querySelector('.workbench'))syncConversation();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape' && document.querySelector('.workbench.opened')){e.preventDefault();closeView();}});
}
function wireSplitter(el) {
  const bench=el.parentElement;let dragging=false;
  function resize(value){value=Math.max(30,Math.min(70,value));bench.style.setProperty('--view-width',value+'%');el.setAttribute('aria-valuenow',value);}
  el.onpointerdown=e=>{if(e.button!==0)return;dragging=true;el.setPointerCapture(e.pointerId);bench.classList.add('dragging');};
  el.onpointermove=e=>{if(!dragging)return;const r=bench.getBoundingClientRect();const fraction=(e.clientX-r.left)/r.width;resize(Math.round(100*(bench.dataset.direction==='0'?fraction:1-fraction)));};
  el.onpointerup=el.onpointercancel=()=>{dragging=false;bench.classList.remove('dragging');};
  el.ondblclick=()=>resize(52);
  el.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const sign=bench.dataset.direction==='0'?1:-1;resize(e.key==='Home'?30:e.key==='End'?70:Number(el.getAttribute('aria-valuenow'))+(e.key==='ArrowRight'?1:-1)*sign*4);};
}
