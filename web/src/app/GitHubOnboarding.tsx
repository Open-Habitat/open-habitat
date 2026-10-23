import { useCallback, useEffect, useRef, useState } from "react";
import { AccountLogoutDialog } from "../components/Account";
import { OnboardingClones } from "../components/ClonePage";
import {
  GitHubRepoChooser,
  type GitHubRepoChooserView,
} from "../components/GitHubRepoChooser";
import { Button } from "../components/Primitives";
import { InlineNotice } from "../components/Status";
import { type CloneJobs, cloneRows, useCloneView } from "./cloneJobs";
import { GitIdentity } from "./GitIdentity";
import { catalog, GitHubError } from "./github";
import { PiOnboarding } from "./PiOnboarding";
import { sessionCSRF } from "./pi";

const marker = "nah:github-step";
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
  preferredEmail,
  skipChooser = false,
  forceSignIn = false,
  clones,
}: {
  onUsable: () => void;
  /** This session's clone jobs and queue; Continue adds the selection to it. */
  clones?: CloneJobs;
  preferredEmail?: string;
  skipChooser?: boolean;
  forceSignIn?: boolean;
  onLogin: () => void;
  onLogout: () => Promise<void>;
  onSessionChanged: () => void;
}) {
  const [exitOpen, setExitOpen] = useState(false);
  const [step, setStep] = useState<"loading" | "identity" | "github" | "pi">(
    "loading",
  );
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
          : "pi-device-title",
    );
    heading?.focus({ preventScroll: true });
  }, [step]);
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
    setStep("loading");
  }, []);
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
                ? "pi"
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
        if (skipChooser || sessionStorage.getItem(marker) === digest) {
          setStep("pi");
          return;
        }
        sessionStorage.removeItem(marker);
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
  }, [load, onLogin, onSessionChanged, reset, current, skipChooser, clones]);
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
  const advance = () => {
    sessionStorage.setItem(marker, key.current);
    setStep("pi");
  };
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
      advance();
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
    setStep("github");
    void load(generation.current);
  };
  return step === "pi" ? (
    <PiOnboarding
      clones={<CloneProgress store={clones} csrf={bound.current} />}
      forceSignIn={forceSignIn}
      onUsable={onUsable}
      onLogin={onLogin}
      onLogout={onLogout}
      onBack={backToPicker}
    />
  ) : step === "identity" ? (
    <main className="ah-account-onboarding">
      <h1
        data-testid="git-identity-title"
        id="git-identity-title"
        tabIndex={-1}
      >
        Git-identiteetti
      </h1>
      <p>
        Vahvista nimi ja sähköposti ennen repoja. Olemassa olevia Git-asetuksia
        ei muuteta.
      </p>
      <GitIdentity
        csrf={bound.current}
        preferredEmail={preferredEmail}
        onboarding
        onContinue={() => {
          identityDone.current = true;
          setStep("github");
        }}
      />
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
    </main>
  ) : step === "loading" && !error ? (
    <p role="status">Varmistetaan istunto…</p>
  ) : (
    <>
      <GitHubRepoChooser
        view={view}
        selectedNames={selected}
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
}

/** The onboarding clones, compactly, in the AI step. */
function CloneProgress({ store, csrf }: { store?: CloneJobs; csrf: string }) {
  const view = useCloneView(store);
  return (
    <OnboardingClones
      rows={cloneRows(view).map((r) => ({
        ...r,
        problem: r.problem ? message(new GitHubError(r.problem)) : undefined,
      }))}
      onRetry={(name) => {
        if (csrf) store?.retryClone(name, csrf);
      }}
      retryReason={csrf ? undefined : "Istuntoa ei ole vahvistettu."}
    />
  );
}
