(() => {
  // Same invented data and composer in all directions. No command is executed.
  const samples = {
    one: [{ cmd: 'git status --short', out: ' M web/src/app.tsx\n?? web/src/status.test.ts', exit: 0 }],
    many: [
      { cmd: 'git status --short', out: ' M web/src/app.tsx', exit: 0 },
      { cmd: 'git diff --stat', out: ' web/src/app.tsx | 8 ++++----\n 1 file changed, 4 insertions(+), 4 deletions(-)', exit: 0 },
      { cmd: 'npm test', out: 'PASS status.test.ts\nTests: 24 passed, 24 total', exit: 0 },
      { cmd: 'git diff --check', out: '', exit: 0 },
    ],
    long: [{ cmd: 'npm run dev -- --host 127.0.0.1', out: '> vite\nLocal: http://127.0.0.1:5173/\nWatching for file changes…', live: true }],
    fail: [{ cmd: 'npm test', out: 'FAIL status.test.ts\nExpected: "ready"\nReceived: "unknown"\nTests: 1 failed, 23 passed', exit: 1 }],
    pi: [],
    private: [{ cmd: 'printf "Oma muistiinpano\\n"', out: 'Oma muistiinpano', exit: 0, private: true }],
  };
  const state = { dir: 'cards', scene: 'one', runs: [], pending: false, uncertain: false, pi: false };
  const comp = document.querySelector('.composer');
  // Remove legacy standalone composer selectors; production owns the field geometry.
  comp.className = 'b-composer ah-composer';
  document.querySelector('.frame').classList.add('ah-conversation-frame');
  stage.className = 'ah-conversation-stream';
  const rail = document.createElement('aside'); rail.className = 'b-rail';
  rail.innerHTML = '<strong>Open Habitat</strong><p>Työtilat</p><strong>aurinkokello</strong><p class="b-selected">Status-skripti</p><p>Testien siivous</p><small>Synteettinen työtila</small>';
  document.querySelector('#wrap').prepend(rail);
  const tray = document.createElement('section'); tray.className = 'b-tray';
  tray.innerHTML = '<details><summary>Prosessit · 1 ajossa　 /　 Spinoffit · 1 työssä</summary><div><code>npm run dev</code> · Ajossa · 4:12<br>Testien siivous · Työskentelee</div></details>';
  comp.before(tray);
  document.querySelector('.topbar .state').textContent = 'Synteettinen vedos';
  document.getElementById('slow').closest('label').hidden = true;
  const controls = document.createElement('div'); controls.className = 'b-scenarios';
  controls.innerHTML = [['one','Yksi komento'],['many','Monta peräkkäin'],['long','Pitkä ajo'],['fail','Virhe'],['private','!! Vain sinulle'],['pi','Pi:n keskeytys']].map(([id,label]) => `<button type="button" data-scene="${id}" aria-pressed="false">${label}</button>`).join('') + '<button type="button" data-confirm hidden>Vahvista päättyminen</button><button type="button" data-disconnect hidden>Yhteys katkeaa</button><small>Vedoksen tilanteet · kentän ! ja !! lisäävät vain keksityn tuloksen, eivät aja mitään.</small>';
  document.querySelector('.topbar').after(controls);
  comp.innerHTML = `<section class="b-editor" aria-label="Kirjoita viesti"><div class="ah-cbox"><textarea class="ah-cbox-field" rows="2" placeholder="Kirjoita Pi:lle…" aria-label="Viesti Pi:lle" aria-describedby="bash-notice"></textarea><div class="ah-crow"><span class="ah-crow-shell" hidden></span><span class="ah-crow-btn" title="Ei osa tätä kierrosta">/ <span class="ah-crow-lbl">Komennot</span></span><span class="ah-crow-btn">@ <span class="ah-crow-lbl">Tiedosto</span></span><span class="b-model">Opus 5.5 · Medium</span><span class="ah-crow-grow"></span><button type="button" class="ah-crow-chip" data-mode hidden aria-label="Viestin tapa: Ohjaa">Ohjaa ⇄</button><span class="ah-crow-run"></span><button type="button" class="ah-crow-stop" aria-label="Pysäytä komento" title="Pysäytä komento">■</button><button type="button" class="ah-crow-send" aria-label="Lähetä" title="Lähetä">↑</button></div></div><p class="b-notice" id="bash-notice" role="status"></p></section>`;
  const field = comp.querySelector('textarea');
  const notice = comp.querySelector('.b-notice');
  const stop = comp.querySelector('.ah-crow-stop');
  const send = comp.querySelector('.ah-crow-send');
  const active = () => state.runs.find(r => r.live);
  function composer() {
    const r = active(); const shell = /^!!?/.test(field.value.trimStart());
    const excluded = field.value.trimStart().startsWith('!!');
    comp.querySelector('.ah-cbox').classList.toggle('ah-cbox-shell', shell);
    comp.querySelectorAll('.ah-crow-btn').forEach(el => el.hidden = shell);
    const label = comp.querySelector('.ah-crow-shell'); label.hidden = !shell;
    label.innerHTML = `<span class="ah-crow-bang">${excluded ? '!!' : '!'}</span><span class="ah-crow-shelltext">Komento työtilassa <code>aurinkokello</code> · ${excluded ? 'vain sinulle, ei Pi:lle' : 'Pi näkee tulosteen'}</span>`;
    const chip = comp.querySelector('.ah-crow-run');
    chip.innerHTML = r ? `<span class="ah-crow-bang">${r.private ? '!!' : '!'}</span><code>${esc(r.cmd)}</code><span class="ah-crow-clock">${state.pending ? '…' : '1:24'}</span>` : '';
    stop.hidden = !r && !state.pi; stop.disabled = state.pending;
    stop.setAttribute('aria-label', state.pi ? 'Pysäytä Pi' : 'Pysäytä komento');
    stop.title = state.pi ? 'Pysäytä Pi' : 'Pysäytä komento';
    comp.querySelector('[data-mode]').hidden = !state.pi || shell;
    send.textContent = shell ? '▷' : '↑'; send.setAttribute('aria-label', shell ? 'Aja' : 'Lähetä');
    send.setAttribute('aria-disabled', String(!field.value.trim() || (shell && !!r)));
    controls.querySelector('[data-confirm]').hidden = !state.pending;
    controls.querySelector('[data-disconnect]').hidden = !state.pending;
    notice.innerHTML = state.uncertain ? 'Yhteys katkesi. Työn päättymistä ei tiedetä.' : state.pending ? '<span class="b-spinner" aria-hidden="true"></span>Keskeytetään…' : shell && r ? 'Edellinen komento on vielä käynnissä. Pysäytä se ensin. <a href="#bash-live">Näytä komento</a>' : '';
  }
  function block(r, i) {
    const status = r.live ? (state.pending ? 'Keskeytetään…' : 'Ajossa · 1:24') : r.uncertain ? 'Tulos ei tiedossa' : r.cancelled ? 'Pysäytetty' : `Paluuarvo ${r.exit}`;
    const open = state.dir === 'cards' || r.live || r.exit !== 0 || r.uncertain;
    return `<details class="b-run"${open ? ' open' : ''}${r.live ? ' id="bash-live"' : ''}><summary><span class="b-sigil">${r.private ? '!!' : '!'}</span><code class="b-command">${esc(r.cmd)}</code><span class="b-state${r.exit && !r.live ? ' err' : ''}">${r.live ? '<span class="b-spinner" aria-hidden="true"></span> ' : ''}${status}</span>${r.private ? '<span class="b-private">Vain sinulle · ei Pi:n kontekstissa</span>' : ''}</summary><div class="b-output"><pre>${esc(r.out || '(ei tulostetta)')}</pre><p class="b-caption">${r.private ? 'Tuloste jää omaan historiaasi, ei Pi:n kontekstiin.' : 'Pi näkee tulosteen seuraavan viestisi mukana.'}${r.live ? ' Pitkä ajo jatkuu, kunnes se päättyy tai pysäytät sen kentän ■-painikkeesta.' : ''}</p></div></details>`;
  }
  function thread() {
    const blocks = state.runs.map(block).join('');
    const message = (speaker, text, cls = '') => `<article class="ah-message ${cls}"><header><strong>${speaker}</strong><time>14:32</time></header><div class="ah-prose"><p>${text}</p></div></article>`;
    return `<ol class="b-thread ah-feed b-${state.dir}">
      <li data-kind="user">${message('Sinä', 'Korjaa status-skriptin epävarma tila ja tarkista testit.')}</li>
      <li data-kind="assistant"><div class="ah-agent-turn">
        <details class="b-work"><summary>1 ajatus · 2 työkalua · <code>read status.test.ts</code></summary><div class="b-work-rows">Ajattelu · Tarkistan ensin nykyisen tilamallin.<br>read　web/src/status.ts　· Valmis<br>read　web/src/status.test.ts　· Valmis</div></details>
        <div class="ah-turn-reply ah-turn-interim">${message('Väliviesti', 'Katkos tulkitaan nyt valmiiksi. Muutan sen tuntemattomaksi ja lisään rajatapauksen.', 'ah-message-reply ah-message-interim')}</div>
        <details class="b-work" open><summary>2 työkalua · <code>npm test</code></summary><div class="b-work-rows">edit　web/src/status.ts　· Valmis<br>bash　npm test　· Paluuarvo 0</div></details>
        <div class="ah-turn-reply">${message('Pi', 'Katkos säilyy tuntemattomana. Testit läpäisivät; voit tarkistaa muutoksen ennen committia.', 'ah-message-reply')}</div>
      </div></li>
      <li data-kind="user">${message('Sinä', 'Tarkistan työtilan ennen seuraavaa muutosta.')}</li>
      <li>${state.dir === 'group' && state.runs.length ? `<section class="b-group" aria-label="Omat komennot"><h2>Sinä · ${state.runs.length} ${state.runs.length === 1 ? 'komento' : 'komentoa'}</h2>${blocks}</section>` : blocks}</li>
      <li><p class="b-agent">${state.uncertain ? 'Työn tila ei tiedossa' : state.pi ? (state.pending ? 'Pi · Keskeytetään…' : 'Pi työskentelee · tutkin testien tuloksia') : 'Pi odottaa seuraavaa viestiäsi.'}</p></li>
    </ol>`;
  }
  function paint() { stage.innerHTML = thread(); composer(); }
  function scene(id) {
    state.scene = id; state.runs = samples[id].map(r => ({ ...r })); state.pending = false; state.uncertain = false; state.pi = id === 'pi';
    field.value = ''; controls.querySelectorAll('[data-scene]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scene === id)));
    paint();
  }
  function direction(dir) { state.dir = dir; scene(state.scene); return thread(); }
  window.bashCards = () => direction('cards');
  window.bashLog = () => direction('log');
  window.bashGroup = () => direction('group');
  controls.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.scene) return scene(b.dataset.scene);
    if (!state.pending) return;
    if (state.pi) {
      state.pending = false; state.pi = false;
      if (b.hasAttribute('data-disconnect')) state.uncertain = true;
      paint(); return;
    }
    const r = active(); if (!r) return;
    r.live = false; state.pending = false;
    if (b.hasAttribute('data-confirm')) r.cancelled = true;
    else { r.uncertain = true; state.uncertain = true; }
    paint();
  });
  stop.addEventListener('click', () => { if ((!active() && !state.pi) || state.pending) return; state.pending = true; paint(); });
  comp.querySelector('[data-mode]').addEventListener('click', e => {
    const follow = e.currentTarget.textContent.startsWith('Ohjaa');
    e.currentTarget.textContent = follow ? 'Työn jälkeen ⇄' : 'Ohjaa ⇄';
    e.currentTarget.setAttribute('aria-label', follow ? 'Viestin tapa: Työn jälkeen' : 'Viestin tapa: Ohjaa');
  });
  field.addEventListener('input', composer);
  function submit() {
    const text = field.value.trim(); if (!text) return;
    if (!/^!!?/.test(text)) { notice.textContent = 'Vedos: vain !-komentojen esitys on kokeiltavissa.'; return; }
    if (active()) { composer(); return; }
    const cmd = text.replace(/^!!?\s*/, ''); if (!cmd) return;
    state.runs.push({ cmd, private: text.startsWith('!!'), out: 'Vedoksen esimerkkituloste · komentoa ei ajettu.', exit: 0 });
    state.uncertain = false; field.value = ''; paint(); field.focus();
  }
  send.addEventListener('click', submit);
  field.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    if (e.key === 'Escape' && (active() || state.pi)) { e.preventDefault(); stop.click(); }
  });
})();
