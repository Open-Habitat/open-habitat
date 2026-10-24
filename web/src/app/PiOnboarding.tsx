import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AccountLogoutDialog } from "../components/Account";
import { OnboardingFrame } from "../components/OnboardingFrame";
import {
  PiDeviceSignIn,
  type PiDeviceSignInView,
} from "../components/PiDeviceSignIn";
import { Button } from "../components/Primitives";
import { ClaudeSignIn } from "./ClaudeSignIn";
import { type KeyProvider, PiCredentials } from "./PiCredentials";
import { type Attempt, piAttempt, piStatus, sessionCSRF } from "./pi";
import "./PiOnboarding.css";

type Choice = "openai" | "claude" | `key-${KeyProvider}`;
type Option = { id: Choice; name: string; how: string; mark: string };
const subscriptions: Option[] = [
  {
    id: "openai",
    name: "ChatGPT-tilaus",
    how: "Kirjaudu OpenAI-tililläsi. Käyttö kuuluu tilaukseesi.",
    mark: "Ch",
  },
  {
    id: "claude",
    name: "Claude-tilaus",
    how: "Kirjaudu Claude-tililläsi. Käyttö kuuluu tilaukseesi.",
    mark: "Cl",
  },
];
const apiKeys: (Option & { provider: KeyProvider })[] = (
  [
    ["openai", "OpenAI", "OA"],
    ["anthropic", "Anthropic", "An"],
    ["deepseek", "DeepSeek", "DS"],
  ] as const
).map(([provider, name, mark]) => ({
  id: `key-${provider}`,
  provider,
  name: `${name} API-avain`,
  how: `${name} laskuttaa käytöstä.`,
  mark,
}));

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
  notice,
}: {
  onUsable: () => void;
  onLogin: () => void;
  onLogout: () => Promise<void>;
  onBack?: () => void;
  forceSignIn?: boolean;
  /** Under the step card, such as the background clones that failed. */
  notice?: ReactNode;
}) {
  const [exitOpen, setExitOpen] = useState(false);
  const [choice, setChoice] = useState<Choice>("openai");
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
  const focusVerification = useRef<Promise<void> | undefined>(undefined);
  const alive = useRef(false);
  const ending = useRef(false);
  const check = useCallback(
    async (
      method: "GET" | "POST" | "DELETE" = "GET",
      verifySession = false,
    ) => {
      const awaitFocus = async () => {
        while (focusVerification.current) {
          const pending = focusVerification.current;
          await pending;
          if (focusVerification.current === pending) {
            focusVerification.current = undefined;
            break;
          }
        }
      };
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
          await awaitFocus();
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
        await awaitFocus();
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
          await awaitFocus();
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
      if (!reading.current && !busyRef.current) {
        void check("GET", true);
        return;
      }
      // A poll already authorized under an old cookie must wait for this
      // focus check before applying its reply. Do not restart a slow read.
      const version = generation.current;
      const discardOldReply = () => {
        active.current?.abort();
        ++generation.current;
        reading.current = false;
        busyRef.current = false;
        setChecking(false);
        setBusy(false);
        setView({ phase: "interrupted" });
      };
      const verification = sessionCSRF()
        .then((csrf) => {
          if (
            !alive.current ||
            ending.current ||
            generation.current !== version
          )
            return;
          if (csrf === bound.current) return;
          discardOldReply();
          if (csrf === "login") latest.current.onLogin();
          else if (latest.current.forceSignIn) void check("GET", true);
          else latest.current.onUsable();
        })
        .catch(() => {
          if (!alive.current || generation.current !== version) return;
          discardOldReply();
        });
      focusVerification.current = verification;
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
    // Starting a helper is in flight, not a failure. Cancellation hides the
    // old code until the daemon confirms what happened.
    setView({ phase: method === "POST" ? "waiting" : "cancelling" });
    void check(method); // Supersedes any pending read; one click means one write.
  };
  const logout = async () => {
    if (ending.current) return;
    ending.current = true;
    active.current?.abort();
    reading.current = false;
    ++generation.current;
    setView({ phase: "cancelling" });
    try {
      if (bound.current) await piAttempt("DELETE", bound.current);
    } catch {
      /* Logout must continue even if cancellation is uncertain. */
    }
    await onLogout();
  };
  // Every option is a row of one list; the chosen row opens in place with its
  // sign-in inside. The subscription sign-ins stay mounted while closed so an
  // attempt in progress keeps its code and completion; a key field is only
  // mounted while open, so a half-typed key goes away with it.
  const option = (o: Option, body: ReactNode, keep = false) => {
    const open = choice === o.id;
    return (
      <li
        key={o.id}
        className="ah-ai-option"
        data-testid={`ai-option-${o.id}`}
        data-open={open}
      >
        <button
          type="button"
          className="ah-ai-option-head"
          data-testid={`ai-option-${o.id}-choose`}
          aria-expanded={open}
          aria-controls={open || keep ? `ai-option-${o.id}-body` : undefined}
          onClick={() => setChoice(o.id)}
        >
          <span className="ah-ai-mark" aria-hidden="true">
            {o.mark}
          </span>
          <span className="ah-ai-option-text">
            <strong>{o.name}</strong>
            <small>{o.how}</small>
          </span>
          <span className="ah-ai-radio" aria-hidden="true" />
        </button>
        {open || keep ? (
          <div
            id={`ai-option-${o.id}-body`}
            className="ah-ai-option-body"
            hidden={!open}
          >
            {body}
          </div>
        ) : null}
      </li>
    );
  };
  return (
    <>
      <OnboardingFrame step="ai" notice={notice}>
        <section
          className="ah-onboarding-step ah-ai-step"
          aria-labelledby="pi-sign-in-title"
        >
          <header>
            <p className="ah-eyebrow">Käyttöönotto</p>
            <h1
              id="pi-sign-in-title"
              data-testid="pi-sign-in-title"
              tabIndex={-1}
            >
              Kirjaudu AI-palveluun
            </h1>
            <p>
              Valitse yksi tapa. Voit lisätä muita tilejä myöhemmin asetuksissa.
            </p>
          </header>
          <div className="ah-ai-groups">
            <p className="ah-ai-group" id="ai-group-subscription">
              Tilaus
            </p>
            <ul
              className="ah-ai-options"
              aria-labelledby="ai-group-subscription"
            >
              {option(
                subscriptions[0],
                <PiDeviceSignIn
                  embedded
                  view={view}
                  checking={checking}
                  onCancel={
                    !busy &&
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
                    (view.phase === "interrupted" ||
                      view.phase === "unavailable")
                      ? () => {
                          void check();
                        }
                      : undefined
                  }
                />,
                true,
              )}
              {option(
                subscriptions[1],
                <ClaudeSignIn
                  csrf={bound.current}
                  onSignedIn={onUsable}
                  onboarding
                />,
                true,
              )}
            </ul>
            {!forceSignIn && (
              <>
                <p className="ah-ai-group" id="ai-group-key">
                  API-avain · maksu käytön mukaan
                </p>
                <ul
                  className="ah-ai-options ah-ai-keys"
                  aria-labelledby="ai-group-key"
                >
                  {apiKeys.map((o) =>
                    option(
                      o,
                      <PiCredentials
                        embedded
                        providers={[o.provider]}
                        csrf={bound.current}
                        onSaved={() => {
                          void check();
                        }}
                      />,
                    ),
                  )}
                </ul>
              </>
            )}
          </div>
        </section>
      </OnboardingFrame>
      <div className="ah-onboarding-exit">
        {onBack && (
          <Button
            data-testid="pi-back-to-repositories"
            size="row"
            label="Takaisin repojen valintaan"
            variant="quiet"
            onPress={onBack}
          />
        )}
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
          void logout();
        }}
      />
    </>
  );
}
