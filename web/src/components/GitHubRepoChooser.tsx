import { type ReactNode, useState } from "react";
import styles from "./GitHubRepoChooser.module.css";
import { Icon } from "./Icon";
import { OnboardingFrame } from "./OnboardingFrame";
import { Button } from "./Primitives";
import { Badge, InlineNotice } from "./Status";

/** Display model only. The parent owns the catalog, the selection and the clones. */
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

/** A repository the site already fetches for the person (automatic
 * checkout). It is shown checked and cannot be unchecked. */
export interface LockedRepo {
  full_name: string;
  /** Fetch state shown on the row, e.g. "Sivusto hakee · 42 %". */
  status: string;
}

export interface GitHubRepoChooserProps {
  view: GitHubRepoChooserView;
  selectedNames: string[];
  /** Forced selections; never part of selectedNames or onProceed. */
  locked?: LockedRepo[];
  /** Continue was pressed and the parent has not yet moved on. */
  busy?: boolean;
  onToggle: (fullName: string, selected: boolean) => void;
  /** Continues to the AI step; the parent fetches the names in the
   * background. [] continues without repositories, in every phase. */
  onProceed: (fullNames: string[]) => void;
  onRefresh?: () => void;
  notice?: ReactNode;
}

export function GitHubRepoChooser({
  view,
  selectedNames,
  locked = [],
  busy = false,
  onToggle,
  onProceed,
  onRefresh,
  notice,
}: GitHubRepoChooserProps) {
  const [filter, setFilter] = useState("");
  const [days, setDays] = useState(0);
  const selection = new Set(selectedNames);
  const lockedBy = new Map(locked.map((l) => [l.full_name, l.status]));
  // Locked rows come first and no filter hides them: they are what the site
  // has already started for the person.
  const lockedRows =
    view.phase === "catalog"
      ? view.repositories.filter((repo) => lockedBy.has(repo.full_name))
      : [];
  const matches =
    view.phase === "catalog"
      ? view.repositories.filter(
          (repo) =>
            !lockedBy.has(repo.full_name) &&
            repo.full_name
              .toLocaleLowerCase()
              .includes(filter.trim().toLocaleLowerCase()),
        )
      : [];
  const visible = matches.filter(
    (repo) =>
      days === 0 ||
      selection.has(repo.full_name) ||
      !repo.pushed_at ||
      new Date(repo.pushed_at).getTime() >= Date.now() - days * 86400000,
  );
  return (
    <OnboardingFrame step="repositories" notice={notice}>
      <section
        className={styles.card}
        data-testid="repository-chooser"
        data-phase={view.phase}
        aria-labelledby="github-chooser-title"
      >
        <header className={styles.header}>
          <p className="ah-eyebrow">Käyttöönotto</p>
          <h1
            data-testid="repository-chooser-title"
            id="github-chooser-title"
            tabIndex={-1}
          >
            Valitse GitHub-repot haettaviksi
          </h1>
          <p id="github-chooser-instructions">
            Valitse repot, joita haluat käyttää täällä. Ne haetaan työtiloiksi
            taustalla, kun jatkat AI-tilin kirjautumiseen. Voit myös jatkaa
            ilman repoja ja hakea niitä myöhemmin työtilanäkymästä.
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
            data-testid="repository-unavailable"
            title="Repoja ei voitu hakea"
            description="Tarkista yhteys ja yritä uudelleen, tai jatka ilman repoja ja hae ne myöhemmin."
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
                data-testid="repository-search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            </label>
            <div className={styles.recent}>
              <label htmlFor="repo-time-range">Päivitetty</label>
              <select
                data-testid="repository-time-range"
                id="repo-time-range"
                aria-label="Aikaväli"
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              >
                <option value={0}>Milloin tahansa</option>
                <option value={7}>Viimeisen viikon aikana</option>
                <option value={30}>Viimeisen kuukauden aikana</option>
                <option value={90}>Viimeisen kolmen kuukauden aikana</option>
                <option value={365}>Viimeisen vuoden aikana</option>
              </select>
              {days > 0 && matches.length !== visible.length ? (
                <span className={styles.hidden}>
                  Piilotettu {matches.length - visible.length}
                </span>
              ) : null}
            </div>
            {visible.length > 0 ? (
              <Button
                size="row"
                variant="secondary"
                data-testid="repository-toggle-visible"
                label={
                  visible.every((repo) => selection.has(repo.full_name))
                    ? "Poista näkyvien valinnat"
                    : "Valitse kaikki näkyvät"
                }
                availability={
                  busy
                    ? { state: "disabled", reason: "Siirrytään eteenpäin." }
                    : undefined
                }
                onPress={() => {
                  const select = !visible.every((repo) =>
                    selection.has(repo.full_name),
                  );
                  for (const repo of visible) {
                    if (selection.has(repo.full_name) !== select)
                      onToggle(repo.full_name, select);
                  }
                }}
              />
            ) : null}
            {view.repositories.length === 0 ? (
              <p role="status">Repoja ei löytynyt. Voit jatkaa ilman repoja.</p>
            ) : visible.length === 0 && lockedRows.length === 0 ? (
              <p role="status">Hakua vastaavia repoja ei löytynyt.</p>
            ) : (
              <ul
                data-testid="repository-list"
                className={styles.list}
                aria-label="GitHub-repot"
              >
                {lockedRows.map((repo) => (
                  <li
                    key={repo.full_name}
                    className={`${styles.row} ${styles.locked}`}
                    data-testid={`repository-locked-${repo.full_name}`}
                  >
                    <label className={styles.choice}>
                      <input
                        type="checkbox"
                        data-testid={`repository-${repo.full_name}`}
                        aria-describedby={`locked-${repo.full_name}`}
                        checked
                        disabled
                        readOnly
                      />
                      <span className={styles.details}>
                        <span className={styles.name}>
                          <code
                            data-testid={`repository-name-${repo.full_name}`}
                          >
                            {repo.full_name}
                          </code>
                          {repo.private ? <Badge label="Yksityinen" /> : null}
                        </span>
                        <span
                          id={`locked-${repo.full_name}`}
                          className={styles.lockedStatus}
                          data-testid="repository-locked-status"
                        >
                          <Icon name="lock" width={12} height={12} />
                          {lockedBy.get(repo.full_name)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
                {visible.length === 0 ? (
                  <li className={styles.row} role="status">
                    <span className={styles.choice}>
                      Hakua vastaavia muita repoja ei löytynyt.
                    </span>
                  </li>
                ) : null}
                {visible.map((repo) => (
                  <li key={repo.full_name} className={styles.row}>
                    <label className={styles.choice}>
                      <input
                        type="checkbox"
                        data-testid={`repository-${repo.full_name}`}
                        aria-describedby="github-chooser-instructions"
                        checked={selection.has(repo.full_name)}
                        disabled={busy}
                        onChange={(event) =>
                          onToggle(repo.full_name, event.target.checked)
                        }
                      />
                      <span className={styles.details}>
                        <span className={styles.name}>
                          <code
                            data-testid={`repository-name-${repo.full_name}`}
                          >
                            {repo.full_name}
                          </code>
                          {repo.private ? <Badge label="Yksityinen" /> : null}
                        </span>
                        <span
                          data-testid="repository-updated"
                          data-known={!!repo.pushed_at}
                          className={styles.description}
                        >
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

        <div className={styles.footer}>
          {view.phase === "catalog" ? (
            <p
              role="status"
              aria-live="polite"
              className={styles.count}
              data-testid="repository-selection"
              data-count={selectedNames.length}
            >
              Valittu {selectedNames.length}{" "}
              {selectedNames.length === 1 ? "repo" : "repoa"}.
              {lockedRows.length
                ? ` Sivusto hakee lisäksi ${lockedRows.length}.`
                : null}
            </p>
          ) : null}
          <div className={styles.actions}>
            {/* Every phase can go on without repositories: an unreadable
                catalog must never strand a new person (Jari 23.10.2026). */}
            <Button
              size="page"
              data-testid="repository-proceed"
              data-count={view.phase === "catalog" ? selectedNames.length : 0}
              label={
                view.phase === "catalog" && selectedNames.length
                  ? lockedRows.length
                    ? `Hae ${selectedNames.length} ${selectedNames.length === 1 ? "repo" : "repoa"} lisää ja jatka`
                    : `Hae ${selectedNames.length} ${selectedNames.length === 1 ? "repo" : "repoa"} taustalla ja jatka`
                  : lockedRows.length
                    ? "Jatka"
                    : "Jatka ilman repoja"
              }
              availability={
                busy
                  ? { state: "disabled", reason: "Siirrytään eteenpäin." }
                  : undefined
              }
              onPress={() =>
                onProceed(view.phase === "catalog" ? [...selectedNames] : [])
              }
            />
          </div>
        </div>
      </section>
    </OnboardingFrame>
  );
}
