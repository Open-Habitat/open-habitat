// Editorin tila (proto-file-viewing-2, 19.10.2026). Jari valitsi edellisellä kierroksella
// Editorin: tiedostolinkki avaa työtilan VS Coden (code-server omassa originissaan) välilehdelle
// riville. Editorilla oli kuitenkin liian vähän tilaa. Tämä kierros pitää sisällön, tunnistuksen
// ja VS Code -sijaisen ennallaan (tiedostot `2026-10-19-tiedostot`-kierroksesta) ja vaihtaa vain
// sen, miten editori ja keskustelu jakavat ikkunan. Puhelimessa VS Code ei toimi, joten linkki
// avaa siellä kaikissa suunnissa lukukurkistuksen linkin alle.
(() => {
const ROOT = '/home/maintainer/Sources/open-habitat';
const tabs = (s) => s.replace(/^(?: {2})+/gm, (m) => '\t'.repeat(m.length / 2));

// ---------- Fixture repository: committed (HEAD) and working tree (FS) ----------
const HEAD = {}; const FS = {};
const put = (p, text, head = text) => { FS[p] = text; HEAD[p] = head; };
const QM = 'web/src/components/QuotaMeter.tsx', QMT = 'web/src/components/QuotaMeter.test.tsx';
const QG = 'internal/daemon/quota_linux.go', QT = 'internal/daemon/quota_linux_test.go', SN = 'internal/daemon/snapshot.go';
const FULL_FI = 'Levy on täynnä. Poista tiedostoja tai pyydä ylläpitäjältä lisää tilaa.';

put('AGENTS.md', `# open-habitat

We are building a multi-user web host for native AI agents. A person signs in
through the browser. The gateway maps them to their own Linux user, and a daemon
running as that user lists their workspaces and runs their agents.

- **Unix users are the security boundary.**
- **Reuse mature native components.**

[TESTING.md](TESTING.md) says which tests to run and what each result proves.
`);
put('README.md', `# Open Habitat

A browser front door to your own Linux account on a shared server: your
workspaces, your agents and your files, exactly as they are over SSH.

\`\`\`
go build ./cmd/open-habitat
npm ci --prefix web && npm run build --prefix web
\`\`\`
`);
put('go.mod', `module github.com/Open-Habitat/open-habitat

go 1.27.1

require golang.org/x/sys v0.38.0
`);
put('cmd/open-habitat/main.go', tabs(`package main

import (
  "fmt"
  "os"

  "github.com/Open-Habitat/open-habitat/internal/cli"
)

func main() {
  if err := cli.Run(os.Args[1:]); err != nil {
    fmt.Fprintln(os.Stderr, err)
    os.Exit(1)
  }
}
`));
put('contracts/v1/account-storage.schema.json', `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "account-storage.schema.json",
  "title": "AccountStorage",
  "type": "object",
  "required": ["used_bytes", "soft_bytes", "hard_bytes"],
  "properties": {
    "used_bytes": { "type": "integer", "minimum": 0 },
    "soft_bytes": { "type": "integer", "minimum": 0 },
    "hard_bytes": { "type": "integer", "minimum": 0, "description": "0 when quotas are off" }
  },
  "additionalProperties": false
}
`);
put('docs/product.md', `# Open Habitat

Henkilö kirjautuu selaimella, keskustelee agentin kanssa ja seuraa sen työtä.
Tiedostot, Git-repot ja keskusteluhistoria ovat hänen omalla Linux-tunnuksellaan.

## Levytila

Jokaisella on oma kiintiö. Näkymä kertoo käytön ja sen, mitä tehdä, kun levy täyttyy.
`);
put('internal/daemon/quotactl_linux.go', tabs(`package daemon

import (
  "unsafe"

  "golang.org/x/sys/unix"
)

// dqblk mirrors struct if_dqblk from <linux/quota.h>.
type dqblk struct {
  Bhardlimit uint64
  Bsoftlimit uint64
  Curspace   uint64
  Ihardlimit uint64
  Isoftlimit uint64
  Curinodes  uint64
  Btime      uint64
  Itime      uint64
  Valid      uint32
}

// quotactlGet reads one user's quota with quotactl(2) Q_GETQUOTA.
func quotactlGet(device string, uid int) (dqblk, error) {
  var dq dqblk
  dev, err := unix.BytePtrFromString(device)
  if err != nil {
    return dq, err
  }
  cmd := uintptr(0x800007 << 8) // QCMD(Q_GETQUOTA, USRQUOTA)
  _, _, errno := unix.Syscall6(unix.SYS_QUOTACTL, cmd, uintptr(unsafe.Pointer(dev)), uintptr(uid), uintptr(unsafe.Pointer(&dq)), 0, 0)
  if errno != 0 {
    return dq, errno
  }
  return dq, nil
}
`));
const QG_OLD = tabs(`package daemon

import (
  "errors"
  "fmt"

  "golang.org/x/sys/unix"
)

// Usage is the person's disk use against their quota, read as the person.
type Usage struct {
  UsedBytes uint64 \`json:"used_bytes"\`
  SoftBytes uint64 \`json:"soft_bytes"\`
  HardBytes uint64 \`json:"hard_bytes"\`
}

// readQuota asks the kernel for the calling user's quota on the home
// filesystem. It runs in the per-user daemon, so the uid is the person's
// own and no privilege is involved.
func readQuota(device string, uid int) (Usage, error) {
  dq, err := quotactlGet(device, uid)
  if errors.Is(err, unix.ESRCH) {
    // Quotas are off on this filesystem: no limit, not an error.
    return Usage{}, nil
  }
  if err != nil {
    return Usage{}, fmt.Errorf("read quota for uid %d: %w", uid, err)
  }
  return Usage{
    UsedBytes: dq.Curspace,
    SoftBytes: dq.Bsoftlimit * 1024,
    HardBytes: dq.Bhardlimit * 1024,
  }, nil
}

// quotaMessage is what a failed write tells the person when the disk is full.
func quotaMessage(u Usage) string {
  if u.HardBytes == 0 || u.UsedBytes < u.HardBytes {
    return ""
  }
  return "disk quota exceeded"
}
`);
put(QG, QG_OLD.replace('"disk quota exceeded"', `"${FULL_FI}"`), QG_OLD);
const QT_OLD = tabs(`package daemon

import "testing"

func TestQuotaMessageUnderLimit(t *testing.T) {
  if got := quotaMessage(Usage{UsedBytes: 10, HardBytes: 20}); got != "" {
    t.Fatalf("got %q, want no message under the limit", got)
  }
}

func TestQuotaMessageFull(t *testing.T) {
  got := quotaMessage(Usage{UsedBytes: 20, HardBytes: 20})
  want := "disk quota exceeded"
  if got != want {
    t.Fatalf("got %q, want %q", got, want)
  }
}

func TestQuotaOff(t *testing.T) {
  if got := quotaMessage(Usage{}); got != "" {
    t.Fatalf("got %q, want no message when quotas are off", got)
  }
}
`);
const QT_NEW = QT_OLD.replace('want := "disk quota exceeded"', `want := "${FULL_FI}"`);
put(QT, QT_OLD);
put(SN, tabs(`package daemon

// Snapshot is what the browser reads when it opens: the person's workspaces,
// conversations and account facts, all read live from native sources.
type Snapshot struct {
  User       string      \`json:"user"\`
  Workspaces []Workspace \`json:"workspaces"\`
  Quota      Usage       \`json:"quota"\`
}

func (d *Daemon) snapshot() (Snapshot, error) {
  ws, err := d.listWorkspaces()
  if err != nil {
    return Snapshot{}, err
  }
  q, err := readQuota(d.homeDevice, d.uid)
  if err != nil {
    d.log.Warn("quota unavailable", "err", err)
  }
  return Snapshot{User: d.user, Workspaces: ws, Quota: q}, nil
}
`));
put('internal/gateway/proxy.go', tabs(`package gateway

import (
  "net/http"
  "net/http/httputil"
)

// proxyToDaemon forwards an authenticated request to the person's own daemon
// socket. The daemon trusts nothing the gateway says about who is calling.
func (g *Gateway) proxyToDaemon(w http.ResponseWriter, r *http.Request, user string) {
  rp := &httputil.ReverseProxy{
    Rewrite:   func(pr *httputil.ProxyRequest) { pr.Out.URL.Scheme, pr.Out.URL.Host = "http", "daemon" },
    Transport: g.socketTransport(user),
  }
  rp.ServeHTTP(w, r)
}
`));
put('internal/provision/broker.go', tabs(`package provision

// Broker is the root-only helper that creates a Linux account on the first
// approved login. It does nothing else.
type Broker struct {
  minUID, maxUID int
}

func (b *Broker) Ensure(login string) (uid int, created bool, err error) {
  if uid, ok := lookupUser(login); ok {
    return uid, false, nil
  }
  return b.create(login)
}
`));
put('web/package.json', `{
  "name": "open-habitat-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  }
}
`);
put('web/src/format.ts', `const UNITS = ["t", "kt", "Mt", "Gt", "Tt"];

/** Bytes as a Finnish size: 1,5 Gt. */
export function formatBytes(n: number): string {
  let i = 0;
  while (n >= 1024 && i < UNITS.length - 1) {
    n /= 1024;
    i++;
  }
  return \`\${n.toFixed(i === 0 ? 0 : 1).replace(".", ",")} \${UNITS[i]}\`;
}
`);
put('web/src/components/Account.tsx', `import { QuotaMeter } from "./QuotaMeter";
import type { Snapshot } from "../contracts";

export function Account({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="account">
      <h2>{snapshot.user}</h2>
      <QuotaMeter facts={snapshot.quota} />
    </div>
  );
}
`);
put('web/src/components/QuotaMeter.css', `.quota { display: grid; gap: var(--ah-s2); }
.quota-figures { font-variant-numeric: tabular-nums; color: var(--ah-ink-2); }
.quota-advice { margin: 0; color: var(--ah-ink); }
.quota-warn .quota-advice { color: var(--ah-warn-ink); }
.quota-full .quota-advice { color: var(--ah-err); font-weight: 600; }
`);
const QM_OLD = `import { Meter } from "./Primitives";
import { formatBytes } from "../format";
import "./QuotaMeter.css";

// Disk use of the person's home against their quota (account-storage contract).
// The daemon reads the numbers as the person; nothing is cached here.

export type QuotaFacts = {
  used_bytes: number;
  soft_bytes: number;
  hard_bytes: number;
};

const WARN_RATIO = 0.85;

export function QuotaMeter({ facts }: { facts: QuotaFacts }) {
  if (facts.hard_bytes === 0) return null;
  const ratio = facts.used_bytes / facts.hard_bytes;
  const tone = ratio >= 1 ? "full" : ratio >= WARN_RATIO ? "warn" : "ok";
  return (
    <section className={\`quota quota-\${tone}\`} aria-labelledby="quota-title">
      <h3 id="quota-title">Levytila</h3>
      <Meter value={facts.used_bytes} max={facts.hard_bytes} label="Käytössä" />
      <p className="quota-figures">
        {formatBytes(facts.used_bytes)} / {formatBytes(facts.hard_bytes)}
      </p>
      <QuotaAdvice tone={tone} />
    </section>
  );
}

function QuotaAdvice({ tone }: { tone: string }) {
  if (tone === "ok") return null;
  if (tone === "warn") {
    return <p className="quota-advice">Kiintiö lähes käytetty.</p>;
  }
  return (
    <p className="quota-advice" role="alert">
      Kiintiö ylitetty (EDQUOT). Kirjoitukset epäonnistuvat,
      kunnes käyttö laskee.
    </p>
  );
}
`;
put(QM, QM_OLD.replace('Kiintiö lähes käytetty.', 'Levy on lähes täynnä. Agentit voivat pian epäonnistua tallentaessaan.')
  .replace('Kiintiö ylitetty (EDQUOT). Kirjoitukset epäonnistuvat,', 'Levy on täynnä. Poista tiedostoja tai pyydä ylläpitäjältä lisää tilaa,')
  .replace('kunnes käyttö laskee.', 'ennen kuin aloitat uuden työn.'), QM_OLD);
const QMT_OLD = `import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { QuotaMeter } from "./QuotaMeter";

const GB = 1024 ** 3;

test("no quota shows nothing", () => {
  const { container } = render(<QuotaMeter facts={{ used_bytes: 3 * GB, soft_bytes: 0, hard_bytes: 0 }} />);
  expect(container).toBeEmptyDOMElement();
});

test("full disk is an alert", () => {
  render(<QuotaMeter facts={{ used_bytes: 50 * GB, soft_bytes: 45 * GB, hard_bytes: 50 * GB }} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Kiintiö ylitetty");
});
`;
put(QMT, QMT_OLD.replace('toHaveTextContent("Kiintiö ylitetty")', 'toHaveTextContent("Poista tiedostoja")'), QMT_OLD);

const DIRS = new Set();
for (const p of Object.keys(FS)) { const parts = p.split('/'); for (let i = 1; i < parts.length; i++) DIRS.add(parts.slice(0, i).join('/')); }
const changed = () => Object.keys(FS).filter(p => FS[p] !== HEAD[p]).sort();
const isMod = (p) => FS[p] !== undefined && FS[p] !== HEAD[p];
const at = (p, needle, src = FS) => src[p].split('\n').findIndex(l => l.includes(needle)) + 1;
const langFor = (p) => ({ go: 'go', ts: 'typescript', tsx: 'typescript', js: 'javascript', json: 'json', md: 'markdown', css: 'css' }[p.split('.').pop()] || '');
const langLabel = (p) => ({ go: 'Go', ts: 'TypeScript', tsx: 'TypeScript JSX', json: 'JSON', md: 'Markdown', css: 'CSS', mod: 'Go Module File' }[p.split('.').pop()] || 'Plain Text');
const base = (p) => p.split('/').pop();
const dirOf = (p) => p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '';

// ---------- The conversation (replaces the library's Python fixture) ----------
const ws = UI.ws.find(w => w.id === 'open-habitat'); const aur = UI.ws.find(w => w.id === 'aurinkokello');
const c1 = aur.convs.find(c => c.id === 'c1');
if (c1) { aur.convs.splice(aur.convs.indexOf(c1), 1); ws.convs = [c1, { id: 'c5', title: 'Arkistoinnin vahvistusteksti', st: 'done' }]; }
c1.title = 'Kiintiönäkymän tekstit'; UI.titles = ['Kiintiönäkymän tekstit', 'Täyden levyn ohjeet selkokielisiksi'];
UI.ws.splice(UI.ws.indexOf(ws), 1); UI.ws.unshift(ws);

const rgOut = ['internal', 'web/src'].flatMap(d => Object.keys(HEAD).filter(p => p.startsWith(d + '/')).sort().flatMap(p => HEAD[p].split('\n').map((l, i) => [p, i + 1, l])))
  .filter(([, , l]) => /quotaMessage|readQuota\(|<QuotaMeter|function QuotaMeter|function QuotaAdvice/.test(l)).map(([p, n, l]) => `${p}:${n}:${l.replace(/\t/g, '    ')}`).join('\n');
const qmWarn = at(QM, 'if (tone === "warn")'), qmEnd = at(QM, 'ennen kuin aloitat');
const logLine = `time=2026-10-19T09:58:12.418+03:00 level=WARN source=${ROOT}/${SN}:${at(SN, 'd.log.Warn')} msg="quota unavailable" err="read quota for uid 1000: no such device"`;
const advice = (src) => { const ls = src.split('\n'); const a = at(QM, 'function QuotaAdvice'); return ls.slice(a - 1, a + 11).join('\n'); };
CONVO.splice(0, CONVO.length,
  { kind: 'marker', t: 'settings', time: '10:02', model: MODEL_ID, thinking: 'high' },
  { kind: 'user', time: '10:02', md: `Kiintiönäkymän tekstit ovat kömpelöitä. Katso @${QM} ja korjaa niin, että täysi levy sanoo selvästi, mitä tehdä.` },
  { kind: 'turn', time: '10:04', blocks: [
    { t: 'think', md: '**Finding where the quota texts live**' },
    { t: 'tool', name: 'read', target: QM, args: { path: QM }, result: HEAD[QM] },
    { t: 'tool', name: 'bash', target: 'rg -n "quotaMessage|readQuota\\(|QuotaMeter|QuotaAdvice" internal web/src', args: { command: 'rg -n "quotaMessage|readQuota\\(|QuotaMeter|QuotaAdvice" internal web/src' }, result: rgOut },
    { t: 'tool', name: 'read', target: QG, args: { path: QG }, result: HEAD[QG] },
    { t: 'reply', md: `Teksti on kahdessa paikassa, ja ne sanovat saman asian eri tavalla:

- \`${QM}:${qmWarn}-${qmEnd + 1}\` näyttää selaimessa varoituksen ja täyden levyn ilmoituksen. Täysi levy puhuu kiintiöstä ja virhekoodista EDQUOT eikä kerro, mitä tehdä.
- \`${QG}:${at(QG, 'func quotaMessage', HEAD)}\` antaa epäonnistuneelle kirjoitukselle englanninkielisen tekstin \`disk quota exceeded\`.

Ehdotan, että molemmat sanovat "Levy on täynnä" ja kertovat kaksi keinoa: poista tiedostoja tai pyydä lisää tilaa. Varoitusrajan (\`WARN_RATIO\`, 85 %) jättäisin ennalleen. Tekstit voisi myöhemmin koota tiedostoon \`web/src/strings/quota.ts\`, mutta sitä ei vielä ole, joten en luo sitä tässä.` },
  ] },
  { kind: 'user', time: '10:05', md: `Tee niin. Daemonin lokissa \`~/.local/state/open-habitat/daemon.log\` oli myös tämä, katso samalla:

\`\`\`
${logLine}
\`\`\`` },
  { kind: 'turn', time: '10:06', blocks: [
    { t: 'think', md: '**Rewording the quota messages**' },
    { t: 'tool', name: 'edit', target: QM, args: { path: QM, oldText: advice(HEAD[QM]), newText: advice(FS[QM]) }, result: 'Applied 1 edit' },
    { t: 'tool', name: 'edit', target: QMT, args: { path: QMT, oldText: '  expect(screen.getByRole("alert")).toHaveTextContent("Kiintiö ylitetty");', newText: '  expect(screen.getByRole("alert")).toHaveTextContent("Poista tiedostoja");' }, result: 'Applied 1 edit' },
    { t: 'tool', name: 'edit', target: QG, args: { path: QG, oldText: '\treturn "disk quota exceeded"', newText: `\treturn "${FULL_FI}"` }, result: 'Applied 1 edit' },
    { t: 'reply', md: `Tekstit on vaihdettu tiedostoissa \`${QM}\` ja \`${QG}\`, ja \`${QMT}\` etsii nyt uutta tekstiä.

Lokin varoitus tulee kohdasta \`${SN}:${at(SN, 'd.log.Warn')}\`: \`no such device\` tarkoittaa, että kotihakemiston laitetta ei löytynyt, joten kiintiöitä ei luettu lainkaan. Se ei liity näihin teksteihin; jätin sen ennalleen.` },
  ] },
  { kind: 'user', time: '10:07', md: 'Aja testit ja korjaa, mitä löytyy.' },
);
const failAt = at(QT, 'want := ', { [QT]: QT_OLD });
Object.assign(LIVE, {
  think1: `Go-testit ovat tiedostossa \`${QT}\`. Ajan ne ensin, koska \`quotaMessage\`-testi odottaa todennäköisesti vielä vanhaa tekstiä.`,
  think2: '**Updating the test expectation**',
  test1: { name: 'bash', target: 'go test ./internal/daemon -run Quota -count=1 -v', args: { command: 'go test ./internal/daemon -run Quota -count=1 -v' }, lines: [
    '=== RUN   TestQuotaMessageUnderLimit', '--- PASS: TestQuotaMessageUnderLimit (0.00s)', '=== RUN   TestQuotaMessageFull',
    `    quota_linux_test.go:${failAt + 2}: got "${FULL_FI}", want "disk quota exceeded"`, '--- FAIL: TestQuotaMessageFull (0.00s)',
    '=== RUN   TestQuotaOff', '--- PASS: TestQuotaOff (0.00s)', 'FAIL', 'FAIL\tgithub.com/Open-Habitat/open-habitat/internal/daemon\t0.231s', 'FAIL'] },
  edit: { name: 'bash', target: `sed -i 's/want := "disk quota exceeded"/want := "${FULL_FI}"/' ${QT}`, args: { command: `sed -i 's/want := "disk quota exceeded"/want := "${FULL_FI}"/' ${QT}\ngit diff --stat` }, lines: [
    ...[[QT, '2 +-'], [QG, '2 +-'], [QMT, '2 +-'], [QM, '6 +++---']].map(([p, s]) => ` ${p.padEnd(QMT.length + 1)}| ${s}`), ' 4 files changed, 6 insertions(+), 6 deletions(-)'] },
  test2: { name: 'bash', target: 'go test ./internal/daemon -run Quota -count=1 && npm --prefix web test -- QuotaMeter', args: { command: 'go test ./internal/daemon -run Quota -count=1 && npm --prefix web test -- QuotaMeter' }, lines: [
    'ok  \tgithub.com/Open-Habitat/open-habitat/internal/daemon\t0.198s', '', ' ✓ src/components/QuotaMeter.test.tsx (2 tests) 41ms', '', ' Test Files  1 passed (1)', '      Tests  2 passed (2)'] },
  reply: `Testit menevät läpi. \`${QT}:${failAt}\` odotti vielä vanhaa englanninkielistä tekstiä; vaihdoin sen.

Muutokset ovat neljässä tiedostossa, ja \`git diff\` näyttää ne. Selaimen uudet tekstit ovat kohdassa \`${QM}:${at(QM, 'Levy on lähes')}-${qmEnd}\`.`,
});
RECAPS[0].recap = `Kiintiötekstit ovat kahdessa paikassa: \`${QM}\` ja \`${QG}\`. Pi ehdotti yhteistä muotoa "Levy on täynnä" ja kahta keinoa.`;
RECAPS[1].recap = `Tekstit on vaihdettu neljässä tiedostossa ja testit menevät läpi. \`${QT}\` odotti vanhaa tekstiä ja päivitettiin.`;

// The live sed step really changes the test file, so an edit open at that moment sees it.
const baseScript = script;
script = function () {
  return baseScript().map(([t, fn]) => [t, (S) => fn({ ...S,
    start() { FS[QT] = QT_OLD; S.start(); },
    // The library plays one line of this step; git diff --stat prints one per file.
    push(id, line) { if (id === 'e1') { FS[QT] = QT_NEW; fsChanged(QT); for (const l of LIVE.edit.lines) S.push(id, l); return; } S.push(id, line); },
  })]);
};
const fsListeners = [];
const fsChanged = (p) => { for (const f of fsListeners) f(p); };

// ---------- Recognition: only paths in the workspace become links ----------
// A token is a path with an optional line, range or column. It is resolved against the
// workspace root, then against the directories its tool call ran in (go test prints names
// relative to the package, npm --prefix relative to its prefix). An absolute path counts only
// inside the workspace; anything else, or a path that does not exist, stays text.
const TOKEN = /@?(?:~\/|\/)?[\w.-]+(?:\/[\w.-]+)*\/?(?::\d+(?:[-:]\d+)?)?/g;
function resolvePath(raw, bases) {
  const m = raw.replace(/^@/, '').match(/^(.*?)(?::(\d+)(?:([-:])(\d+))?)?$/);
  let p = m[1]; const line = +m[2] || 0; const end = m[3] === '-' ? +m[4] : 0;
  if (p.startsWith(ROOT + '/')) p = p.slice(ROOT.length + 1);
  else if (p.startsWith('~/Sources/open-habitat/')) p = p.slice('~/Sources/open-habitat/'.length);
  else if (/^[/~]/.test(p)) return null;
  const slash = p.includes('/'); p = p.replace(/\/$/, '');
  const cands = [p]; if (/^[ab]\//.test(p)) cands.push(p.slice(2));
  for (const b of bases) cands.push(`${b}/${p}`);
  for (const c of cands) {
    if (FS[c] !== undefined) return { path: c, line, end, kind: 'file', ab: c !== p && /^[ab]\//.test(p) };
    if (slash && DIRS.has(c)) return { path: c, kind: 'dir' };
  }
  return null;
}
function basesFor(el) {
  const tool = el.closest('section.tool'); if (!tool) return [];
  const cmd = [...tool.querySelectorAll('.target, .bash-cmd, .cmd-first')].map(n => n.textContent).join(' ');
  const out = [];
  for (const m of cmd.matchAll(/go (?:test|vet|build)\s+(?:-\S+\s+)*\.\/([\w./-]+)/g)) out.push(m[1].replace(/\/\.\.\.$/, ''));
  for (const m of cmd.matchAll(/--prefix\s+(\S+)/g)) out.push(m[1]);
  for (const m of cmd.matchAll(/\bcd\s+(\S+)\s*&&/g)) out.push(m[1]);
  return out;
}
const diffish = (s) => /\|\s+\d+ [+-]+\s*$/.test(s) || /^(\+\+\+|---) [ab]\//.test(s) || /^diff --git /.test(s);
const SKIP = 'a, button, textarea, input, [contenteditable], .peek, .vsc, .ed-host, .k-skel';
function linkifyText(t) {
  const text = t.nodeValue; let last = 0; const frag = document.createDocumentFragment(); let any = false;
  let bases = null; const line = t.parentElement.closest('.ln, .dl')?.textContent ?? text;
  for (const m of text.matchAll(TOKEN)) {
    const raw = m[0].replace(/[.,:;]+$/, ''); if (!/[./]/.test(raw)) continue;
    const r = resolvePath(raw, bases ??= basesFor(t.parentElement)); if (!r) continue;
    any = true; frag.append(text.slice(last, m.index));
    const a = document.createElement('a'); a.className = 'flink'; a.href = '#'; a.textContent = raw;
    a.dataset.path = r.path; a.dataset.kind = r.kind;
    if (r.line) a.dataset.line = r.line; if (r.end) a.dataset.end = r.end;
    if (r.kind === 'file' && (r.ab || diffish(line))) a.dataset.mode = 'diff';
    const where = r.kind === 'dir' ? 'kansio' : r.line ? `rivi${r.end ? 't' : ''} ${r.line}${r.end ? '–' + r.end : ''}` : '';
    a.title = `${a.dataset.mode === 'diff' ? 'Näytä muutokset' : 'Avaa'}: ${r.path}${where ? ` (${where})` : ''}`;
    frag.append(a); last = m.index + raw.length;
  }
  if (any) { frag.append(text.slice(last)); t.replaceWith(frag); }
}
function linkify(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => !n.parentElement || n.parentElement.closest(SKIP) || !/[./]/.test(n.nodeValue) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  nodes.forEach(linkifyText);
  // File tool cards: the header is a button, so the box rail gets the open action.
  for (const s of root.querySelectorAll?.('section.tool') ?? []) {
    const name = s.querySelector('.name')?.textContent; const rail = s.querySelector('.out-rail'); if (!rail || rail.querySelector('[data-fopen]') || !['read', 'write', 'edit'].includes(name)) continue;
    const p = s.querySelector('.target')?.textContent; if (FS[p] === undefined) continue;
    const g = document.createElement('div'); g.className = 'grp';
    g.innerHTML = `<button class="icon-btn" type="button" data-fopen="${esc(p)}" data-mode="${name === 'edit' ? 'diff' : 'file'}" aria-label="${name === 'edit' ? 'Näytä muutos tiedostossa' : 'Avaa tiedosto'}" title="${name === 'edit' ? 'Näytä muutos tiedostossa' : 'Avaa tiedosto'}">${IC.file}</button>`;
    rail.append(g);
  }
}
let lq = false;
const relink = () => { if (lq) return; lq = true; requestAnimationFrame(() => { lq = false; linkify(stage); const k = document.querySelector('.recap-host'); if (k) linkify(k); }); };
new MutationObserver(relink).observe(stage, { subtree: true, childList: true, characterData: true });
requestAnimationFrame(() => { const k = document.querySelector('.recap-host'); if (k) new MutationObserver(relink).observe(k, { subtree: true, childList: true }); });

// ---------- Icons ----------
const IC = {
  file: SVG('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'),
  folder: SVG('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  tree: SVG('<path d="M4 5h6M4 5v14M4 12h5M4 19h5"/><rect x="12" y="3" width="8" height="4" rx="1"/><rect x="12" y="10" width="8" height="4" rx="1"/><rect x="12" y="17" width="8" height="4" rx="1"/>'),
  edit: SVG('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  back: SVG('<path d="M15 5l-7 7 7 7"/>'),
  close: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
  copy: ICON_COPY,
  diff: SVG('<path d="M7 4v10M2 9h10"/><path d="M14 19h8"/><path d="M5 20h4"/>'),
  chat: SVG('<path d="M4 5h16v11H9l-5 4z"/>'),
  code: SVG('<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>'),
  up: SVG('<path d="m6 15 6-6 6 6"/>'), down: SVG('<path d="m6 9 6 6 6-6"/>'),
  branch: SVG('<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10c0 4-6 3-11 7"/>'),
  files: SVG('<path d="M15 3H8a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7z"/><path d="M15 3v4h4"/><path d="M4 8v11a2 2 0 0 0 2 2h8"/>'),
};
async function copyPath(p) { try { await navigator.clipboard.writeText(p); } catch {} toast(`Polku kopioitu: ${p}`); }

// ---------- Shared pieces: code lines and diff hunks ----------
function codeRows(path, text, hit) {
  const html = hlLines(text.split('\n'), langFor(path)); if (html.length > 1 && html[html.length - 1].replace(/<[^>]+>/g, '') === '') html.pop();
  return html.map((h, i) => { const n = i + 1; const on = hit && n >= hit[0] && n <= hit[1]; return `<span class="fl${on ? ' hit' : ''}" data-n="${n}"><span class="fn" aria-hidden="true">${n}</span><span class="fc">${h || ' '}</span></span>`; });
}
function diffOps(path) {
  const ops = lineOps(HEAD[path].replace(/\n$/, ''), FS[path].replace(/\n$/, '')); let o = 0, n = 0;
  return ops.map(([k, s]) => k === ' ' ? { k, s, o: ++o, n: ++n } : k === '-' ? { k, s, o: ++o } : { k, s, n: ++n });
}
function hunks(path, ctx = 3) {
  const ops = diffOps(path); const keep = new Set();
  ops.forEach((x, i) => { if (x.k !== ' ') for (let j = Math.max(0, i - ctx); j <= Math.min(ops.length - 1, i + ctx); j++) keep.add(j); });
  const out = []; let cur = null;
  ops.forEach((x, i) => { if (!keep.has(i)) { cur = null; return; } if (!cur) { cur = []; out.push(cur); } cur.push(x); });
  return out;
}
function diffRows(path) {
  const lang = langFor(path);
  return hunks(path).map(h => {
    const o0 = h.find(x => x.o)?.o ?? 0, n0 = h.find(x => x.n)?.n ?? 0;
    const head = `<span class="dh">@@ −${o0},${h.filter(x => x.k !== '+').length} +${n0},${h.filter(x => x.k !== '-').length} @@</span>`;
    return head + h.map(x => `<span class="dl2 ${x.k === '+' ? 'add' : x.k === '-' ? 'del' : 'ctx'}"><span class="fn" aria-hidden="true">${x.o ?? ''}</span><span class="fn" aria-hidden="true">${x.n ?? ''}</span><span class="sg" aria-hidden="true">${x.k === ' ' ? ' ' : x.k === '-' ? '−' : '+'}</span><span class="fc">${x.k === '-' ? '<span class="sr">poistettu: </span>' : x.k === '+' ? '<span class="sr">lisätty: </span>' : ''}${hlLines([x.s], lang)[0] || ' '}</span></span>`).join('');
  }).join('');
}
const modBadge = (p) => isMod(p) ? `<span class="mod-badge" title="Muutettu, ei vielä commitoitu">M</span>` : '';
const crumb = (p) => `<span class="crumb"><span class="cd">${esc(dirOf(p))}</span><strong>${esc(base(p))}</strong></span>`;
const lineLabel = (s) => s.line ? (s.end && s.end !== s.line ? `rivit ${s.line}–${s.end}` : `rivi ${s.line}`) : '';
function scrollToHit(box) { const h = box?.querySelector('.fl.hit, .dl2:not(.ctx)'); if (h) box.scrollTop = Math.max(0, h.offsetTop - box.clientHeight / 3); }

// ---------- The workspace's VS Code (code-server on its own origin), same in every direction ----------
// A stand-in for code-server framed from its own origin: its own look and English UI, as the real one has.
function makeVSC(host) {
  const st = { tabs: [], active: -1, side: 'explorer', sideOpen: true, open: new Set(['internal', 'internal/daemon', 'web', 'web/src', 'web/src/components']), hit: null, ln: 1, col: 1, dirty: new Set(), msg: '' };
  const narrow = () => host.clientWidth < 700;
  const tab = () => st.tabs[st.active];
  const icon = (p) => `<span class="vf ${p.split('.').pop()}">${{ go: 'GO', tsx: 'TSX', ts: 'TS', json: '{}', md: 'M↓', css: '#', mod: 'GO' }[p.split('.').pop()] || '≡'}</span>`;
  function tree(dir, depth) {
    const kids = new Set(); const pre = dir ? dir + '/' : '';
    for (const p of [...Object.keys(FS), ...DIRS]) if (p.startsWith(pre) && p !== dir) kids.add(pre + p.slice(pre.length).split('/')[0]);
    return [...kids].sort((a, b) => (DIRS.has(b) - DIRS.has(a)) || a.localeCompare(b)).map(p => {
      const d = DIRS.has(p); const o = st.open.has(p); const m = d ? changed().some(c => c.startsWith(p + '/')) : isMod(p); const cur = tab()?.path === p;
      return `<button type="button" class="vt${cur ? ' cur' : ''}${m ? ' m' : ''}" data-vs-path="${esc(p)}" style="--d:${depth}"${d ? ` aria-expanded="${o}"` : ''}>${d ? `<span class="tw">${o ? '⌄' : '›'}</span>` : `<span class="tw"></span>${icon(p)}`}<span class="tn">${esc(base(p))}</span>${m && !d ? '<span class="vm">M</span>' : m ? '<span class="vdot"></span>' : ''}</button>${d && o ? tree(p, depth + 1) : ''}`;
    }).join('');
  }
  function side() {
    if (st.side === 'scm') { const c = changed(); return `<div class="vsh">SOURCE CONTROL</div><div class="vsec">⌄ Changes <span class="vbadge">${c.length}</span></div>${c.map(p => `<button type="button" class="vt" data-vs-path="${esc(p)}" data-mode="diff" style="--d:0">${icon(p)}<span class="tn">${esc(base(p))}</span><span class="vdir">${esc(dirOf(p).replace(/\/$/, ''))}</span><span class="vm">M</span></button>`).join('')}`; }
    return `<div class="vsh">EXPLORER</div><div class="vsec">⌄ OPEN-HABITAT</div><div class="vtree">${tree('', 0)}</div>`;
  }
  function editor() {
    const t = tab();
    if (!t) return `<div class="vwelcome"><div class="vlogo" aria-hidden="true">${IC.code}</div><dl><dt>Show All Commands</dt><dd>Ctrl+Shift+P</dd><dt>Go to File</dt><dd>Ctrl+P</dd><dt>Find in Files</dt><dd>Ctrl+Shift+F</dd><dt>Toggle Terminal</dt><dd>Ctrl+\`</dd></dl></div>`;
    const crumbs = `<div class="vcrumbs">${['open-habitat', ...t.path.split('/')].map(esc).join(' <span>›</span> ')}</div>`;
    if (t.mode === 'diff') {
      const ops = diffOps(t.path); const L = [], R = []; let i = 0; const lang = langFor(t.path);
      const row = (x, cls) => x ? `<div class="vl ${cls}"><span class="vg">${x.o ?? x.n}</span><span class="vc">${hlLines([x.s], lang)[0] || ' '}</span></div>` : `<div class="vl pad"><span class="vg"></span><span class="vc"> </span></div>`;
      if (narrow()) return crumbs + `<div class="vcode vdiff inline" tabindex="0">${ops.map(x => `<div class="vl ${x.k === '+' ? 'add' : x.k === '-' ? 'del' : ''}"><span class="vg">${x.o ?? ''}</span><span class="vg">${x.n ?? ''}</span><span class="vc">${hlLines([x.s], lang)[0] || ' '}</span></div>`).join('')}</div>`;
      while (i < ops.length) {
        if (ops[i].k === ' ') { L.push(row({ ...ops[i], n: undefined }, '')); R.push(row({ ...ops[i], o: undefined }, '')); i++; continue; }
        const d = [], a = []; while (i < ops.length && ops[i].k === '-') d.push(ops[i++]); while (i < ops.length && ops[i].k === '+') a.push(ops[i++]);
        for (let k = 0; k < Math.max(d.length, a.length); k++) { L.push(row(d[k], 'del')); R.push(row(a[k], 'add')); }
      }
      return crumbs + `<div class="vdiff2"><div class="vcode" tabindex="0" aria-label="${esc(t.path)} (HEAD)">${L.join('')}</div><div class="vcode" tabindex="0" aria-label="${esc(t.path)} (Working Tree)">${R.join('')}</div></div>`;
    }
    const html = hlLines(FS[t.path].replace(/\n$/, '').split('\n'), langFor(t.path));
    return crumbs + `<div class="vcode" tabindex="-1"><div class="vgut" aria-hidden="true">${html.map((_, i) => `<span${st.hit && i + 1 >= st.hit[0] && i + 1 <= st.hit[1] ? ' class="hit"' : ''}>${i + 1}</span>`).join('')}</div><div class="vlines syntax" contenteditable="plaintext-only" spellcheck="false" role="textbox" aria-multiline="true" aria-label="${esc(t.path)}">${html.map((h, i) => `<div class="${st.hit && i + 1 >= st.hit[0] && i + 1 <= st.hit[1] ? 'hit' : ''}">${h || '<br>'}</div>`).join('')}</div></div>`;
  }
  function render(focus) {
    const t = tab(); const sideOpen = st.sideOpen && !(narrow() && t && !st.forceSide);
    host.innerHTML = `<div class="vsc${narrow() ? ' narrow' : ''}" aria-label="VS Code: open-habitat">
<div class="vrow"><nav class="vact" aria-label="Activity Bar"><button type="button" data-vs="side" data-side="explorer" aria-pressed="${sideOpen && st.side === 'explorer'}" title="Explorer (Ctrl+Shift+E)" aria-label="Explorer">${IC.files}</button><button type="button" data-vs="side" data-side="scm" aria-pressed="${sideOpen && st.side === 'scm'}" title="Source Control (Ctrl+Shift+G)" aria-label="Source Control, ${changed().length} pending changes">${IC.branch}<span class="vab">${changed().length}</span></button></nav>
<aside class="vside"${sideOpen ? '' : ' hidden'}>${side()}</aside>
<section class="ved"><div class="vtabs" role="tablist">${st.tabs.map((x, i) => `<div class="vtab${i === st.active ? ' on' : ''}" role="tab" aria-selected="${i === st.active}"><button type="button" class="vtl" data-vs="tab" data-i="${i}">${icon(x.path)}<span>${esc(base(x.path))}${x.mode === 'diff' ? ' (Working Tree)' : ''}</span></button><button type="button" class="vx" data-vs="close" data-i="${i}" aria-label="Close ${esc(base(x.path))}" title="Close (Ctrl+W)">${st.dirty.has(x.path) && x.mode !== 'diff' ? '●' : '×'}</button></div>`).join('')}</div>${editor()}</section></div>
<footer class="vstatus"><span>${IC.branch}main*</span><span>⊗ 0 ⚠ 0</span><span class="vsp"></span>${st.msg ? `<span class="vmsg">${esc(st.msg)}</span>` : ''}${t && t.mode !== 'diff' ? `<span class="vpos">Ln ${st.ln}, Col ${st.col}</span><span class="vwide">Spaces: 2</span><span class="vwide">UTF-8</span><span class="vwide">LF</span><span>${langLabel(t.path)}</span>` : ''}</footer></div>`;
    const code = host.querySelector('.vcode'); const h = code?.querySelector('.hit, .vl.del, .vl.add');
    if (code && h) code.scrollTop = Math.max(0, h.offsetTop - code.clientHeight / 3);
    if (focus === 'editor') { const ed = host.querySelector('.vlines') || host.querySelector('.vcode'); ed?.focus({ preventScroll: true }); placeCaret(); }
    else if (focus) host.querySelector(focus)?.focus({ preventScroll: true });
  }
  function placeCaret() {
    const ed = host.querySelector('.vlines'); if (!ed || !st.hit) return; const line = ed.children[st.hit[0] - 1]; if (!line) return;
    const r = document.createRange(); r.setStart(line, 0); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function open(r) {
    const mode = r.mode === 'diff' && isMod(r.path) ? 'diff' : 'file';
    if (r.kind === 'dir') { let d = r.path; while (d) { st.open.add(d); d = d.includes('/') ? d.slice(0, d.lastIndexOf('/')) : ''; } st.side = 'explorer'; st.sideOpen = true; st.forceSide = true; render(`[data-vs-path="${CSS.escape(r.path)}"]`); return; }
    st.forceSide = false;
    let i = st.tabs.findIndex(x => x.path === r.path && x.mode === mode); if (i < 0) { st.tabs.push({ path: r.path, mode }); i = st.tabs.length - 1; }
    st.active = i; st.hit = r.line ? [r.line, r.end || r.line] : null; st.ln = r.line || 1; st.col = 1; st.msg = '';
    let d = dirOf(r.path).replace(/\/$/, ''); while (d) { st.open.add(d); d = d.includes('/') ? d.slice(0, d.lastIndexOf('/')) : ''; }
    render('editor');
  }
  host.addEventListener('click', (e) => {
    const p = e.target.closest('[data-vs-path]');
    if (p) { const path = p.dataset.vsPath; if (DIRS.has(path)) { st.open.has(path) ? st.open.delete(path) : st.open.add(path); return render(`[data-vs-path="${CSS.escape(path)}"]`); } return open({ path, mode: p.dataset.mode }); }
    const t = e.target.closest('[data-vs]'); if (!t) return;
    const a = t.dataset.vs;
    if (a === 'side') { if (st.side === t.dataset.side && (st.sideOpen && (!narrow() || !tab() || st.forceSide))) { st.sideOpen = false; st.forceSide = false; } else { st.side = t.dataset.side; st.sideOpen = true; st.forceSide = true; } return render(`[data-vs="side"][data-side="${t.dataset.side}"]`); }
    if (a === 'tab') { st.active = +t.dataset.i; st.hit = null; st.forceSide = false; return render('editor'); }
    if (a === 'close') { const x = st.tabs[+t.dataset.i]; st.dirty.delete(x.path); st.tabs.splice(+t.dataset.i, 1); st.active = Math.min(st.active, st.tabs.length - 1); return render(); }
  });
  const caret = () => { const ed = host.querySelector('.vlines'); const s = getSelection(); if (!ed || !s.rangeCount || !ed.contains(s.anchorNode)) return; let n = s.anchorNode; while (n && n.parentNode !== ed) n = n.parentNode; const li = [...ed.children].indexOf(n); if (li < 0) return; const r = document.createRange(); r.setStart(n, 0); r.setEnd(s.anchorNode, s.anchorOffset); st.ln = li + 1; st.col = r.toString().length + 1; const sb = host.querySelector('.vpos'); if (sb) sb.textContent = `Ln ${st.ln}, Col ${st.col}`; };
  host.addEventListener('keyup', caret); host.addEventListener('mouseup', caret);
  // The two sides of a diff scroll together.
  host.addEventListener('scroll', (e) => { if (!e.target.matches?.('.vdiff2 .vcode')) return; for (const c of host.querySelectorAll('.vdiff2 .vcode')) if (c !== e.target && c.scrollTop !== e.target.scrollTop) c.scrollTop = e.target.scrollTop; }, true);
  host.addEventListener('input', (e) => { if (!e.target.matches('.vlines')) return; const t = tab(); if (!st.dirty.has(t.path)) { st.dirty.add(t.path); const x = host.querySelector('.vtab.on .vx'); if (x) x.textContent = '●'; } });
  host.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && tab()) {
      e.preventDefault(); const ed = host.querySelector('.vlines'); if (!ed) return; const t = tab();
      FS[t.path] = [...ed.children].map(d => d.textContent).join('\n') + '\n'; st.dirty.delete(t.path); st.hit = null; st.msg = `Saved ${base(t.path)}`; render('editor'); fsChanged(t.path);
    }
  });
  fsListeners.push((p) => { if (!host.isConnected || host.hidden) return; const t = tab(); if (t && t.path === p && st.dirty.has(p)) { st.msg = `The content of the file is newer. Compare or overwrite before saving.`; const m = host.querySelector('.vmsg'); if (m) m.textContent = st.msg; else render(); return; } render(); });
  return { st, open, render };
}

// ---------- Phone: a read-only peek under the link (VS Code does not run on a phone) ----------
let PK = null;
function peekBody() {
  const s = PK.s; const p = s.path;
  if (s.kind === 'dir') return `<ul class="pk-dir">${Object.keys(FS).filter(x => x.startsWith(p + '/')).sort().map(x => `<li><button type="button" class="fhit" data-pk-path="${esc(x)}">${crumb(x.slice(p.length + 1))}${modBadge(x)}</button></li>`).join('')}</ul>`;
  if (s.mode === 'diff' && isMod(p)) return `<pre class="pk-code diff2 syntax" tabindex="0">${diffRows(p)}</pre>`;
  const rows = codeRows(p, FS[p], s.line ? [s.line, s.end || s.line] : null); const n = rows.length;
  const from = Math.max(1, s.from), to = Math.min(n, s.to);
  const more = (dir, k) => k > 0 ? `<button type="button" class="pk-more" data-pk="${dir}">${dir === 'up' ? IC.up : IC.down}${Math.min(10, k)} riviä ${dir === 'up' ? 'ylempää' : 'alempaa'}<span class="muted"> · ${k} jäljellä</span></button>` : '';
  return `${more('up', from - 1)}<pre class="pk-code syntax" tabindex="0">${rows.slice(from - 1, to).join('')}</pre>${more('down', n - to)}`;
}
function peekHtml() {
  const s = PK.s; const mod = s.kind === 'file' && isMod(s.path);
  const seg = mod ? `<div class="seg" role="group" aria-label="Näkymä"><button type="button" data-pk="mode" data-mode="file" aria-pressed="${s.mode === 'file'}">Tiedosto</button><button type="button" data-pk="mode" data-mode="diff" aria-pressed="${s.mode === 'diff'}">Muutokset</button></div>` : '';
  return `<div class="pk-head">${crumb(s.path + (s.kind === 'dir' ? '/' : ''))}${mod ? '<span class="mod-badge" title="Muutettu, ei vielä commitoitu">M</span>' : ''}${s.line && s.mode === 'file' ? `<span class="ll">${lineLabel(s)}</span>` : ''}<span class="pk-tools">${seg}<button class="icon-btn" type="button" data-pk="copy" aria-label="Kopioi polku" title="Kopioi polku">${IC.copy}</button><button class="icon-btn" type="button" data-pk="close" aria-label="Sulje kurkistus" title="Sulje (Esc)">${IC.close}</button></span></div><div class="pk-body">${peekBody()}</div><p class="pk-foot">Puhelimessa tiedoston voi lukea. Muokkaus ja koko työtila ovat VS Codessa tietokoneella.</p>`;
}
function paintPeek(focus) { PK.el.innerHTML = peekHtml(); const c = PK.el.querySelector('.pk-code'); if (c && PK.s.mode === 'diff') scrollToHit(c); if (focus) PK.el.querySelector(focus)?.focus({ preventScroll: true }); }
function closePeek(refocus) { if (!PK) return; const { el, link } = PK; PK = null; el.remove(); if (link?.isConnected) { link.setAttribute('aria-expanded', 'false'); if (refocus) link.focus(); } }
function openPeek(r, link) {
  if (PK && PK.link === link) return closePeek(true);
  closePeek(false);
  const anchor = link.closest('.out') || [...ancestors(link)].find(el => el.parentElement?.matches('.prose, .think-quote')) || link.parentElement;
  const el = document.createElement('div'); el.className = 'peek'; el.id = nid(); el.setAttribute('role', 'region'); el.setAttribute('aria-label', `Kurkistus: ${r.path}`);
  const line = r.line || 0, end = r.end || line;
  PK = { el, link, s: { ...r, kind: r.kind || 'file', mode: r.mode === 'diff' && isMod(r.path) ? 'diff' : 'file', from: line ? line - 3 : 1, to: line ? end + 4 : 10 } };
  anchor.after(el); link.setAttribute('aria-expanded', 'true');
  paintPeek();
  requestAnimationFrame(() => { const r2 = el.getBoundingClientRect(), sr = stage.getBoundingClientRect(); if (r2.bottom > sr.bottom) stage.scrollBy({ top: r2.bottom - sr.bottom + 12, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
}
function* ancestors(el) { while (el) { yield el; el = el.parentElement; } }
stage.addEventListener('click', (e) => {
  if (!PK || !PK.el.contains(e.target)) return;
  const t = e.target.closest('[data-pk], [data-pk-path]'); if (!t) return;
  e.stopPropagation();
  if (t.dataset.pkPath) { PK.s = { path: t.dataset.pkPath, kind: 'file', mode: 'file', from: 1, to: 10 }; return paintPeek('.pk-code'); }
  const a = t.dataset.pk; const s = PK.s;
  if (a === 'close') return closePeek(true);
  if (a === 'copy') return copyPath(s.path);
  if (a === 'mode') { s.mode = t.dataset.mode; return paintPeek(`[data-pk="mode"][data-mode="${s.mode}"]`); }
  if (a === 'up') { s.from = Math.max(1, s.from - 10); return paintPeek('[data-pk="up"], .pk-code'); }
  if (a === 'down') { s.to += 10; return paintPeek('[data-pk="down"], .pk-code'); }
}, true);

// ---------- Directions: how the editor and the conversation share the window ----------
// Every direction opens the same VS Code stand-in and the same links; they differ only in
// where the editor sits relative to the conversation. On a phone every direction falls back
// to the read-only peek, because VS Code's workbench does not run there.
let CUR = null; let origin = null;
const frame = document.querySelector('.frame');
const bodyEl = () => document.querySelector('.frame .body');
const colEl = () => document.querySelector('.frame .body > .col');
const composerTa = () => colEl()?.querySelector('.composer textarea, textarea');
const phone = () => frame.clientWidth < 760;
const KEY = 'Ctrl+Alt+K';
const kbd = (k) => `<kbd class="ed-kbd">${k}</kbd>`;
const el = (tag, cls, html = '') => { const n = document.createElement(tag); n.className = cls; n.innerHTML = html; return n; };
IC.panel = SVG('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>');
IC.ext = SVG('<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>');
IC.max = SVG('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>');

// The editor: one code-server per person, started on the first open (measured 3.4 s to a
// ready workbench). The prototype shows a shorter start so the flow stays quick to try.
let ED = null;
function makeEditor(parent) {
  const host = el('div', 'ed-host'); host.hidden = true; host.setAttribute('role', 'region'); host.setAttribute('aria-label', 'Editori: VS Code, open-habitat');
  const inner = el('div', 'ed-vsc'); host.append(inner); parent.append(host);
  // Keys inside the editor belong to VS Code, as they do in its frame; only the app's own
  // keystroke passes (in the product a code-server keybinding would post it to the app).
  host.addEventListener('keydown', (e) => { if (!isKey(e)) e.stopPropagation(); });
  return { host, inner, vsc: makeVSC(inner), warm: false, booting: null };
}
function editorOpen(r) {
  if (ED.warm) { if (r) ED.vsc.open(r); else ED.vsc.render(ED.vsc.st.tabs.length ? 'editor' : '[data-vs="side"]'); return; }
  ED.booting = r || ED.booting || null;
  if (ED.inner.querySelector('.ed-boot')) return;
  ED.inner.innerHTML = `<div class="ed-boot" role="status"><span class="st-dot working"></span><div><strong>Käynnistetään VS Code</strong><span>Ensimmäinen avaus kestää muutaman sekunnin. Sen jälkeen editori pysyy käynnissä, kunnes sitä ei ole käytetty puoleen tuntiin.</span></div></div>`;
  setTimeout(() => { if (!ED?.host.isConnected) return; ED.warm = true; const b = ED.booting; ED.booting = null; editorOpen(b); }, 900);
}
const isKey = (e) => (e.ctrlKey || e.metaKey) && e.altKey && e.code === 'KeyK';
// A narrower or wider conversation reflows; the line the reader was at stays where it was.
function keepPlace(change) {
  const sr = stage.getBoundingClientRect();
  const a = origin?.isConnected && stage.contains(origin) && (() => { const r = origin.getBoundingClientRect(); return r.bottom > sr.top && r.top < sr.bottom; })() ? origin
    : [...stage.querySelectorAll('.prose > *, .bubble, section.tool')].find(n => n.getBoundingClientRect().bottom > sr.top + 8);
  const rel = () => a.getBoundingClientRect().top - stage.getBoundingClientRect().top;
  const y = a && rel();
  change();
  if (a && a.getClientRects().length) stage.scrollTop += rel() - y;
}
// The link that opened the editor keeps a mark, so the reading place is visible on return.
function markLink(l) {
  for (const a of document.querySelectorAll('a.flink.opened, [data-fopen].opened')) a.classList.remove('opened');
  l?.classList.add('opened');
}
const refOf = (l) => l.dataset.fopen ? { path: l.dataset.fopen, kind: 'file', mode: l.dataset.mode } : { path: l.dataset.path, kind: l.dataset.kind, line: +l.dataset.line || 0, end: +l.dataset.end || 0, mode: l.dataset.mode };

// Pi's state for the places where the conversation is out of sight.
let unread = false; let wasWorking = false;
const piState = () => UI.working ? ['working', 'Pi työskentelee'] : unread ? ['attention', 'Uusi vastaus'] : ['waiting', 'Odottaa sinua'];
const stateHtml = () => { const [k, t] = piState(); return `<span class="st-dot ${k}"></span><span class="ed-st-l">${t}</span>`; };
APP.painted.push(() => {
  if (wasWorking && !UI.working && CUR?.convHidden()) unread = true;
  wasWorking = UI.working; if (!CUR?.convHidden()) unread = false;
  CUR?.painted();
});

function setMode(M) {
  if (CUR !== M) { CUR?.teardown(); frame.classList.remove('ed-v1', 'ed-v2', 'ed-v3', 'ed-open', 'conv-off', 'conv-open', 'tab-editor'); CUR = M; frame.classList.add(M.cls); M.setup(); }
  M.reset(); APP.actions = M.actions; unread = false;
}
function returnFocus() { const o = origin?.isConnected ? origin : composerTa(); o?.focus({ preventScroll: true }); }

document.addEventListener('click', (e) => {
  const l = e.target.closest('a.flink, [data-fopen]');
  if (l && !e.target.closest('.ed-host')) {
    e.preventDefault(); e.stopPropagation(); origin = l;
    if (phone()) return openPeek(refOf(l), l);
    markLink(l); return CUR?.open(refOf(l), l);
  }
  const f = e.target.closest('[data-fv]'); if (!f) return;
  e.preventDefault(); CUR?.action(f.dataset.fv, f);
}, true);
document.addEventListener('keydown', (e) => {
  if (isKey(e) && !phone()) { e.preventDefault(); return CUR?.key(); }
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  if (PK) { e.preventDefault(); return closePeek(true); }
  CUR?.escape?.(e);
});
// Turning the stage into a phone closes the editor: the phone has only the peek.
new ResizeObserver(() => { if (phone() && CUR?.isOpen()) CUR.close(false); else CUR?.resized?.(); }).observe(frame);
const edBtn = (on, title) => `<button type="button" class="ed-btn" data-fv="editor" aria-pressed="${on}" title="${title}">${IC.code}<span>Editori</span></button>`;

// ---------- 1. Rinnakkain: the editor beside the conversation, a split that remembers ----------
const W = { def: 440, min: 320, editorMin: 560, key: 'oh-proto-editorin-tila-conv-width' };
const loadW = () => { try { return +localStorage.getItem(W.key) || 0; } catch { return 0; } };
const saveW = (w) => { try { localStorage.setItem(W.key, String(Math.round(w))); } catch {} };
const V1 = {
  cls: 'ed-v1', on: false, off: false, w: W.def,
  setup() {
    ED = makeEditor(bodyEl());
    this.split = el('div', 'ed-split'); Object.assign(this.split, { tabIndex: 0, hidden: true, title: `Vedä leveyttä. Nuolet muuttavat, Enter piilottaa tai näyttää keskustelun, kaksoisnapsautus palauttaa.` });
    for (const [k, v] of Object.entries({ role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Keskustelun leveys', 'aria-valuemin': W.min })) this.split.setAttribute(k, v);
    this.strip = el('button', 'conv-strip'); this.strip.type = 'button'; this.strip.hidden = true; this.strip.dataset.fv = 'conv';
    bodyEl().append(this.split, this.strip);
    this.split.addEventListener('pointerdown', (e) => {
      e.preventDefault(); this.split.setPointerCapture(e.pointerId); const x0 = e.clientX, w0 = this.off ? 0 : this.w; frame.classList.add('dragging');
      const move = (m) => { const w = w0 - (m.clientX - x0); if (w < W.min - 90) { if (!this.off) this.collapse(true, false); } else { if (this.off) this.collapse(false, false); this.setW(w); } };
      const up = () => { this.split.removeEventListener('pointermove', move); frame.classList.remove('dragging'); if (!this.off) saveW(this.w); };
      this.split.addEventListener('pointermove', move); this.split.addEventListener('pointerup', up, { once: true }); this.split.addEventListener('pointercancel', up, { once: true });
    });
    this.split.addEventListener('dblclick', () => { this.collapse(false, false); this.setW(this.defW()); saveW(this.w); });
    this.split.addEventListener('keydown', (e) => {
      if (/^(Arrow|Home|End|Enter| )/.test(e.key)) e.stopPropagation();
      const step = e.shiftKey ? 96 : 32; const k = e.key;
      if (k === 'ArrowLeft') this.setW(this.w + step); else if (k === 'ArrowRight') this.setW(this.w - step);
      else if (k === 'Home') this.setW(this.max()); else if (k === 'End') this.setW(W.min);
      else if (k === 'Enter' || k === ' ') return e.preventDefault(), this.collapse(!this.off, false), this.split.focus();
      else return;
      e.preventDefault(); if (this.off) this.collapse(false, false); saveW(this.w);
    });
  },
  teardown() { ED.host.remove(); this.split.remove(); this.strip.remove(); frame.style.removeProperty('--conv-w'); UI.drawer = false; },
  reset() { this.on = false; this.off = false; ED.host.hidden = true; this.split.hidden = true; this.strip.hidden = true; frame.classList.remove('ed-open', 'conv-off'); colEl().inert = false; },
  // Until the person drags, the column takes about a third of a wide screen: 440 px on a laptop.
  defW() { return Math.round(Math.min(640, Math.max(W.def, bodyEl().clientWidth * 0.3))); },
  max() { return Math.max(W.min, bodyEl().clientWidth - W.editorMin); },
  setW(w) { keepPlace(() => this.applyW(w)); },
  applyW(w) { this.w = Math.round(Math.min(this.max(), Math.max(W.min, w))); frame.style.setProperty('--conv-w', `${this.w}px`); this.split.setAttribute('aria-valuenow', this.w); this.split.setAttribute('aria-valuemax', this.max()); this.split.setAttribute('aria-valuetext', `${this.w} pikseliä`); },
  resized() { if (this.on) this.applyW(this.w); },
  show(on) {
    keepPlace(() => {
      this.on = on; ED.host.hidden = !on; this.split.hidden = !on; frame.classList.toggle('ed-open', on);
      if (on) this.applyW(loadW() || this.defW()); else { this.off = false; frame.classList.remove('conv-off'); this.strip.hidden = true; colEl().inert = false; UI.drawer = false; }
      paint();
    });
  },
  collapse(off, focus = true) {
    keepPlace(() => { this.off = off; frame.classList.toggle('conv-off', off); this.strip.hidden = !off; colEl().inert = off; this.split.setAttribute('aria-valuenow', off ? 0 : this.w); if (!off) unread = false; paint(); });
    if (focus) (off ? ED.inner.querySelector('.vlines, .vcode, [data-vs]') : composerTa())?.focus({ preventScroll: true });
  },
  isOpen() { return this.on; }, convHidden() { return this.on && this.off; },
  open(r) { if (!this.on) this.show(true); editorOpen(r); },
  close(focus = true) { this.show(false); if (focus) returnFocus(); },
  // The keystroke moves between editor and conversation; a hidden conversation comes back first.
  key() {
    if (!this.on) { this.show(true); return editorOpen(null); }
    if (this.off) return this.collapse(false);
    if (colEl().contains(document.activeElement)) return (ED.inner.querySelector('.vlines, .vcode, [data-vs]'))?.focus({ preventScroll: true });
    composerTa()?.focus({ preventScroll: true });
  },
  action(a, b) {
    if (a === 'editor') { if (this.on) return this.close(); this.show(true); return editorOpen(null); }
    if (a === 'conv') return this.collapse(!this.off);
  },
  escape() {},
  painted() {
    if (!this.strip) return; const [k] = piState();
    this.strip.innerHTML = `<span class="st-dot ${k}"></span><span class="cs-l">Keskustelu</span>${unread ? '<span class="cs-new" aria-label="Uusi vastaus"></span>' : ''}`;
    this.strip.setAttribute('aria-label', `Näytä keskustelu (${piState()[1]})`); this.strip.title = `Näytä keskustelu (${KEY})`;
  },
  actions: (c) => {
    if (!V1.on) return edBtn(false, `Avaa työtilan VS Code keskustelun viereen (${KEY})`) + topActions(c);
    return edBtn(true, 'Sulje editori') + `<button type="button" class="icon-btn tb-btn" data-fv="conv" aria-pressed="${!V1.off}" aria-label="${V1.off ? 'Näytä keskustelu' : 'Piilota keskustelu'}" title="${V1.off ? 'Näytä keskustelu' : 'Piilota keskustelu'}">${IC.panel}</button>` + topActions(c);
  },
};

// ---------- 2. Laatikko: the editor fills the window, the conversation is a drawer ----------
const V2 = {
  cls: 'ed-v2', on: false, conv: false,
  setup() {
    ED = makeEditor(bodyEl());
    this.bar = el('div', 'ed-bar'); ED.host.prepend(this.bar);
    this.head = el('div', 'dr-head'); colEl().prepend(this.head);
    // A press in the editor while the drawer is open puts the drawer away (light dismiss).
    ED.inner.addEventListener('pointerdown', () => { if (this.conv) this.drawer(false, false); });
  },
  teardown() { ED.host.remove(); this.head.remove(); colEl().inert = false; },
  reset() { this.on = false; this.conv = false; ED.host.hidden = true; frame.classList.remove('ed-open', 'conv-open'); colEl().inert = false; },
  show(on) {
    keepPlace(() => {
      this.on = on; ED.host.hidden = !on; frame.classList.toggle('ed-open', on);
      if (!on) { this.conv = false; frame.classList.remove('conv-open'); colEl().inert = false; } else colEl().inert = !this.conv;
      paint();
    });
  },
  drawer(open, focus = true) {
    this.conv = open; frame.classList.toggle('conv-open', open); colEl().inert = !open;
    if (open) unread = false; paint();
    if (!focus) return;
    if (open) { const o = origin?.isConnected && colEl().contains(origin) ? origin : composerTa(); o?.focus({ preventScroll: true }); }
    else ED.inner.querySelector('.vlines, .vcode, [data-vs]')?.focus({ preventScroll: true });
  },
  isOpen() { return this.on; }, convHidden() { return this.on && !this.conv; },
  open(r) { if (!this.on) this.show(true); if (this.conv) this.drawer(false, false); editorOpen(r); },
  close(focus = true) { this.show(false); if (focus) returnFocus(); },
  key() { if (!this.on) { this.show(true); return editorOpen(null); } this.drawer(!this.conv); },
  action(a) {
    if (a === 'editor') { this.show(true); return editorOpen(null); }
    if (a === 'exit') return this.close();
    if (a === 'drawer') return this.drawer(!this.conv);
    if (a === 'drawer-close') return this.drawer(false);
  },
  escape(e) { if (this.conv && !e.target.closest('.ed-host')) { e.preventDefault(); this.drawer(false); } },
  painted() {
    if (!this.bar) return; const c = selConv();
    this.bar.innerHTML = `<button type="button" class="ed-exit" data-fv="exit" title="Sulje editori ja palaa keskusteluun">${IC.back}<span>Sulje editori</span></button><span class="ed-where"><span class="mono">${esc(c.ws.id)}</span><span class="sep">·</span>${esc(c.title)}</span><span class="ed-sp"></span><button type="button" class="ed-conv${unread ? ' new' : ''}" data-fv="drawer" aria-expanded="${this.conv}" title="Keskustelu (${KEY})">${stateHtml()}<span class="ed-conv-l">Keskustelu</span>${kbd(KEY)}</button>`;
    this.head.innerHTML = `<span class="dr-t"><strong>${esc(c.title)}</strong><span class="chip ${piState()[0]}">${stateHtml()}</span></span><button type="button" class="icon-btn" data-fv="drawer-close" aria-label="Piilota keskustelu" title="Piilota keskustelu (Esc tai ${KEY})">${IC.close}</button>`;
  },
  actions: (c) => edBtn(false, `Avaa työtilan VS Code koko ikkunaan (${KEY})`) + topActions(c),
};

// ---------- 3. Oma välilehti: the editor in its own browser tab on its own origin ----------
// The browser's tab strip and address bar are drawn by the prototype; in the product they are
// the browser's own, and the app only names the tab it opens (window name per workspace).
const APP_HOST = 'open-habitat-test.example.test', CODE_HOST = 'open-habitat-test-code.example.test';
const V3 = {
  cls: 'ed-v3', tab: 'app', has: false,
  setup() {
    this.chrome = el('div', 'bchrome'); this.chrome.setAttribute('aria-label', 'Selaimen välilehdet (prototyypin piirtämä)'); frame.prepend(this.chrome);
    ED = makeEditor(frame);
  },
  teardown() { ED.host.remove(); this.chrome.remove(); },
  reset() { this.tab = 'app'; this.has = false; ED.host.hidden = true; frame.classList.remove('tab-editor'); this.painted(); },
  go(t) { this.tab = t; ED.host.hidden = t !== 'editor'; frame.classList.toggle('tab-editor', t === 'editor'); this.painted(); },
  isOpen() { return this.tab === 'editor'; }, convHidden() { return false; },
  open(r) { this.has = true; this.go('editor'); editorOpen(r); },
  close(focus = true) { this.go('app'); if (focus) returnFocus(); },
  key() { toast('Editori on omassa välilehdessään: vaihda selaimen näppäimellä (Ctrl+Tab, Macissa Ctrl+Tab tai ⌘⌥→).'); },
  action(a, b) {
    if (a === 'editor') return this.open(null);
    if (a === 'tab') { if (b.dataset.tab === 'editor') { this.go('editor'); return editorOpen(null); } return this.close(); }
    if (a === 'tab-close') { this.has = false; this.close(); return toast('VS Code jäi palvelimelle käyntiin ja sammuu, kun sitä ei ole käytetty puoleen tuntiin.'); }
  },
  escape() {},
  painted() {
    if (!this.chrome) return; const c = selConv(); const t = ED?.vsc.st.tabs[ED.vsc.st.active];
    const ed = this.tab === 'editor';
    const url = ed ? `${CODE_HOST}/?folder=/home/maintainer/Sources/open-habitat` : `${APP_HOST}/w/open-habitat/c/kiintionakyman-tekstit`;
    this.chrome.innerHTML = `<div class="bt-row" role="tablist" aria-label="Selaimen välilehdet"><button type="button" role="tab" class="bt" data-fv="tab" data-tab="app" aria-selected="${!ed}" title="${APP_HOST}"><span class="bt-ic oh">OH</span><span class="bt-t">${esc(c.title)} – Open Habitat</span></button>${this.has ? `<span class="bt-w${ed ? ' on' : ''}"><button type="button" role="tab" class="bt" data-fv="tab" data-tab="editor" aria-selected="${ed}" title="${CODE_HOST}"><span class="bt-ic vs">${IC.code}</span><span class="bt-t">${t ? esc(base(t.path)) + ' — ' : ''}open-habitat — VS Code</span></button><button type="button" class="bt-x" data-fv="tab-close" aria-label="Sulje VS Code -välilehti" title="Sulje välilehti">${IC.close}</button></span>` : ''}<span class="bt-note">selaimen välilehdet, piirretty prototyyppiin</span></div><div class="bt-addr"><span class="bt-host">${ed ? CODE_HOST : APP_HOST}</span><span class="bt-path">${esc(url.slice(url.indexOf('/')))}</span></div>`;
  },
  actions: (c) => `<button type="button" class="ed-btn" data-fv="editor" title="Avaa työtilan VS Code omaan välilehteen">${IC.code}<span>VS Code</span>${IC.ext}</button>` + topActions(c),
};
// VS Code redraws its tab title when the file changes, so the browser tab follows.
const vscRender = () => { if (CUR === V3) V3.painted(); };
document.addEventListener('click', () => requestAnimationFrame(vscRender));

window.v1 = () => { setMode(V1); return appView(); };
window.v2 = () => { setMode(V2); return appView(); };
window.v3 = () => { setMode(V3); return appView(); };
})();
