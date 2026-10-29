import Ajv from "ajv/dist/2020.js";
import schema from "../../../contracts/v1/own-machines.schema.json";

/** Omat koneet as the person's daemon reads it: their own Tailscale node,
 * the devices Tailscale lists, and the machines in their SSH configuration.
 * Nothing here is a private key or a credential. */
export type TailscaleState =
  | "unavailable"
  | "off"
  | "stopped"
  | "login"
  | "approval"
  | "starting"
  | "on";
export type TailnetNode = {
  name: string;
  dns_name?: string;
  address: string;
  tailnet?: string;
  login?: string;
  shields_up: boolean;
};
export type Peer = {
  name: string;
  dns_name?: string;
  os: string;
  address: string;
  online: boolean;
  last_seen?: string;
  ssh: "possible" | "later" | "no";
};
export type Machine = {
  name: string;
  user: string;
  address: string;
  expires: string;
  expired: boolean;
  in_tailnet: boolean;
  online: boolean;
  last_seen?: string;
  os?: string;
  host_key: string;
  connection_open: boolean;
};
export type Grant = {
  machine: string;
  user: string;
  address: string;
  expires: string;
  line: string;
  command: string;
  key_fingerprint: string;
};
export type CheckResult =
  | "ok"
  | "key_rejected"
  | "host_key_changed"
  | "offline"
  | "no_ssh"
  | "failed";
export type Check = { machine: string; result: CheckResult; host_key?: string };
export type OwnMachines = {
  schema_version: 1;
  web_identity_id: string;
  tailscale: { state: TailscaleState; auth_url?: string; node?: TailnetNode };
  peers: Peer[];
  machines: Machine[];
  ssh_include: boolean;
  remove_command: string;
  account_key?: { file: string; fingerprint: string };
  grant?: Grant;
  check?: Check;
  saved?: string;
  removed?: string;
};

export type OwnMachinesRequest =
  | { action: "connect" | "disconnect" }
  | { action: "grant"; peer: string; user: string; days: GrantDays }
  | { action: "renew"; machine: string; days: GrantDays }
  | { action: "check"; peer: string; user: string }
  | { action: "recheck" | "remove"; machine: string }
  | {
      action: "save";
      peer: string;
      user: string;
      expires: string;
      host_key: string;
    }
  | { action: "extend"; machine: string; expires: string };

export type GrantDays = 7 | 30 | 90;

const valid = new Ajv({ strict: false }).compile<OwnMachines>(schema);
export const ownMachinesPath = "/api/v1/own-machines";

export async function readOwnMachines(response: Response) {
  if (!response.ok) throw new Error("own machines unavailable");
  const data: unknown = await response.json();
  if (!valid(data)) throw new Error("contract");
  return data;
}

/** The line Habitat adds to ~/.ssh/config when it may. */
export const sshInclude = "Include ~/.ssh/config.d/habitat-*.conf";
/** What the person runs on the machine to read its host key. */
export const hostKeyCommand =
  "ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub";

export type MachineState =
  | "active"
  | "asleep"
  | "gone"
  | "expired"
  | "revoked"
  | "changed";

/** A saved machine's state: the date and Tailscale's view, and the last
 * check this page made, if any. A refused key before the date means the
 * line was taken away on the machine. */
export function machineState(m: Machine, check?: CheckResult): MachineState {
  if (m.expired) return "expired";
  if (check === "host_key_changed") return "changed";
  if (check === "key_rejected") return "revoked";
  if (!m.in_tailnet) return "gone";
  if (!m.online || check === "offline" || check === "no_ssh") return "asleep";
  return "active";
}

/** The OS family whose guidance applies. */
export function osFamily(os?: string): "mac" | "linux" | "other" {
  const v = (os ?? "").toLowerCase();
  return v === "macos" ? "mac" : v === "linux" ? "linux" : "other";
}

/** Tailscale's OS name as people write it. */
export function osLabel(os?: string) {
  return (
    (
      { linux: "Linux", windows: "Windows", macos: "macOS" } as Record<
        string,
        string
      >
    )[(os ?? "").toLowerCase()] ??
    os ??
    ""
  );
}

/** "28.11.2026" from "2026-11-28". */
export function fiDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return y && m && d ? `${d}.${m}.${y}` : date;
}

/** A last-seen time as "3 pv sitten", "2 h sitten" or "juuri". */
export function seenAgo(iso: string | undefined, now = new Date()) {
  if (!iso) return "ei tiedossa";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "ei tiedossa";
  const minutes = Math.max(0, Math.round((now.getTime() - t) / 60000));
  if (minutes < 2) return "juuri";
  if (minutes < 120) return `${minutes} min sitten`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h sitten`;
  return `${Math.round(hours / 24)} pv sitten`;
}

/** The person's own computers: what an action refused means for them. */
export function ownMachinesRefusal(code: string) {
  switch (code) {
    case "tailscale_unavailable":
      return "Tämä palvelin ei tarjoa Tailscalea.";
    case "user_manager_unavailable":
      return "Tilisi palveluita ei voitu käynnistää tällä palvelimella. Palvelimen ylläpitäjä voi korjata sen.";
    case "tailscale_not_connected":
      return "Habitat ei ole yhdistetty Tailscale-verkkoosi.";
    case "unknown_peer":
      return "Konetta ei enää ole Tailscale-verkossasi.";
    case "unknown_machine":
      return "Konetta ei enää ole Habitatissa.";
    case "machine_exists":
      return "Kone on jo lisätty.";
    case "too_many_machines":
      return "Koneita on jo enimmäismäärä.";
    case "account_key_unusable":
      return "Tilin SSH-avainta ~/.ssh/id_ed25519 ei voitu käyttää. Jos se on suojattu salasanalla, Habitat ei voi käyttää sitä.";
    case "host_key_mismatch":
      return "Kone näytti nyt eri tunnisteen kuin vertasit. Mitään ei tallennettu.";
    case "own_machines_busy":
      return "Toinen muutos on kesken. Odota hetki.";
    default:
      return "Pyyntö ei onnistunut. Yritä uudelleen.";
  }
}
