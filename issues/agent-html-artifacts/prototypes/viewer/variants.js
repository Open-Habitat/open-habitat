// All data is synthetic. No product API, host routing or persistence is involved.
const files = ['Myyntiraportti.html', 'Kanavavertailu.html'];
let selection = 0, originButton = null, liveURL = null;
const variants = [0, 1, 2].map(direction => () => render(direction));
const btn = (text, action, extra = '') => `<button data-action="${action}" ${extra}>${text}</button>`;
function offer(i) {
  const state = document.getElementById('offer-state').value;
  const note = state === 'expired' ? 'Tarjous vanhentui. Pyydä agentilta uusi näkymä.' : state === 'offline' ? 'Palvelimeen ei saada yhteyttä. Näkymää ei voi nyt avata.' : 'HTML-raportti · Vain sinulle · ' + (i ? '18' : '24') + ' kt';
  return `<article class="offer" data-offer="${i}"><span class="file-mark" aria-hidden="true">&lt;/&gt;</span><div class="offer-body"><small>Agentti tarjoaa näytettäväksi:</small><strong>${files[i]}</strong><p class="offer-note">${note}</p><div class="actions">${btn('Avaa', 'open', `id="open-${i}" data-file="${i}" class="primary" ${state !== 'ready' ? 'disabled' : ''}`)}${btn('Hylkää', 'dismiss', `data-file="${i}"`)}</div></div></article>`;
}
function liveCard() {
  const state = document.getElementById('live-state').value;
  const note = {running:'Käynnissä · Vain sinulle', stopped:'Pysähtynyt · Kehityspalvelin ei ole käynnissä.', unavailable:'Osoite ei vastaa · Kehityspalvelin on käynnissä, mutta yhteys ei onnistu.'}[state];
  return `<article class="offer live"><span class="file-mark" aria-hidden="true">↗</span><div class="offer-body"><small>Agentti tarjoaa prototyyppiä:</small><strong>Myynnin tilannekuva</strong><p class="offer-note ${state === 'running' ? 'ok' : ''}">${note}</p><p class="meta">Oma sivu erillisessä välilehdessä. Ei avaudu raporttipaneeliin.</p>${state === 'running' ? '<a class="button primary" id="live-link" target="_blank" rel="noopener noreferrer">Avaa omalle välilehdelle ↗</a>' : '<p class="meta">' + (state === 'stopped' ? 'Pyydä agenttia käynnistämään prototyyppi uudelleen.' : 'Pyydä agenttia tarkistamaan yhteys.') + '</p>'}<p id="live-feedback" role="status"></p></div></article>`;
}
function render(direction) {
  selection = 0; originButton = null;
  return `<div class="habitat direction-${direction}"><aside class="rail"><div class="brand"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true"><path d="M3 9 10 3l7 6v8H3V9Z"/><path d="M8 17v-6h4v6"/></svg><b>Habitat</b></div><span class="meta">TYÖTILAT</span><div class="workspace">Kauppa-analyysi <small>~/src/kauppa-analyysi</small></div><div class="rail-conv">Myynnin lokakuu <small>Pi · valmis</small></div><div class="rail-bottom">JM <span>Jaana Mallinen</span></div></aside><div class="workbench" data-direction="${direction}">
<section class="conversation" aria-label="Keskustelu"><header class="conversation-head"><div><span class="meta">Kauppa-analyysi / Pi</span><h1>Myynnin lokakuu</h1></div><span class="status">● Valmis</span></header>
<div class="feed"><div class="user-message">Vertaa lokakuun myyntiä syyskuuhun. Tee myös näkymä, jolla voin kokeilla kanavien rajaamista.</div><div class="agent-message"><div class="agent-label"><b>Pi</b><span>14.32</span></div><p>Lokakuun myynti oli <strong>84 600 €</strong>, kasvua 12,8 %. Verkkokauppa kasvoi eniten. Kokosin luvut raporttiin ja erilliseen kanavavertailuun.</p><div class="tool-row">Luettu myynti-2026.csv · 240 riviä</div>${offer(0)}${offer(1)}<p>Tein lisäksi interaktiivisen tilannekuvan. Voit avata sen omalle sivulleen, kun kehityspalvelin on käynnissä.</p>${liveCard()}<p class="meta">Valmis · 38 s · 3 tiedostoa</p></div></div>
<div class="composer"><label for="message">Jatka keskustelua</label><div><textarea id="message" placeholder="Kysy luvuista tai pyydä muutoksia…" rows="1"></textarea>${btn('Lähetä', 'send')}</div><p class="meta" id="send-feedback" role="status">Pi · Claude Sonnet · Synteettinen keskustelu</p></div></section>
<div class="splitter" role="separator" aria-label="Näkymän leveys" aria-orientation="vertical" aria-valuemin="30" aria-valuemax="70" aria-valuenow="52" tabindex="0" hidden></div>
<section class="viewer" aria-label="HTML-näkymä" hidden><header class="viewer-head"><h2 tabindex="-1" id="view-title">${files[0]}</h2>${direction === 1 ? '' : btn('Keskustelu', 'toggle-conversation', 'aria-expanded="true"')}${btn('Sulje', 'close', 'aria-label="Sulje näkymä"')}</header><div class="view-tabs" role="group" aria-label="Tarjotut näkymät">${files.map((name,i)=>btn(name,'switch',`data-file="${i}" aria-pressed="${i===0}"`)).join('')}</div><p class="isolation">Sisältö toimii eristetyssä näkymässä, erillään Habitatista.</p><iframe title="Myyntiraportti" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe><footer class="view-footer">Kauppa-analyysi · HTML-raportti · Vain sinulle</footer></section>
<button class="conversation-strip" data-action="toggle-conversation" hidden>● Näytä keskustelu · Pi valmis</button>
</div></div>`;
}
function reportDoc(i) {
  // The chart itself has no network or browser integration authority.
  const dark = document.documentElement.dataset.theme === 'dark';
  return `<!doctype html><html lang="fi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'"><style>
:root{color-scheme:${dark?'dark':'light'};--bg:${dark?'#1b1f23':'#fff'};--ink:${dark?'#e6e9ec':'#16191d'};--muted:${dark?'#98a0a8':'#61676f'};--line:${dark?'#3a424a':'#e2e6e9'};--accent:${dark?'#4fa6b4':'#2b7f8c'}}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.6 system-ui,sans-serif}main{padding:clamp(18px,4vw,44px);max-width:900px;margin:auto}small,p{color:var(--muted)}h1{font-size:clamp(22px,3vw,32px);font-weight:600;line-height:1.2;margin:12px 0}h2{font-size:17px;font-weight:600}.metric{font-size:36px;letter-spacing:-1px;margin:20px 0 0}.gain{color:var(--accent)}.chart{margin:28px 0;border-bottom:1px solid var(--line);display:flex;align-items:end;gap:clamp(10px,4vw,36px);height:190px;padding:0 12px}.column{height:100%;flex:1;display:flex;flex-direction:column;justify-content:end;text-align:center;gap:8px}.bar{background:var(--accent);border-radius:4px 4px 0 0;min-height:20px}.column span{font-size:12px}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{padding:10px 4px;text-align:left;border-bottom:1px solid var(--line)}th:last-child,td:last-child{text-align:right}button{font:inherit;padding:6px 12px;background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:6px;cursor:pointer}button:focus-visible{outline:2px solid var(--accent)}button[aria-pressed=true]{background:var(--accent);color:${dark?'#0f1417':'white'}}.switch{display:flex;gap:8px} .foot{margin-top:28px;font-size:12px}</style></head><body><main><small>KAUPPA-ANALYYSI / LOKAKUU 2026</small><h1>${i?'Mistä kasvu tuli?':'Myynti kasvaa verkossa'}</h1><p>${i?'Verkkokauppa toi 7 200 € lisämyyntiä.':'Lokakuun yhteenveto · 1.–31.10.2026'}</p><div class="switch"><button aria-pressed="true" id="euros">Eurot</button><button aria-pressed="false" id="orders">Tilaukset</button></div><div class="metric" id="metric">84 600 €</div><span class="gain" id="gain">+12,8 % syyskuusta</span><div class="chart" aria-label="Myynti kanavittain: verkko 46800, myymälä 28800, kumppanit 9000 euroa">${[['Verkko','46 800',100],['Myymälä','28 800',62],['Kumppanit','9 000',20]].map(([label,value,height])=>`<div class="column"><span>${value} €</span><div class="bar" style="height:${height}px;opacity:${i&&label!=='Verkko'?'.4':'1'}"></div><span>${label}</span></div>`).join('')}</div><h2>Kanavien muutos</h2><table><tr><th>Kanava</th><th>Syyskuu → lokakuu</th></tr><tr><td>Verkkokauppa</td><td>+18,2 %</td></tr><tr><td>Myymälä</td><td>+7,5 %</td></tr><tr><td>Kumppanit</td><td>+4,7 %</td></tr></table><p class="foot">Lähde: myynti-2026.csv · Keksityt luvut prototyypin arviointiin.</p></main><script>const a=document.getElementById('euros'),b=document.getElementById('orders');function set(orders){a.setAttribute('aria-pressed',!orders);b.setAttribute('aria-pressed',orders);document.getElementById('metric').textContent=orders?'1 410 tilausta':'84 600 €';document.getElementById('gain').textContent=orders?'+9,3 % syyskuusta':'+12,8 % syyskuusta';document.querySelectorAll('.column>span:first-child').forEach((el,i)=>el.textContent=(orders?['780','480','150']:['46 800 €','28 800 €','9 000 €'])[i]);document.querySelector('.chart').setAttribute('aria-label',orders?'Tilaukset: verkko 780, myymälä 480, kumppanit 150':'Myynti: verkko 46800, myymälä 28800, kumppanit 9000 euroa')}a.onclick=()=>set(false);b.onclick=()=>set(true);<\/script></body></html>`;
}
function updateFrame() {
  const frame = document.querySelector('.viewer iframe');
  if (frame) { frame.srcdoc = reportDoc(selection); frame.title = files[selection]; }
}
function setLiveLink() {
  if (liveURL) URL.revokeObjectURL(liveURL);
  const doc = reportDoc(0).replace('<main>', `<div style="padding:12px 18px;border-bottom:1px solid var(--line);overflow-wrap:anywhere"><strong>Prototyyppi · Vain sinulle</strong><br><code>https://oh-view-jaana-demo.example.invalid/tilannekuva/</code><br><small>Simuloitu omistajan osoite. Tämän offline-kokeen oikea osoite on blob:-osoite; ei verkkoyhteyttä eikä oikeaa pääsynvalvontaa.</small></div><main>`);
  liveURL = URL.createObjectURL(new Blob([doc], {type:'text/html'}));
  const link = document.getElementById('live-link');
  if (link) link.href = liveURL;
}
function setSelection(i) {
  selection = i;
  document.getElementById('view-title').textContent = files[i];
  document.querySelectorAll('.view-tabs button').forEach((b,j)=>b.setAttribute('aria-pressed',j===i));
  updateFrame();
  document.getElementById('view-title').focus();
}
function openView(i, trigger) {
  originButton = trigger; const bench = document.querySelector('.workbench');
  bench.classList.add('opened'); bench.classList.toggle('collapsed', bench.dataset.direction === '2');
  document.querySelector('.viewer').hidden = false;
  document.querySelector('.splitter').hidden = bench.dataset.direction === '2';
  syncConversation(); setSelection(i);
}
function syncConversation() {
  const bench = document.querySelector('.workbench'), collapsed = bench.classList.contains('collapsed');
  document.querySelector('.conversation').inert = collapsed;
  document.querySelector('.conversation-strip').hidden = !collapsed;
  document.querySelector('[data-action="toggle-conversation"]')?.setAttribute('aria-expanded', !collapsed);
}
function closeView() {
  document.querySelector('.workbench').classList.remove('opened','collapsed');
  document.querySelector('.viewer').hidden = true; document.querySelector('.splitter').hidden = true;
  syncConversation(); originButton?.focus();
}
function installPrototype() {
  const lab = document.querySelector('.lab');
  new ResizeObserver(()=>document.documentElement.style.setProperty('--lab-height',lab.getBoundingClientRect().height+'px')).observe(lab);
  const observer = new MutationObserver(()=>{setLiveLink(); const divider = document.querySelector('.splitter'); if(divider) wireSplitter(divider);});
  // Only direct children: mutations inside a mounted variant must not remount it.
  observer.observe(document.getElementById('stage'),{childList:true});
  const theme = document.getElementById('theme');
  function applyTheme(dark) {document.documentElement.dataset.theme=dark?'dark':'light';theme.textContent=dark?'Vaalea':'Tumma';updateFrame();setLiveLink();}
  applyTheme(matchMedia('(prefers-color-scheme: dark)').matches);
  theme.onclick=()=>applyTheme(document.documentElement.dataset.theme!=='dark');
  document.getElementById('offer-state').onchange=()=>mount(current);
  document.getElementById('live-state').onchange=()=>mount(current);
  document.getElementById('stage').addEventListener('click', e=>{
    if(e.target.closest('#live-link')) {document.getElementById('live-feedback').textContent='Avaus pyydetty uudelle välilehdelle. Jos se ei auennut, salli selaimen avaus ja yritä uudelleen.';return;}
    const b=e.target.closest('button[data-action]'); if(!b)return;
    const i=Number(b.dataset.file);
    switch(b.dataset.action){
      case 'open': openView(i,b);break;
      case 'switch':setSelection(i);break;
      case 'close':closeView();break;
      case 'toggle-conversation':document.querySelector('.workbench').classList.toggle('collapsed');syncConversation();if(!document.querySelector('.workbench').classList.contains('collapsed'))document.getElementById('message').focus();else document.getElementById('view-title').focus();break;
      case 'dismiss':{const card=b.closest('.offer');if(originButton && card.contains(originButton) && document.querySelector('.workbench.opened'))closeView();card.innerHTML=`<p class="meta">${files[i]} · Hylätty tässä kokeessa.</p>${btn('Palauta tarjous','restore',`data-file="${i}"`)}`;card.querySelector('button').focus();break;}
      case 'restore':{const card=b.closest('.offer');card.outerHTML=offer(i);document.getElementById('open-'+i).focus();break;}
      case 'send':{const input=document.getElementById('message');document.getElementById('send-feedback').textContent=input.value.trim()?'Koetilassa viestiä ei lähetetä agentille. Voit jatkaa näkymien vertailua.':'Kirjoita ensin viesti.';input.focus();break;}
    }
  });
  // Escape in app chrome closes the view. Cross-origin frames do not bubble keys.
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
