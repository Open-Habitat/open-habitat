// Kierros 13.10.2026: tavallinen tekstivastaus. Historiaan lisätään vaihto, jossa Pi
// selittää valinnan otsikoin, numeroidulla listalla, pitkällä Python-lohkolla,
// taulukolla, lainauksella ja lyhyellä shell-lohkolla. Elävä vuoro päättyy
// kielettömään lyhyeen lohkoon. Suunnat vaihtavat koodin piirtäjän (`mdCode`) ja
// rakenteen typografian (`.frame[data-md]`).

const RICH = `## Miten rivit valitaan

Valinta tehdään kahdessa vaiheessa: ensin taulukko luetaan riveiksi, sitten rivit suodatetaan päivämäärän mukaan. Molemmat ovat tiedostossa \`scripts/status_rows.py\`.

1. \`parse_table()\` etsii ensimmäisen \`|\`-merkillä alkavan rivin ja lukee sarakeotsikot siitä.
2. Erotinrivi ja tyhjät rivit ohitetaan, joten taulukon muotoilu ei vaikuta tulokseen.
3. \`select()\` tulkitsee päivämäärän \`date.fromisoformat\`illa; virheellinen rivi ohitetaan *varoituksella*, ei virheellä.

Ydinkohta on tämä:

\`\`\`python
def parse_table(text):
    """Yield one dict per data row of the first Markdown table in text."""
    lines = iter(text.splitlines())
    for line in lines:
        if line.lstrip().startswith("|"):
            header = [c.strip().lower() for c in line.strip().strip("|").split("|")]
            break
    else:
        return
    for line in lines:
        line = line.strip()
        if not line.startswith("|"):
            break
        if set(line) <= set("|-: "):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        yield dict(zip(header, cells))


def select(rows, since=None, today=None):
    """Return rows whose date is on or after since, oldest first."""
    today = today or date.today()
    since = since or today - timedelta(days=7)
    picked = []
    for row in rows:
        try:
            day = date.fromisoformat(row["päivä"])
        except ValueError:
            print(f"ohitetaan rivi: virheellinen päivämäärä {row['päivä']!r} (odotettiin muotoa VVVV-KK-PP)", file=sys.stderr)
            continue
        if day >= since:
            picked.append(row)
    return sorted(picked, key=lambda r: r["päivä"])
\`\`\`

### Liput

| Lippu | Oletus | Vaikutus |
|---|---|---|
| \`--since\` | 7 päivää sitten | alaraja, päivä mukaan lukien |
| \`--today\` | koneen päivä | kiinteä päivä testeille |
| \`--table\` | pois | tasattu taulukko JSONin sijaan |

> \`--since\` on mukaan lukien: \`--since 2026-10-06\` ottaa myös 6.10. rivin.

Kokeile:

\`\`\`bash
python3 scripts/status_rows.py --since 2026-10-06 --table
\`\`\``;

CONVO.splice(CONVO.length - 1, 0,
  { kind: 'user', time: '14:35', md: 'Selitä vielä lyhyesti, miten rivit valitaan, ja näytä ydinkohta koodista.' },
  { kind: 'turn', time: '14:35', blocks: [
    { t: 'think', md: '**Summarizing parse and select for the reader**' },
    { t: 'tool', name: 'read', target: 'scripts/status_rows.py', args: { path: 'scripts/status_rows.py' }, result: '#!/usr/bin/env python3\n"""Print status.md rows from the last week as JSON."""\nimport argparse, datetime, json, re, sys\n…' },
    { t: 'reply', md: RICH },
  ] });

// ---------- Code renderers, one per direction ----------
const FOLD_AT = 16;               // longer blocks fold to their first lines
const codeLines = (t) => t.replace(/\n$/, '').split('\n');
const langName = (l) => ({ bash: 'shell', sh: 'shell', zsh: 'shell', py: 'python' }[l] || l);
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
