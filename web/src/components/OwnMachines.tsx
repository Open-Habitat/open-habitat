import { type ReactNode, useEffect, useState } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import {
  type Check,
  fiDate,
  type Grant,
  type GrantDays,
  hostKeyCommand,
  type Machine,
  type MachineState,
  machineState,
  type OwnMachines,
  osFamily,
  osLabel,
  type Peer,
  seenAgo,
  sshInclude,
  windowsHostKeyCommand,
  windowsSSHServerCommand,
} from "../app/ownMachines";
import { ControlButton, Segmented } from "./ControlElements";
import { QrCode } from "./DeviceLink";
import { Icon } from "./Icon";
import { TextField } from "./Primitives";
import { Badge } from "./Status";
import type { Tone } from "./types";
import "./OwnMachines.css";
import { liveText } from "../i18n";
import { ownMachinesText } from "../text/ownMachines";

const txt = liveText(ownMachinesText);

// Asetukset › Omat koneet, prototype direction 1 Ohjattu (Jari 29.10.2026):
// the page summarises; a five-step dialog does the setup, and renewal opens
// it at the key line. Machines can be added afterwards and are named as
// Tailscale names them. There is no pause: nothing on this side would stop
// an agent running as the same user. The three plain sentences are said
// before anything is saved.

export const wizardSteps = () => txt.steps;
export type WizardStep = 1 | 2 | 3 | 4 | 5;

/** The dialog's own state; the page's container owns it. */
export type Wizard = {
  mode: "add" | "renew";
  step: WizardStep;
  peer?: string;
  user: string;
  days: GrantDays;
  grant?: Grant;
  check?: Check;
  /** A request of the dialog is on its way. */
  busy?: "connect" | "grant" | "check" | "save";
  /** The person said the fingerprints differ. */
  mismatch?: boolean;
  error?: string;
};

export type OwnMachineActions = {
  connect: () => void;
  disconnect: () => void;
  addMachine: () => void;
  renew: (machine: string) => void;
  recheck: (machine: string) => void;
  remove: (machine: string) => void;
  copy: (text: string) => Promise<boolean>;
};

export type WizardActions = {
  connect: () => void;
  close: () => void;
  setStep: (step: WizardStep) => void;
  choose: (patch: Partial<Pick<Wizard, "peer" | "user" | "days">>) => void;
  check: () => void;
  save: () => void;
  mismatch: () => void;
  restart: () => void;
};

// Toistaiseksi first and preselected (Jari 30.10.2026): the person revokes
// the line on the machine at any time, and a forced renewal would lose the
// machine unexpectedly.
const dayOptions = () => [
  { id: "0", label: txt.forever },
  { id: "7", label: txt.days(7) },
  { id: "30", label: txt.days(30) },
  { id: "90", label: txt.days(90) },
];

const machineTone: Record<MachineState, Tone> = {
  active: "success",
  asleep: "neutral",
  gone: "warning",
  expired: "danger",
  revoked: "danger",
  changed: "danger",
};

function CopyBox({
  text,
  testId,
  onCopy,
}: {
  text: string;
  testId?: string;
  onCopy: (text: string) => Promise<boolean>;
}) {
  const [done, setDone] = useState<boolean>();
  useEffect(() => {
    if (done === undefined) return;
    const t = window.setTimeout(() => setDone(undefined), 4000);
    return () => window.clearTimeout(t);
  }, [done]);
  return (
    <div className="om-copy" data-testid={testId}>
      <code>{text}</code>
      <ControlButton
        data-testid={testId ? `${testId}-copy` : undefined}
        size="row"
        variant="secondary"
        onPress={() => void onCopy(text).then(setDone)}
      >
        <Icon name={done ? "check" : "copy"} />
        {done ? txt.copied : done === false ? txt.copyFailed : txt.copy}
      </ControlButton>
    </div>
  );
}

/** What the person accepts: everything their user has there, the server's
 * root can use it too, and the sure cut is on the machine. */
export function Truths({
  machine,
  user,
  until,
  node,
  mac,
}: {
  machine?: string;
  user: string;
  /** Empty for a line without an end. */
  until: string;
  node: string;
  mac: boolean;
}) {
  return (
    <ul className="om-truths" data-testid="own-machine-truths">
      <li>
        <Icon name="user" />
        <span>
          {txt.truthEverything(user, machine, until ? fiDate(until) : "", mac)}
        </span>
      </li>
      <li>
        <Icon name="shield" />
        <span>{txt.truthRoot()}</span>
      </li>
      <li>
        <Icon name="slash" />
        <span>{txt.truthCut(node, until ? fiDate(until) : "")}</span>
      </li>
    </ul>
  );
}

/** The command that takes this account's line off a machine, in the shell
 * that machine has. Windows keeps an administrator's keys in another file,
 * so it gets both. */
function RemoveCommands({
  data,
  os,
  onCopy,
}: {
  data: OwnMachines;
  os?: string;
  onCopy: (text: string) => Promise<boolean>;
}) {
  if (osFamily(os) !== "windows")
    return <CopyBox text={data.remove_command} onCopy={onCopy} />;
  return (
    <>
      <p className="s-desc">{txt.removeAsUser}</p>
      <CopyBox text={data.windows_remove_command} onCopy={onCopy} />
      <p className="s-desc">{txt.removeAsAdmin}</p>
      <CopyBox text={data.windows_admin_remove_command} onCopy={onCopy} />
    </>
  );
}

function TailscaleCard({
  data,
  actions,
  confirming,
  setConfirming,
  busy,
}: {
  data: OwnMachines;
  actions: OwnMachineActions;
  confirming: string;
  setConfirming: (v: string) => void;
  busy: boolean;
}) {
  const ts = data.tailscale;
  const pill: Record<string, Tone> = {
    unavailable: "neutral",
    off: "neutral",
    stopped: "warning",
    login: "info",
    approval: "info",
    starting: "info",
    on: "success",
  };
  const label = txt.tsPill[ts.state as keyof typeof txt.tsPill] ?? "";
  const tone = pill[ts.state] ?? "neutral";
  return (
    <div
      className="s-card om-card"
      data-testid="own-machines-tailscale"
      data-state={ts.state}
      data-settings-row="own-machines-tailscale"
      tabIndex={-1}
    >
      <div className="s-row">
        <span className="s-lbl">
          <strong>Tailscale</strong>
          <span className="s-desc">
            {ts.node
              ? txt.nodeIn(ts.node.name, ts.node.tailnet ?? "")
              : txt.tsDesc}
          </span>
        </span>
        <span className="s-val">
          <Badge label={label} tone={tone} />
        </span>
      </div>
      {ts.state === "unavailable" && (
        <p className="om-blk om-note" data-testid="own-machines-unavailable">
          {txt.tsUnavailable}
        </p>
      )}
      {ts.state === "stopped" && (
        <div className="om-blk">
          <p>{txt.tsStopped}</p>
          <ControlButton
            data-testid="own-machines-start"
            size="row"
            variant="primary"
            isPending={busy}
            onPress={actions.connect}
          >
            {txt.start}
          </ControlButton>
        </div>
      )}
      {(ts.state === "login" ||
        ts.state === "approval" ||
        ts.state === "starting") && (
        <div className="om-blk om-btns">
          <span className="s-desc">{txt.tsPending}</span>
          <ControlButton
            data-testid="own-machines-continue"
            size="row"
            variant="primary"
            onPress={actions.addMachine}
          >
            {txt.continue}
          </ControlButton>
        </div>
      )}
      {ts.node && (
        <div className="om-blk">
          <dl className="om-facts" data-testid="own-machines-node">
            <dt>{txt.device}</dt>
            <dd className="om-mono">
              {ts.node.name} · {ts.node.address}
            </dd>
            <dt>{txt.network}</dt>
            <dd>
              {ts.node.tailnet}
              {ts.node.login ? (
                <span className="om-muted"> ({ts.node.login})</span>
              ) : null}
            </dd>
            <dt>{txt.incoming}</dt>
            <dd data-testid="own-machines-shields" data-up={ts.node.shields_up}>
              <Icon name="shield" />{" "}
              {ts.node.shields_up ? txt.shieldsUp : txt.shieldsDown}
            </dd>
          </dl>
          {confirming === "disconnect" ? (
            <div
              className="om-confirm"
              data-testid="own-machines-disconnect-confirm"
            >
              <p>{txt.disconnectQuestion(ts.node.name)}</p>
              <div className="om-btns om-end">
                <ControlButton
                  size="row"
                  variant="quiet"
                  onPress={() => setConfirming("")}
                >
                  {txt.cancel}
                </ControlButton>
                <ControlButton
                  data-testid="own-machines-disconnect-yes"
                  size="row"
                  variant="danger"
                  isPending={busy}
                  onPress={actions.disconnect}
                >
                  {txt.disconnect}
                </ControlButton>
              </div>
            </div>
          ) : (
            <div className="om-btns">
              <ControlButton
                data-testid="own-machines-disconnect"
                size="row"
                variant="quiet"
                onPress={() => setConfirming("disconnect")}
              >
                {txt.disconnectHabitat}
              </ControlButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MachineCard({
  data,
  machine,
  check,
  checking,
  actions,
  confirming,
  setConfirming,
  busy,
}: {
  data: OwnMachines;
  machine: Machine;
  check?: Check;
  checking: boolean;
  actions: OwnMachineActions;
  confirming: string;
  setConfirming: (v: string) => void;
  busy: boolean;
}) {
  const state = machineState(machine, check?.result);
  const label = txt.pill[state];
  const tone = machineTone[state];
  const os = osFamily(machine.os);
  const mac = os === "mac";
  const node = data.tailscale.node?.name ?? txt.habitatDevice;
  return (
    <div
      className="s-card om-card om-machine"
      data-testid="own-machine"
      data-machine={machine.name}
      data-state={state}
    >
      <div className="om-head">
        <span className="om-mark">
          <Icon name="laptop" />
        </span>
        <span className="om-name">
          <span className="om-mono om-strong">{machine.name}</span>
          <span className="s-desc">
            {machine.os ? `${osLabel(machine.os)} · ` : ""}
            {machine.address}
          </span>
        </span>
        {machine.connection_open && (
          <span data-testid="own-machine-open">
            <Badge label={txt.connectionOpen} tone="info" />
          </span>
        )}
        <span data-testid="own-machine-state">
          <Badge label={label} tone={tone} />
        </span>
      </div>
      <div className="om-blk">
        {state === "expired" && (
          <p className="om-note om-err" data-testid="own-machine-expired">
            {txt.expired(fiDate(machine.expires))}
          </p>
        )}
        {state === "revoked" && (
          <p className="om-note om-err" data-testid="own-machine-revoked">
            {txt.revoked(machine.expires ? fiDate(machine.expires) : "")}
          </p>
        )}
        {state === "changed" && (
          <p className="om-note om-err" data-testid="own-machine-changed">
            {txt.changed()}
          </p>
        )}
        {state === "asleep" && (
          <p className="om-note" data-testid="own-machine-asleep">
            {txt.asleep(machine.name)}
          </p>
        )}
        {state === "gone" && (
          <p className="om-note" data-testid="own-machine-gone">
            {txt.gone(machine.name)}
          </p>
        )}
        <dl className="om-facts">
          <dt>{machine.expires ? txt.accessEnds : txt.access}</dt>
          <dd data-testid="own-machine-expires">
            {machine.expires ? fiDate(machine.expires) : txt.untilRevoked}
          </dd>
          <dt>{txt.agentOnMachine}</dt>
          <dd>{txt.asUser(machine.user)}</dd>
          <dt>{txt.hostKey}</dt>
          <dd className="om-mono om-wrap">
            {machine.host_key || txt.missingValue}
          </dd>
          <dt>{txt.habitatKey}</dt>
          <dd>
            <span className="om-mono">~/.ssh/id_ed25519</span>{" "}
            <span className="om-muted om-wrap">
              {data.account_key?.fingerprint}
            </span>
          </dd>
          <dt>{txt.inTailscale}</dt>
          <dd>
            {machine.online
              ? txt.present
              : machine.in_tailnet
                ? txt.lastSeen(seenAgo(machine.last_seen))
                : txt.offline}
          </dd>
          <dt>{txt.forAgent}</dt>
          <dd className="om-mono">ssh {machine.name}</dd>
        </dl>
        <details className="om-more">
          <summary>{txt.whatItGives}</summary>
          <Truths
            machine={machine.name}
            user={machine.user}
            until={machine.expires}
            node={node}
            mac={mac}
          />
        </details>
        <details className="om-more" data-testid="own-machine-cut">
          <summary>{txt.howToCut}</summary>
          <p className="s-desc">{txt.removeLine}</p>
          <RemoveCommands data={data} os={machine.os} onCopy={actions.copy} />
          <p className="s-desc">{txt.orStop(os, node)}</p>
        </details>
      </div>
      {confirming === `remove:${machine.name}` ? (
        <div
          className="om-blk om-confirm"
          data-testid="own-machine-remove-confirm"
        >
          <p>
            {txt.removeQuestion(
              machine.name,
              machine.expires ? fiDate(machine.expires) : "",
            )}
          </p>
          <RemoveCommands data={data} os={machine.os} onCopy={actions.copy} />
          <div className="om-btns om-end">
            <ControlButton
              size="row"
              variant="quiet"
              onPress={() => setConfirming("")}
            >
              {txt.cancel}
            </ControlButton>
            <ControlButton
              data-testid="own-machine-remove-yes"
              size="row"
              variant="danger"
              isPending={busy}
              onPress={() => actions.remove(machine.name)}
            >
              {txt.removeMachine}
            </ControlButton>
          </div>
        </div>
      ) : (
        <div className="om-blk om-btns">
          <ControlButton
            data-testid="own-machine-check"
            size="row"
            variant="secondary"
            isPending={checking}
            isDisabled={data.tailscale.state !== "on"}
            onPress={() => actions.recheck(machine.name)}
          >
            <Icon name="refresh" />
            {txt.check}
          </ControlButton>
          <ControlButton
            data-testid="own-machine-renew"
            size="row"
            variant={
              state === "expired" || state === "revoked"
                ? "primary"
                : "secondary"
            }
            isDisabled={data.tailscale.state !== "on" || state === "changed"}
            onPress={() => actions.renew(machine.name)}
          >
            {state === "revoked" ? txt.reconnect : txt.renew}
          </ControlButton>
          <ControlButton
            data-testid="own-machine-remove"
            size="row"
            variant="quiet"
            onPress={() => setConfirming(`remove:${machine.name}`)}
          >
            {txt.remove}
          </ControlButton>
        </div>
      )}
    </div>
  );
}

/** The settings section: Tailscale, then the machines. */
export function OwnMachinesPage({
  data,
  checks,
  checking,
  removed,
  notice,
  busy,
  actions,
}: {
  data: OwnMachines;
  /** The last check this page made per machine. */
  checks: Readonly<Record<string, Check>>;
  checking?: string;
  /** The machine just removed, whose line is still on the machine. */
  removed?: { name: string; os?: string };
  notice?: string;
  busy?: boolean;
  actions: OwnMachineActions;
}) {
  const [confirming, setConfirming] = useState("");
  useEffect(() => {
    if (!busy) setConfirming("");
  }, [busy]);
  const ts = data.tailscale.state;
  return (
    <div className="s-stack om" data-testid="own-machines">
      <p className="s-intro">{txt.intro}</p>
      {notice && (
        <p
          className="om-notice"
          role="status"
          data-testid="own-machines-notice"
        >
          {notice}
        </p>
      )}
      <TailscaleCard
        data={data}
        actions={actions}
        confirming={confirming}
        setConfirming={setConfirming}
        busy={Boolean(busy)}
      />
      <div className="s-sub om-sub">{txt.machines}</div>
      <div data-settings-row="own-machines" tabIndex={-1} className="s-stack">
        {data.machines.map((m) => (
          <MachineCard
            key={m.name}
            data={data}
            machine={m}
            check={checks[m.name]}
            checking={checking === m.name}
            actions={actions}
            confirming={confirming}
            setConfirming={setConfirming}
            busy={Boolean(busy)}
          />
        ))}
        {removed && (
          <div className="om-note om-removed" data-testid="own-machine-removed">
            <p>{txt.removed(removed.name)}</p>
            <RemoveCommands data={data} os={removed.os} onCopy={actions.copy} />
          </div>
        )}
        {data.machines.length > 0 && !data.ssh_include && (
          <div className="om-note om-err" data-testid="own-machines-include">
            <p>{txt.includeFailed(<code>~/.ssh/config</code>)}</p>
            <CopyBox text={sshInclude} onCopy={actions.copy} />
          </div>
        )}
        <div className="s-card om-card">
          <div className="om-blk om-btns">
            {data.machines.length === 0 && (
              <span className="om-muted">{txt.none}</span>
            )}
            <ControlButton
              data-testid="own-machines-add"
              size="row"
              variant={data.machines.length === 0 ? "primary" : "secondary"}
              isDisabled={ts === "unavailable"}
              onPress={actions.addMachine}
            >
              <Icon name="plus" />
              {data.machines.length === 0 ? txt.add : txt.addAnother}
            </ControlButton>
            {data.machines.length === 0 && (
              <span className="s-desc">{txt.addTime}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PeerChoices({
  peers,
  saved,
  value,
  onChange,
}: {
  peers: Peer[];
  saved: ReadonlySet<string>;
  value?: string;
  onChange: (name: string) => void;
}) {
  return (
    <div>
      <fieldset className="om-choices" data-testid="own-machines-peers">
        <legend className="om-legend">{txt.peerLegend}</legend>
        {peers.map((p) => {
          const disabled = p.ssh !== "possible" || saved.has(p.name);
          const tag = saved.has(p.name)
            ? txt.peerSaved
            : p.ssh === "no"
              ? txt.peerNoSsh
              : p.online
                ? txt.present
                : txt.lastSeen(seenAgo(p.last_seen));
          return (
            <label
              key={p.name}
              className="om-choice"
              data-disabled={disabled || undefined}
            >
              <input
                type="radio"
                name="own-machine-peer"
                value={p.name}
                checked={value === p.name}
                disabled={disabled}
                data-testid={`own-machines-peer-${p.name}`}
                onChange={() => onChange(p.name)}
              />
              <span className="om-choice-t">
                <span className="om-mono">{p.name}</span>
                <small>{osLabel(p.os)}</small>
              </span>
              <span className={`om-tag ${p.online ? "om-on" : ""}`}>{tag}</span>
            </label>
          );
        })}
      </fieldset>
      <p className="s-desc">{txt.peersNote}</p>
    </div>
  );
}

function CheckNote({
  check,
  user,
  os,
  dated,
}: {
  check?: Check;
  user: string;
  os: ReturnType<typeof osFamily>;
  /** The line has expiry-time=, which needs OpenSSH 8.2. */
  dated: boolean;
}) {
  if (!check) return null;
  const notes: Record<string, ReactNode> = {
    ok: txt.checkOk(),
    key_rejected: txt.checkRejected(user, os, dated),
    offline: txt.checkOffline(),
    no_ssh: txt.checkNoSsh(os),
    host_key_changed: txt.checkChanged(),
    failed: txt.checkFailed(),
  };
  return (
    <p
      className={`om-note ${check.result === "ok" ? "om-ok" : "om-err"}`}
      data-testid="own-machines-check-result"
      data-result={check.result}
      role="status"
    >
      {notes[check.result]}
    </p>
  );
}

/** The five-step dialog: Tailscale, Kone, Etäkirjautuminen, Avainrivi,
 * Vahvistus. The next step opens only when this one is done. */
export function AddMachineDialog({
  data,
  wizard,
  actions,
  copy,
  phone,
}: {
  data: OwnMachines;
  wizard: Wizard;
  actions: WizardActions;
  copy: (text: string) => Promise<boolean>;
  phone?: boolean;
}) {
  const ts = data.tailscale;
  const peer = data.peers.find((p) => p.name === wizard.peer);
  const saved = new Set(data.machines.map((m) => m.name));
  const renewing = wizard.mode === "renew";
  const machine = renewing
    ? data.machines.find((m) => m.name === wizard.peer)
    : undefined;
  const os = osFamily(peer?.os ?? machine?.os);
  const mac = os === "mac";
  // Windows reads an administrator's keys from another file; most people's
  // own account on their own PC is one.
  const [admin, setAdmin] = useState(true);
  const node = ts.node?.name ?? "habitat";
  const userOk = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$/.test(wizard.user);
  const step = wizard.step;
  let body: ReactNode;
  let next: ReactNode = null;
  if (step === 1) {
    body =
      ts.state === "on" && ts.node ? (
        <p className="om-note om-ok" data-testid="own-machines-wizard-joined">
          {txt.joined(
            <span className="om-mono">{ts.node.name}</span>,
            ts.node.address,
          )}
        </p>
      ) : ts.state === "login" ? (
        <div className="om-login" data-testid="own-machines-login">
          {!phone && ts.auth_url && (
            <div className="om-qr">
              <QrCode value={ts.auth_url} />
            </div>
          )}
          <div>
            <p>{txt.signInTailscale(Boolean(phone))}</p>
            {ts.auth_url ? (
              <>
                <div className="om-btns">
                  <a
                    className="om-link-button"
                    data-testid="own-machines-login-open"
                    href={ts.auth_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="external" />
                    {txt.openLogin}
                  </a>
                </div>
                <p className="s-desc">{txt.waitingApproval}</p>
              </>
            ) : (
              <div className="om-btns">
                <ControlButton
                  data-testid="own-machines-login-again"
                  size="row"
                  variant="secondary"
                  isPending={wizard.busy === "connect"}
                  onPress={actions.connect}
                >
                  {txt.fetchLogin}
                </ControlButton>
                <span className="s-desc">{txt.loginSoon}</span>
              </div>
            )}
          </div>
        </div>
      ) : ts.state === "approval" ? (
        <p className="om-note" data-testid="own-machines-approval">
          {txt.approval}
        </p>
      ) : ts.state === "starting" ? (
        <p className="s-desc">{txt.starting}</p>
      ) : (
        <>
          <p>{txt.joins()}</p>
          <div className="om-btns">
            <ControlButton
              data-testid="own-machines-connect"
              size="row"
              variant="primary"
              isPending={wizard.busy === "connect"}
              onPress={actions.connect}
            >
              {txt.connectTailscale}
            </ControlButton>
            <span className="s-desc">{txt.noAccount}</span>
          </div>
        </>
      );
    next = ts.state === "on" ? 2 : null;
  } else if (step === 2) {
    body = (
      <>
        <p>{txt.installTailscale(ts.node?.login)}</p>
        <PeerChoices
          peers={data.peers}
          saved={saved}
          value={wizard.peer}
          onChange={(name) => actions.choose({ peer: name })}
        />
        <TextField
          data-testid="own-machines-user"
          label={txt.userField}
          value={wizard.user}
          onChange={(user) => actions.choose({ user: user.trim() })}
          hint={txt.userHint}
          error={wizard.user && !userOk ? txt.userInvalid : undefined}
          mono
          name="remote-user"
          autoComplete="username"
        />
        <div className="om-row">
          <span>{txt.duration}</span>
          <Segmented<string>
            data-testid="own-machines-days"
            label={txt.duration}
            options={dayOptions()}
            value={String(wizard.days)}
            onChange={(v) => actions.choose({ days: Number(v) as GrantDays })}
          />
        </div>
        <p className="s-desc" data-testid="own-machines-days-note">
          {wizard.days ? txt.dated : txt.undated}
        </p>
      </>
    );
    next = peer && userOk ? 3 : null;
  } else if (step === 3) {
    body = mac ? (
      <ol className="om-steps">
        {txt.macSteps(wizard.user).map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the fixed steps of one instruction.
          <li key={i}>{item}</li>
        ))}
      </ol>
    ) : os === "windows" ? (
      <>
        <p>{txt.windowsInstall}</p>
        <CopyBox text={windowsSSHServerCommand} onCopy={copy} />
        <p className="s-desc">
          {txt.windowsSettings}
          {wizard.days
            ? txt.windowsVersion(<span className="om-mono">ssh -V</span>)
            : null}
        </p>
      </>
    ) : (
      <>
        <p>{txt.linuxInstall}</p>
        <CopyBox
          text="sudo apt install openssh-server && sudo systemctl enable --now ssh"
          onCopy={copy}
        />
        <p className="s-desc">
          {txt.fedora}{" "}
          <span className="om-mono">sudo dnf install openssh-server</span>.
        </p>
      </>
    );
    next = 4;
  } else if (step === 4) {
    const g = wizard.grant;
    const days = (
      <div className="om-row">
        <span>{txt.duration}</span>
        <Segmented<string>
          data-testid="own-machines-days"
          label={txt.duration}
          options={dayOptions()}
          value={String(wizard.days)}
          isDisabled={Boolean(wizard.busy)}
          onChange={(v) => actions.choose({ days: Number(v) as GrantDays })}
        />
      </div>
    );
    body = !g ? (
      <>
        {renewing && days}
        <p className="s-desc">
          {wizard.busy === "grant" ? txt.makingLine : ""}
        </p>
      </>
    ) : (
      <>
        {renewing && days}
        {g.shell === "powershell" && g.admin_command ? (
          <>
            <div className="om-row">
              <span>{txt.userOnMachine(g.user)}</span>
              <Segmented<string>
                data-testid="own-machines-windows-admin"
                label={txt.userOnMachine(g.user)}
                options={[
                  { id: "admin", label: txt.administrator },
                  { id: "user", label: txt.ordinaryUser },
                ]}
                value={admin ? "admin" : "user"}
                onChange={(v) => setAdmin(v === "admin")}
              />
            </div>
            <p>
              {admin
                ? txt.windowsAdmin(
                    <span className="om-mono">
                      C:\ProgramData\ssh\administrators_authorized_keys
                    </span>,
                  )
                : txt.windowsUser(
                    g.user,
                    <span className="om-mono">.ssh\authorized_keys</span>,
                  )}
            </p>
            <CopyBox
              text={admin ? g.admin_command : g.command}
              testId="own-machines-command"
              onCopy={copy}
            />
          </>
        ) : (
          <>
            <p>
              {txt.unixCommand(
                mac,
                g.user,
                <span className="om-mono">~/.ssh/authorized_keys</span>,
              )}
            </p>
            <CopyBox
              text={g.command}
              testId="own-machines-command"
              onCopy={copy}
            />
          </>
        )}
        <details className="om-more">
          <summary>{txt.lineParts}</summary>
          <CopyBox text={g.line} testId="own-machines-line" onCopy={copy} />
          <dl className="om-facts">
            <dt>restrict</dt>
            <dd>{txt.restrict}</dd>
            <dt>from</dt>
            <dd>{txt.from(ts.node?.address ?? "")}</dd>
            {g.expires && (
              <>
                <dt>expiry-time</dt>
                <dd>{txt.expiry(fiDate(g.expires))}</dd>
              </>
            )}
            <dt>ssh-ed25519 …</dt>
            <dd>
              {txt.keyPart(
                <span className="om-mono">~/.ssh/id_ed25519</span>,
                <span className="om-mono om-wrap">{g.key_fingerprint}</span>,
              )}
            </dd>
          </dl>
        </details>
        <div className="om-btns">
          <ControlButton
            data-testid="own-machines-check"
            size="row"
            variant={wizard.check?.result === "ok" ? "secondary" : "primary"}
            isPending={wizard.busy === "check"}
            onPress={actions.check}
          >
            <Icon name="refresh" />
            {txt.check}
          </ControlButton>
        </div>
        <CheckNote
          check={wizard.check}
          user={g.user}
          os={os}
          dated={Boolean(g.expires)}
        />
        {renewing && wizard.check?.result === "ok" && (
          <Truths
            machine={g.machine}
            user={g.user}
            until={g.expires}
            node={node}
            mac={mac}
          />
        )}
      </>
    );
    next =
      !renewing && wizard.check?.result === "ok" && wizard.check.host_key
        ? 5
        : null;
  } else {
    const g = wizard.grant;
    body = wizard.mismatch ? (
      <>
        <p className="om-note om-err" data-testid="own-machines-mismatch">
          {txt.mismatch()}
        </p>
        <div className="om-btns">
          <ControlButton
            size="row"
            variant="secondary"
            onPress={actions.restart}
          >
            {txt.restart}
          </ControlButton>
        </div>
      </>
    ) : (
      <>
        <p>{txt.verify(os === "windows")}</p>
        <CopyBox
          text={os === "windows" ? windowsHostKeyCommand : hostKeyCommand}
          onCopy={copy}
        />
        <p>{txt.sameFingerprint}</p>
        <p className="om-fp" data-testid="own-machines-host-key">
          {wizard.check?.host_key}
        </p>
        {g && (
          <Truths
            machine={g.machine}
            user={g.user}
            until={g.expires}
            node={node}
            mac={mac}
          />
        )}
      </>
    );
  }
  const finish =
    (renewing && step === 4 && wizard.check?.result === "ok") ||
    (step === 5 && !wizard.mismatch);
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen
      isDismissable={!wizard.busy}
      onOpenChange={(open) => {
        if (!open) actions.close();
      }}
    >
      <Modal className="ah-modal om-modal">
        <Dialog
          className="ah-dialog om-wizard"
          aria-label={renewing ? txt.renew : txt.add}
          data-testid="own-machines-wizard"
          data-step={step}
        >
          <Heading slot="title">
            {renewing ? txt.renewTitle(wizard.peer ?? "") : txt.add}
          </Heading>
          <ol className="om-wz-steps" aria-label={txt.stepsLabel}>
            {wizardSteps().map((label, i) => (
              <li
                key={label}
                aria-current={i + 1 === step ? "step" : undefined}
                data-done={i + 1 < step || undefined}
              >
                <b>{i + 1 < step ? <Icon name="check" /> : i + 1}</b>
                <span>{label}</span>
              </li>
            ))}
          </ol>
          <div className="om-wz-body">{body}</div>
          {wizard.error && (
            <p
              className="om-note om-err"
              role="alert"
              data-testid="own-machines-wizard-error"
            >
              {wizard.error}
            </p>
          )}
          <div className="ah-dialog-actions">
            {step > 1 && !(renewing && step === 4) && !wizard.mismatch && (
              <ControlButton
                size="page"
                variant="quiet"
                isDisabled={Boolean(wizard.busy)}
                onPress={() => actions.setStep((step - 1) as WizardStep)}
              >
                {txt.back}
              </ControlButton>
            )}
            <ControlButton
              data-testid="own-machines-wizard-close"
              size="page"
              variant="secondary"
              onPress={actions.close}
            >
              {finish ? txt.cancel : txt.close}
            </ControlButton>
            {step === 5 && !wizard.mismatch && (
              <ControlButton
                data-testid="own-machines-mismatch-button"
                size="page"
                variant="secondary"
                onPress={actions.mismatch}
              >
                {txt.noMatch}
              </ControlButton>
            )}
            {finish ? (
              <ControlButton
                data-testid="own-machines-save"
                size="page"
                variant="primary"
                isPending={wizard.busy === "save"}
                onPress={actions.save}
              >
                {renewing
                  ? wizard.grant?.expires
                    ? txt.saveDate
                    : txt.save
                  : txt.matches}
              </ControlButton>
            ) : step < 5 && !wizard.mismatch ? (
              <ControlButton
                data-testid="own-machines-next"
                size="page"
                variant="primary"
                isDisabled={next === null || Boolean(wizard.busy)}
                onPress={() =>
                  next !== null && actions.setStep(next as WizardStep)
                }
              >
                {txt.next}
              </ControlButton>
            ) : null}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
