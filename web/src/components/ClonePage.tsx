import { type ReactNode, useId, useState } from "react";
import { liveText } from "../i18n";
import { clonePageText } from "../text/clonePage";
import { ControlButton, LinkRow, Segmented } from "./ControlElements";
import { cloneProgressText } from "./cloneProgress";
import { Icon } from "./Icon";
import {
  type Arrangement,
  type CatalogRepo,
  largeKiB,
  repoKey,
  type Since,
  sectionLimit,
  sinceChoices,
  size,
  when,
} from "./repoCatalog";
import "./ClonePage.css";

const txt = liveText(clonePageText);

// Display only. The app owns the catalog, the route that selects a repo, the
// clone jobs and every write; these components say what they are given.

export type RepoChoice = CatalogRepo & {
  /** The route that selects this repository. */
  href: string;
  selected?: boolean;
  /** A short word beside the name: already a workspace, or its clone's state. */
  mark?: { label: string; tone: "ok" | "run" | "warn" };
  /** How the repository relates to the workspaces in ~/src. */
  workspace?: "same" | "taken" | "unknown";
};
export type LookupView =
  | { state: "searching"; name: string }
  | { state: "found"; name: string; repo: RepoChoice }
  | { state: "not_found"; name: string }
  /** GitHub answered, refusing it for its organisation; reason says why
   * and what lifts it. */
  | { state: "restricted"; name: string; reason: string }
  /** GitHub could not be asked; reason says why, when the app knows. */
  | { state: "failed"; name: string; reason?: string }
  /** GitHub could not be asked, yet the name can be chosen as it is: a
   * default repository is checked at each new person's own sign-in. */
  | {
      state: "unchecked";
      name: string;
      reason: string;
      href: string;
      selected?: boolean;
    };

const kib = (n: number) => size(n * 1024);
/** A path's owner part and its last segment; a GitLab project's owner part
 * is its whole namespace. */
const split = (fullName: string) => {
  const i = fullName.lastIndexOf("/");
  return [fullName.slice(0, i), fullName.slice(i + 1)] as const;
};

/** The row's origin as the person reads it: the Gitea or GitLab server, or
 * GitHub's once the list also holds another source (workspace-import round
 * 3: every row of the common list names its source). */
const originLabel = (source: CatalogRepo["source"], mixed?: boolean) =>
  source ? source.label : mixed ? "github.com" : undefined;

function RepoRow({
  repo,
  now,
  mixed,
  sectioned,
}: {
  repo: RepoChoice;
  now: number;
  mixed?: boolean;
  /** Its owner section's heading already names the source. */
  sectioned?: boolean;
}) {
  const [owner, name] = split(repo.full_name);
  const origin = sectioned ? undefined : originLabel(repo.source, mixed);
  // In its section a GitLab project's namespace is the heading, so the row
  // names the project; elsewhere the whole path (Koko polku).
  const prefix =
    sectioned && repo.source?.provider === "gitlab" ? "" : `${owner}/`;
  return (
    <li>
      <LinkRow
        data-testid={`repository-option-${repo.full_name}`}
        data-source={repo.source?.provider ?? "github"}
        data-connection={repo.source?.id}
        data-workspace={repo.workspace}
        href={repo.href}
        kind="nav"
        current={repo.selected}
        className="ah-clone-row"
      >
        <span className="ah-clone-row-name">
          <span className="ah-mono ah-clone-path">
            {prefix ? <span className="ah-clone-owner">{prefix}</span> : null}
            <b>{name}</b>
          </span>
          {repo.private ? (
            <span className="ah-clone-lock" title={txt.private}>
              <Icon name="lock" width={12} height={12} />
              <span className="ah-visually-hidden">{txt.private}</span>
            </span>
          ) : null}
          {origin ? (
            <span className="ah-clone-chip ah-clone-source ah-mono">
              {origin}
            </span>
          ) : null}
          {repo.mark ? (
            <span className={`ah-clone-chip ah-clone-chip-${repo.mark.tone}`}>
              {repo.mark.label}
            </span>
          ) : null}
          {repo.archived ? (
            <span className="ah-clone-chip">{txt.archived}</span>
          ) : null}
          {repo.empty ? (
            <span className="ah-clone-chip">{txt.empty}</span>
          ) : null}
        </span>
        {repo.description ? (
          <span className="ah-clone-row-desc">{repo.description}</span>
        ) : null}
        <span className="ah-clone-row-meta">
          <span>{when(repo.pushed_at, now)}</span>
          <span>
            {repo.size_kib === null ? txt.sizeUnknown : kib(repo.size_kib)}
          </span>
          {(repo.size_kib ?? 0) >= largeKiB ? (
            <span className="ah-clone-big">{txt.large}</span>
          ) : null}
        </span>
      </LinkRow>
    </li>
  );
}

export function RepoFinder({
  arrangement,
  query,
  onQuery,
  since,
  onSince,
  now,
  lookup,
  incomplete,
  state,
  failure,
  sourceNotes = [],
  mixed,
}: {
  arrangement: Arrangement<RepoChoice>;
  query: string;
  onQuery: (value: string) => void;
  since: Since;
  onSince: (value: Since) => void;
  now: number;
  /** The exact owner/repo typed in the search, looked up on GitHub. */
  lookup?: LookupView;
  /** The daemon's page bound was reached: some repositories are not listed. */
  incomplete?: boolean;
  /** The catalog itself: loading, failed or read. */
  state: "loading" | "failed" | "ready";
  /** Why the catalog failed, when the app knows (a broken GitHub
   * connection), in place of the general words. */
  failure?: ReactNode;
  /** What each connected Gitea's own list says beside GitHub's: a failed or
   * incomplete source, already in words. */
  sourceNotes?: {
    key: string;
    text: string;
    failed: boolean;
    /** Where the source's connection is checked (Asetukset › Koodipalvelut). */
    fix?: { href: string; label: string };
  }[];
  /** A Gitea is connected: GitHub's rows name their source too. */
  mixed?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const searchId = useId();
  const hiddenNote = (n: number) =>
    n ? <span>{txt.hiddenByTime(n)}</span> : null;
  return (
    <div className="ah-clone-finder">
      <div className="ah-clone-find">
        <label className="ah-clone-search" htmlFor={searchId}>
          <Icon name="search" width={15} height={15} />
          <span className="ah-visually-hidden">{txt.searchLabel}</span>
          <input
            data-testid="repository-search"
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={txt.searchPlaceholder}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <Segmented
          label={txt.updated}
          className="ah-clone-since"
          options={sinceChoices}
          value={since}
          onChange={onSince}
        />
      </div>
      {state === "loading" ? (
        <p className="ah-clone-empty" role="status">
          {txt.loading}
        </p>
      ) : state === "failed" && failure ? (
        failure
      ) : state === "failed" ? (
        <p className="ah-clone-empty" role="alert">
          {txt.listFailed}
        </p>
      ) : null}
      {sourceNotes.map((n) => (
        <p
          key={n.key}
          data-testid="repository-source-note"
          data-failed={n.failed ? "" : undefined}
          className={n.failed ? "ah-clone-empty" : "ah-clone-hint"}
          role={n.failed ? "alert" : undefined}
        >
          {n.text}
          {n.fix ? (
            <>
              {" "}
              <a data-testid="repository-source-fix" href={n.fix.href}>
                {n.fix.label}
              </a>
            </>
          ) : null}
        </p>
      ))}
      {lookup ? (
        <section
          data-testid="repository-lookup"
          data-state={lookup.state}
          className="ah-clone-sec"
          aria-label={txt.lookupLabel}
        >
          <h3>
            <span className="ah-mono ah-clone-sec-owner">{lookup.name}</span>
            <span className="ah-clone-kind">{txt.fromGitHub}</span>
          </h3>
          {lookup.state === "found" ? (
            <ul>
              <RepoRow repo={lookup.repo} now={now} mixed={mixed} />
            </ul>
          ) : lookup.state === "unchecked" ? (
            <ul>
              <li>
                <LinkRow
                  data-testid={`repository-unchecked-${lookup.name}`}
                  href={lookup.href}
                  kind="nav"
                  current={lookup.selected}
                  className="ah-clone-row"
                >
                  <span className="ah-clone-row-name">
                    <span className="ah-mono ah-clone-path">
                      <span className="ah-clone-owner">
                        {split(lookup.name)[0]}/
                      </span>
                      <b>{split(lookup.name)[1]}</b>
                    </span>
                    {lookup.selected ? (
                      <span className="ah-clone-chip ah-clone-chip-ok">
                        {txt.selected}
                      </span>
                    ) : null}
                    <span
                      className={`ah-clone-chip ah-clone-chip-unchecked${lookup.selected ? " ah-clone-chip-after" : ""}`}
                    >
                      {txt.unchecked}
                    </span>
                  </span>
                  <span className="ah-clone-row-desc">{lookup.reason}</span>
                </LinkRow>
              </li>
            </ul>
          ) : (
            <p
              data-testid="repo-lookup"
              data-state={lookup.state}
              className="ah-clone-empty"
              role={lookup.state === "searching" ? "status" : undefined}
            >
              {lookup.state === "searching"
                ? txt.searching
                : lookup.state === "not_found"
                  ? txt.notFound
                  : (lookup.reason ?? txt.lookupFailed)}
            </p>
          )}
        </section>
      ) : null}
      {arrangement.kind === "search" ? (
        arrangement.hits.length ? (
          <section className="ah-clone-sec">
            <h3>
              {txt.results}{" "}
              <span className="ah-clone-n">{arrangement.hits.length}</span>
            </h3>
            <ul>
              {arrangement.hits.map((r) => (
                <RepoRow key={repoKey(r)} repo={r} now={now} mixed={mixed} />
              ))}
            </ul>
            <p className="ah-clone-secfoot">{hiddenNote(arrangement.hidden)}</p>
          </section>
        ) : state === "ready" && !lookup ? (
          <p className="ah-clone-empty">
            {txt.noHits(<b>{query.trim()}</b>, arrangement.hidden)}
          </p>
        ) : null
      ) : (
        <>
          {arrangement.recent.length ? (
            <section className="ah-clone-sec">
              <h3>{txt.recent}</h3>
              <ul>
                {arrangement.recent.map((r) => (
                  <RepoRow key={repoKey(r)} repo={r} now={now} mixed={mixed} />
                ))}
              </ul>
            </section>
          ) : null}
          {arrangement.sections.map((s) => {
            const all = open[s.key];
            const shown = all ? s.fresh : s.fresh.slice(0, sectionLimit);
            return (
              <section className="ah-clone-sec" key={s.key}>
                <h3
                  data-testid={`repo-owner-${s.owner}`}
                  data-source={s.source?.provider ?? "github"}
                >
                  <span className="ah-mono ah-clone-sec-owner">{s.owner}</span>
                  {originLabel(s.source, mixed) ? (
                    <span className="ah-clone-chip ah-clone-source ah-mono">
                      {originLabel(s.source, mixed)}
                    </span>
                  ) : null}
                  <span className="ah-clone-kind">{txt.kinds[s.kind]}</span>
                  <span className="ah-clone-n">{s.total}</span>
                </h3>
                {shown.length ? (
                  <ul>
                    {shown.map((r) => (
                      <RepoRow
                        key={repoKey(r)}
                        repo={r}
                        now={now}
                        mixed={mixed}
                        sectioned
                      />
                    ))}
                  </ul>
                ) : null}
                <p className="ah-clone-secfoot">
                  {s.fresh.length > sectionLimit ? (
                    <ControlButton
                      data-testid="expand-repos"
                      size="inline"
                      variant="quiet"
                      aria-expanded={!!all}
                      onPress={() => setOpen({ ...open, [s.key]: !all })}
                    >
                      {all ? txt.showLess : txt.showAll(s.fresh.length)}
                    </ControlButton>
                  ) : null}
                  {hiddenNote(s.hidden)}
                </p>
              </section>
            );
          })}
        </>
      )}
      {incomplete ? <p className="ah-clone-hint">{txt.truncated}</p> : null}
    </div>
  );
}

export type DetailsState =
  | { kind: "ready" }
  | { kind: "workspace"; onOpen: () => void; path: string }
  /** unknown: the directory's origin could not be compared with this
   * repository's, so it is neither called this repository nor replaced. */
  | { kind: "taken"; path: string; unknown?: boolean }
  | { kind: "job" };

export function CloneMode({
  name,
  repo,
  mode,
  onMode,
  legend,
}: {
  name: string;
  repo?: Pick<CatalogRepo, "size_kib">;
  mode: "full" | "blobless";
  onMode: (mode: "full" | "blobless") => void;
  legend?: string;
}) {
  return (
    <fieldset className="ah-clone-mode">
      <legend>{legend ?? txt.cloning}</legend>
      <label>
        <input
          type="radio"
          name={name}
          checked={mode === "full"}
          onChange={() => onMode("full")}
        />
        <span>
          <b>{txt.full}</b>
          {repo?.size_kib != null ? txt.fullAbout(kib(repo.size_kib)) : ""}
          {txt.fullText}
        </span>
      </label>
      <label>
        <input
          data-testid="blobless-clone"
          type="radio"
          name={name}
          checked={mode === "blobless"}
          onChange={() => onMode("blobless")}
        />
        <span>
          <b>{txt.blobless}</b>
          {txt.bloblessText(
            <code>--filter=blob:none</code>,
            <code>git log -p</code>,
            <code>blame</code>,
          )}
        </span>
      </label>
    </fieldset>
  );
}

export type PushState = "yes" | "no" | "unknown" | "expired";

export function RepoDetails({
  repo,
  now,
  back,
  free,
  state,
  mode,
  onMode,
  onClone,
  cloneReason,
  problem,
  push,
}: {
  repo?: CatalogRepo;
  now: number;
  /** On a phone the list and the details are shown one at a time. */
  back?: string;
  /** limit_bytes is absent when the installation has no per-user limits. */
  free?: { free_bytes: number; limit_bytes?: number };
  state: DetailsState;
  mode: "full" | "blobless";
  onMode: (mode: "full" | "blobless") => void;
  onClone: () => void;
  /** Why Kloonaa cannot be pressed now, said beside it. */
  cloneReason?: string;
  problem?: string;
  /** A GitLab connection's push readiness, as GitLab says it now. */
  push?: PushState;
}) {
  if (!repo)
    return (
      <aside
        data-testid="repo-details"
        className="ah-clone-detail ah-clone-none"
        aria-label={txt.details}
      >
        <p>{txt.choose}</p>
      </aside>
    );
  const [owner, name] = split(repo.full_name);
  const gitea = repo.source;
  const gitlab = gitea?.provider === "gitlab";
  // A Gitea or GitLab clone is always full: no partial-clone assumptions.
  const big = !gitea && (repo.size_kib ?? 0) >= largeKiB;
  const sizeKiB = repo.size_kib ?? 0;
  const reasonId = `clone-reason-${name}`;
  return (
    <aside
      data-testid="repo-details"
      data-state={
        state.kind === "taken" && state.unknown ? "unknown" : state.kind
      }
      className="ah-clone-detail"
      aria-label={txt.details}
    >
      {back ? (
        <LinkRow
          data-testid="all-repos"
          href={back}
          kind="inline"
          className="ah-clone-back"
        >
          <Icon name="back" width={15} height={15} />
          {txt.allRepos}
        </LinkRow>
      ) : null}
      <h2 className="ah-mono ah-clone-path">
        <span className="ah-clone-owner">{owner}/</span>
        {name}
      </h2>
      {repo.description ? (
        <p className="ah-clone-desc">{repo.description}</p>
      ) : null}
      <dl className="ah-clone-facts">
        {gitea ? (
          <>
            <dt>{txt.source}</dt>
            <dd>
              <span className="ah-mono" data-testid="repo-details-source">
                {gitea.login} · {gitlab ? `GitLab ${gitea.label}` : gitea.label}
              </span>
            </dd>
          </>
        ) : null}
        {gitlab && owner.includes("/") ? (
          <>
            <dt>{txt.group}</dt>
            <dd data-testid="repo-details-group">
              {owner.split("/").join(" › ")}
            </dd>
          </>
        ) : null}
        <dt>{txt.visibility}</dt>
        <dd>
          {repo.visibility === "internal" ? (
            txt.internal
          ) : repo.private ? (
            <>
              <Icon
                name="lock"
                width={12}
                height={12}
                className="ah-clone-ic-muted"
              />
              {txt.private}
            </>
          ) : (
            txt.public
          )}
        </dd>
        {repo.archived ? (
          <>
            <dt>{txt.state}</dt>
            <dd>{txt.archivedIn(gitlab)}</dd>
          </>
        ) : null}
        <dt>{txt.defaultBranch}</dt>
        <dd>
          <span className="ah-mono">{repo.default_branch ?? txt.noBranch}</span>
        </dd>
        <dt>{gitlab ? txt.lastActivity : txt.lastPush}</dt>
        <dd>{when(repo.pushed_at, now)}</dd>
        <dt>{txt.size}</dt>
        <dd>
          {repo.size_kib === null ? (
            <>
              {txt.unknown}{" "}
              <span className="ah-clone-sub">{txt.gitlabSizeRole}</span>
            </>
          ) : (
            <>
              {kib(repo.size_kib)}{" "}
              <span className="ah-clone-sub">
                {gitlab
                  ? txt.gitlabSize
                  : gitea
                    ? txt.giteaSize
                    : txt.githubSize}
              </span>
            </>
          )}
        </dd>
        {push ? (
          <>
            <dt>{txt.pushLabel}</dt>
            <dd data-testid="repo-details-push">{txt.push[push]}</dd>
          </>
        ) : null}
        <dt>{txt.target}</dt>
        <dd>
          <span className="ah-mono">~/src/{name}</span>
        </dd>
        {free ? (
          <>
            <dt>{txt.free}</dt>
            <dd>
              {size(free.free_bytes)}{" "}
              <span className="ah-clone-sub">
                {free.limit_bytes === undefined
                  ? txt.sharedDisk
                  : txt.ofQuota(size(free.limit_bytes))}
              </span>
            </dd>
          </>
        ) : null}
      </dl>
      {state.kind === "workspace" ? (
        <>
          <p className="ah-clone-note ah-clone-note-ok">
            <Icon
              name="check"
              width={15}
              height={15}
              className="ah-clone-ic-ok"
            />
            <span>
              {txt.alreadyWorkspace(
                <span className="ah-mono">{state.path}</span>,
              )}
            </span>
          </p>
          <div className="ah-clone-actions">
            <ControlButton
              data-testid="cloned-workspace-open"
              size="row"
              variant="primary"
              onPress={state.onOpen}
            >
              {txt.openWorkspace}
            </ControlButton>
          </div>
        </>
      ) : state.kind === "taken" ? (
        <p className="ah-clone-note ah-clone-note-warn">
          <Icon
            name="warning"
            width={15}
            height={15}
            className="ah-clone-ic-warn"
          />
          {state.unknown ? (
            <span>
              {txt.takenUnknown(<span className="ah-mono">{state.path}</span>)}
            </span>
          ) : (
            <span>
              {txt.taken(<span className="ah-mono">{state.path}</span>)}
            </span>
          )}
        </p>
      ) : state.kind === "job" ? (
        <p className="ah-clone-note">
          <Icon
            name="info"
            width={15}
            height={15}
            className="ah-clone-ic-muted"
          />
          <span>{txt.jobShown}</span>
        </p>
      ) : (
        <>
          {big ? (
            <>
              <p className="ah-clone-note ah-clone-note-warn">
                <Icon
                  name="warning"
                  width={15}
                  height={15}
                  className="ah-clone-ic-warn"
                />
                <span>
                  <b>{txt.bigTitle}</b>
                  {txt.big(
                    kib(sizeKiB),
                    free && free.free_bytes > 0
                      ? Math.round((100 * sizeKiB * 1024) / free.free_bytes)
                      : undefined,
                  )}
                </span>
              </p>
              <CloneMode
                name={`mode-${repo.full_name}`}
                repo={repo}
                mode={mode}
                onMode={onMode}
              />
            </>
          ) : null}
          {problem ? (
            <p className="ah-clone-problem" role="alert">
              {problem}
            </p>
          ) : null}
          <div className="ah-clone-actions">
            <ControlButton
              data-testid="repository-clone"
              size="page"
              variant="primary"
              isDisabled={!!cloneReason}
              aria-describedby={cloneReason ? reasonId : undefined}
              onPress={onClone}
            >
              <Icon name={gitea ? "branch" : "github"} />
              {txt.clone}
            </ControlButton>
          </div>
          <p className="ah-clone-hint" id={reasonId}>
            {cloneReason ??
              (gitlab ? txt.viaGitLab : gitea ? txt.viaGitea : txt.viaGitHub)}
          </p>
        </>
      )}
    </aside>
  );
}

type Stage =
  | "reserving"
  | "connecting"
  | "receiving"
  | "checkout"
  | "verifying";
const reasonText = (code: string | undefined) =>
  code && Object.hasOwn(txt.reasons, code) ? txt.reasons[code] : undefined;
// Bar position by stage: receiving is most of the work.
const bar = (stage: Stage | undefined, percent = 0) =>
  stage === "receiving"
    ? percent * 0.85
    : stage === "checkout"
      ? 85 + percent * 0.13
      : stage === "verifying"
        ? 99
        : 2;

export type CloneCardView =
  | {
      kind: "job";
      full_name: string;
      /** A Gitea or GitLab clone names its connection and repository. */
      source?: {
        provider: "gitea" | "gitlab";
        connection_id: string;
        repository_id: number;
      };
      mode: "full" | "blobless";
      state: "running" | "confirmed" | "failed" | "cancelled";
      stage?: Stage;
      percent?: number;
      received_bytes?: number;
      reason?: string;
      leftover?: "removed" | "kept";
    }
  | {
      kind: "interrupted";
      full_name: string;
      size_bytes: number;
      /** A Gitea or GitLab clone; restart is offered only with its
       * connection. */
      source?: { provider: "gitea" | "gitlab"; connection_id?: string };
    }
  | {
      /** Asked for in this tab and not yet a job: the daemon runs one at a time. */
      kind: "queued";
      full_name: string;
      mode: "full" | "blobless";
      state: "waiting" | "refused";
      /** Why the start was refused, already in words. */
      refusal?: string;
      /** The start's reply was lost: whether it began is not yet known. */
      unsettled?: boolean;
    };

export function CloneCard({
  view,
  large,
  busy,
  problem,
  writeReason,
  onOpen,
  onCancel,
  onRetry,
  onDismiss,
  onRestart,
  onRemove,
}: {
  view: CloneCardView;
  /** The repository is large: a restart offers the light clone. */
  large?: boolean;
  /** An action of this card is on its way. */
  busy?: boolean;
  problem?: string;
  /** Why no write can be sent now (connection, read-only host). */
  writeReason?: string;
  /** Opens a confirmed clone's workspace, once the workspace list shows it. */
  onOpen?: () => void;
  onCancel?: () => void;
  onRetry?: (mode: "full" | "blobless") => void;
  onDismiss?: () => void;
  onRestart?: (mode: "full" | "blobless") => void;
  onRemove?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [mode, setMode] = useState<"full" | "blobless">(
    view.kind === "job" ? view.mode : "full",
  );
  const name = split(view.full_name)[1];
  const dest = `~/src/${name}`;
  const off = busy || !!writeReason;
  const state =
    view.kind === "interrupted"
      ? "interrupted"
      : view.kind === "queued"
        ? view.state === "waiting"
          ? "running"
          : "failed"
        : view.state === "cancelled"
          ? "failed"
          : view.state;
  let body: ReactNode = null;
  let actions: ReactNode = null;
  if (view.kind === "job" && view.state === "running") {
    const received = view.received_bytes;
    body = (
      <>
        <div
          className="ah-clone-bar"
          role="progressbar"
          aria-label={txt.progressOf(view.full_name)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={view.stage === "receiving" ? view.percent : undefined}
        >
          <span style={{ width: `${bar(view.stage, view.percent)}%` }} />
        </div>
        <p className="ah-clone-line" role="status">
          {cloneProgressText(view.stage, view.percent, received)}
        </p>
        <p className="ah-clone-hint">{txt.continuesOnServer}</p>
      </>
    );
    actions = confirm ? (
      <div className="ah-clone-confirm">
        <span>{txt.cancelQuestion(received ? size(received) : undefined)}</span>
        <ControlButton
          data-testid="continue-clone"
          size="row"
          onPress={() => setConfirm(false)}
        >
          {txt.continueClone}
        </ControlButton>
        <ControlButton
          data-testid="cancel-clone"
          size="row"
          variant="danger"
          isDisabled={off}
          onPress={() => {
            setConfirm(false);
            onCancel?.();
          }}
        >
          {txt.cancel}
        </ControlButton>
      </div>
    ) : (
      <div className="ah-clone-actions">
        <ControlButton
          data-testid="cancel-clone"
          size="row"
          isDisabled={off}
          title={writeReason}
          onPress={() => setConfirm(true)}
        >
          {txt.cancel}
        </ControlButton>
      </div>
    );
  } else if (view.kind === "job" && view.state === "confirmed") {
    body = <p>{txt.done(<span className="ah-mono">{dest}</span>)}</p>;
    actions = (
      <div className="ah-clone-actions">
        <ControlButton
          data-testid="dialog-close"
          size="row"
          isDisabled={off}
          title={writeReason}
          onPress={onDismiss}
        >
          {txt.close}
        </ControlButton>
        {onOpen ? (
          <ControlButton
            data-testid="cloned-workspace-open"
            size="row"
            variant="primary"
            onPress={onOpen}
          >
            {txt.openWorkspace}
          </ControlButton>
        ) : (
          <span className="ah-clone-hint" role="status">
            {txt.waitingList}
          </span>
        )}
      </div>
    );
  } else if (view.kind === "job") {
    const kept = view.leftover === "kept";
    body = (
      <>
        <p data-testid="clone-failed" className="ah-clone-title">
          {view.state === "cancelled" ? txt.cancelled : txt.failed}
        </p>
        <p>
          {view.state === "cancelled"
            ? ""
            : `${reasonText(view.reason) ?? ""} `}
          {kept ? txt.kept(dest) : txt.removed}
        </p>
      </>
    );
    actions = (
      <div className="ah-clone-actions">
        <ControlButton
          size="row"
          isDisabled={off}
          title={writeReason}
          onPress={onDismiss}
        >
          {txt.dismiss}
        </ControlButton>
        {kept ? null : (
          <ControlButton
            data-testid="retry"
            size="row"
            variant="primary"
            isDisabled={off}
            title={writeReason}
            onPress={() => onRetry?.(view.mode)}
          >
            <Icon name="refresh" />
            {txt.retry}
          </ControlButton>
        )}
      </div>
    );
  } else if (view.kind === "queued") {
    body =
      view.state === "waiting" ? (
        <p className="ah-clone-line" role="status">
          {txt.queued}
        </p>
      ) : (
        <>
          <p data-testid="clone-failed" className="ah-clone-title">
            {txt.notStarted}
          </p>
          <p>
            {view.refusal}
            {view.unsettled ? "" : txt.nothingWritten}
          </p>
        </>
      );
    actions = (
      <div className="ah-clone-actions">
        <ControlButton
          data-testid="unqueue-clone"
          size="row"
          isDisabled={busy}
          onPress={onDismiss}
        >
          {view.state === "waiting" ? txt.unqueue : txt.dismiss}
        </ControlButton>
        {view.state === "refused" ? (
          <ControlButton
            data-testid="retry"
            size="row"
            variant="primary"
            isDisabled={off}
            title={writeReason}
            onPress={() => onRetry?.(view.mode)}
          >
            <Icon name="refresh" />
            {txt.retry}
          </ControlButton>
        ) : null}
      </div>
    );
  } else if (view.kind === "interrupted") {
    body = (
      <>
        <p data-testid="clone-interrupted" className="ah-clone-title">
          {txt.interrupted}
        </p>
        <p>
          {txt.interruptedText(
            <span className="ah-mono">{dest}</span>,
            <span className="ah-mono">.git</span>,
            size(view.size_bytes),
          )}
        </p>
        {large && !view.source ? (
          <CloneMode
            name={`restart-${view.full_name}`}
            mode={mode}
            onMode={setMode}
            legend={txt.newAttempt}
          />
        ) : null}
      </>
    );
    actions = (
      <div className="ah-clone-actions">
        <ControlButton
          data-testid="remove-clone"
          size="row"
          isDisabled={off}
          title={writeReason}
          onPress={onRemove}
        >
          {txt.removePartial(size(view.size_bytes))}
        </ControlButton>
        {onRestart ? (
          <ControlButton
            data-testid="restart-clone"
            size="row"
            variant="primary"
            isDisabled={off}
            title={writeReason}
            onPress={() => onRestart(mode)}
          >
            <Icon name="refresh" />
            {txt.restart}
          </ControlButton>
        ) : null}
      </div>
    );
  }
  return (
    <article
      data-testid="clone-job"
      data-state={state}
      data-repository={view.full_name}
      className={`ah-clone-job ah-clone-job-${state}`}
      aria-label={txt.cloneOf(view.full_name)}
    >
      <header className="ah-clone-jhead">
        <span className={`ah-clone-jic ah-clone-jic-${state}`}>
          {state === "running" ? (
            <span className="ah-clone-spin" aria-hidden="true" />
          ) : (
            <Icon
              name={state === "confirmed" ? "check" : "warning"}
              width={16}
              height={16}
            />
          )}
        </span>
        <div>
          <strong className="ah-mono">{view.full_name}</strong>
          <span className="ah-clone-sub">
            {view.kind !== "interrupted"
              ? view.mode === "blobless"
                ? txt.modeBlobless
                : txt.modeFull
              : txt.modePartial}{" "}
            → <span className="ah-mono">{dest}</span>
          </span>
        </div>
      </header>
      {body}
      {problem ? (
        <p className="ah-clone-problem" role="alert">
          {problem}
        </p>
      ) : null}
      {writeReason ? <p className="ah-clone-hint">{writeReason}</p> : null}
      {actions}
    </article>
  );
}

/** The sidebar block above the workspaces: running and unfinished clones,
 * linking back to the clone page. */
export function RailClones({
  items,
  current,
}: {
  items: { name: string; label: string; live: boolean }[];
  current?: boolean;
}) {
  if (!items.length) return null;
  return (
    <LinkRow
      data-testid="clone-jobs"
      data-live={items.some((i) => i.live)}
      href="/workspaces/new"
      kind="nav"
      current={current}
      className="ah-rail-clones"
      aria-label={txt.railLabel(
        items.map((i) => `${i.name} ${i.label}`).join(", "),
      )}
    >
      {items.map((i) => (
        <span className="ah-rail-clone" key={i.name}>
          {i.live ? (
            <span
              className="ah-clone-spin ah-clone-spin-sm"
              aria-hidden="true"
            />
          ) : (
            <span className="ah-rail-clone-warn" aria-hidden="true">
              <Icon name="warning" width={12} height={12} />
            </span>
          )}
          <span className="ah-mono">{i.name}</span>
          <span className="ah-rail-clone-p">{i.label}</span>
        </span>
      ))}
    </LinkRow>
  );
}

export type CloneRowView = {
  full_name: string;
  state: "waiting" | "running" | "present" | "confirmed" | "failed";
  stage?: Stage;
  percent?: number;
  received_bytes?: number;
  /** The job's reason code, when the daemon gave one. */
  reason?: string;
  /** Why a start was refused, already in words. */
  problem?: string;
  retryable: boolean;
};

/** What a clone row says in a word on the route. */
function routeState(r: CloneRowView): string {
  return r.state === "running"
    ? cloneProgressText(r.stage, r.percent, r.received_bytes)
    : r.state === "waiting"
      ? txt.routeQueued
      : r.state === "present"
        ? txt.routePresent
        : r.state === "confirmed"
          ? txt.routeDone
          : txt.routeFailed;
}

/** The clones of onboarding on the route's Repot row: one short line per
 * repository with a thin bar while it runs. A failure only says so here; what
 * went wrong and the retry are in `OnboardingCloneProblems`, which has room. */
export function OnboardingClones({ rows }: { rows: readonly CloneRowView[] }) {
  if (!rows.length) return null;
  return (
    <ul
      className="ah-onboarding-clones"
      data-testid="onboarding-clones"
      aria-label={txt.onboardingLabel}
    >
      {rows.map((r) => (
        <li
          key={r.full_name}
          data-testid="onboarding-clone"
          data-name={r.full_name}
          data-state={r.state}
          className={`ah-onboarding-clone ah-onboarding-clone-${r.state}`}
        >
          <span className="ah-onboarding-clone-row">
            {r.state === "running" || r.state === "waiting" ? (
              <span className="ah-clone-spin ah-clone-spin-sm" aria-hidden />
            ) : r.state === "failed" ? (
              <span className="ah-rail-clone-warn" aria-hidden>
                <Icon name="warning" width={12} height={12} />
              </span>
            ) : (
              <span className="ah-onboarding-clone-ok" aria-hidden>
                <Icon name="check" width={12} height={12} />
              </span>
            )}
            <span className="ah-mono" title={r.full_name}>
              {r.full_name}
            </span>
          </span>
          <span className="ah-onboarding-clone-p">{routeState(r)}</span>
          {r.state === "running" ? (
            <div
              className="ah-clone-bar"
              role="progressbar"
              aria-label={txt.fetchOf(r.full_name)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={r.stage === "receiving" ? r.percent : undefined}
            >
              <span style={{ width: `${bar(r.stage, r.percent)}%` }} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** The failed onboarding clones under the step: why each failed and a retry
 * where nothing of the failed attempt remains. */
export function OnboardingCloneProblems({
  rows,
  onRetry,
  retryReason,
}: {
  rows: readonly CloneRowView[];
  onRetry?: (fullName: string) => void;
  /** Why a retry cannot be sent now. */
  retryReason?: string;
}) {
  const failed = rows.filter((r) => r.state === "failed");
  if (!failed.length) return null;
  return (
    <section
      className="ah-onboarding-clone-problems"
      data-testid="onboarding-clone-problems"
      aria-labelledby="onboarding-clone-problems-title"
    >
      <h3 id="onboarding-clone-problems-title">
        {txt.problemsTitle(failed.length)}
      </h3>
      <ul>
        {failed.map((r) => (
          <li
            key={r.full_name}
            data-testid="onboarding-clone-problem"
            data-name={r.full_name}
          >
            <span className="ah-mono">{r.full_name}</span>
            <span className="ah-onboarding-clone-fail">
              <span>
                {r.problem ??
                  (r.reason === "interrupted"
                    ? txt.fetchInterrupted
                    : `${reasonText(r.reason) ?? txt.fetchFailed}${
                        r.retryable ? txt.leftNothing : txt.leftDirectory
                      }`)}
              </span>
              {r.retryable && onRetry ? (
                <ControlButton
                  data-testid="onboarding-clone-retry"
                  size="row"
                  isDisabled={!!retryReason}
                  title={retryReason}
                  onPress={() => onRetry(r.full_name)}
                >
                  <Icon name="refresh" />
                  {txt.retry}
                </ControlButton>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="ah-clone-hint">{txt.othersBackground}</p>
    </section>
  );
}
