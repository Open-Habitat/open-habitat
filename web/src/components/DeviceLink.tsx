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
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

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
      className="dl-qr"
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="QR-koodi"
      shape-rendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#16191d" />
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
    <div className="s-card dl-card">
      <div className="dl-head">
        <span className="dl-ic">
          <Icon name="phone" />
        </span>
        <strong>Kirjaudu puhelimella</strong>
        {!showing && (
          <ControlButton
            variant="primary"
            isPending={phase.kind === "minting"}
            onPress={onShow}
          >
            <Icon name="qr" />
            Näytä koodi
          </ControlButton>
        )}
      </div>
      {phase.kind === "pending" && (
        <div className="dl-panel">
          <div className="dl-qrbox">
            <QrCode value={phase.url} />
          </div>
          <div className="dl-side">
            <p className="dl-left">
              <Icon name="clock" />
              <span>
                Vanhenee{" "}
                <b data-testid="link-countdown">{countdown(phase.left)}</b>
              </span>
            </p>
            <span className="dl-time" aria-hidden="true">
              <span style={{ width: `${(100 * phase.left) / phase.total}%` }} />
            </span>
            <div>
              <ControlButton variant="secondary" onPress={onCancel}>
                Peruuta
              </ControlButton>
            </div>
          </div>
        </div>
      )}
      {phase.kind === "used" && (
        <div className="dl-panel done" role="status">
          <p className="dl-result ok">
            <Icon name="check" />
            <span>
              <b>{phase.session ? deviceName(phase.session) : "Laite"}</b>{" "}
              kirjautui.
            </span>
          </p>
          <ControlButton variant="secondary" onPress={onDone}>
            Valmis
          </ControlButton>
        </div>
      )}
      {(phase.kind === "expired" || phase.kind === "failed") && (
        <div className="dl-panel done" role="status">
          <p className="dl-result">
            <Icon name="clock" />
            <span>
              {phase.kind === "expired"
                ? "Koodi vanheni."
                : "Koodia ei voitu käyttää."}
            </span>
          </p>
          <ControlButton variant="secondary" onPress={onShow}>
            <Icon name="qr" />
            Näytä uusi koodi
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
    <ul className="dl-list" aria-label="Kirjautuneet laitteet">
      {sessions.map((s) => (
        <li key={s.id} className={s.id === fresh ? "fresh" : undefined}>
          <span className="dl-dev">
            <Icon name={s.device_kind === "phone" ? "phone" : "laptop"} />
          </span>
          <span className="dl-sm">
            <span className="dl-sn">
              {deviceName(s)}
              {s.current && <span className="dl-badge">Tämä selain</span>}
              {s.id === fresh && <span className="dl-badge new">Uusi</span>}
            </span>
            <span className="s-desc">
              {s.method === "github"
                ? "Kirjautunut GitHubilla"
                : "Kirjautunut QR-koodilla"}{" "}
              {signedInAt(s.created_at)}
            </span>
          </span>
          {s.current ? (
            onLogout && (
              <ControlButton
                variant="secondary"
                size="compact"
                onPress={onLogout}
              >
                Kirjaudu ulos…
              </ControlButton>
            )
          ) : (
            <ControlButton
              variant="quiet"
              size="compact"
              aria-label={`Kirjaa ${deviceName(s)} ulos`}
              onPress={() => onEnd(s)}
            >
              Kirjaa ulos…
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
      ? state.profile.name || state.profile.email || "Oma tili"
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
            <h1>Kirjaudutaanko nimellä {name}?</h1>
            <ControlButton
              variant="primary"
              className="dl-wide"
              isPending={state.busy}
              onPress={onSignIn}
            >
              Kirjaudu
            </ControlButton>
            <ControlButton
              variant="secondary"
              className="dl-wide"
              isDisabled={state.busy}
              onPress={onCancel}
            >
              Peruuta
            </ControlButton>
          </>
        )}
        {state.kind === "in" && (
          <>
            <span className="dl-big ok">
              <Icon name="check" />
            </span>
            <h1>Kirjauduttu</h1>
          </>
        )}
        {state.kind === "dead" && (
          <>
            <span className="dl-big">
              <Icon name="clock" />
            </span>
            <h1>Koodi ei enää toimi</h1>
            <p>Näytä uusi koodi tietokoneelta.</p>
          </>
        )}
        {state.kind === "no" && (
          <>
            <span className="dl-big">
              <Icon name="phone" />
            </span>
            <h1>Et kirjautunut</h1>
          </>
        )}
      </section>
    </main>
  );
}
