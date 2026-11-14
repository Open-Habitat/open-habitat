import { useMemo } from "react";
import { encode } from "uqr";
import "./DeviceLink.css";
import {
  type BrowserSession,
  countdown,
  deviceName,
  signedInAt,
} from "../app/deviceLink";
import type { AccountProfile } from "../app/pi";
import { liveText } from "../i18n";
import { devicesText } from "../text/devices";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

const txt = liveText(devicesText);

/** A scannable QR code drawn as one SVG path; the quiet zone is part of it. */
export function QrCode({ value }: { value: string }) {
  const { d, size } = useMemo(() => {
    const { data, size } = encode(value, { ecc: "M", border: 2 });
    let d = "";
    data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      });
    });
    return { d, size };
  }, [value]);
  return (
    <svg
      data-testid="device-qr"
      className="dl-qr"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={txt.qr}
      shape-rendering="crispEdges"
    >
      {/* Fixed dark-on-white in every theme: a camera reads the code by
          its contrast, not by the page's colours. */}
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

export type LinkPhase =
  | { kind: "idle" }
  | { kind: "minting" }
  | { kind: "pending"; url: string; left: number; total: number }
  | { kind: "used"; session?: BrowserSession }
  | { kind: "expired" }
  | { kind: "failed" };

/** The Laitteet card: a title and the button, then the code in place. */
export function LinkCard({
  phase,
  onShow,
  onCancel,
  onDone,
}: {
  phase: LinkPhase;
  onShow: () => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  const showing = phase.kind !== "idle" && phase.kind !== "minting";
  return (
    <div
      className="s-card dl-card"
      data-settings-row="device-link"
      tabIndex={-1}
    >
      <div className="dl-head">
        <span className="dl-ic">
          <Icon name="phone" />
        </span>
        <strong>{txt.signInPhone}</strong>
        {!showing && (
          <ControlButton
            data-testid="device-code-show"
            variant="primary"
            size="row"
            isPending={phase.kind === "minting"}
            onPress={onShow}
          >
            <Icon name="qr" />
            {txt.showCode}
          </ControlButton>
        )}
      </div>
      {phase.kind === "pending" && (
        <div className="dl-panel">
          {phase.left > 0 && (
            <div className="dl-qrbox">
              <QrCode value={phase.url} />
            </div>
          )}
          <div className="dl-side">
            <p className="dl-left">
              <Icon name="clock" />
              <span>
                {txt.expires}{" "}
                <b data-testid="link-countdown" data-seconds={phase.left}>
                  {countdown(phase.left)}
                </b>
              </span>
            </p>
            <span className="dl-time" aria-hidden="true">
              <span style={{ width: `${(100 * phase.left) / phase.total}%` }} />
            </span>
            <div>
              <ControlButton
                data-testid="cancel"
                size="row"
                variant="secondary"
                onPress={onCancel}
              >
                {txt.cancel}
              </ControlButton>
            </div>
          </div>
        </div>
      )}
      {phase.kind === "used" && (
        <div
          className="dl-panel done"
          role="status"
          data-testid="device-link-result"
        >
          <p className="dl-result ok">
            <Icon name="check" />
            <span>
              <b>{phase.session ? deviceName(phase.session) : txt.device}</b>{" "}
              {txt.signedIn}
            </span>
          </p>
          <ControlButton size="row" variant="secondary" onPress={onDone}>
            {txt.done}
          </ControlButton>
        </div>
      )}
      {(phase.kind === "expired" || phase.kind === "failed") && (
        <div
          className="dl-panel done"
          role="status"
          data-testid="device-link-result"
        >
          <p className="dl-result">
            <Icon name="clock" />
            <span>
              {phase.kind === "expired" ? txt.codeExpired : txt.codeFailed}
            </span>
          </p>
          <ControlButton size="row" variant="secondary" onPress={onShow}>
            <Icon name="qr" />
            {txt.newCode}
          </ControlButton>
        </div>
      )}
    </div>
  );
}

export function SessionList({
  sessions,
  fresh,
  onEnd,
  onLogout,
}: {
  sessions: BrowserSession[];
  fresh?: string;
  onEnd: (s: BrowserSession) => void;
  onLogout?: () => void;
}) {
  return (
    <ul
      data-testid="device-sessions"
      className="dl-list"
      data-settings-row="sessions"
      tabIndex={-1}
      aria-label={txt.signedInDevices}
    >
      {sessions.map((s) => (
        <li
          key={s.id}
          data-current={s.current}
          data-fresh={s.id === fresh}
          data-method={s.method}
          className={s.id === fresh ? "fresh" : undefined}
        >
          <span className="dl-dev">
            <Icon name={s.device_kind === "phone" ? "phone" : "laptop"} />
          </span>
          <span className="dl-sm">
            <span className="dl-sn">
              {deviceName(s)}
              {s.current && <span className="dl-badge">{txt.thisBrowser}</span>}
              {s.id === fresh && (
                <span className="dl-badge new">{txt.fresh}</span>
              )}
            </span>
            <span className="s-desc">
              {s.method === "github" ? txt.viaGitHub : txt.viaQr}{" "}
              {signedInAt(s.created_at)}
            </span>
          </span>
          {s.current ? (
            onLogout && (
              <ControlButton
                data-testid="logout-open"
                variant="secondary"
                size="row"
                onPress={onLogout}
              >
                {txt.logout}
              </ControlButton>
            )
          ) : (
            <ControlButton
              variant="quiet"
              size="row"
              aria-label={txt.endNamed(deviceName(s))}
              data-testid="device-session-end"
              onPress={() => onEnd(s)}
            >
              {txt.end}
            </ControlButton>
          )}
        </li>
      ))}
    </ul>
  );
}

export type PhoneLinkState =
  | { kind: "checking" }
  | { kind: "ask"; profile: AccountProfile; busy?: boolean }
  | { kind: "in" }
  | { kind: "dead" }
  | { kind: "no" };

/** The phone's /link page. */
export function PhoneLink({
  state,
  host,
  onSignIn,
  onCancel,
}: {
  state: PhoneLinkState;
  host: string;
  onSignIn: () => void;
  onCancel: () => void;
}) {
  const name =
    state.kind === "ask"
      ? state.profile.name || state.profile.email || txt.ownAccount
      : "";
  return (
    <main className="dl-phone">
      <p className="dl-brand">
        <span className="dl-logo" aria-hidden="true">
          OH
        </span>
        <span>
          Open Habitat · <span className="dl-mono">{host}</span>
        </span>
      </p>
      <section className="dl-phone-body" aria-live="polite">
        {state.kind === "ask" && (
          <>
            {state.profile.avatar_url ? (
              <img className="dl-av" src={state.profile.avatar_url} alt="" />
            ) : (
              <span className="dl-av" aria-hidden="true">
                {name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <h1 data-testid="device-link-title">{txt.askName(name)}</h1>
            <ControlButton
              data-testid="device-link-confirm"
              size="page"
              variant="primary"
              className="dl-wide"
              isPending={state.busy}
              onPress={onSignIn}
            >
              {txt.signIn}
            </ControlButton>
            <ControlButton
              data-testid="cancel"
              size="page"
              variant="secondary"
              className="dl-wide"
              isDisabled={state.busy}
              onPress={onCancel}
            >
              {txt.cancel}
            </ControlButton>
          </>
        )}
        {state.kind === "in" && (
          <>
            <span className="dl-big ok">
              <Icon name="check" />
            </span>
            <h1 data-testid="device-link-success">{txt.signedInTitle}</h1>
          </>
        )}
        {state.kind === "dead" && (
          <>
            <span className="dl-big">
              <Icon name="clock" />
            </span>
            <h1 data-testid="device-link-expired">{txt.dead}</h1>
            <p>{txt.deadHint}</p>
          </>
        )}
        {state.kind === "no" && (
          <>
            <span className="dl-big">
              <Icon name="phone" />
            </span>
            <h1>{txt.notSignedIn}</h1>
          </>
        )}
      </section>
    </main>
  );
}
