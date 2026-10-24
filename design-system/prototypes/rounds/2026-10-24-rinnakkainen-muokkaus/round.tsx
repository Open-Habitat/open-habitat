import React, {type ReactNode, useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {BrowserEditor} from '../../../../web/src/components/BrowserEditor';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
import {EditorHeader} from '../../../../web/src/components/EditorHeader';
import {FileToolCard} from '../../../../web/src/components/FileToolCard';
import {Icon} from '../../../../web/src/components/Icon';
import type {TreeDirectories} from '../../../../web/src/components/editorTree';
import {ProtoEditor} from './editor';
import type {LineMark} from './cm';
import {type Chunk, type Pick, join, merge, changedLines} from './diff';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/EditorSplit.css';
import './round.css';

// Concurrent edit: the person has unsaved changes in the browser editor while
// the agent writes the same file. Direction 0 is production as it is (the
// production BrowserEditor, driven like BrowserDocument drives it); 1–3 answer
// one question differently: who reconciles the two versions, and when.
// Everything is synthetic and in memory: "disk" is a variable with the same
// compare-and-swap rule as the daemon's save (base_version must match).
const directions = ['Nykyinen', 'Valitse', 'Yhdistä', 'Tuo heti'];

// ---------- Synthetic file ----------

const PATH = 'docs/asennus.md';
const BASE = `# Asennus

Open Habitat asennetaan yhdelle Linux-palvelimelle.

## Vaatimukset

- Ubuntu 24.04 tai uudempi
- Julkinen DNS-nimi
- 2 Gt muistia

## Käynnistys

Aja \`sudo habitat install\` ja seuraa ohjeita.`;
// The person's unsaved edits: lines 3 and 9.
const MINE = BASE
  .replace('Linux-palvelimelle.', 'Linux-palvelimelle. Tarvitset palvelimelle sudo-oikeudet.')
  .replace('- 2 Gt muistia', '- 4 Gt muistia (suositus 8 Gt)');
type Overlap = 'separate' | 'same';
// The agent's write. "separate" touches other lines; "same" also line 9.
const THEIRS: Record<Overlap, string> = {
  separate: BASE.replace('- Ubuntu 24.04 tai uudempi', '- Ubuntu 24.04 LTS tai Debian 13')
    + '\n\n## Päivitys\n\nAja `sudo habitat upgrade`, kun uusi versio julkaistaan.',
  same: BASE.replace('- Ubuntu 24.04 tai uudempi', '- Ubuntu 24.04 LTS tai Debian 13')
    .replace('- 2 Gt muistia', '- 2 Gt muistia ja 20 Gt levytilaa'),
};
const AGENT_EDITS: Record<Overlap, {oldText: string; newText: string}[]> = {
  separate: [
    {oldText: '- Ubuntu 24.04 tai uudempi', newText: '- Ubuntu 24.04 LTS tai Debian 13'},
    {oldText: 'Aja `sudo habitat install` ja seuraa ohjeita.', newText: 'Aja `sudo habitat install` ja seuraa ohjeita.\n\n## Päivitys\n\nAja `sudo habitat upgrade`, kun uusi versio julkaistaan.'},
  ],
  same: [
    {oldText: '- Ubuntu 24.04 tai uudempi', newText: '- Ubuntu 24.04 LTS tai Debian 13'},
    {oldText: '- 2 Gt muistia', newText: '- 2 Gt muistia ja 20 Gt levytilaa'},
  ],
};
const directories: TreeDirectories = {
  '': {entries: [{name: 'docs', kind: 'directory'}, {name: 'src', kind: 'directory'}, {name: 'README.md', kind: 'file'}]},
  docs: {entries: [{name: 'asennus.md', kind: 'file'}, {name: 'kaytto.md', kind: 'file'}]},
};
// Review aid only: which named change is in a text.
const CHANGES: {who: 'agent' | 'you'; label: string; mark: string; only?: Overlap}[] = [
  {who: 'agent', label: 'Debian 13 tuetuksi', mark: 'Debian 13'},
  {who: 'agent', label: 'Päivitys-osio', mark: '## Päivitys', only: 'separate'},
  {who: 'agent', label: '20 Gt levytilaa', mark: '20 Gt levytilaa', only: 'same'},
  {who: 'you', label: 'sudo-oikeudet', mark: 'sudo-oikeudet'},
  {who: 'you', label: '4 Gt muistia', mark: '4 Gt muistia'},
];

type Disk = {content: string; version: number; by: 'start' | 'agent' | 'you'};
type Base = {content: string; version: number};
type Ctx = {
  overlap: Overlap;
  disk: Disk;
  diskRef: React.MutableRefObject<Disk>;
  write: (content: string) => Disk;
  buffer: string;
  setBuffer: (s: string) => void;
  picker: boolean;
  setPicker: (b: boolean) => void;
};
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const agentChanges = (o: Overlap) => CHANGES.filter(c => c.who === 'agent' && (!c.only || c.only === o)).length;

// ---------- Shared pieces ----------

function Banner({tone, title, children, actions, testid}: {tone: 'info' | 'warn' | 'ok' | 'risk'; title: ReactNode; children?: ReactNode; actions?: ReactNode; testid: string}) {
  return <div className={`cfe-banner cfe-${tone}`} role="status" data-testid={testid}>
    <div className="cfe-banner-text"><strong>{title}</strong>{children}</div>
    {actions && <div className="cfe-actions">{actions}</div>}
  </div>;
}
function DiffLines({base, lines}: {base: string[]; lines: string[]}) {
  return <pre className="cfe-diff">{base.map((l, i) => <span key={`b${i}`} className="cfe-del">− {l || ' '}{'\n'}</span>)}{lines.map((l, i) => <span key={`n${i}`} className="cfe-ins">+ {l || ' '}{'\n'}</span>)}</pre>;
}
function Lines({text, marks, kind}: {text: string; marks: number[]; kind: 'you' | 'agent'}) {
  const set = new Set(marks);
  return <pre className="cfe-lines">{text.split('\n').map((l, i) => <span key={i} className={set.has(i + 1) ? `cfe-hl-${kind}` : undefined}><i>{i + 1}</i>{l || ' '}{'\n'}</span>)}</pre>;
}
const savedNotice = (text: string, overlap: Overlap) => {
  const has = (who: 'agent' | 'you') => CHANGES.filter(c => c.who === who && (!c.only || c.only === overlap)).filter(c => text.includes(c.mark)).length;
  const a = has('agent'), y = has('you'), total = agentChanges(overlap);
  return a === total && y === 2 ? 'Tallennettu. Tiedostossa ovat nyt sekä sinun että agentin muutokset.'
    : a === 0 && y > 0 ? 'Tallennettu sinun versiosi. Agentin muutokset korvattiin; ne näkyvät yhä keskustelussa.'
    : `Tallennettu. Tiedostossa ${count(y, 'oma muutos', 'omaa muutosta')} ja ${count(a, 'agentin muutos', 'agentin muutosta')}.`;
};

// ---------- 0 · Nykyinen ----------
// BrowserDocument's state machine over the production BrowserEditor: nothing
// shows when the file changes; Save is refused with file_changed, then blocked;
// "Lue palvelimelta vertailuun" shows the disk text below; "Käytä luettua
// versiota pohjana" adopts it as the base and keeps the person's text, so the
// next Save writes the person's text over the agent's.

function Baseline({c}: {c: Ctx}) {
  const [doc, setDoc] = useState<Base>({content: BASE, version: 1});
  const [revision, setRevision] = useState(1);
  const [saving, setSaving] = useState(false), [saveBlocked, setSaveBlocked] = useState(false);
  const [problem, setProblem] = useState<string>(), [remote, setRemote] = useState<Base>();
  const [notice, setNotice] = useState<string>();
  const dirty = doc.content !== c.buffer;
  const save = () => {
    if (!dirty || saving || saveBlocked) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      if (c.diskRef.current.version !== doc.version) {
        setSaveBlocked(true);
        setProblem('Tiedosto on muuttunut palvelimella. Oma teksti säilyy. Lue versio vertailuun ja sovita muutokset ennen tallennusta.');
        return;
      }
      const d = c.write(c.buffer);
      setDoc(d); setProblem(undefined); setRemote(undefined);
      // Production says nothing after a save; the notice is the review aid's.
      setNotice(savedNotice(c.buffer, c.overlap));
    }, 300);
  };
  return <div className="cfe-baseline">
    <BrowserEditor engine="codemirror6" document={{path: PATH, content: c.buffer, revision}} directories={directories} onLoadDirectory={() => {}}
      picker={c.picker} dirty={dirty} saving={saving} saveBlocked={saveBlocked} loading={false} problem={problem} remote={remote?.content}
      onPicker={() => c.setPicker(!c.picker)} onOpen={() => {}}
      onChange={s => { setNotice(undefined); c.setBuffer(s); }}
      onSave={save}
      onCompare={() => setRemote({...c.diskRef.current})}
      onReload={() => {
        if (dirty && !window.confirm('Hylätäänkö tallentamattomat muutokset? Peruuta ja tallenna ensin, jos haluat säilyttää ne.')) return;
        const d = c.diskRef.current;
        setDoc({...d}); c.setBuffer(d.content); setRevision(r => r + 1); setRemote(undefined); setProblem(undefined); setSaveBlocked(false);
      }}
      onReconcile={() => { if (remote) { setDoc(remote); setRemote(undefined); setProblem(undefined); setSaveBlocked(false); } }}
    />
    {notice && <p className="cfe-review-note" data-testid="baseline-saved">Arvioijan huomautus: {notice} Tuotanto ei näytä tallennuksen jälkeen mitään.</p>}
  </div>;
}

// ---------- 1 · Valitse versio ----------
// The editor notices the agent's write at once. Nothing merges: the person
// sees both whole versions side by side and keeps one, with the cost named on
// the button. Save, while the versions differ, opens the comparison.

function useBase(c: Ctx) {
  const [base, setBase] = useState<Base>({content: BASE, version: 1});
  return [base, setBase] as const;
}

function ChooseVersion({c}: {c: Ctx}) {
  const [base, setBase] = useBase(c);
  const [revision, setRevision] = useState(1);
  const [view, setView] = useState<'edit' | 'compare'>('edit');
  const [notice, setNotice] = useState<{text: string; undo?: {buffer: string; base: Base}}>();
  const stale = c.disk.version !== base.version;
  const dirty = c.buffer !== base.content;
  const conflict = stale && dirty;
  // A clean editor simply follows the disk.
  useEffect(() => {
    if (stale && !dirty) { setBase({...c.disk}); c.setBuffer(c.disk.content); setRevision(r => r + 1); }
  }, [c.disk.version]);
  const mineCount = changedLines(base.content, c.buffer).length;
  const theirsCount = agentChanges(c.overlap);
  const keepMine = () => {
    const d = c.write(c.buffer); setBase(d); setView('edit'); setNotice({text: savedNotice(c.buffer, c.overlap)});
  };
  const takeTheirs = () => {
    const before = {buffer: c.buffer, base}; setBase({...c.disk}); c.setBuffer(c.disk.content); setRevision(r => r + 1); setView('edit');
    setNotice({text: 'Agentin versio on nyt editorissa. Omat muutoksesi hylättiin.', undo: before});
  };
  const banner = conflict && view === 'edit'
    ? <Banner tone="warn" testid="conflict-banner" title="Agentti muutti tätä tiedostoa 14.32, kun sinulla oli tallentamattomia muutoksia."
      actions={<Button data-testid="open-compare" size="row" variant="primary" onPress={() => setView('compare')}>Vertaa versioita</Button>}>
      <p>Kumpikaan ei ole kadonnut: agentin versio on levyllä, sinun versiosi tässä editorissa. Tallennus odottaa, kunnes valitset, kumpi jää voimaan.</p>
    </Banner>
    : notice ? <Banner tone="ok" testid="saved-banner" title={notice.text}
      actions={notice.undo !== undefined ? <Button data-testid="undo-take" size="row" variant="quiet" onPress={() => { setBase(notice.undo!.base); c.setBuffer(notice.undo!.buffer); setRevision(r => r + 1); setNotice(undefined); }}>Palauta oma teksti</Button> : undefined}/> : undefined;
  const takeover = view === 'compare' ? <div className="cfe-takeover cfe-compare" data-testid="compare-view">
    <header className="cfe-take-head"><h3>Kumpi versio jää voimaan?</h3><p>Korostetut rivit ovat muuttuneet siitä, kun avasit tiedoston. Valinta tallentaa heti.</p>
      <Button data-testid="back-to-edit" size="row" variant="quiet" onPress={() => setView('edit')}>Jatka muokkaamista</Button></header>
    <div className="cfe-columns">
      <section className="cfe-col" aria-label="Sinun versiosi">
        <h4><Icon name="user"/>Sinun versiosi <small>ei tallennettu · {count(mineCount, 'muutos', 'muutosta')}</small></h4>
        <Lines text={c.buffer} marks={changedLines(base.content, c.buffer)} kind="you"/>
        <div className="cfe-choice"><Button data-testid="keep-mine" size="row" variant="danger" onPress={keepMine}>Pidä oma versio</Button>
          <p>Korvaa levyllä olevan version. Agentin {count(theirsCount, 'muutos katoaa', 'muutosta katoaa')} tiedostosta.</p></div>
      </section>
      <section className="cfe-col" aria-label="Agentin versio">
        <h4><Icon name="agent"/>Agentin versio <small>levyllä · tallennettu 14.32</small></h4>
        <Lines text={c.disk.content} marks={changedLines(base.content, c.disk.content)} kind="agent"/>
        <div className="cfe-choice"><Button data-testid="take-theirs" size="row" onPress={takeTheirs}>Ota agentin versio</Button>
          <p>Omat {count(mineCount, 'muutoksesi hylätään', 'muutostasi hylätään')}. Voit palauttaa ne heti valinnan jälkeen.</p></div>
      </section>
    </div>
  </div> : undefined;
  return <ProtoEditor path={PATH} content={c.buffer} revision={revision} directories={directories} picker={c.picker} onPicker={() => c.setPicker(!c.picker)}
    status={conflict ? 'Muokattu · kaksi versiota' : dirty ? 'Muokattu' : ''}
    saveLabel={conflict ? 'Tallenna…' : 'Tallenna'} saveDisabled={!dirty || view === 'compare'}
    onSave={() => conflict ? setView('compare') : keepMine()}
    onChange={s => { setNotice(undefined); c.setBuffer(s); }} busy={false} banner={banner} takeover={takeover}/>;
}

// ---------- 2 · Yhdistä tallentaessa ----------
// Only today's host facts: the change is found when Save is refused. Instead
// of an error the refusal opens a merge of the three texts the editor already
// has. Each change is listed with its author; the person decides only where
// both touched the same lines, and Save writes exactly the listed result.

function MergeOnSave({c}: {c: Ctx}) {
  const [base, setBase] = useBase(c);
  const [revision, setRevision] = useState(1);
  const [chunks, setChunks] = useState<Chunk[]>();
  const [picks, setPicks] = useState<Record<string, Pick | undefined>>({});
  const [skip, setSkip] = useState(new Set<string>());
  const [whole, setWhole] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string>();
  const dirty = c.buffer !== base.content;
  const save = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      const d = c.diskRef.current;
      if (d.version !== base.version) { setChunks(merge(base.content, c.buffer, d.content)); setPicks({}); setSkip(new Set()); return; }
      const w = c.write(c.buffer); setBase(w); setNotice(savedNotice(c.buffer, c.overlap));
    }, 300);
  };
  const changes = (chunks ?? []).filter(k => k.kind !== 'same');
  const open = changes.filter(k => k.kind === 'conflict' && !picks[k.id]);
  const result = chunks ? join(chunks, picks, skip) : '';
  const commit = () => {
    const w = c.write(result); setBase(w); c.setBuffer(result); setRevision(r => r + 1); setChunks(undefined); setNotice(savedNotice(result, c.overlap));
  };
  const toggle = (id: string) => setSkip(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const included = (who: 'mine' | 'theirs') => changes.filter(k => (k.kind === who && !skip.has(k.id)) || (k.kind === 'conflict' && (picks[k.id] === who || picks[k.id] === 'both'))).length;
  const takeover = chunks ? <div className="cfe-takeover cfe-merge" data-testid="merge-view">
    <header className="cfe-take-head"><h3>Tiedosto muuttui levyllä, kun muokkasit sitä</h3>
      <p>Agentti tallensi tiedoston 14.32. Kumpikaan muutos ei ole vielä kadonnut. Alla ovat kaikki muutokset siitä, kun avasit tiedoston; tallennus kirjoittaa ne, jotka ovat mukana.</p></header>
    <ol className="cfe-cards">{changes.map(k => k.kind === 'conflict'
      ? <li key={k.id} className="cfe-card cfe-card-conflict" data-testid="merge-conflict">
          <h4>Molemmat muuttivat · rivi {k.line}</h4>
          <DiffLines base={k.base} lines={[]}/>
          <Segmented data-testid="conflict-pick" label={`Kumpi jää riville ${k.line}`} size="row" value={picks[k.id]} onChange={v => setPicks(p => ({...p, [k.id]: v}))}
            options={[{id: 'mine', label: 'Sinun'}, {id: 'theirs', label: 'Agentin'}, {id: 'both', label: 'Molemmat'}]}/>
          <div className="cfe-pickrows">
            <div data-on={picks[k.id] === 'mine' || picks[k.id] === 'both' || undefined}><small><Icon name="user"/>Sinun</small><pre>{k.mine.join('\n')}</pre></div>
            <div data-on={picks[k.id] === 'theirs' || picks[k.id] === 'both' || undefined}><small><Icon name="agent"/>Agentin</small><pre>{k.theirs.join('\n')}</pre></div>
          </div>
        </li>
      : <li key={k.id} className="cfe-card" data-who={k.kind} data-testid={`merge-${k.kind}`}>
          <h4>{k.kind === 'mine' ? <><Icon name="user"/>Sinun muutoksesi</> : <><Icon name="agent"/>Agentin muutos</>} · rivi {k.line}</h4>
          <DiffLines base={k.base} lines={k.kind === 'same' ? [] : k.lines}/>
          <label className="cfe-check"><input type="checkbox" checked={!skip.has(k.id)} onChange={() => toggle(k.id)} data-testid="merge-include"/> Mukana tallennuksessa</label>
        </li>)}</ol>
    <details open={whole} onToggle={e => setWhole((e.target as HTMLDetailsElement).open)}><summary>Näytä tallennettava teksti</summary><Lines text={result} marks={[]} kind="you"/></details>
    <footer className="cfe-take-foot">
      <p data-testid="merge-summary">{open.length ? `Valitse ${count(open.length, 'ristiriitaiseen kohtaan', 'ristiriitaiseen kohtaan')}, kumpi jää.` : `Tallennus kirjoittaa ${count(included('theirs'), 'agentin muutoksen', 'agentin muutosta')} ja ${count(included('mine'), 'oman muutoksen', 'omaa muutosta')}.`}</p>
      <Button data-testid="merge-back" size="row" variant="quiet" onPress={() => setChunks(undefined)}>Takaisin muokkaamaan</Button>
      <Button data-testid="merge-save" size="row" variant="primary" isDisabled={open.length > 0} onPress={commit}>Tallenna yhdistelmä</Button>
    </footer>
  </div> : undefined;
  const banner = notice && !chunks ? <Banner tone="ok" testid="saved-banner" title={notice}/> : undefined;
  return <ProtoEditor path={PATH} content={c.buffer} revision={revision} directories={directories} picker={c.picker} onPicker={() => c.setPicker(!c.picker)}
    status={saving ? 'Tallennetaan' : chunks ? 'Muokattu · yhdistetään' : dirty ? 'Muokattu' : ''}
    saveLabel="Tallenna" saveDisabled={!dirty || saving || !!chunks} onSave={save}
    onChange={s => { setNotice(undefined); c.setBuffer(s); }} busy={saving} banner={banner} takeover={takeover}/>;
}

// ---------- 3 · Tuo heti ----------
// The editor notices the agent's write at once and brings the agent's changes
// into the person's buffer, marked, as one undoable change. The buffer is then
// based on the agent's version, so Save is an ordinary save of everything you
// see. Only lines both changed wait for a choice, inline above the text.

function ImportNow({c}: {c: Ctx}) {
  const [base, setBase] = useBase(c);
  const [revision, setRevision] = useState(1);
  const [patch, setPatch] = useState<{id: number; text: string}>();
  const [marks, setMarks] = useState<LineMark[]>([]);
  const [conflict, setConflict] = useState<{mine: string[]; theirs: string[]; line: number}>();
  const [imported, setImported] = useState<{before: string; origin: string; count: number}>();
  const [undone, setUndone] = useState<{before: string; origin: string}>();
  const [notice, setNotice] = useState<string>();
  const apply = (text: string, m: LineMark[]) => { c.setBuffer(text); setPatch(p => ({id: (p?.id ?? 0) + 1, text})); setMarks(m); };
  const bring = (from: string, origin: string, onto: Base) => {
    const chunks = merge(origin, from, onto.content);
    const text = join(chunks);
    const m: LineMark[] = [];
    let line = 1, n = 0, cf: typeof conflict;
    for (const k of chunks) {
      const lines = k.kind === 'same' ? k.lines : k.kind === 'conflict' ? k.mine : k.lines;
      if (k.kind === 'theirs') { lines.forEach((_, i) => m.push({line: line + i, kind: 'agent'})); n++; }
      if (k.kind === 'conflict') { lines.forEach((_, i) => m.push({line: line + i, kind: 'conflict'})); cf = {mine: k.mine, theirs: k.theirs, line}; n++; }
      line += lines.length;
    }
    setBase({content: onto.content, version: onto.version});
    apply(text, m); setConflict(cf); setImported({before: from, origin, count: n}); setUndone(undefined); setNotice(undefined);
  };
  useEffect(() => {
    if (c.disk.version === base.version || c.disk.by !== 'agent') return;
    if (c.buffer === base.content) { setBase({...c.disk}); c.setBuffer(c.disk.content); setRevision(r => r + 1); return; }
    bring(c.buffer, base.content, c.disk);
  }, [c.disk.version]);
  const resolve = (p: Pick) => {
    if (!conflict) return;
    const now = c.buffer.split('\n');
    const at = conflict.line - 1;
    const pick = p === 'mine' ? conflict.mine : p === 'theirs' ? conflict.theirs : [...conflict.mine, ...conflict.theirs];
    now.splice(at, conflict.mine.length, ...pick);
    const m = marks.filter(x => x.kind !== 'conflict').map(x => x.line > at ? {...x, line: x.line + pick.length - conflict.mine.length} : x);
    if (p !== 'mine') pick.forEach((_, i) => { if (p === 'theirs' || i >= conflict.mine.length) m.push({line: at + 1 + i, kind: 'agent'}); });
    apply(now.join('\n'), m); setConflict(undefined);
  };
  const dirty = c.buffer !== base.content;
  const save = () => { const w = c.write(c.buffer); setBase(w); setMarks([]); setImported(undefined); setUndone(undefined); setNotice(savedNotice(c.buffer, c.overlap)); };
  const banner = conflict
    ? <Banner tone="risk" testid="inline-conflict" title={`Agentti muutti samaa riviä kuin sinä (rivi ${conflict.line}).`}>
        <p>Agentin muut muutokset tuotiin tekstiisi. Valitse tämä kohta ennen tallennusta.</p>
        <div className="cfe-pickrows cfe-pick-inline">
          <button type="button" data-testid="resolve-mine" onClick={() => resolve('mine')}><small><Icon name="user"/>Pidä oma</small><code>{conflict.mine.join('\n')}</code></button>
          <button type="button" data-testid="resolve-theirs" onClick={() => resolve('theirs')}><small><Icon name="agent"/>Ota agentin</small><code>{conflict.theirs.join('\n')}</code></button>
          <button type="button" data-testid="resolve-both" onClick={() => resolve('both')}><small>Molemmat allekkain</small><code>{[...conflict.mine, ...conflict.theirs].join('\n')}</code></button>
        </div>
      </Banner>
    : undone !== undefined
      ? <Banner tone="risk" testid="import-undone" title="Agentin muutoksia ei ole tekstissäsi." actions={<Button data-testid="redo-import" size="row" variant="secondary" onPress={() => bring(undone.before, undone.origin, {...c.disk})}>Tuo ne uudelleen</Button>}>
          <p>Levyllä on agentin versio. Tallennus korvaa sen sinun tekstilläsi.</p></Banner>
      : imported
        ? <Banner tone="info" testid="import-banner" title={`Agentti muutti tiedostoa 14.32. ${count(imported.count, 'muutos tuotiin', 'muutosta tuotiin')} tekstiisi.`}
            actions={<Button data-testid="undo-import" size="row" variant="quiet" onPress={() => { apply(imported.before, []); setUndone({before: imported.before, origin: imported.origin}); setImported(undefined); }}>Peru tuonti</Button>}>
            <p>Agentin rivit on korostettu. Omat tallentamattomat muutoksesi pysyivät. Tallenna kirjoittaa levylle kaiken, mitä editorissa näkyy.</p></Banner>
        : notice ? <Banner tone="ok" testid="saved-banner" title={notice}/> : undefined;
  return <ProtoEditor path={PATH} content={c.buffer} revision={revision} directories={directories} picker={c.picker} onPicker={() => c.setPicker(!c.picker)}
    status={conflict ? 'Muokattu · 1 ristiriita' : imported && dirty ? 'Muokattu · sis. agentin muutokset' : dirty ? 'Muokattu' : ''}
    saveLabel={undone !== undefined ? 'Tallenna ja korvaa agentin versio' : 'Tallenna'} saveVariant={undone !== undefined ? 'danger' : 'secondary'}
    saveDisabled={!dirty || !!conflict} onSave={save}
    onChange={s => { setNotice(undefined); c.setBuffer(s); }} busy={false} marks={marks} patch={patch} banner={banner}/>;
}

// ---------- Review frame ----------

function Conversation({overlap, wrote}: {overlap: Overlap; wrote: boolean}) {
  return <aside className="cfe-convo" aria-label="Keskustelu">
    <div className="cfe-msg cfe-user"><p>{overlap === 'separate' ? 'Lisää asennusohjeeseen Debian 13 ja päivitysohje.' : 'Lisää asennusohjeeseen Debian 13 ja levytilavaatimus.'}</p></div>
    <div className="cfe-msg cfe-agent"><p>Päivitän tiedoston <code>{PATH}</code>.</p>
      {wrote ? <><div className="cfe-tool" data-testid="agent-tool"><small>edit · 14.32</small><FileToolCard name="edit" argumentsText={JSON.stringify({path: PATH, edits: AGENT_EDITS[overlap]})} output="Successfully replaced text."/></div>
        <p>{overlap === 'separate' ? 'Lisäsin Debian 13:n ja Päivitys-osion.' : 'Lisäsin Debian 13:n ja levytilavaatimuksen.'}</p></>
        : <p className="cfe-typing"><Icon name="thinking"/>Agentti työskentelee…</p>}
    </div>
  </aside>;
}

function Inspector({overlap, disk, buffer}: {overlap: Overlap; disk: Disk; buffer: string}) {
  const rows = CHANGES.filter(c => !c.only || c.only === overlap);
  const mark = (t: string, m: string) => t.includes(m) ? <span className="cfe-yes" data-on="1"><Icon name="check"/><span className="sr">mukana</span></span> : <span className="cfe-no">–</span>;
  return <section className="cfe-inspector" data-testid="inspector" aria-label="Arvioijan apu">
    <p className="eyebrow">Arvioijan apu · ei osa tuotetta</p>
    <table><thead><tr><th>Muutos</th><th>Levyllä</th><th>Editorissa</th></tr></thead><tbody>
      {rows.map(r => <tr key={r.mark} data-testid={`inspect-${r.who}`}><td>{r.who === 'agent' ? 'Agentti' : 'Sinä'}: {r.label}</td><td data-testid="on-disk">{mark(disk.content, r.mark)}</td><td>{mark(buffer, r.mark)}</td></tr>)}
    </tbody></table>
    <p className="muted">Levyllä: {disk.by === 'start' ? 'alkuperäinen' : disk.by === 'agent' ? 'agentin tallennus' : 'sinun tallennuksesi'} · versio {disk.version}</p>
  </section>;
}

let reviewTheme = 'light', reviewPhone = false, reviewOverlap: Overlap = 'separate';
function App({direction}: {direction: number}) {
  const [theme, setTheme] = useState(reviewTheme), [phone, setPhone] = useState(reviewPhone);
  const [overlap, setOverlap] = useState<Overlap>(reviewOverlap);
  const [run, setRun] = useState(0);
  return <div data-theme={theme} className={phone ? 'review phone' : 'review'}>
    <header className="reviewbar"><strong>Rinnakkainen muokkaus · kierros 1</strong>
      <label>Teema <select id="theme" value={theme} onChange={e => { reviewTheme = e.target.value; setTheme(reviewTheme); }}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
      <label><input id="phone" type="checkbox" checked={phone} onChange={e => { reviewPhone = e.target.checked; setPhone(reviewPhone); }}/> 390 px</label>
      <p>Synteettiset tiedot. Ei yhteyttä palvelimeen.</p></header>
    <p className="axis">Sinulla on tallentamattomia muutoksia, ja agentti tallentaa saman tiedoston. Neljä tapaa vastata: nykyinen tuotanto, valitse kokonainen versio, yhdistä tallentaessa ja tuo agentin muutokset heti tekstiisi. Suositus: Tuo heti.</p>
    <Scenario key={`${overlap}|${run}|${phone}`} direction={direction} overlap={overlap} phone={phone}
      controls={<>
        <Segmented data-testid="overlap" label="Agentin muutos" size="row" value={overlap} onChange={v => { reviewOverlap = v; setOverlap(v); }}
          options={[{id: 'separate', label: 'Eri riveille'}, {id: 'same', label: 'Samalle riville'}]}/>
        <Button data-testid="restart" size="row" variant="quiet" onPress={() => setRun(r => r + 1)}>Aloita alusta</Button>
      </>}/>
  </div>;
}

function Scenario({direction, overlap, phone, controls}: {direction: number; overlap: Overlap; phone: boolean; controls: ReactNode}) {
  const [disk, setDisk] = useState<Disk>({content: BASE, version: 1, by: 'start'});
  const diskRef = useRef(disk); diskRef.current = disk;
  const [buffer, setBuffer] = useState(MINE);
  // Production hides the tree after opening a file on a narrow screen.
  const [picker, setPicker] = useState(!phone && window.innerWidth > 800);
  const write = (content: string) => { const d: Disk = {content, version: diskRef.current.version + 1, by: 'you'}; diskRef.current = d; setDisk(d); return d; };
  const [wrote, setWrote] = useState(false);
  const agentWrite = () => { setWrote(true); const d: Disk = {content: THEIRS[overlap], version: diskRef.current.version + 1, by: 'agent'}; diskRef.current = d; setDisk(d); };
  const c: Ctx = {overlap, disk, diskRef, write, buffer, setBuffer, picker, setPicker};
  const Direction = [Baseline, ChooseVersion, MergeOnSave, ImportNow][direction];
  return <>
    <div className="scenario">
      <div className="steps"><span className="step-n">1</span><span>Editorissa on kaksi tallentamatonta muutosta (rivit 3 ja 9).</span>
        <span className="step-n">2</span><Button data-testid="agent-write" size="row" variant="primary" isDisabled={wrote} onPress={agentWrite}><Icon name="agent"/>Agentti tallentaa tiedoston</Button>
        <span className="step-n">3</span><span>Tallenna, vertaa tai jatka muokkaamista.</span></div>
      <div className="steps">{controls}</div>
      <Inspector overlap={overlap} disk={disk} buffer={buffer}/>
    </div>
    <div className={`shell variant-${direction}`}>
      <div className="ah-editor-split ah-editor-open">
        <section className="ah-editor-pane cfe-pane">
          <EditorHeader title="Tekstieditori" collapsed={phone || window.innerWidth <= 800} onToggleCollapsed={() => {}} onClose={() => {}}/>
          <Direction c={c}/>
        </section>
        {!phone && <Conversation overlap={overlap} wrote={wrote}/>}
      </div>
    </div>
  </>;
}

const root = createRoot(document.getElementById('root')!);
// Keep the shared reference wiring intact: its stage writes become React commits.
// Flush the empty commit so switching (and R) really unmounts the old fixture.
const stageSink = {set innerHTML(view: React.ReactNode) { flushSync(() => root.render(view === '' ? null : view)); }};
const variants = directions.map((_, direction) => () => <App direction={direction}/>);
const picker = document.createElement('nav');
picker.className = 'proto-picker'; picker.setAttribute('aria-label', 'Prototype variants');
picker.innerHTML = '<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((name, i) => { const button = document.createElement('button'); button.className = 'proto-picker-item'; button.textContent = name.replaceAll(' ', '\u00a0'); if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); } picker.append(button); });
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
