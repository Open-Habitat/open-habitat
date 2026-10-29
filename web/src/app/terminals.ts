import Ajv from "ajv/dist/2020.js";
import schema from "../../../contracts/v1/terminal.schema.json";
import { jsonWrite, WriteRefused, writeOutcome } from "./mutations";

// The browser shell (implement-browser-shell). A shell is a tmux session the
// person's daemon runs in the workspace; the browser only lists, attaches and
// closes them. Nothing about shells is kept here beyond what is on screen.

const ajv = new Ajv({ strict: false });
ajv.addSchema(schema);
const validateList = ajv.compile({
  $ref: "https://open-habitat.invalid/contracts/v1/terminal.schema.json#/$defs/list",
});
const validateReady = ajv.compile({
  $ref: "https://open-habitat.invalid/contracts/v1/terminal.schema.json#/$defs/ready",
});
const validateWriter = ajv.compile({
  $ref: "https://open-habitat.invalid/contracts/v1/terminal.schema.json#/$defs/writer",
});
const validateExit = ajv.compile({
  $ref: "https://open-habitat.invalid/contracts/v1/terminal.schema.json#/$defs/exit",
});

export type ShellRow = {
  shell: string;
  name: string;
  busy: boolean;
  command?: string;
};
export type TaskfleetRow = {
  token: string;
  name: string;
  session: string;
  busy: boolean;
  command?: string;
};
export type TerminalList = {
  schema_version: 1;
  workspace_id: string;
  survives_restart: boolean;
  shells: ShellRow[];
  taskfleet: TaskfleetRow[];
};
export type TerminalReady = {
  type: "ready";
  shell?: string;
  taskfleet?: string;
  conversation?: string;
  name?: string;
  read_only: boolean;
  survives_restart: boolean;
  cols?: number;
  rows?: number;
};

export class TerminalLogin extends Error {}

export async function listTerminals(
  id: string,
  signal?: AbortSignal,
): Promise<TerminalList> {
  const response = await fetch(
    `/api/v1/workspaces/terminals?${new URLSearchParams({ workspace_id: id })}`,
    { signal, credentials: "same-origin", cache: "no-store" },
  );
  if (response.status === 401) throw new TerminalLogin();
  if (!response.ok) throw new Error("Päätteitä ei voitu lukea.");
  const text = await response.text();
  if (text.length > 256 * 1024) throw new Error("Päätteitä ei voitu lukea.");
  const value: unknown = JSON.parse(text);
  if (!validateList(value) || (value as TerminalList).workspace_id !== id)
    throw new Error("Päätteiden tietoja ei voitu vahvistaa.");
  return value as TerminalList;
}

/** Where a Pi in the person's own terminal writes a conversation: a tmux
 * pane the panel can watch, a terminal it cannot, or nowhere it can name. */
export type TerminalWriter = {
  schema_version: 1;
  workspace_id: string;
  conversation: string;
  place: "tmux" | "terminal" | "none";
  session?: string;
  window?: number;
  name?: string;
};

export async function readTerminalWriter(
  id: string,
  conversation: string,
  signal?: AbortSignal,
): Promise<TerminalWriter> {
  const response = await fetch(
    `/api/v1/workspaces/terminals/writer?${new URLSearchParams({ workspace_id: id, conversation })}`,
    { signal, credentials: "same-origin", cache: "no-store" },
  );
  if (response.status === 401) throw new TerminalLogin();
  if (!response.ok) throw new Error("writer_unavailable");
  const value: unknown = await response.json();
  if (
    !validateWriter(value) ||
    (value as TerminalWriter).workspace_id !== id ||
    (value as TerminalWriter).conversation !== conversation
  )
    throw new Error("writer_invalid");
  return value as TerminalWriter;
}

/** × on a shell: ends its tmux session and everything running in it. */
export async function closeShell(id: string, shell: string, csrf: string) {
  const outcome = await writeOutcome(
    await jsonWrite(
      "terminal.close",
      "/api/v1/workspaces/terminals/close",
      { workspace_id: id, shell },
      csrf,
    ).catch(() => undefined),
  );
  if (outcome.kind === "refused")
    throw new WriteRefused(outcome.status, outcome.code);
  if (outcome.kind === "login") throw new TerminalLogin();
  if (outcome.kind !== "ok") throw new Error("uncertain");
}

export type TerminalTarget =
  | { kind: "shell"; shell: string | "new" }
  | { kind: "taskfleet"; token: string }
  | { kind: "writer"; conversation: string };

export type TerminalEvents = {
  ready: (ready: TerminalReady) => void;
  data: (bytes: Uint8Array) => void;
  /** The shell or window is gone (`ended`), or this client was detached. */
  exit: (state: "ended" | "detached") => void;
  /** The connection ended without an exit: `code` is the close code
   * (4xxx is the host's refusal, 1006 a lost connection). */
  closed: (code: number, reason: string) => void;
};

export function terminalURL(
  id: string,
  target: TerminalTarget,
  origin = window.location.origin,
) {
  const query =
    target.kind === "shell"
      ? `workspace_id=${encodeURIComponent(id)}&shell=${encodeURIComponent(target.shell)}`
      : target.kind === "taskfleet"
        ? `workspace_id=${encodeURIComponent(id)}&taskfleet=${encodeURIComponent(target.token)}`
        : `workspace_id=${encodeURIComponent(id)}&conversation=${encodeURIComponent(target.conversation)}`;
  return `${origin.replace(/^http/, "ws")}/api/v1/workspaces/terminal?${query}`;
}

/**
 * One terminal connection. The first message proves the session's CSRF
 * token, the second sizes the terminal; then binary frames carry bytes.
 */
export class TerminalSocket {
  private socket: WebSocket;
  private exited = false;
  private readonly encoder = new TextEncoder();
  constructor(
    url: string,
    csrf: string,
    /** Read when the socket opens: the surface may have fitted meanwhile. */
    size: () => { cols: number; rows: number },
    private readonly on: TerminalEvents,
    make: (url: string) => WebSocket = (u) => new WebSocket(u),
  ) {
    this.socket = make(url);
    this.socket.binaryType = "arraybuffer";
    this.socket.onopen = () => {
      this.socket.send(JSON.stringify({ type: "auth", csrf }));
      const { cols, rows } = size();
      this.resize(cols, rows);
    };
    this.socket.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.on.data(new Uint8Array(event.data));
        return;
      }
      let message: unknown;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (validateReady(message)) this.on.ready(message as TerminalReady);
      else if (validateExit(message)) {
        this.exited = true;
        this.on.exit((message as { state: "ended" | "detached" }).state);
      }
    };
    this.socket.onclose = (event) => {
      if (!this.exited) this.on.closed(event.code, event.reason);
    };
  }
  /** Bytes in order, in messages the daemon accepts (it refuses over 64 KiB):
   * a large paste is a byte stream to the terminal, not one message. */
  send(text: string) {
    if (this.socket.readyState !== WebSocket.OPEN) return;
    const bytes = this.encoder.encode(text);
    for (let at = 0; at < bytes.length; at += 16 * 1024)
      this.socket.send(bytes.subarray(at, at + 16 * 1024));
  }
  resize(cols: number, rows: number) {
    if (this.socket.readyState === WebSocket.OPEN)
      this.socket.send(
        JSON.stringify({
          type: "resize",
          cols: Math.max(2, Math.min(500, Math.floor(cols))),
          rows: Math.max(1, Math.min(300, Math.floor(rows))),
        }),
      );
  }
  close() {
    this.exited = true;
    this.socket.close(1000);
  }
}

/** Words for a refusal the host gave on the socket (close code 4xxx). */
export function terminalRefusal(code: number, reason: string): string {
  if (reason === "shell_ended") return "Pääte on jo päättynyt.";
  if (reason === "shell_limit")
    return "Työtilassa on jo 16 päätettä. Lopeta jokin ennen uutta.";
  if (reason === "terminal_limit")
    return "Avoimia päätteitä on liikaa. Sulje jokin toisesta välilehdestä.";
  if (reason === "terminal_unavailable")
    return "Palvelin ei voi avata päätettä: tmux puuttuu tai ei käynnistynyt.";
  if (reason === "workspace_unavailable") return "Työtilaa ei löytynyt.";
  if (reason === "csrf_denied" || code === 4401)
    return "Istunto ei kelpaa enää. Lataa sivu uudelleen.";
  return "Pääte ei avautunut.";
}
