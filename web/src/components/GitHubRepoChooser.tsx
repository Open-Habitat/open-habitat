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
  onCheckout: (fullNames: string[]) => void;
  onMore?: () => void;
  onRefresh?: () => void;
  onSkip: () => void;
  onContinue: () => void;
}

export function GitHubRepoChooser({
  view,
  selectedNames,
  checkout,
  onToggle,
  onCheckout,
  onMore,
  onRefresh,
  onSkip,
  onContinue,
}: GitHubRepoChooserProps) {
  const busy = checkout.phase !== "idle" && checkout.phase !== "confirmed";
  const confirmed =
    checkout.phase === "confirmed" &&
    selectedNames.length > 0 &&
    checkout.names.length === selectedNames.length &&
    selectedNames.every((name) => checkout.names.includes(name));
  const selection = new Set(selectedNames);
  return (
    <section className={styles.card} aria-labelledby="github-chooser-title">
      <header className={styles.header}>
        <p className="ah-eyebrow">Käyttöönotto</p>
        <h2 id="github-chooser-title">Valitse GitHub-repot haettaviksi</h2>
        <p>
          Valinta ei vielä hae mitään. Vahvista haettavat repot erikseen ennen
          Pi-kirjautumista.
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
          description="Tilaa ei tunneta. Tarkista yhteys ennen uutta yritystä tai jatka ilman repoja."
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
                      checked={selection.has(repo.full_name)}
                      disabled={busy || confirmed}
                      onChange={(event) =>
                        onToggle(repo.full_name, event.target.checked)
                      }
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
                busy || confirmed || view.loadingMore || !onMore
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
            />
          ) : null}
        </>
      ) : null}
      {checkout.phase === "uncertain" ? (
        <InlineNotice
          title="Haun tulosta ei tunneta"
          description="Tarkista palvelimen tila. Älä aloita samaa hakua uudelleen ennen kuin tulos on vahvistettu."
          tone="warning"
        />
      ) : null}
      {confirmed ? (
        <p role="status">
          Valitut repot on vahvistettu haetuiksi. Voit jatkaa Pi-kirjautumiseen.
        </p>
      ) : null}
      {checkout.phase === "confirmed" && !confirmed ? (
        <InlineNotice
          title="Valintaa ei ole vahvistettu"
          description="Nykyinen valinta eroaa vahvistetuista repoista. Tarkista tila ennen jatkamista."
          tone="warning"
        />
      ) : null}
      <div className={styles.actions}>
        {view.phase === "catalog" && checkout.phase === "idle" ? (
          <Button
            label={`Hae valitut repot (${selectedNames.length})`}
            onPress={() => onCheckout([...selectedNames])}
            availability={
              selectedNames.length === 0
                ? { state: "disabled", reason: "Valitse vähintään yksi repo." }
                : undefined
            }
          />
        ) : null}
        {confirmed ? (
          <Button label="Jatka Pi-kirjautumiseen" onPress={onContinue} />
        ) : null}
        {checkout.phase === "idle" ? (
          <Button
            label="Jatka ilman repoja"
            variant="secondary"
            onPress={onSkip}
          />
        ) : null}
      </div>
    </section>
  );
}
