import React, {type ReactNode, useEffect, useRef, useState} from 'react';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import pickerSource from '../../lib/picker.js?raw';
import '../../lib/picker.css';
import {ControlButton as Button, Segmented} from '../../../../web/src/components/ControlElements';
import {Composer} from '../../../../web/src/components/composer/Composer';
import {EditorHeader} from '../../../../web/src/components/EditorHeader';
import {FileToolCard} from '../../../../web/src/components/FileToolCard';
import {Icon} from '../../../../web/src/components/Icon';
import type {TreeDirectories} from '../../../../web/src/components/editorTree';
import {ProtoEditor} from './editor';
import {type ConflictRenderer, type EditorApi, type MergeState, type Source, emptyMerge} from './cm';
import {landing, replaced, threeWay} from './merge';
import '../../../../design-system/styles.css';
import '../../../../web/src/components/components.css';
import '../../../../web/src/components/EditorSplit.css';
import './round.css';

// Concurrent edit, round 2: "Tuo heti" as Jari decided it on 2026-10-24. The
// editor notices the agent's write at once, but brings the changes into the
// person's text only after a typing pause (or on Save, at the latest). Lines
// both changed wait for Sinun / Agentin / Molemmat, Ctrl+Z undoes the import,
// and saving over the agent's work leaves a note in the conversation. The
// three directions differ only in how the waiting state shows. Everything is
// synthetic and in memory: "disk" is a variable with the daemon's
// compare-and-swap save rule (base_version must match).
const directions = ['Ilmoitus', 'Hiljainen merkki', 'Rivimerkit'];
type Look = 0 | 1 | 2;

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
// What "Kirjoita" adds to the end of line 3, one key at a time.
const TYPED = ' Asennus vie noin kymmenen minuuttia.';
type Overlap = 'separate' | 'same';
// The agent's write. "separate" touches other lines; "same" also lines 3 and 9.
const THEIRS: Record<Overlap, string> = {
  separate: BASE.replace('- Ubuntu 24.04 tai uudempi', '- Ubuntu 24.04 LTS tai Debian 13')
    + '\n\n## Päivitys\n\nAja `sudo habitat upgrade`, kun uusi versio julkaistaan.',
  same: BASE.replace('Linux-palvelimelle.', 'Linux-palvelimelle tai virtuaalikoneelle.')
    .replace('- Ubuntu 24.04 tai uudempi', '- Ubuntu 24.04 LTS tai Debian 13')
    .replace('- 2 Gt muistia', '- 2 Gt muistia ja 20 Gt levytilaa'),
};
const AGENT_EDITS: Record<Overlap, {oldText: string; newText: string}[]> = {
  separate: [
    {oldText: '- Ubuntu 24.04 tai uudempi', newText: '- Ubuntu 24.04 LTS tai Debian 13'},
    {oldText: 'Aja `sudo habitat install` ja seuraa ohjeita.', newText: 'Aja `sudo habitat install` ja seuraa ohjeita.\n\n## Päivitys\n\nAja `sudo habitat upgrade`, kun uusi versio julkaistaan.'},
  ],
  same: [
    {oldText: 'Linux-palvelimelle.', newText: 'Linux-palvelimelle tai virtuaalikoneelle.'},
    {oldText: '- Ubuntu 24.04 tai uudempi', newText: '- Ubuntu 24.04 LTS tai Debian 13'},
    {oldText: '- 2 Gt muistia', newText: '- 2 Gt muistia ja 20 Gt levytilaa'},
  ],
};
// The same write made with bash: no file tool call names it, so the editor
// cannot say the agent did it.
const BASH: Record<Overlap, string> = {
  separate: "sed -i 's/Ubuntu 24.04 tai uudempi/Ubuntu 24.04 LTS tai Debian 13/' docs/asennus.md\nprintf '\\n## Päivitys\\n\\nAja `sudo habitat upgrade`, kun uusi versio julkaistaan.\\n' >> docs/asennus.md",
  same: "sed -i -e 's/palvelimelle\\./palvelimelle tai virtuaalikoneelle./' \\\n  -e 's/Ubuntu 24.04 tai uudempi/Ubuntu 24.04 LTS tai Debian 13/' \\\n  -e 's/2 Gt muistia/2 Gt muistia ja 20 Gt levytilaa/' docs/asennus.md",
};
const directories: TreeDirectories = {
  '': {entries: [{name: 'docs', kind: 'directory'}, {name: 'src', kind: 'directory'}, {name: 'README.md', kind: 'file'}]},
  docs: {entries: [{name: 'asennus.md', kind: 'file'}, {name: 'kaytto.md', kind: 'file'}]},
};
// Review aid only: which named change is in a text.
const CHANGES: {who: 'agent' | 'you'; label: string; mark: string; only?: Overlap}[] = [
  {who: 'agent', label: 'virtuaalikone', mark: 'virtuaalikoneelle', only: 'same'},
  {who: 'agent', label: 'Debian 13 tuetuksi', mark: 'Debian 13'},
  {who: 'agent', label: 'Päivitys-osio', mark: '## Päivitys', only: 'separate'},
  {who: 'agent', label: '20 Gt levytilaa', mark: '20 Gt levytilaa', only: 'same'},
  {who: 'you', label: 'sudo-oikeudet', mark: 'sudo-oikeudet'},
  {who: 'you', label: '4 Gt muistia', mark: '4 Gt muistia'},
];

type Disk = {content: string; version: number; by: 'start' | 'agent' | 'you'};
type Base = {content: string; version: number};
type Note = {id: number; at: string; lines: {line: number; theirs: string[]}[]};
type Ctx = {
  overlap: Overlap;
  source: Source;
  pause: number;
  disk: Disk;
  diskRef: React.MutableRefObject<Disk>;
  write: (content: string) => Disk;
  buffer: string;
  setBuffer: (s: string) => void;
  picker: boolean;
  setPicker: (b: boolean) => void;
  api: React.MutableRefObject<EditorApi | undefined>;
  addNote: (lines: Note['lines']) => void;
};
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const AT = '14.32', SAVED_AT = '14.34';

// ---------- Shared pieces ----------

function Banner({tone, title, children, actions, testid}: {tone: 'info' | 'ok' | 'risk'; title: ReactNode; children?: ReactNode; actions?: ReactNode; testid: string}) {
  return <div className={`cfe-banner cfe-${tone}`} role="status" data-testid={testid}>
    <div className="cfe-banner-text"><strong>{title}</strong>{children}</div>
    {actions && <div className="cfe-actions">{actions}</div>}
  </div>;
}

// The card CodeMirror shows above each line both changed.
const renderConflict: ConflictRenderer = (c, source, pick) => {
  const them = source === 'agent' ? 'Agentin' : 'Levyn';
  return <div className="cfe-cw" role="group" aria-label={source === 'agent' ? 'Agentti muutti saman rivin' : 'Sama rivi muuttui levyllä'} data-testid="conflict">
    <p className="cfe-cw-head"><strong>{source === 'agent' ? 'Agentti muutti saman rivin' : 'Sama rivi muuttui levyllä'}</strong>
      <span>Sinun rivisi on alla punaisella. Valitse, mikä jää.</span></p>
    <pre className="cfe-cw-theirs"><small>{them}</small>{c.theirs.join('\n') || '(rivi poistettu)'}</pre>
    <div className="cfe-actions">
      <Button data-testid="pick-mine" size="row" onPress={() => pick('mine')}><Icon name="user"/>Sinun</Button>
      <Button data-testid="pick-theirs" size="row" onPress={() => pick('theirs')}>{source === 'agent' && <Icon name="agent"/>}{them}</Button>
      <Button data-testid="pick-both" size="row" onPress={() => pick('both')}>Molemmat</Button>
    </div>
  </div>;
};

// ---------- Tuo tauon jälkeen ----------
// One controller for all three looks. Detection is immediate; the import
// waits until the person has not typed for `pause` ms (and at least `pause`
// after the detection, so text never changes the instant a notice appears).

type Pending = {disk: Disk; origin: string; count: number; at: number};
type Write = {origin: string; theirs: string; source: Source};

function ImportAfterPause({c, look}: {c: Ctx; look: Look}) {
  const [base, setBase] = useState<Base>({content: BASE, version: 1});
  const [revision, setRevision] = useState(1);
  const [merge, setMerge] = useState<MergeState>(emptyMerge);
  const [pending, setPendingState] = useState<Pending>();
  const pendingRef = useRef<Pending>();
  const setPending = (p?: Pending) => { pendingRef.current = p; setPendingState(p); };
  const [write, setWrite] = useState<Write>();
  const writeRef = useRef<Write>(); writeRef.current = write;
  const [importedOnce, setImportedOnce] = useState(false);
  // "Peru tuonti" is Ctrl+Z only while the import is the last thing done.
  const [typedSince, setTypedSince] = useState(false);
  const [notice, setNotice] = useState<string>();
  const lastTyped = useRef(0), timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const bring = (from: Write) => {
    const api = c.api.current!;
    const m = threeWay(api.doc(), from.origin, from.theirs);
    api.bring(m, from.source);
    setImportedOnce(true); setTypedSince(false); setNotice(undefined);
    return m;
  };
  const importNow = () => {
    const p = pendingRef.current, w = writeRef.current;
    window.clearTimeout(timer.current);
    if (!p || !w) return undefined;
    setPending(undefined);
    setBase({content: p.disk.content, version: p.disk.version});
    return bring(w);
  };
  const schedule = () => {
    const p = pendingRef.current;
    if (!p) return;
    window.clearTimeout(timer.current);
    const due = Math.max(lastTyped.current, p.at) + c.pause;
    timer.current = window.setTimeout(importNow, Math.max(0, due - Date.now()));
  };
  // Detection: a write by anyone else than this editor.
  useEffect(() => {
    const d = c.disk;
    if (d.version === base.version || d.by === 'you') return;
    const doc = c.api.current?.doc() ?? c.buffer;
    // A clean editor simply follows the disk.
    if (doc === base.content) { setBase({...d}); c.setBuffer(d.content); setRevision(r => r + 1); return; }
    const m = threeWay(doc, base.content, d.content);
    setWrite({origin: base.content, theirs: d.content, source: c.source});
    writeRef.current = {origin: base.content, theirs: d.content, source: c.source};
    setPending({disk: d, origin: base.content, count: m.agent.length + m.conflicts.length, at: Date.now()});
    if (look === 2) c.api.current?.showPending(landing(doc, base.content, d.content), c.source);
    setNotice(undefined);
    schedule();
  }, [c.disk.version]);

  const onChange = (s: string, m: MergeState, typed: boolean) => {
    c.setBuffer(s); setMerge(m);
    if (!typed) return;
    setNotice(undefined); setTypedSince(true);
    lastTyped.current = Date.now();
    schedule();
  };
  const conflicts = merge.conflicts.length;
  const dirty = c.buffer !== base.content;
  const agentWho = c.source === 'agent';
  const undone = importedOnce && !merge.imported && !pending && dirty && write !== undefined;

  const save = () => {
    const api = c.api.current!;
    // Save is the latest moment the waiting changes come in.
    if (pendingRef.current) {
      const m = importNow();
      if (m?.conflicts.length) return;
    }
    if (api.merge().conflicts.length) return;
    const text = api.doc(), w = writeRef.current;
    const d = c.write(text);
    setBase(d); api.clear();
    const lost = w ? replaced(text, w.origin, w.theirs) : [];
    if (lost.length && w?.source === 'agent') c.addNote(lost);
    setNotice(!w ? 'Tallennettu.'
      : !lost.length ? `Tallennettu. Tiedostossa ovat nyt sekä sinun että ${w.source === 'agent' ? 'agentin' : 'levyllä tehdyt'} muutokset.`
      : w.source === 'agent' ? `Tallennettu. ${count(lost.length, 'agentin muutos korvattiin', 'agentin muutosta korvattiin')} sinun tekstilläsi; keskustelussa on siitä merkintä.`
      : `Tallennettu. ${count(lost.length, 'levyllä tehty muutos korvattiin', 'levyllä tehtyä muutosta korvattiin')} sinun tekstilläsi.`);
    setWrite(undefined); setImportedOnce(false);
  };

  const them = agentWho ? 'agentin' : 'levyn';
  const changesWaiting = pending && count(pending.count, 'muutos odottaa', 'muutosta odottaa');
  const undoButton = merge.imported && !typedSince
    ? <Button data-testid="undo-import" size="row" variant="quiet" onPress={() => c.api.current?.undo()}>Peru tuonti</Button> : undefined;
  const redoButton = <Button data-testid="redo-import" size="row" variant="secondary" onPress={() => write && bring(write)}>Tuo uudelleen</Button>;
  const importButton = <Button data-testid="import-now" size="row" variant="quiet" onPress={importNow}>Tuo nyt</Button>;

  // Loud: every state says itself in a notice under the toolbar.
  const loud = look === 0 ? (
    pending ? <Banner tone="info" testid="pending-banner" title={agentWho ? `Agentti muutti tätä tiedostoa ${AT}.` : `Tiedosto muuttui levyllä ${AT}.`} actions={importButton}>
        <p>{changesWaiting} — tuodaan, kun lopetat kirjoittamisen.</p></Banner>
    : conflicts && merge.imported ? <Banner tone="risk" testid="import-banner" title={agentWho ? `Agentti muutti samoja rivejä kuin sinä: ${count(conflicts, 'kohta', 'kohtaa')}.` : `Levyllä muuttuivat samat rivit kuin sinulla: ${count(conflicts, 'kohta', 'kohtaa')}.`} actions={undoButton}>
        <p>Muut muutokset tuotiin tekstiisi. Valitse kunkin kohdan yläpuolelta, mikä jää. Ctrl+Z peruu koko tuonnin.</p></Banner>
    : merge.imported ? <Banner tone="info" testid="import-banner" title={`${count(merge.count, `${them} muutos tuotiin`, `${them} muutosta tuotiin`)} tekstiisi.`} actions={undoButton}>
        <p>{agentWho ? 'Agentin' : 'Levyn'} rivit on korostettu. Omat muutoksesi pysyivät. Tallenna kirjoittaa levylle kaiken, mitä editorissa näkyy. Ctrl+Z peruu tuonnin.</p></Banner>
    : undone ? <Banner tone="risk" testid="import-undone" title={agentWho ? 'Agentin muutoksia ei ole tekstissäsi.' : 'Levyn muutoksia ei ole tekstissäsi.'} actions={redoButton}>
        <p>{agentWho ? 'Levyllä on agentin versio. Tallennus korvaa sen sinun tekstilläsi, ja keskusteluun jää siitä merkintä.' : 'Levyllä on uudempi versio. Tallennus korvaa sen sinun tekstilläsi.'}</p></Banner>
    : undefined) : undefined;
  const banner = loud ?? (notice ? <Banner tone="ok" testid="saved-banner" title={notice}/> : undefined);

  // Quiet: the waiting state is a chip where the one-word status usually is.
  const status = look === 0
    ? (conflicts ? `Muokattu · ${count(conflicts, 'ristiriita', 'ristiriitaa')}` : dirty ? 'Muokattu' : '')
    : pending ? <span className="cfe-chip" data-testid="pending-chip">
        <span className="cfe-dot" aria-hidden="true"/>
        <span>{agentWho ? 'Agentin' : 'Levyn'} {changesWaiting}</span>
        <Button data-testid="import-now" size="row" variant="quiet" onPress={importNow} aria-label={`Tuo nyt: ${changesWaiting}; muuten ne tuodaan, kun lopetat kirjoittamisen`}>Tuo nyt</Button>
      </span>
    : merge.imported ? <span className="cfe-chip" data-testid="imported-chip">
        <span>{conflicts ? `Muokattu · ${count(conflicts, 'ristiriita', 'ristiriitaa')}` : `Muokattu · ${count(merge.count, `${them} muutos tuotu`, `${them} muutosta tuotu`)}`}</span>{undoButton}
      </span>
    : undone ? <span className="cfe-chip cfe-chip-risk" data-testid="import-undone"><span>Muokattu · ilman {them} muutoksia</span>{redoButton}</span>
    : dirty ? 'Muokattu' : '';

  return <ProtoEditor path={PATH} content={c.buffer} revision={revision} directories={directories} picker={c.picker} onPicker={() => c.setPicker(!c.picker)}
    status={status}
    saveLabel={undone ? (agentWho ? 'Tallenna ja korvaa agentin versio' : 'Tallenna ja korvaa levyn versio') : 'Tallenna'}
    saveVariant={undone ? 'danger' : 'secondary'}
    saveDisabled={!dirty || conflicts > 0}
    // Ilmoitus already says this in its notice.
    saveReason={conflicts && look !== 0 ? `Tallennus odottaa: valitse ${count(conflicts, 'ristiriitaiselle riville', 'ristiriitaiselle riville')} Sinun, ${agentWho ? 'Agentin' : 'Levyn'} tai Molemmat.` : undefined}
    onSave={save} onChange={onChange} busy={false} api={c.api} renderConflict={renderConflict} banner={banner}/>;
}

// ---------- Conversation ----------

const draftFor = (note: Note) =>
  `Korvasin tallentaessani muutoksesi tiedostossa ${PATH}. Nämä eivät ole enää tiedostossa:\n${note.lines.map(l => `- rivi ${l.line}: \`${l.theirs.filter(Boolean).join(' / ') || '(poisto)'}\``).join('\n')}\nTiedostossa on nyt minun versioni. Älä palauta näitä kysymättä.`;

function Conversation({overlap, source, wrote, notes, draft, setDraft, sent, send}: {overlap: Overlap; source: Source; wrote: boolean; notes: Note[]; draft: string; setDraft: (s: string) => void; sent: string[]; send: (s: string) => void}) {
  const tell = (n: Note) => {
    setDraft(draftFor(n));
    requestAnimationFrame(() => document.querySelector<HTMLElement>('.cfe-convo [data-testid=composer-input], .cfe-convo textarea, .cfe-convo [contenteditable=true]')?.focus());
  };
  return <aside className="cfe-convo" aria-label="Keskustelu">
    <div className="cfe-convo-scroll">
      <div className="cfe-msg cfe-user"><p>{overlap === 'separate' ? 'Lisää asennusohjeeseen Debian 13 ja päivitysohje.' : 'Lisää asennusohjeeseen virtuaalikone, Debian 13 ja levytilavaatimus.'}</p></div>
      <div className="cfe-msg cfe-agent"><p>Päivitän tiedoston <code>{PATH}</code>.</p>
        {wrote ? <>{source === 'agent'
            ? <div className="cfe-tool" data-testid="agent-tool"><small>edit · {AT}</small><FileToolCard name="edit" argumentsText={JSON.stringify({path: PATH, edits: AGENT_EDITS[overlap]})} output="Successfully replaced text."/></div>
            : <div className="cfe-tool" data-testid="agent-tool"><small>bash · {AT}</small><pre className="cfe-bash">{BASH[overlap]}</pre></div>}
          <p>{overlap === 'separate' ? 'Lisäsin Debian 13:n ja Päivitys-osion.' : 'Lisäsin virtuaalikoneen, Debian 13:n ja levytilavaatimuksen.'}</p></>
          : <p className="cfe-typing"><Icon name="thinking"/>Agentti työskentelee…</p>}
      </div>
      {notes.map(n => <div key={n.id} className="cfe-note" data-testid="replace-note" role="note">
        <p className="cfe-note-head"><Icon name="info"/><strong>Korvasit agentin muutoksia</strong><small>{n.at}</small></p>
        <p>Tallensit tiedoston <code>{PATH}</code> omalla tekstilläsi. {n.lines.length === 1 ? 'Tämä agentin muutos ei ole enää tiedostossa:' : 'Nämä agentin muutokset eivät ole enää tiedostossa:'}</p>
        <ul>{n.lines.map(l => <li key={l.line}>rivi {l.line}: <code>{l.theirs.filter(Boolean).join(' / ') || '(poisto)'}</code></li>)}</ul>
        <div className="cfe-note-foot"><small>Vain sinä näet tämän. Agentti ei tiedä korvauksesta, ellet kerro.</small>
          <Button data-testid="tell-agent" size="row" variant="secondary" onPress={() => tell(n)}><Icon name="message"/>Kerro agentille</Button></div>
      </div>)}
      {sent.map((s, i) => <div key={i} className="cfe-msg cfe-user" data-testid="sent"><p>{s}</p></div>)}
    </div>
    <div className="cfe-composer">
      <Composer value={draft} onChange={setDraft} activity="idle" selectedWorkingMode="steer" onModeChange={() => {}}
        onSendNow={t => send(t ?? draft)} onSteer={t => send(t ?? draft)} onFollowUp={t => send(t ?? draft)}/>
    </div>
  </aside>;
}

// ---------- Review frame ----------

function Inspector({overlap, disk, buffer}: {overlap: Overlap; disk: Disk; buffer: string}) {
  const rows = CHANGES.filter(c => !c.only || c.only === overlap);
  const mark = (t: string, m: string) => t.includes(m) ? <span className="cfe-yes" data-on="1"><Icon name="check"/><span className="sr">mukana</span></span> : <span className="cfe-no">–</span>;
  return <section className="cfe-inspector" data-testid="inspector" aria-label="Arvioijan apu">
    <p className="eyebrow">Arvioijan apu · ei osa tuotetta</p>
    <table><thead><tr><th>Muutos</th><th>Levyllä</th><th>Editorissa</th></tr></thead><tbody>
      {rows.map(r => <tr key={r.mark} data-testid={`inspect-${r.who}`}><td>{r.who === 'agent' ? 'Agentti' : 'Sinä'}: {r.label}</td><td data-testid="on-disk">{mark(disk.content, r.mark)}</td><td data-testid="in-editor">{mark(buffer, r.mark)}</td></tr>)}
    </tbody></table>
    <p className="muted">Levyllä: {disk.by === 'start' ? 'alkuperäinen' : disk.by === 'agent' ? 'agentin tallennus' : 'sinun tallennuksesi'} · versio {disk.version}</p>
  </section>;
}

type Settings = {theme: string; phone: boolean; overlap: Overlap; source: Source; pause: string};
const review: Settings = {theme: 'light', phone: false, overlap: 'separate', source: 'agent', pause: '2'};
function App({direction}: {direction: number}) {
  const [s, setS] = useState<Settings>({...review});
  const set = (p: Partial<Settings>) => { Object.assign(review, p); setS({...review}); };
  const [run, setRun] = useState(0);
  return <div data-theme={s.theme} className={s.phone ? 'review phone' : 'review'}>
    <header className="reviewbar"><strong>Rinnakkainen muokkaus · kierros 2</strong>
      <label>Teema <select id="theme" value={s.theme} onChange={e => set({theme: e.target.value})}><option value="light">Vaalea</option><option value="dark">Tumma</option></select></label>
      <label><input id="phone" type="checkbox" checked={s.phone} onChange={e => set({phone: e.target.checked})}/> 390 px</label>
      <p>Synteettiset tiedot. Ei yhteyttä palvelimeen.</p></header>
    <p className="axis">Agentti tallentaa tiedoston, kun kirjoitat siihen. Muutos huomataan heti, mutta se tuodaan tekstiisi vasta kirjoitustauon jälkeen tai viimeistään Tallenna-painalluksella. Kolme tapaa näyttää odottava muutos: ilmoitus, hiljainen merkki ja rivimerkit tekstissä. Suositus: Rivimerkit ja 2 s:n tauko.</p>
    <Scenario key={`${s.overlap}|${s.source}|${s.pause}|${run}|${s.phone}`} direction={direction} settings={s}
      controls={<>
        <Segmented data-testid="overlap" label="Agentin muutos" size="row" value={s.overlap} onChange={v => set({overlap: v})}
          options={[{id: 'separate', label: 'Eri riveille'}, {id: 'same', label: 'Samoille riveille'}]}/>
        <Segmented data-testid="source" label="Muutoksen tapa" size="row" value={s.source} onChange={v => set({source: v})}
          options={[{id: 'agent', label: 'Agentin työkalu'}, {id: 'disk', label: 'Bash tai SSH'}]}/>
        <Segmented data-testid="pause" label="Kirjoitustauko" size="row" value={s.pause} onChange={v => set({pause: v})}
          options={[{id: '1', label: '1 s'}, {id: '2', label: '2 s'}, {id: '4', label: '4 s'}]}/>
        <Button data-testid="restart" size="row" variant="quiet" onPress={() => setRun(r => r + 1)}>Aloita alusta</Button>
      </>}/>
  </div>;
}

function Scenario({direction, settings, controls}: {direction: number; settings: Settings; controls: ReactNode}) {
  const {overlap, source, phone} = settings;
  const [disk, setDisk] = useState<Disk>({content: BASE, version: 1, by: 'start'});
  const diskRef = useRef(disk); diskRef.current = disk;
  const [buffer, setBuffer] = useState(MINE);
  // Production hides the tree after opening a file on a narrow screen.
  const [picker, setPicker] = useState(!phone && window.innerWidth > 800);
  const api = useRef<EditorApi>();
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState(''), [sent, setSent] = useState<string[]>([]);
  const write = (content: string) => { const d: Disk = {content, version: diskRef.current.version + 1, by: 'you'}; diskRef.current = d; setDisk(d); return d; };
  const [wrote, setWrote] = useState(false), [typing, setTyping] = useState(false);
  const agentWrite = () => { setWrote(true); const d: Disk = {content: THEIRS[overlap], version: diskRef.current.version + 1, by: 'agent'}; diskRef.current = d; setDisk(d); };
  const typer = useRef<number>();
  useEffect(() => () => window.clearInterval(typer.current), []);
  // Review aid: the person keeps typing at the end of line 3 for a few
  // seconds, and the agent saves 0.8 s in.
  const typeAndWrite = () => {
    setTyping(true);
    let k = 0;
    const started = Date.now();
    typer.current = window.setInterval(() => {
      if (!wrote && Date.now() - started > 800 && diskRef.current.by !== 'agent') agentWrite();
      if (k >= TYPED.length) { window.clearInterval(typer.current); setTyping(false); return; }
      api.current?.type(3, TYPED[k++]);
    }, 110);
  };
  const c: Ctx = {overlap, source, pause: Number(settings.pause) * 1000, disk, diskRef, write, buffer, setBuffer, picker, setPicker, api,
    addNote: lines => setNotes(n => [...n, {id: n.length + 1, at: SAVED_AT, lines}])};
  const convo = <Conversation overlap={overlap} source={source} wrote={wrote} notes={notes} draft={draft} setDraft={setDraft} sent={sent}
    send={t => { if (t.trim()) { setSent(s => [...s, t]); setDraft(''); } }}/>;
  return <>
    <div className="scenario">
      <div className="steps"><span className="step-n">1</span><span>Editorissa on kaksi tallentamatonta muutosta (rivit 3 ja 9).</span>
        <span className="step-n">2</span>
        <Button data-testid="type-and-write" size="row" variant="primary" isDisabled={wrote || typing} onPress={typeAndWrite}><Icon name="pencil"/>Kirjoita, ja agentti tallentaa kesken</Button>
        <Button data-testid="agent-write" size="row" variant="quiet" isDisabled={wrote} onPress={agentWrite}><Icon name="agent"/>Agentti tallentaa</Button>
        <span className="step-n">3</span><span>Pysähdy, jatka kirjoittamista tai tallenna.</span></div>
      <div className="steps">{controls}</div>
      <Inspector overlap={overlap} disk={disk} buffer={buffer}/>
    </div>
    <div className={`shell variant-${direction}`}>
      <div className="ah-editor-split ah-editor-open">
        <section className="ah-editor-pane cfe-pane">
          <EditorHeader title="Tekstieditori" collapsed={phone || window.innerWidth <= 800} onToggleCollapsed={() => {}} onClose={() => {}}/>
          <ImportAfterPause c={c} look={direction as Look}/>
        </section>
        {!phone && convo}
      </div>
    </div>
    {phone && <div className="shell-convo"><p className="cfe-review-note">Puhelimessa editori on koko ikkunan tilassa; keskustelu on sen takana, tässä alla.</p>{convo}</div>}
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
directions.forEach((name, i) => { const button = document.createElement('button'); button.className = 'proto-picker-item'; button.textContent = name.replaceAll(' ', ' '); if (i === 0) { button.setAttribute('data-active', ''); button.setAttribute('aria-current', 'true'); } picker.append(button); });
document.body.append(picker);
new Function('stage', 'variants', pickerSource)(stageSink, variants);
