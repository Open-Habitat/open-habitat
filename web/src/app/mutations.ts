import { useSyncExternalStore } from "react";
import { liveText } from "../i18n";
import { largeContentText } from "../text/largeContent";
import { refusalsText } from "../text/refusals";

const txt = liveText(refusalsText);
const largeText = liveText(largeContentText);
// The browser's one mutation layer (ADR 0023). Every write names its command
// here and goes through `mutationFetch`, so its class, its client command id
// and the reading of its outcome are decided in one place. `MutationLayer`
// holds the in-memory overlay of commands the host has not yet confirmed; it
// is never a store of truth, and is dropped per command on confirmation or
// failure and as a whole on an identity change.

/** Who owns the fact a click changes decides what the person sees at once. */
export type MutationClass = "optimistic" | "pending" | "confirmed";

export const mutationClasses = {
  "client.load_failure": "confirmed",
  "attachment.upload": "confirmed",
  // Optimistic: the result shows at once; the host confirms in the background.
  "workspace.visibility": "optimistic",
  "workspace.rename": "optimistic",
  "conversation.archive": "optimistic",
  "conversation.name": "optimistic",
  "conversation.turn": "optimistic",
  "pi.default_model": "optimistic",
  "recap.settings": "optimistic",
  // Pending: the result shows dimmed and marked until the host confirms.
  "conversation.send": "pending",
  "conversation.queue": "pending",
  "conversation.cancel_held": "pending",
  "conversation.clear_queue": "pending",
  "conversation.question": "pending",
  "conversation.create": "pending",
  "conversation.continue": "pending",
  "conversation.close_empty": "pending",
  "conversation.abort": "pending",
  "conversation.bash": "pending",
  "conversation.abort_bash": "pending",
  // Palaa tähän: the sheet stays until the host says what it did.
  "conversation.rewind": "pending",
  // Tiivistä nyt: the page says it compacts until Pi has answered.
  "conversation.compact": "pending",
  "workspace.create": "pending",
  "workspace.git_init": "pending",
  // The page shows the chosen icon at once, until the snapshot carries it.
  "workspace.icon": "pending",
  // Confirmed: only that the command is on its way.
  "conversation.stop": "confirmed",
  "conversation.recap": "confirmed",
  "conversation.presence": "confirmed",
  "conversation.title": "confirmed",
  "workspace.delete": "confirmed",
  "workspace.worktree": "confirmed",
  "workspace.github_publish": "confirmed",
  // Spends the person's own model credentials; nothing is written.
  "workspace.icon_suggestions": "confirmed",
  "workspace.git_fetch": "confirmed",
  "terminal.close": "confirmed",
  "github.clone": "confirmed",
  "github.clone_action": "confirmed",
  "github.disconnect": "confirmed",
  "process.control": "confirmed",
  "pi.credentials": "confirmed",
  "pi.claude_login": "confirmed",
  "integrations.account": "confirmed",
  "integrations.login": "confirmed",
  "integrations.gitea": "confirmed",
  "integrations.gitlab": "confirmed",
  "pi.onboarding": "confirmed",
  "git.identity": "confirmed",
  "account.profile": "confirmed",
  "account.logout": "confirmed",
  "server.administration": "confirmed",
  "server.storage": "confirmed",
  "server.live_limits": "confirmed",
  "server.access": "confirmed",
  "server.integrations": "confirmed",
  "server.onboarding": "confirmed",
  "server.onboarding.ai-key": "confirmed",
  "editor.handoff": "confirmed",
  "editor.open": "confirmed",
  "editor.save": "confirmed",
  "account.preferences": "confirmed",
  "account.first_route": "confirmed",
  "account.keys": "confirmed",
  "account.own_machines": "confirmed",
  // Asks the daemon to measure the home again; nothing is written.
  "account.storage_breakdown": "confirmed",
  "editor.stop": "confirmed",
  // The person's server browser: the chip says it starts or stops until
  // the host answers; control changes show once the host has them.
  "browser.start": "confirmed",
  "browser.stop": "confirmed",
  "browser.control": "confirmed",
  "view.handoff": "confirmed",
  "view.address": "confirmed",
  "server.view_address": "confirmed",
  "speech.key": "confirmed",
  "speech.session": "confirmed",
  "server.speech_key": "confirmed",
} as const satisfies Record<string, MutationClass>;
export type MutationCommand = keyof typeof mutationClasses;

/** After this long without an answer the item says confirmation is slow. */
export const slowConfirmationMs = 2000;

type WriteInit = RequestInit & { method: "POST" | "PUT" | "DELETE" };
/** The only place the browser sends a write. The command name is the
 * contract with the table above; `mutations.test.ts` fails on a direct one. */
export function mutationFetch(
  command: MutationCommand,
  url: string,
  init: WriteInit,
): Promise<Response> {
  if (!(command in mutationClasses)) throw new Error("unknown command");
  return fetch(url, init);
}

/** File bodies need XHR for upload progress; keep writes in this layer. */
export function mutationUpload(
  command: MutationCommand,
  url: string,
  file: File,
  csrf: string,
  signal: AbortSignal,
  progress?: (loaded: number) => void,
): Promise<Response> {
  if (!(command in mutationClasses)) throw new Error("unknown command");
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const cleanup = () => signal.removeEventListener("abort", abort);
    const fail = () => {
      cleanup();
      reject(new Error("upload failed"));
    };
    const abort = () => {
      xhr.abort();
      fail();
    };
    if (signal.aborted) {
      fail();
      return;
    }
    xhr.open("POST", url);
    xhr.responseType = "arraybuffer";
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-Agent-Host-CSRF", csrf);
    xhr.upload.onprogress = (event) =>
      progress?.(Math.min(file.size, event.loaded));
    xhr.upload.onload = () => progress?.(file.size);
    // Bound the reply before buffering it, including replies without a length.
    xhr.onprogress = (event) => {
      if (event.loaded > 4096) abort();
    };
    xhr.onerror = fail;
    xhr.onabort = fail;
    xhr.ontimeout = fail;
    xhr.onload = () => {
      cleanup();
      try {
        if (xhr.status === 0 || xhr.response.byteLength > 4096) {
          fail();
          return;
        }
        resolve(
          new Response(xhr.status === 204 ? null : xhr.response, {
            status: xhr.status,
            headers: {
              "Content-Type": xhr.getResponseHeader("Content-Type") ?? "",
            },
          }),
        );
      } catch {
        fail();
      }
    };
    signal.addEventListener("abort", abort, { once: true });
    xhr.send(file);
  });
}

/** For a helper that reads and writes one resource with the same code: a GET
 * is an ordinary read, anything else is this command's write. */
export function hostRequest(
  command: MutationCommand,
  url: string,
  init: RequestInit & { method: "GET" | WriteInit["method"] },
): Promise<Response> {
  const { method, ...rest } = init;
  return method === "GET"
    ? fetch(url, rest)
    : mutationFetch(command, url, { ...rest, method });
}

/** The usual JSON write: same-origin, uncached, with the session's CSRF. */
export function jsonWrite(
  command: MutationCommand,
  url: string,
  body: unknown,
  csrf: string,
  init: Partial<WriteInit> = {},
): Promise<Response> {
  return mutationFetch(command, url, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Agent-Host-CSRF": csrf,
      Origin: window.location.origin,
      ...(init.headers as Record<string, string> | undefined),
    },
    body: JSON.stringify(body),
  });
}

/** How the host answered a write.
 * - `ok`: the host did it.
 * - `refused`: a definite no; nothing was written (typed 4xx such as 409, 429).
 * - `uncertain`: it may or may not have happened (transport loss, 5xx, an
 *   unreadable reply, or a code that itself says the outcome is unknown).
 * - `login`: the session ended; the caller opens login. */
export type WriteOutcome =
  | { kind: "ok"; response: Response }
  | { kind: "refused"; status: number; code: string }
  | { kind: "uncertain" }
  | { kind: "login" };

// Typed codes whose meaning is "the write may have partly happened".
const uncertainCodes = new Set(["workspace_partial"]);

async function errorCode(response: Response): Promise<string> {
  try {
    if (
      response.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      return "";
    const text = await response.text();
    if (text.length > 4096) return "";
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object") return "";
    const error = (value as { error?: unknown }).error;
    const code =
      typeof error === "string"
        ? error
        : error && typeof error === "object"
          ? (error as { code?: unknown }).code
          : undefined;
    return typeof code === "string" && /^[a-z_]{1,64}$/.test(code) ? code : "";
  } catch {
    return "";
  }
}

/** Reads a write's response, or its absence, as one of the four outcomes. */
export async function writeOutcome(
  response: Response | undefined,
): Promise<WriteOutcome> {
  if (!response) return { kind: "uncertain" };
  if (response.ok) return { kind: "ok", response };
  if (response.status === 401) return { kind: "login" };
  if (
    response.status >= 400 &&
    response.status < 500 &&
    response.status !== 408
  ) {
    const code = await errorCode(response);
    // A refusal without a readable code says nothing about what was written,
    // except a rate limit, which never reaches the writer.
    return uncertainCodes.has(code) || (!code && response.status !== 429)
      ? { kind: "uncertain" }
      : { kind: "refused", status: response.status, code };
  }
  return { kind: "uncertain" };
}

/** The per-person limit counts only conversations that are doing something;
 * idle ones give their place up (host pi_activity_linux.go). */
export const capacityReason = () => txt.capacity;

/** Why Pi did not start, from the host's fixed start problem, in words the
 * person can act on; an unknown code still says something true. */
export function startProblemReason(code: string | undefined): string {
  switch (code) {
    case "capacity_exceeded":
      return capacityReason();
    case "history_damaged":
      return txt.historyDamaged;
    case "quota_full":
      return txt.quotaFull;
    case "storage_full":
      return txt.storageFull;
    case "writer_present":
      return txt.writerPresent;
    case "read_only_history":
      return txt.readOnlyStart;
    case "source_unavailable":
      return txt.sourceUnavailable;
    case "pi_start_failed":
      return txt.startFailed;
    default:
      return txt.startUnknown;
  }
}

/** The host's refusals of a message's content (its attachments or its
 * length together with the queue): nothing was written, and the person can
 * change the draft and send it again. */
const messageContentRefusals = new Set([
  "attachments_too_many",
  "attachments_too_large",
  "invalid_attachments",
  "message_too_long",
]);
export const messageContentRefused = (code: string | undefined) =>
  !!code && messageContentRefusals.has(code);

/** The daemon's workspace-writer holders. After its bounded wait the daemon
 * refuses a short write with the code of the operation still holding the
 * writer, so every write path should word these as refusals naming it. */
export const writerHolderCodes = [
  "workspace_clone_running",
  "workspace_checkout_check_running",
  "workspace_worktree_create_running",
  "workspace_worktree_cleanup_running",
  "workspace_deletion_running",
  "workspace_archive_running",
  "workspace_settings_running",
  "workspace_identity_running",
  "workspace_publish_running",
  "workspace_disconnect_running",
] as const;
const writerHolders = new Set<string>(writerHolderCodes);
export const writerHolder = (code: string | undefined) =>
  !!code && writerHolders.has(code);

/** Why the host said no, in words the person can act on. */
export function refusalReason(code: string, status = 409): string {
  switch (code) {
    case "attachments_too_many":
      return largeText.hostTooMany;
    case "attachments_too_large":
      return largeText.hostTooLarge;
    case "invalid_attachments":
      return largeText.hostMissing;
    case "message_too_long":
      return largeText.hostTooLong;
    case "capacity_exceeded":
      return capacityReason();
    case "workspace_clone_running":
      return txt.cloneRunning;
    case "workspace_checkout_check_running":
      return txt.checkoutCheck;
    case "workspace_worktree_create_running":
      return txt.worktreeCreate;
    case "workspace_worktree_cleanup_running":
      return txt.worktreeCleanup;
    case "workspace_deletion_running":
      return txt.deletionRunning;
    case "workspace_archive_running":
      return txt.archiveRunning;
    case "workspace_settings_running":
      return txt.settingsRunning;
    case "workspace_identity_running":
      return txt.identityRunning;
    case "workspace_publish_running":
      return txt.publishRunning;
    case "workspace_disconnect_running":
      return txt.disconnectRunning;
    case "workspace_busy":
      return txt.busy;
    case "writer_conflict":
      return txt.writerConflict;
    case "workspace_changed":
    case "control_uncertain":
      return txt.changed;
    case "workspace_missing":
      return txt.workspaceMissing;
    case "workspace_exists":
      return txt.workspaceExists;
    case "workspace_uncertain":
    case "native_source_unavailable":
      return txt.workspaceUncertain;
    case "read_only_history":
      return txt.readOnly;
    case "history_damaged":
    case "quota_full":
    case "storage_full":
      return startProblemReason(code);
    case "worktree_base_unavailable":
      return txt.worktreeBase;
    case "worktree_unavailable":
      return txt.worktreeUnavailable;
    default:
      return status === 403
        ? txt.session
        : status === 429
          ? txt.wait
          : txt.refused;
  }
}

/** Thrown by a write helper whose outcome was a definite refusal. */
export class WriteRefused extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code || "refused");
  }
}

// ---------------------------------------------------------------------------
// The overlay of unconfirmed commands.

export type PendingPhase = "pending" | "slow" | "uncertain";
export type PendingEntry<V = unknown> = {
  readonly commandId: string;
  readonly command: MutationCommand;
  readonly key: string;
  readonly value: V;
  readonly phase: PendingPhase;
};
export type Settled<R> =
  | { outcome: "confirmed"; reply: R }
  | { outcome: "refused"; text: string; code: string }
  | { outcome: "uncertain" }
  | { outcome: "superseded" }
  | { outcome: "login" }
  | { outcome: "abandoned" };

export type MutationSpec<V, R> = {
  command: MutationCommand;
  /** The target, e.g. `workspace:<id>:visibility`. One command per key is in
   * flight; a newer one queues behind it and replaces any older queued one. */
  key: string;
  /** What the person sees while the command is unconfirmed. */
  value: V;
  /** Sends the write with this command's id. A thrown error is a lost reply. */
  send: (commandId: string, signal: AbortSignal) => Promise<Response>;
  /** Validates a 2xx reply. A throw makes the outcome uncertain. */
  read: (response: Response, commandId: string) => Promise<R>;
  /** Applies the reply's changed resource to the host model. */
  confirmed?: (reply: R) => void;
  /** The problem text for a definite refusal. */
  refused: (reason: string, code: string) => string;
  /** Reads the host's current state as this command's receipt after an
   * uncertain outcome. Without one the entry waits for `reconcile`. */
  receipt?: (
    signal: AbortSignal,
  ) => Promise<"confirmed" | "reverted" | "unknown">;
  /** Text when the receipt shows the command did not happen. */
  reverted?: string;
};

type Live<V, R> = {
  spec: MutationSpec<V, R>;
  commandId: string;
  phase: PendingPhase;
  /** Layer sequence when it became uncertain; a read marked later is its receipt. */
  uncertainAt?: number;
  timer?: ReturnType<typeof setTimeout>;
  resolve: (settled: Settled<R>) => void;
};

/** One per identity and tab, in memory only. */
export class MutationLayer {
  private readonly inflight = new Map<string, Live<unknown, unknown>>();
  private readonly queued = new Map<string, Live<unknown, unknown>>();
  private readonly uncertain = new Map<string, Live<unknown, unknown>>();
  private readonly problems = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  private readonly controllers = new Set<AbortController>();
  private seq = 0;
  private version = 0;
  private disposed = false;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getVersion = () => this.version;
  private changed() {
    this.version++;
    for (const listener of this.listeners) listener();
  }

  /** The newest unconfirmed command on this key, if any. */
  get<V>(key: string): PendingEntry<V> | undefined {
    const live = this.queued.get(key) ?? this.inflight.get(key);
    const current = live ?? this.uncertain.get(key);
    if (!current) return;
    return {
      commandId: current.commandId,
      command: current.spec.command,
      key,
      value: current.spec.value as V,
      phase: current.phase,
    };
  }
  /** Every unconfirmed command whose key starts with this prefix. */
  entries<V>(prefix: string): PendingEntry<V>[] {
    const keys = new Set(
      [
        ...this.inflight.keys(),
        ...this.queued.keys(),
        ...this.uncertain.keys(),
      ].filter((k) => k.startsWith(prefix)),
    );
    return [...keys]
      .map((k) => this.get<V>(k))
      .filter((e): e is PendingEntry<V> => !!e);
  }
  problem(key: string): string | undefined {
    return this.problems.get(key);
  }
  problemsWith(prefix: string): [string, string][] {
    return [...this.problems].filter(([k]) => k.startsWith(prefix));
  }
  dismiss(key: string) {
    if (this.problems.delete(key)) this.changed();
  }

  run<V, R>(spec: MutationSpec<V, R>): Promise<Settled<R>> {
    if (this.disposed) return Promise.resolve({ outcome: "abandoned" });
    return new Promise((resolve) => {
      const live: Live<V, R> = {
        spec,
        commandId: crypto.randomUUID(),
        phase: "pending",
        resolve,
      };
      const any = live as unknown as Live<unknown, unknown>;
      this.problems.delete(spec.key);
      // A newer command on this key replaces an uncertain one's presentation.
      const doubt = this.uncertain.get(spec.key);
      if (doubt) {
        this.uncertain.delete(spec.key);
        doubt.resolve({ outcome: "superseded" });
      }
      live.timer = setTimeout(() => {
        if (live.phase === "pending") {
          live.phase = "slow";
          this.changed();
        }
      }, slowConfirmationMs);
      if (this.inflight.has(spec.key)) {
        const older = this.queued.get(spec.key);
        if (older) {
          clearTimeout(older.timer);
          older.resolve({ outcome: "superseded" });
        }
        this.queued.set(spec.key, any);
        this.changed();
        return;
      }
      this.inflight.set(spec.key, any);
      this.changed();
      void this.drive(any);
    });
  }

  private async drive(live: Live<unknown, unknown>) {
    const { spec } = live;
    let settled: Settled<unknown> | undefined;
    for (let attempt = 0; !settled; attempt++) {
      const controller = new AbortController();
      this.controllers.add(controller);
      let response: Response | undefined;
      try {
        response = await spec.send(live.commandId, controller.signal);
      } catch {
        response = undefined;
      }
      this.controllers.delete(controller);
      if (this.disposed) return;
      const outcome = await writeOutcome(response);
      if (this.disposed) return;
      if (outcome.kind === "ok") {
        try {
          settled = {
            outcome: "confirmed",
            reply: await spec.read(outcome.response, live.commandId),
          };
        } catch {
          settled = { outcome: "uncertain" };
        }
      } else if (outcome.kind === "refused") {
        // A busy writer refused before writing anything; the same command
        // may be sent again, briefly, rather than shown as a failure.
        if (outcome.code === "workspace_busy" && attempt < 2) {
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
          if (this.disposed) return;
          continue;
        }
        settled = {
          outcome: "refused",
          code: outcome.code,
          text: spec.refused(
            refusalReason(outcome.code, outcome.status),
            outcome.code,
          ),
        };
      } else settled = { outcome: outcome.kind };
    }
    if (this.disposed) return;
    this.inflight.delete(spec.key);
    clearTimeout(live.timer);
    const next = this.queued.get(spec.key);
    if (settled.outcome === "confirmed") spec.confirmed?.(settled.reply);
    if (next) {
      // Only the newest command's outcome is shown; this one's reply has
      // still been applied when it carried a host fact.
      this.queued.delete(spec.key);
      this.inflight.set(spec.key, next);
      live.resolve(
        settled.outcome === "login" ? settled : { outcome: "superseded" },
      );
      this.changed();
      void this.drive(next);
      return;
    }
    if (settled.outcome === "refused")
      this.problems.set(spec.key, settled.text);
    if (settled.outcome === "uncertain") {
      live.phase = "uncertain";
      live.uncertainAt = ++this.seq;
      this.uncertain.set(spec.key, live);
      this.changed();
      live.resolve(settled);
      if (spec.receipt) void this.checkReceipt(live);
      return;
    }
    this.changed();
    live.resolve(settled);
  }

  private async checkReceipt(live: Live<unknown, unknown>) {
    const controller = new AbortController();
    this.controllers.add(controller);
    let verdict: "confirmed" | "reverted" | "unknown" = "unknown";
    try {
      verdict = (await live.spec.receipt?.(controller.signal)) ?? "unknown";
    } catch {
      verdict = "unknown";
    }
    this.controllers.delete(controller);
    if (this.disposed || this.uncertain.get(live.spec.key) !== live) return;
    this.settleUncertain(live, verdict);
  }
  private settleUncertain(
    live: Live<unknown, unknown>,
    verdict: "confirmed" | "reverted" | "unknown",
  ) {
    if (verdict === "unknown") return false;
    this.uncertain.delete(live.spec.key);
    if (verdict === "reverted")
      this.problems.set(live.spec.key, live.spec.reverted ?? txt.reverted);
    return true;
  }

  /** Call before starting a host read; pass the value to `reconcile`. */
  mark(): number {
    return this.seq;
  }
  /** A host read that started after an uncertain outcome is its receipt. The
   * judge says whether the read shows the command as done. */
  reconcile(
    mark: number,
    judge: (entry: PendingEntry) => "confirmed" | "reverted" | "unknown",
  ) {
    let any = false;
    for (const live of [...this.uncertain.values()]) {
      if ((live.uncertainAt ?? Number.POSITIVE_INFINITY) > mark) continue;
      const entry = this.get(live.spec.key);
      if (entry && this.settleUncertain(live, judge(entry))) any = true;
    }
    if (any) this.changed();
  }

  /** Identity change: nothing of the previous person's commands survives. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const c of this.controllers) c.abort();
    for (const live of [
      ...this.inflight.values(),
      ...this.queued.values(),
      ...this.uncertain.values(),
    ]) {
      clearTimeout(live.timer);
      live.resolve({ outcome: "abandoned" });
    }
    this.inflight.clear();
    this.queued.clear();
    this.uncertain.clear();
    this.problems.clear();
    this.changed();
    this.listeners.clear();
  }
}

const noSubscription = () => () => {};
const noVersion = () => 0;
/** Re-renders when the layer's overlay or problems change. */
export function useMutationLayer(layer?: MutationLayer): number {
  return useSyncExternalStore(
    layer ? layer.subscribe : noSubscription,
    layer ? layer.getVersion : noVersion,
  );
}
