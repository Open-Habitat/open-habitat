import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  CloneCard,
  type CloneCardView,
  type DetailsState,
  type LookupView,
  type PushState,
  type RepoChoice,
  RepoDetails,
  RepoFinder,
} from "../components/ClonePage";
import { ControlButton, Segmented } from "../components/ControlElements";
import { Icon } from "../components/Icon";
import {
  arrange,
  type CatalogRepo,
  exactName,
  largeKiB,
  type Since,
} from "../components/repoCatalog";
import { liveText } from "../i18n";
import { newWorkspacePageText } from "../text/newWorkspacePage";
import { type CloneJobs, cloneLabel, useCloneView } from "./cloneJobs";
import { GitHubPlaceNotice } from "./GitHubConnectionNotice";
import { type GiteaSource, giteaRepos, host } from "./gitea";
import {
  type CloneJob,
  type CloneMode,
  catalog,
  type ForgeCloneSource,
  GitHubError,
  lookup,
  type Repo,
} from "./github";
import { type GitHubWarning, lookupView } from "./githubConnection";
import {
  daysLeft,
  type GitLabSource,
  type GitLabTokenState,
  gitlabRepos,
  gitlabTokens,
} from "./gitlab";
import { mutationFetch } from "./mutations";
import { settingsHref } from "./settingsRoute";
import type { Workspace } from "./snapshot";
import { ownStorage } from "./storageQuota";
import { workspaceFor } from "./workspaceMatch";

// Uusi työtila is a page (Kloonaussivulla, Jari 17.10.2026). Its top holds
// the daemon's clone jobs and interrupted clones; the rest finds a repository
// and shows its facts before cloning. The selected repository is in the route
// (?repo=owner/name), so a phone's back button returns from the details to
// the list. Leaving the page never cancels a clone: the daemon owns the job.

const txt = liveText(newWorkspacePageText);

type Action = Parameters<typeof txt.failed>[0];
const refusal = (e: unknown, what: Action) =>
  e instanceof Error && e.message === "partial"
    ? txt.partial
    : e instanceof GitHubError && e.code === "storage"
      ? e.message
      : (e instanceof GitHubError &&
          Object.hasOwn(txt.refusals, e.code) &&
          txt.refusals[e.code]) ||
        txt.failed(what);
const reason = (table: Record<string, string>, code?: string) =>
  code && Object.hasOwn(table, code) ? table[code] : undefined;

/** A repository from a Gitea or GitLab connection, as the common list
 * holds it. */
type ForgeRepo = CatalogRepo & { gitea: ForgeCloneSource; base_url: string };
type ListedRepo = CatalogRepo & { gitea?: ForgeCloneSource; base_url?: string };
const giteaKey = (g: ForgeCloneSource) =>
  `${g.connection_id}/${g.repository_id}`;
const sameGitea = (a?: ForgeCloneSource, b?: ForgeCloneSource) =>
  !!a &&
  !!b &&
  a.provider === b.provider &&
  a.connection_id === b.connection_id &&
  a.repository_id === b.repository_id;
/** One job's repository across sources: a Gitea or GitLab job by its
 * connection and repository, a GitHub job by its name. */
const jobKey = (j: Pick<CloneJob, "full_name" | "source">) =>
  j.source ? `gitea:${giteaKey(j.source)}` : j.full_name.toLocaleLowerCase();
const dirName = (fullName: string) =>
  fullName.slice(fullName.lastIndexOf("/") + 1);

/** A GitLab connection's push readiness as GitLab said it on this visit. */
function pushOf(t?: GitLabTokenState): PushState | undefined {
  if (!t) return undefined;
  if (t.api === "token_expired") return "expired";
  if (t.api !== "ok" || !t.token) return undefined;
  const expires = t.token.expires_at;
  if (expires && daysLeft(expires, Date.now()) <= 0) return "expired";
  return t.token.push;
}

export function NewWorkspacePage({
  csrf,
  token,
  writeReason,
  workspaces,
  store,
  onCreated,
  onOpen,
  refresh,
  github,
  onReconnect,
}: {
  /** A settled fault in the person's GitHub connection, said where the
   * list would be. */
  github?: GitHubWarning;
  onReconnect?: () => void;
  csrf?: string;
  token?: string;
  /** Why nothing can be written now; undefined when writes are possible. */
  writeReason?: string;
  workspaces: readonly Workspace[];
  store?: CloneJobs;
  /** A directory was created; the app gives it its first conversation. */
  onCreated: (name: string) => void;
  /** Opens a workspace a clone made. */
  onOpen: (workspace: Workspace) => void;
  refresh: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const selectedName = params.get("repo") ?? undefined;
  // A Gitea or GitLab repository is in the route by its connection and id.
  const selectedGitea =
    params.get("gitea") ?? params.get("gitlab") ?? undefined;
  const tab = params.get("source") === "directory" ? "directory" : "github";
  const clones = useCloneView(store);
  const [now] = useState(() => Date.now());
  const [repos, setRepos] = useState<{
    state: "loading" | "failed" | "ready";
    list: Repo[];
    complete: boolean;
    /** The person's own GitHub login, for the "Omat" section. */
    login?: string;
    /** The daemon could not use the GitHub credentials (409). */
    auth?: boolean;
  }>({ state: "loading", list: [], complete: true });
  // Each connected Gitea is its own source: one failing never hides
  // GitHub's list or another Gitea's.
  const [gitea, setGitea] = useState<{
    state: "loading" | "failed" | "ready";
    sources: GiteaSource[];
  }>({ state: "loading", sources: [] });
  const [gitlab, setGitLab] = useState<{
    state: "loading" | "failed" | "ready";
    sources: GitLabSource[];
  }>({ state: "loading", sources: [] });
  const [gitlabPush, setGitLabPush] = useState<
    Record<string, GitLabTokenState>
  >({});
  const [query, setQuery] = useState("");
  const [since, setSince] = useState<Since>("0");
  const [looked, setLooked] = useState<Record<string, LookupView>>({});
  const [modes, setModes] = useState<Record<string, CloneMode>>({});
  const [quota, setQuota] = useState<{
    free_bytes: number;
    limit_bytes?: number;
  }>();
  const [busy, setBusy] = useState<string>();
  const [problems, setProblems] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    void catalog(controller.signal)
      .then((c) =>
        setRepos({
          state: "ready",
          list: c.repositories,
          complete: c.complete,
          login: c.login,
        }),
      )
      .catch((e) => {
        if (!controller.signal.aborted)
          setRepos({
            state: "failed",
            list: [],
            complete: true,
            auth: e instanceof GitHubError && e.code === "auth",
          });
      });
    void giteaRepos(controller.signal)
      .then((sources) => setGitea({ state: "ready", sources }))
      .catch(() => {
        if (!controller.signal.aborted)
          setGitea({ state: "failed", sources: [] });
      });
    void gitlabRepos(controller.signal)
      .then((sources) => {
        setGitLab({ state: "ready", sources });
        if (!sources.length) return;
        // Whether push works is the token's, read from GitLab now.
        void gitlabTokens(controller.signal)
          .then((states) =>
            setGitLabPush(
              Object.fromEntries(states.map((t) => [t.connection_id, t])),
            ),
          )
          .catch(() => {});
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setGitLab({ state: "failed", sources: [] });
      });
    void ownStorage(controller.signal)
      .then((q) =>
        setQuota(
          q.limits === "not_in_use"
            ? { free_bytes: q.filesystem.free_bytes }
            : {
                free_bytes: Math.max(0, q.limit_bytes - q.usage_bytes),
                limit_bytes: q.limit_bytes,
              },
        ),
      )
      .catch(() => {});
    void store?.refresh();
    return () => controller.abort();
  }, [store]);

  const inCatalog = (name: string) =>
    repos.list.find(
      (r) => r.full_name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
  // An exact owner/repo that the catalog does not hold is looked up on
  // GitHub, whether typed in the search or arriving in the route.
  const typed = exactName(query);
  const wanted = [typed, selectedName].filter(
    (n): n is string => !!n && repos.state !== "loading" && !inCatalog(n),
  );
  const wantedKey = wanted.join(" ");
  // biome-ignore lint/correctness/useExhaustiveDependencies: wantedKey stands for the names.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      for (const name of wanted) {
        if (looked[name] && looked[name].state !== "failed") continue;
        setLooked((old) => ({ ...old, [name]: { state: "searching", name } }));
        void lookup(name, controller.signal)
          .then((r) =>
            setLooked((old) => ({
              ...old,
              [name]:
                r.state === "found"
                  ? { state: "found", name, repo: choice(r.repository) }
                  : lookupView(name, r),
            })),
          )
          .catch((e) => {
            // An aborted lookup answered nothing: forget it so that typing the
            // name again looks it up again.
            setLooked((old) => {
              if (!controller.signal.aborted)
                return {
                  ...old,
                  [name]: {
                    state: "failed",
                    name,
                    reason:
                      e instanceof GitHubError && e.code === "auth"
                        ? txt.lookupAuth
                        : undefined,
                  },
                };
              const { [name]: _, ...rest } = old;
              return rest;
            });
          });
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [wantedKey]);

  const jobFor = (name: string) =>
    clones.jobs.find(
      (j) =>
        !j.source &&
        j.full_name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
  const giteaJobFor = (g: ForgeCloneSource) =>
    clones.jobs.find((j) => sameGitea(j.source, g));
  // Two accounts on one server are told apart by their user as well.
  const shared = (base: string) =>
    gitea.sources.filter((s) => s.base_url === base).length > 1;
  const giteaRepoList: ForgeRepo[] = gitea.sources.flatMap((s) =>
    s.state !== "ok"
      ? []
      : s.repositories.map((r) => ({
          full_name: r.full_name,
          private: r.private,
          description: r.description,
          pushed_at: r.updated_at,
          size_kib: r.size_kib,
          default_branch: r.default_branch,
          owner_type: "User" as const,
          empty: r.empty,
          owned: r.owned,
          archived: r.archived,
          base_url: s.base_url,
          source: {
            provider: "gitea" as const,
            id: s.connection_id,
            label: shared(s.base_url)
              ? `${host(s.base_url)} (${s.user})`
              : host(s.base_url),
            login: s.user,
          },
          gitea: {
            provider: "gitea" as const,
            connection_id: s.connection_id,
            repository_id: r.id,
          },
        })),
  );
  // glab keeps one account per server, so the server names the source.
  const gitlabList: ForgeRepo[] = gitlab.sources.flatMap((s) =>
    s.state !== "ok"
      ? []
      : s.repositories.map((r) => ({
          full_name: r.full_name,
          private: r.visibility !== "public",
          visibility: r.visibility,
          description: r.description,
          pushed_at: r.activity_at,
          size_kib: r.size_kib,
          default_branch: r.default_branch,
          owner_type: "User" as const,
          empty: r.empty,
          owned: r.own,
          group: !r.personal,
          archived: r.archived,
          base_url: s.base_url,
          source: {
            provider: "gitlab" as const,
            id: s.connection_id,
            label: host(s.base_url),
            login: s.user,
          },
          gitea: {
            provider: "gitlab" as const,
            connection_id: s.connection_id,
            repository_id: r.id,
          },
        })),
  );
  const giteaList: ForgeRepo[] = [...giteaRepoList, ...gitlabList];
  const interruptedFor = (name: string) =>
    clones.interrupted.find(
      (i) =>
        !i.source &&
        i.full_name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
  // A Gitea leftover is that connection's repository only by the name its
  // own origin records.
  const giteaInterruptedFor = (connection: string, name: string) =>
    clones.interrupted.find(
      (i) => i.source?.connection_id === connection && i.full_name === name,
    );
  const giteaRepoFor = (connection: string, name: string) =>
    giteaList.find(
      (r) => r.gitea.connection_id === connection && r.full_name === name,
    );
  const route = (name?: string, g?: ForgeCloneSource) => {
    const next = new URLSearchParams();
    if (name) next.set("repo", name);
    if (g) next.set(g.provider, giteaKey(g));
    const q = next.toString();
    return `/workspaces/new${q ? `?${q}` : ""}`;
  };
  function choice(r: ListedRepo): RepoChoice {
    const job = r.gitea ? giteaJobFor(r.gitea) : jobFor(r.full_name);
    const interrupted = r.gitea
      ? giteaInterruptedFor(r.gitea.connection_id, r.full_name)
      : interruptedFor(r.full_name);
    const present = workspaceFor(r, workspaces);
    return {
      ...r,
      workspace: present?.kind,
      href: r.gitea ? route(undefined, r.gitea) : route(r.full_name),
      selected: r.gitea
        ? selectedGitea === giteaKey(r.gitea)
        : !selectedGitea &&
          selectedName?.toLocaleLowerCase() === r.full_name.toLocaleLowerCase(),
      mark: interrupted
        ? { label: cloneLabel("interrupted"), tone: "warn" }
        : job && job.state === "running"
          ? { label: cloneLabel(job), tone: "run" }
          : job && job.state === "failed"
            ? { label: cloneLabel(job), tone: "warn" }
            : present?.kind === "same"
              ? { label: txt.asWorkspace, tone: "ok" }
              : undefined,
    };
  }
  const choices = [...repos.list, ...giteaList].map(choice);
  const arrangement = arrange(choices, {
    login: repos.login,
    query,
    since,
    now,
    taken: (r) => !!workspaceFor(r, workspaces),
  });
  const typedLookup =
    typed && !inCatalog(typed)
      ? looked[typed]
        ? looked[typed].state === "found"
          ? { ...looked[typed], repo: choice(looked[typed].repo) }
          : looked[typed]
        : { state: "searching" as const, name: typed }
      : undefined;
  const selectedGiteaRepo = selectedGitea
    ? giteaList.find((r) => giteaKey(r.gitea) === selectedGitea)
    : undefined;
  const selected: ListedRepo | undefined = selectedGitea
    ? selectedGiteaRepo
    : selectedName
      ? (inCatalog(selectedName) ??
        (() => {
          const l = looked[selectedName];
          return l?.state === "found" ? l.repo : undefined;
        })())
      : undefined;
  const running = clones.jobs.find((j) => j.state === "running");

  const act = async (
    key: string,
    what: Action,
    write: () => Promise<unknown>,
  ): Promise<boolean> => {
    if (!csrf || busy) return false;
    setBusy(key);
    setProblems((old) => ({ ...old, [key]: "" }));
    try {
      await write();
      return true;
    } catch (e) {
      setProblems((old) => ({ ...old, [key]: refusal(e, what) }));
      return false;
    } finally {
      setBusy(undefined);
    }
  };
  const startClone = (
    name: string,
    mode: CloneMode,
    restart = false,
    source?: ForgeCloneSource,
    key = source ? `gitea:${giteaKey(source)}` : name,
  ) =>
    act(key, restart ? "retry" : "start", async () => {
      if (!csrf || !store) return;
      if (source) await store.startForge(source, csrf, restart);
      else await store.start(name, mode, csrf, restart);
      // The job's card at the top is now where this clone is followed.
      navigate(route(), { replace: false });
      document
        .getElementById("main")
        ?.scrollTo?.({ top: 0, behavior: "smooth" });
    });

  const details: DetailsState = (() => {
    if (!selected) return { kind: "ready" };
    const job = selected.gitea
      ? giteaJobFor(selected.gitea)
      : jobFor(selected.full_name);
    if (
      job?.state === "running" ||
      (selected.gitea
        ? giteaInterruptedFor(selected.gitea.connection_id, selected.full_name)
        : interruptedFor(selected.full_name))
    )
      return { kind: "job" };
    const present = workspaceFor(selected, workspaces);
    // The origin is what proves a workspace is this repository; opening it
    // changes nothing in it, so the account its clone uses stays its own.
    if (present?.kind === "same")
      return {
        kind: "workspace",
        path: present.workspace.path ?? `~/src/${present.workspace.name}`,
        onOpen: () => onOpen(present.workspace),
      };
    if (present)
      return {
        kind: "taken",
        path: `~/src/${present.workspace.name}`,
        unknown: present.kind === "unknown",
      };
    return { kind: "ready" };
  })();
  const cloneReason =
    writeReason ??
    (!store || !csrf
      ? txt.cannotStart
      : running
        ? txt.oneAtATime(running.full_name)
        : selected?.gitea?.provider === "gitlab" &&
            pushOf(gitlabPush[selected.gitea.connection_id]) === "expired"
          ? txt.gitlabExpired
          : undefined);
  const problemKey = (r?: ListedRepo) =>
    r?.gitea ? `gitea:${giteaKey(r.gitea)}` : r?.full_name;
  const giteaFix = {
    href: settingsHref("koodipalvelut", "gitea"),
    get label() {
      return txt.checkConnection;
    },
  };
  const gitlabFix = {
    href: settingsHref("koodipalvelut", "gitea"),
    get label() {
      return txt.codeHosts;
    },
  };
  const sourceNotes =
    gitea.state === "failed"
      ? [
          {
            key: "gitea",
            text: txt.giteaFailed,
            failed: true,
            fix: giteaFix,
          },
        ]
      : gitea.sources
          .flatMap((s) =>
            s.state === "failed"
              ? [
                  {
                    key: s.connection_id,
                    text: txt.giteaSourceFailed(
                      host(s.base_url),
                      s.user,
                      reason(txt.giteaFailure, s.failure),
                    ),
                    failed: true,
                    fix: giteaFix,
                  },
                ]
              : s.complete
                ? []
                : [
                    {
                      key: s.connection_id,
                      text: txt.giteaIncomplete(
                        host(s.base_url),
                        s.user,
                        reason(txt.incomplete, s.incomplete),
                      ),
                      failed: false,
                    },
                  ],
          )
          .concat(
            gitlab.state === "failed"
              ? [
                  {
                    key: "gitlab",
                    text: txt.gitlabFailed,
                    failed: true,
                    fix: gitlabFix,
                  },
                ]
              : gitlab.sources.flatMap((s) => [
                  ...(s.state === "failed"
                    ? [
                        {
                          key: s.connection_id,
                          text: txt.gitlabSourceFailed(
                            host(s.base_url),
                            reason(txt.gitlabFailure, s.failure),
                          ),
                          failed: true,
                          fix: gitlabFix,
                        },
                      ]
                    : []),
                  ...(s.elsewhere
                    ? [
                        {
                          key: `${s.connection_id}:elsewhere`,
                          text: txt.gitlabElsewhere(
                            host(s.base_url),
                            s.elsewhere.count,
                            s.elsewhere.origin,
                          ),
                          failed: false,
                        },
                      ]
                    : []),
                  ...(s.state === "ok" && !s.complete
                    ? [
                        {
                          key: `${s.connection_id}:incomplete`,
                          text: txt.gitlabIncomplete(
                            host(s.base_url),
                            reason(txt.incomplete, s.incomplete),
                          ),
                          failed: false,
                        },
                      ]
                    : []),
                ]),
          );

  // What the top of the page holds: the newest job the daemon remembers for
  // each repository, and each interrupted directory. A job whose directory is
  // now an interrupted clone is shown once, as the interrupted directory; a
  // cancelled job that left nothing is gone.
  const cards: (CloneCardView & { key: string; jobId?: string })[] = [
    ...clones.jobs
      .filter(
        (j, i) =>
          clones.jobs.findIndex((k) => jobKey(k) === jobKey(j)) === i &&
          !(
            j.state !== "running" &&
            (j.source
              ? giteaInterruptedFor(j.source.connection_id, j.full_name)
              : interruptedFor(j.full_name))
          ) &&
          !(
            !j.source &&
            j.state !== "running" &&
            clones.queue.some(
              (q) =>
                q.state !== "present" &&
                q.full_name.toLocaleLowerCase() ===
                  j.full_name.toLocaleLowerCase(),
            )
          ) &&
          !(j.state === "cancelled" && j.leftover === "removed"),
      )
      .map((j) => ({
        ...j,
        kind: "job" as const,
        key: j.job_id,
        jobId: j.job_id,
      })),
    ...clones.interrupted.map((i) => ({
      ...i,
      kind: "interrupted" as const,
      key: `interrupted:${i.source ? "gitea:" : ""}${i.full_name}`,
    })),
    // Names onboarding queued that are not yet jobs. A refused start wrote
    // nothing, so it can be tried again here.
    ...clones.queue
      .filter(
        (q) =>
          q.state !== "present" &&
          !clones.jobs.some(
            (j) =>
              !j.source &&
              j.state === "running" &&
              j.full_name.toLocaleLowerCase() ===
                q.full_name.toLocaleLowerCase(),
          ),
      )
      .map((q) => ({
        kind: "queued" as const,
        full_name: q.full_name,
        mode: q.mode,
        state:
          q.state === "refused" ? ("refused" as const) : ("waiting" as const),
        refusal:
          q.state === "refused"
            ? refusal(new GitHubError(q.problem ?? "unavailable"), "start")
            : undefined,
        unsettled: !!q.before,
        key: `queued:${q.full_name}`,
      })),
  ];

  return (
    <div className="ah-clone-page">
      <header className="ah-clone-head">
        <h1>{txt.title}</h1>
        <p>
          {txt.intro(
            gitea.sources.length && gitlab.sources.length
              ? "all"
              : gitlab.sources.length
                ? "gitlab"
                : gitea.sources.length
                  ? "gitea"
                  : "github",
            <span className="ah-mono">~/src</span>,
          )}
        </p>
      </header>
      {cards.length ? (
        <section className="ah-clone-jobs" aria-labelledby="clone-jobs-title">
          <h2 className="ah-clone-h2" id="clone-jobs-title">
            {txt.clones}
          </h2>
          {cards.map((card) => {
            const gitea = card.kind === "job" ? card.source : undefined;
            const leftover =
              card.kind === "interrupted" ? card.source : undefined;
            // An interrupted Gitea clone restarts as its connection's
            // repository, found again in that connection's list.
            const restartAs =
              leftover?.connection_id !== undefined
                ? giteaRepoFor(leftover.connection_id, card.full_name)?.gitea
                : undefined;
            const repo =
              gitea || leftover ? undefined : inCatalog(card.full_name);
            // A confirmed job wrote ~/src/<name> itself, so the workspace
            // of that name is this clone.
            const present = workspaces.find(
              (w) =>
                w.presence === "present" &&
                w.name.toLocaleLowerCase() ===
                  dirName(card.full_name).toLocaleLowerCase(),
            );
            const cardKey = gitea
              ? `gitea:${giteaKey(gitea)}`
              : leftover
                ? `gitea-interrupted:${card.full_name}`
                : card.full_name;
            return (
              <CloneCard
                key={card.key}
                view={card}
                large={
                  (repo?.size_kib ?? 0) >= largeKiB ||
                  (card.kind === "interrupted" &&
                    card.size_bytes >= largeKiB * 1024)
                }
                busy={busy === cardKey}
                problem={problems[cardKey]}
                writeReason={writeReason}
                onOpen={
                  card.kind === "job" && card.state === "confirmed" && present
                    ? () => {
                        onOpen(present);
                        const id = card.jobId;
                        if (id && csrf)
                          void store?.dismiss(id, csrf).catch(() => {});
                      }
                    : undefined
                }
                onCancel={() =>
                  card.jobId &&
                  act(cardKey, "cancel", async () => {
                    if (csrf && store && card.jobId)
                      await store.cancel(card.jobId, csrf);
                  })
                }
                onDismiss={() =>
                  card.kind === "queued"
                    ? store?.unqueue(card.full_name)
                    : act(cardKey, "dismiss", async () => {
                        if (csrf && store && card.jobId)
                          await store.dismiss(card.jobId, csrf);
                      })
                }
                onRetry={(mode) => {
                  if (card.kind === "queued") {
                    if (csrf) store?.retryClone(card.full_name, csrf);
                    return;
                  }
                  const id = card.jobId;
                  const source = card.kind === "job" ? card.source : undefined;
                  void startClone(card.full_name, mode, false, source).then(
                    (started) => {
                      if (started && id && csrf)
                        void store?.dismiss(id, csrf).catch(() => {});
                    },
                  );
                }}
                onRestart={
                  leftover
                    ? restartAs
                      ? () =>
                          void startClone(
                            card.full_name,
                            "full",
                            true,
                            restartAs,
                            // The card shows its own action's progress and
                            // refusal.
                            cardKey,
                          )
                      : undefined
                    : (mode) => void startClone(card.full_name, mode, true)
                }
                onRemove={() =>
                  act(cardKey, "remove", async () => {
                    if (!csrf || !store) return;
                    const state = await store.remove(
                      card.full_name,
                      csrf,
                      leftover?.provider,
                    );
                    refresh();
                    if (state === "partial") throw new Error("partial");
                    // Replace the removal page so Back cannot reopen a dead clone.
                    navigate("/", { replace: true });
                  })
                }
              />
            );
          })}
          {clones.failed ? (
            <p className="ah-clone-hint" role="status">
              {txt.clonesFailed}
            </p>
          ) : null}
        </section>
      ) : null}
      <section className="ah-clone-card" aria-label={txt.source}>
        <Segmented
          label={txt.source}
          size="row"
          options={[
            {
              id: "github",
              // With a Gitea or GitLab connected the list holds every source.
              label:
                gitea.sources.length || gitlab.sources.length
                  ? txt.cloneRepo
                  : txt.cloneGitHub,
              icon: <Icon name="github" />,
            },
            {
              id: "directory",
              label: txt.newDirectory,
              icon: <Icon name="folderPlus" />,
            },
          ]}
          value={tab}
          onChange={(next) =>
            navigate(
              next === "directory"
                ? "/workspaces/new?source=directory"
                : route(),
              {
                replace: true,
              },
            )
          }
        />
        {tab === "directory" ? (
          <NewDirectory
            csrf={csrf}
            token={token}
            writeReason={writeReason}
            onCreated={(name) => {
              refresh();
              onCreated(name);
            }}
          />
        ) : (
          <div
            className="ah-clone-pick"
            data-selected={selectedName || selectedGitea ? "" : undefined}
          >
            <RepoFinder
              arrangement={arrangement}
              query={query}
              onQuery={setQuery}
              since={since}
              onSince={setSince}
              now={now}
              lookup={typedLookup}
              incomplete={!repos.complete}
              state={repos.state}
              failure={
                github || repos.auth ? (
                  <GitHubPlaceNotice
                    warning={github}
                    onReconnect={onReconnect}
                  />
                ) : undefined
              }
              sourceNotes={sourceNotes}
              mixed={gitea.sources.length + gitlab.sources.length > 0}
            />
            {selectedGitea && !selected ? (
              <aside className="ah-clone-detail" aria-label={txt.details}>
                <p className="ah-clone-empty" role="status">
                  {params.get("gitlab")
                    ? gitlab.state === "loading"
                      ? txt.gitlabLoading
                      : txt.gitlabMissing
                    : gitea.state === "loading"
                      ? txt.giteaLoading
                      : txt.giteaMissing}
                </p>
              </aside>
            ) : selectedName && !selected ? (
              <aside className="ah-clone-detail" aria-label={txt.details}>
                <p className="ah-clone-empty" role="status">
                  {repos.state === "loading" ||
                  !looked[selectedName] ||
                  looked[selectedName].state === "searching"
                    ? txt.searching(selectedName)
                    : looked[selectedName].state === "not_found"
                      ? txt.notFound(selectedName)
                      : looked[selectedName].state === "restricted"
                        ? looked[selectedName].reason
                        : github?.fix
                          ? txt.needsGitHub(github.fix)
                          : txt.unreachable}
                </p>
              </aside>
            ) : (
              <RepoDetails
                key={problemKey(selected)}
                repo={selected}
                now={now}
                back={route()}
                free={quota}
                state={details}
                mode={(selected && modes[selected.full_name]) ?? "full"}
                onMode={(mode) =>
                  selected &&
                  setModes((old) => ({ ...old, [selected.full_name]: mode }))
                }
                onClone={() =>
                  selected &&
                  void startClone(
                    selected.full_name,
                    !selected.gitea && (selected.size_kib ?? 0) >= largeKiB
                      ? (modes[selected.full_name] ?? "full")
                      : "full",
                    false,
                    selected.gitea,
                  )
                }
                cloneReason={cloneReason}
                push={
                  selected?.gitea?.provider === "gitlab"
                    ? pushOf(gitlabPush[selected.gitea.connection_id])
                    : undefined
                }
                problem={
                  selected ? problems[problemKey(selected) ?? ""] : undefined
                }
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function NewDirectory({
  csrf,
  token,
  writeReason,
  onCreated,
}: {
  csrf?: string;
  token?: string;
  writeReason?: string;
  onCreated: (name: string) => void;
}) {
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<"form" | "working">("form");
  const [error, setError] = useState("");
  const valid = useMemo(
    () => /^[a-z0-9][a-z0-9._-]*$/.test(value.trim()),
    [value],
  );
  const submit = async () => {
    const name = value.trim();
    if (phase !== "form" || writeReason || !csrf) return;
    if (!valid) {
      setError(txt.invalidName);
      return;
    }
    if (!token) {
      setError(txt.workspacesUnknown);
      return;
    }
    setPhase("working");
    setError("");
    try {
      const response = await mutationFetch(
        "workspace.create",
        "/api/v1/workspaces",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "X-Agent-Host-CSRF": csrf,
            Origin: window.location.origin,
          },
          body: JSON.stringify({
            action: "create",
            name,
            git: true,
            user_observation_token: token,
          }),
        },
      );
      if (!response.ok) throw new Error();
      onCreated(name);
    } catch {
      setError(txt.createUncertain);
    } finally {
      setPhase("form");
    }
  };
  return (
    <form
      className="ah-clone-dir"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label htmlFor="workspace-name">{txt.name}</label>
      <input
        data-testid="directory-name"
        id="workspace-name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={txt.namePlaceholder}
        autoComplete="off"
        spellCheck={false}
      />
      <p className="ah-clone-hint">
        {txt.createHint(
          <span className="ah-mono">~/src/&lt;{txt.nameSlot}&gt;</span>,
        )}
      </p>
      {writeReason ? <p className="ah-clone-hint">{writeReason}</p> : null}
      {error ? (
        <p className="ah-clone-problem" role="alert">
          {error}
        </p>
      ) : null}
      <div className="ah-clone-actions">
        <ControlButton
          data-testid="create-directory"
          size="page"
          variant="primary"
          type="submit"
          isDisabled={!!writeReason || !value.trim() || phase === "working"}
        >
          {phase === "working" ? txt.creating : txt.create}
        </ControlButton>
      </div>
    </form>
  );
}
