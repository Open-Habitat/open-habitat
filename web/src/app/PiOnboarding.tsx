import { useCallback, useEffect, useRef, useState } from "react";
import {
  PiDeviceSignIn,
  type PiDeviceSignInView,
} from "../components/PiDeviceSignIn";
import { piAttempt, piStatus, type Attempt } from "./pi";

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
  return { phase: "interrupted" }; // Native status, not a child completion event, determines success.
}

export function PiOnboarding({
  onUsable,
  onLogin,
}: {
  onUsable: () => void;
  onLogin: () => void;
}) {
  const [view, setView] = useState<PiDeviceSignInView>({ phase: "start" });
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const running = useRef(false);
  const hadCode = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const check = useCallback(
    async (method: "GET" | "POST" | "DELETE" = "GET") => {
      if (running.current) return;
      running.current = true;
      try {
        const status = await piStatus();
        if (!alive.current) return;
        if (status === "login") {
          setView({ phase: "interrupted" });
          onLogin();
          return;
        }
        if (status === "usable") {
          setView({ phase: "connected" });
          onUsable();
          return;
        }
        const attempt = await piAttempt(method);
        if (!alive.current) return;
        if (attempt === "login") {
          setView({ phase: "interrupted" });
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
          // Independently recheck the native status route before revealing any workspace data.
          if ((await piStatus()) === "usable" && alive.current) {
            setView({ phase: "connected" });
            onUsable();
            return;
          }
        }
        if (alive.current) {
          if (attempt.state === "device_code") hadCode.current = true;
          setView(viewOf(attempt));
        }
      } catch {
        if (alive.current) setView({ phase: "unavailable" });
      } finally {
        running.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [onLogin, onUsable],
  );
  useEffect(() => {
    void check();
    const timer = window.setInterval(() => {
      void check();
    }, 3000);
    const focus = () => {
      setView({ phase: "interrupted" });
      void check();
    };
    window.addEventListener("focus", focus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [check]);
  const action = (method: "POST" | "DELETE") => {
    if (busy || running.current) return;
    setBusy(true);
    hadCode.current = false;
    setView({ phase: "interrupted" }); // Drop the old code before any write.
    void check(method);
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
    </>
  );
}
