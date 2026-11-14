import { useState } from "react";
import { useText } from "../i18n";
import { landingText } from "../text/landing";
import { ControlButton } from "./ControlElements";
import { HabitatMark, type MarkState } from "./HabitatMark";
import { Icon } from "./Icon";
import "./Landing.css";

// The Open Habitat mark: the landing plays its intro once per page (the ring
// draws itself and the resident steps in), then the mark loads until the app
// takes over, or shows the error state. web/index.html carries the same
// markup so the landing can paint before the bundle runs; when that copy has
// been on screen, its intro was the page's.
let introPlayed =
  typeof document !== "undefined" &&
  !!document.querySelector('.ah-landing[data-landing="static"]') &&
  performance.now() > 300;
export function LandingMark({ failed = false }: { failed?: boolean }) {
  const [state, setState] = useState<MarkState>(
    introPlayed ? "loading" : "intro",
  );
  return (
    <span
      className="ah-landing-mark"
      onAnimationEnd={(event) => {
        if (event.animationName !== "oh-enter") return;
        introPlayed = true;
        setState("loading");
      }}
    >
      <HabitatMark state={failed ? "error" : state} size={48} />
    </span>
  );
}

/**
 * The loading landing (Merkki): the product's own moment before the app.
 * The caller owns timing: `revealed` turns on 300 ms after the load began,
 * and the caller keeps the landing mounted for 500 ms once it has shown.
 */
export function Landing({
  state,
  name,
  server,
  revealed,
  slow,
  onRetry,
  failure = "network",
  retry,
  onSignIn,
}: {
  state: "connecting" | "failed";
  name?: string;
  server: string;
  revealed: boolean;
  slow: boolean;
  onRetry?: () => void;
  failure?: "network" | "answer" | "identity";
  retry?: {
    offline: boolean;
    seconds?: number;
    progress: number;
    exhausted: boolean;
    attempting?: boolean;
  };
  onSignIn?: () => void;
}) {
  const failed = state === "failed";
  const t = useText(landingText);
  return (
    <div
      className="ah-landing"
      data-revealed={revealed || failed ? "" : undefined}
      data-failed={failed ? "" : undefined}
    >
      <div className="ah-landing-in">
        <LandingMark failed={failed} />
        <h1 data-testid="landing-heading" className="ah-landing-word">
          Open Habitat
        </h1>
        <p className="ah-landing-server">{server}</p>
        <div className="ah-landing-bar" aria-hidden="true">
          <span
            style={
              failed && retry?.seconds !== undefined
                ? {
                    width: `${retry.progress * 100}%`,
                    transform: "none",
                    opacity: 1,
                  }
                : undefined
            }
          />
        </div>
        {failed ? (
          <>
            <h2
              data-testid="workspaces-unavailable-title"
              className="ah-landing-say"
            >
              {failure === "identity"
                ? t.identityTitle
                : failure === "answer"
                  ? t.answerTitle
                  : t.failedTitle}
            </h2>
            <div className="ah-landing-more">
              <p data-testid="landing-failure-detail">
                {failure === "identity"
                  ? t.identityDetail
                  : failure === "answer"
                    ? t.answerDetail
                    : t.failedDetail}
              </p>
              {failure !== "identity" && retry ? (
                <>
                  {retry.offline ? (
                    <p data-testid="landing-offline">{t.offline}</p>
                  ) : null}
                  <p
                    data-testid="landing-retry-status"
                    data-seconds={retry.seconds}
                    data-exhausted={retry.exhausted || undefined}
                  >
                    {retry.attempting
                      ? t.trying
                      : retry.exhausted
                        ? t.stopped
                        : retry.offline
                          ? t.waiting
                          : retry.seconds !== undefined
                            ? t.countdown(retry.seconds)
                            : null}
                  </p>
                </>
              ) : null}
              {failure === "identity" && onSignIn ? (
                <ControlButton
                  data-testid="landing-sign-in"
                  size="page"
                  variant="primary"
                  onPress={onSignIn}
                >
                  {t.signIn}
                </ControlButton>
              ) : null}
              {onRetry ? (
                <ControlButton
                  data-testid="retry"
                  size="page"
                  variant={failure === "identity" ? "secondary" : "primary"}
                  onPress={onRetry}
                  isDisabled={retry?.attempting}
                >
                  <Icon name="refresh" />
                  {t.retry}
                </ControlButton>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <p className="ah-landing-say" role="status">
              {name ? t.greeting(name) : t.connecting}
            </p>
            <div className="ah-landing-more">
              {slow ? <p data-testid="landing-slow">{t.slow}</p> : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
