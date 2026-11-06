// The composer with its list inside the field box (Kentän sisällä, Jari
// 3.11.). The box, the row, the buttons, the list rows and the preview are
// production's markup and CSS (composer.css: .ah-cbox, .ah-crow,
// .ah-choice-*, .ah-pal-*), and the text rules are production's
// (completion.ts). Round 3 (Jari 6.11.): Välilehdet's preview stays, the
// folder tree is how files are browsed, and a changed file is a state of the
// file shown in the list rather than a tab or a folder of its own. The three
// directions differ in how the changed files are found in the tree.
import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {GitMark} from '../../../../web/src/app/composerReads';
import {Icon} from '../../../../web/src/components/Icon';
import {AttachmentMenu} from '../../../../web/src/components/composer/AttachmentMenu';
import {GitBadge} from '../../../../web/src/components/composer/ChoiceList';
import {caretToken, fileInsertion, fuzzyScore, isShell, shellExcluded, withLeadingCommand} from '../../../../web/src/components/composer/completion';
import {COMMANDS, DIRS, FILES, WORKSPACE, previewOf} from './data';

export type Load = 'ready' | 'slow' | 'failed';
/** Ylhäällä, Puu, Sarake. */
export const FIRST = 1, TREE = 2, COLS = 3;
type Kind = 'cmd' | 'file';
type Source = 'skill' | 'prompt' | 'extension';
type Open = {
  from: 'button' | 'caret';
  kind: Kind;
  /** The text range the choice replaces or is inserted at. */
  start: number; end: number;
  /** A typed token carried into the search (Ctrl/⌘+P): accepting replaces it. */
  replace: boolean;
  query: string;
  /** The row in hand; AUTO lets the direction pick it when the rows change. */
  sel: number;
  /** Marked paths in marking order; a folder ends with a slash. */
  marks: string[];
  /** Ylhäällä: the folder the list is in. Sarake: the folder
   * (or command source) the column narrows the list to. */
  cwd: string;
  /** Puu: folders opened or closed against their default (a folder
   * with changes starts open). */
  toggled: string[];
  atStart: boolean;
};
type Row =
  | {type: 'status'; text: string; loading?: boolean}
  | {type: 'dir'; path: string; label: string; changed: number; depth?: number; open?: boolean}
  | {type: 'file'; path: string; label: string; git?: GitMark; depth?: number}
  | {type: 'cmd'; name: string; description: string; tag: string; tone: string};
type Group = {label: string; rows: Row[]; sep?: boolean};

const AUTO = -2;
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';
const pickable = (r?: Row) => !!r && r.type !== 'status';
const sources = {skill: 'Taito', prompt: 'Pohja', extension: 'Laajennus'} as const;
const sourceGroups = {skill: 'Taidot', prompt: 'Pohjat', extension: 'Laajennukset'} as const;
const scopes = {user: 'oma', project: 'projekti', builtin: 'sisäänrakennettu'} as const;
const changedUnder = (dir: string) => FILES.filter((f) => f.git && f.path.startsWith(dir)).length;
const CHANGED_TOTAL = changedUnder('');
const parent = (dir: string) => dir.replace(/[^/]+\/$/, '');
const subdirs = (dir: string) => DIRS.filter((d) => d.startsWith(dir) && d !== dir && !d.slice(dir.length, -1).includes('/'));
const directFiles = (dir: string) => FILES.filter((f) => f.path.startsWith(dir) && !f.path.slice(dir.length).includes('/'))
  .sort((a, b) => a.path.localeCompare(b.path));
const name = (p: string) => p.replace(/\/$/, '').split('/').pop()! + (p.endsWith('/') ? '/' : '');
/** Changed files first, the daemon's path order otherwise. */
const changedFirst = <T extends {git?: GitMark}>(xs: T[]) => [...xs].sort((a, b) => Number(!!b.git) - Number(!!a.git));
const terms = (q: string) => q.split(/\s+/).filter(Boolean);
/** The daemon's match: every whitespace-separated term must match. */
const score = (text: string, q: string) => {
  let s = 0;
  for (const t of terms(q)) { const v = fuzzyScore(text, t); if (v <= 0) return 0; s += v; }
  return s || 1;
};
const expanded = (o: Open, d: string) => (changedUnder(d) > 0) !== o.toggled.includes(d);
const flip = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

/** Sarake's column: the workspace and every folder, or the command
 * sources. */
function columnFor(kind: Kind) {
  if (kind === 'cmd') {
    const usable = COMMANDS.filter((c) => !c.terminal_only);
    return [{p: '', label: 'Kaikki', full: 'Kaikki', depth: 0, n: usable.length},
      ...(['skill', 'prompt', 'extension'] as Source[]).map((s) => ({p: s, label: sourceGroups[s], full: sourceGroups[s], depth: 0, n: usable.filter((c) => c.source === s).length}))];
  }
  return [{p: '', label: WORKSPACE, full: WORKSPACE, depth: 0, n: changedUnder('')},
    ...DIRS.map((d) => ({p: d, label: name(d), full: d, depth: d.split('/').length - 1, n: changedUnder(d)}))];
}

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

/** Ylhäällä reads a typed path as folders: @src/as is "as" in src/. */
function pathQuery(o: Open) {
  const slash = o.query.lastIndexOf('/');
  return slash < 0 ? {cwd: o.cwd, q: o.query} : {cwd: o.cwd + o.query.slice(0, slash + 1), q: o.query.slice(slash + 1)};
}

/** The list's rows for a direction. Files and commands come from the
 * synthetic workspace through the same matching the host does. */
function groupsFor(dir: number, o: Open, load: {cmd: Load | 'loading'; file: Load | 'loading'}, shell: boolean): Group[] {
  if (o.kind === 'cmd') {
    if (load.cmd !== 'ready') return [{label: 'Agentti', rows: [load.cmd === 'failed'
      ? {type: 'status', text: 'Agentin komentoja ei saatu. Kirjoita komento itse.'}
      : {type: 'status', text: 'Haetaan agentin komennot ja taidot työtilasta…', loading: true}]}];
    const hits = COMMANDS.filter((c) => !c.terminal_only && (dir !== COLS || !o.cwd || c.source === o.cwd))
      .map((c) => ({c, s: Math.max(fuzzyScore(c.name, o.query), fuzzyScore(c.description, o.query) * 0.4)}))
      .filter((x) => x.s > 0).sort((a, b) => b.s - a.s)
      .map(({c}): Row => ({type: 'cmd', name: c.name, description: c.description, tag: `${sources[c.source]} · ${scopes[c.scope]}`, tone: c.source}));
    // Commands are sorted by where they come from, as files are by folder.
    if (dir !== COLS && !o.query) return (['skill', 'prompt', 'extension'] as const).map((s) => ({
      label: sourceGroups[s], rows: hits.filter((r) => r.type === 'cmd' && r.tone === s),
    }));
    return [{label: '', rows: hits}];
  }
  if (load.file !== 'ready') return [{label: '', rows: [load.file === 'failed'
    ? {type: 'status', text: 'Tiedostolistaa ei saatu juuri nyt.'}
    : {type: 'status', text: 'Haetaan tiedostoja…', loading: true}]}];
  const fileRow = (f: {path: string; git?: GitMark}, label: string, depth?: number): Row => ({type: 'file', path: f.path, label, git: f.git, depth});
  const dirRow = (d: string, label: string, depth?: number, open?: boolean): Row => ({type: 'dir', path: d, label, changed: changedUnder(d), depth, open});

  if (dir === FIRST) {
    const {cwd, q} = pathQuery(o);
    const rel = (p: string) => p.slice(cwd.length);
    if (!q) {
      // The folder's changed files, however deep, come first with their
      // path from here; below them the folder itself, its changed files
      // not repeated.
      const lifted = FILES.filter((f) => f.git && f.path.startsWith(cwd)).map((f) => fileRow(f, rel(f.path)));
      const tree = [...subdirs(cwd).map((d) => dirRow(d, rel(d))), ...directFiles(cwd).filter((f) => !f.git).map((f) => fileRow(f, rel(f.path)))];
      return [{label: '', rows: lifted}, {label: '', rows: tree, sep: lifted.length > 0}];
    }
    const dirs = shell ? [] : DIRS.filter((d) => d.startsWith(cwd) && d !== cwd)
      .map((d) => ({d, s: score(rel(d), q)})).filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s).slice(0, 3).map(({d}) => dirRow(d, rel(d)));
    const hits = FILES.filter((f) => f.path.startsWith(cwd)).map((f) => ({f, s: score(rel(f.path), q)})).filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s).map(({f}) => fileRow(f, rel(f.path)));
    return [{label: 'Osumat', rows: hits}, {label: 'Kansiot', rows: dirs}];
  }

  if (dir === TREE) {
    // A search shows the matching files in the tree, their folders open.
    const hit = o.query ? new Set(FILES.filter((f) => score(f.path, o.query) > 0).map((f) => f.path)) : null;
    const rows: Row[] = [];
    const walk = (base: string, depth: number) => {
      for (const d of subdirs(base)) {
        if (hit && ![...hit].some((p) => p.startsWith(d))) continue;
        const open = hit ? true : expanded(o, d);
        rows.push(dirRow(d, name(d), depth, open));
        if (open) walk(d, depth + 1);
      }
      for (const f of directFiles(base)) if (!hit || hit.has(f.path)) rows.push(fileRow(f, name(f.path), depth));
    };
    walk('', 0);
    return [{label: '', rows}];
  }

  // Sarake: everything in the column's folder, changed first.
  const rel = (p: string) => p.slice(o.cwd.length);
  const inside = FILES.filter((f) => f.path.startsWith(o.cwd));
  const rows = o.query
    ? inside.map((f) => ({f, s: score(rel(f.path), o.query)})).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map(({f}) => fileRow(f, rel(f.path)))
    : changedFirst(inside).map((f) => fileRow(f, rel(f.path)));
  return [{label: '', rows}];
}

/** Where the list starts: Puu starts on the first changed file
 * (or the first match), not on a folder. */
function autoSel(dir: number, o: Open, flat: Row[]) {
  if (dir === TREE && o.kind === 'file') {
    const i = flat.findIndex((r) => r.type === 'file' && (o.query || r.git));
    if (i >= 0) return i;
  }
  return flat.findIndex(pickable);
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
      {row.type === 'file' && row.git ? <p className="kl-prev-state">{row.git === 'untracked' ? 'Uusi tiedosto, ei vielä Gitissä.' : 'Muutettu: muutokset viimeisimpään committiin.'}</p> : null}
      {row.type === 'dir' && row.changed ? <p className="kl-prev-state">{row.changed === 1 ? '1 muutettu tiedosto' : `${row.changed} muutettua tiedostoa`}</p> : null}
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
  const sel = !open ? -1 : open.sel === AUTO || (open.sel >= 0 && !pickable(flat[open.sel])) ? autoSel(dir, open, flat) : open.sel;
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
  /** A folder row: Ylhäällä goes into it, Puu opens or
   * closes it in place. */
  const enterDir = (o: Open, path: string) => {
    if (dir === TREE) return setOpen({...o, toggled: flip(o.toggled, path), sel: flat.findIndex((r) => r.type === 'dir' && r.path === path)});
    if (o.from === 'caret') return replaceRange(o.start, o.end, `@${path}`);
    setOpen({...o, cwd: path, query: '', sel: AUTO});
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
  const markPath = (path: string, sel?: number) => open && setOpen({...open, marks: flip(open.marks, path), sel: sel ?? open.sel});
  const toggleMark = (index: number, advance: boolean) => {
    if (!open) return;
    const r = flat[index];
    if (r?.type !== 'file' && r?.type !== 'dir') return;
    let i = index;
    if (advance) { do i = (i + 1) % flat.length; while (!pickable(flat[i]) && i !== index); }
    markPath(r.path, i);
  };
  const move = (d: number) => {
    if (!open || !flat.some(pickable)) return;
    const n = flat.length;
    let i = sel < 0 ? (d > 0 ? -1 : n) : sel;
    do i = (i + d + n) % n; while (!pickable(flat[i]));
    setOpen({...open, sel: i});
  };
  const column = open && dir === COLS ? columnFor(open.kind) : [];
  const moveColumn = (d: number) => {
    if (!open || !column.length) return;
    const i = column.findIndex((c) => c.p === open.cwd);
    setOpen({...open, cwd: column[Math.min(column.length - 1, Math.max(0, i + d))].p, sel: AUTO});
  };

  // ---- opening ----
  const fieldCaret = (): [number, number] => {
    const el = field.current;
    if (el && document.activeElement === el) return [el.selectionStart, el.selectionEnd];
    return lastCaret.current ?? [value.length, value.length];
  };
  const base = {replace: false, query: '', sel: AUTO, marks: [], cwd: '', toggled: [], atStart: true};
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
    setOpen({...base, from: 'caret', ...t, replace: true, marks: [], cwd: same ? open.cwd : '', toggled: same ? open.toggled : [],
      sel: t.kind === 'cmd' && !t.atStart ? -1 : AUTO});
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
        // Tab completes the top file as in Pi's terminal; in the tree that
        // is the first file, not its folder.
        const top = sel >= 0 ? sel : Math.max(0, autoSel(dir, open, flat));
        return accept(top);
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setNotice('Prototyyppi ei lähetä viestiä.'); }
  };
  const listKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || e.nativeEvent.isComposing) return;
    const input = e.currentTarget;
    const atEnd = input.selectionStart === input.value.length;
    if (mod(e) && e.code === 'KeyP') {
      e.preventDefault();
      return setOpen({...open, kind: open.kind === 'cmd' ? 'file' : 'cmd', query: '', cwd: '', sel: AUTO});
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); return move(e.key === 'ArrowDown' ? 1 : -1); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(true); }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      if (open.kind === 'file') return toggleMark(sel, true);
      return accept(sel);
    }
    if (e.key === 'Enter') { e.preventDefault(); return accept(sel); }
    // Sarake: ← and → step through the column while the search is empty.
    if (dir === COLS && !open.query && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); return moveColumn(e.key === 'ArrowRight' ? 1 : -1); }
    if (dir === TREE && row && (e.key === 'ArrowRight' && atEnd || e.key === 'ArrowLeft' && !open.query)) {
      // → opens a folder, then steps into it; ← closes it, then steps out.
      e.preventDefault();
      if (e.key === 'ArrowRight') {
        if (row.type !== 'dir') return;
        return row.open ? move(1) : enterDir(open, row.path);
      }
      if (row.type === 'dir' && row.open) return enterDir(open, row.path);
      const up = row.type === 'dir' ? parent(row.path) : row.type === 'file' ? row.path.replace(/[^/]+$/, '') : '';
      const i = flat.findIndex((r) => r.type === 'dir' && r.path === up);
      if (i >= 0) setOpen({...open, sel: i});
      return;
    }
    if (dir === FIRST && open.kind === 'file') {
      if (e.key === 'ArrowRight' && atEnd && row?.type === 'dir') { e.preventDefault(); return enterDir(open, row.path); }
      if ((e.key === 'Backspace' || e.key === 'ArrowLeft') && !open.query && open.cwd) {
        e.preventDefault();
        return setOpen({...open, cwd: parent(open.cwd), sel: AUTO});
      }
    }
  };

  // ---- the list ----
  const marks = open?.marks ?? [];
  const fileList = open?.kind === 'file';
  const head = !open ? '' : open.kind === 'cmd'
    ? (open.from === 'button' || open.atStart ? 'Komennot ja taidot' : 'Mainitse komento: agentti ajaa komennon vain viestin alussa')
    : shell ? 'Tiedostot · lisätään komentoon polkuna' : `Tiedostot · ${WORKSPACE}`;
  const cwdShown = open && dir === FIRST && fileList ? pathQuery(open).cwd : '';
  const crumbs = (
    <nav className="kl-crumbs" aria-label="Kansio">
      {[{p: '', label: WORKSPACE}, ...cwdShown.split('/').filter(Boolean).map((n, i, a) => ({p: `${a.slice(0, i + 1).join('/')}/`, label: n}))].map(({p, label}, i, all) => (
        <React.Fragment key={p}>
          {i ? <span className="kl-crumb-sep" aria-hidden="true">›</span> : null}
          <button type="button" className="kl-crumb" aria-current={i === all.length - 1 ? 'location' : undefined}
            data-testid="kl-crumb" disabled={!open || open.from === 'caret'}
            onClick={() => open && setOpen({...open, cwd: p, query: '', sel: AUTO})}>
            {label}
          </button>
        </React.Fragment>
      ))}
      {shell ? <span className="kl-head-note">lisätään komentoon polkuna</span> : null}
    </nav>
  );
  let index = -1;
  const rows = groups.flatMap((g, gi) => {
    if (!g.rows.length) return [];
    return [
      g.sep ? <div key={`sep:${gi}`} className="kl-sep" role="presentation" /> : null,
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
        const tree = dir === TREE && r.depth !== undefined;
        return (
          <div key={`${r.type}:${r.path}`} data-path={r.path} data-testid={r.type === 'dir' ? 'kl-dir' : 'composer-file-choice'}
            className={`ah-choice-file${r.type === 'dir' ? ' kl-dir' : ''}${r.type === 'file' && r.git ? ' kl-changed' : ''}`}
            data-marked={marked || undefined} data-open={r.type === 'dir' && tree ? String(!!r.open) : undefined} {...common}
            style={tree ? {paddingLeft: `${10 + 18 * (r.depth ?? 0)}px`} : undefined}
            onClick={() => (marks.length ? toggleMark(i, false) : r.type === 'dir' ? open && enterDir(open, r.path) : accept(i))}>
            <span role="checkbox" aria-checked={marked} aria-label={`Valitse ${r.path}`} data-testid="kl-mark" className="kl-check"
              onClick={(e) => { e.stopPropagation(); toggleMark(i, false); }}>
              <Icon name="check" />
            </span>
            {tree ? <span className="kl-twist" aria-hidden="true">{r.type === 'dir' ? '›' : ''}</span> : null}
            <Icon name={r.type === 'dir' ? 'folder' : 'file'} className="ah-choice-icon" />
            <span className="ah-choice-path">
              <span className="ah-choice-dir">{r.label.slice(0, slash + 1)}</span>{r.label.slice(slash + 1)}
            </span>
            {r.type === 'file' && r.git ? <GitBadge mark={r.git} /> : null}
            {r.type === 'dir' && r.changed ? <span className="kl-dir-n" title={`${r.changed} muutettua`}>{r.changed}</span> : null}
            {r.type === 'dir' && !tree ? <span className="kl-chev" aria-hidden="true">›</span> : null}
          </div>
        );
      }),
    ];
  });
  const colNav = open && dir === COLS ? (
    <nav className="kl-col" aria-label={open.kind === 'cmd' ? 'Lähde' : 'Kansio'} data-testid="kl-col">
      {column.map((c) => {
        const marked = marks.includes(c.p);
        return (
          <div key={c.p || ':root'} className="kl-col-row" data-path={c.p} aria-current={c.p === open.cwd ? 'location' : undefined}
            data-marked={marked || undefined}
            style={{paddingLeft: `${8 + 12 * c.depth}px`}}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen({...open, cwd: c.p, sel: AUTO})}>
            {open.kind === 'file' && c.p ? (
              <span role="checkbox" aria-checked={marked} aria-label={`Valitse kansio ${c.p}`} className="kl-check kl-col-check"
                onClick={(e) => { e.stopPropagation(); markPath(c.p); }}><Icon name="check" /></span>
            ) : open.kind === 'file' ? <span className="kl-check kl-col-check" aria-hidden="true" /> : null}
            {open.kind === 'file' ? <Icon name="folder" className="ah-choice-icon" /> : null}
            <span className="kl-col-name kl-col-short">{c.label}</span>
            <span className="kl-col-name kl-col-full">{c.full}</span>
            {c.n ? <span className={open.kind === 'file' ? 'kl-dir-n' : 'ah-pal-n'}>{c.n}</span> : null}
          </div>
        );
      })}
    </nav>
  ) : null;
  const shown = open?.from === 'button' ? 'button' : 'caret';
  const variant = dir === FIRST ? 'first' : dir === TREE ? 'tree' : 'cols';
  const list = open ? (
    <div className={`ah-choice-pop kl-in kl-${variant}`} data-kind={open.kind} data-from={shown}
      onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('input')) e.preventDefault(); }}>
      {dir === FIRST && fileList ? crumbs : (
        <div className="ah-choice-head kl-head">
          <span>{head}</span>
          {dir === TREE && fileList && !shell ? <span className="kl-head-note" data-testid="kl-changed-total">{CHANGED_TOTAL} muutettua</span> : null}
        </div>
      )}
      {open.from === 'button' ? (
        <label className="ah-choice-search">
          <Icon name={open.kind === 'cmd' ? 'slash' : 'at'} />
          <input ref={search} data-testid="command-search" type="text" className="ah-choice-search-input" autoComplete="off" spellCheck={false}
            role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={sel >= 0 ? `${listId}-opt-${sel}` : undefined}
            aria-label={open.kind === 'cmd' ? 'Hae komentoa tai taitoa' : 'Hae tiedostoa'}
            placeholder={open.kind === 'cmd' ? 'Hae komentoa tai taitoa' : open.cwd && dir !== TREE ? `Hae kansiosta ${open.cwd}` : 'Hae koko työtilasta'}
            value={open.query} onChange={(e) => setOpen({...open, query: e.target.value, sel: AUTO})} onKeyDown={listKeys} />
        </label>
      ) : null}
      <div className="kl-body">
        {colNav}
        <div className="ah-choice-list" role="listbox" id={listId} aria-label={head} aria-multiselectable={fileList || undefined}>
          {index < 0 ? <div className="ah-choice-empty" role="presentation">{open.query ? `Ei osumia haulle “${open.query}”.` : 'Ei tiedostoja tässä kansiossa.'}</div> : rows}
        </div>
        <section className="ah-pal-prev" aria-label="Esikatselu" aria-live="polite"><Preview row={row} /></section>
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
          <><kbd>↑</kbd><kbd>↓</kbd> valitse · <kbd>Tab</kbd> merkitse · <kbd>Enter</kbd> lisää
            {dir === FIRST ? <> · <kbd>→</kbd> avaa kansio · <kbd>←</kbd> ylös</> : dir === TREE ? <> · <kbd>→</kbd><kbd>←</kbd> avaa ja sulje kansio</> : <> · <kbd>←</kbd><kbd>→</kbd> kansio</>}
            {' · '}<kbd>Esc</kbd> takaisin tekstiin</>
        ) : (
          <><kbd>↑</kbd><kbd>↓</kbd> valitse · <kbd>Enter</kbd> lisää viestin alkuun{dir === COLS ? <> · <kbd>←</kbd><kbd>→</kbd> lähde</> : null} · <kbd>Esc</kbd> takaisin tekstiin</>
        )}
        {open.from === 'button' ? <> · <kbd>{MOD}</kbd><kbd>P</kbd> {open.kind === 'cmd' ? 'tiedostot' : 'komennot'}</> : null}
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
