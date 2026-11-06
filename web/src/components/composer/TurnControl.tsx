import { useText } from "../../i18n";
import { turnControlText } from "../../text/turnControl";
import { Icon } from "../Icon";
import { TooltipButton } from "../QuickTooltip";

/** The composer row's middle slot while the agent is not working
 * (raise-to-your-turn, experimental): one button that raises a quiet
 * conversation to Sinun vuorosi, says Ei nyt to one waiting there, or,
 * raised, reads Sinun vuorossasi ✕ and lowers it. Ohjaa and Stop take the
 * slot when work starts. */
export function TurnControl({
  action,
  onPress,
}: {
  action: "raise" | "lower" | "not_now";
  onPress: () => void;
}) {
  const t = useText(turnControlText);
  const raised = action === "lower";
  return (
    <TooltipButton
      data-testid="composer-turn"
      data-turn={action}
      type="button"
      className="ah-crow-chip ah-crow-turn"
      aria-pressed={action === "raise" ? false : raised || undefined}
      aria-label={
        raised ? t.raisedLabel : action === "raise" ? t.raiseTip : t.notNowTip
      }
      title={
        raised ? t.raisedLabel : action === "raise" ? t.raiseTip : t.notNowTip
      }
      onClick={onPress}
    >
      <Icon name={action === "raise" ? "top" : raised ? "top" : "bottom"} />
      <span>{action === "raise" ? t.raise : raised ? t.raised : t.notNow}</span>
      {raised ? <Icon name="cross" className="ah-crow-turn-x" /> : null}
    </TooltipButton>
  );
}
