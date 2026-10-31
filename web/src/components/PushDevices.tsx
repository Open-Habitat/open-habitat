import { formatDate, useText } from "../i18n";
import { pushNotificationsText } from "../text/pushNotifications";
import { ControlButton } from "./ControlElements";
import "./PushDevices.css";

export type PushDeviceRow = {
  device_id: string;
  label: string;
  created_at: string;
  /** The last send to it failed. */
  failed: boolean;
};

/** What this browser can do: subscribe, needs the home screen first
 * (iPhone in Safari), has notifications blocked, or cannot at all. */
export type PushHere = "ready" | "home-screen" | "denied" | "unsupported";

export type PushNote =
  | {
      kind: "outcome";
      outcome: "delivered" | "gone" | "rejected" | "unreachable";
    }
  | { kind: "problem"; code: string };

/** Phone notifications' devices, inside the feature's card: this device's
 * action, the person's devices with a test and a removal, and what the last
 * action ended in. Shown only while the feature is on. */
export function PushDevices({
  devices,
  thisDevice,
  here,
  busy,
  note,
  readError,
  onEnable,
  onTest,
  onRemove,
  onReload,
}: {
  devices: readonly PushDeviceRow[];
  /** This browser's device id, when it is subscribed. */
  thisDevice?: string;
  here: PushHere;
  /** An action in flight: "enable" or a device id. */
  busy?: string;
  note?: PushNote;
  readError?: boolean;
  onEnable: () => void;
  onTest: (deviceId: string) => void;
  onRemove: (deviceId: string) => void;
  onReload: () => void;
}) {
  const t = useText(pushNotificationsText);
  const recorded = devices.some((d) => d.device_id === thisDevice);
  const message =
    note?.kind === "outcome"
      ? t.outcome[note.outcome]
      : note?.kind === "problem"
        ? (t.problem[note.code as keyof typeof t.problem] ?? t.problem.other)
        : undefined;
  return (
    <div className="pd" data-testid="push-devices">
      {here === "home-screen" && (
        <p className="pd-hint" data-testid="push-home-screen">
          {t.iphone}
        </p>
      )}
      {here === "denied" && (
        <p className="pd-hint" data-testid="push-denied">
          {t.denied}
        </p>
      )}
      {here === "unsupported" && (
        <p className="pd-hint" data-testid="push-unsupported">
          {t.unsupported}
        </p>
      )}
      {here === "ready" && (
        <div className="pd-here">
          <ControlButton
            data-testid="push-enable"
            size="row"
            variant={recorded ? "secondary" : "primary"}
            isDisabled={!!busy}
            onPress={onEnable}
          >
            {busy === "enable" ? t.busy : recorded ? t.reenable : t.enable}
          </ControlButton>
        </div>
      )}
      <h3 className="pd-heading">{t.heading}</h3>
      {readError ? (
        <div className="pd-row">
          <p role="alert" data-testid="push-read-error">
            {t.readError}
          </p>
          <ControlButton size="row" onPress={onReload}>
            {t.reload}
          </ControlButton>
        </div>
      ) : devices.length === 0 ? (
        <p className="pd-none" data-testid="push-no-devices">
          {t.none}
        </p>
      ) : (
        <ul className="pd-list">
          {devices.map((d) => (
            <li
              key={d.device_id}
              className="pd-row"
              data-testid="push-device"
              data-device={d.device_id}
              data-this={d.device_id === thisDevice || undefined}
            >
              <span className="pd-name">
                <strong>{d.label}</strong>
                {d.device_id === thisDevice && (
                  <span className="pd-this"> · {t.thisDevice}</span>
                )}
                <span className="pd-meta">
                  {t.added(
                    formatDate(new Date(d.created_at), {
                      day: "numeric",
                      month: "numeric",
                      year: "numeric",
                    }),
                  )}
                  {d.failed && (
                    <span
                      className="pd-failed"
                      data-testid="push-device-failed"
                    >
                      {" "}
                      · {t.lastFailed}
                    </span>
                  )}
                </span>
              </span>
              <span className="pd-actions">
                <ControlButton
                  data-testid="push-device-test"
                  size="row"
                  isDisabled={!!busy}
                  onPress={() => onTest(d.device_id)}
                >
                  {busy === d.device_id ? t.busy : t.test}
                </ControlButton>
                <ControlButton
                  data-testid="push-device-remove"
                  size="row"
                  variant="danger-subtle"
                  isDisabled={!!busy}
                  onPress={() => onRemove(d.device_id)}
                >
                  {t.remove}
                </ControlButton>
              </span>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p
          className="pd-note"
          role={
            note?.kind === "outcome" && note.outcome === "delivered"
              ? "status"
              : "alert"
          }
          data-testid="push-note"
          data-outcome={note?.kind === "outcome" ? note.outcome : note?.code}
        >
          {message}
        </p>
      )}
    </div>
  );
}
