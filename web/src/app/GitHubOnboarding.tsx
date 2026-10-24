import { useCallback, useEffect, useRef, useState } from "react";
import { AccountLogoutDialog } from "../components/Account";
import {
  type CloneRowView,
  OnboardingCloneProblems,
  OnboardingClones,
} from "../components/ClonePage";
import {
  GitHubRepoChooser,
  type GitHubRepoChooserView,
  type LockedRepo,
} from "../components/GitHubRepoChooser";
import {
  OnboardingFrame,
  OnboardingRoute,
  type OnboardingRouteStep,
} from "../components/OnboardingFrame";
import { Button } from "../components/Primitives";
import { InlineNotice } from "../components/Status";
import { type CloneJobs, cloneRows, useCloneView } from "./cloneJobs";
import { finishFirstRoute } from "./firstRoute";
import { GitIdentity } from "./GitIdentity";
import { catalog, GitHubError, type Observation, observe } from "./github";
import { connectedTo, IntegrationOnboarding } from "./IntegrationOnboarding";
import {
  type IntegrationList,
  type ProviderId,
  readIntegrations,
} from "./integrations";
import {
  hasRepositoryStep,
  readinessOf,
  readSiteOnboarding,
  routeIntegrations,
  type SiteOnboarding,
} from "./onboardingConfig";
import { PiOnboarding } from "./PiOnboarding";
import { piStatus, sessionCSRF } from "./pi";

const marker = "nah:github-step";
// The integration steps passed, connected or not, in this session.
const integrationMarker = "nah:integration-steps";
function passedIn(key: string): ProviderId[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(integrationMarker) ?? "{}");
    if (v.key === key && Array.isArray(v.passed)) return v.passed;
  } catch {}
  return [];
}
const message = (e: unknown) =>
  e instanceof GitHubError
    ? {
        login: "Istunto päättyi. Kirjaudu uudelleen.",
        auth: "GitHub-valtuutusta ei voitu vahvistaa.",
        denied: "Haku estettiin. Tarkista istunto ja oikeudet.",
        conflict: "Kohteessa on eri repo. Tarkista se koneella.",
        storage:
          "Tallennustila on täynnä. Pyydä ylläpitäjää nostamaan tallennusrajaa.",
        busy: "Toinen kloonaus on käynnissä. Odota, että se valmistuu.",
        // Gitea refusals never come from GitHub onboarding's own starts.
        empty:
          "Tilan vahvistaminen ei onnistunut. Tarkista yhteys ja yritä uudelleen.",
        gitea:
          "Tilan vahvistaminen ei onnistunut. Tarkista yhteys ja yritä uudelleen.",
        rewritten:
          "Tilan vahvistaminen ei onnistunut. Tarkista yhteys ja yritä uudelleen.",
        unavailable:
          "Tilan vahvistaminen ei onnistunut. Tarkista yhteys ja yritä uudelleen.",
      }[e.code]
    : "Tilan vahvistaminen ei onnistunut. Tarkista yhteys ja yritä uudelleen.";
async function sessionKey(csrf: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(csrf),
  );
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export function GitHubOnboarding({
  onUsable,
  onLogin,
  onLogout,
  onSessionChanged,
  preferredName,
  preferredEmail,
  skipChooser = false,
  forceSignIn = false,
  clones,
}: {
  onUsable: () => void;
  /** This session's clone jobs and queue; Continue adds the selection to it. */
  clones?: CloneJobs;
  preferredName?: string;
  preferredEmail?: string;
  skipChooser?: boolean;
  forceSignIn?: boolean;
  onLogin: () => void;
  onLogout: () => Promise<void>;
  onSessionChanged: () => void;
}) {
  const [exitOpen, setExitOpen] = useState(false);
  const cloneView = useCloneView(clones);
  const [step, setStep] = useState<
    "loading" | "identity" | "github" | "integrations" | "pi"
  >("loading");
  // This session's integration catalog: undefined until read, null when it
  // could not be read. The site's integrations whose provider it has ready
  // are steps; without it, none is.
  const [integrations, setIntegrations] = useState<IntegrationList | null>();
  // The integration steps passed in this session, in route order.
  const [passed, setPassed] = useState<ProviderId[]>([]);
  // The site's repository mode for this person and the defaults it fetches
  // for them (ADR 0030): undefined until read, null when it could not be
  // read, which leaves the ordinary chooser.
  const [site, setSite] = useState<SiteOnboarding | null>();
  const [repoOutcome, setRepoOutcome] = useState<number>();
  // A person seeded with the site key ends the route with Pi already usable;
  // the AI step joins it only when their Pi turns out not to be.
  const [aiNeeded, setAiNeeded] = useState(false);
  // The site's locked defaults of the last catalog read (auto).
  const [lockedNames, setLockedNames] = useState<string[]>([]);
  // What ~/src natively holds for a site default that has no clone row, by
  // lowercased name: the daemon's read-only checkout observation.
  const [observed, setObserved] = useState<
    Record<string, Observation["state"]>
  >({});
  // biome-ignore lint/correctness/useExhaustiveDependencies: passing one integration step opens the next under the same step.
  useEffect(() => {
    if (step === "loading") return;
    // Returning from settings puts focus back on the frame's own control
    // (account menu, phone navigation) and may do so before this view's reads
    // finish. Do not take it away from there; within onboarding, a step
    // change leaves focus in main or on the page, and the heading takes it.
    const active = document.activeElement;
    const main = document.getElementById("main");
    if (
      active instanceof HTMLElement &&
      active !== document.body &&
      active.isConnected &&
      main &&
      !main.contains(active)
    )
      return;
    const heading = document.getElementById(
      step === "identity"
        ? "git-identity-title"
        : step === "github"
          ? "github-chooser-title"
          : step === "integrations"
            ? "integration-onboarding-title"
            : "pi-sign-in-title",
    );
    heading?.focus({ preventScroll: true });
  }, [step, passed]);
  const [view, setView] = useState<GitHubRepoChooserView>({ phase: "loading" });
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const bound = useRef("");
  const key = useRef("");
  const generation = useRef(0);
  const reads = useRef<AbortController | undefined>(undefined);
  const locked = useRef(false);
  const identityDone = useRef(false);
  const current = useCallback((n: number) => generation.current === n, []);
  const reset = useCallback(() => {
    ++generation.current;
    reads.current?.abort();
    bound.current = "";
    key.current = "";
    locked.current = false;
    identityDone.current = false;
    setSelected([]);
    setBusy(false);
    setView({ phase: "loading" });
    setError("");
    setIntegrations(undefined);
    setPassed([]);
    setSite(undefined);
    setRepoOutcome(undefined);
    setAiNeeded(false);
    setLockedNames([]);
    setObserved({});
    setStep("loading");
  }, []);
  // After the repositories: the site's integration steps, which go on to
  // the AI account once each is passed.
  const afterRepos = useCallback(
    () => (skipChooser ? "pi" : "integrations"),
    [skipChooser],
  );
  const load = useCallback(
    async (n: number) => {
      reads.current?.abort();
      const controller = new AbortController();
      reads.current = controller;
      setError("");
      setView({ phase: "loading" }); // No incomplete catalog is selectable.
      setSelected([]); // A refreshed catalog may no longer contain old choices.
      try {
        // The daemon reads the whole catalog, newest push first.
        const result = await catalog(controller.signal);
        if (!current(n) || controller.signal.aborted) return;
        const csrf = await sessionCSRF(controller.signal);
        if (!current(n) || controller.signal.aborted) return;
        if (csrf === "login" || csrf !== bound.current) {
          reset();
          onLogin();
          return;
        }
        setView({ phase: "catalog", repositories: result.repositories });
        // The gateway marked this person's own readable site defaults:
        // preselected ones start selected, locked ones are already coming.
        setSelected(
          result.repositories
            .filter((r) => r.default === "preselected")
            .map((r) => r.full_name),
        );
        setLockedNames(
          result.repositories
            .filter((r) => r.default === "locked")
            .map((r) => r.full_name),
        );
        setStep((old) =>
          old === "github" && !identityDone.current ? "identity" : old,
        );
        setError("");
        return;
      } catch (e) {
        if (!current(n) || controller.signal.aborted) return;
        if (e instanceof GitHubError && e.code === "login") {
          reset();
          onLogin();
          return;
        }
        // The chooser's own notice says so and offers the read again.
        setView({
          phase:
            e instanceof GitHubError && e.code === "auth"
              ? "no-auth"
              : "unavailable",
        });
      } finally {
        if (reads.current === controller) reads.current = undefined;
      }
    },
    [onLogin, reset, current],
  );
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const csrf = await sessionCSRF();
        if (!alive) return;
        if (csrf === "login") {
          reset();
          onLogin();
          return;
        }
        if (bound.current === csrf) {
          setStep((old) =>
            old === "loading"
              ? skipChooser || sessionStorage.getItem(marker) === key.current
                ? afterRepos()
                : "github"
              : old,
          );
          return;
        }
        if (bound.current && bound.current !== csrf) {
          reset();
          onSessionChanged();
          return;
        }
        // The clone queue belongs to the session the app bound; onboarding
        // under another one must not show or extend it.
        if (clones?.binding !== undefined && clones.binding !== csrf) {
          reset();
          onSessionChanged();
          return;
        }
        reset();
        const n = generation.current;
        const digest = await sessionKey(csrf);
        if (!alive || !current(n)) return;
        bound.current = csrf;
        key.current = digest;
        setPassed(passedIn(digest));
        if (!skipChooser)
          void readSiteOnboarding()
            .then((plan) => {
              if (current(n)) setSite(plan);
            })
            .catch(() => {
              if (current(n)) setSite(null);
            });
        if (!skipChooser)
          void readIntegrations()
            .then((list) => {
              if (current(n)) setIntegrations(list);
            })
            .catch(() => {
              // An unreadable catalog leaves Google to Settings.
              if (current(n)) setIntegrations(null);
            });
        if (skipChooser || sessionStorage.getItem(marker) === digest) {
          setStep(afterRepos());
          return;
        }
        sessionStorage.removeItem(marker);
        sessionStorage.removeItem(integrationMarker);
        setPassed([]);
        setStep("github");
        void load(n);
      } catch {
        if (alive) {
          reset();
          setError("Istuntoa ei voitu vahvistaa. Lataa sivu uudelleen.");
        }
      }
    };
    void check();
    const timer = window.setInterval(() => {
      void check();
    }, 3000);
    const focus = () => {
      // The parent masks identity-scoped content on a real tab return.
      // Do not unmount the chooser on focus: a click in a newly focused
      // window otherwise lands on a disappearing button and needs repeating.
      void check();
    };
    window.addEventListener("focus", focus);
    return () => {
      alive = false;
      ++generation.current;
      reads.current?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [
    load,
    onLogin,
    onSessionChanged,
    reset,
    current,
    skipChooser,
    clones,
    afterRepos,
  ]);
  const verifySession = async (n: number) => {
    try {
      const csrf = await sessionCSRF();
      if (!current(n)) return false;
      if (csrf !== "login" && csrf === bound.current) return true;
    } catch {
      // An unavailable binding is not permission to show or write old identity data.
    }
    if (!current(n)) return false;
    reset();
    onLogin();
    return false;
  };
  const advance = (count: number) => {
    sessionStorage.setItem(marker, key.current);
    setRepoOutcome(count);
    setStep(afterRepos());
  };
  // skip: the site fetches its defaults without a chooser, and with none
  // the step is not on the route at all.
  const skipRepos = site?.repositories.mode === "skip";
  const imports = site?.repositories.imports ?? [];
  useEffect(() => {
    if (step !== "github" || !skipRepos) return;
    // The Git identity still comes first; the catalog is not needed for it.
    if (!identityDone.current) setStep("identity");
    else advance(imports.length);
  });
  // Continue never waits for a clone (Jari 23.10.2026): the selected names
  // go to the clone queue, which starts them one by one in the daemon while
  // the person signs in to an AI account. Without names it simply advances.
  const proceed = (names: string[]) => {
    if (locked.current || !bound.current) return;
    if (names.length && view.phase !== "catalog") return;
    if (names.length && !clones) {
      setError(
        "Repojen hakua ei voi aloittaa juuri nyt. Jatka ilman repoja tai lataa sivu uudelleen.",
      );
      return;
    }
    locked.current = true;
    setBusy(true);
    const n = generation.current;
    void verifySession(n).then((same) => {
      if (!same || !current(n)) return;
      locked.current = false;
      setBusy(false);
      if (names.length && !clones?.enqueue(names, "full", bound.current)) {
        reset();
        onSessionChanged();
        return;
      }
      advance(names.length + lockedNames.length);
    });
  };
  const backToPicker = () => {
    if (!bound.current) return;
    // Pi unmounts and cancels its reads. Do not cancel an active device attempt
    // or repeat any previous checkout. The marker remains session-bound.
    setSelected([]);
    locked.current = false;
    setBusy(false);
    sessionStorage.removeItem(marker);
    sessionStorage.removeItem(integrationMarker);
    setPassed([]);
    if (skipRepos) {
      // There is no chooser to return to; the Git identity is the step before.
      identityDone.current = false;
      setStep("identity");
      return;
    }
    setStep("github");
    void load(generation.current);
  };
  // The site's integration steps wait for both the site's configuration and
  // the catalog; without either there are none.
  const stepsKnown = site !== undefined && integrations !== undefined;
  const integrationSteps =
    site && integrations
      ? routeIntegrations(site.integrations, readinessOf(integrations))
      : [];
  const nextIntegration = integrationSteps.find(
    (i) => !passed.includes(i.provider),
  );
  useEffect(() => {
    if (step === "integrations" && stepsKnown && !nextIntegration)
      setStep("pi");
  }, [step, stepsKnown, nextIntegration]);
  // The site key seeded at the account-creating sign-in made Pi usable before
  // the route was walked; passing the route's last step finishes it in the
  // person's own state, so later loads go straight to the workspaces.
  const seeded = !skipChooser && site?.ai_key_seeded === true;
  const finish = () => {
    const csrf = bound.current;
    if (!seeded || !csrf) return onUsable();
    // A lost or refused mark shows the route again on the next load. A
    // session change while it is written belongs to the next person.
    const n = generation.current;
    void finishFirstRoute(csrf)
      .catch(() => undefined)
      .then(() => {
        if (current(n) && bound.current === csrf) onUsable();
      });
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
  useEffect(() => {
    if (step !== "pi" || !seeded || aiNeeded) return;
    const n = generation.current;
    let alive = true;
    void piStatus()
      .catch(() => "unavailable" as const)
      .then((status) => {
        if (!alive || !current(n)) return;
        if (status === "usable") finishRef.current();
        else if (status === "login") {
          reset();
          onLogin();
        } else setAiNeeded(true);
      });
    return () => {
      alive = false;
    };
  }, [step, seeded, aiNeeded, current, reset, onLogin]);
  const pass = (list: ProviderId[]) => {
    sessionStorage.setItem(
      integrationMarker,
      JSON.stringify({ key: key.current, passed: list }),
    );
    setPassed(list);
  };
  const cloneList: CloneRowView[] = cloneRows(cloneView).map((r) => ({
    ...r,
    problem: r.problem ? message(new GitHubError(r.problem)) : undefined,
  }));
  // A site default without a clone row was already in ~/src, finished and
  // was dismissed, or never started (a daemon restart forgets waiting
  // names). Only the daemon's observation of ~/src says which; until it has,
  // the default has no row and its state is not known.
  const unlisted = cloneView.loaded
    ? [...imports, ...lockedNames].filter(
        (name, i, all) =>
          all.findIndex((n) => n.toLowerCase() === name.toLowerCase()) === i &&
          !cloneList.some(
            (r) => r.full_name.toLowerCase() === name.toLowerCase(),
          ),
      )
    : [];
  const unobserved = unlisted.filter(
    (name) => observed[name.toLowerCase()] === undefined,
  );
  const nextObservation = unobserved[0];
  useEffect(() => {
    if (!nextObservation || !bound.current) return;
    const n = generation.current;
    let alive = true;
    void observe(nextObservation)
      .then((o) => o.state)
      .catch(() => "unavailable" as const)
      .then((state) => {
        if (alive && current(n))
          setObserved((old) => ({
            ...old,
            [nextObservation.toLowerCase()]: state,
          }));
      });
    return () => {
      alive = false;
    };
  }, [nextObservation, current]);
  const observedRows: CloneRowView[] = unlisted.flatMap(
    (name): CloneRowView[] => {
      const state = observed[name.toLowerCase()];
      if (state === "confirmed")
        return [{ full_name: name, state: "present", retryable: false }];
      if (state === "cloning")
        return [{ full_name: name, state: "waiting", retryable: false }];
      if (state === "absent")
        return [
          {
            full_name: name,
            state: "failed",
            problem: message(new GitHubError("unavailable")),
            retryable: true,
          },
        ];
      if (state === "conflict" || state === "interrupted")
        return [
          {
            full_name: name,
            state: "failed",
            problem: message(new GitHubError("conflict")),
            retryable: false,
          },
        ];
      return [];
    },
  );
  const routeRows: CloneRowView[] = [...cloneList, ...observedRows];
  // Every site default has a row whose state the daemon has stated.
  const importsKnown = unlisted.length === observedRows.length;
  const fetching = routeRows.some(
    (r) => r.state === "running" || r.state === "waiting",
  );
  const rowOf = (name: string) =>
    routeRows.find((r) => r.full_name.toLowerCase() === name.toLowerCase());
  const lockedRepos: LockedRepo[] = lockedNames.map((name) => {
    const r = rowOf(name);
    return {
      full_name: name,
      status:
        r?.state === "running"
          ? r.percent !== undefined
            ? `Sivusto hakee · ${r.percent} %`
            : "Sivusto hakee"
          : r?.state === "waiting" || (!r && !cloneView.loaded)
            ? "Sivusto hakee · jonossa"
            : r?.state === "failed"
              ? "Sivuston haku epäonnistui"
              : r
                ? "Haettu"
                : observed[name.toLowerCase()] === "unavailable"
                  ? "Tila ei varmistunut"
                  : "Tilaa tarkistetaan",
    };
  });
  const repoWord = (n: number) => (n === 1 ? "repo" : "repoa");
  const route: OnboardingRouteStep[] = [
    { id: "github", note: "Kirjautunut" },
    ...(site && !hasRepositoryStep(site.repositories.mode, imports.length)
      ? []
      : [
          {
            id: "repositories" as const,
            skipped: repoOutcome === 0,
            note: skipRepos
              ? fetching || !cloneView.loaded
                ? `Sivusto hakee ${imports.length} ${repoWord(imports.length)}`
                : routeRows.some((r) => r.state === "failed")
                  ? "Haku epäonnistui"
                  : importsKnown
                    ? "Haettu"
                    : unobserved.length
                      ? "Tilaa tarkistetaan"
                      : "Tila ei varmistunut"
              : repoOutcome === 0
                ? "Ei repoja"
                : routeRows.length && !fetching
                  ? routeRows.some((r) => r.state === "failed")
                    ? "Haku epäonnistui"
                    : "Haettu"
                  : repoOutcome
                    ? `${repoOutcome} ${repoWord(repoOutcome)} haussa`
                    : undefined,
            // The clones run on while the person goes on; their progress
            // stays on the route rather than in the step card.
            detail: <OnboardingClones rows={routeRows} />,
          },
        ]),
    ...integrationSteps.map((i): OnboardingRouteStep => {
      const connected = integrations
        ? connectedTo(integrations, i.provider)
        : false;
      return {
        id: i.provider,
        required: i.required,
        skipped: !connected,
        note: connected ? "Yhdistetty" : "Ohitettu",
      };
    }),
    ...(seeded && !aiNeeded ? [] : [{ id: "ai" as const }]),
  ];
  const exit = (
    <>
      <div className="ah-onboarding-exit">
        <Button
          data-testid="onboarding-abort"
          size="row"
          label="Keskeytä käyttöönotto ja kirjaudu ulos"
          variant="quiet"
          onPress={() => setExitOpen(true)}
        />
      </div>
      <AccountLogoutDialog
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        onConfirm={() => {
          reset();
          void onLogout();
        }}
      />
    </>
  );
  const content =
    step === "pi" && seeded && !aiNeeded ? (
      <p role="status">Viimeistellään käyttöönottoa…</p>
    ) : step === "pi" ? (
      <PiOnboarding
        notice={
          <OnboardingCloneProblems
            rows={routeRows}
            onRetry={(name) => {
              if (bound.current) clones?.retryClone(name, bound.current);
            }}
            retryReason={
              bound.current ? undefined : "Istuntoa ei ole vahvistettu."
            }
          />
        }
        forceSignIn={forceSignIn}
        // The site's offer; a sign-in from Settings and an unreadable site
        // read offer every option.
        offer={
          skipChooser
            ? "all"
            : site === undefined
              ? null
              : (site?.ai_account.offer ?? "all")
        }
        onUsable={finish}
        onLogin={onLogin}
        onLogout={onLogout}
        onBack={backToPicker}
      />
    ) : step === "identity" ? (
      <>
        <OnboardingFrame step="github">
          <section
            className="ah-account-onboarding"
            aria-labelledby="git-identity-title"
          >
            <h1
              data-testid="git-identity-title"
              id="git-identity-title"
              tabIndex={-1}
            >
              Git-identiteetti
            </h1>
            <p>
              Vahvista nimi ja sähköposti ennen repoja. Olemassa olevia
              Git-asetuksia ei muuteta.
            </p>
            <GitIdentity
              csrf={bound.current}
              preferredName={preferredName}
              preferredEmail={preferredEmail}
              onboarding
              onContinue={() => {
                identityDone.current = true;
                if (skipRepos) advance(imports.length);
                else setStep("github");
              }}
            />
          </section>
        </OnboardingFrame>
        {exit}
      </>
    ) : step === "integrations" ? (
      <>
        {integrations && nextIntegration ? (
          <IntegrationOnboarding
            key={nextIntegration.provider}
            provider={nextIntegration.provider}
            required={nextIntegration.required}
            csrf={bound.current}
            initial={integrations}
            onList={setIntegrations}
            backLabel={
              integrationSteps[0] === nextIntegration
                ? "Takaisin repoihin"
                : "Takaisin"
            }
            onBack={() => {
              // One step back: the previous integration, or the repositories.
              const at = integrationSteps.indexOf(nextIntegration);
              if (at === 0) backToPicker();
              else
                pass(integrationSteps.slice(0, at - 1).map((i) => i.provider));
            }}
            onContinue={() => pass([...passed, nextIntegration.provider])}
          />
        ) : (
          <p role="status">Tarkistetaan integraatioita…</p>
        )}
        {exit}
      </>
    ) : step === "loading" && !error ? (
      <p role="status">Varmistetaan istunto…</p>
    ) : (
      <>
        <GitHubRepoChooser
          view={view}
          selectedNames={selected}
          locked={lockedRepos}
          busy={busy}
          onToggle={(name, yes) =>
            setSelected((old) =>
              yes ? [...old, name] : old.filter((v) => v !== name),
            )
          }
          onProceed={proceed}
          onRefresh={() => {
            if (bound.current) void load(generation.current);
          }}
          notice={
            error ? (
              <InlineNotice
                data-testid="repository-notice"
                title="Haun tila vaatii tarkistusta"
                description={error}
                tone="warning"
                actions={[
                  {
                    label: bound.current
                      ? "Tarkista repot uudelleen"
                      : "Lataa sivu uudelleen",
                    onPress: () => {
                      if (bound.current) void load(generation.current);
                      else window.location.reload();
                    },
                  },
                ]}
              />
            ) : null
          }
        />
        {exit}
      </>
    );
  // A sign-in from Settings is not onboarding: it shows the plain route.
  return skipChooser ? (
    content
  ) : (
    <OnboardingRoute steps={route}>{content}</OnboardingRoute>
  );
}
