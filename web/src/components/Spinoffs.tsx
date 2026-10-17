import { createContext, useContext } from "react";
import {
  type Spinoff,
  type Spinoffs,
  spinoffStateLabel,
} from "../app/spinoffs";
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

export function useOpenSpinoff() {
  const ctx = useContext(SpinoffContext);
  return (id: string) => {
    const run = ctx?.data?.runs.find((r) => r.run_id === id);
    if (!run) return false;
    ctx?.open(run);
    return true;
  };
}
