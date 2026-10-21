(() => {
  const S = { direction: 'global', mode: 'closed' };
  document.querySelector('.topbar').hidden = true;
  document.querySelector('.composer').hidden = true;
  document.querySelector('#slow').closest('label').hidden = true;
  const notes = {
    global: 'Näkymäpalkki: editorin avaus ja koko pysyvät aina oikeassa yläkulmassa. Koko ikkuna ei vie paluupainiketta pois.',
    local: 'Oma otsake: avaa yläpalkista; suurenna ja sulje editorin omasta otsakkeesta. Suositus: toiminto on sen paneelin vieressä, jota se muuttaa.',
    views: 'Näkymät: valitse keskustelu, rinnakkain tai editori. Ei erillistä avaus- eikä suurenna-painiketta.',
  };
  const btn = (action, text, pressed) => `<button type="button" data-action="${action}"${pressed === undefined ? '' : ` aria-pressed="${pressed}"`}>${text}</button>`;
  function controls() {
    if (S.direction === 'views') return `<nav class="e-views" aria-label="Näkymä">${btn('closed','Keskustelu',S.mode === 'closed')}${btn('split','Rinnakkain',S.mode === 'split')}${btn('full','Editori',S.mode === 'full')}</nav>`;
    return `<div class="e-controls">${btn('toggle','〈 〉 Editori', S.mode !== 'closed')}${S.direction === 'global' && S.mode !== 'closed' ? btn('size', S.mode === 'full' ? '↙ Rinnakkain' : '⛶ Koko ikkuna') : ''}</div>`;
  }
  function conversation() {
    return `<section class="e-conversation" aria-label="Keskustelu"><header class="e-conv-head"><strong>Status-skripti</strong><span>Valmis</span></header><div class="e-messages"><article class="e-user"><small>Sinä · 14:32</small><p>Lisää status-skriptiin tuntematon tila ja testi sille.</p></article><article><small>Pi · 14:33</small><details><summary>2 työvaihetta · 3 tiedostoa</summary><p>Luettu status.ts. Päivitetty tilan käsittely ja testi.</p></details><p>Lisäsin tuntemattoman tilan. Tyhjä vastaus ei enää näytä palvelua toimivana.</p><p>Toteutus on tiedostossa <button type="button" class="e-file" data-action="file">src/status.ts</button> ja testi tiedostossa <code>src/status.test.ts</code>.</p><p>Testit läpäistiin: 24 / 24.</p></article></div><footer class="e-compose"><div class="e-tray">Prosessit · 1 ajossa　 ·　Spinoffit · 1 työssä</div><div class="e-field"><textarea aria-label="Viesti Pi:lle" placeholder="Kirjoita Pi:lle…">Näytä myös viimeisin tarkistusaika.</textarea><div class="e-field-row"><span>/　@</span><small>Opus 5.5 · Medium</small><button type="button" aria-label="Lähetä (vain sommitelma)" disabled>↑</button></div></div><small>Synteettinen keskustelu · lähetys ei käytössä</small></footer></section>`;
  }
  function editor() {
    return `<section class="e-editor" aria-label="Editori"><header class="e-editor-head"><code>aurinkokello</code>${S.direction === 'local' ? `<div class="e-controls">${btn('size', S.mode === 'full' ? '↙ Rinnakkain' : '⛶ Koko ikkuna')}${btn('close','× Sulje')}</div>` : '<small>VS Code</small>'}</header><div class="e-code-layout"><aside class="e-files"><small>TIEDOSTOT</small><p>▾ src</p><p class="e-selected">　status.ts</p><p>　status.test.ts</p><p>package.json</p></aside><div class="e-code"><div class="e-tab">status.ts　×</div><pre><span class="e-comment">// Synteettinen editori, ei oikea tiedosto</span>
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
    return `<div class="e-demo" data-mode="${S.mode}" data-direction="${S.direction}"><p class="e-note">${notes[S.direction]} <span>Vain painikkeet, tiedostolinkki ja viestikenttä toimivat.</span></p><div class="e-app"><aside class="e-rail"><strong>Open Habitat</strong><p>Työtilat</p><code>aurinkokello</code><p class="e-selected">Status-skripti</p><p>Testien siivous</p><small>Synteettinen työtila</small></aside><main class="e-main"><header class="e-header"><div class="e-workspace"><span aria-hidden="true">☰</span><code>aurinkokello</code></div>${controls()}</header><div class="e-panes">${editor()}${conversation()}${S.mode === 'full' ? `<button type="button" data-action="back" class="e-strip"><span>● Valmis</span><span>Keskustelu</span></button>` : ''}</div></main></div></div>`;
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
