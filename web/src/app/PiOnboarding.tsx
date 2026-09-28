import { useCallback, useEffect, useRef, useState } from "react";
import {
  PiDeviceSignIn,
  type PiDeviceSignInView,
} from "../components/PiDeviceSignIn";
import { Button } from "../components/Primitives";
import { piAttempt, piStatus, sessionCSRF, type Attempt } from "./pi";

function viewOf(attempt: Attempt): PiDeviceSignInView {
  if (
    attempt.state === "device_code" &&
    attempt.verification_uri &&
    attempt.user_code
  )
    return {
      phase: "pending",
      verificationUri: attempt.verification_uri,
      userCode: attempt.user_code,
    };
  if (attempt.state === "pending") return { phase: "waiting" };
  return { phase: "interrupted" }; // Child completion is not native credential status.
}

export function PiOnboarding({
  onUsable,
  onLogin,
  onLogout,
}: {
  onUsable: () => void;
  onLogin: () => void;
  onLogout: () => Promise<void>;
}) {
  const [view, setView] = useState<PiDeviceSignInView>({ phase: "start" });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const bound = useRef<string | undefined>(undefined);
  const hadCode = useRef(false);
  const generation = useRef(0);
  const active = useRef<AbortController | undefined>(undefined);
  const alive = useRef(false);
  const ending = useRef(false);
  const check = useCallback(
    async (method: "GET" | "POST" | "DELETE" = "GET") => {
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      const version = ++generation.current;
      const current = () =>
        alive.current &&
        generation.current === version &&
        !controller.signal.aborted;
      const session = async () => {
        const csrf = await sessionCSRF(controller.signal);
        if (!current()) return false;
        if (csrf === "login") {
          setView({ phase: "interrupted" });
          onLogin();
          return false;
        }
        if (bound.current && bound.current !== csrf) {
          setView({ phase: "interrupted" });
          onUsable(); // Rebuild from the new session's native status, not the old attempt.
          return false;
        }
        bound.current = csrf;
        return true;
      };
      try {
        if (!(await session())) return;
        const status = await piStatus(controller.signal);
        if (!current() || !(await session())) return;
        if (status === "login") {
          onLogin();
          return;
        }
        if (status === "usable") {
          setView({ phase: "connected" });
          onUsable();
          return;
        }
        const attempt = await piAttempt(
          method,
          bound.current,
          controller.signal,
        );
        if (!current() || !(await session())) return;
        if (attempt === "login") {
          onLogin();
          return;
        }
        if (attempt === "busy") {
          setView({ phase: "interrupted" });
          return;
        }
        if (attempt === "absent") {
          setView({ phase: hadCode.current ? "expired" : "start" });
          hadCode.current = false;
          return;
        }
        if (attempt.pi_state === "usable") {
          const latest = await piStatus(controller.signal);
          if (!current() || !(await session())) return;
          if (latest === "usable") {
            setView({ phase: "connected" });
            onUsable();
            return;
          }
        }
        if (attempt.state === "device_code") hadCode.current = true;
        setView(viewOf(attempt));
      } catch {
        if (current()) setView({ phase: "unavailable" });
      } finally {
        if (current()) {
          busyRef.current = false;
          setBusy(false);
        }
      }
    },
    [onLogin, onUsable],
  );
  useEffect(() => {
    alive.current = true;
    void check();
    const timer = window.setInterval(() => {
      if (!busyRef.current && !ending.current) void check();
    }, 3000);
    const focus = () => {
      setView({ phase: "interrupted" });
      if (!ending.current) void check();
    };
    window.addEventListener("focus", focus);
    return () => {
      alive.current = false;
      ++generation.current;
      active.current?.abort();
      bound.current = undefined;
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [check]);
  const action = (method: "POST" | "DELETE") => {
    if (busyRef.current || ending.current) return;
    busyRef.current = true;
    setBusy(true);
    hadCode.current = false;
    setView({ phase: "interrupted" }); // Hide instructions before a write or cancel.
    void check(method); // Supersedes any pending read; one click means one write.
  };
  const logout = async () => {
    if (ending.current) return;
    ending.current = true;
    active.current?.abort();
    ++generation.current;
    setView({ phase: "interrupted" });
    try {
      if (bound.current) await piAttempt("DELETE", bound.current);
    } catch {
      /* Logout must continue even if cancellation is uncertain. */
    }
    await onLogout();
  };
  return (
    <>
      <PiDeviceSignIn
        view={view}
        onCancel={
          view.phase === "ready" || view.phase === "pending"
            ? () => action("DELETE")
            : undefined
        }
        onRetry={!busy ? () => action("POST") : undefined}
      />
      <p>
        Kirjautumisen tila tarkistetaan Pi:ltä. Vahvistussivun avaaminen ei
        yksin avaa workspaceja.
      </p>
      <Button
        label="Kirjaudu ulos"
        variant="secondary"
        onPress={() => {
          void logout();
        }}
      />
    </>
  );
}
