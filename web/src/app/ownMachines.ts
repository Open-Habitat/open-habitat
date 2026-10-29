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
  ssh: "possible" | "no";
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
  /** sh on macOS and Linux; powershell on Windows, where admin_command is
   * the one for a member of Administrators. */
  shell: "sh" | "powershell";
  command: string;
  admin_command?: string;
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
  windows_remove_command: string;
  windows_admin_remove_command: string;
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
/** The same in PowerShell on Windows. */
export const windowsHostKeyCommand =
  "ssh-keygen -lf $env:ProgramData\\ssh\\ssh_host_ed25519_key.pub";
/** Installs and starts Windows' own OpenSSH Server, in an elevated
 * PowerShell. */
export const windowsSSHServerCommand =
  "Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0; Set-Service sshd -StartupType Automatic; Start-Service sshd";

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
export function osFamily(os?: string): "mac" | "linux" | "windows" | "other" {
  const v = (os ?? "").toLowerCase();
  return v === "macos"
    ? "mac"
    : v === "linux"
      ? "linux"
      : v === "windows"
        ? "windows"
        : "other";
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

// ssh options that take an argument (ssh(1) synopsis).
const sshArgOptions = new Set("BbcDEeFIiJLlmOoPpQRSWw");
// Options with which ssh connects to nothing: print config, version, query.
const sshNoConnect = new Set("GVQ");
// Words that run the rest of the command line as a command.
const wrappers = new Set(["command", "exec", "nohup", "env", "time"]);

/** Shell words with quotes removed, cut at the operators that start the
 * next command (`;`, `&&`, `||`, `|`, `&`, newline, parentheses) and at a
 * comment. Variables and substitutions stay as they are written. */
function shellCommands(text: string): string[][] {
  const commands: string[][] = [[]];
  let word: string | undefined;
  let quote = "";
  const end = () => {
    if (word !== undefined) commands[commands.length - 1].push(word);
    word = undefined;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = "";
      else if (c === "\\" && quote === '"' && i + 1 < text.length)
        word += text[++i];
      else word += c;
    } else if (c === "'" || c === '"') {
      quote = c;
      word ??= "";
    } else if (c === "\\" && i + 1 < text.length) {
      word = (word ?? "") + text[++i];
    } else if (c === "#" && word === undefined) {
      while (i < text.length && text[i] !== "\n") i++;
      end();
      commands.push([]);
    } else if (/[;&|()\n`]/.test(c)) {
      end();
      commands.push([]);
    } else if (/\s/.test(c)) {
      end();
    } else {
      word = (word ?? "") + c;
    }
  }
  end();
  return commands.filter((words) => words.length);
}

/** The host an `ssh` command in this shell text goes to, if it names one the
 * way a machine is named: `ssh alice-macbook -- ls`, `ssh -o X=1 alice@pc ls`,
 * `cd x && ssh pc true`, `timeout 10 ssh pc true`. Only ssh run as a command
 * counts (not `echo ssh pc`), and only the first. Whether the name is one of
 * the person's own machines is for the caller to check against their list. */
export function sshTarget(command: string): string | undefined {
  for (const words of shellCommands(command)) {
    let i = 0;
    // VAR=value, and the wrappers that run what follows (with timeout's
    // duration and env's assignments).
    for (;;) {
      const w = words[i] ?? "";
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w) || wrappers.has(w)) i++;
      else if (w === "timeout") i += 2;
      else break;
      while ((words[i] ?? "").startsWith("-")) i++;
    }
    if (words[i] !== "ssh") continue;
    for (i++; i < words.length; i++) {
      const word = words[i];
      if (word === "--") {
        i++;
      } else if (word.startsWith("-") && word.length > 1) {
        for (let j = 1; j < word.length; j++) {
          if (sshNoConnect.has(word[j])) return undefined;
          if (sshArgOptions.has(word[j])) {
            if (j === word.length - 1) i++;
            break;
          }
        }
        continue;
      }
      const host = (words[i] ?? "").replace(/^[^@]*@/, "");
      return /^[a-z0-9][a-z0-9-]{0,62}$/.test(host) ? host : undefined;
    }
    return undefined;
  }
  return undefined;
}
