import { useCallback, useEffect, useRef, useState } from "react";
import {
  GitHubRepoChooser,
  type GitHubCheckoutView,
  type GitHubRepoChooserView,
} from "../components/GitHubRepoChooser";
import { PiOnboarding } from "./PiOnboarding";
import { Button } from "../components/Primitives";
import { InlineNotice } from "../components/Status";
import { sessionCSRF } from "./pi";
import { catalog, clone, GitHubError, observe } from "./github";

const marker = "nah:github-step";
const message = (e: unknown) =>
  e instanceof GitHubError
    ? {
        login: "Istunto päättyi. Kirjaudu uudelleen.",
        auth: "GitHub-valtuutusta ei voitu vahvistaa.",
        denied: "Haku estettiin. Tarkista istunto ja oikeudet.",
        conflict: "Kohteessa on eri repo. Tarkista se koneella.",
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
}: {
  onUsable: () => void;
  onLogin: () => void;
  onLogout: () => Promise<void>;
}) {
  const [step, setStep] = useState<"loading" | "github" | "pi">("loading");
  const [view, setView] = useState<GitHubRepoChooserView>({ phase: "loading" });
  const [checkout, setCheckout] = useState<GitHubCheckoutView>({
    phase: "idle",
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [_receipts, setReceipts] = useState<string[]>([]);
  const bound = useRef("");
  const key = useRef("");
  const generation = useRef(0);
  const reads = useRef<AbortController | undefined>(undefined);
  const readingPage = useRef(0);
  const writing = useRef(false);
  const pending = useRef<string[]>([]);
  const locked = useRef(false);
  const current = useCallback((n: number) => generation.current === n, []);
  const reset = useCallback(() => {
    ++generation.current;
    reads.current?.abort();
    bound.current = "";
    key.current = "";
    pending.current = [];
    writing.current = false;
    locked.current = false;
    setSelected([]);
    setReceipts([]);
    setCheckout({ phase: "idle" });
    setView({ phase: "loading" });
    setError("");
    setPage(0);
    setStep("loading");
  }, []);
  const load = useCallback(
    async (number: number, n: number) => {
      reads.current?.abort();
      const controller = new AbortController();
      reads.current = controller;
      readingPage.current = number;
      try {
        const result = await catalog(number, controller.signal);
        if (!current(n)) return;
        const csrf = await sessionCSRF(controller.signal);
        if (!current(n)) return;
        if (csrf === "login" || csrf !== bound.current) {
          reset();
          onLogin();
          return;
        }
        setPage(number);
        setView((old) => ({
          phase: "catalog",
          repositories:
            number === 1 || old.phase !== "catalog"
              ? result.repositories
              : [
                  ...old.repositories,
                  ...result.repositories.filter(
                    (r) =>
                      !old.repositories.some(
                        (v) =>
                          v.full_name.toLowerCase() ===
                          r.full_name.toLowerCase(),
                      ),
                  ),
                ],
          hasMore: result.has_more && number < 100,
        }));
        setError("");
      } catch (e) {
        if (!current(n) || controller.signal.aborted) return;
        if (e instanceof GitHubError && e.code === "login") {
          reset();
          onLogin();
          return;
        }
        if (number === 1)
          setView({
            phase:
              e instanceof GitHubError && e.code === "auth"
                ? "no-auth"
                : "unavailable",
          });
        else
          setView((old) =>
            old.phase === "catalog" ? { ...old, loadingMore: false } : old,
          );
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
              ? sessionStorage.getItem(marker) === key.current
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
        if (sessionStorage.getItem(marker) === digest) {
          setStep("pi");
          return;
        }
        sessionStorage.removeItem(marker);
        setStep("github");
        void load(1, n);
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
      const inFlight = reads.current;
      const requested = readingPage.current;
      inFlight?.abort();
      if (bound.current && sessionStorage.getItem(marker) !== key.current)
        setStep("loading");
      void check().then(() => {
        if (alive && inFlight && bound.current)
          void load(requested, generation.current);
      });
    };
    window.addEventListener("focus", focus);
    return () => {
      alive = false;
      ++generation.current;
      reads.current?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [load, onLogin, reset, current]);
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
          await clone(name, bound.current);
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
    if (locked.current || !bound.current || view.phase === "loading") return;
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
    if (writing.current || !pending.current.length) return;
    const n = generation.current;
    setError("");
    void reconcile(pending.current, n, false);
  };
  return step === "pi" ? (
    <PiOnboarding onUsable={onUsable} onLogin={onLogin} onLogout={onLogout} />
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
        onMore={() => {
          if (
            view.phase === "catalog" &&
            view.hasMore &&
            !view.loadingMore &&
            page < 100
          ) {
            setView({ ...view, loadingMore: true });
            void load(page + 1, generation.current);
          }
        }}
        onRefresh={() => {
          if (bound.current) void load(1, generation.current);
        }}
        onRecheck={recheck}
      />
      {error ? (
        <InlineNotice
          title="Haun tila vaatii tarkistusta"
          description={error}
          tone="warning"
        />
      ) : null}
      <Button
        label="Keskeytä käyttöönotto ja kirjaudu ulos"
        variant="secondary"
        onPress={() => {
          reset();
          void onLogout();
        }}
      />
    </>
  );
}
