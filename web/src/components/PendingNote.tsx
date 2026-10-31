import type { PendingPhase } from "../app/mutations";
import { liveText } from "../i18n";
import { overlaysText } from "../text/overlays";

const txt = liveText(overlaysText);

/** What an unconfirmed command says after the first moments (ADR 0023):
 * nothing while the host normally answers, then that confirmation is slow,
 * and after a lost reply that its result is being checked. Steady text, no
 * animation. */
export function PendingNote({
  phase,
  className = "ah-pending-note",
}: {
  phase?: PendingPhase;
  className?: string;
}) {
  if (phase !== "slow" && phase !== "uncertain") return null;
  return (
    <p
      data-testid="mutation-pending"
      data-phase={phase}
      className={className}
      role="status"
    >
      {phase === "slow" ? txt.slow : txt.uncertain}
    </p>
  );
}
