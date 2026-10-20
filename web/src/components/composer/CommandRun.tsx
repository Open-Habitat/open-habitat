import { useEffect, useState } from "react";

export type CommandRunState =
  | "held"
  | "running"
  | "finished"
  | "cancelled"
  | "failed"
  | "not_started"
  | "uncertain";

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A `!` command the person ran, until Pi's own history entry for it
 * arrives. The output streams from Pi's bash events; Stop lives in the
 * composer, so the block only reports. */
export function CommandRun({
  command,
  excludeFromContext,
  state,
  exitCode,
  startedAt,
  output,
  piWorking,
}: {
  command: string;
  excludeFromContext: boolean;
  state: CommandRunState;
  exitCode?: number;
  startedAt?: number;
  output: string;
  piWorking: boolean;
}) {
  const live = state === "running";
  const [now, setNow] = useState(() => Date.now());
  const [long, setLong] = useState(false);
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [live]);
  useEffect(() => {
    if (live && startedAt !== undefined && now - startedAt >= 5000)
      setLong(true);
  }, [live, now, startedAt]);
  const status =
    state === "held" ? (
      <span className="ah-cmd-state">odottaa Pi:n käynnistymistä</span>
    ) : live ? (
      <span className="ah-cmd-state">
        <span className="ah-choice-dot" aria-hidden="true" />
        ajossa{" "}
        {startedAt !== undefined ? (
          <span className="ah-crow-clock">{mmss(now - startedAt)}</span>
        ) : null}
      </span>
    ) : state === "cancelled" ? (
      <span className="ah-cmd-state">pysäytetty</span>
    ) : state === "finished" && exitCode !== undefined ? (
      <span
        className={`ah-cmd-state ${exitCode === 0 ? "ah-cmd-state-ok" : "ah-cmd-state-err"}`}
      >
        paluuarvo {exitCode}
      </span>
    ) : state === "not_started" ? (
      <span className="ah-cmd-state">ei ajettu</span>
    ) : (
      <span className="ah-cmd-state">tulos ei tiedossa</span>
    );
  const notes = [
    excludeFromContext
      ? "Ei Pi:n kontekstissa: tuloste jää vain historiaan."
      : piWorking
        ? "Pi työskentelee: tuloste liitetään historiaan vuoron jälkeen, ja Pi näkee sen seuraavan viestisi mukana."
        : "Pi näkee tulosteen seuraavan viestisi mukana. Komento ei yksin käynnistä Pi:n vastausta.",
  ];
  if (live && long)
    notes.push(
      "Komento jatkuu, kunnes pysäytät sen kentän Pysäytä-painikkeesta. Palvelimen tai muun pitkän ajon voi pyytää Pi:ltä prosessina: se näkyy silloin taustatyön merkeissä ja jatkuu omana ajonaan.",
    );
  if (state === "not_started")
    notes.splice(
      0,
      notes.length,
      "Pi ei käynnistynyt tai komento otettiin takaisin ennen ajoa. Sitä ei ajeta myöhemmin.",
    );
  if (state === "uncertain")
    notes.splice(
      0,
      notes.length,
      "Pi päättyi tai yhteys katkesi ennen tulosta. Komentoa ei ajeta uudelleen.",
    );
  return (
    <section className="ah-cmd-run" aria-label="Sinä · komento">
      <header>
        <strong>Sinä · komento</strong>
        {status}
      </header>
      <div className="ah-cmd-line">
        <span className="ah-crow-bang" aria-hidden="true">
          {excludeFromContext ? "!!" : "!"}
        </span>
        <code>{command}</code>
      </div>
      {output || live ? (
        <pre className="ah-cmd-out" aria-live="off">
          {output}
        </pre>
      ) : null}
      <p className="ah-cmd-note">{notes.join(" ")}</p>
    </section>
  );
}
