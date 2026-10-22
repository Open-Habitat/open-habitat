(() => {
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
  document.querySelector('.topbar').hidden = true;
  document.querySelector('.composer').hidden = true;
  document.querySelector('#slow').closest('label').hidden = true;
  const S = {direction:'chip', scene:'extra', draft:''};
  const escape = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const heading = '# A useful first conversation';
  const body = `${heading}\n\nHelp a newcomer find a useful first task in this repository.\nRead the project instructions and suggest one small, testable improvement.\nAsk before writing files. Do not commit or push.\n\n## Suggested output\n\nExplain what the project does, suggest a useful starting point,\nand offer two concrete goals for a first conversation.`;
  const args = 'Ehdota aloitussivua tälle repolle. Nosta mukaan testien ajaminen ja pieni ensimmäinen korjaus. Älä kirjoita tiedostoa vielä.';
  const names = {extra:'open-habitat-start-page', only:'open-habitat-start-page', long:'repository-first-conversation-and-maintenance-orientation', plain:''};
  const notes = {
    chip:'Siru: taidon tunniste on pieni. Oma lisäteksti jää viestin pääsisällöksi.',
    card:'Kortti · suositus: tunniste ja tallennetun taidon otsikko kertovat, mitä kutsuit. Oma lisäteksti on niiden alla.',
    command:'Komento: tuttu /skill:tunniste näkyy viestin alussa. Ohje avautuu sen vierestä.',
  };
  function source() {
    const name=names[S.scene];
    const source=`<skill name="${name}" location="/example/skills/${name}/SKILL.md">\nReferences are relative to /example/skills/${name}.\n\n${body}\n</skill>`;
    return source;
  }
  function skill() {
    if(S.scene==='plain') return '<p class="s-args">Kirjoita ohjeeseen esimerkki: &lt;skill name="esimerkki"&gt;. Tämä on tavallista tekstiä, ei tunnistettu taitokutsu.</p>';
    const name=escape(names[S.scene]);
    const label=S.direction==='command'?`/skill:${name}`:name;
    return `<details class="s-skill s-${S.direction}"><summary><span class="s-tag">Taito</span><span class="s-identity"><code>${label}</code>${S.direction==='card'?`<span class="s-heading">${escape(heading.slice(2))}</span>`:''}</span><span class="s-disclose">Ohje <span aria-hidden="true">⌄</span></span></summary><div class="s-source"><p>Taidon teksti ja lähde · natiivihistoriaan tallennettu sisältö, ei nykyinen tiedosto</p><pre>${escape(source())}</pre></div></details>${S.scene==='only'?'<p class="s-empty">Ei omaa lisätekstiä.</p>':`<p class="s-args">${escape(args)}</p>`}`;
  }
  function render() {
    return `<div class="e-demo s-demo" data-direction="${S.direction}" data-scene="${S.scene}"><p class="e-note">${notes[S.direction]} <span>Synteettinen vedos. Vain tilannevalitsin, taidon ohje ja luonnoskenttä toimivat. Linkkiversiossa järjestelmäfontit.</span></p><nav class="s-scenes" aria-label="Esimerkkitilanne">${[['extra','Lisäteksti'],['only','Pelkkä taito'],['long','Pitkä nimi'],['plain','Tavallinen viesti']].map(([id,label])=>`<button type="button" data-scene="${id}" aria-pressed="${S.scene===id}">${label}</button>`).join('')}</nav><div class="e-app"><aside class="e-rail"><strong>Open Habitat</strong><p>Työtilat　＋</p><code>aurinkokello</code><p class="e-selected">Ensimmäinen tehtävä</p><p>Testien siivous</p><small>Synteettinen työtila</small></aside><main class="e-main"><header class="e-titlebar" aria-label="Keskustelun otsake"><div class="e-title"><h1>Ensimmäinen tehtävä</h1></div><span class="e-workspace-link">aurinkokello</span><span class="e-ready">● Valmis</span><span class="e-chip e-git">${icon('branch')} main</span><span class="e-chip">Opus 5.5 · Medium</span>${['editor','terminal','retitle','archive','info'].map((n,i)=>context(['Editori','Pääte','Luo otsikko uudelleen','Arkistoi','Tiedot'][i],n)).join('')}</header><section class="s-stream" aria-label="Keskustelu"><ol class="s-feed"><li data-kind="user"><article class="s-message s-user"><header><strong>Sinä</strong><span class="s-copy" title="Kopioi viesti · vain sommitelma">⧉</span><time>14:32</time></header>${skill()}</article></li><li><article class="s-message s-reply"><header><strong>✓ Pi</strong><code>Opus 5.5</code><time>14:33</time></header><p>Hyvä ensimmäinen tehtävä on tehdä tuntemattoman tilan käsittelystä näkyvä ja lisätä sille testi.</p><p>Aloitussivulle ehdottaisin kahta tavoitetta: aja testit ja tutustu tilan käsittelyyn. En kirjoittanut tiedostoja.</p></article></li></ol></section><footer class="s-compose"><div class="s-field"><textarea aria-label="Viesti Pi:lle" placeholder="Kirjoita Pi:lle…">${escape(S.draft)}</textarea><div class="s-field-row"><span>/ Komennot　 @ Tiedosto</span><small>Opus 5.5 · Medium</small><button type="button" disabled aria-label="Lähetä (vain sommitelma)">↑</button></div></div><small>Synteettinen keskustelu · lähetys ei käytössä</small></footer></main></div></div>`;
  }
  function start(direction) { S.direction=direction; return render(); }
  window.skillChip=()=>start('chip');
  window.skillCard=()=>start('card');
  window.skillCommand=()=>start('command');
  stage.addEventListener('input', e=> {if(e.target.matches('textarea')) S.draft=e.target.value;});
  stage.addEventListener('click', e=> {
    const scene=e.target.closest('button[data-scene]')?.dataset.scene;
    if(!scene) return;
    S.scene=scene; stage.innerHTML=render();
    stage.querySelector(`button[data-scene="${scene}"]`).focus({preventScroll:true});
  });
})();
