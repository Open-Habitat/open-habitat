import { useText } from "../i18n";
import { landingText } from "../text/landing";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import "./Landing.css";

// The placeholder mark of the accepted Merkki landing (an arch with a dot).
// It stays until Open Habitat has a real mark; web/index.html carries the same
// markup so the landing can paint before the bundle runs.
export function LandingMark() {
  return (
    <svg className="ah-landing-mark" viewBox="0 0 48 48" aria-hidden="true">
      <rect
        className="ah-landing-mark-tile"
        x="2.5"
        y="2.5"
        width="43"
        height="43"
        rx="12"
      />
      <path
        className="ah-landing-mark-arch"
        d="M14 36V23a10 10 0 0 1 20 0v13"
      />
      <circle className="ah-landing-mark-dot" cx="24" cy="28.5" r="3.2" />
    </svg>
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
        <LandingMark />
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
