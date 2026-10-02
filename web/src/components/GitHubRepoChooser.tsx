import { useEffect, useRef, useState } from "react";
import { Button } from "./Primitives";
import { Badge, InlineNotice, ProgressIndicator } from "./Status";
import styles from "./GitHubRepoChooser.module.css";

/** Display model only. The parent owns paging, selection, native checkout and reconciliation. */
export interface GitHubRepoChoice {
  full_name: string;
  private: boolean;
  description: string;
  pushed_at: string | null;
}

export type GitHubRepoChooserView =
  | { phase: "loading" | "no-auth" | "unavailable" }
  | {
      phase: "catalog";
      repositories: GitHubRepoChoice[];
    };

export type GitHubCheckoutView =
  | { phase: "idle" }
  | {
      phase: "progress";
      completed: number;
      total: number;
      stage?:
        | "reserving"
        | "connecting"
        | "receiving"
        | "checkout"
        | "verifying";
      percent?: number;
      receivedBytes?: number;
    }
  | { phase: "partial"; completed: number; total: number }
  | { phase: "uncertain" }
  | { phase: "confirmed"; names: readonly string[] };

export interface GitHubRepoChooserProps {
  view: GitHubRepoChooserView;
  selectedNames: string[];
  checkout: GitHubCheckoutView;
  onToggle: (fullName: string, selected: boolean) => void;
  /** One user-authorized attempt; [] advances without checkout. Parent advances to Pi after verified success. */
  onProceed: (fullNames: string[]) => void;
  onRefresh?: () => void;
  /** Read-only server-side status reconciliation; must never start a new checkout. */
  onRecheck?: () => void;
  /** Leave a failed selection to choose other repos; never retry the write. */
  onEditSelection?: () => void;
}

export function GitHubRepoChooser({
  view,
  selectedNames,
  checkout,
  onToggle,
  onProceed,
  onRefresh,
  onRecheck,
  onEditSelection,
}: GitHubRepoChooserProps) {
  // Lock synchronously: a second click must not POST again before the parent rerenders.
  const started = useRef(false);
  const [waiting, setWaiting] = useState(false);
  const [filter, setFilter] = useState("");
  const previousPhase = useRef(checkout.phase);
  useEffect(() => {
    if (checkout.phase === "idle" && previousPhase.current !== "idle") {
      started.current = false;
      setWaiting(false);
    }
    previousPhase.current = checkout.phase;
  }, [checkout.phase]);

  const idle = checkout.phase === "idle";
  const selection = new Set(selectedNames);
  const visible =
    view.phase === "catalog"
      ? view.repositories.filter((repo) =>
          repo.full_name
            .toLocaleLowerCase()
            .includes(filter.trim().toLocaleLowerCase()),
        )
      : [];
  const confirmed =
    checkout.phase === "confirmed" &&
    checkout.names.length === selectedNames.length &&
    selectedNames.every((name) => checkout.names.includes(name));
  return (
    <section className={styles.card} aria-labelledby="github-chooser-title">
      <header className={styles.header}>
        <p className="ah-eyebrow">Käyttöönotto</p>
        <h1 id="github-chooser-title" tabIndex={-1}>
          Valitse GitHub-repot haettaviksi
        </h1>
        <p id="github-chooser-instructions">
          Valitse repot, joita haluat käyttää täällä. Jatka-painike hakee ne
          työtiloiksi ennen ChatGPT-kirjautumista. Voit myös jatkaa ilman
          valintoja.
        </p>
      </header>

      {view.phase === "loading" ? (
        <p role="status">Haetaan GitHub-repoja…</p>
      ) : null}
      {view.phase === "no-auth" ? (
        <InlineNotice
          title="GitHub-kirjautuminen puuttuu"
          description="Repoja ei voi näyttää ennen GitHub-kirjautumista. Voit jatkaa ilman repoja."
          tone="warning"
        />
      ) : null}
      {view.phase === "unavailable" ? (
        <InlineNotice
          title="Repoja ei voitu hakea"
          description="Tilaa ei tunneta. Tarkista yhteys ennen jatkamista."
          tone="danger"
          actions={
            onRefresh
              ? [{ label: "Tarkista uudelleen", onPress: onRefresh }]
              : []
          }
        />
      ) : null}
      {view.phase === "catalog" ? (
        <>
          <label className={styles.filter}>
            Etsi repoa nimellä
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </label>
          {view.repositories.length === 0 ? (
            <p role="status">Repoja ei löytynyt. Voit jatkaa ilman repoja.</p>
          ) : visible.length === 0 ? (
            <p role="status">Hakua vastaavia repoja ei löytynyt.</p>
          ) : (
            <ul className={styles.list} aria-label="GitHub-repot">
              {visible.map((repo) => (
                <li key={repo.full_name} className={styles.row}>
                  <label className={styles.choice}>
                    <input
                      type="checkbox"
                      aria-describedby="github-chooser-instructions"
                      checked={selection.has(repo.full_name)}
                      disabled={!idle || waiting}
                      onChange={(event) => {
                        if (idle && !started.current) {
                          onToggle(repo.full_name, event.target.checked);
                        }
                      }}
                    />
                    <span className={styles.details}>
                      <span className={styles.name}>
                        <code>{repo.full_name}</code>
                        {repo.private ? <Badge label="Yksityinen" /> : null}
                      </span>
                      <span className={styles.description}>
                        Viimeksi päivitetty:{" "}
                        {repo.pushed_at
                          ? new Intl.DateTimeFormat("fi-FI", {
                              timeZone: "UTC",
                              year: "numeric",
                              month: "numeric",
                              day: "numeric",
                            }).format(new Date(repo.pushed_at))
                          : "Ei tiedossa"}
                      </span>
                      {repo.description ? (
                        <span className={styles.description}>
                          {repo.description}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {checkout.phase === "progress" || checkout.phase === "partial" ? (
        <>
          <ProgressIndicator
            label={`Haettu ${checkout.completed}/${checkout.total} repoa`}
            kind="determinate"
            value={
              checkout.total > 0
                ? (checkout.completed / checkout.total) * 100
                : 0
            }
          />
          {checkout.phase === "progress" &&
          checkout.completed < selectedNames.length ? (
            <p role="status" className={styles.current}>
              Haetaan nyt: <code>{selectedNames[checkout.completed]}</code>.
              {checkout.stage
                ? ` ${{ reserving: "Varataan kohdetta", connecting: "Yhdistetään", receiving: "Vastaanotetaan objekteja", checkout: "Kirjoitetaan tiedostoja", verifying: "Tarkistetaan" }[checkout.stage]}${checkout.percent === undefined ? "…" : ` ${checkout.percent} %`}${checkout.receivedBytes === undefined ? "" : ` (${new Intl.NumberFormat("fi-FI").format(checkout.receivedBytes)} tavua)`}.`
                : " Suuren repon haku voi kestää."}{" "}
              Valmiiden määrä muuttuu vasta, kun haku on tarkistettu.
            </p>
          ) : null}
          {checkout.phase === "partial" ? (
            <InlineNotice
              title="Osa repoista haettiin"
              description="Kaikkien hakujen tulosta ei voitu vahvistaa. Tarkista tilanne ennen kuin jatkat. Haku ei käynnisty uudelleen itsestään."
              tone="warning"
              actions={
                onRecheck
                  ? [{ label: "Tarkista haun tila", onPress: onRecheck }]
                  : []
              }
            />
          ) : null}
        </>
      ) : null}
      {checkout.phase === "uncertain" ? (
        <InlineNotice
          title="Haun tulos on epäselvä"
          description="Tarkista, ehtikö repo tulla työtiloihin. Haku ei käynnisty uudelleen itsestään."
          tone="warning"
          actions={
            onRecheck
              ? [{ label: "Tarkista haun tila", onPress: onRecheck }]
              : []
          }
        />
      ) : null}
      {(checkout.phase === "partial" || checkout.phase === "uncertain") &&
      onEditSelection ? (
        <Button
          label="Muuta valintaa"
          variant="secondary"
          onPress={onEditSelection}
        />
      ) : null}
      {confirmed ? (
        <p role="status">Repot on haettu. Siirrytään ChatGPT-kirjautumiseen.</p>
      ) : null}
      {checkout.phase === "confirmed" && !confirmed ? (
        <InlineNotice
          title="Valintaa ei ole vahvistettu"
          description="Nykyinen valinta eroaa vahvistetuista repoista. Tarkista tila ennen jatkamista."
          tone="warning"
          actions={
            onRecheck
              ? [{ label: "Tarkista haun tila", onPress: onRecheck }]
              : []
          }
        />
      ) : null}
      {(view.phase === "catalog" ||
        (view.phase === "no-auth" && selectedNames.length === 0)) &&
      idle ? (
        <div className={styles.footer}>
          {view.phase === "catalog" ? (
            <p role="status" aria-live="polite" className={styles.count}>
              Valittu {selectedNames.length}{" "}
              {selectedNames.length === 1 ? "repo" : "repoa"}.
            </p>
          ) : null}
          <div className={styles.actions}>
            <Button
              label={
                selectedNames.length
                  ? "Hae valitut ja jatka"
                  : "Jatka ilman repoja"
              }
              availability={
                waiting
                  ? { state: "disabled", reason: "Odotetaan haun tulosta." }
                  : undefined
              }
              onPress={() => {
                if (started.current) return;
                started.current = true;
                setWaiting(true);
                onProceed(view.phase === "catalog" ? [...selectedNames] : []);
              }}
            />
          </div>
        </div>
      ) : view.phase === "catalog" ? (
        <p role="status" aria-live="polite" className={styles.count}>
          Valittu {selectedNames.length}{" "}
          {selectedNames.length === 1 ? "repo" : "repoa"}.
        </p>
      ) : null}
    </section>
  );
}
