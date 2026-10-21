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

export const landingSlowText =
  "Palvelin vastaa tavallista hitaammin. Odotetaan yhä; voit jättää sivun auki.";

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
}: {
  state: "connecting" | "failed";
  name?: string;
  server: string;
  revealed: boolean;
  slow: boolean;
  onRetry?: () => void;
}) {
  const failed = state === "failed";
  return (
    <div
      className="ah-landing"
      data-revealed={revealed || failed ? "" : undefined}
      data-failed={failed ? "" : undefined}
    >
      <div className="ah-landing-in">
        <LandingMark />
        <h1 className="ah-landing-word">Open Habitat</h1>
        <p className="ah-landing-server">{server}</p>
        <div className="ah-landing-bar" aria-hidden="true">
          <span />
        </div>
        {failed ? (
          <>
            <h2
              data-testid="workspaces-unavailable-title"
              className="ah-landing-say"
            >
              Työtiloja ei saatu näkyviin
            </h2>
            <div className="ah-landing-more">
              <p>
                Palvelin ei vastannut. Tämä ei tarkoita, että työtilasi olisivat
                kadonneet.
              </p>
              {onRetry ? (
                <ControlButton
                  data-testid="retry"
                  size="page"
                  variant="primary"
                  onPress={onRetry}
                >
                  <Icon name="refresh" />
                  Yritä uudelleen
                </ControlButton>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <p className="ah-landing-say" role="status">
              {name
                ? `Hei ${name}. Haetaan työtilojasi…`
                : "Yhdistetään palvelimeen…"}
            </p>
            <div className="ah-landing-more">
              {slow ? <p>{landingSlowText}</p> : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
