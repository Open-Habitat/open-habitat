import { useEffect, useRef, useState } from "react";
import { Button } from "./Primitives";
import { Badge, InlineNotice, ProgressIndicator } from "./Status";
import styles from "./GitHubRepoChooser.module.css";

/** Display model only. The parent owns paging, selection, native checkout and reconciliation. */
export interface GitHubRepoChoice {
  full_name: string;
  private: boolean;
  description: string;
}

export type GitHubRepoChooserView =
  | { phase: "loading" | "no-auth" | "unavailable" }
  | {
      phase: "catalog";
      repositories: GitHubRepoChoice[];
      hasMore: boolean;
      loadingMore?: boolean;
    };

export type GitHubCheckoutView =
  | { phase: "idle" }
  | { phase: "progress"; completed: number; total: number }
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
  onMore?: () => void;
  onRefresh?: () => void;
  /** Read-only server-side status reconciliation; must never start a new checkout. */
  onRecheck?: () => void;
}

export function GitHubRepoChooser({
  view,
  selectedNames,
  checkout,
  onToggle,
  onProceed,
  onMore,
  onRefresh,
  onRecheck,
}: GitHubRepoChooserProps) {
  // Lock synchronously: a second click must not POST again before the parent rerenders.
  const started = useRef(false);
  const [waiting, setWaiting] = useState(false);
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
  const confirmed =
    checkout.phase === "confirmed" &&
    checkout.names.length === selectedNames.length &&
    selectedNames.every((name) => checkout.names.includes(name));
  return (
    <section className={styles.card} aria-labelledby="github-chooser-title">
      <header className={styles.header}>
        <p className="ah-eyebrow">Käyttöönotto</p>
        <h2 id="github-chooser-title">Valitse GitHub-repot haettaviksi</h2>
        <p id="github-chooser-instructions">
          Valitse haluamasi repot ja paina Jatka. Silloin valitut repot haetaan
          koneelle ennen Pi-kirjautumista. Ilman valintoja jatkat ilman repoja.
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
          {view.repositories.length === 0 ? (
            <p>Repoja ei löytynyt. Voit jatkaa ilman repoja.</p>
          ) : (
            <ul className={styles.list} aria-label="GitHub-repot">
              {view.repositories.map((repo) => (
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
          {view.hasMore ? (
            <Button
              label="Näytä lisää repoja"
              variant="secondary"
              pending={view.loadingMore}
              availability={
                !idle || waiting || view.loadingMore || !onMore
                  ? {
                      state: "disabled",
                      reason: "Odota nykyisen vaiheen valmistumista.",
                    }
                  : undefined
              }
              onPress={() => onMore?.()}
            />
          ) : null}
          <p role="status" aria-live="polite">
            Valittu {selectedNames.length} repoa.
          </p>
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
          {checkout.phase === "partial" ? (
            <InlineNotice
              title="Vain osa repoista vahvistettu"
              description="Tarkista palvelimen tila ennen jatkamista. Valintaa ei lähetetä automaattisesti uudelleen."
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
          title="Haun tulosta ei tunneta"
          description="Tarkista palvelimen tila. Älä aloita samaa hakua uudelleen ennen kuin tulos on vahvistettu."
          tone="warning"
          actions={
            onRecheck
              ? [{ label: "Tarkista haun tila", onPress: onRecheck }]
              : []
          }
        />
      ) : null}
      {confirmed ? (
        <p role="status">
          Valitut repot on vahvistettu haetuiksi. Siirrytään Pi-kirjautumiseen.
        </p>
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
        <div className={styles.actions}>
          <Button
            label="Jatka"
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
      ) : null}
    </section>
  );
}
