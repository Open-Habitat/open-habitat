// Kierros 13.10.2026: tavallinen tekstivastaus. Historiaan lisätään vaihto, jossa Pi
// selittää valinnan otsikoin, numeroidulla listalla, pitkällä Python-lohkolla,
// taulukolla, lainauksella ja lyhyellä shell-lohkolla. Elävä vuoro päättyy
// kielettömään lyhyeen lohkoon. Suunnat vaihtavat koodin piirtäjän (`mdCode`) ja
// rakenteen typografian (`.frame[data-md]`).

// The structured exchange now lives in lib/fixture.js (RICH).

// ---------- Code renderers, one per direction ----------
const FOLD_AT = 16;               // longer blocks fold to their first lines
const foldBtn = (n) => `<button class="cb-more" type="button" data-codefold aria-expanded="false">Näytä kaikki ${n} riviä</button>`;
const pre = (lines, numbered) => numbered
  ? `<pre><code>${lines.map(l => `<span class="ln">${esc(l) || ' '}</span>`).join('')}</code></pre>`
  : `<pre><code>${esc(lines.join('\n'))}</code></pre>`;
const CODE = {
  v1: (lang, text) => {
    const lines = codeLines(text); const long = lines.length > FOLD_AT;
    return `<div class="cb q${long ? ' folded' : ''}">${pre(lines).replace('<pre>', '<pre tabindex="0">')}<span class="cb-corner">${lang ? `<span class="cb-lang">${esc(langName(lang))}</span>` : ''}${copyBtn('Kopioi koodi', text)}</span>${long ? foldBtn(lines.length) : ''}</div>`;
  },
  v2: (lang, text) => {
    const lines = codeLines(text); const long = lines.length > FOLD_AT;
    if (!lang && lines.length <= 2) return `<div class="cb h compact">${pre(lines)}${copyBtn('Kopioi koodi', text)}</div>`;
    return `<figure class="cb h${long ? ' folded' : ''}"><figcaption><span class="cb-lang">${esc(langName(lang) || 'teksti')}</span><span class="cb-n">${lines.length > 1 ? `${lines.length} riviä` : ''}</span>${copyBtn('Kopioi koodi', text)}</figcaption>${pre(lines)}${long ? foldBtn(lines.length) : ''}</figure>`;
  },
  v4: (lang, text) => codeBox(lang, text),
  v3: (lang, text) => {
    const lines = codeLines(text); const long = lines.length > FOLD_AT;
    return `<figure class="cb d${long ? ' folded' : ''}${lines.length > 3 ? ' numbered' : ''}">${pre(lines, lines.length > 3)}${long ? foldBtn(lines.length) : ''}<figcaption><span class="cb-lang">${esc(langName(lang) || '')}</span><button class="quiet-btn cb-copy" type="button" data-copy="${esc(text)}" aria-label="Kopioi koodi">${ICON_COPY}<span>Kopioi</span></button></figcaption></figure>`;
  },
};

stage.addEventListener('click', (e) => {
  const b = e.target.closest('[data-codefold]'); if (!b) return;
  const box = b.closest('.cb'); const open = box.classList.toggle('folded') === false;
  b.setAttribute('aria-expanded', String(open));
  b.textContent = open ? 'Näytä vähemmän' : `Näytä kaikki ${box.querySelectorAll('.ln').length || codeLines(box.querySelector('code').textContent).length} riviä`;
});

// Dokumentti's copy button keeps its word, so it handles its own feedback.
stage.addEventListener('click', async (e) => {
  const b = e.target.closest('.cb-copy'); if (!b) return;
  e.stopPropagation();
  try { await navigator.clipboard.writeText(b.dataset.copy); } catch {}
  b.setAttribute('data-done', ''); b.innerHTML = `${ICON_CHECK}<span>Kopioitu</span>`;
  setTimeout(() => { b.removeAttribute('data-done'); b.innerHTML = `${ICON_COPY}<span>Kopioi</span>`; }, 1200);
}, true);

function view(v) { document.querySelector('.frame').dataset.md = v; mdCode = CODE[v]; return appView(); }
const v1 = () => view('v1');
const v2 = () => view('v2');
const v3 = () => view('v3');
const v4 = () => view('v4');
