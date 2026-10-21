import { useState } from "react";
import type { PiCommand } from "../app/composerReads";
import { ControlButton } from "./ControlElements";
import { Dialog } from "./Overlays";
import "./StartHere.css";

export type CatalogueSkill = PiCommand & { source: "skill" };
export const skillTitle = (s: CatalogueSkill) =>
  s.discovery?.title || s.name.replace(/^skill:/, "");
export function skillDraft(skill: CatalogueSkill, draft: string) {
  // Pi expands a skill only at the beginning, with a literal space before
  // its arguments. Appending a command to existing prose would not invoke it.
  const args = [skill.discovery?.example, draft.trim() ? draft : undefined]
    .filter(Boolean)
    .join("\n\n");
  return `/${skill.name}${args ? ` ${args}` : ""}`;
}
export function isNewSkill(s: CatalogueSkill, cutoff?: number) {
  return Boolean(
    s.discovery?.repository &&
      cutoff &&
      s.discovery.added &&
      Date.parse(s.discovery.added.at) > cutoff,
  );
}

/** Native presentation facts in; draft/acknowledgement intent out. No IO here. */
export function StartHere({
  skills,
  state,
  cutoff,
  onRetry,
  onAcknowledge,
  onTry,
  onOpen,
}: {
  skills: CatalogueSkill[];
  state: "loading" | "ready" | "error";
  cutoff?: number;
  onRetry: () => void;
  onAcknowledge: () => void;
  onTry: (skill: CatalogueSkill) => void;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [shelf, setShelf] = useState("all");
  const goals = skills
    .filter((s) => s.discovery?.repository && s.discovery.start !== undefined)
    .sort(
      (a, b) =>
        (a.discovery?.start ?? 0) - (b.discovery?.start ?? 0) ||
        a.name.localeCompare(b.name),
    );
  const topics = [
    ...new Set(skills.map((s) => s.discovery?.topic || "Muut")),
  ].sort();
  const filtered = skills.filter(
    (s) =>
      (!topic || (s.discovery?.topic || "Muut") === topic) &&
      (shelf === "all" ||
        (shelf === "repo" && s.discovery?.repository) ||
        (shelf === "own" && s.scope === "user") ||
        (shelf === "new" && isNewSkill(s, cutoff))) &&
      [
        skillTitle(s),
        s.description,
        s.discovery?.when,
        s.discovery?.added?.author,
        s.name,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  function trySkill(s: CatalogueSkill) {
    setOpen(false);
    onTry(s);
  }
  const status =
    state === "loading" ? (
      <p role="status">Luetaan työtilan taitoja…</p>
    ) : state === "error" ? (
      <div role="status">
        <p>Taitoja ei saatu luettua.</p>
        <ControlButton size="row" onPress={onRetry}>
          Yritä uudelleen
        </ControlButton>
      </div>
    ) : null;
  return (
    <section
      className="ah-start"
      data-testid="start-here"
      aria-label="Aloita tästä"
    >
      <h2>Aloita tästä</h2>
      <p>Valitse tavoite tai kirjoita omin sanoin.</p>
      {status}
      {state === "ready" && goals.length === 0 ? (
        <p className="ah-start-hint">
          Tiimi voi lisätä aloituksia repon .pi/skills- tai
          .agents/skills-taitojen metadataan: <code>open-habitat-start: 1</code>
          .
        </p>
      ) : null}
      <div className="ah-start-goals">
        {goals.map((s) => (
          <article key={s.name}>
            <h3>{skillTitle(s)}</h3>
            <p>{s.discovery?.when || s.description}</p>
            <ControlButton
              size="row"
              data-testid="starting-goal"
              aria-label={`${skillTitle(s)} — kokeile luonnoksessa`}
              onPress={() => onTry(s)}
            >
              Kokeile luonnoksessa
            </ControlButton>
          </article>
        ))}
      </div>
      <Dialog
        data-testid="skill-catalogue-open"
        triggerLabel="Tutustu taitoihin"
        title="Työtilan taidot"
        isOpen={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (v) onOpen();
        }}
      >
        <div className="ah-skill-catalogue" data-testid="skill-catalogue">
          <p>
            Taidot auttavat konkreettisissa tehtävissä. Kokeilu lisää
            muokattavan esimerkin kenttään, ei lähetä sitä.
          </p>
          {status}
          <label>
            Hae tehtävää tai lisääjää
            <input
              data-testid="skill-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="ah-skill-filters">
            <label>
              Aihe
              <select
                data-testid="skill-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              >
                <option value="">Kaikki aiheet</option>
                {topics.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Näytä
              <select
                data-testid="skill-shelf"
                value={shelf}
                onChange={(e) => setShelf(e.target.value)}
              >
                <option value="all">Kaikki taidot</option>
                <option value="repo">Repon yhteiset</option>
                <option value="own">Omat yleiset</option>
                <option value="new">Uutta sinulle</option>
              </select>
            </label>
          </div>
          <div className="ah-skill-ack">
            <span data-testid="skill-cutoff" data-first-view={!cutoff}>
              {cutoff
                ? `Katsottu ${new Date(cutoff).toLocaleDateString("fi-FI")}`
                : "Ensimmäinen katselu"}
            </span>
            <ControlButton
              size="row"
              data-testid="skill-acknowledge"
              isDisabled={state !== "ready"}
              onPress={onAcknowledge}
            >
              Merkitse katsotuksi
            </ControlButton>
          </div>
          {state === "ready" && !filtered.length ? (
            <p role="status">Ei taitoja näillä rajauksilla.</p>
          ) : null}
          <div className="ah-skill-list">
            {filtered.map((s) => (
              <details
                key={s.name}
                data-testid="skill-card"
                data-command={s.name}
              >
                <summary>
                  <strong>{skillTitle(s)}</strong>
                  <span>
                    {s.discovery?.topic || "Muut"} ·{" "}
                    {s.discovery?.repository
                      ? "Repon yhteinen"
                      : s.scope === "user"
                        ? "Oma yleinen"
                        : "Muu lähde"}
                  </span>
                  {isNewSkill(s, cutoff) ? (
                    <span className="ah-skill-new" data-testid="skill-new">
                      Uusi sinulle
                    </span>
                  ) : null}
                </summary>
                <div className="ah-skill-detail">
                  <p>{s.discovery?.when || s.description}</p>
                  <code>/{s.name}</code>
                  {s.discovery?.example ? (
                    <blockquote>{s.discovery.example}</blockquote>
                  ) : null}
                  <p>
                    {s.discovery?.added ? (
                      <>
                        Lisäävän commitin tekijä: {s.discovery.added.author} ·{" "}
                        {new Date(s.discovery.added.at).toLocaleDateString(
                          "fi-FI",
                        )}
                        <br />
                        <code>{s.discovery.added.commit}</code>
                      </>
                    ) : (
                      "Lisäävä commit ei tiedossa."
                    )}
                  </p>
                  <details>
                    <summary>Esittelytietojen alkuperä</summary>
                    <p>
                      Taidon oma metadata; puuttuvat esittelytiedot korvataan
                      nimellä ja kuvauksella.
                    </p>
                    <p>{s.description}</p>
                  </details>
                  <ControlButton
                    data-testid="skill-try"
                    aria-label={`${skillTitle(s)} — kokeile luonnoksessa`}
                    size="row"
                    onPress={() => trySkill(s)}
                  >
                    Kokeile luonnoksessa
                  </ControlButton>
                </div>
              </details>
            ))}
          </div>
        </div>
      </Dialog>
    </section>
  );
}
