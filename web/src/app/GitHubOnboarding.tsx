import { useCallback, useEffect, useRef, useState } from "react";
import { AccountLogoutDialog } from "../components/Account";
import {
  type GitHubCheckoutView,
  GitHubRepoChooser,
  type GitHubRepoChooserView,
} from "../components/GitHubRepoChooser";
import { Button } from "../components/Primitives";
import { InlineNotice } from "../components/Status";
import { catalog, cloneStream, GitHubError, observe } from "./github";
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
  skipChooser = false,
  forceSignIn = false,
}: {
  onUsable: () => void;
  skipChooser?: boolean;
  forceSignIn?: boolean;
  onLogin: () => void;
  onLogout: () => Promise<void>;
}) {
  const [exitOpen, setExitOpen] = useState(false);
  const [step, setStep] = useState<"loading" | "github" | "pi">("loading");
  useEffect(() => {
    if (step === "loading") return;
    const heading = document.getElementById(
      step === "github" ? "github-chooser-title" : "pi-device-title",
    );
    heading?.focus({ preventScroll: true });
  }, [step]);
  const [view, setView] = useState<GitHubRepoChooserView>({ phase: "loading" });
  const [checkout, setCheckout] = useState<GitHubCheckoutView>({
    phase: "idle",
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [_receipts, setReceipts] = useState<string[]>([]);
  const bound = useRef("");
  const key = useRef("");
  const generation = useRef(0);
  const reads = useRef<AbortController | undefined>(undefined);
  const writing = useRef(false);
  const writeAbort = useRef<AbortController | undefined>(undefined);
  const rechecking = useRef(false);
  const pending = useRef<string[]>([]);
  const locked = useRef(false);
  const current = useCallback((n: number) => generation.current === n, []);
  const reset = useCallback(() => {
    ++generation.current;
    reads.current?.abort();
    writeAbort.current?.abort();
    bound.current = "";
    key.current = "";
    pending.current = [];
    writing.current = false;
    rechecking.current = false;
    locked.current = false;
    setSelected([]);
    setReceipts([]);
    setCheckout({ phase: "idle" });
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
      let completedPages = 0;
      try {
        const repositories: import("./github").Repo[] = [];
        const seen = new Set<string>();
        for (let page = 1; page <= 100; page++) {
          const result = await catalog(page, controller.signal);
          if (!current(n) || controller.signal.aborted) return;
          const csrf = await sessionCSRF(controller.signal);
          if (!current(n) || controller.signal.aborted) return;
          if (csrf === "login" || csrf !== bound.current) {
            reset();
            onLogin();
            return;
          }
          for (const repo of result.repositories) {
            const name = repo.full_name.toLowerCase();
            if (seen.has(name)) throw new GitHubError("unavailable");
            seen.add(name);
            repositories.push(repo);
          }
          completedPages++;
          if (!result.has_more) {
            repositories.sort(
              (a, b) =>
                (b.pushed_at ?? "").localeCompare(a.pushed_at ?? "") ||
                a.full_name
                  .toLowerCase()
                  .localeCompare(b.full_name.toLowerCase()) ||
                a.full_name.localeCompare(b.full_name),
            );
            setView({ phase: "catalog", repositories });
            setError("");
            return;
          }
        }
        // Page 100 was full: a successor might exist. Never publish a partial list.
        throw new GitHubError("unavailable");
      } catch (e) {
        if (!current(n) || controller.signal.aborted) return;
        if (e instanceof GitHubError && e.code === "login") {
          reset();
          onLogin();
          return;
        }
        setView({
          phase:
            completedPages === 0 &&
            e instanceof GitHubError &&
            e.code === "auth"
              ? "no-auth"
              : "unavailable",
        });
        setError(message(e));
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
      writeAbort.current?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [load, onLogin, reset, current, skipChooser]);
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
  const reconcile = async (
    names: string[],
    n: number,
    permitWrite: boolean,
  ) => {
    let confirmed = 0;
    let uncertain = false;
    let absentAfterRead = false;
    for (const name of names) {
      if (!current(n) || !(await verifySession(n))) return;
      setCheckout({
        phase: "progress",
        completed: confirmed,
        total: names.length,
      });
      let state: string;
      try {
        state = (await observe(name)).state;
      } catch (e) {
        if (!current(n)) return;
        if (e instanceof GitHubError && e.code === "login") {
          reset();
          onLogin();
          return;
        }
        setError(message(e));
        uncertain = true;
        break;
      }
      if (!current(n) || !(await verifySession(n))) return;
      if (state === "conflict" || state === "unavailable") {
        setError(
          state === "conflict"
            ? message(new GitHubError("conflict"))
            : message(new GitHubError("unavailable")),
        );
        uncertain = true;
        break;
      }
      if (state === "absent" && permitWrite) {
        // Each name gets at most one POST in this explicit Continue invocation.
        try {
          const controller = new AbortController();
          writeAbort.current = controller;
          try {
            await cloneStream(
              name,
              bound.current,
              (frame) => {
                if (current(n) && frame.kind === "progress")
                  setCheckout((old) => ({
                    phase: "progress",
                    completed: confirmed,
                    total: names.length,
                    stage: frame.stage,
                    percent:
                      frame.percent ??
                      (old.phase === "progress" && old.stage === frame.stage
                        ? old.percent
                        : undefined),
                    receivedBytes:
                      frame.received_bytes ??
                      (old.phase === "progress" && old.stage === frame.stage
                        ? old.receivedBytes
                        : undefined),
                  }));
              },
              controller.signal,
            );
          } finally {
            if (writeAbort.current === controller)
              writeAbort.current = undefined;
          }
        } catch (e) {
          if (!current(n)) return;
          // A failed or lost response is NOT proof that the write failed.
          try {
            state = (await observe(name)).state;
          } catch {
            state = "unavailable";
          }
          if (!current(n) || !(await verifySession(n))) return;
          if (state !== "confirmed") {
            setError(message(e));
            uncertain = true;
            break;
          }
        }
        if (state !== "confirmed") {
          try {
            state = (await observe(name)).state;
          } catch {
            state = "unavailable";
          }
          if (!current(n) || !(await verifySession(n))) return;
          if (state !== "confirmed") {
            setError(message(new GitHubError("unavailable")));
            uncertain = true;
            break;
          }
        }
      }
      if (state !== "confirmed") {
        absentAfterRead = state === "absent";
        uncertain = true;
        setError(
          "Repo puuttuu. Paina Jatka uudelleen vain, jos haluat aloittaa uuden haun.",
        );
        break;
      }
      confirmed++;
      setReceipts((old) => (old.includes(name) ? old : [...old, name]));
      setCheckout({
        phase: "progress",
        completed: confirmed,
        total: names.length,
      });
    }
    if (!current(n)) return;
    if (confirmed === names.length) {
      setCheckout({ phase: "confirmed", names });
      advance();
    } else {
      pending.current = names;
      if (absentAfterRead && !permitWrite) {
        locked.current = false;
        setCheckout({ phase: "idle" });
      } else
        setCheckout(
          confirmed
            ? { phase: "partial", completed: confirmed, total: names.length }
            : { phase: "uncertain" },
        );
    }
    if (!uncertain) setError("");
  };
  const proceed = (names: string[]) => {
    if (
      locked.current ||
      !bound.current ||
      (view.phase !== "catalog" && view.phase !== "no-auth")
    )
      return;
    locked.current = true;
    const n = generation.current;
    if (!names.length) {
      setCheckout({ phase: "progress", completed: 0, total: 0 });
      setView({ phase: "loading" });
      void verifySession(n)
        .then((same) => {
          if (same && current(n)) advance();
        })
        .catch(() => {
          if (current(n)) {
            locked.current = false;
            setCheckout({ phase: "idle" });
            setView({ phase: "unavailable" });
            setError("Istuntoa ei voitu vahvistaa. Yritä uudelleen.");
          }
        });
      return;
    }
    pending.current = names;
    writing.current = true;
    void reconcile(names, n, true).finally(() => {
      writing.current = false;
    });
  };
  const recheck = () => {
    if (writing.current || rechecking.current || !pending.current.length)
      return;
    const n = generation.current;
    rechecking.current = true;
    setError("");
    void reconcile([...pending.current], n, false).finally(() => {
      if (current(n)) rechecking.current = false;
    });
  };
  const editSelection = () => {
    if (writing.current) return;
    ++generation.current; // Discard any stale observation before changing the selection.
    rechecking.current = false;
    pending.current = [];
    locked.current = false;
    setCheckout({ phase: "idle" });
    setError("");
  };
  const backToPicker = () => {
    if (!bound.current) return;
    // Pi unmounts and cancels its reads. Do not cancel an active device attempt
    // or repeat any previous checkout. The marker remains session-bound.
    setSelected([]);
    pending.current = [];
    locked.current = false;
    setCheckout({ phase: "idle" });
    sessionStorage.removeItem(marker);
    setStep("github");
    void load(generation.current);
  };
  return step === "pi" ? (
    <PiOnboarding
      forceSignIn={forceSignIn}
      onUsable={onUsable}
      onLogin={onLogin}
      onLogout={onLogout}
      onBack={backToPicker}
    />
  ) : step === "loading" && !error ? (
    <p role="status">Varmistetaan istunto…</p>
  ) : (
    <>
      <GitHubRepoChooser
        view={view}
        selectedNames={selected}
        checkout={checkout}
        onToggle={(name, yes) =>
          setSelected((old) =>
            yes ? [...old, name] : old.filter((v) => v !== name),
          )
        }
        onProceed={proceed}
        onRefresh={() => {
          if (bound.current) void load(generation.current);
        }}
        onRecheck={recheck}
        onEditSelection={editSelection}
        notice={
          error ? (
            <InlineNotice
              title="Haun tila vaatii tarkistusta"
              description={error}
              tone="warning"
              actions={[
                {
                  label: pending.current.length
                    ? "Tarkista tilanne uudelleen"
                    : bound.current
                      ? "Tarkista repot uudelleen"
                      : "Lataa sivu uudelleen",
                  onPress: () => {
                    if (pending.current.length)
                      recheck(); // Read only; never repeat a clone.
                    else if (bound.current) void load(generation.current);
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
