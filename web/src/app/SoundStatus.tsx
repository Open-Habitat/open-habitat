import { ControlButton } from "../components/ControlElements";
import { Icon } from "../components/Icon";
import { useText } from "../i18n";
import { attentionSoundText } from "../text/attentionSound";
import { nightHourLabel } from "./attentionSound";

function ReasonIcon({ night }: { night: boolean }) {
  return night ? (
    <Icon name="moon" />
  ) : (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" />
      <path d="M10.5 6l3.5 4M14 6l-3.5 4" />
    </svg>
  );
}

/** Independent reasons: fixing one must not hide the others. */
export function SoundStatus({
  off,
  muted,
  night,
  nightStart,
  nightEnd,
  writable,
  onEnable,
  onUnmute,
  onDisableNight,
  onEditNight,
}: {
  off: boolean;
  muted: boolean;
  night: boolean;
  nightStart: number;
  nightEnd: number;
  writable: boolean;
  onEnable: () => void;
  onUnmute: () => void;
  onDisableNight: () => void;
  onEditNight: () => void;
}) {
  const t = useText(attentionSoundText);
  const reasons = [
    ...(off
      ? [
          {
            id: "off",
            text: t.offReason,
            fix: t.enableSounds,
            action: onEnable,
          },
        ]
      : []),
    ...(muted
      ? [{ id: "muted", text: t.mutedReason, fix: t.unmute, action: onUnmute }]
      : []),
    ...(night
      ? [
          {
            id: "night",
            text: t.nightReason(
              nightHourLabel(nightStart),
              nightHourLabel(nightEnd),
            ),
            fix: t.nightOff,
            action: onDisableNight,
          },
        ]
      : []),
  ];
  if (!reasons.length) return null;
  return (
    <div className="ss-status" role="status" data-testid="sound-status">
      <ReasonIcon night={!off && !muted} />
      <div className="ss-status-heading">
        <strong>{t.quietHere}</strong>
        <span>{t.quietReasons(reasons.length)}</span>
      </div>
      <ul className="ss-reasons">
        {reasons.map((reason) => (
          <li key={reason.id} data-testid={`sound-reason-${reason.id}`}>
            <ReasonIcon night={reason.id === "night"} />
            <span className="ss-reason-text">
              {reason.text}
              {off && reason.id !== "off" ? <em>{t.offRedundant}</em> : null}
            </span>
            <span className="ss-status-actions">
              <ControlButton
                size="row"
                variant="secondary"
                data-testid={
                  reason.id === "night"
                    ? "sound-night-off"
                    : `sound-fix-${reason.id}`
                }
                isDisabled={reason.id !== "muted" && !writable}
                onPress={reason.action}
              >
                {reason.fix}
              </ControlButton>
              {reason.id === "night" ? (
                <ControlButton
                  size="row"
                  variant="quiet"
                  data-testid="sound-night-settings"
                  onPress={onEditNight}
                >
                  {t.nightSettings}
                  <Icon name="down" />
                </ControlButton>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The account menu's tidy version: the reason that decides first, on one
 * line, and the way to Settings › Äänet, where every reason and its fix is
 * listed. Off outranks the others because nothing else matters until sounds
 * are on; night outranks mute, which the row's own control already shows. */
export function SoundSummary({
  off,
  muted,
  night,
  nightStart,
  nightEnd,
  onDetails,
}: {
  off: boolean;
  muted: boolean;
  night: boolean;
  nightStart: number;
  nightEnd: number;
  onDetails: () => void;
}) {
  const t = useText(attentionSoundText);
  const reason = off
    ? t.offReason
    : night
      ? t.nightReason(nightHourLabel(nightStart), nightHourLabel(nightEnd))
      : muted
        ? t.mutedReason
        : null;
  if (!reason) return null;
  return (
    <p
      className="ah-sound-state ah-sound-summary"
      role="status"
      data-testid="sound-summary"
    >
      <span data-testid="sound-summary-reason">{reason}</span>
      <ControlButton
        size="row"
        variant="quiet"
        data-testid="sound-menu-details"
        onPress={onDetails}
      >
        {t.menuDetails}
      </ControlButton>
    </p>
  );
}
