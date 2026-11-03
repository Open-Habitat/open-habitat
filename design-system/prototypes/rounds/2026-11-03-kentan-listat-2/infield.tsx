// The composer with its list inside the field box (Kentän sisällä, Jari
// 3.11.). The box, the row, the buttons and the list rows are production's
// markup and CSS (composer.css: .ah-cbox, .ah-crow, .ah-choice-*, .ah-pal-*),
// and the text rules are production's (completion.ts). What is new is round
// state: one list that does what today's caret list, button lists and the
// Ctrl/⌘+P palette do together, so no dialog opens over the conversation.
// The three directions differ in how that list is laid out.
import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {GitMark} from '../../../../web/src/app/composerReads';
import {Icon} from '../../../../web/src/components/Icon';
import {AttachmentMenu} from '../../../../web/src/components/composer/AttachmentMenu';
import {GitBadge} from '../../../../web/src/components/composer/ChoiceList';
import {caretToken, fileInsertion, fuzzyScore, isShell, shellExcluded, withLeadingCommand} from '../../../../web/src/components/composer/completion';
import {COMMANDS, DIRS, FILES, WORKSPACE, previewOf} from './data';

export type Load = 'ready' | 'slow' | 'failed';
export const LIST = 1, TREE = 2, TABS = 3;
type Kind = 'cmd' | 'file';
type Open = {
  from: 'button' | 'caret';
  kind: Kind;
  /** The text range the choice replaces or is inserted at. */
  start: number; end: number;
  /** A typed token carried into the search (Ctrl/⌘+P): accepting replaces it. */
  replace: boolean;
  query: string;
  sel: number;
  /** Marked paths in marking order; a folder ends with a slash. */
  marks: string[];
  /** The folder the list is in (Hakulista's scope, Kansiopuu's folder). */
  cwd: string;
  /** Only changed files (Hakulista's chip, Välilehdet's tab). */
  changed: boolean;
  atStart: boolean;
};
type Row =
  | {type: 'status'; text: string; loading?: boolean}
  | {type: 'dir'; path: string; label: string; changed: number}
  | {type: 'file'; path: string; label: string; git?: GitMark}
  | {type: 'cmd'; name: string; description: string; tag: string; tone: string};
type Group = {label: string; rows: Row[]};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';
const pickable = (r?: Row) => !!r && r.type !== 'status';
const sources = {skill: 'Taito', prompt: 'Pohja', extension: 'Laajennus'} as const;
const scopes = {user: 'oma', project: 'projekti', builtin: 'sisäänrakennettu'} as const;
const changedUnder = (dir: string) => FILES.filter((f) => f.git && f.path.startsWith(dir)).length;
/** Kansiopuu's virtual folder of changed files. */
const CHANGED = ':muutetut';
const parent = (dir: string) => dir.replace(/[^/]+\/$/, '');
const terms = (q: string) => q.split(/\s+/).filter(Boolean);
/** The daemon's match: every whitespace-separated term must match. */
const score = (text: string, q: string) => {
  let s = 0;
  for (const t of terms(q)) { const v = fuzzyScore(text, t); if (v <= 0) return 0; s += v; }
  return s || 1;
};

/** The caret's line top within the field, as the field shows it now. */
function caretTop(field: HTMLTextAreaElement, pos: number) {
  const style = getComputedStyle(field);
  const mirror = document.createElement('div');
  for (const k of ['font', 'letterSpacing', 'padding', 'border', 'boxSizing', 'lineHeight'] as const) mirror.style[k] = style[k];
  Object.assign(mirror.style, {position: 'absolute', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', width: `${field.clientWidth}px`, top: '0', left: '0'});
  mirror.textContent = field.value.slice(0, pos);
  const mark = document.createElement('span');
  mark.textContent = '​';
  mirror.appendChild(mark);
  field.parentElement?.appendChild(mirror);
  const y = mark.offsetTop;
  mirror.remove();
  return {y, line: parseFloat(style.lineHeight) || 22, pad: parseFloat(style.paddingTop) || 0};
}

/** The list's rows for a direction. Files and commands come from the
 * synthetic workspace through the same matching the host does. */
function groupsFor(dir: number, o: Open, load: {cmd: Load | 'loading'; file: Load | 'loading'}, shell: boolean): Group[] {
  if (o.kind === 'cmd') {
    if (load.cmd !== 'ready') return [{label: 'Agentti', rows: [load.cmd === 'failed'
      ? {type: 'status', text: 'Agentin komentoja ei saatu. Kirjoita komento itse.'}
      : {type: 'status', text: 'Haetaan agentin komennot ja taidot työtilasta…', loading: true}]}];
    const hits = COMMANDS.filter((c) => !c.terminal_only)
      .map((c) => ({c, s: Math.max(fuzzyScore(c.name, o.query), fuzzyScore(c.description, o.query) * 0.4)}))
      .filter((x) => x.s > 0).sort((a, b) => b.s - a.s)
      .map(({c}): Row => ({type: 'cmd', name: c.name, description: c.description, tag: `${sources[c.source]} · ${scopes[c.scope]}`, tone: c.source}));
    // Kansiopuu sorts commands the way it sorts files: by where they come from.
    if (dir === TREE && !o.query) return (['skill', 'prompt', 'extension'] as const).map((s) => ({
      label: {skill: 'Taidot', prompt: 'Pohjat', extension: 'Laajennukset'}[s],
      rows: hits.filter((r) => r.type === 'cmd' && r.tone === s),
    }));
    const runs = o.from === 'button' || o.atStart;
    return [{label: runs ? 'Agentti · lisätään viestin alkuun, ajetaan lähetettäessä' : 'Agentti · mainitaan tekstinä', rows: hits}];
  }
  if (load.file !== 'ready') return [{label: 'Tiedostot', rows: [load.file === 'failed'
    ? {type: 'status', text: 'Tiedostolistaa ei saatu juuri nyt.'}
    : {type: 'status', text: 'Haetaan tiedostoja…', loading: true}]}];
  // Kansiopuu reads a typed path as folders: @src/as is "as" inside src/.
  let cwd = o.cwd, q = o.query;
  if (dir === TREE) {
    const slash = q.lastIndexOf('/');
    if (slash >= 0) { cwd = cwd + q.slice(0, slash + 1); q = q.slice(slash + 1); }
  }
  const rel = (p: string) => (dir === TREE || dir === LIST ? p.slice(cwd.length) : p);
  const files = FILES.filter((f) => f.path.startsWith(cwd) && (!o.changed || f.git));
  if (!q) {
    if (dir === TREE && o.changed) return [{label: '', rows: files.map((f): Row => ({type: 'file', path: f.path, label: f.path, git: f.git}))}];
    if (dir === TREE) {
      // At the top, today's changed-files list is one more folder.
      const changed: Row[] = cwd ? [] : [{type: 'dir', path: CHANGED, label: 'Muutetut', changed: changedUnder('')}];
      const sub = DIRS.filter((d) => d.startsWith(cwd) && d !== cwd && !d.slice(cwd.length, -1).includes('/'));
      const here = files.filter((f) => !f.path.slice(cwd.length).includes('/'));
      return [{label: '', rows: [
        ...changed,
        ...sub.map((d): Row => ({type: 'dir', path: d, label: rel(d), changed: changedUnder(d)})),
        ...here.map((f): Row => ({type: 'file', path: f.path, label: rel(f.path), git: f.git})),
      ]}];
    }
    return [{label: o.changed ? 'Muutetut' : 'Tiedostot', rows: files.map((f): Row => ({type: 'file', path: f.path, label: rel(f.path), git: f.git}))}];
  }
  const dirs = o.changed || shell ? [] : DIRS.filter((d) => d.startsWith(cwd) && d !== cwd)
    .map((d) => ({d, s: score(d.slice(cwd.length), q)})).filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s).slice(0, 3)
    .map(({d}): Row => ({type: 'dir', path: d, label: rel(d), changed: changedUnder(d)}));
  const hits = files.map((f) => ({f, s: score(f.path.slice(cwd.length), q)})).filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map(({f}): Row => ({type: 'file', path: f.path, label: rel(f.path), git: f.git}));
  return [{label: 'Osumat', rows: hits}, {label: 'Kansiot', rows: dirs}];
}

function Preview({row}: {row?: Row}) {
  if (!row || row.type === 'status') return <p className="ah-pal-none">Ei valittua.</p>;
  if (row.type === 'cmd') return (
    <>
      <h2>/{row.name}</h2>
      <p>{row.description}</p>
      <dl><dt>Lähde</dt><dd>{row.tag}</dd></dl>
      <p className="ah-pal-explain">{row.tone === 'skill'
        ? 'Lisätään viestin alkuun. Kun lähetät viestin, agentti lataa taidon.'
        : row.tone === 'prompt' ? 'Lisätään viestin alkuun. Kun lähetät viestin, agentti laajentaa pohjan.'
          : 'Lisätään viestin alkuun. Kun lähetät viestin, agentti ajaa komennon.'}</p>
    </>
  );
  const p = previewOf(row.path);
  return (
    <>
      <h2 className="ah-pal-mono">{row.path} {row.type === 'file' && row.git ? <GitBadge mark={row.git} /> : null}</h2>
      {p.kind === 'binary' ? <p className="ah-pal-none">Binääritiedosto: ei esikatselua.</p>
        : p.kind === 'dir' ? <pre className="kl-dirprev">{p.text}</pre>
          : <pre className={p.kind === 'diff' ? 'ah-pal-diff' : undefined}>{p.kind === 'diff'
            ? p.text.split('\n').map((l, i) => <span key={i} className={l.startsWith('+') ? 'ah-pal-add' : l.startsWith('-') ? 'ah-pal-del' : undefined}>{l}{'\n'}</span>)
            : p.text}</pre>}
    </>
  );
}

export function InfieldComposer({dir, value, onChange, load, modelPicker, autoOpen}: {
  dir: number;
  value: string;
  onChange: (v: string) => void;
  load: Load;
  modelPicker: React.ReactNode;
  /** Opens this list from its button once mounted (the review's default view). */
  autoOpen?: Kind;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const lastCaret = useRef<[number, number] | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [notice, setNotice] = useState('');
  const listId = 'kl-list';
  const shell = isShell(value);

  // ---- the sources: read when a list of that kind opens ----
  const [loaded, setLoaded] = useState<{cmd: Load | 'loading'; file: Load | 'loading'}>({cmd: 'loading', file: 'loading'});
  const kind = open?.kind;
  useEffect(() => {
    if (!kind || loaded[kind] !== 'loading') return;
    const id = setTimeout(() => setLoaded((l) => ({...l, [kind]: load === 'failed' ? 'failed' : 'ready'})), load === 'slow' ? 1600 : 60);
    return () => clearTimeout(id);
  }, [kind, loaded, load]);
  useEffect(() => setLoaded({cmd: 'loading', file: 'loading'}), [load]);

  const groups = useMemo(() => (open ? groupsFor(dir, open, loaded, shell) : []), [dir, open, loaded, shell]);
  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const sel = open && open.sel >= 0 && !pickable(flat[open.sel]) ? flat.findIndex(pickable) : (open?.sel ?? -1);
  const row = sel >= 0 ? flat[sel] : undefined;

  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(id); }, [notice]);
  useEffect(() => { if (sel >= 0) document.getElementById(`${listId}-opt-${sel}`)?.scrollIntoView?.({block: 'nearest'}); }, [sel, open?.cwd, open?.query]);

  // ---- the text shrinks to the caret's lines while a list is open ----
  const isOpen = !!open;
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    const at = open ? open.start : el.selectionStart;
    const c = caretTop(el, at);
    el.scrollTop = open ? Math.max(0, c.y - c.line - c.pad) : Math.max(0, c.y - el.clientHeight + 2 * c.line);
    box.current!.dataset.clipped = String(open ? el.scrollTop > 0 : false);
  }, [isOpen, open?.start]);

  // ---- inserting ----
  const replaceRange = (start: number, end: number, text: string) => {
    const el = field.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(start, end);
    if (!document.execCommand?.('insertText', false, text)) {
      onChange(el.value.slice(0, start) + text + el.value.slice(end));
      requestAnimationFrame(() => field.current?.setSelectionRange(start + text.length, start + text.length));
    }
  };
  const close = (refocus: boolean) => {
    const had = open;
    setOpen(null);
    if (!refocus || !had || !field.current) return;
    const el = field.current;
    el.focus();
    const at = had.from === 'caret' || had.replace ? had.end : had.start;
    el.setSelectionRange(at, had.from === 'caret' ? at : had.end);
  };
  const enterDir = (o: Open, path: string) => {
    if (path === CHANGED) { setOpen({...o, changed: true, cwd: '', query: o.from === 'caret' ? o.query : '', sel: 0}); return search.current?.focus(); }
    if (o.from === 'caret') return replaceRange(o.start, o.end, `@${path}`);
    if (dir === TABS) setOpen({...o, query: path, sel: 0});
    else setOpen({...o, cwd: path, query: '', sel: 0});
    search.current?.focus();
  };
  const accept = (index: number) => {
    const o = open;
    if (!o) return;
    const r = flat[index];
    if (!o.marks.length && r?.type === 'dir') return enterDir(o, r.path);
    if (!o.marks.length && (!r || r.type === 'status')) return;
    setOpen(null);
    if (r?.type === 'cmd' && !o.marks.length) {
      if (o.from === 'caret') return replaceRange(o.start, o.end, `/${r.name} `);
      const lead = withLeadingCommand(value, r.name);
      return replaceRange(lead.start, lead.end, lead.insert);
    }
    const paths = o.marks.length ? o.marks : r && r.type === 'file' ? [r.path] : [];
    const text = fileInsertion(paths, shell);
    if (o.from === 'caret' || o.replace) return replaceRange(o.start, o.end, text);
    const pad = o.start > 0 && !/\s/.test(value[o.start - 1]) ? ' ' : '';
    replaceRange(o.start, o.end, pad + text);
  };
  const toggleMark = (index: number, advance: boolean) => {
    if (!open) return;
    const r = flat[index];
    if ((r?.type !== 'file' && r?.type !== 'dir') || r.path === CHANGED) return;
    const marks = open.marks.includes(r.path) ? open.marks.filter((m) => m !== r.path) : [...open.marks, r.path];
    let i = index;
    if (advance) { do i = (i + 1) % flat.length; while (!pickable(flat[i]) && i !== index); }
    setOpen({...open, marks, sel: i});
  };
  const move = (d: number) => {
    if (!open || !flat.some(pickable)) return;
    const n = flat.length;
    let i = sel < 0 ? (d > 0 ? -1 : n) : sel;
    do i = (i + d + n) % n; while (!pickable(flat[i]));
    setOpen({...open, sel: i});
  };

  // ---- opening ----
  const fieldCaret = (): [number, number] => {
    const el = field.current;
    if (el && document.activeElement === el) return [el.selectionStart, el.selectionEnd];
    return lastCaret.current ?? [value.length, value.length];
  };
  const base = {replace: false, query: '', sel: 0, marks: [], cwd: '', changed: false, atStart: true};
  const fromButton = (k: Kind) => {
    if (open?.from === 'button' && open.kind === k) return close(true);
    // From one list to the other keeps the place in the text.
    const [start, end] = open ? [open.start, open.end] : fieldCaret();
    setOpen({...base, from: 'button', kind: k, start, end, replace: !!open?.replace});
  };
  /** Ctrl/⌘+P: the search with several files, here in the field. A typed
   * @token goes with it. */
  const toSearch = () => {
    const fromCaret = open?.from === 'caret' && open.kind === 'file';
    const [s, e] = fieldCaret();
    setOpen({...base, from: 'button', kind: 'file', start: fromCaret ? open.start : s, end: fromCaret ? open.end : e, replace: fromCaret, query: fromCaret ? open.query : ''});
  };
  const fromText = (text: string, caret: number) => {
    if (open?.from === 'button') return;
    const t = caretToken(text, caret);
    if (!t) { if (open) setOpen(null); return; }
    const same = open?.from === 'caret' && open.kind === t.kind && open.start === t.start;
    setOpen({...base, from: 'caret', ...t, replace: true, marks: [], changed: same ? open.changed : false, sel: same ? open.sel : t.kind === 'cmd' && !t.atStart ? -1 : 0});
  };
  useEffect(() => {
    if (!autoOpen) return;
    const id = setTimeout(() => {
      const el = field.current!;
      el.setSelectionRange(el.value.length, el.value.length);
      lastCaret.current = [el.value.length, el.value.length];
      el.scrollTop = el.scrollHeight;
      fromButton(autoOpen);
    }, 80);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A button's list closes on a press outside the composer.
  useEffect(() => {
    if (open?.from !== 'button') return;
    const down = (e: MouseEvent) => { if (!box.current?.closest('.ah-composer')?.contains(e.target as Node)) setOpen(null); };
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, [open?.from]);
  useEffect(() => { if (open?.from === 'button') search.current?.focus(); }, [open?.from, open?.kind]);

  // ---- keys ----
  const mod = (e: React.KeyboardEvent) => (isMac ? e.metaKey : e.ctrlKey) && !e.shiftKey && !e.altKey;
  const onFieldKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mod(e) && e.code === 'KeyP') { e.preventDefault(); return toSearch(); }
    if (e.nativeEvent.isComposing) return;
    if (open?.from === 'caret') {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); return move(e.key === 'ArrowDown' ? 1 : -1); }
      if (e.key === 'Escape') { e.preventDefault(); return setOpen(null); }
      if ((e.key === 'Enter' && !e.shiftKey && sel >= 0) || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        return accept(sel < 0 ? Math.max(0, flat.findIndex(pickable)) : sel);
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setNotice('Prototyyppi ei lähetä viestiä.'); }
  };
  const tabsOrder: [Kind, boolean][] = [['file', false], ['file', true], ['cmd', false]];
  const listKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || e.nativeEvent.isComposing) return;
    const input = e.currentTarget;
    const atEnd = input.selectionStart === input.value.length;
    if (mod(e) && e.code === 'KeyP') {
      e.preventDefault();
      if (dir === TABS) {
        const i = tabsOrder.findIndex(([k, c]) => k === open.kind && c === open.changed);
        const [k, c] = tabsOrder[(i + 1) % 3];
        return setOpen({...open, kind: k, changed: c, sel: 0});
      }
      return setOpen({...open, kind: open.kind === 'cmd' ? 'file' : 'cmd', query: '', cwd: '', sel: 0});
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); return move(e.key === 'ArrowDown' ? 1 : -1); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(true); }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      if (open.kind === 'file') return toggleMark(sel, true);
      return accept(sel);
    }
    if (e.key === 'Enter') { e.preventDefault(); return accept(sel); }
    if (e.key === 'ArrowRight' && atEnd && dir !== TABS && row?.type === 'dir') { e.preventDefault(); return enterDir(open, row.path); }
    if ((e.key === 'Backspace' || (e.key === 'ArrowLeft' && dir === TREE)) && !open.query && (open.cwd || (dir === TREE && open.changed))) {
      e.preventDefault();
      if (dir === TREE && open.changed) return setOpen({...open, changed: false, sel: 0});
      return setOpen({...open, cwd: dir === TREE ? parent(open.cwd) : '', sel: 0});
    }
  };

  // ---- the list ----
  const marks = open?.marks ?? [];
  const fileList = open?.kind === 'file';
  const head = !open ? '' : open.kind === 'cmd'
    ? (open.from === 'button' || open.atStart ? 'Komennot ja taidot' : 'Mainitse komento: agentti ajaa komennon vain viestin alussa')
    : shell ? 'Tiedostot · lisätään komentoon polkuna' : `Tiedostot · ${WORKSPACE}`;
  const cwdShown = open && dir === TREE && fileList
    ? open.cwd + (open.query.includes('/') ? open.query.slice(0, open.query.lastIndexOf('/') + 1) : '')
    : '';
  const crumbs = (
    <nav className="kl-crumbs" aria-label="Kansio">
      {[{p: '', label: WORKSPACE}, ...(open?.changed ? [{p: CHANGED, label: 'Muutetut'}]
        : cwdShown.split('/').filter(Boolean).map((name, i, a) => ({p: `${a.slice(0, i + 1).join('/')}/`, label: name})))].map(({p, label}, i, all) => (
        <React.Fragment key={p}>
          {i ? <span className="kl-crumb-sep" aria-hidden="true">›</span> : null}
          <button type="button" className="kl-crumb" aria-current={i === all.length - 1 ? 'location' : undefined}
            data-testid="kl-crumb" disabled={!open || open.from === 'caret'}
            onClick={() => open && (p === CHANGED ? undefined : setOpen({...open, cwd: p, changed: false, query: '', sel: 0}))}>
            {label}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
  const changedCount = FILES.filter((f) => f.git).length;
  const tabs = open ? (
    <div className="ah-pal-tabs kl-tablist" role="tablist">
      {tabsOrder.map(([k, c]) => {
        const label = k === 'cmd' ? 'Komennot' : c ? 'Muutetut' : 'Tiedostot';
        return (
          <button key={label} type="button" role="tab" data-testid={`kl-tab-${label}`} tabIndex={-1}
            aria-selected={open.kind === k && open.changed === c}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen({...open, from: 'button', kind: k, changed: c, sel: 0, query: open.kind === k ? open.query : ''})}>
            {label}{c ? <span className="ah-pal-n">{changedCount}</span> : null}
          </button>
        );
      })}
    </div>
  ) : null;
  let index = -1;
  const rows = groups.flatMap((g) => {
    if (!g.rows.length) return [];
    return [
      g.label ? <div key={`g:${g.label}`} className="ah-choice-group" role="presentation">{g.label}</div> : null,
      ...g.rows.map((r) => {
        index++;
        const i = index;
        if (r.type === 'status') return (
          <div key={`s:${i}`} className={`ah-choice-empty${r.loading ? ' ah-choice-loading' : ''}`} role="presentation">
            {r.loading ? <span className="ah-choice-dot" aria-hidden="true" /> : null}{r.text}
          </div>
        );
        const common = {
          id: `${listId}-opt-${i}`, role: 'option' as const, 'aria-selected': i === sel,
          onMouseMove: () => open && open.sel !== i && setOpen({...open, sel: i}),
          onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
        };
        if (r.type === 'cmd') return (
          <div key={`c:${r.name}`} className="ah-choice-command" data-testid={`composer-command-${r.name}`} {...common} onClick={() => accept(i)}>
            <span className="ah-choice-name">/{r.name}</span>
            <span className={`ah-choice-tag ah-choice-tag-${r.tone}`}>{r.tag}</span>
            {r.description ? <span className="ah-choice-desc">{r.description}</span> : null}
          </div>
        );
        const marked = marks.includes(r.path);
        const slash = r.label.replace(/\/$/, '').lastIndexOf('/');
        const markBox = (
          <span role="checkbox" aria-checked={marked} aria-label={`Valitse ${r.path}`} data-testid="kl-mark"
            className={dir === TREE ? 'kl-check' : 'kl-ring'}
            onClick={(e) => { e.stopPropagation(); toggleMark(i, false); }}>
            <Icon name="check" />
          </span>
        );
        return (
          <div key={`${r.type}:${r.path}`} data-path={r.path} data-testid={r.type === 'dir' ? 'kl-dir' : 'composer-file-choice'}
            className={`ah-choice-file${r.type === 'dir' ? ' kl-dir' : ''}`} data-marked={marked || undefined} {...common}
            onClick={() => (marks.length ? toggleMark(i, false) : r.type === 'dir' ? open && enterDir(open, r.path) : accept(i))}>
            {r.type === 'dir' && r.path === CHANGED ? <span className={dir === TREE ? 'kl-check kl-none' : 'kl-ring kl-none'} aria-hidden="true" /> : markBox}
            <Icon name={r.type === 'dir' ? (r.path === CHANGED ? 'pencil' : 'folder') : 'file'} className="ah-choice-icon" />
            <span className="ah-choice-path">
              <span className="ah-choice-dir">{r.label.slice(0, slash + 1)}</span>{r.label.slice(slash + 1)}
            </span>
            {r.type === 'file' && r.git ? <GitBadge mark={r.git} /> : null}
            {r.type === 'dir' && r.changed ? <span className="kl-dir-n" title={`${r.changed} muutettua`}>{r.changed}</span> : null}
            {r.type === 'dir' ? <span className="kl-chev" aria-hidden="true">›</span> : null}
          </div>
        );
      }),
    ];
  });
  const shown = open?.from === 'button' ? 'button' : 'caret';
  const list = open ? (
    <div className={`ah-choice-pop kl-in kl-${dir === LIST ? 'list' : dir === TREE ? 'tree' : 'tabs'}`} data-kind={open.kind} data-from={shown}
      onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('input')) e.preventDefault(); }}>
      {dir === TABS ? tabs : dir === TREE && fileList ? crumbs : (
        <div className="ah-choice-head kl-head">
          <span>{head}</span>
          {dir === LIST && fileList && !shell ? (
            <button type="button" className="kl-chip" aria-pressed={open.changed} data-testid="kl-changed"
              onClick={() => setOpen({...open, from: 'button', changed: !open.changed, sel: 0})}>
              Muutetut <span className="ah-pal-n">{changedCount}</span>
            </button>
          ) : null}
        </div>
      )}
      {open.from === 'button' ? (
        <label className="ah-choice-search">
          <Icon name={open.kind === 'cmd' ? 'slash' : 'at'} />
          {dir === LIST && open.cwd ? (
            <button type="button" className="kl-scope" data-testid="kl-scope" onClick={() => setOpen({...open, cwd: '', sel: 0})}
              aria-label={`Poista rajaus ${open.cwd}`}>{open.cwd}<Icon name="cross" /></button>
          ) : null}
          <input ref={search} data-testid="command-search" type="text" className="ah-choice-search-input" autoComplete="off" spellCheck={false}
            role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={sel >= 0 ? `${listId}-opt-${sel}` : undefined}
            aria-label={open.kind === 'cmd' ? 'Hae komentoa tai taitoa' : 'Hae tiedostoa'}
            placeholder={open.kind === 'cmd' ? 'Hae komentoa tai taitoa' : dir === TREE && open.changed ? 'Hae muutetuista' : dir === TREE && open.cwd ? `Hae kansiosta ${open.cwd}` : dir === TREE ? 'Hae koko työtilasta' : 'Hae tiedostoa'}
            value={open.query} onChange={(e) => setOpen({...open, query: e.target.value, sel: 0})} onKeyDown={listKeys} />
        </label>
      ) : null}
      <div className={dir === TABS ? 'ah-pal-body kl-body' : 'kl-body'}>
        <div className="ah-choice-list" role="listbox" id={listId} aria-label={head} aria-multiselectable={fileList || undefined}>
          {index < 0 ? <div className="ah-choice-empty" role="presentation">{open.query ? `Ei osumia haulle “${open.query}”.` : 'Ei osumia.'}</div> : rows}
        </div>
        {dir === TABS ? <section className="ah-pal-prev" aria-label="Esikatselu" aria-live="polite"><Preview row={row} /></section> : null}
      </div>
      {marks.length ? (
        <div className="kl-marked" data-testid="kl-marked">
          <span>{marks.length} valittu</span>
          <span className="ah-crow-grow" />
          <button type="button" className="kl-clear" onClick={() => setOpen({...open, marks: []})}>Tyhjennä</button>
          <button type="button" className="kl-add" data-testid="kl-add" onClick={() => accept(sel)}>
            Lisää {marks.length === 1 ? 'polku' : `${marks.length} polkua`}
          </button>
        </div>
      ) : null}
      <div className="ah-choice-keys">
        {open.from === 'caret' && sel < 0 ? (
          <><kbd>Tab</kbd> lisää ylimmän · <kbd>↓</kbd> valitsee · <kbd>Enter</kbd> lähettää tekstin sellaisenaan · <kbd>Esc</kbd> sulje</>
        ) : open.from === 'caret' ? (
          <><kbd>↑</kbd><kbd>↓</kbd> valitse · <kbd>Enter</kbd> lisää · <kbd>Esc</kbd> sulje{fileList ? <> · <kbd>{MOD}</kbd><kbd>P</kbd> haku ja useampi</> : null}</>
        ) : fileList ? (
          <><kbd>↑</kbd><kbd>↓</kbd> valitse · <kbd>Tab</kbd> merkitse · <kbd>Enter</kbd> lisää{dir !== TABS ? <> · <kbd>→</kbd> avaa kansio</> : null}
            {dir === TREE ? <> · <kbd>←</kbd> ylös</> : null} · <kbd>Esc</kbd> takaisin tekstiin
            {dir === TABS ? <span className="ah-pal-where">lisätään muodossa <code>{shell ? 'polku' : '@polku'}</code></span> : null}</>
        ) : (
          <><kbd>↑</kbd><kbd>↓</kbd> valitse · <kbd>Enter</kbd> lisää viestin alkuun · <kbd>Esc</kbd> takaisin tekstiin</>
        )}
        {open.from === 'button' ? <> · <kbd>{MOD}</kbd><kbd>P</kbd> {dir === TABS ? 'seuraava välilehti' : open.kind === 'cmd' ? 'tiedostot' : 'komennot'}</> : null}
      </div>
    </div>
  ) : null;

  const listButton = (k: Kind) => (
    <button type="button" className="ah-crow-btn" data-testid={k === 'cmd' ? 'command-palette' : 'file-picker'} data-composer-list={k}
      aria-haspopup="listbox" aria-expanded={open?.from === 'button' && open.kind === k}
      aria-label={k === 'cmd' ? 'Komennot' : 'Tiedosto'}
      title={k === 'cmd' ? 'Komennot ja taidot · kirjoita myös / kentässä' : `Tiedosto · kirjoita myös @ kentässä · ${MOD}+P`}
      onMouseDown={(e) => { lastCaret.current = fieldCaret(); e.preventDefault(); }}
      onClick={() => fromButton(k)}>
      <Icon name={k === 'cmd' ? 'slash' : 'at'} />
      <span className="ah-crow-lbl">{k === 'cmd' ? 'Komennot' : 'Tiedosto'}</span>
    </button>
  );

  return (
    <section className="ah-composer" aria-label="Kirjoita viesti">
      <div ref={box} className={`ah-cbox${shell ? ' ah-cbox-shell' : ''}${open ? ' kl-open' : ''}`} data-direction={dir}>
        <textarea ref={field} data-testid="message-input" className="ah-cbox-field" aria-label="Viesti agentille" rows={1}
          aria-autocomplete="list" aria-controls={open?.from === 'caret' ? listId : undefined}
          aria-activedescendant={open?.from === 'caret' && sel >= 0 ? `${listId}-opt-${sel}` : undefined}
          placeholder={shell ? '' : 'Kirjoita agentille…'} spellCheck={!shell} value={value}
          onChange={(e) => { onChange(e.target.value); fromText(e.target.value, e.target.selectionStart); }}
          onKeyDown={onFieldKey}
          onKeyUp={(e) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) fromText(e.currentTarget.value, e.currentTarget.selectionStart); }}
          // A press in the text closes a button's list and writing goes on
          // where the press put the caret.
          onMouseDown={() => { if (open?.from === 'button') setOpen(null); }}
          onClick={(e) => fromText(e.currentTarget.value, e.currentTarget.selectionStart)}
          onBlur={(e) => {
            lastCaret.current = [e.currentTarget.selectionStart, e.currentTarget.selectionEnd];
            setTimeout(() => setOpen((o) => (o?.from === 'caret' && !box.current?.contains(document.activeElement) ? null : o)), 120);
          }} />
        {list}
        <div className="ah-crow">
          <span className="ah-crow-lz">
            <span className="ah-crow-attach">
              <AttachmentMenu disabled={false} onAttach={() => setNotice('Liitä avaa suoraan laitteen tiedostovalitsimen.')} />
            </span>
            {shell ? (
              <span className="ah-crow-shell" data-testid="command-mode">
                <span className="ah-crow-bang" aria-hidden="true">{shellExcluded(value) ? '!!' : '!'}</span>
                <span className="ah-crow-shelltext">Komento työtilassa <code>~/src/{WORKSPACE}</code></span>
                <span className="ah-crow-ctx">Agentti näkee tulosteen</span>
              </span>
            ) : listButton('cmd')}
            {listButton('file')}
            <span className="ah-crow-grow" />
            <div className="ah-composer-model">{modelPicker}</div>
          </span>
          <button type="button" className="ah-crow-send" data-mode={shell ? 'shell' : 'send'} data-testid="send" aria-label={shell ? 'Aja' : 'Lähetä'}
            onClick={() => setNotice('Prototyyppi ei lähetä viestiä.')}>
            <Icon name={shell ? 'run' : 'up'} />
          </button>
        </div>
      </div>
      {notice ? <p className="ah-composer-notice" role="status">{notice}</p> : null}
    </section>
  );
}
