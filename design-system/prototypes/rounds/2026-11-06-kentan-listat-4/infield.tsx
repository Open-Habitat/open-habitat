// The composer with its list inside the field box (Kentän sisällä, Jari
// 3.11.). The box, the row, the buttons, the list rows and the preview are
// production's markup and CSS (composer.css: .ah-cbox, .ah-crow,
// .ah-choice-*, .ah-pal-*), and the text rules are production's
// (completion.ts). Round 3 chose Puu (Jari 6.11.): one indented tree, the
// folders with changes open, changed files a state of the row, the preview
// beside it. Round 4 riffs the search in that tree: a typed name that is in
// many folders (AGENTS.md at the root, docs/, src/, src/astro/, tests/).
// Browsing without a search is round 3's Puu in all three directions.
import React, {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {GitMark} from '../../../../web/src/app/composerReads';
import {Icon} from '../../../../web/src/components/Icon';
import {AttachmentMenu} from '../../../../web/src/components/composer/AttachmentMenu';
import {GitBadge} from '../../../../web/src/components/composer/ChoiceList';
import {caretToken, fileInsertion, fuzzyScore, isShell, shellExcluded, withLeadingCommand} from '../../../../web/src/components/composer/completion';
import {COMMANDS, DIRS, FILES, WORKSPACE, previewOf, type ProtoFile} from './data';

export type Load = 'ready' | 'slow' | 'failed';
/** Changed first, or the shallowest first, among equally good name matches. */
export type Rank = 'changed' | 'shallow';
/** Puussa, Lista, Nimi. */
export const PRUNE = 1, FLAT = 2, BYNAME = 3;
type Kind = 'cmd' | 'file';
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
  /** Folders opened or closed against their default (a folder with changes
   * starts open); Nimi's name groups as `name:` entries. */
  toggled: string[];
  /** Lista: the file → shows in the tree once the search is cleared. */
  reveal?: string;
  atStart: boolean;
};
type Row =
  | {type: 'status'; text: string; loading?: boolean}
  | {type: 'dir'; path: string; label: string; changed: number; depth: number; open: boolean}
  | {type: 'file'; path: string; label: string; git?: GitMark; depth?: number; where?: string}
  | {type: 'name'; name: string; paths: string[]; changed: number; open: boolean}
  | {type: 'cmd'; name: string; description: string; tag: string; tone: string};
type Group = {label: string; rows: Row[]};

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
const folderOf = (p: string) => p.replace(/[^/]+$/, '');
const subdirs = (dir: string) => DIRS.filter((d) => d.startsWith(dir) && d !== dir && !d.slice(dir.length, -1).includes('/'));
const directFiles = (dir: string) => FILES.filter((f) => f.path.startsWith(dir) && !f.path.slice(dir.length).includes('/'))
  .sort((a, b) => a.path.localeCompare(b.path));
const name = (p: string) => p.replace(/\/$/, '').split('/').pop()! + (p.endsWith('/') ? '/' : '');
const depthOf = (p: string) => p.split('/').length - 1;
/** The folder as a row shows it: the workspace's own name for the root. */
const shownFolder = (p: string) => folderOf(p) || `${WORKSPACE}/`;
const terms = (q: string) => q.split(/\s+/).filter(Boolean);
/** The daemon's match: every whitespace-separated term must match. */
const score = (text: string, q: string) => {
  let s = 0;
  for (const t of terms(q)) { const v = fuzzyScore(text, t); if (v <= 0) return 0; s += v; }
  return s || 1;
};
const expanded = (o: Open, d: string) => (changedUnder(d) > 0) !== o.toggled.includes(d);
const flip = (xs: string[], x: string) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

/** How well a file's own name answers the search: the whole name, a part of
 * it, its letters in order, or only its folders. A typed folder (`src/ag`)
 * is read against the whole path. */
function tier(f: ProtoFile, q: string) {
  const query = q.trim().toLowerCase();
  const n = name(f.path).toLowerCase();
  if (query.includes('/')) return f.path.toLowerCase().includes(query) ? 1 : 3;
  if (n === query || n.replace(/\.[^.]+$/, '') === query) return 0;
  if (n.includes(query)) return 1;
  return score(n, q) > 0 ? 2 : 3;
}
/** Ranked hits for Lista and Nimi: the name's match, then the chosen
 * order (changed or shallow first), then the other, then the path. */
function ranked(q: string, rank: Rank) {
  return FILES.filter((f) => score(f.path, q) > 0).map((f) => ({f, t: tier(f, q)})).sort((a, b) => {
    if (a.t !== b.t) return a.t - b.t;
    const ch = Number(!!b.f.git) - Number(!!a.f.git), dp = depthOf(a.f.path) - depthOf(b.f.path);
    const first = rank === 'changed' ? ch : dp, second = rank === 'changed' ? dp : ch;
    return first || second || a.f.path.localeCompare(b.f.path);
  }).map(({f}) => f);
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

/** The list's rows for a direction. Files and commands come from the
 * synthetic workspace through the same matching the host does. */
function groupsFor(dir: number, o: Open, load: {cmd: Load | 'loading'; file: Load | 'loading'}, rank: Rank): Group[] {
  if (o.kind === 'cmd') {
    if (load.cmd !== 'ready') return [{label: 'Agentti', rows: [load.cmd === 'failed'
      ? {type: 'status', text: 'Agentin komentoja ei saatu. Kirjoita komento itse.'}
      : {type: 'status', text: 'Haetaan agentin komennot ja taidot työtilasta…', loading: true}]}];
    const hits = COMMANDS.filter((c) => !c.terminal_only)
      .map((c) => ({c, s: Math.max(fuzzyScore(c.name, o.query), fuzzyScore(c.description, o.query) * 0.4)}))
      .filter((x) => x.s > 0).sort((a, b) => b.s - a.s)
      .map(({c}): Row => ({type: 'cmd', name: c.name, description: c.description, tag: `${sources[c.source]} · ${scopes[c.scope]}`, tone: c.source}));
    if (!o.query) return (['skill', 'prompt', 'extension'] as const).map((s) => ({
      label: sourceGroups[s], rows: hits.filter((r) => r.type === 'cmd' && r.tone === s),
    }));
    return [{label: '', rows: hits}];
  }
  if (load.file !== 'ready') return [{label: '', rows: [load.file === 'failed'
    ? {type: 'status', text: 'Tiedostolistaa ei saatu juuri nyt.'}
    : {type: 'status', text: 'Haetaan tiedostoja…', loading: true}]}];
  const fileRow = (f: ProtoFile, label: string, depth?: number, where?: string): Row => ({type: 'file', path: f.path, label, git: f.git, depth, where});
  const dirRow = (d: string, depth: number, open: boolean): Row => ({type: 'dir', path: d, label: name(d), changed: changedUnder(d), depth, open});

  // Browsing (no search) is round 3's Puu in every direction. Puussa keeps
  // the tree for a search too: only the folders that hold a match, open,
  // and in each folder its own matches before its subfolders, so the root's
  // file is the first row.
  if (!o.query || dir === PRUNE) {
    const hit = o.query ? new Set(FILES.filter((f) => score(f.path, o.query) > 0).map((f) => f.path)) : null;
    const rows: Row[] = [];
    const walk = (base: string, depth: number) => {
      const files = directFiles(base).filter((f) => !hit || hit.has(f.path)).map((f) => fileRow(f, name(f.path), depth));
      if (hit) rows.push(...files);
      for (const d of subdirs(base)) {
        if (hit && ![...hit].some((p) => p.startsWith(d))) continue;
        const open = hit ? !o.toggled.includes(d) : expanded(o, d);
        rows.push(dirRow(d, depth, open));
        if (open) walk(d, depth + 1);
      }
      if (!hit) rows.push(...files);
    };
    walk('', 0);
    return [{label: '', rows}];
  }

  const hits = ranked(o.query, rank);
  // Lista: one flat ranked list; the folder follows the name.
  if (dir === FLAT) return [{label: '', rows: hits.map((f) => fileRow(f, name(f.path), undefined, shownFolder(f.path)))}];

  // Nimi: files of the same name under one name row, their folders
  // beneath it in the same order; a name found once is a plain row.
  const byName = new Map<string, ProtoFile[]>();
  for (const f of hits) byName.set(name(f.path), [...(byName.get(name(f.path)) ?? []), f]);
  const rows: Row[] = [];
  for (const [n, fs] of byName) {
    if (fs.length === 1) { rows.push(fileRow(fs[0], n, undefined, shownFolder(fs[0].path))); continue; }
    const open = !o.toggled.includes(`name:${n}`);
    rows.push({type: 'name', name: n, paths: fs.map((f) => f.path), changed: fs.filter((f) => f.git).length, open});
    if (open) for (const f of fs) rows.push(fileRow(f, shownFolder(f.path), 1));
  }
  return [{label: '', rows}];
}

/** Where the list starts: on a file, not a folder or a name row; browsing
 * starts on the first changed file. */
function autoSel(o: Open, flat: Row[]) {
  if (o.reveal) {
    const i = flat.findIndex((r) => r.type === 'file' && r.path === o.reveal);
    if (i >= 0) return i;
  }
  if (o.kind === 'file') {
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
  if (row.type === 'name') return (
    <>
      <h2 className="ah-pal-mono">{row.name}</h2>
      <p className="kl-prev-state">{row.paths.length} kansiossa{row.changed ? ` · ${row.changed} muutettu` : ''}. Merkitse nimi, niin kaikki lisätään.</p>
      <pre className="kl-dirprev">{row.paths.join('\n')}</pre>
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

export function InfieldComposer({dir, value, onChange, load, rank, modelPicker, autoOpen, autoQuery = ''}: {
  dir: number;
  value: string;
  onChange: (v: string) => void;
  load: Load;
  rank: Rank;
  modelPicker: React.ReactNode;
  /** Opens this list from its button once mounted (the review's default view). */
  autoOpen?: Kind;
  /** …with this already typed in its search. */
  autoQuery?: string;
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

  const groups = useMemo(() => (open ? groupsFor(dir, open, loaded, rank) : []), [dir, open, loaded, rank]);
  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  const sel = !open ? -1 : open.sel === AUTO || (open.sel >= 0 && !pickable(flat[open.sel])) ? autoSel(open, flat) : open.sel;
  const row = sel >= 0 ? flat[sel] : undefined;
  const hitCount = open?.kind === 'file' && open.query ? FILES.filter((f) => score(f.path, open.query) > 0).length : 0;

  useEffect(() => { if (!notice) return; const id = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(id); }, [notice]);
  useEffect(() => { if (sel >= 0) document.getElementById(`${listId}-opt-${sel}`)?.scrollIntoView?.({block: 'nearest'}); }, [sel, open?.query]);

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
  /** A folder or name row opens or closes in place. */
  const toggle = (o: Open, r: Row) => {
    const key = r.type === 'name' ? `name:${r.name}` : r.type === 'dir' ? r.path : '';
    if (!key) return;
    setOpen({...o, toggled: flip(o.toggled, key), reveal: undefined, sel: flat.indexOf(r)});
  };
  /** Lista's →: leave the search and show the file in its folder. */
  const revealInTree = (o: Open, path: string) => {
    const fresh = {...o, toggled: []};
    const shut = DIRS.filter((d) => path.startsWith(d) && !expanded(fresh, d));
    setOpen({...o, query: '', toggled: shut, reveal: path, sel: AUTO});
  };
  const accept = (index: number) => {
    const o = open;
    if (!o) return;
    const r = flat[index];
    if (!o.marks.length && (r?.type === 'dir' || r?.type === 'name')) {
      // A name row's Enter steps to its first folder; a folder opens.
      if (r.type === 'name' && r.open) return setOpen({...o, sel: index + 1});
      return toggle(o, r);
    }
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
  /** A name row marks (or unmarks) every file of that name. */
  const markRow = (r: Row, sel: number) => {
    if (!open) return;
    if (r.type === 'name') {
      const all = r.paths.every((p) => open.marks.includes(p));
      const marks = all ? open.marks.filter((p) => !r.paths.includes(p)) : [...open.marks, ...r.paths.filter((p) => !open.marks.includes(p))];
      return setOpen({...open, marks, sel});
    }
    if (r.type === 'file' || r.type === 'dir') setOpen({...open, marks: flip(open.marks, r.path), sel});
  };
  const toggleMark = (index: number, advance: boolean) => {
    if (!open) return;
    const r = flat[index];
    if (!r || r.type === 'status' || r.type === 'cmd') return;
    let i = index;
    if (advance) { do i = (i + 1) % flat.length; while (!pickable(flat[i]) && i !== index); }
    markRow(r, i);
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
  const base = {replace: false, query: '', sel: AUTO, marks: [], toggled: [], atStart: true};
  const fromButton = (k: Kind, query = '') => {
    if (open?.from === 'button' && open.kind === k) return close(true);
    // From one list to the other keeps the place in the text.
    const [start, end] = open ? [open.start, open.end] : fieldCaret();
    setOpen({...base, from: 'button', kind: k, start, end, replace: !!open?.replace, query});
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
    setOpen({...base, from: 'caret', ...t, replace: true, marks: [], toggled: same ? open.toggled : [],
      sel: t.kind === 'cmd' && !t.atStart ? -1 : AUTO});
  };
  useEffect(() => {
    if (!autoOpen) return;
    const id = setTimeout(() => {
      const el = field.current!;
      el.setSelectionRange(el.value.length, el.value.length);
      lastCaret.current = [el.value.length, el.value.length];
      el.scrollTop = el.scrollHeight;
      fromButton(autoOpen, autoQuery);
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
  /** → and ← on the row in hand: folders and name rows open and close,
   * ← steps out to the folder or name above, Lista's → shows the file in
   * the tree. */
  const sideways = (o: Open, right: boolean) => {
    if (!row) return false;
    if (right) {
      if (row.type === 'dir' || row.type === 'name') { if (row.open) move(1); else toggle(o, row); return true; }
      if (dir === FLAT && o.query && row.type === 'file') { revealInTree(o, row.path); return true; }
      return false;
    }
    if ((row.type === 'dir' || row.type === 'name') && row.open) { toggle(o, row); return true; }
    if (row.type === 'file' && row.depth !== undefined) {
      // Up to the folder in the tree, or the name row above in Nimi.
      const i = o.query && dir === BYNAME
        ? flat.slice(0, sel).map((r) => r.type).lastIndexOf('name')
        : flat.findIndex((r) => r.type === 'dir' && r.path === folderOf(row.path));
      if (i >= 0) setOpen({...o, sel: i});
      return true;
    }
    if (row.type === 'dir') {
      const i = flat.findIndex((r) => r.type === 'dir' && r.path === parent(row.path));
      if (i >= 0) setOpen({...o, sel: i});
      return true;
    }
    return false;
  };
  const onFieldKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mod(e) && e.code === 'KeyP') { e.preventDefault(); return toSearch(); }
    if (e.nativeEvent.isComposing) return;
    if (open?.from === 'caret') {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); return move(e.key === 'ArrowDown' ? 1 : -1); }
      if (e.key === 'Escape') { e.preventDefault(); return setOpen(null); }
      if ((e.key === 'Enter' && !e.shiftKey && sel >= 0) || (e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        // Tab completes the top file as in Pi's terminal: the first file
        // row, never a folder or a name row.
        const top = sel >= 0 ? sel : Math.max(0, autoSel(open, flat));
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
      return setOpen({...open, kind: open.kind === 'cmd' ? 'file' : 'cmd', query: '', sel: AUTO});
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); return move(e.key === 'ArrowDown' ? 1 : -1); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return close(true); }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      if (open.kind === 'file') return toggleMark(sel, true);
      return accept(sel);
    }
    if (e.key === 'Enter') { e.preventDefault(); return accept(sel); }
    if (open.kind === 'file' && (e.key === 'ArrowRight' && atEnd || e.key === 'ArrowLeft' && input.selectionStart === 0 && input.selectionEnd === 0)) {
      if (sideways(open, e.key === 'ArrowRight')) e.preventDefault();
    }
  };

  // ---- the list ----
  const marks = open?.marks ?? [];
  const fileList = open?.kind === 'file';
  const head = !open ? '' : open.kind === 'cmd'
    ? (open.from === 'button' || open.atStart ? 'Komennot ja taidot' : 'Mainitse komento: agentti ajaa komennon vain viestin alussa')
    : shell ? 'Tiedostot · lisätään komentoon polkuna' : `Tiedostot · ${WORKSPACE}`;
  const note = !open || !fileList || shell ? '' : open.query
    ? (hitCount === 1 ? '1 osuma' : `${hitCount} osumaa`)
    : `${CHANGED_TOTAL} muutettua`;
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
        if (r.type === 'name') {
          const all = r.paths.every((p) => marks.includes(p));
          return (
            <div key={`n:${r.name}`} data-name={r.name} data-testid="kl-name" className="ah-choice-file kl-name" data-open={String(r.open)}
              data-marked={all || undefined} {...common} aria-expanded={r.open}
              onClick={() => (marks.length ? toggleMark(i, false) : open && toggle(open, r))}>
              <span role="checkbox" aria-checked={all} aria-label={`Valitse kaikki ${r.name}`} data-testid="kl-mark" className="kl-check"
                onClick={(e) => { e.stopPropagation(); toggleMark(i, false); }}>
                <Icon name="check" />
              </span>
              <span className="kl-twist" aria-hidden="true">›</span>
              <Icon name="file" className="ah-choice-icon" />
              <span className="ah-choice-path kl-name-label">{r.name}</span>
              <span className="kl-name-n">{r.paths.length} kansiossa</span>
              {r.changed ? <span className="kl-dir-n" title={`${r.changed} muutettu`}>{r.changed}</span> : null}
            </div>
          );
        }
        const marked = marks.includes(r.path);
        const indent = r.depth !== undefined;
        // Nimi's folder rows under a name show only the folder.
        const underName = r.type === 'file' && !!open?.query && dir === BYNAME && indent;
        const slash = r.label.replace(/\/$/, '').lastIndexOf('/');
        return (
          <div key={`${r.type}:${r.path}`} data-path={r.path} data-testid={r.type === 'dir' ? 'kl-dir' : 'composer-file-choice'}
            className={`ah-choice-file${r.type === 'dir' ? ' kl-dir' : ''}${r.type === 'file' && r.git ? ' kl-changed' : ''}${underName ? ' kl-under' : ''}${r.type === 'file' && r.where ? ' kl-flat' : ''}`}
            data-marked={marked || undefined} data-open={r.type === 'dir' ? String(r.open) : undefined} {...common}
            style={indent && !underName ? {paddingLeft: `${10 + 18 * (r.depth ?? 0)}px`} : undefined}
            onClick={() => (marks.length ? toggleMark(i, false) : r.type === 'dir' ? open && toggle(open, r) : accept(i))}>
            <span role="checkbox" aria-checked={marked} aria-label={`Valitse ${r.path}`} data-testid="kl-mark" className="kl-check"
              onClick={(e) => { e.stopPropagation(); toggleMark(i, false); }}>
              <Icon name="check" />
            </span>
            {indent ? <span className="kl-twist" aria-hidden="true">{r.type === 'dir' ? '›' : ''}</span> : null}
            <Icon name={r.type === 'dir' || underName ? 'folder' : 'file'} className="ah-choice-icon" />
            {r.type === 'file' && r.where ? (
              <span className="ah-choice-path kl-flat-path">
                <span className="kl-flat-name">{r.label}</span>
                <span className="ah-choice-dir kl-where">{r.where}</span>
              </span>
            ) : (
              <span className="ah-choice-path">
                <span className="ah-choice-dir">{r.label.slice(0, slash + 1)}</span>{r.label.slice(slash + 1)}
              </span>
            )}
            {r.type === 'file' && r.git ? <GitBadge mark={r.git} /> : null}
            {r.type === 'dir' && r.changed && !open?.query ? <span className="kl-dir-n" title={`${r.changed} muutettua`}>{r.changed}</span> : null}
          </div>
        );
      }),
    ];
  });
  const shown = open?.from === 'button' ? 'button' : 'caret';
  const variant = ['', 'prune', 'flat', 'byname'][dir];
  const searching = !!open?.query;
  const list = open ? (
    <div className={`ah-choice-pop kl-in kl-tree kl-${variant}`} data-kind={open.kind} data-from={shown} data-searching={searching || undefined}
      onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('input')) e.preventDefault(); }}>
      <div className="ah-choice-head kl-head">
        <span>{head}</span>
        {note ? <span className="kl-head-note" data-testid="kl-note">{note}</span> : null}
      </div>
      {open.from === 'button' ? (
        <label className="ah-choice-search">
          <Icon name={open.kind === 'cmd' ? 'slash' : 'at'} />
          <input ref={search} data-testid="command-search" type="text" className="ah-choice-search-input" autoComplete="off" spellCheck={false}
            role="combobox" aria-expanded="true" aria-controls={listId} aria-activedescendant={sel >= 0 ? `${listId}-opt-${sel}` : undefined}
            aria-label={open.kind === 'cmd' ? 'Hae komentoa tai taitoa' : 'Hae tiedostoa'}
            placeholder={open.kind === 'cmd' ? 'Hae komentoa tai taitoa' : 'Hae koko työtilasta'}
            value={open.query} onChange={(e) => setOpen({...open, query: e.target.value, reveal: undefined, sel: AUTO,
              // Into or out of a search, the folders start again from their defaults.
              toggled: !e.target.value !== !open.query ? [] : open.toggled})} onKeyDown={listKeys} />
        </label>
      ) : null}
      <div className="kl-body">
        <div className="ah-choice-list" role="listbox" id={listId} aria-label={head} aria-multiselectable={fileList || undefined}>
          {index < 0 ? <div className="ah-choice-empty" role="presentation">{open.query ? `Ei osumia haulle “${open.query}”.` : 'Ei tiedostoja.'}</div> : rows}
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
          <><kbd>↑</kbd><kbd>↓</kbd> valitse · <kbd>Tab</kbd> lisää ylimmän · <kbd>Enter</kbd> lisää · <kbd>Esc</kbd> sulje{fileList ? <> · <kbd>{MOD}</kbd><kbd>P</kbd> haku ja useampi</> : null}</>
        ) : fileList ? (
          <><kbd>↑</kbd><kbd>↓</kbd> valitse · <kbd>Tab</kbd> merkitse · <kbd>Enter</kbd> lisää
            {searching && dir === FLAT ? <> · <kbd>→</kbd> näytä kansiossa</>
              : searching && dir === BYNAME ? <> · <kbd>→</kbd><kbd>←</kbd> avaa ja sulje nimi</>
                : <> · <kbd>→</kbd><kbd>←</kbd> avaa ja sulje kansio</>}
            {' · '}<kbd>Esc</kbd> takaisin tekstiin</>
        ) : (
          <><kbd>↑</kbd><kbd>↓</kbd> valitse · <kbd>Enter</kbd> lisää viestin alkuun · <kbd>Esc</kbd> takaisin tekstiin</>
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
