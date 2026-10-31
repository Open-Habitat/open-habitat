import { type ReactNode, useState } from "react";
import { formatDate, useText } from "../i18n";
import { githubRepoChooserText } from "../text/githubRepoChooser";
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
  const t = useText(githubRepoChooserText);
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
          <p className="ah-eyebrow">{t.eyebrow}</p>
          <h1
            data-testid="repository-chooser-title"
            id="github-chooser-title"
            tabIndex={-1}
          >
            {t.title}
          </h1>
          <p id="github-chooser-instructions">{t.instructions}</p>
        </header>

        {view.phase === "loading" ? <p role="status">{t.loading}</p> : null}
        {view.phase === "no-auth" ? (
          <InlineNotice
            title={t.noAuthTitle}
            description={t.noAuth}
            tone="warning"
          />
        ) : null}
        {view.phase === "unavailable" ? (
          <InlineNotice
            data-testid="repository-unavailable"
            title={t.unavailableTitle}
            description={t.unavailable}
            tone="danger"
            actions={
              onRefresh ? [{ label: t.recheck, onPress: onRefresh }] : []
            }
          />
        ) : null}
        {view.phase === "catalog" ? (
          <>
            <label className={styles.filter}>
              {t.filter}
              <input
                type="search"
                data-testid="repository-search"
                autoComplete="off"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
            </label>
            <div className={styles.recent}>
              <label htmlFor="repo-time-range">{t.updated}</label>
              <select
                data-testid="repository-time-range"
                id="repo-time-range"
                aria-label={t.range}
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
              >
                <option value={0}>{t.anyTime}</option>
                <option value={7}>{t.week}</option>
                <option value={30}>{t.month}</option>
                <option value={90}>{t.quarter}</option>
                <option value={365}>{t.year}</option>
              </select>
              {days > 0 && matches.length !== visible.length ? (
                <span className={styles.hidden}>
                  {t.hidden(matches.length - visible.length)}
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
                    ? t.unselectVisible
                    : t.selectVisible
                }
                availability={
                  busy ? { state: "disabled", reason: t.movingOn } : undefined
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
              <p role="status">{t.none}</p>
            ) : visible.length === 0 && lockedRows.length === 0 ? (
              <p role="status">{t.noMatches}</p>
            ) : (
              <ul
                data-testid="repository-list"
                className={styles.list}
                aria-label={t.listLabel}
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
                          {repo.private ? <Badge label={t.private} /> : null}
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
                    <span className={styles.choice}>{t.noOtherMatches}</span>
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
                          {repo.private ? <Badge label={t.private} /> : null}
                        </span>
                        <span
                          data-testid="repository-updated"
                          data-known={!!repo.pushed_at}
                          className={styles.description}
                        >
                          {t.lastUpdated}{" "}
                          {repo.pushed_at
                            ? formatDate(new Date(repo.pushed_at), {
                                timeZone: "UTC",
                                year: "numeric",
                                month: "numeric",
                                day: "numeric",
                              })
                            : t.unknown}
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
              {t.selected(selectedNames.length)}
              {lockedRows.length ? t.alsoSite(lockedRows.length) : null}
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
                    ? t.fetchMore(selectedNames.length)
                    : t.fetchBackground(selectedNames.length)
                  : lockedRows.length
                    ? t.continue
                    : t.continueWithout
              }
              availability={
                busy ? { state: "disabled", reason: t.movingOn } : undefined
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
