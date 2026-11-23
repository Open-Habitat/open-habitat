import {
  type ConfigCheckResult,
  configGroups,
  missingKey,
  type SSHConfig,
  type SSHConfigHost,
} from "../app/ownMachines";
import { ControlButton } from "./ControlElements";
import { Icon, type IconName } from "./Icon";
import { Badge } from "./Status";
import type { Tone } from "./types";
import "./SSHConfigMachines.css";
import { liveText } from "../i18n";
import { sshConfigMachinesText } from "../text/sshConfigMachines";

const txt = liveText(sshConfigMachinesText);

// Omat koneet › the hosts of the person's own ~/.ssh/config, prototype
// round 2026-11-22-omat-koneet-ssh-config direction 1 "Oma ryhmä" (Jari
// 23.11.2026): found hosts are a group of their own under the machines, each
// shown as an own machine or hidden one by one; a shown host is a card in
// the machine list. Nothing is checked until the person asks, because a
// real connection may raise a second factor, an alarm or a ProxyJump chain.

export type SSHConfigActions = {
  show: (alias: string) => void;
  unshow: (alias: string) => void;
  hide: (alias: string) => void;
  unhide: (alias: string) => void;
  check: (alias: string) => void;
};

/** What the page holds for the config hosts beside the daemon's view. */
export type SSHConfigState = {
  config: SSHConfig;
  /** The last check this page made per alias. */
  checks: Readonly<Record<string, ConfigCheckResult>>;
  checking?: string;
  /** A choice is on its way. */
  busy?: boolean;
  actions: SSHConfigActions;
};

const resultTone: Record<ConfigCheckResult, Tone> = {
  ok: "success",
  offline: "neutral",
  unresolved: "warning",
  hostkey_unknown: "warning",
  host_key_changed: "danger",
  key_rejected: "danger",
  route_unsupported: "neutral",
  failed: "warning",
};

const file = () => <code>~/.ssh/config</code>;

function address(h: SSHConfigHost) {
  return `${h.user}@${h.host_name}${h.port === 22 ? "" : `:${h.port}`}`;
}

/** Facts known without connecting, shown before any check. */
function Tags({ h }: { h: SSHConfigHost }) {
  const tags: { label: string; tone: Tone; icon: IconName }[] = [];
  if (missingKey(h))
    tags.push({ label: txt.keyMissing, tone: "warning", icon: "warning" });
  if (h.proxy_jump)
    tags.push({ label: txt.via(h.proxy_jump), tone: "neutral", icon: "link" });
  else if (h.proxy_command)
    tags.push({ label: txt.ownCommand, tone: "neutral", icon: "link" });
  if (h.tailscale)
    tags.push({ label: txt.tailscaleName, tone: "info", icon: "plug" });
  if (!tags.length) return null;
  return (
    <span className="omc-tags">
      {tags.map((t) => (
        <span key={t.label} className="omc-tag" data-tone={t.tone}>
          <Icon name={t.icon} />
          {t.label}
        </span>
      ))}
    </span>
  );
}

function Facts({ h }: { h: SSHConfigHost }) {
  return (
    <dl className="om-facts">
      <dt>{txt.address}</dt>
      <dd className="om-mono om-wrap">
        {h.host_name}
        {h.port === 22 ? "" : `:${h.port}`}
      </dd>
      <dt>{txt.userOnMachine}</dt>
      <dd className="om-mono">{h.user}</dd>
      <dt>{txt.key}</dt>
      <dd>
        {h.keys.length ? (
          h.keys.map((k) => (
            <span key={k.path} className="omc-key">
              <span className="om-mono om-wrap">{k.path}</span>
              {k.present === false && (
                <span className="omc-err">{txt.notOnServer}</span>
              )}
            </span>
          ))
        ) : (
          <span className="om-muted">{txt.defaultKeys}</span>
        )}
      </dd>
      {(h.proxy_jump || h.proxy_command) && (
        <>
          <dt>{txt.route}</dt>
          <dd>
            {h.proxy_jump ? (
              <span className="om-mono">ProxyJump {h.proxy_jump}</span>
            ) : (
              txt.ownCommand
            )}
          </dd>
        </>
      )}
      <dt>{txt.defined}</dt>
      <dd className="om-mono om-wrap">
        {h.file}:{h.line}
      </dd>
      <dt>{txt.forAgent}</dt>
      <dd className="om-mono">ssh {h.alias}</dd>
    </dl>
  );
}

function resultNote(h: SSHConfigHost, r: ConfigCheckResult) {
  switch (r) {
    case "ok":
      return txt.note.ok(h.alias);
    case "offline":
      return txt.note.offline(h.proxy_jump);
    case "unresolved":
      return txt.note.unresolved(h.host_name, h.tailscale);
    case "hostkey_unknown":
      return txt.note.hostkey_unknown(h.alias);
    case "host_key_changed":
      return txt.note.host_key_changed(h.alias);
    case "key_rejected":
      return txt.note.key_rejected(missingKey(h));
    case "route_unsupported":
      return txt.note.route_unsupported(h.alias);
    default:
      return txt.note.failed;
  }
}

/** A shown config host as a machine card: not Habitat's, checked only on
 * request. */
export function ConfigMachineCard({
  host,
  state,
  match,
}: {
  host: SSHConfigHost;
  state: SSHConfigState;
  match: boolean;
}) {
  const r = state.checks[host.alias];
  const checking = state.checking === host.alias;
  return (
    <div
      className="s-card om-card om-machine omc-machine"
      data-testid="config-machine"
      data-machine={host.alias}
      data-state={r ?? "unchecked"}
    >
      <div className="om-head">
        <span className="om-mark">
          <Icon name="terminal" />
        </span>
        <span className="om-name">
          <span className="om-mono om-strong">{host.alias}</span>
          <span className="s-desc om-wrap">{address(host)}</span>
        </span>
        <span className="omc-source" data-testid="config-source">
          <Badge label="~/.ssh/config" tone="neutral" />
        </span>
        <span data-testid="config-machine-state">
          {r ? (
            <Badge label={txt.result[r]} tone={resultTone[r]} />
          ) : (
            <Badge label={txt.unchecked} tone="neutral" />
          )}
        </span>
      </div>
      <div className="om-blk">
        <Tags h={host} />
        {r && (
          <p
            className={`om-note ${r === "ok" ? "om-ok" : r === "offline" ? "" : "om-err"}`}
            role="status"
            data-testid="config-check-result"
            data-result={r}
          >
            {resultNote(host, r)}
          </p>
        )}
        <Facts h={host} />
        {match && <p className="s-desc">{txt.matchNote}</p>}
        <details className="om-more">
          <summary>{txt.whatHabitatKnows}</summary>
          <p className="s-desc">{txt.knows(file())}</p>
        </details>
      </div>
      <div className="om-blk om-btns">
        <ControlButton
          data-testid="config-check"
          size="row"
          variant="secondary"
          isPending={checking}
          isDisabled={!!state.checking && !checking}
          onPress={() => state.actions.check(host.alias)}
        >
          <Icon name="refresh" />
          {txt.check}
        </ControlButton>
        <ControlButton
          data-testid="config-remove"
          size="row"
          variant="quiet"
          isDisabled={state.busy}
          onPress={() => state.actions.unshow(host.alias)}
        >
          {txt.unshow}
        </ControlButton>
      </div>
    </div>
  );
}

function FoundRow({ h, state }: { h: SSHConfigHost; state: SSHConfigState }) {
  return (
    <li className="omc-row" data-testid="found-host" data-host={h.alias}>
      <span className="om-mark">
        <Icon name="terminal" />
      </span>
      <span className="omc-row-t">
        <span className="om-mono om-strong">{h.alias}</span>
        <span className="s-desc om-wrap">{address(h)}</span>
        <Tags h={h} />
      </span>
      <span className="omc-row-a">
        <ControlButton
          data-testid="found-adopt"
          size="row"
          variant="secondary"
          isDisabled={state.busy}
          onPress={() => state.actions.show(h.alias)}
        >
          <Icon name="plus" />
          {txt.show}
        </ControlButton>
        <ControlButton
          data-testid="found-hide"
          size="row"
          variant="quiet"
          isDisabled={state.busy}
          onPress={() => state.actions.hide(h.alias)}
        >
          {txt.hide}
        </ControlButton>
      </span>
    </li>
  );
}

function Skipped({ config }: { config: SSHConfig }) {
  if (!config.skipped.length && config.files.length < 2) return null;
  return (
    <details className="om-more omc-skipped" data-testid="config-skipped">
      <summary>{txt.skipped(config.skipped.length)}</summary>
      <ul>
        {config.skipped.map((s) => (
          <li key={`${s.what}:${s.why}`}>
            <span className="om-mono">{s.what}</span>{" "}
            <span className="om-muted">· {txt.why[s.why]}</span>
          </li>
        ))}
      </ul>
      <p className="s-desc">
        {txt.files}{" "}
        {config.files.map((f, i) => (
          <span key={f}>
            {i > 0 && ", "}
            <span className="om-mono">{f}</span>
          </span>
        ))}
      </p>
    </details>
  );
}

function Hidden({
  hosts,
  state,
}: {
  hosts: SSHConfigHost[];
  state: SSHConfigState;
}) {
  if (!hosts.length) return null;
  return (
    <details className="om-more omc-hidden" data-testid="config-hidden">
      <summary>{txt.hidden(hosts.length)}</summary>
      <ul>
        {hosts.map((h) => (
          <li key={h.alias} data-host={h.alias}>
            <span className="om-mono">{h.alias}</span>{" "}
            <span className="om-muted">{address(h)}</span>
            <ControlButton
              size="row"
              variant="quiet"
              data-testid="config-unhide"
              isDisabled={state.busy}
              onPress={() => state.actions.unhide(h.alias)}
            >
              {txt.unhide}
            </ControlButton>
          </li>
        ))}
      </ul>
      <p className="s-desc">{txt.hiddenNote}</p>
    </details>
  );
}

/** The cards of the shown config hosts, for the machine list. */
export function ConfigMachineCards({ state }: { state: SSHConfigState }) {
  const { shown } = configGroups(state.config);
  return (
    <>
      {shown.map((h) => (
        <ConfigMachineCard
          key={h.alias}
          host={h}
          state={state}
          match={state.config.match}
        />
      ))}
    </>
  );
}

/** Löytyi ~/.ssh/config:sta: the hosts not yet shown or hidden. */
export function ConfigGroup({ state }: { state: SSHConfigState }) {
  const { config } = state;
  const { found, hidden } = configGroups(config);
  return (
    <div className="omc-group" data-testid="found-group">
      <div className="s-sub om-sub">{txt.group}</div>
      {config.state === "unreadable" ? (
        <p className="om-note om-err" data-testid="config-unreadable">
          {txt.unreadable(file())}
        </p>
      ) : config.state === "empty" ? (
        <p className="s-desc omc-empty" data-testid="config-empty">
          {txt.empty(file(), <code>Host</code>)}
        </p>
      ) : (
        <div className="s-card om-card">
          <p className="om-blk s-desc">{txt.groupIntro(file())}</p>
          {found.length ? (
            <ul className="omc-rows">
              {found.map((h) => (
                <FoundRow key={h.alias} h={h} state={state} />
              ))}
            </ul>
          ) : (
            <p className="om-blk om-muted" data-testid="found-none">
              {txt.allDone}
            </p>
          )}
          <div className="om-blk">
            <Skipped config={config} />
            <Hidden hosts={hidden} state={state} />
          </div>
        </div>
      )}
    </div>
  );
}
