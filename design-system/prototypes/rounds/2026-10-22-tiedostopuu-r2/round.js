(() => {
  // This round compares static surfaces, not a following conversation stream.
  following = false;
  document.querySelector('.topbar').hidden = true;
  document.querySelector('.composer').hidden = true;
  document.querySelector('#slow').closest('label').hidden = true;
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
  Object.assign(paths, {
    user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 4-5 7-5s5.8 1.4 7 5"/>',
    devices:'<rect x="2.5" y="5" width="13" height="10" rx="1.5"/><path d="M1.5 18h10"/><rect x="16" y="8" width="6" height="12" rx="1.5"/>',
    agent:'<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 3v4M9 13h.01M15 13h.01"/>',
    link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    plug:'<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>',
    eye:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.5"/>',
    disk:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 14h18M7 17h.01"/>',
  });
  const icon = name => `<svg data-icon="${name}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
  const btn = (action, label, name, pressed) => `<button type="button" class="e-icon" data-action="${action}" aria-label="${label}" title="${label}"${pressed === undefined ? '' : ` aria-pressed="${pressed}"`}>${icon(name)}</button>`;
  const context = (label, name) => `<button type="button" class="e-icon e-context" aria-disabled="true" aria-label="${label} (vain sommitelma)" title="${label} · vain sommitelma">${icon(name)}</button>`;
  const S = {};
  const esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const files = ['README.md', 'package.json', 'src/status.ts', 'src/status.test.ts', 'src/components/StatusSummaryWithLastObservation.tsx', 'src/lib/status/format.ts'];
  const names = {guided:'Viivasto · suositus', plain:'Pelkistetty', compact:'Tiivistetty'};
  const descriptions = {guided:'Apuviivat sitovat sisennetyt rivit kansioihin. Yksiväriset tiedostokuvakkeet.', plain:'Vain sisennys ja kansionuoli. Enemmän tilaa nimille.', compact:'Yhden alikansion ketjut samalla rivillä. Vähemmän pystysuuntaista tilaa.'};
  const text = path => path.endsWith('status.ts') ? "type Status = 'ready' | 'unknown';\n\nexport function statusOf(\n  reply: string | null,\n): Status {\n  if (!reply) return 'unknown';\n  return 'ready';\n}\n" : `// Synteettinen tiedosto: ${path}\n// Ei oikeaa työtilaa tai palvelinyhteyttä.\n`;
  const segment = (label, choices, selected, attr) => `<fieldset class="segmented" aria-label="${label}">${choices.map(([v,l]) => `<button type="button" class="segment" ${attr}="${v}" aria-pressed="${v === selected}">${l}</button>`).join('')}</fieldset>`;
  const compact = () => document.querySelector('.frame').clientWidth <= 800;
  function settings() {
    return `<div class="settings-shell"><aside class="app-rail"><strong>Open Habitat</strong><p>Työtilat</p><code>aurinkokello</code><p>Aurinkokello</p><footer>Oma tili · Asetukset</footer></aside><main class="ah-account-settings s-page detail"><nav class="s-nav" aria-label="Asetukset"><h1>Asetukset</h1>${['Tili','Laitteet','Agentit','Yhteydet','Integraatiot','Ulkoasu','Editori','Tallennustila'].map((n,i)=>`<span class="s-nav-i" ${n==='Editori'?'aria-current="page"':''}>${icon(['user','devices','agent','link','plug','eye','editor','disk'][i])}${n}</span>`).join('')}</nav><section class="s-main"><span class="s-back">‹ Asetukset · sommitelma</span><h2>Editori</h2><div class="s-card"><div class="s-row"><div class="s-lbl"><strong>Työtilan editori</strong><span class="s-desc">Valinta tallennetaan tilillesi ja seuraa laitteelta toiselle.</span></div><div class="s-val">${segment('Työpöydän editori', [['cm','CodeMirror 6'],['vs','VS Code']],S.engine,'data-engine')}</div></div><div class="s-row s-explanation"><p id="engine-info">${S.engine==='cm'?'CodeMirror 6 muokkaa yhtä tekstitiedostoa kerrallaan.':'VS Code avaa koko työpöytäeditorin. Se käynnistyy vasta avattaessa.'}</p><p class="s-desc">Tiedostojen sisältöä ei tallenneta selaimeen.</p><p class="compact-note">Puhelimessa käytetään CodeMirror 6:ta. Yllä oleva työpöydän valinta säilyy.</p></div></div><p class="s-version-line">Palvelimen versio: <code>0.0.0-esimerkki</code> Tämä välilehti on ajan tasalla.</p><p class="muted">Sama asetusehdotus kaikissa suunnissa. Nykyisen Teema-valitsimen segmentit, ei uutta valitsintyyppiä.</p><button type="button" data-view="editor">Kokeile CodeMirrorin tiedostoja ${icon('forward')}</button></section></main></div>`;
  }
  const fileIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/></svg>';
  function guides(level) {return `<span class="tree-guides" aria-hidden="true">${Array.from({length:level},(_,i)=>`<i style="left:${13+i*14}px"></i>`).join('')}</span>`;}
  function fileRow(path, level=0) {
    return `<button type="button" class="file-row" style="--depth:${level}" data-file="${path}" aria-label="${esc(path)}${S.path===path?(S.dirty?' · Muokattu':' · Auki'):''}" ${S.path===path?'aria-current="true"':''}>${guides(level)}<span class="tree-chevron" aria-hidden="true"></span><span class="file-mark">${fileIcon}</span><code title="${path}">${esc(S.query?path:path.split('/').at(-1))}</code>${S.path===path?`<span class="file-state">${S.dirty?'● Muokattu':'Auki'}</span>`:''}</button>`;
  }
  function folder(name, key, level=0) {
    return `<button type="button" class="folder-row" style="--depth:${level}" data-folder="${key}" aria-expanded="${!!S.expanded[key]}">${guides(level)}<span class="tree-chevron" aria-hidden="true">${S.expanded[key]?'▾':'▸'}</span><code title="${key}">${name}</code></button>`;
  }
  function rows() {
    const q=S.query.toLowerCase();
    if(q) {
      // These are the fixture's loaded names, not recursive host search.
      const paths=files.filter(p=>p.toLowerCase().includes(q));
      return paths.length?paths.map(p=>fileRow(p)).join(''):'<p class="empty" role="status">Ei osumia ladatuissa nimissä.</p>';
    }
    const chain=S.direction==='compact'
      ?folder('lib / status','src/lib/status',1)+(S.expanded['src/lib/status']?fileRow(files[5],2):'')
      :folder('lib','src/lib',1)+(S.expanded['src/lib']?folder('status','src/lib/status',2)+(S.expanded['src/lib/status']?fileRow(files[5],3):''):'');
    return folder('src','src')+(S.expanded.src?folder('components','src/components',1)+(S.expanded['src/components']?fileRow(files[4],2):'')+chain+fileRow(files[2],1)+fileRow(files[3],1):'')+fileRow(files[0])+fileRow(files[1]);
  }
  function browser() {
    return `<aside class="file-browser" aria-label="Työtilan tiedostot" ${S.picker?'':'hidden'}><header><strong>Tiedostot</strong>${btn('picker','Sulje tiedostot','cross')}</header><div class="file-root"><code>aurinkokello</code></div><label class="filter"><span>Suodata ladattuja nimiä</span><input type="search" aria-label="Suodata ladattuja nimiä" placeholder="Nimi tai polku…" value="${esc(S.query)}"></label><p class="filter-scope">Vain ladatut nimet · ei koko repon hakua</p><div class="file-rows" role="group" aria-label="Tiedostopuu">${rows()}</div><footer>Auki = nykyinen tiedosto<br>● Muokattu = tallentamaton<br>Fokus = näppäimistön kohde</footer></aside>`;
  }
  function editor() {
    return `<div class="editor-panes"><section class="editor-panel" aria-label="CodeMirror 6"><header class="editor-head"><span>CodeMirror 6</span><div>${context('Piilota keskustelu','forward')}${context('Sulje editori','cross')}</div></header><div class="browser-toolbar"><button type="button" data-action="picker" aria-expanded="${S.picker}">Tiedostot</button><code title="${S.path}">${S.path}</code><span class="dirty" role="status">${S.dirty?'● Muokattu':S.saved?'Tallennettu':''}</span><button data-action="save" ${S.dirty?'':'disabled'}>Tallenna</button></div><div class="browser-body">${browser()}<div class="document"><div class="line-gutter" aria-hidden="true">1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9</div><textarea aria-label="Tiedoston sisältö" spellcheck="false">${esc(S.content)}</textarea></div></div><p class="editor-warning">Myös agentit voivat muokata tiedostoa. Tallennus tarkistaa muutokset, mutta ei lukitse natiivityökaluja.</p></section><section class="conversation"><header class="e-titlebar"><h1>Aurinkokello</h1><span>aurinkokello</span><span class="ready">● Valmis</span><span class="chip">main · +2 −1</span><span class="chip">Opus 5.5 · Medium</span><div class="header-actions">${['menu','editor','terminal','retitle','archive','info'].map((n,i)=>context(['Työtilat ja keskustelut','Editori','Pääte','Luo otsikko uudelleen','Arkistoi','Tiedot'][i],n)).join('')}</div></header><div class="messages"><article class="user-message"><small>Sinä · 14:32</small><p>Lisää status-skriptiin tuntematon tila ja testi sille.</p></article><article><small>Pi · 14:33</small><p>Lisäsin tuntemattoman tilan. Tyhjä vastaus ei enää näytä palvelua toimivana.</p><p>Toteutus: <code>src/status.ts</code><br>Testi: <code>src/status.test.ts</code></p></article></div><div class="composer-context"><span>Prosessit · 1 ajossa</span><p>Näytä myös viimeisin tarkistusaika.</p><small>Opus 5.5 · Medium　↑</small></div></section></div>`;
  }
  function render() {return `<div class="sf-demo" data-direction="${S.direction}" data-view="${S.view}"><div class="review-note"><strong>${names[S.direction]}</strong><span>${descriptions[S.direction]}</span><small>Synteettinen prototyyppi. Ei palvelinyhteyttä. Linkkiversiossa järjestelmäfontit.</small></div><nav class="surface-choice" aria-label="Esikatseltava näkymä">${segment('Esikatselu',[['settings','Asetukset'],['editor','CodeMirror']],S.view,'data-view')}</nav>${S.view==='settings'?settings():editor()}<dialog id="leave-file"><h2>Tiedostossa on muutoksia</h2><p>Tallenna tai hylkää muutokset ennen toisen tiedoston avaamista.</p><div class="dialog-actions"><button type="button" data-choice="cancel" value="cancel">Jatka muokkaamista</button><button type="button" data-choice="discard" value="discard">Hylkää ja avaa</button><button type="button" data-choice="save" value="save">Tallenna ja avaa</button></div></dialog></div>`;}
  function mount(focus) {stage.innerHTML=render(); stage.scrollTop=0; if(focus) stage.querySelector(focus)?.focus({preventScroll:true});}
  function start(direction) {Object.assign(S,{direction, view:'editor', engine:'cm', dir:'src', expanded:{src:true,'src/components':true,'src/lib':true,'src/lib/status':true}, path:'src/status.ts', content:text('src/status.ts'), dirty:false, saved:false, query:'',picker:!compact()}); return render();}
  window.guidedDirection=()=>start('guided'); window.plainDirection=()=>start('plain'); window.compactDirection=()=>start('compact');
  function openFile(path) {S.path=path; S.content=text(path); S.dirty=false; S.saved=false; if(compact())S.picker=false; mount('.document textarea');}
  stage.addEventListener('click', async e=>{
    const target=e.target.closest('button'); if(!target)return;
    if(target.dataset.choice){stage.querySelector('dialog').close(target.dataset.choice);return;}
    if(target.dataset.engine){S.engine=target.dataset.engine; mount(`[data-engine="${S.engine}"]`);}
    if(target.dataset.view){S.view=target.dataset.view; mount(`[data-view="${S.view}"]`);}
    if(target.dataset.action==='picker'){S.picker=!S.picker; mount(S.picker?'.filter input':'[data-action="picker"]');}
    if(target.dataset.action==='save'){S.dirty=false;S.saved=true;mount('[data-action="picker"]');}
    if(target.hasAttribute('data-dir')){S.dir=target.dataset.dir;S.query='';mount();}
    if(target.dataset.folder){const key=target.dataset.folder;S.dir=key; S.query=''; S.expanded[key]=!S.expanded[key];mount(`[data-folder="${key}"]`);}
    if(target.dataset.file && target.dataset.file!==S.path){
      const path=target.dataset.file;
      if(S.dirty){const dialog=stage.querySelector('dialog');dialog.showModal();dialog.addEventListener('close',()=>{if(dialog.returnValue!=='cancel' && dialog.returnValue)openFile(path);else stage.querySelector('.document textarea')?.focus();},{once:true});}
      else openFile(path);
    }
  });
  stage.addEventListener('keydown',e=>{
    const row=e.target.closest('.file-row,.folder-row');if(!row)return;
    // Keep navigation inside the file browser, not the prototype picker's shortcuts.
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))e.stopPropagation();
    const all=[...stage.querySelectorAll('.file-rows button')],i=all.indexOf(row);
    let next;
    if(e.key==='ArrowDown')next=all[Math.min(i+1,all.length-1)];
    if(e.key==='ArrowUp')next=all[Math.max(i-1,0)];
    if(e.key==='Home')next=all[0];
    if(e.key==='End')next=all.at(-1);
    if(next){e.preventDefault();next.focus();}
    if(row.dataset.folder&&((e.key==='ArrowRight'&&row.getAttribute('aria-expanded')==='false')||(e.key==='ArrowLeft'&&row.getAttribute('aria-expanded')==='true'))){e.preventDefault();row.click();}
  });
  stage.addEventListener('input' ,e=>{
    if(e.target.matches('.document textarea')){S.content=e.target.value;S.dirty=true;S.saved=false;stage.querySelector('.dirty').textContent='● Muokattu';stage.querySelector('[data-action="save"]').disabled=false;stage.querySelector('.file-row[aria-current] .file-state')?.replaceChildren('● Muokattu');stage.querySelector('.file-row[aria-current]')?.setAttribute('aria-label',S.path+' · Muokattu');}
    if(e.target.matches('.filter input')){S.query=e.target.value;stage.querySelector('.file-rows').innerHTML=rows();}
  });
})();
