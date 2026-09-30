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
}: {
  onUsable: () => void;
  onLogin: () => void;
  onLogout: () => Promise<void>;
  onBack?: () => void;
}) {
  const [view, setView] = useState<PiDeviceSignInView>({ phase: "waiting" });
  const checkFailed = useRef(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const busyRef = useRef(false);
  const bound = useRef<string | undefined>(undefined);
  const hadCode = useRef(false);
  const preparingCode = useRef(false);
  const generation = useRef(0);
  const active = useRef<AbortController | undefined>(undefined);
  const reading = useRef(false);
  const alive = useRef(false);
  const ending = useRef(false);
  const check = useCallback(
    async (method: "GET" | "POST" | "DELETE" = "GET") => {
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
      let readingStatus = false;
      try {
        if (!(await session())) return;
        // A write already checks its session binding in piAttempt. Reading
        // native status before a POST can exhaust the response budget while
        // the helper has started and is preparing a code.
        if (method === "GET" && !preparingCode.current) {
          readingStatus = true;
          const status = await piStatus(controller.signal);
          if (!current() || !(await session())) return;
          readingStatus = false;
          if (status === "login") {
            onLogin();
            return;
          }
          if (status === "usable") {
            setView({ phase: "connected" });
            onUsable();
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
          preparingCode.current = false;
          // Remember a code until an explicit new attempt. An absent native
          // attempt is not evidence that the provider accepted or rejected it.
          setView({ phase: hadCode.current ? "expired" : "start" });
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
    [onLogin, onUsable],
  );
  useEffect(() => {
    alive.current = true;
    void check();
    let tick = 0;
    const timer = window.setInterval(() => {
      if (
        !ending.current &&
        !checkFailed.current &&
        (preparingCode.current || ++tick % 3 === 0)
      )
        void check();
    }, 300);
    const focus = () => {
      if (!ending.current) void check();
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
