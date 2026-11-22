import { ControlButton } from "../components/ControlElements";
import { Icon } from "../components/Icon";
import { useText } from "../i18n";
import { attentionSoundText } from "../text/attentionSound";
import { nightHourLabel, type Silence } from "./attentionSound";

/** One place for the page's current silence. Further reasons can join here
 * without moving the settings themselves. */
export function SoundStatus({
  reason,
  nightEnd,
  writable,
  onDisableNight,
  onEditNight,
}: {
  reason: Silence | undefined;
  nightEnd: number;
  writable: boolean;
  onDisableNight: () => void;
  onEditNight: () => void;
}) {
  const t = useText(attentionSoundText);
  if (reason !== "night") return null;
  return (
    <div
      className="ss-status"
      role="status"
      data-testid="sound-status"
      data-state={reason}
    >
      <Icon name="moon" />
      <strong>{t.quietUntil(nightHourLabel(nightEnd))}</strong>
      <div className="ss-status-actions">
        <ControlButton
          size="row"
          variant="secondary"
          data-testid="sound-night-off"
          isDisabled={!writable}
          onPress={onDisableNight}
        >
          {t.nightOff}
        </ControlButton>
        <ControlButton
          size="row"
          variant="quiet"
          data-testid="sound-night-settings"
          onPress={onEditNight}
        >
          {t.nightSettings}
        </ControlButton>
      </div>
    </div>
  );
}
