// The round's renderers for parsed YAML, one per direction, and the YAML
// writer that turns the synthetic values into the file text the editor shows.
// Production would parse the buffer (see NOTES.md on the parser); here the
// value is the source of truth and the text is written from it, so the text
// and the preview can never disagree inside the prototype.
import React, { createContext, useContext, useState } from "react";
import type { StartGoal, StartPage } from "../../../../web/src/app/composerReads";
import { useText } from "../../../../web/src/i18n";
import { guideText } from "../../../../web/src/text/guide";
import { Icon } from "../../../../web/src/components/Icon";
import { WorkspaceIntro } from "../../../../web/src/components/WorkspaceIntro";
import type { Doc, Text, Yaml } from "./text";

export const TextContext = createContext<Text>(null as unknown as Text);
const useT = () => useContext(TextContext);

type Map = { [key: string]: Yaml };
const isMap = (v: Yaml): v is Map => !!v && typeof v === "object" && !Array.isArray(v);
const isScalar = (v: Yaml) => v === null || typeof v !== "object";

// ---- Writer -----------------------------------------------------------

function scalar(v: Yaml): string {
  if (v === null) return "";
  if (typeof v !== "string") return String(v);
  const plain =
    v !== "" &&
    !/^[\s\-?:,[\]{}#&*!|>'"%@`]/.test(v) &&
    !/(:\s|\s#|:$)/.test(v) &&
    !/^(true|false|null|yes|no|on|off|~|-?\d+(\.\d+)?)$/i.test(v) &&
    !/\s$/.test(v);
  return plain ? v : JSON.stringify(v);
}
function writeValue(v: Yaml, pad: string): string[] {
  if (isMap(v)) {
    const keys = Object.keys(v);
    if (!keys.length) return [];
    return keys.flatMap((k) => writeEntry(k, v[k], pad));
  }
  if (Array.isArray(v)) {
    return v.flatMap((item) => {
      if (isMap(item) && Object.keys(item).length) {
        const lines = writeValue(item, `${pad}  `);
        return [`${pad}- ${lines[0].slice(pad.length + 2)}`, ...lines.slice(1)];
      }
      if (Array.isArray(item)) return [`${pad}- [${item.map(scalar).join(", ")}]`];
      if (typeof item === "string" && item.includes("\n"))
        return [`${pad}- |-`, ...item.split("\n").map((l) => (l ? `${pad}    ${l}` : ""))];
      return [`${pad}- ${scalar(item)}`.trimEnd()];
    });
  }
  return [`${pad}${scalar(v)}`];
}
function writeEntry(k: string, v: Yaml, pad: string): string[] {
  const key = /^[A-Za-z_][\w-]*$/.test(k) ? k : JSON.stringify(k);
  if (typeof v === "string" && v.includes("\n"))
    return [`${pad}${key}: |-`, ...v.split("\n").map((l) => (l ? `${pad}  ${l}` : ""))];
  if (Array.isArray(v)) {
    if (!v.length) return [`${pad}${key}: []`];
    if (v.every((x) => typeof x === "number")) return [`${pad}${key}: [${v.join(", ")}]`];
    return [`${pad}${key}:`, ...writeValue(v, `${pad}  `)];
  }
  if (isMap(v))
    return Object.keys(v).length ? [`${pad}${key}:`, ...writeValue(v, `${pad}  `)] : [`${pad}${key}: {}`];
  return [`${pad}${key}: ${scalar(v)}`.trimEnd()];
}
export const writeYaml = (data: Map) => `${writeValue(data, "").join("\n")}\n`;
export const docText = (doc: Doc) =>
  doc.body === undefined ? writeYaml(doc.data) : `---\n${writeYaml(doc.data)}---\n${doc.body}`;

// ---- Shared pieces ----------------------------------------------------

function Empty({ v }: { v: Yaml }) {
  const t = useT();
  return <span className="fmv-empty">{Array.isArray(v) ? t.noItems : t.empty}</span>;
}
const blank = (v: Yaml) =>
  v === null || v === "" || (Array.isArray(v) && !v.length) || (isMap(v) && !Object.keys(v).length);

function Scalar({ v }: { v: Yaml }) {
  if (blank(v)) return <Empty v={v} />;
  if (typeof v === "string") {
    if (v.includes("\n")) return <blockquote className="fmv-block">{v}</blockquote>;
    if (/^[\d*/,\- ]+$/.test(v) || /^(https?:\/\/|\/)\S+$/.test(v) || /^[\w.-]+@[\w.-]+$/.test(v) || /\$\{\{/.test(v))
      return <code className="fmv-id">{v}</code>;
    return <span className="fmv-text">{v}</span>;
  }
  return <code className="fmv-lit">{String(v)}</code>;
}
const headingKey = (m: Map) =>
  ["title", "name", "heading", "type", "uses", "cron"].find((k) => typeof m[k] === "string" && !m[k]!.toString().includes("\n"));
const chipList = (v: Yaml[]) =>
  v.length <= 8 && v.every((x) => (typeof x === "string" && x.length <= 24 && !x.includes("\n")) || typeof x === "number");

// ---- 1 Nested ---------------------------------------------------------

export function Nested({ v, depth = 0 }: { v: Yaml; depth?: number }) {
  if (blank(v) || isScalar(v)) return <Scalar v={v} />;
  if (Array.isArray(v)) {
    if (chipList(v))
      return (
        <ul className="fmv-chips">
          {v.map((x, i) => (
            <li key={i}>{String(x)}</li>
          ))}
        </ul>
      );
    if (v.every(isMap))
      return (
        <ol className="fmv-cards" data-depth={depth}>
          {v.map((item, i) => {
            const m = item as Map;
            const h = headingKey(m);
            const rest = Object.fromEntries(Object.entries(m).filter(([k]) => k !== h));
            return (
              <li key={i} className="fmv-card">
                <header>
                  <span className="fmv-index">{i + 1}</span>
                  {h ? <strong>{String(m[h])}</strong> : null}
                </header>
                {Object.keys(rest).length ? <Nested v={rest} depth={depth + 1} /> : null}
              </li>
            );
          })}
        </ol>
      );
    return (
      <ul className="fmv-list">
        {v.map((x, i) => (
          <li key={i}>
            {Array.isArray(x) && chipList(x) ? <span className="fmv-row">{x.map((c, j) => <Scalar key={j} v={c} />)}</span> : <Nested v={x} depth={depth + 1} />}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <dl className="fmv-map" data-depth={depth}>
      {Object.entries(v).map(([k, x]) => (
        <div key={k} data-wide={!isScalar(x) && !blank(x) && !(Array.isArray(x) && chipList(x)) ? "" : undefined}>
          <dt>{k}</dt>
          <dd>
            <Nested v={x} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

// ---- 2 Tree -----------------------------------------------------------

const TreeOpen = createContext<{ all?: boolean }>({});
const OPEN_DEPTH = 2;

function summary(v: Yaml, t: Text) {
  if (Array.isArray(v)) return t.items(v.length);
  if (isMap(v)) {
    const keys = Object.keys(v);
    return `${t.keys(keys.length)} · ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", …" : ""}`;
  }
  return "";
}
/** A list whose items are maps sharing most keys: a table of its short scalars. */
function tableColumns(v: Yaml[]): string[] | null {
  if (v.length < 2 || !v.every(isMap)) return null;
  const maps = v as Map[];
  const counts = new Map_<string, number>();
  for (const m of maps) for (const k of Object.keys(m)) counts.set(k, (counts.get(k) ?? 0) + 1);
  const shared = [...counts].filter(([, n]) => n >= Math.ceil(maps.length * 0.6)).map(([k]) => k);
  const short = shared.filter((k) => maps.every((m) => m[k] === undefined || (isScalar(m[k]!) && String(m[k] ?? "").length <= 80 && !String(m[k]).includes("\n"))));
  if (!short.length) return null;
  const first = ["title", "name", "heading"].filter((k) => short.includes(k));
  return [...first, ...short.filter((k) => !first.includes(k))].slice(0, 3);
}
const Map_ = globalThis.Map;

function Toggle({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" className="fmt-toggle" aria-expanded={open} aria-label={label} onClick={onToggle}>
      <Icon name={open ? "down" : "forward"} />
    </button>
  );
}

function TreeNode({ k, v, depth }: { k: string; v: Yaml; depth: number }) {
  const t = useT();
  const { all } = useContext(TreeOpen);
  const container = !isScalar(v) && !blank(v) && !(Array.isArray(v) && chipList(v));
  const [open, setOpen] = useState(all ?? depth < OPEN_DEPTH);
  if (!container)
    return (
      <li className="fmt-row" data-depth={depth}>
        <span className="fmt-line">
          <span className="fmt-gap" />
          <span className="fmt-key">{k}</span>
          <span className="fmt-value">{Array.isArray(v) ? <Nested v={v} /> : <Scalar v={v} />}</span>
        </span>
      </li>
    );
  return (
    <li className="fmt-row" data-depth={depth} data-open={open || undefined}>
      <span className="fmt-line">
        <Toggle open={open} onToggle={() => setOpen(!open)} label={k} />
        <span className="fmt-key">{k}</span>
        {!open ? <span className="fmt-count">{summary(v, t)}</span> : null}
      </span>
      {open ? <TreeChildren v={v} depth={depth + 1} /> : null}
    </li>
  );
}

function TreeTable({ v, cols, depth }: { v: Map[]; cols: string[]; depth: number }) {
  const t = useT();
  const { all } = useContext(TreeOpen);
  const [open, setOpen] = useState<Set<number>>(new Set(all ? v.map((_, i) => i) : []));
  const flip = (i: number) => setOpen((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  return (
    <div className="fmt-table-wrap">
      <table className="fmt-table" data-testid="tree-table">
        <thead>
          <tr>
            <th aria-label="#" />
            {cols.map((c) => (
              <th key={c} scope="col">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {v.map((m, i) => {
            const rest = Object.fromEntries(Object.entries(m).filter(([k]) => !cols.includes(k)));
            const has = Object.keys(rest).length > 0;
            return (
              <React.Fragment key={i}>
                <tr data-open={open.has(i) || undefined}>
                  <td className="fmt-rowhead">
                    {has ? <Toggle open={open.has(i)} onToggle={() => flip(i)} label={t.rowOpen(i + 1)} /> : null}
                    <span className="fmv-index">{i + 1}</span>
                  </td>
                  {cols.map((c) => (
                    <td key={c}><Scalar v={m[c] ?? null} /></td>
                  ))}
                </tr>
                {open.has(i) ? (
                  <tr className="fmt-detail">
                    <td />
                    <td colSpan={cols.length}>
                      <TreeChildren v={rest} depth={depth + 1} />
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TreeChildren({ v, depth }: { v: Yaml; depth: number }) {
  if (Array.isArray(v)) {
    const cols = tableColumns(v);
    if (cols) return <TreeTable v={v as Map[]} cols={cols} depth={depth} />;
    return (
      <ul className="fmt-list">
        {v.map((x, i) => (
          <TreeNode key={i} k={isMap(x) && headingKey(x) ? `${i + 1} · ${x[headingKey(x)!]}` : String(i + 1)} v={x} depth={depth} />
        ))}
      </ul>
    );
  }
  if (isMap(v))
    return (
      <ul className="fmt-list">
        {Object.entries(v).map(([k, x]) => (
          <TreeNode key={k} k={k} v={x} depth={depth} />
        ))}
      </ul>
    );
  return <Scalar v={v} />;
}

export function Tree({ data }: { data: Map }) {
  const t = useT();
  const [all, setAll] = useState<{ all?: boolean; n: number }>({ n: 0 });
  return (
    <div className="fmt-tree">
      <div className="fmt-tools">
        <button type="button" data-testid="tree-open-all" onClick={() => setAll({ all: true, n: all.n + 1 })}>{t.openAll}</button>
        <button type="button" data-testid="tree-close-all" onClick={() => setAll({ all: false, n: all.n + 1 })}>{t.closeAll}</button>
      </div>
      <TreeOpen.Provider value={{ all: all.all }}>
        <TreeChildren key={all.n} v={data} depth={0} />
      </TreeOpen.Provider>
    </div>
  );
}

// ---- 3 As page ---------------------------------------------------------

const GOAL_FIELDS = ["title", "what", "when", "steps", "prompt", "skill", "name", "start"];
/** The daemon parser's rules, mirrored for the sketch (start_page_linux.go). */
export function startPageProblems(data: Map, t: Text): { goal?: number; text: string }[] {
  const out: { goal?: number; text: string }[] = [];
  for (const k of Object.keys(data)) if (k !== "title" && k !== "goals") out.push({ text: t.unknown(k) });
  if (typeof data.title !== "string" || !data.title.trim()) out.push({ text: t.missing("title") });
  const goals = Array.isArray(data.goals) ? data.goals : [];
  if (goals.length > 8) out.push({ text: t.tooMany("goals", 8) });
  goals.forEach((g, i) => {
    if (!isMap(g)) return;
    for (const f of ["title", "what", "when", "prompt"])
      if (typeof g[f] !== "string" || !String(g[f]).trim()) out.push({ goal: i, text: t.missing(f) });
    const steps = Array.isArray(g.steps) ? g.steps : [];
    if (!steps.length) out.push({ goal: i, text: t.missing("steps") });
    if (steps.length > 8) out.push({ goal: i, text: t.tooMany("steps", 8) });
    for (const k of Object.keys(g)) if (!GOAL_FIELDS.includes(k)) out.push({ goal: i, text: t.unknown(k) });
  });
  return out;
}

function Prompt({ text }: { text: string }) {
  const t = useT();
  const m = text.match(/\[[^[\]\n]+\]/g);
  if (!m || m.length !== 1) return <blockquote className="fmv-block">{text}</blockquote>;
  const [before, after] = text.split(m[0]);
  return (
    <blockquote className="fmv-block">
      {before}
      <mark className="fm3-placeholder" title={t.placeholder}>{m[0]}</mark>
      {after}
    </blockquote>
  );
}

function GoalCard({ goal, n, problems, active }: { goal: Map; n: number; problems: string[]; active: boolean }) {
  const t = useT();
  const g = useText(guideText);
  const steps = Array.isArray(goal.steps) ? goal.steps : [];
  return (
    <li className="fm3-guide" id={`fm3-goal-${n}`} data-active={active || undefined} data-problem={problems.length ? "" : undefined} data-testid="goal-guide-preview">
      <header>
        <span className="fmv-index">{n + 1}</span>
        <strong>{String(goal.title ?? "")}</strong>
        <span className="fm3-badges">
          {goal.skill ? <code className="fm3-skill" title={t.skill}>/skill:{String(goal.skill)}</code> : null}
          {goal.start === "immediate" ? <span className="fm3-badge">{t.immediate}</span> : null}
        </span>
      </header>
      {problems.length ? (
        <p className="fm3-problem" role="note">
          <Icon name="warning" /> {problems.join(" · ")}
        </p>
      ) : null}
      <dl className="fm3-fields">
        <div><dt>{t.when}</dt><dd>{goal.when ? String(goal.when) : <Empty v={null} />}</dd></div>
        <div><dt>{g.outcome}</dt><dd>{String(goal.what ?? "")}</dd></div>
        {goal.name ? <div><dt>{t.convName}</dt><dd>{String(goal.name)}</dd></div> : null}
      </dl>
      <h4>{g.steps}</h4>
      <ol className="fm3-steps">
        {steps.map((s, i) => <li key={i}>{String(s)}</li>)}
      </ol>
      <h4>{t.request}</h4>
      <Prompt text={String(goal.prompt ?? "")} />
      {Object.keys(goal).some((k) => !GOAL_FIELDS.includes(k)) ? (
        <Nested v={Object.fromEntries(Object.entries(goal).filter(([k]) => !GOAL_FIELDS.includes(k)))} />
      ) : null}
    </li>
  );
}

export function AsStartPage({ doc }: { doc: Doc }) {
  const t = useT();
  const [active, setActive] = useState<number>(-1);
  const problems = startPageProblems(doc.data, t);
  const goals = (Array.isArray(doc.data.goals) ? doc.data.goals : []).filter(isMap) as Map[];
  const page: StartPage = {
    title: String(doc.data.title ?? ""),
    body: doc.body ?? "",
    goals: goals.map((g) => ({
      title: String(g.title ?? ""), when: String(g.when ?? ""), what: String(g.what ?? ""),
      steps: (Array.isArray(g.steps) ? g.steps : []).map(String), prompt: String(g.prompt ?? ""),
      skill: g.skill ? String(g.skill) : undefined,
    })) as StartGoal[],
  };
  const choose = (goal: StartGoal) => {
    const i = page.goals.indexOf(goal);
    setActive(i);
    document.getElementById(`fm3-goal-${i}`)?.scrollIntoView({ block: "start", behavior: "auto" });
  };
  return (
    <div className="fm3" data-testid="as-start-page">
      <header className="fm3-head">
        <span className="fm3-kind"><Icon name="home" /> {t.startPage}</span>
        <span className="fm3-status" data-ok={problems.length ? undefined : ""} data-testid="start-page-status">
          <Icon name={problems.length ? "warning" : "check"} />
          {problems.length ? t.invalid : t.valid(goals.length)}
        </span>
        <p>{t.startPageNote}</p>
      </header>
      {problems.filter((p) => p.goal === undefined).map((p, i) => (
        <p key={i} className="fm3-problem" role="note"><Icon name="warning" /> {p.text}</p>
      ))}
      <div className="fm3-surface">
        <WorkspaceIntro page={page} state="ready" onRetry={() => {}} onGoal={choose} onCreatePage={() => {}} />
      </div>
      <h3 className="fm3-section">{t.guides}</h3>
      <p className="fm3-note">{t.guidesNote}</p>
      <ol className="fm3-guides">
        {goals.map((goal, i) => (
          <GoalCard key={i} goal={goal} n={i} active={i === active} problems={problems.filter((p) => p.goal === i).map((p) => `${t.goalN(i + 1)}: ${p.text}`)} />
        ))}
      </ol>
    </div>
  );
}
