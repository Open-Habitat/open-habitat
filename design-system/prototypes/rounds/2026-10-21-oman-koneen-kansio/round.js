(() => {
  // Round-local presentation only. No native picker, host or personal files.
  const S = {direction: 0, state: 'brave', open: false, menu: false, prompt: false, attachment: false, feedback: ''};
  const B = (action, text, extra = '') => `<button type="button" data-act="${action}" ${extra}>${text}</button>`;
  const ico = (action, symbol, label) => B(action, symbol, `class="f-icon" aria-label="${label}" title="${label}"`);
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
  const context = (name, label) => `<button type="button" class="f-icon" disabled aria-label="${label} (sommitelma)" title="${label}">${icon(name)}</button>`;
  function titleRow() {
    return `<header class="f-top" aria-label="Keskustelun otsake"><div class="f-title"><strong>Status-skripti</strong></div><code class="f-workspace">aurinkokello</code><span class="f-status">✓ Valmis</span><span class="f-chip">${icon('branch')} main · +2 −1</span><span class="f-chip">gpt-5.5 · Medium</span>${context('editor','Avaa editori')}${context('terminal','Pääte')}${context('retitle','Luo uusi otsikko')}${context('archive','Arkistoi')}${context('info','Tiedot')}${S.direction === 1 ? B('settings','Asetukset','class="f-mobile-settings"') : ''}</header>`;
  }

  const notes = ['Kansio liitevalikossa: apu näkyy vasta, kun sitä tarvitset. Suositus.', 'Kansio asetuksissa: rauhallinen keskustelu, mutta lupa on kauempana työstä.', 'Kansio kentän korttina: ohje lähellä viestiä, mutta se vie kirjoitustilaa.'];
  document.querySelector('.topbar').hidden = true;
  document.querySelector('.composer').hidden = true;
  document.querySelector('#slow').closest('label').hidden = true;
  function content() {
    const fallback = `<p>Yksittäisen tiedoston voit lisätä liitteenä ilman kansiolupaa.</p>${B('attach','Lisää tiedosto liitteenä')}`;
    const scope = '<p>Agentti voi selata ja hakea tiedostoja vain valitsemastasi kansiosta tämän välilehden ollessa auki. Kansiota ei lähetetä kokonaan: pyydetyt tiedostot siirtyvät palvelimelle liitteinä.</p>';
    if (S.state === 'brave') return `<strong>Ei käytettävissä nykyisillä selainasetuksilla</strong><p>Voit jatkaa keskustelua ja lisätä tiedostoja liitteinä.</p><details><summary>Käytätkö Bravea?</summary><p>Bravessa voit halutessasi ottaa käyttöön asetuksen <b>File System Access API</b>. Kopioi osoite selaimen osoiteriville:</p><code class="f-address">brave://flags/#file-system-access-api</code><p>Ota asetus käyttöön ja käynnistä selain uudelleen. Kansio valitaan erikseen tämän jälkeen. Jos asetusta ei löydy, käytä liitteitä.</p></details>${B('attach','Lisää tiedosto liitteenä')}`;
    if (S.state === 'unsupported') return `<strong>Selain ei tarjoa kansiopääsyä</strong><p>Kansion käyttö vaatii File System Access API -tuen. Tällä selaimella voit käyttää yksittäisiä liitteitä.</p>${fallback}`;
    if (S.state === 'granted') return `<strong>Jaettu kansio: <code>agentille</code></strong>${scope}${S.feedback ? `<p role="status">${S.feedback}</p>` : ''}<p class="f-status">Kansio käytettävissä tässä välilehdessä</p><div class="f-actions">${B('choose','Vaihda kansio')}${B('revoke','Lopeta jakaminen')}</div>`;
    const explanation = S.state === 'refused' ? '<p role="status">Kansiota ei valittu. Selain voi estää esimerkiksi kotikansion tai Downloads-kansion. Valitse niiden sijaan oma alikansio, kuten <code>Downloads/agentille</code>, tai lisää tiedosto liitteenä.</p>' : S.state === 'permission' ? '<p>Kansion <code>agentille</code> lupa on vahvistettava uudelleen. Kansiota ei voi vielä käyttää.</p>' : '<p>Valitse kansio, jonka tiedostoja agentti saa käyttää.</p>';
    return `${explanation}${scope}<p>Valitse oma alikansio, esimerkiksi <code>Downloads/agentille</code>. Selain voi estää laajat kansiot. Pelkkään kuvakaappaukseen riittää liite.</p>${B('choose',S.state === 'permission' ? 'Vahvista kansiolupa' : 'Valitse kansio…', 'class="f-primary"')}${fallback}`;
  }
  function panel() {
    if (!S.open) return '';
    return `<section class="f-panel" tabindex="-1" aria-label="Oman koneen kansio"><header><div>${S.direction === 1 ? '<small>Asetukset / Tämä selain</small>' : ''}<h2>Oman koneen kansio</h2></div>${ico('close','×','Sulje kansio-ohje')}</header><div class="f-panel-body">${content()}</div></section>`;
  }
  function render() {
    return `<div class="f-demo" data-direction="${S.direction}"><div class="f-lab"><span>${notes[S.direction]}</span><label>Simuloitu tila <select id="f-scenario" aria-label="Simuloitu selaintila">${[['brave','Brave / API puuttuu'],['unsupported','Ei selaintukea'],['ready','Valittavissa'],['permission','Lupa vahvistettava'],['refused','Valinta keskeytyi / estettiin'],['granted','Kansio jaettu']].map(([v,t]) => `<option value="${v}"${v === S.state ? ' selected' : ''}>${t}</option>`).join('')}</select></label><small>Synteettinen · ei oikeita tiedostoja tai lupia · linkissä järjestelmäfontit</small></div><div class="f-app"><aside class="f-rail"><strong>Open Habitat</strong><small>Yhdistetty · synteettinen</small><p>Etusivu</p><p>Työtilat</p><code>▾ aurinkokello</code><p class="f-current">Status-skripti　✓</p><p>Testien siivous</p><div class="f-account">${B('settings','Asetukset',S.direction !== 1 ? 'disabled title="Konteksti, ei toiminnassa tässä suunnassa"' : '')}<small>Esimerkkikäyttäjä</small></div></aside><main class="f-main">${titleRow()}<div class="f-body"><section class="f-conversation" aria-label="Keskustelu"><div class="f-messages"><article class="f-user"><small>Sinä · 14:32</small><p>Lisää status-skriptiin tuntematon tila ja testi sille.</p></article><article><small>Pi · 14:33</small><details><summary>2 työvaihetta · 3 tiedostoa</summary><p>Luettu status.ts. Päivitetty tilan käsittely ja testi.</p></details><p>Lisäsin tuntemattoman tilan. Tyhjä vastaus ei enää näytä palvelua toimivana.</p><p>Toteutus on tiedostossa <code>src/status.ts</code>. Testit läpäistiin: 24 / 24.</p></article></div><footer class="f-compose">${S.direction === 2 ? panel() : ''}${S.direction === 0 ? panel() : ''}${S.menu ? `<div class="f-menu"><strong>Lisää keskusteluun</strong>${B('attach','Tiedosto liitteenä…')}${B('folder','Oman koneen kansio…')}<small>Liite lähettää valitsemasi tiedoston. Kansio sallii agentin pyytämät haut.</small></div>` : ''}${S.attachment ? `<p class="f-attachment" role="status">kuvakaappaus.png · malliliite ${ico('remove','×','Poista malliliite')}</p>` : ''}<div class="f-field"><textarea aria-label="Viesti Pi:lle" placeholder="Kirjoita Pi:lle…">Katso myös viimeisin kuvakaappaus.</textarea><div class="f-field-row">${B('attachments','<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 13 6-6a3 3 0 0 1 4 4L9 21a5 5 0 0 1-7-7L13 3a4 4 0 0 1 6 6L9 19a2 2 0 0 1-3-3l9-9"/></svg> Liitä','aria-label="Lisää liite"')}${S.direction === 2 ? B('folder',S.state === 'granted' ? 'Kansio: agentille' : 'Oman koneen kansio', `aria-expanded="${S.open}"`) : ''}<span>/　@</span><button disabled aria-label="Lähetä (ei käytössä prototyypissä)">↑</button></div></div><small>Vain kansiopolut, liite-esimerkki ja luonnos toimivat.</small></footer></section>${S.direction === 1 ? panel() : ''}</div></main></div>${S.prompt ? `<div class="f-scrim"><section class="f-prompt" role="dialog" aria-modal="true" aria-label="Lupapyynnön simulaatio" tabindex="-1"><small>PROTOTYYPIN SIMULAATIO · EI SELAIMEN LUPAIKKUNA</small><h2>Valitse kansio ja anna lupa</h2><p>Oikeassa tuotteessa selain hoitaa valinnan ja luvan. Tässä voit kokeilla eri lopputuloksia.</p><div class="f-actions">${B('grant','Salli: agentille','class="f-primary"')}${B('refuse','Selain estää kansion')}${B('deny','Älä salli')}${B('cancel','Peruuta')}</div></section></div>` : ''}</div>`;
  }
  let draft, returnAction = 'folder';
  function paint(focus) {
    const old = stage.querySelector('textarea');
    if (old) draft = old.value;
    stage.innerHTML = render();
    if (draft !== undefined) stage.querySelector('textarea').value = draft;
    if (focus) [...stage.querySelectorAll(focus)].find(el => el.getClientRects().length)?.focus({preventScroll:true});
  }
  function start(direction) { Object.assign(S,{direction,open:false,menu:false,prompt:false,attachment:false,feedback:''}); draft = undefined; return render(); }
  window.folderAttachments = () => start(0);
  window.folderSettings = () => start(1);
  window.folderInline = () => start(2);
  stage.addEventListener('change', e => { if (e.target.id !== 'f-scenario') return; S.state = e.target.value; S.feedback = ''; S.prompt = false; paint('#f-scenario'); });
  stage.addEventListener('click', e => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (!a) return;
    let focus;
    if (a === 'attachments') { S.menu = !S.menu; S.open = false; focus = S.menu ? '.f-menu button' : '[data-act="attachments"]'; }
    if (a === 'folder' || a === 'settings') { returnAction = a; S.open = !S.open; S.menu = false; focus = S.open ? '.f-panel' : `[data-act="${a}"]`; }
    if (a === 'close') { S.open = false; focus = S.direction === 0 ? '[data-act="attachments"]' : `[data-act="${returnAction}"]`; }
    if (a === 'choose') { S.feedback = ''; S.prompt = true; focus = '.f-prompt'; }
    if (['grant','refuse','deny','cancel'].includes(a)) { S.prompt = false; if (S.state === 'granted' && a !== 'grant') S.feedback = 'Kansion vaihtoa ei tehty. Selain voi estää valinnan tai lupa voidaan jättää antamatta. Aiempi kansio agentille on yhä jaettu.'; else S.state = a === 'grant' ? 'granted' : 'refused'; focus = '.f-panel'; }
    if (a === 'revoke') { S.state = 'ready'; focus = '.f-panel'; }
    if (a === 'attach') { S.attachment = true; S.open = false; S.menu = false; focus = 'textarea'; }
    if (a === 'remove') { S.attachment = false; focus = 'textarea'; }
    paint(focus);
  });
  stage.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (S.prompt) { S.prompt = false; paint('[data-act="choose"]'); }
      else { S.open = false; S.menu = false; paint(S.direction === 1 ? '[data-act="settings"]' : S.direction === 2 ? '[data-act="folder"]' : '[data-act="attachments"]'); }
    }
    if (e.key === 'Tab' && S.prompt) {
      const buttons = [...stage.querySelectorAll('.f-prompt button')], first = buttons[0], last = buttons.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement.classList.contains('f-prompt'))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();
