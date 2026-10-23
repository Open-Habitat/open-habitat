import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  CloneCard,
  type CloneCardView,
  type DetailsState,
  type LookupView,
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
import { type CloneJobs, cloneLabel, useCloneView } from "./cloneJobs";
import {
  type CloneMode,
  catalog,
  GitHubError,
  lookup,
  type Repo,
} from "./github";
import { mutationFetch } from "./mutations";
import type { Workspace } from "./snapshot";
import { ownStorage } from "./storageQuota";

// Uusi työtila is a page (Kloonaussivulla, Jari 17.10.2026). Its top holds
// the daemon's clone jobs and interrupted clones; the rest finds a repository
// and shows its facts before cloning. The selected repository is in the route
// (?repo=owner/name), so a phone's back button returns from the details to
// the list. Leaving the page never cancels a clone: the daemon owns the job.

const refusal = (e: unknown, what: string) =>
  e instanceof Error && e.message === "partial"
    ? "Osa keskeneräisestä hakemistosta jäi poistamatta. Yritä uudelleen."
    : e instanceof GitHubError
      ? e.code === "storage"
        ? e.message
        : e.code === "busy"
          ? "Toinen kloonaus on jo käynnissä. Odota, että se valmistuu."
          : e.code === "conflict"
            ? "Kohdehakemisto on jo olemassa. Tarkista työtilalista."
            : e.code === "auth"
              ? "GitHub-tunnukset eivät ole käytettävissä. Yhdistä GitHub asetuksista."
              : e.code === "login"
                ? "Kirjaudu uudelleen ja yritä sitten."
                : `${what} ei onnistunut. Tarkista tilanne yltä ennen uutta yritystä.`
      : `${what} ei onnistunut. Tarkista tilanne yltä ennen uutta yritystä.`;

function workspaceFor(
  fullName: string,
  workspaces: readonly Workspace[],
): { kind: "same" | "taken"; workspace: Workspace } | undefined {
  const name = fullName.split("/")[1].toLocaleLowerCase();
  const workspace = workspaces.find(
    (w) => w.presence === "present" && w.name.toLocaleLowerCase() === name,
  );
  if (!workspace) return undefined;
  // Only the exact origin proves it is this repository; a directory of the
  // same name whose origin could not be read is merely taken.
  const same =
    workspace.git_summary?.github_repo?.toLocaleLowerCase() ===
    fullName.toLocaleLowerCase();
  return { kind: same ? "same" : "taken", workspace };
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
}: {
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
  const tab = params.get("source") === "directory" ? "directory" : "github";
  const clones = useCloneView(store);
  const [now] = useState(() => Date.now());
  const [repos, setRepos] = useState<{
    state: "loading" | "failed" | "ready";
    list: Repo[];
    complete: boolean;
    /** The person's own GitHub login, for the "Omat" section. */
    login?: string;
  }>({ state: "loading", list: [], complete: true });
  const [query, setQuery] = useState("");
  const [since, setSince] = useState<Since>("0");
  const [looked, setLooked] = useState<Record<string, LookupView>>({});
  const [modes, setModes] = useState<Record<string, CloneMode>>({});
  const [quota, setQuota] = useState<{
    free_bytes: number;
    limit_bytes: number;
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
      .catch(() => {
        if (!controller.signal.aborted)
          setRepos({ state: "failed", list: [], complete: true });
      });
    void ownStorage(controller.signal)
      .then((q) =>
        setQuota({
          free_bytes: Math.max(0, q.limit_bytes - q.usage_bytes),
          limit_bytes: q.limit_bytes,
        }),
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
                  : { state: "not_found", name },
            })),
          )
          .catch(() => {
            // An aborted lookup answered nothing: forget it so that typing the
            // name again looks it up again.
            setLooked((old) => {
              if (!controller.signal.aborted)
                return { ...old, [name]: { state: "failed", name } };
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
      (j) => j.full_name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
  const interruptedFor = (name: string) =>
    clones.interrupted.find(
      (i) => i.full_name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
  const route = (name?: string) => {
    const next = new URLSearchParams();
    if (name) next.set("repo", name);
    const q = next.toString();
    return `/workspaces/new${q ? `?${q}` : ""}`;
  };
  function choice(r: CatalogRepo): RepoChoice {
    const job = jobFor(r.full_name);
    const interrupted = interruptedFor(r.full_name);
    const present = workspaceFor(r.full_name, workspaces);
    return {
      ...r,
      href: route(r.full_name),
      selected:
        selectedName?.toLocaleLowerCase() === r.full_name.toLocaleLowerCase(),
      mark: interrupted
        ? { label: cloneLabel("interrupted"), tone: "warn" }
        : job && job.state === "running"
          ? { label: cloneLabel(job), tone: "run" }
          : job && job.state === "failed"
            ? { label: cloneLabel(job), tone: "warn" }
            : present?.kind === "same"
              ? { label: "työtilana", tone: "ok" }
              : undefined,
    };
  }
  const choices = repos.list.map(choice);
  const arrangement = arrange(choices, {
    login: repos.login,
    query,
    since,
    now,
    taken: (r) => !!workspaceFor(r.full_name, workspaces),
  });
  const typedLookup =
    typed && !inCatalog(typed)
      ? looked[typed]
        ? looked[typed].state === "found"
          ? { ...looked[typed], repo: choice(looked[typed].repo) }
          : looked[typed]
        : { state: "searching" as const, name: typed }
      : undefined;
  const selected: CatalogRepo | undefined = selectedName
    ? (inCatalog(selectedName) ??
      (() => {
        const l = looked[selectedName];
        return l?.state === "found" ? l.repo : undefined;
      })())
    : undefined;
  const running = clones.jobs.find((j) => j.state === "running");

  const act = async (
    key: string,
    what: string,
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
  const startClone = (name: string, mode: CloneMode, restart = false) =>
    act(name, restart ? "Uusi yritys" : "Kloonauksen aloitus", async () => {
      if (!csrf || !store) return;
      await store.start(name, mode, csrf, restart);
      // The job's card at the top is now where this clone is followed.
      navigate(route(), { replace: false });
      document
        .getElementById("main")
        ?.scrollTo?.({ top: 0, behavior: "smooth" });
    });

  const details: DetailsState = (() => {
    if (!selected) return { kind: "ready" };
    if (
      jobFor(selected.full_name)?.state === "running" ||
      interruptedFor(selected.full_name)
    )
      return { kind: "job" };
    const present = workspaceFor(selected.full_name, workspaces);
    if (present?.kind === "same")
      return {
        kind: "workspace",
        path: present.workspace.path ?? `~/src/${present.workspace.name}`,
        onOpen: () => onOpen(present.workspace),
      };
    if (present)
      return { kind: "taken", path: `~/src/${present.workspace.name}` };
    return { kind: "ready" };
  })();
  const cloneReason =
    writeReason ??
    (!store || !csrf
      ? "Kloonausta ei voi aloittaa juuri nyt."
      : running
        ? `Kloonaus ${running.full_name} on käynnissä. Yksi kloonaus kerrallaan.`
        : undefined);

  // What the top of the page holds: the newest job the daemon remembers for
  // each repository, and each interrupted directory. A job whose directory is
  // now an interrupted clone is shown once, as the interrupted directory; a
  // cancelled job that left nothing is gone.
  const cards: (CloneCardView & { key: string; jobId?: string })[] = [
    ...clones.jobs
      .filter(
        (j, i) =>
          clones.jobs.findIndex(
            (k) =>
              k.full_name.toLocaleLowerCase() ===
              j.full_name.toLocaleLowerCase(),
          ) === i &&
          !(j.state !== "running" && interruptedFor(j.full_name)) &&
          !(
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
      key: `interrupted:${i.full_name}`,
    })),
    // Names onboarding queued that are not yet jobs. A refused start wrote
    // nothing, so it can be tried again here.
    ...clones.queue
      .filter(
        (q) =>
          q.state !== "present" &&
          !clones.jobs.some(
            (j) =>
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
            ? refusal(
                new GitHubError(q.problem ?? "unavailable"),
                "Kloonauksen aloitus",
              )
            : undefined,
        unsettled: !!q.before,
        key: `queued:${q.full_name}`,
      })),
  ];

  return (
    <div className="ah-clone-page">
      <header className="ah-clone-head">
        <h1>Uusi työtila</h1>
        <p>
          Kloonaa GitHub-repo tai luo tyhjä hakemisto kotihakemistosi{" "}
          <span className="ah-mono">~/src</span>-kansioon.
        </p>
      </header>
      {cards.length ? (
        <section className="ah-clone-jobs" aria-labelledby="clone-jobs-title">
          <h2 className="ah-clone-h2" id="clone-jobs-title">
            Kloonaukset
          </h2>
          {cards.map((card) => {
            const repo = inCatalog(card.full_name);
            const present = workspaceFor(card.full_name, workspaces);
            return (
              <CloneCard
                key={card.key}
                view={card}
                large={
                  (repo?.size_kib ?? 0) >= largeKiB ||
                  (card.kind === "interrupted" &&
                    card.size_bytes >= largeKiB * 1024)
                }
                busy={busy === card.full_name}
                problem={problems[card.full_name]}
                writeReason={writeReason}
                onOpen={
                  // A confirmed job wrote ~/src/<name> itself, so the
                  // workspace of that name is this clone.
                  card.kind === "job" && card.state === "confirmed" && present
                    ? () => {
                        onOpen(present.workspace);
                        const id = card.jobId;
                        if (id && csrf)
                          void store?.dismiss(id, csrf).catch(() => {});
                      }
                    : undefined
                }
                onCancel={() =>
                  card.jobId &&
                  act(card.full_name, "Keskeytys", async () => {
                    if (csrf && store && card.jobId)
                      await store.cancel(card.jobId, csrf);
                  })
                }
                onDismiss={() =>
                  card.kind === "queued"
                    ? store?.unqueue(card.full_name)
                    : act(card.full_name, "Ilmoituksen poisto", async () => {
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
                  void startClone(card.full_name, mode).then((started) => {
                    if (started && id && csrf)
                      void store?.dismiss(id, csrf).catch(() => {});
                  });
                }}
                onRestart={(mode) =>
                  void startClone(card.full_name, mode, true)
                }
                onRemove={() =>
                  act(card.full_name, "Poisto", async () => {
                    if (!csrf || !store) return;
                    const state = await store.remove(card.full_name, csrf);
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
              Kloonausten tilaa ei juuri nyt saatu. Näkyvä tila voi olla vanha.
            </p>
          ) : null}
        </section>
      ) : null}
      <section className="ah-clone-card" aria-label="Työtilan lähde">
        <Segmented
          label="Työtilan lähde"
          size="row"
          options={[
            {
              id: "github",
              label: "Kloonaa GitHubista",
              icon: <Icon name="github" />,
            },
            {
              id: "directory",
              label: "Uusi hakemisto",
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
            data-selected={selectedName ? "" : undefined}
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
            />
            {selectedName && !selected ? (
              <aside className="ah-clone-detail" aria-label="Repon tiedot">
                <p className="ah-clone-empty" role="status">
                  {repos.state === "loading" ||
                  !looked[selectedName] ||
                  looked[selectedName].state === "searching"
                    ? `Haetaan ${selectedName}…`
                    : looked[selectedName].state === "not_found"
                      ? `Repoa ${selectedName} ei ole, tai sinulla ei ole siihen pääsyä.`
                      : "GitHubiin ei saatu yhteyttä. Yritä hetken päästä uudelleen."}
                </p>
              </aside>
            ) : (
              <RepoDetails
                key={selected?.full_name}
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
                    selected.size_kib >= largeKiB
                      ? (modes[selected.full_name] ?? "full")
                      : "full",
                  )
                }
                cloneReason={cloneReason}
                problem={selected ? problems[selected.full_name] : undefined}
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
      setError("Tarkista nimi: pienet kirjaimet, numerot sekä . _ -");
      return;
    }
    if (!token) {
      setError("Työtiloja ei voitu tarkistaa. Päivitä näkymä.");
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
      setError(
        "Luontia ei voitu vahvistaa. Tarkista työtilalista ennen uutta yritystä.",
      );
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
      <label htmlFor="workspace-name">Nimi</label>
      <input
        data-testid="directory-name"
        id="workspace-name"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="uusi-projekti"
        autoComplete="off"
        spellCheck={false}
      />
      <p className="ah-clone-hint">
        Luodaan <span className="ah-mono">~/src/&lt;nimi&gt;</span> ja
        alustetaan Git-repoksi.
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
          {phase === "working" ? "Luodaan…" : "Luo työtila"}
        </ControlButton>
      </div>
    </form>
  );
}
