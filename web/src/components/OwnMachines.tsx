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

// Asetukset › Omat koneet, prototype direction 1 Ohjattu (Jari 29.10.2026):
// the page summarises; a five-step dialog does the setup, and renewal opens
// it at the key line. Machines can be added afterwards and are named as
// Tailscale names them. There is no pause: nothing on this side would stop
// an agent running as the same user. The three plain sentences are said
// before anything is saved.

export const wizardSteps = [
  "Tailscale",
  "Kone",
  "Etäkirjautuminen",
  "Avainrivi",
  "Vahvistus",
] as const;
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
const dayOptions = [
  { id: "0", label: "Toistaiseksi" },
  { id: "7", label: "7 pv" },
  { id: "30", label: "30 pv" },
  { id: "90", label: "90 pv" },
];

const machinePill: Record<MachineState, [string, Tone]> = {
  active: ["Yhdistetty", "success"],
  asleep: ["Ei vastaa", "neutral"],
  gone: ["Ei Tailscalessa", "warning"],
  expired: ["Vanhentunut", "danger"],
  revoked: ["Kone hylkää avaimen", "danger"],
  changed: ["Tunniste muuttui", "danger"],
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
        {done ? "Kopioitu" : done === false ? "Ei onnistunut" : "Kopioi"}
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
          <b>Agentti saa koneella kaiken, mitä käyttäjäsi {user} saa</b>, eikä
          se kysy lupaa jokaiseen komentoon. Pääsy koskee vain{" "}
          {machine ? `konetta ${machine}` : "valitsemaasi konetta"} ja{" "}
          {until ? `päättyy ${fiDate(until)}` : "on voimassa, kunnes perut sen"}
          .
          {mac
            ? " Täysi levyn käyttöoikeus pysyy pois, joten macOS suojaa yhä Työpöytää, Dokumentteja ja Mailia."
            : ""}
        </span>
      </li>
      <li>
        <Icon name="shield" />
        <span>
          <b>Palvelimen ylläpitäjä pääsee samaa reittiä koneellesi.</b> Avain on
          tilisi kotihakemistossa, ja palvelimen ylläpitäjä (root) voi lukea
          sen. Habitat ei voi estää tätä.
        </span>
      </li>
      <li>
        <Icon name="slash" />
        <span>
          <b>Varma katkaisu tehdään koneellasi:</b> poista rivi, sammuta
          etäkirjautuminen tai poista {node} Tailscale-verkostasi.
          {until
            ? ` Rivi lakkaa myös itsestään toimimasta ${fiDate(until)}.`
            : ""}{" "}
          Poisto Habitatista ei yksin riitä, koska agentti toimii samana
          käyttäjänä ja on voinut kopioida avaimen.
        </span>
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
      <p className="s-desc">
        PowerShellissä, jos käyttäjäsi on tavallinen käyttäjä:
      </p>
      <CopyBox text={data.windows_remove_command} onCopy={onCopy} />
      <p className="s-desc">
        Jos käyttäjäsi on järjestelmänvalvoja, PowerShellissä, joka on avattu
        järjestelmänvalvojana:
      </p>
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
  const pill: Record<string, [string, Tone]> = {
    unavailable: ["Ei saatavilla", "neutral"],
    off: ["Ei yhdistetty", "neutral"],
    stopped: ["Pysähtynyt", "warning"],
    login: ["Odottaa kirjautumista", "info"],
    approval: ["Odottaa hyväksyntää", "info"],
    starting: ["Käynnistyy", "info"],
    on: ["Yhdistetty", "success"],
  };
  const [label, tone] = pill[ts.state] ?? ["", "neutral"];
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
              ? `${ts.node.name} verkossa ${ts.node.tailnet ?? ""}`
              : "Habitatin yhteys omaan verkkoosi"}
          </span>
        </span>
        <span className="s-val">
          <Badge label={label} tone={tone} />
        </span>
      </div>
      {ts.state === "unavailable" && (
        <p className="om-blk om-note" data-testid="own-machines-unavailable">
          Tämä palvelin ei vielä tarjoa Tailscalea. Palvelimen ylläpitäjä ottaa
          sen käyttöön; sinun ei tarvitse asentaa mitään.
        </p>
      )}
      {ts.state === "stopped" && (
        <div className="om-blk">
          <p>
            Habitatin Tailscale-laite on tililläsi, mutta se ei ole käynnissä.
          </p>
          <ControlButton
            data-testid="own-machines-start"
            size="row"
            variant="primary"
            isPending={busy}
            onPress={actions.connect}
          >
            Käynnistä
          </ControlButton>
        </div>
      )}
      {(ts.state === "login" ||
        ts.state === "approval" ||
        ts.state === "starting") && (
        <div className="om-blk om-btns">
          <span className="s-desc">Kirjautuminen Tailscaleen on kesken.</span>
          <ControlButton
            data-testid="own-machines-continue"
            size="row"
            variant="primary"
            onPress={actions.addMachine}
          >
            Jatka
          </ControlButton>
        </div>
      )}
      {ts.node && (
        <div className="om-blk">
          <dl className="om-facts" data-testid="own-machines-node">
            <dt>Laite</dt>
            <dd className="om-mono">
              {ts.node.name} · {ts.node.address}
            </dd>
            <dt>Verkko</dt>
            <dd>
              {ts.node.tailnet}
              {ts.node.login ? (
                <span className="om-muted"> ({ts.node.login})</span>
              ) : null}
            </dd>
            <dt>Saapuvat yhteydet</dt>
            <dd data-testid="own-machines-shields" data-up={ts.node.shields_up}>
              <Icon name="shield" />{" "}
              {ts.node.shields_up
                ? "Estetty: verkkosi laitteet eivät pääse tähän palvelimeen"
                : "Sallittu! Joku on muuttanut asetusta Habitatin ohi. Irrota Habitat verkostasi ja yhdistä uudelleen."}
            </dd>
          </dl>
          {confirming === "disconnect" ? (
            <div
              className="om-confirm"
              data-testid="own-machines-disconnect-confirm"
            >
              <p>
                <b>Irrotetaanko Habitat verkostasi?</b> Habitat pysäyttää
                laitteensa ja poistaa sen avaimen tältä tililtä sekä kaikki
                koneesi täältä. Laite {ts.node.name} jää Tailscalen
                laitelistaan, kunnes poistat sen sieltä. Koneidesi rivit jäävät
                koneille, kunnes poistat ne tai ne vanhenevat.
              </p>
              <div className="om-btns om-end">
                <ControlButton
                  size="row"
                  variant="quiet"
                  onPress={() => setConfirming("")}
                >
                  Peru
                </ControlButton>
                <ControlButton
                  data-testid="own-machines-disconnect-yes"
                  size="row"
                  variant="danger"
                  isPending={busy}
                  onPress={actions.disconnect}
                >
                  Irrota
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
                Irrota Habitat verkostasi
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
  const [label, tone] = machinePill[state];
  const os = osFamily(machine.os);
  const mac = os === "mac";
  const node = data.tailscale.node?.name ?? "Habitatin laite";
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
            <Badge label="Yhteys auki" tone="info" />
          </span>
        )}
        <span data-testid="own-machine-state">
          <Badge label={label} tone={tone} />
        </span>
      </div>
      <div className="om-blk">
        {state === "expired" && (
          <p className="om-note om-err" data-testid="own-machine-expired">
            <b>Pääsy päättyi {fiDate(machine.expires)}.</b> Kone ei enää hyväksy
            avainta. Uusi pääsy antaa uuden rivin, joka korvaa vanhan.
          </p>
        )}
        {state === "revoked" && (
          <p className="om-note om-err" data-testid="own-machine-revoked">
            <b>Kone hylkäsi avaimen</b>, vaikka pääsy olisi ollut voimassa
            {machine.expires ? ` ${fiDate(machine.expires)} asti` : ""}. Rivi on
            luultavasti poistettu koneelta tai etäkirjautuminen on pois päältä.
            Jos teit sen itse, poista kone myös täältä.
          </p>
        )}
        {state === "changed" && (
          <p className="om-note om-err" data-testid="own-machine-changed">
            <b>Koneen tunniste on eri kuin tallennettu.</b> Habitat ei ota
            yhteyttä siihen. Jos asensit koneen uudelleen, poista se täältä ja
            lisää uudelleen. Muuten osoitteessa vastaa jokin muu kuin koneesi.
          </p>
        )}
        {state === "asleep" && (
          <p className="om-note" data-testid="own-machine-asleep">
            <b>{machine.name} ei vastaa.</b> Kone on luultavasti unessa tai
            Tailscale on suljettu. Agentti yrittää uudelleen, kun pyydät.
          </p>
        )}
        {state === "gone" && (
          <p className="om-note" data-testid="own-machine-gone">
            <b>{machine.name} ei ole enää Tailscale-verkossasi.</b> Agentti ei
            pääse siihen, ennen kuin se on taas verkossa.
          </p>
        )}
        <dl className="om-facts">
          <dt>{machine.expires ? "Pääsy päättyy" : "Pääsy"}</dt>
          <dd data-testid="own-machine-expires">
            {machine.expires
              ? fiDate(machine.expires)
              : "voimassa, kunnes perut"}
          </dd>
          <dt>Agentti koneella</dt>
          <dd>
            käyttäjänä {machine.user}, kaikki mitä {machine.user} saa
          </dd>
          <dt>Koneen tunniste</dt>
          <dd className="om-mono om-wrap">{machine.host_key || "puuttuu"}</dd>
          <dt>Habitatin avain</dt>
          <dd>
            <span className="om-mono">~/.ssh/id_ed25519</span>{" "}
            <span className="om-muted om-wrap">
              {data.account_key?.fingerprint}
            </span>
          </dd>
          <dt>Tailscalessa</dt>
          <dd>
            {machine.online
              ? "paikalla"
              : machine.in_tailnet
                ? `viimeksi paikalla ${seenAgo(machine.last_seen)}`
                : "ei verkossa"}
          </dd>
          <dt>Agentille</dt>
          <dd className="om-mono">ssh {machine.name}</dd>
        </dl>
        <details className="om-more">
          <summary>Mitä yhteys antaa</summary>
          <Truths
            machine={machine.name}
            user={machine.user}
            until={machine.expires}
            node={node}
            mac={mac}
          />
        </details>
        <details className="om-more" data-testid="own-machine-cut">
          <summary>Näin katkaiset pääsyn koneelta</summary>
          <p className="s-desc">Poista Habitatin rivi koneen päätteessä:</p>
          <RemoveCommands data={data} os={machine.os} onCopy={actions.copy} />
          <p className="s-desc">
            Tai{" "}
            {mac
              ? "sammuta Etäkirjautuminen (Järjestelmäasetukset › Yleiset › Jakaminen)"
              : os === "windows"
                ? "pysäytä OpenSSH-palvelin (järjestelmänvalvojan PowerShellissä: Stop-Service sshd; Set-Service sshd -StartupType Disabled)"
                : "pysäytä SSH-palvelin (sudo systemctl disable --now ssh)"}
            , tai poista laite {node} Tailscalen hallintasivulta.
          </p>
        </details>
      </div>
      {confirming === `remove:${machine.name}` ? (
        <div
          className="om-blk om-confirm"
          data-testid="own-machine-remove-confirm"
        >
          <p>
            <b>Poistetaanko {machine.name}?</b> Habitat poistaa koneen
            yhteysasetuksen ja tunnisteen tililtäsi. Koneesi hyväksyy riviä yhä
            {machine.expires
              ? ` ${fiDate(machine.expires)} asti`
              : ", kunnes poistat sen"}
            , jos joku on ehtinyt kopioida avaimen, joten poista rivi myös
            koneelta:
          </p>
          <RemoveCommands data={data} os={machine.os} onCopy={actions.copy} />
          <div className="om-btns om-end">
            <ControlButton
              size="row"
              variant="quiet"
              onPress={() => setConfirming("")}
            >
              Peru
            </ControlButton>
            <ControlButton
              data-testid="own-machine-remove-yes"
              size="row"
              variant="danger"
              isPending={busy}
              onPress={() => actions.remove(machine.name)}
            >
              Poista kone
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
            Tarkista yhteys
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
            {state === "revoked" ? "Yhdistä uudelleen" : "Uusi pääsy"}
          </ControlButton>
          <ControlButton
            data-testid="own-machine-remove"
            size="row"
            variant="quiet"
            onPress={() => setConfirming(`remove:${machine.name}`)}
          >
            Poista
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
      <p className="s-intro">
        Agentti voi käyttää omaa tietokonettasi SSH:lla oman Tailscale-verkkosi
        kautta, esimerkiksi tarkistaakseen asetuksia tai avatakseen tiedoston.
        Koneellesi ei asenneta mitään Habitatin omaa.
      </p>
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
      <div className="s-sub om-sub">Koneet</div>
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
            <p>
              <b>{removed.name} poistettu Habitatista.</b> Poista vielä rivi
              koneelta, niin pääsy loppuu varmasti:
            </p>
            <RemoveCommands data={data} os={removed.os} onCopy={actions.copy} />
          </div>
        )}
        {data.machines.length > 0 && !data.ssh_include && (
          <div className="om-note om-err" data-testid="own-machines-include">
            <p>
              Tiedostoa <code>~/.ssh/config</code> ei voitu muuttaa (se on
              luultavasti linkki). Lisää sen alkuun tämä rivi, jotta agentti
              löytää koneet nimellä:
            </p>
            <CopyBox text={sshInclude} onCopy={actions.copy} />
          </div>
        )}
        <div className="s-card om-card">
          <div className="om-blk om-btns">
            {data.machines.length === 0 && (
              <span className="om-muted">Ei yhdistettyjä koneita.</span>
            )}
            <ControlButton
              data-testid="own-machines-add"
              size="row"
              variant={data.machines.length === 0 ? "primary" : "secondary"}
              isDisabled={ts === "unavailable"}
              onPress={actions.addMachine}
            >
              <Icon name="plus" />
              {data.machines.length === 0 ? "Lisää kone" : "Lisää toinen kone"}
            </ControlButton>
            {data.machines.length === 0 && (
              <span className="s-desc">
                Noin viisi minuuttia. Tarvitset koneen viereesi.
              </span>
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
        <legend className="om-legend">Kone Tailscale-verkossasi</legend>
        {peers.map((p) => {
          const disabled = p.ssh !== "possible" || saved.has(p.name);
          const tag = saved.has(p.name)
            ? "lisätty jo"
            : p.ssh === "no"
              ? "ei SSH-palvelinta"
              : p.online
                ? "paikalla"
                : `viimeksi paikalla ${seenAgo(p.last_seen)}`;
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
      <p className="s-desc">
        Lista on Tailscale-verkostasi. Jos konettasi ei näy, se ei ole vielä
        kirjautunut samaan verkkoon.
      </p>
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
  const mac = os === "mac";
  const notes: Record<string, ReactNode> = {
    ok: (
      <>
        <b>Kone hyväksyi avaimen.</b> Vielä yksi tarkistus: koneen tunniste.
      </>
    ),
    key_rejected: (
      <>
        <b>Kone ei hyväksy avainta vielä.</b> Kone vastaa, mutta hylkää avaimen.
        Aja komento koneella käyttäjänä {user} ja tarkista uudelleen.
        {mac
          ? ` Jos ajoit sen, tarkista että etäkirjautuminen sallii käyttäjän ${user}.`
          : os === "windows"
            ? ` Jos käyttäjäsi on järjestelmänvalvoja, aja järjestelmänvalvojan komento.${dated ? " Jos ajoit sen, tarkista OpenSSH:n versio (ssh -V): rivi vaatii version 8.2 tai uudemman." : ""}`
            : ""}
      </>
    ),
    offline: (
      <>
        <b>Tailscale ei näe konetta.</b> Kone on luultavasti unessa tai sen
        Tailscale on suljettu.
      </>
    ),
    no_ssh: (
      <>
        <b>Kone on verkossa, mutta SSH ei vastaa.</b>{" "}
        {mac
          ? "Laita etäkirjautuminen päälle (edellinen vaihe)."
          : os === "windows"
            ? "Käynnistä OpenSSH-palvelin (edellinen vaihe). Jos se on käynnissä, Windowsin palomuuri voi estää yhteyden."
            : "Käynnistä SSH-palvelin (edellinen vaihe)."}
      </>
    ),
    host_key_changed: (
      <>
        <b>Koneen tunniste on eri kuin tallennettu.</b> Habitat ei jatka.
      </>
    ),
    failed: (
      <>
        <b>Yhteys ei onnistunut.</b> Tarkista, että kone on hereillä, ja yritä
        uudelleen.
      </>
    ),
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
          <b>Habitat on verkossasi</b> laitteena{" "}
          <span className="om-mono">{ts.node.name}</span> ({ts.node.address}).
        </p>
      ) : ts.state === "login" ? (
        <div className="om-login" data-testid="own-machines-login">
          {!phone && ts.auth_url && (
            <div className="om-qr">
              <QrCode value={ts.auth_url} />
            </div>
          )}
          <div>
            <p>
              Kirjaudu omalla Tailscale-tunnuksellasi ja hyväksy laite.
              {phone ? "" : " Voit myös skannata koodin puhelimella."}
            </p>
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
                    Avaa kirjautumissivu
                  </a>
                </div>
                <p className="s-desc">
                  Odotetaan, että hyväksyt laitteen Tailscalessa…
                </p>
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
                  Hae kirjautumislinkki
                </ControlButton>
                <span className="s-desc">
                  Linkki tulee Tailscalelta hetkessä.
                </span>
              </div>
            )}
          </div>
        </div>
      ) : ts.state === "approval" ? (
        <p className="om-note" data-testid="own-machines-approval">
          Tailscale-verkkosi ylläpitäjän pitää vielä hyväksyä laite. Hyväksy se
          Tailscalen hallintasivulla, niin tämä jatkuu.
        </p>
      ) : ts.state === "starting" ? (
        <p className="s-desc">Habitatin laite käynnistyy…</p>
      ) : (
        <>
          <p>
            Habitat liittyy <b>omaan</b> Tailscale-verkkoosi yhtenä laitteena,
            ja agentti ottaa sen kautta yhteyden koneeseesi. Habitatilla ei ole
            omaa verkkoa eikä pääsyä verkkosi hallintaan.
          </p>
          <div className="om-btns">
            <ControlButton
              data-testid="own-machines-connect"
              size="row"
              variant="primary"
              isPending={wizard.busy === "connect"}
              onPress={actions.connect}
            >
              Yhdistä Tailscaleen
            </ControlButton>
            <span className="s-desc">
              Ei vielä Tailscale-tiliä? Henkilökohtainen tili on maksuton:
              tailscale.com
            </span>
          </div>
        </>
      );
    next = ts.state === "on" ? 2 : null;
  } else if (step === 2) {
    body = (
      <>
        <p>
          Asenna koneelle Tailscale ja kirjaudu samalla tunnuksella
          {ts.node?.login ? ` (${ts.node.login})` : ""}. Valitse sitten kone:
        </p>
        <PeerChoices
          peers={data.peers}
          saved={saved}
          value={wizard.peer}
          onChange={(name) => actions.choose({ peer: name })}
        />
        <TextField
          data-testid="own-machines-user"
          label="Käyttäjätunnuksesi koneella"
          value={wizard.user}
          onChange={(user) => actions.choose({ user: user.trim() })}
          hint="Agentti toimii koneella tällä käyttäjällä ja saa sen oikeudet."
          error={wizard.user && !userOk ? "Tunnus ei kelpaa." : undefined}
          mono
          name="remote-user"
          autoComplete="username"
        />
        <div className="om-row">
          <span>Pääsyn kesto</span>
          <Segmented<string>
            data-testid="own-machines-days"
            label="Pääsyn kesto"
            options={dayOptions}
            value={String(wizard.days)}
            onChange={(v) => actions.choose({ days: Number(v) as GrantDays })}
          />
        </div>
        <p className="s-desc" data-testid="own-machines-days-note">
          {wizard.days
            ? "Kone lakkaa hyväksymästä avainta itsestään. Pääsyä voi jatkaa korvaamalla rivin."
            : "Pääsy on voimassa, kunnes perut sen koneellasi."}
        </p>
      </>
    );
    next = peer && userOk ? 3 : null;
  } else if (step === 3) {
    body = mac ? (
      <ol className="om-steps">
        <li>
          Avaa Macissa <b>Järjestelmäasetukset › Yleiset › Jakaminen</b>.
        </li>
        <li>
          Laita <b>Etäkirjautuminen</b> päälle ja avaa sen ⓘ-painike.
        </li>
        <li>
          Valitse <b>Salli pääsy: Vain nämä käyttäjät</b> ja jätä listaan vain{" "}
          {wizard.user}.
        </li>
        <li>
          Jätä <b>Salli etäkäyttäjille täysi levyn käyttöoikeus</b> pois päältä.
        </li>
      </ol>
    ) : os === "windows" ? (
      <>
        <p>
          Asenna Windowsin oma OpenSSH-palvelin ja käynnistä se. Avaa PowerShell
          järjestelmänvalvojana (Käynnistä-valikossa hiiren oikea › Suorita
          järjestelmänvalvojana) ja aja:
        </p>
        <CopyBox text={windowsSSHServerCommand} onCopy={copy} />
        <p className="s-desc">
          Saman saa Asetuksista: Järjestelmä › Valinnaiset ominaisuudet ›
          OpenSSH-palvelin.
          {wizard.days ? (
            <>
              {" "}
              Päivätty rivi vaatii OpenSSH:n version 8.2 tai uudemman;{" "}
              <span className="om-mono">ssh -V</span> kertoo sen. Windows 10:n
              mukana tullut versio voi olla vanhempi.
            </>
          ) : null}
        </p>
      </>
    ) : (
      <>
        <p>Asenna SSH-palvelin ja käynnistä se (Ubuntu ja Debian):</p>
        <CopyBox
          text="sudo apt install openssh-server && sudo systemctl enable --now ssh"
          onCopy={copy}
        />
        <p className="s-desc">
          Fedorassa:{" "}
          <span className="om-mono">sudo dnf install openssh-server</span>.
        </p>
      </>
    );
    next = 4;
  } else if (step === 4) {
    const g = wizard.grant;
    const days = (
      <div className="om-row">
        <span>Pääsyn kesto</span>
        <Segmented<string>
          data-testid="own-machines-days"
          label="Pääsyn kesto"
          options={dayOptions}
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
          {wizard.busy === "grant" ? "Tehdään riviä…" : ""}
        </p>
      </>
    ) : (
      <>
        {renewing && days}
        {g.shell === "powershell" && g.admin_command ? (
          <>
            <div className="om-row">
              <span>Käyttäjä {g.user} koneella</span>
              <Segmented<string>
                data-testid="own-machines-windows-admin"
                label={`Käyttäjä ${g.user} koneella`}
                options={[
                  { id: "admin", label: "Järjestelmänvalvoja" },
                  { id: "user", label: "Tavallinen käyttäjä" },
                ]}
                value={admin ? "admin" : "user"}
                onChange={(v) => setAdmin(v === "admin")}
              />
            </div>
            <p>
              {admin ? (
                <>
                  Windows lukee järjestelmänvalvojien avaimet yhteisestä
                  tiedostosta{" "}
                  <span className="om-mono">
                    C:\ProgramData\ssh\administrators_authorized_keys
                  </span>
                  . Aja tämä komento PowerShellissä, joka on avattu
                  järjestelmänvalvojana. Se lisää yhden rivin, korvaa tämän
                  tilin aiemman rivin ja rajaa tiedoston oikeudet niin kuin
                  OpenSSH vaatii.
                </>
              ) : (
                <>
                  Aja tämä komento PowerShellissä käyttäjänä {g.user}. Se lisää
                  yhden rivin tiedostoon{" "}
                  <span className="om-mono">.ssh\authorized_keys</span>{" "}
                  kotikansiossasi ja korvaa aiemman Habitat-rivin, jos sellainen
                  on.
                </>
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
              Aja tämä komento koneen {mac ? "Päätteessä" : "päätteessä"}{" "}
              käyttäjänä {g.user}. Se lisää yhden rivin tiedostoon{" "}
              <span className="om-mono">~/.ssh/authorized_keys</span> ja korvaa
              aiemman Habitat-rivin, jos sellainen on.
            </p>
            <CopyBox
              text={g.command}
              testId="own-machines-command"
              onCopy={copy}
            />
          </>
        )}
        <details className="om-more">
          <summary>Pelkkä rivi ja mitä sen osat tarkoittavat</summary>
          <CopyBox text={g.line} testId="own-machines-line" onCopy={copy} />
          <dl className="om-facts">
            <dt>restrict</dt>
            <dd>
              Ei porttien, agentin tai näytön välitystä eikä päätettä. Komennot
              toimivat.
            </dd>
            <dt>from</dt>
            <dd>
              Kelpaa vain Habitatin osoitteesta {ts.node?.address}{" "}
              Tailscale-verkossasi.
            </dd>
            {g.expires && (
              <>
                <dt>expiry-time</dt>
                <dd>Kone lakkaa hyväksymästä avainta {fiDate(g.expires)}.</dd>
              </>
            )}
            <dt>ssh-ed25519 …</dt>
            <dd>
              Tilisi avain <span className="om-mono">~/.ssh/id_ed25519</span>,
              sormenjälki{" "}
              <span className="om-mono om-wrap">{g.key_fingerprint}</span>.
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
            Tarkista yhteys
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
          <b>Älä jatka.</b> Habitat ei tallentanut mitään. Osoitteessa vastaa
          jokin muu kuin koneesi. Tarkista, että valitsit oikean koneen ja että
          verkkosi laitteet ovat sinun.
        </p>
        <div className="om-btns">
          <ControlButton
            size="row"
            variant="secondary"
            onPress={actions.restart}
          >
            Aloita alusta
          </ControlButton>
        </div>
      </>
    ) : (
      <>
        <p>
          Varmista, että Habitat puhuu oikean koneen kanssa. Aja koneella
          {os === "windows" ? " PowerShellissä" : ""}:
        </p>
        <CopyBox
          text={os === "windows" ? windowsHostKeyCommand : hostKeyCommand}
          onCopy={copy}
        />
        <p>Tuloksessa pitää olla sama sormenjälki kuin tässä:</p>
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
          aria-label={renewing ? "Uusi pääsy" : "Lisää kone"}
          data-testid="own-machines-wizard"
          data-step={step}
        >
          <Heading slot="title">
            {renewing ? `Uusi pääsy: ${wizard.peer}` : "Lisää kone"}
          </Heading>
          <ol className="om-wz-steps" aria-label="Vaiheet">
            {wizardSteps.map((label, i) => (
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
                Takaisin
              </ControlButton>
            )}
            <ControlButton
              data-testid="own-machines-wizard-close"
              size="page"
              variant="secondary"
              onPress={actions.close}
            >
              {finish ? "Peru" : "Sulje"}
            </ControlButton>
            {step === 5 && !wizard.mismatch && (
              <ControlButton
                data-testid="own-machines-mismatch-button"
                size="page"
                variant="secondary"
                onPress={actions.mismatch}
              >
                Ei täsmää
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
                    ? "Tallenna uusi päivä"
                    : "Tallenna"
                  : "Täsmää, tallenna"}
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
                Seuraava
              </ControlButton>
            ) : null}
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
