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
  onBack,
  forceSignIn = false,
}: {
  onUsable: () => void;
  onLogin: () => void;
  onLogout: () => Promise<void>;
  onBack?: () => void;
  forceSignIn?: boolean;
}) {
  const [view, setView] = useState<PiDeviceSignInView>({ phase: "waiting" });
  // Parent renders must not restart polling or re-bind the session.
  const latest = useRef({ onUsable, onLogin, forceSignIn });
  latest.current = { onUsable, onLogin, forceSignIn };
  const checkFailed = useRef(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const busyRef = useRef(false);
  const bound = useRef<string | undefined>(undefined);
  const hadCode = useRef(false);
  const attemptInFlight = useRef(false);
  const preparingCode = useRef(false);
  const generation = useRef(0);
  const active = useRef<AbortController | undefined>(undefined);
  const reading = useRef(false);
  const alive = useRef(false);
  const ending = useRef(false);
  const check = useCallback(
    async (
      method: "GET" | "POST" | "DELETE" = "GET",
      verifySession = false,
    ) => {
      // Reads are single-flight: a slow native status + attempt may take longer
      // than the poll interval. Only an explicit write supersedes a read.
      if (method === "GET") {
        if (reading.current || busyRef.current || ending.current) return;
        reading.current = true;
        setChecking(true);
      } else {
        active.current?.abort();
        reading.current = false;
        setChecking(false);
      }
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
          latest.current.onLogin();
          return false;
        }
        if (bound.current && bound.current !== csrf) {
          setView({ phase: "interrupted" });
          latest.current.onUsable(); // Rebuild from the new session's native status, not the old attempt.
          return false;
        }
        bound.current = csrf;
        return true;
      };
      let readingStatus = false;
      try {
        // Bind once for writes. Attempt reads authenticate via their own 401;
        // polling must not fetch the session before or after each read.
        if (
          (method !== "GET" || !bound.current || verifySession) &&
          !(await session())
        )
          return;
        // A write already checks its session binding in piAttempt. Reading
        // native status before a POST can exhaust the response budget while
        // the helper has started and is preparing a code.
        if (
          method === "GET" &&
          !attemptInFlight.current &&
          !latest.current.forceSignIn
        ) {
          readingStatus = true;
          const status = await piStatus(controller.signal);
          if (!current() || (verifySession && !(await session()))) return;
          readingStatus = false;
          if (status === "login") {
            latest.current.onLogin();
            return;
          }
          if (status === "usable") {
            setView({ phase: "connected" });
            latest.current.onUsable();
            return;
          }
          if (status === "unknown" || status === "unavailable") {
            checkFailed.current = true;
            setView({ phase: "unavailable" });
            return;
          }
        }
        checkFailed.current = false;
        const attempt = await piAttempt(
          method,
          bound.current,
          controller.signal,
        );
        if (!current() || (verifySession && !(await session()))) return;
        if (attempt === "login") {
          attemptInFlight.current = false;
          latest.current.onLogin();
          return;
        }
        if (attempt === "busy") {
          attemptInFlight.current = false;
          setView({ phase: "interrupted" });
          return;
        }
        if (attempt === "absent") {
          attemptInFlight.current = false;
          preparingCode.current = false;
          // Remember a code until an explicit new attempt. An absent native
          // attempt is not evidence that the provider accepted or rejected it.
          setView({ phase: hadCode.current ? "expired" : "start" });
          return;
        }
        if (attempt.pi_state === "usable") {
          const latestStatus = await piStatus(controller.signal);
          if (!current()) return;
          if (latestStatus === "login") {
            latest.current.onLogin();
            return;
          }
          if (latestStatus === "usable") {
            setView({ phase: "connected" });
            latest.current.onUsable();
            return;
          }
        }
        attemptInFlight.current =
          attempt.state === "pending" || attempt.state === "device_code";
        if (method === "POST" && attempt.state === "pending")
          preparingCode.current = true;
        if (attempt.state !== "pending") preparingCode.current = false;
        if (attempt.state === "device_code") hadCode.current = true;
        setView(viewOf(attempt));
      } catch {
        if (current()) {
          if (readingStatus) {
            checkFailed.current = true;
            setView({ phase: "unavailable" });
          } else {
            // A failed attempt poll is not a native-status failure. Keep
            // visible instructions while retrying the read, never the write.
            setView((previous) =>
              method === "GET" &&
              (previous.phase === "pending" || previous.phase === "expired")
                ? previous
                : { phase: "interrupted" },
            );
          }
        }
      } finally {
        if (active.current === controller) active.current = undefined;
        if (method === "GET" && generation.current === version) {
          reading.current = false;
          if (alive.current) setChecking(false);
        }
        if (current() && method !== "GET") {
          busyRef.current = false;
          setBusy(false);
        }
      }
    },
    [],
  );
  useEffect(() => {
    alive.current = true;
    void check();
    const timer = window.setInterval(() => {
      if (!ending.current && !checkFailed.current && attemptInFlight.current)
        void check();
    }, 2000);
    const focus = () => {
      if (ending.current) return;
      // Focus can race a poll already authorized under the previous cookie.
      // Invalidate that reply before checking the current session; even an
      // in-flight write is not repeated, only observed through a fresh read.
      active.current?.abort();
      ++generation.current;
      reading.current = false;
      busyRef.current = false;
      setBusy(false);
      setChecking(false);
      setView({ phase: "interrupted" });
      void check("GET", true);
    };
    window.addEventListener("focus", focus);
    return () => {
      alive.current = false;
      ++generation.current;
      active.current?.abort();
      bound.current = undefined;
      reading.current = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [check]);
  const action = (method: "POST" | "DELETE") => {
    if (busyRef.current || ending.current || !bound.current) return;
    busyRef.current = true;
    setBusy(true);
    hadCode.current = false;
    attemptInFlight.current = method === "POST";
    preparingCode.current = false;
    setView({ phase: "interrupted" }); // Hide instructions before a write or cancel.
    void check(method); // Supersedes any pending read; one click means one write.
  };
  const logout = async () => {
    if (ending.current) return;
    ending.current = true;
    active.current?.abort();
    reading.current = false;
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
        checking={checking}
        onBack={onBack}
        onCancel={
          bound.current &&
          (view.phase === "ready" ||
            view.phase === "pending" ||
            view.phase === "waiting")
            ? () => action("DELETE")
            : undefined
        }
        onRetry={
          !busy &&
          bound.current &&
          (view.phase === "start" ||
            view.phase === "expired" ||
            view.phase === "failed")
            ? () => action("POST")
            : undefined
        }
        onRefresh={
          !busy &&
          bound.current &&
          (view.phase === "interrupted" || view.phase === "unavailable")
            ? () => {
                void check();
              }
            : undefined
        }
      />
      <div className="ah-onboarding-exit">
        <Button
          label="Keskeytä käyttöönotto ja kirjaudu ulos"
          variant="danger-subtle"
          onPress={() => {
            void logout();
          }}
        />
      </div>
    </>
  );
}
