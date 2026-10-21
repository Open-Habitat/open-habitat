(() => {
 const S = {direction:'settings', repo:'aurinkokello', open:true, query:'', draft:''};
 document.querySelector('.topbar').hidden=true;
 document.querySelector('.composer').hidden=true;
 document.querySelector('#slow').closest('label').hidden=true;
  const paths = {
    editor: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16m5-11-2 3 2 3m3-6 2 3-2 3"/>',
    forward: '<path d="m9 5 7 7-7 7"/>', back: '<path d="m15 5-7 7 7 7"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 8 4 4-4 4M14 16h3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/>',
    message: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
    cross: '<path d="M5 5 19 19M19 5 5 19"/>',
    branch: '<circle cx="7" cy="6" r="2"/><path d="M7 8v10M7 12c0 3 3 4 7 4"/><circle cx="17" cy="16" r="2"/>',
    retitle: '<path fill="currentColor" stroke="none" d="M0.5 13.5 0.61 12.87 2.12 12.64 3.84 2.86 2.41 2.63 2.52 2H8L7.89 2.63L6.37 2.86L5.63 7.11H9.81L10.56 2.86L9.13 2.63L9.24 2H14.74L14.62 2.63L13.1 2.86L11.37 12.64L12.81 12.87L12.7 13.5H7.21L7.32 12.87L8.84 12.64L9.64 8.05H5.46L4.65 12.64L6.08 12.87L5.97 13.5Z"/><g transform="translate(12.5 12) scale(.5)" stroke-width="3.4"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/></g>',
  };
  const icon = name => `<svg data-icon="${name}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
  const btn = (action, label, name, pressed) => `<button type="button" class="e-icon" data-action="${action}" aria-label="${label}" title="${label}"${pressed === undefined ? '' : ` aria-pressed="${pressed}"`}>${icon(name)}</button>`;
  const context = (label, name) => `<button type="button" class="e-icon e-context" aria-disabled="true" aria-label="${label} (vain sommitelma)" title="${label} · vain sommitelma">${icon(name)}</button>`;
  function titleRow() {
    return `<header class="e-titlebar" aria-label="Keskustelun otsake"><div class="e-title"><h1 title="${S.repo==='kuukartta'&&S.direction!=='settings'?'Kuukartta':'Aurinkokello'}">${S.repo==='kuukartta'&&S.direction!=='settings'?'Kuukartta':'Aurinkokello'}</h1></div><span class="e-workspace-link">${S.repo==='kuukartta'&&S.direction!=='settings'?'kuukartta':'aurinkokello'}</span><span class="e-ready">● Valmis</span><span class="e-chip e-git">${icon('branch')} main · +2 −1</span><span class="e-chip">gpt-5.5 · high</span>${context('Editori','editor')}${context('Pääte','terminal')}${context('Luo otsikko uudelleen','retitle')}${context('Arkistoi','archive')}${context('Tiedot','info')}</header>`;
  }

 const skills = [
  {name:'review', description:'Review a change for defects and missing tests.', scope:'global', path:'~/.pi/agent/skills/review/SKILL.md'},
  {name:'meeting-notes', description:'Turn a meeting transcript into attributed notes.', scope:'global', path:'~/.agents/skills/meeting-notes/SKILL.md'},
  {name:'review', description:'Review clock calculations and daylight-saving edge cases.', scope:'aurinkokello', path:'~/src/aurinkokello/.pi/skills/review/SKILL.md'},
  {name:'clock-tests', description:'Run focused clock tests and explain failures.', scope:'aurinkokello', path:'~/src/aurinkokello/.agents/skills/clock-tests/SKILL.md'},
  {name:'release-check', description:'Check the release inputs before publishing a package.', scope:'kuukartta', path:'~/src/kuukartta/.pi/skills/release-check/SKILL.md'},
  {name:'map-data', description:'Validate map fixtures against the source coordinates.', scope:'kuukartta', path:'~/src/kuukartta/.agents/skills/map-data/SKILL.md'},
 ];
 const esc = text => text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const shadowed = s => s.name==='review' && s.scope==='global' && S.repo==='aurinkokello';
 const eligible = s => s.scope==='global'||s.scope===S.repo;
 function row(s) {
  const i=skills.indexOf(s), shadow=shadowed(s), active=eligible(s)&&!shadow;
  return `<article class="s-skill" data-skill="${i}"><div class="s-skill-head"><code>${s.name}</code><span class="s-tag">${s.scope==='global'?'Globaali':esc(s.scope)}</span><span class="s-status">${S.repo==='all'?'Lähde löydetty':shadow?'Ohitettu tässä työtilassa':active?'Saatavilla':'Toisen työtilan taito'}</span></div><p>${esc(s.description)}</p><code class="s-path">${esc(s.path)}</code>${s.name==='review'&&S.repo==='aurinkokello'?`<p class="s-collision">${shadow?'Pi valitsee aurinkokello-repon samannimisen taidon.':'Tämä repon versio voittaa globaalin review-taidon.'}</p>`:''}<div class="s-row-actions"><button data-open="${i}">Avaa editorissa</button>${S.direction==='composer'&&active?`<button data-use="${i}">Lisää <code>/skill:${s.name}</code></button>`:''}</div></article>`;
 }
 function rows() {
  const shown=skills.filter(s=>(S.repo==='all'||eligible(s))&&`${s.name} ${s.description} ${s.path}`.toLowerCase().includes(S.query.toLowerCase()));
  return shown.length?shown.map(row).join(''):'<p class="s-empty">Ei hakua vastaavia taitoja.</p>';
 }
 function catalogue() {
  return `<section class="s-catalogue" aria-label="Taitoluettelo"><header class="s-catalogue-head"><div><small>${S.direction==='settings'?'Asetukset / Pi':S.direction==='workspace'?esc(S.repo)+' / Pi':'Pi / tämän keskustelun työtila'}</small><h2>Taidot</h2></div><button data-act="close" aria-label="Sulje taidot">×</button></header><p class="s-intro">${S.direction==='settings'?'Omat ja repositorioiden taidot yhdessä paikassa.':S.direction==='workspace'?'Mitä Pi löytää tästä työtilasta?':'Valitse taito viestiin tai tarkista sen lähde.'}</p><div class="s-filters"><label>${S.direction==='settings'?'Tarkastele':'Esimerkkityötila'}<select id="s-scope"><option value="aurinkokello" ${S.repo==='aurinkokello'?'selected':''}>aurinkokello</option><option value="kuukartta" ${S.repo==='kuukartta'?'selected':''}>kuukartta</option>${S.direction==='settings'?`<option value="all" ${S.repo==='all'?'selected':''}>Kaikki työtilat</option>`:''}</select></label><label>Hae taitoa<input id="s-search" type="search" value="${esc(S.query)}" placeholder="Nimi, kuvaus tai polku"></label></div><p class="s-help">${S.repo==='all'?'Valitse työtila nähdäksesi, kumpi samanniminen taito voittaa.':'Pi 1.3.0 · luotettu projekti · oletuslähteet. Näillä lähteillä repon taito voittaa samannimisen globaalin.'}</p><div class="s-rows">${rows()}</div><p class="s-footnote">Saatavilla ei tarkoita, että agentti olisi käyttänyt taitoa. Natiivilähde ei kerro yleistä versionumeroa tai käyttökertoja. Polun ~ tarkoittaa omaa kotihakemistoasi.</p></section>`;
 }
 function conversation() {
  return `<section class="s-conversation"><div class="s-messages"><article class="e-user"><small>Sinä · 14:32</small><p>Tarkista kesäaikaan siirtymisen reunatapaukset.</p></article><article><small>Pi · 14:33</small><p>Voin tarkistaa laskennan ja testit. Mihin muutokseen keskitytään?</p></article></div>${S.direction==='composer'&&S.open?catalogue():''}<footer class="s-composer"><div class="s-input"><textarea aria-label="Viesti Pi:lle" placeholder="Kirjoita Pi:lle…">${esc(S.draft)}</textarea><div><button data-act="open">${S.direction==='composer'?'/ Taidot':'/'} </button><small>gpt-5.5 · high</small><button disabled aria-label="Lähetä (sommitelma)">↑</button></div></div><small>Synteettinen luonnos · ei lähetä viestejä</small></footer></section>`;
 }
 function render() {
  return `<div class="e-demo s-demo" data-direction="${S.direction}"><p class="s-note">Synteettinen prototyyppi · vain taidot, haku ja editoriesikatselu toimivat. Muut otsakkeen kuvakkeet ovat sommitelmaa. Linkkiversiossa järjestelmäfontit.</p><div class="s-app"><aside class="s-rail"><strong>Open Habitat</strong><small>Yhdistetty · testipalvelin</small><p>Työtilat　＋</p><code>aurinkokello</code><p class="e-selected">Aurinkokello</p><p>Testien siivous</p><code>kuukartta</code><p>Koordinaattien tarkistus</p><div class="s-account">Testikäyttäjä<button data-act="open">Asetukset${S.direction==='settings'?' › Taidot':''}</button></div></aside><main class="s-main">${titleRow()}<nav class="s-entry"><button data-act="open">${S.direction==='settings'?'Asetukset › Taidot':S.direction==='workspace'?'Työtila › Taidot':'/ Taidot'}</button><span>${S.direction==='workspace'?'Keskustelut　 /　 Taidot':S.direction==='composer'?'Katalogi kentän yhteydessä':'Tili　 /　 Yhteydet　 /　 Taidot'}</span></nav><div class="s-body">${S.direction==='composer'?conversation():S.open?catalogue():conversation()}</div></main></div><dialog class="s-editor"><header><strong>Editorin esikatselu</strong><button data-act="editor-close" aria-label="Sulje editori">×</button></header><code class="s-editor-path"></code><p>Synteettinen tiedosto. Tämä ei avaa oikeaa editoria eikä anna tiedostolle uusia oikeuksia.</p><pre></pre></dialog></div>`;
 }
 function start(direction) {Object.assign(S,{direction,repo:'aurinkokello',open:true,query:'',draft:''});return render();}
 function redraw(){stage.innerHTML=render();}
 window.skillSettings=()=>start('settings');window.skillWorkspace=()=>start('workspace');window.skillComposer=()=>start('composer');
 let editorOpener;
 stage.addEventListener('input', e=>{if(e.target.matches('textarea'))S.draft=e.target.value;if(e.target.id==='s-search'){S.query=e.target.value;stage.querySelector('.s-rows').innerHTML=rows();}});
 stage.addEventListener('change',e=>{if(e.target.id==='s-scope'){S.repo=e.target.value;redraw();stage.querySelector('#s-scope').focus();}});
 stage.addEventListener('click', e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.open!==undefined){const s=skills[Number(b.dataset.open)], dialog=stage.querySelector('dialog');editorOpener=b;dialog.querySelector('.s-editor-path').textContent=s.path;dialog.querySelector('pre').textContent=`---
name: ${s.name}
description: ${s.description}
---

# ${s.name}

Synthetic skill instructions for this prototype only.`;dialog.showModal();dialog.querySelector('button').focus();}
  if(b.dataset.use!==undefined){const s=skills[Number(b.dataset.use)];S.draft=`/skill:${s.name} ${S.draft}`;S.open=false;redraw();stage.querySelector('textarea').focus();}
  if(b.dataset.act==='editor-close'){stage.querySelector('dialog').close();editorOpener?.focus();}
  if(b.dataset.act==='open'){S.open=true;redraw();stage.querySelector('#s-search').focus();}
  if(b.dataset.act==='close'){S.open=false;redraw();stage.querySelector('.s-entry button').focus();}
 });
 stage.addEventListener('keydown',e=>{if(e.key==='Escape'&&!stage.querySelector('dialog').open&&S.open){S.open=false;redraw();stage.querySelector('.s-entry button').focus();}});
})();
