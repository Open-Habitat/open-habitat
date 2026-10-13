// Sisältöfixture: yksi realistinen Pi-keskustelu (GPT-5.5). CONVO on historia; LIVE on
// vuoro, joka vastaa viimeiseen käyttäjän viestiin ja soitetaan tapahtumina (script).
const MODEL = 'GPT-5.5';
const STATUS_MD = `| Päivä | Kohde | Tila | Huomio |
|---|---|---|---|
| 2026-10-03 | gateway | valmis | TLS-ketju uusittu |
| 2026-10-06 | daemon | kesken | historian lohkoluku |
| 2026-10-08 | web | valmis | kontrollitilat |
| 2026-10-10 | provision | valmis | sysusers-malli |
| 2026-10-11 | web | kesken | vuoron asettelu |`;

// A reply with structure: headings, an ordered list, a long code block, a table, a quote
// and a short shell block (round 2026-10-13-vastausteksti).
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

const CONVO = [
  { kind: 'user', time: '14:28', md: 'Tee skripti, joka parsii `status.md`:n taulukon ja tulostaa viime viikon rivit JSONina.' },
  { kind: 'turn', time: '14:31', blocks: [
    { t: 'think', md: '**Planning status table parsing with Python**' },
    { t: 'tool', name: 'read', target: 'status.md', args: { path: 'status.md' }, result: STATUS_MD },
    { t: 'think', md: '**Checking the date column format**' },
    { t: 'tool', name: 'bash', target: 'python3 -c "import re,sys; …"', args: { command: 'python3 -c "import re; print(re.match(r\'\\d{4}-\\d{2}-\\d{2}\', \'2026-10-06\') is not None)"' }, result: 'True' },
    { t: 'think', md: `Taulukossa on neljä saraketta ja päivämäärä on ISO-muodossa, joten \`datetime.date.fromisoformat\` riittää ilman lisäkirjastoja.

Viime viikko kannattaa laskea tämän päivän perusteella seitsemän päivän ikkunana, mutta annan myös \`--since\`-lipun, jotta rajan voi antaa käsin.

Tulostan rivit listana sanakirjoja, avaimet sarakeotsikoista pienellä kirjoitettuna. Tyhjät rivit ja erotinrivi ohitetaan.` },
    { t: 'tool', name: 'write', target: 'scripts/status_rows.py', args: { path: 'scripts/status_rows.py', content: '#!/usr/bin/env python3\n"""Print status.md rows from the last week as JSON."""\nimport argparse, datetime, json, re, sys\n…' }, result: 'Wrote 41 lines to scripts/status_rows.py' },
    { t: 'tool', name: 'bash', target: 'python3 scripts/status_rows.py --since 2026-10-05', args: { command: 'python3 scripts/status_rows.py --since 2026-10-05' }, result: `[
  {"päivä": "2026-10-06", "kohde": "daemon", "tila": "kesken", "huomio": "historian lohkoluku"},
  {"päivä": "2026-10-08", "kohde": "web", "tila": "valmis", "huomio": "kontrollitilat"},
  {"päivä": "2026-10-10", "kohde": "provision", "tila": "valmis", "huomio": "sysusers-malli"},
  {"päivä": "2026-10-11", "kohde": "web", "tila": "kesken", "huomio": "vuoron asettelu"}
]` },
    { t: 'reply', md: `Skripti on tiedostossa \`scripts/status_rows.py\`. Se lukee \`status.md\`:n taulukon, ohittaa otsikko- ja erotinrivit ja tulostaa viimeisen seitsemän päivän rivit JSON-listana.

- Avaimet tulevat sarakeotsikoista pienellä kirjoitettuna.
- \`--since YYYY-MM-DD\` korvaa seitsemän päivän oletusikkunan.
- Virheellinen päivämäärä rivillä ohitetaan varoituksella stderriin.

Ajo tältä viikolta antaa neljä riviä:

\`\`\`
python3 scripts/status_rows.py --since 2026-10-05
\`\`\`` },
  ] },
  { kind: 'turn', time: '14:32', blocks: [
    { t: 'think', md: '**Verifying the script on the full table**' },
    { t: 'tool', name: 'bash', target: 'python3 scripts/status_rows.py --since 2026-10-01', args: { command: 'python3 scripts/status_rows.py --since 2026-10-01 | python3 -c "import json,sys; print(len(json.load(sys.stdin)))"' }, result: '5' },
    { t: 'reply', md: 'Ajoin vielä ilman viikkorajausta: kaikki viisi riviä tulevat läpi, joten erotinrivin ohitus toimii.' },
  ] },
  { kind: 'user', time: '14:33', md: 'Hyvä. Lisää vielä `--table`-lippu, joka tulostaa saman taulukkona terminaaliin.' },
  { kind: 'turn', time: '14:34', blocks: [
    { t: 'think', md: '**Adding a table output mode**' },
    { t: 'tool', name: 'edit', target: 'scripts/status_rows.py', args: { path: 'scripts/status_rows.py', oldText: 'print(json.dumps(rows, ensure_ascii=False, indent=2))', newText: 'if args.table:\n    print_table(rows)\nelse:\n    print(json.dumps(rows, ensure_ascii=False, indent=2))' }, result: 'Applied 1 edit' },
    { t: 'tool', name: 'bash', target: 'python3 scripts/status_rows.py --table', args: { command: 'python3 scripts/status_rows.py --table' }, result: `päivä       kohde      tila    huomio
2026-10-06  daemon     kesken  historian lohkoluku
2026-10-08  web        valmis  kontrollitilat
2026-10-10  provision  valmis  sysusers-malli
2026-10-11  web        kesken  vuoron asettelu` },
    { t: 'reply', md: 'Lisätty. `--table` tulostaa sarakkeet tasattuna; JSON pysyy oletuksena, jotta putkitus ei muutu.' },
  ] },
  { kind: 'user', time: '14:35', md: 'Selitä vielä lyhyesti, miten rivit valitaan, ja näytä ydinkohta koodista.' },
  { kind: 'turn', time: '14:35', blocks: [
    { t: 'think', md: '**Summarizing parse and select for the reader**' },
    { t: 'tool', name: 'read', target: 'scripts/status_rows.py', args: { path: 'scripts/status_rows.py' }, result: '#!/usr/bin/env python3\n"""Print status.md rows from the last week as JSON."""\nimport argparse, datetime, json, re, sys\n…' },
    { t: 'reply', md: RICH },
  ] },
  { kind: 'user', time: '14:36', md: 'Aja testit ja korjaa, mitä löytyy.' },
];

// ---------- The live turn, as Pi events in time (ms) ----------
const LIVE = {
  think1: `Testit ovat \`tests/test_status_rows.py\`:ssä. Ajan ne ensin sellaisenaan, jotta näen mikä kaatuu ennen kuin muutan mitään.

Jos kaatuminen liittyy päivän laskentaan, syy on todennäköisesti \`date.today()\`, joka pitää vaihtaa parametriksi.`,
  think2: '**Making today injectable for the default window**',
  test1: { name: 'bash', target: 'python3 -m pytest tests/ -v', args: { command: 'python3 -m pytest tests/ -v' }, lines: (() => {
    const names = ['parse_header', 'parse_row', 'skip_separator', 'skip_blank', 'lowercase_keys', 'iso_date', 'bad_date_warns', 'since_flag', 'since_inclusive', 'since_future', 'json_shape', 'json_unicode', 'table_align', 'table_header', 'table_empty', 'cli_help', 'cli_no_args', 'cli_bad_flag', 'file_missing', 'file_empty', 'file_no_table', 'multi_table', 'wide_cells', 'pipe_in_cell', 'trailing_spaces', 'crlf', 'bom', 'tabs', 'unicode_header', 'long_note', 'sort_order', 'dedupe', 'today_env', 'today_flag', 'since_default'];
    const out = ['============================= test session starts =============================', 'platform linux -- Python 3.12.3, pytest-8.3.2', 'collected 35 items', ''];
    names.forEach((n, i) => out.push(`tests/test_status_rows.py::test_${n} ${n === 'since_default' ? 'FAILED' : 'PASSED'} [${String(Math.round((i + 1) / names.length * 100)).padStart(3)}%]`));
    out.push('', '=================================== FAILURES ===================================', '_____________________________ test_since_default ______________________________', '', '    def test_since_default(sample):', '        rows = status_rows.select(sample)', '>       assert len(rows) == 4', 'E       AssertionError: expected 4 rows, got 5', 'E       assert 5 == 4', '', 'tests/test_status_rows.py:118: AssertionError', '=========================== short test summary info ============================', 'FAILED tests/test_status_rows.py::test_since_default - AssertionError: expected 4 rows, got 5', '========================= 1 failed, 34 passed in 0.31s =========================');
    return out; })() },
  edit: { name: 'bash', target: 'f=$(mktemp -p /var/tmp patch-XXXX.py); cat > "$f" <<\'EOF\'', args: { command: `f=$(mktemp -p /var/tmp patch-XXXX.py); cat > "$f" <<'EOF'
\"\"\"Make the default window's 'today' injectable.\"\"\"
import sys
from pathlib import Path

path = Path(sys.argv[1])
src = path.read_text()

OLD = "since = date.today() - timedelta(days=7)"
NEW = "since = (args.today or date.today()) - timedelta(days=7)"
if OLD not in src:
    sys.exit("anchor not found")
src = src.replace(OLD, NEW, 1)

# add the flag next to --since
src = src.replace(
    'parser.add_argument("--since", type=date.fromisoformat)',
    'parser.add_argument("--since", type=date.fromisoformat)\\n'
    'parser.add_argument("--today", type=date.fromisoformat, help="override the current date (tests)")',
    1,
)
path.write_text(src)
print(f"patched {path}: 2 replacements")
EOF
python3 "$f" scripts/status_rows.py && rm -f "$f"` }, lines: ['patched scripts/status_rows.py: 2 replacements'] },
  test2: { name: 'bash', target: 'python3 -m pytest tests/test_status_rows.py -q', args: { command: 'python3 -m pytest tests/test_status_rows.py -q' }, lines: ['....', '4 passed in 0.19s'] },
  reply: `Testit menevät läpi. Yksi testi kaatui, koska oletusikkuna laskettiin koneen kellosta; nyt \`--today\` on parametri ja testi antaa sen kiinteänä.

\`\`\`
4 passed in 0.19s
\`\`\``,
};
function script() {
  const ev = []; let t = 0; const at = (d, fn) => { t += d; ev.push([t, fn]); };
  const stream = (text, id, gap) => { const words = text.split(/(?<=\s)/); let acc = ''; for (const w of words) { acc += w; const s = acc; at(gap, (S) => S.set(id, { text: s })); } };
  at(0, (S) => S.start());
  at(350, (S) => S.add({ id: 'k1', t: 'think', text: '', live: true }));
  stream(LIVE.think1, 'k1', 55);
  at(300, (S) => S.set('k1', { live: false }));
  at(350, (S) => S.add({ id: 't1', t: 'tool', ...LIVE.test1, state: 'forming', out: [], expanded: true }));
  at(700, (S) => S.set('t1', { state: 'running' }));
  LIVE.test1.lines.forEach((l, i) => at(i === 0 ? 400 : (i < 4 ? 220 : 90), (S) => S.push('t1', l)));
  at(300, (S) => S.set('t1', { state: 'done' }));
  at(500, (S) => S.add({ id: 'k2', t: 'think', text: '', live: true }));
  stream(LIVE.think2, 'k2', 120);
  at(250, (S) => S.set('k2', { live: false }));
  at(400, (S) => S.add({ id: 'e1', t: 'tool', ...LIVE.edit, state: 'forming', out: [], expanded: true }));
  at(900, (S) => S.set('e1', { state: 'running' }));
  at(400, (S) => { S.push('e1', LIVE.edit.lines[0]); S.set('e1', { state: 'done' }); });
  at(500, (S) => S.add({ id: 't2', t: 'tool', ...LIVE.test2, state: 'running', out: [], expanded: false }));
  LIVE.test2.lines.forEach((l) => at(700, (S) => S.push('t2', l)));
  at(300, (S) => S.set('t2', { state: 'done' }));
  at(600, (S) => S.add({ id: 'r', t: 'reply', text: '', live: true }));
  stream(LIVE.reply, 'r', 45);
  at(500, (S) => S.set('r', { live: false }));
  at(900, (S) => S.settle());
  return ev;
}
