(() => {
  const S = { direction: 'global', mode: 'closed' };
  document.querySelector('.topbar').hidden = true;
  document.querySelector('.composer').hidden = true;
  document.querySelector('#slow').closest('label').hidden = true;
  const notes = {
    global: 'Näkymäpalkki: oikea keskusteluotsake ulottuu koko jaon yli. Editorin avaus ja koko pysyvät sen painikerivissä myös koko ikkunassa.',
    local: 'Oma otsake · suositus: keskustelun otsake pysyy keskustelussa. Avaa sen editorikuvakkeesta; suurenna ja sulje editorin omasta otsakkeesta.',
    views: 'Näkymät: sama yhteinen keskusteluotsake, mutta kolme kuvaketta valitsee suoraan keskustelun, rinnakkaisnäkymän tai koko editorin.',
  };
  // SVG geometry copied from production Icon.tsx, plus the retitle action
  // from Navigation.tsx. The existing forward/back icons mean hide/show chat.
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
  function controls() {
    if (S.direction === 'views') return `<nav class="e-views" aria-label="Näkymä">${btn('closed','Keskustelu','message',S.mode === 'closed')}${btn('split','Editori rinnakkain','editor',S.mode === 'split')}${btn('full','Editori koko ikkunaan','forward',S.mode === 'full')}</nav>`;
    return `<div class="e-controls">${btn('toggle', S.mode === 'closed' ? 'Avaa editori' : 'Sulje editori', 'editor', S.mode !== 'closed')}${S.direction === 'global' && S.mode !== 'closed' ? sizeButton() : ''}</div>`;
  }
  const sizeButton = () => btn('size', S.mode === 'full' ? 'Palauta rinnakkain' : 'Editori koko ikkunaan', S.mode === 'full' ? 'back' : 'forward');
  function titleRow() {
    return `<header class="e-titlebar" aria-label="Keskustelun otsake"><div class="e-title"><h1 title="Aurinkokello">Aurinkokello</h1></div><span class="e-workspace-link">aurinkokello</span><span class="e-ready">● Valmis</span><span class="e-chip e-git">${icon('branch')} main · +2 −1</span><span class="e-chip">Opus 5.5 · Medium</span>${S.mode !== 'closed' ? context('Työtilat ja keskustelut','menu') : ''}${controls()}${context('Pääte','terminal')}${context('Luo otsikko uudelleen','retitle')}${context('Arkistoi','archive')}${context('Tiedot','info')}</header>`;
  }
  function conversation() {
    return `<section class="e-conversation" aria-label="Keskustelu">${S.direction === 'local' ? titleRow() : ''}<div class="e-messages"><article class="e-user"><small>Sinä · 14:32</small><p>Lisää status-skriptiin tuntematon tila ja testi sille.</p></article><article><small>Pi · 14:33</small><details><summary>2 työvaihetta · 3 tiedostoa</summary><p>Luettu status.ts. Päivitetty tilan käsittely ja testi.</p></details><p>Lisäsin tuntemattoman tilan. Tyhjä vastaus ei enää näytä palvelua toimivana.</p><p>Toteutus on tiedostossa <button type="button" class="e-file" data-action="file">src/status.ts</button> ja testi tiedostossa <code>src/status.test.ts</code>.</p><p>Testit läpäistiin: 24 / 24.</p></article></div><footer class="e-compose"><div class="e-tray">Prosessit · 1 ajossa　 ·　Spinoffit · 1 työssä</div><div class="e-field"><textarea aria-label="Viesti Pi:lle" placeholder="Kirjoita Pi:lle…">Näytä myös viimeisin tarkistusaika.</textarea><div class="e-field-row"><span>/　@</span><small>Opus 5.5 · Medium</small><button type="button" aria-label="Lähetä (vain sommitelma)" disabled>↑</button></div></div><small>Synteettinen keskustelu · lähetys ei käytössä</small></footer></section>`;
  }
  function editor() {
    return `<section class="e-editor" aria-label="Editori"><header class="e-editor-head"><code>aurinkokello</code>${S.direction === 'local' ? `<div class="e-controls">${sizeButton()}${btn('close','Sulje editori','cross')}</div>` : '<small>VS Code</small>'}</header><div class="e-code-layout"><aside class="e-files"><small>TIEDOSTOT</small><p>▾ src</p><p class="e-selected">　status.ts</p><p>　status.test.ts</p><p>package.json</p></aside><div class="e-code"><div class="e-tabs" aria-label="Editorin välilehdet"><span class="e-tab e-tab-active">status.ts　×</span><span class="e-tab">status.test.ts　×</span><span class="e-tab">README.md　×</span></div><pre><span class="e-comment">// Synteettinen editori, ei oikea tiedosto</span>
<span class="e-keyword">type</span> Status =
  | <span class="e-string">'ready'</span>
  | <span class="e-string">'unknown'</span>;

<span class="e-keyword">export function</span> statusOf(
  reply: string | null,
): Status {
  <span class="e-keyword">if</span> (!reply) {
    <span class="e-keyword">return</span> <span class="e-string">'unknown'</span>;
  }
  <span class="e-keyword">return</span> <span class="e-string">'ready'</span>;
}</pre></div></div><footer class="e-editor-foot"><span>main　 ·　TypeScript</span><span>Ln 9, Col 3</span></footer></section>`;
  }
  function render() {
    return `<div class="e-demo" data-mode="${S.mode}" data-direction="${S.direction}"><p class="e-note">${notes[S.direction]} <span>Vain editorin ohjaimet, tiedostolinkki ja viestikenttä toimivat. Muut kuvakkeet ovat tuotannon kontekstia.</span></p><div class="e-app"><aside class="e-rail"><strong>Open Habitat</strong><p>Työtilat　＋</p><code>aurinkokello</code><p class="e-selected">Aurinkokello</p><p>Testien siivous</p><small>Synteettinen työtila</small></aside><main class="e-main">${S.direction !== 'local' ? titleRow() : ''}<div class="e-panes">${editor()}${conversation()}${S.mode === 'full' ? `<button type="button" data-action="back" class="e-strip"><span>● Valmis</span><span>Keskustelu</span></button>` : ''}</div></main></div></div>`;
  }
  function start(direction) { S.direction = direction; S.mode = 'closed'; return render(); }
  window.editorGlobal = () => start('global');
  window.editorLocal = () => start('local');
  window.editorViews = () => start('views');
  stage.addEventListener('click', event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    const old = S.mode;
    const draft = stage.querySelector('textarea')?.value;
    if (['closed','split','full'].includes(action)) S.mode = action;
    else if (action === 'close') S.mode = 'closed';
    else if (action === 'toggle') S.mode = old === 'closed' ? 'split' : 'closed';
    else if (action === 'size') S.mode = old === 'full' ? 'split' : 'full';
    else if (action === 'file' || action === 'back') S.mode = 'split';
    stage.innerHTML = render();
    if (draft !== undefined) stage.querySelector('textarea').value = draft;
    const target = S.mode === 'full' ? '[data-action="size"], [data-action="split"]' : S.mode === 'closed' ? '[data-action="toggle"], [data-action="split"]' : '[data-action="size"], [data-action="full"]';
    stage.querySelector(target)?.focus({preventScroll:true});
  });
})();
