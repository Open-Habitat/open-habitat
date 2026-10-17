import { createContext, type ReactNode, useContext } from "react";
import {
  type Spinoff,
  type Spinoffs,
  spinoffStateLabel,
} from "../app/spinoffs";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { Button } from "./Primitives";
import "./Spinoffs.css";
export const SpinoffContext = createContext<{
  data?: Spinoffs;
  stale?: boolean;
  open: (run: Spinoff) => void;
} | null>(null);
export function SpinoffReadOnly({
  run,
  transcripts,
  stale,
  onParent,
}: {
  run?: Spinoff;
  transcripts: Spinoffs["transcripts"];
  stale: boolean;
  onParent: () => void;
}) {
  return (
    <section className="ah-spinoff-view" aria-label="Spinoff, vain luku">
      <header>
        <Button size="row" label="← Pääagentille" onPress={onParent} />
        <span>Spinoff · Vain luku</span>
        <h2>{run?.title ?? "Spinoff"}</h2>
        {run && <p>{spinoffStateLabel(run)}</p>}
      </header>
      {stale ? (
        <p role="status">Spinoffin ajantasaista tilaa ei saada.</p>
      ) : null}
      {run && (
        <>
          <details>
            <summary>Tiedot</summary>
            <dl>
              <dt>Run ID</dt>
              <dd>
                <code>{run.run_id}</code>
              </dd>
              <dt>Lähtöhaara</dt>
              <dd>{run.source_branch || "Ei tiedossa"}</dd>
              <dt>Tallessa oleva haara</dt>
              <dd>{run.branch || "Ei tiedossa"}</dd>
              <dt>Työpuu</dt>
              <dd>{run.worktree || "Ei tiedossa"}</dd>
            </dl>
          </details>
          {run.summary && (
            <section aria-label="Tulos">
              <h3>Tulos</h3>
              <Markdown text={run.summary} />
            </section>
          )}
          {run.state === "unmerged" || run.state === "unknown" ? (
            <p>
              Palautus pääagentin kautta:{" "}
              <code>taskfleet run show {run.run_id}</code>
              <br />
              <code>taskfleet run salvage {run.run_id}</code>
            </p>
          ) : null}
        </>
      )}
      <div className="ah-spinoff-transcript">
        {run && !transcripts.length ? (
          <p>Spinoffin historia ei ole saatavilla.</p>
        ) : null}
        {transcripts.map((t) => (
          <section
            key={t.node_id}
            aria-label={`Spinoffin historia ${t.node_id}`}
          >
            {t.availability !== "available" ? (
              <p>
                {t.availability === "unsupported"
                  ? "Tämän agentin historiaa ei vielä tueta selaimessa."
                  : "Spinoffin historia ei ole saatavilla."}
              </p>
            ) : null}
            {t.truncated && <p>Näytetään historian viimeisin osa.</p>}
            {t.messages.map((m) => (
              <article key={`${t.node_id}-${m.key}`} data-kind={m.kind}>
                <strong>
                  {m.kind === "user"
                    ? "Pääagentti"
                    : m.kind === "tool"
                      ? "Työkalu"
                      : "Spinoff-agentti"}
                </strong>
                <Markdown text={m.text} />
              </article>
            ))}
          </section>
        ))}
      </div>
      <footer>
        Spinoffille ei kirjoiteta: sitä ohjaa agentti, joka käynnisti sen.{" "}
        <Button size="row" label="Kirjoita pääagentille →" onPress={onParent} />
      </footer>
    </section>
  );
}

export function SpinoffGroup({ runs }: { runs: Spinoff[] }) {
  const ctx = useContext(SpinoffContext);
  return (
    <section className="ah-spinoff-group" aria-label="Spinoffit">
      <h3>
        Spinoffit <small>{runs.length}</small>
      </h3>
      {ctx?.stale || ctx?.data?.availability !== "available" ? (
        <p role="status">Tila voi olla vanhentunut.</p>
      ) : null}
      {runs.map((r) => (
        <button
          type="button"
          className="ah-spinoff-row"
          key={r.run_id}
          onClick={() => ctx?.open(r)}
        >
          <Icon name="branch" className="ah-spinoff-icon" />
          <span>{r.title || r.run_id}</span>
          <span>{spinoffStateLabel(r)}</span>
          <span aria-hidden="true">→</span>
        </button>
      ))}
    </section>
  );
}
// Keep group in the native row where creation occurred, without a second
// placement store. The loaded window is the newest page of native history, so
// a busy parent can push the creating row out of it; such runs stay at the top
// of the window, where older history would continue, until that page loads.
export function useSpinoffGroups(
  items: { id: string; kind?: string; content: ReactNode }[],
  entries: { entry_key: string; timestamp?: string }[],
) {
  const ctx = useContext(SpinoffContext);
  const times = new Map(
    entries.map((e) => [e.entry_key, Date.parse(e.timestamp ?? "")]),
  );
  const native = items.filter((item) => times.has(item.id));
  const after = new Map<string, Spinoff[]>();
  const before: Spinoff[] = [];
  for (const run of ctx?.data?.runs ?? []) {
    if (!native.length) break;
    const at = Date.parse(run.created_at);
    let key: string | undefined;
    for (const item of native) {
      const time = times.get(item.id) ?? Number.NaN;
      if (Number.isFinite(at) && Number.isFinite(time) && time <= at)
        key = item.id;
    }
    if (key) after.set(key, [...(after.get(key) ?? []), run]);
    else before.push(run);
  }
  // A group is its own thread row, never part of a message's row layout.
  const group = (key: string, runs: Spinoff[]) => ({
    id: `spinoffs:${key}`,
    kind: "spinoffs",
    content: <SpinoffGroup runs={runs} />,
  });
  return items.flatMap((item) => [
    ...(before.length && item.id === native[0]?.id
      ? [group("before", before)]
      : []),
    item,
    ...(after.has(item.id) ? [group(item.id, after.get(item.id) ?? [])] : []),
  ]);
}
export function useOpenSpinoff() {
  const ctx = useContext(SpinoffContext);
  return (id: string) => {
    const run = ctx?.data?.runs.find((r) => r.run_id === id);
    if (!run) return false;
    ctx?.open(run);
    return true;
  };
}
