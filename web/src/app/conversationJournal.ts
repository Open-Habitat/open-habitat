import eventSchema from "../../../contracts/v1/event.schema.json";
import {
  type ConversationEvent,
  parseConversationEvent,
} from "./conversationEvents";
import type { ConversationStore } from "./conversationStore";
import { reconnectDiagnostic, reconnectFetch } from "./reconnectDiagnostic";
import type { Snapshot } from "./snapshot";
import type { HostChange } from "./store";

// Named SSE events have no onmessage fallback. Subscribe to the contract's
// complete set so a new type cannot silently create a sequence gap.
const kinds = eventSchema.properties.kind.enum;
const statusKinds = new Set([
  "process.changed",
  "process.output",
  "process.notification",
  "turn.settled",
  "command.changed",
  "queue.changed",
  "question.requested",
  "question.resolved",
]);
// A running Pi turn rewrites its session file several times a second, and the
// daemon reports each burst as an agent-scoped invalidation; controller state
// changes use the same event. The open conversation follows them through the
// store. The full snapshot behind them is requested at once for the first and
// then at most this often, so a refresh chain can finish before the next one
// replaces it, and the last state of a burst still arrives within this time.
export const agentSnapshotInterval = 1000;
const cursorParts = (cursor: string) => {
  const match =
    /^ev1:([0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}):(0|[1-9][0-9]*)$/.exec(
      cursor,
    );
  const sequence = Number(match?.[2]);
  if (!match || !Number.isSafeInteger(sequence))
    throw new Error("invalid cursor");
  return { instance: match[1], sequence };
};

/** One journal cursor and transport for one authenticated tab, never a route. */
export class ConversationJournal {
  private cursor = "";
  private instance = "";
  private sequence = 0;
  private lastEventId?: string;
  private seenIds = new Set<string>();
  private source?: EventSource;
  // The source whose open event arrived; every close clears or replaces source.
  private openSource?: EventSource;
  private timer?: number;
  private connectTimer?: ReturnType<typeof setTimeout>;
  private probe?: AbortController;
  private generation = 0;
  private stopped = true;
  private recovering = false;
  // The lowest snapshot sequence that can end the current recovery.
  private recoverAt = 0;
  private failures = 0;
  private invalidation = 0;
  private offline = false;
  private agentSnapshotAt = Number.NEGATIVE_INFINITY;
  // Whether every invalidation since the last discharging snapshot was an
  // agent hint, so a retry for it can be paced.
  private agentOnlyInvalidation = false;
  private agentSnapshotTimer?: ReturnType<typeof setTimeout>;
  constructor(
    private readonly store: ConversationStore,
    private readonly callbacks: {
      onSnapshotNeeded: () => void;
      /** A workspace change carries its facts; no snapshot is needed. */
      onWorkspaceChanged?: (change: HostChange & { kind: "workspace" }) => void;
      onStatusChange: (
        id: string,
        kind: string,
        payload?: Record<string, unknown>,
      ) => void;
      activeId: () => string | undefined;
      onLogin: () => void;
      onOffline: (offline: boolean) => void;
      onConnection?: (
        state: "connecting" | "online" | "failed",
        reason?: string,
      ) => void;
    },
  ) {}
  private setOffline(value: boolean) {
    if (this.offline === value) return;
    this.offline = value;
    this.callbacks.onOffline(value);
  }
  private reset(snapshot: Snapshot) {
    const { instance, sequence } = cursorParts(snapshot.event_cursor);
    this.cursor = snapshot.event_cursor;
    this.instance = instance;
    this.sequence = sequence;
    this.lastEventId = undefined;
    this.seenIds.clear();
  }
  start(snapshot: Snapshot) {
    if (!this.stopped) return;
    this.reset(snapshot);
    this.stopped = false;
    this.connect();
  }
  /** A snapshot received while streaming must never rewind a validated cursor. */
  resume(snapshot: Snapshot) {
    if (
      this.stopped ||
      snapshot.identity.web_identity_id !== this.store.identity
    )
      return;
    const next = cursorParts(snapshot.event_cursor);
    reconnectDiagnostic({
      event: "cursor",
      outcome:
        next.instance !== this.instance
          ? "new-instance"
          : next.sequence < this.sequence
            ? "older"
            : next.sequence === this.sequence
              ? "equal"
              : "newer",
      recovering: this.recovering,
    });
    if (this.recovering) {
      // Never rewind accepted events. An equal cursor is a valid recovery
      // point when an invalid duplicate caused recovery without any new
      // native event. After a gap or an expired cursor it is not proof that
      // the cause has passed: the daemon's head is never expired and always
      // covers a frame it sent, so only a fault (a proxy, a forged frame)
      // leaves the snapshot there. Meanwhile keep reading snapshots at the
      // paced rate, so the page stays current and a newer one ends recovery;
      // accept the unchanged cursor only after transport backoff, never at
      // once, so the fault cannot become a stream loop and its end still
      // restores the stream without a native event.
      if (next.instance === this.instance && next.sequence < this.sequence) {
        this.callbacks.onSnapshotNeeded();
        return;
      }
      if (next.instance === this.instance && next.sequence < this.recoverAt) {
        this.agentSnapshot();
        this.acceptUnchangedLater();
        return;
      }
      clearTimeout(this.timer);
      this.timer = undefined;
      this.store.reseed(snapshot);
      this.reset(snapshot);
      this.recovering = false;
      this.connect();
    } else if (
      next.instance !== this.instance ||
      next.sequence > this.sequence
    ) {
      // Snapshot has passed the current replay point (or a daemon restarted).
      this.source?.close();
      if (this.timer !== undefined) clearTimeout(this.timer);
      this.timer = undefined;
      this.probe?.abort();
      ++this.generation;
      this.store.reseed(snapshot);
      this.reset(snapshot);
      this.connect();
    }
    this.store.applySnapshot(snapshot);
    // A stale snapshot taken before an invalidation cannot discharge it. One
    // left only by agent hints waits its turn like the hints themselves.
    if (next.instance === this.instance && next.sequence < this.invalidation)
      if (this.agentOnlyInvalidation) this.agentSnapshot();
      else this.snapshotNow();
    else {
      if (this.invalidation) this.store.reconcileStale();
      this.invalidation = 0;
      this.agentOnlyInvalidation = false;
    }
  }
  route(event: ConversationEvent, sseId = event.cursor) {
    if (this.stopped || this.recovering) return;
    if (sseId !== event.cursor) return this.recover();
    if (event.server_instance_id !== this.instance) return this.recover();
    if (
      event.sequence === this.sequence &&
      event.cursor === this.cursor &&
      event.event_id === this.lastEventId
    )
      return;
    if (
      event.sequence !== this.sequence + 1 ||
      this.seenIds.has(event.event_id) ||
      event.cursor !== `ev1:${this.instance}:${event.sequence}`
    )
      return this.recover(
        event.sequence > this.sequence + 1 &&
          event.cursor === `ev1:${this.instance}:${event.sequence}`
          ? event.sequence
          : this.sequence,
      );
    this.sequence = event.sequence;
    this.cursor = event.cursor;
    this.lastEventId = event.event_id;
    this.seenIds.add(event.event_id);
    if (this.seenIds.size > 1024)
      this.seenIds.delete(this.seenIds.values().next().value as string);
    this.store.routeEvent(event, this.callbacks.activeId());
    if (event.kind === "snapshot.invalidated") {
      if (
        event.payload.reason === "ring_truncated" &&
        event.resource.agent_id
      ) {
        // The store reconciles only this agent’s open window; unopened agents need no read.
      } else if (event.resource.agent_id) {
        if (!this.invalidation) this.agentOnlyInvalidation = true;
        this.invalidation = event.sequence;
        this.agentSnapshot();
      } else {
        this.invalidation = event.sequence;
        this.agentOnlyInvalidation = false;
        this.snapshotNow();
      }
    } else if (
      event.kind === "workspace.changed" &&
      this.callbacks.onWorkspaceChanged
    ) {
      this.callbacks.onWorkspaceChanged({
        kind: "workspace",
        cursor: event.cursor,
        change: event.payload as (HostChange & {
          kind: "workspace";
        })["change"],
      });
    } else if (
      [
        "process.changed",
        "agent.changed",
        "workspace.changed",
        "title.changed",
        "source.warning",
      ].includes(event.kind)
    ) {
      this.invalidation = event.sequence;
      this.agentOnlyInvalidation = false;
      this.snapshotNow();
    }
    const statusAgent =
      event.resource.agent_id ??
      (event.kind === "snapshot.invalidated"
        ? this.callbacks.activeId()
        : undefined);
    if (
      statusAgent &&
      (statusKinds.has(event.kind) || event.kind === "snapshot.invalidated")
    )
      if (event.kind === "process.notification")
        this.callbacks.onStatusChange(statusAgent, event.kind, event.payload);
      else this.callbacks.onStatusChange(statusAgent, event.kind);
  }
  /** Leading and trailing: the first write of a turn refreshes at once. */
  private agentSnapshot() {
    if (this.agentSnapshotTimer !== undefined) return;
    const wait = this.agentSnapshotAt + agentSnapshotInterval - Date.now();
    if (wait <= 0) return this.snapshotNow();
    this.agentSnapshotTimer = setTimeout(() => {
      this.agentSnapshotTimer = undefined;
      if (!this.stopped) this.snapshotNow();
    }, wait);
  }
  /** Any snapshot requested after an invalidation also answers it. */
  private snapshotNow() {
    clearTimeout(this.agentSnapshotTimer);
    this.agentSnapshotTimer = undefined;
    this.agentSnapshotAt = Date.now();
    this.callbacks.onSnapshotNeeded();
  }
  private acceptUnchangedLater() {
    if (this.timer !== undefined) return;
    const epoch = this.generation;
    this.timer = window.setTimeout(
      () => {
        this.timer = undefined;
        if (this.stopped || !this.recovering || epoch !== this.generation)
          return;
        this.recoverAt = this.sequence;
        this.callbacks.onSnapshotNeeded();
      },
      Math.min(3000 * ++this.failures, 30000),
    );
  }
  /** `at` is the snapshot sequence that proves the cause has passed. */
  private recover(at = this.sequence) {
    if (this.stopped || this.recovering) return;
    reconnectDiagnostic({ event: "recover" });
    this.recovering = true;
    this.recoverAt = at;
    this.source?.close();
    this.source = undefined;
    clearTimeout(this.connectTimer);
    ++this.generation;
    this.probe?.abort();
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.setOffline(true);
    this.store.markAllStale();
    this.callbacks.onSnapshotNeeded();
  }
  private connect() {
    if (this.stopped || this.recovering) return;
    clearTimeout(this.connectTimer);
    reconnectDiagnostic({
      event: "stream",
      path: "/api/v1/events",
      outcome: "connecting",
    });
    this.callbacks.onConnection?.("connecting");
    const epoch = ++this.generation;
    const source = new EventSource(
      `/api/v1/events?after=${encodeURIComponent(this.cursor)}`,
    );
    this.source = source;
    let opened = false;
    source.onopen = () => {
      if (this.stopped || epoch !== this.generation || this.source !== source)
        return;
      opened = true;
      this.openSource = source;
      clearTimeout(this.connectTimer);
      reconnectDiagnostic({
        event: "stream",
        path: "/api/v1/events",
        outcome: "open",
      });
      this.failures = 0;
      this.setOffline(false);
      this.callbacks.onConnection?.("online");
    };
    for (const kind of kinds)
      source.addEventListener(kind, (message) => {
        if (this.stopped || epoch !== this.generation) return;
        try {
          const frame = message as MessageEvent;
          const event = parseConversationEvent(frame.data);
          if (event.kind !== kind) throw new Error("mismatched SSE kind");
          this.route(event, frame.lastEventId);
        } catch {
          this.recover();
        }
      });
    source.onerror = () => {
      if (this.stopped || epoch !== this.generation || this.source !== source)
        return;
      clearTimeout(this.connectTimer);
      reconnectDiagnostic({
        event: "stream",
        path: "/api/v1/events",
        outcome: "error",
      });
      source.close();
      this.source = undefined;
      // A stream that had opened and then dropped is announced only once
      // the probe shows the host unreachable or refusing. A reconnect the
      // probe clears would otherwise flash the offline banner for one round
      // trip (on a slow relay, every time a proxy or an HTTP/2 hop ends an
      // idle stream). A stream that never opened is a failure at once: a
      // probe can succeed where the stream itself cannot get through.
      const unreachable = (
        reason = "Tapahtumayhteyttä ei saatu. Tarkista verkkoyhteys tai yritä uudelleen.",
      ) => {
        this.setOffline(true);
        this.callbacks.onConnection?.("failed", reason);
      };
      if (!opened) unreachable();
      const probe = new AbortController();
      this.probe = probe;
      const timeout = setTimeout(() => probe.abort(), 5000);
      void (async () => {
        try {
          const response = await reconnectFetch(
            "/api/v1/events",
            `/api/v1/events?after=${encodeURIComponent(this.cursor)}`,
            {
              credentials: "same-origin",
              cache: "no-store",
              signal: probe.signal,
            },
          );
          await response.body?.cancel();
          if (this.stopped || epoch !== this.generation) return;
          if (response.status === 401) {
            this.callbacks.onLogin();
            return;
          }
          if (response.status === 409) {
            this.recover(this.sequence + 1);
            return;
          }
          if (response.ok) {
            this.failures = 0;
            this.connect();
            return;
          }
          if (response.status === 403)
            unreachable("Palvelin ei sallinut tapahtumayhteyttä.");
          else if (response.status >= 500)
            unreachable(
              "Palvelimen tapahtumayhteys ei ole käytettävissä. Yritä uudelleen.",
            );
          else unreachable();
        } catch {
          // Offline, or the probe's own timeout; retry with the last
          // validated cursor.
          if (!this.stopped && epoch === this.generation) unreachable();
        } finally {
          clearTimeout(timeout);
          if (this.probe === probe) this.probe = undefined;
        }
        if (!this.stopped && epoch === this.generation)
          this.timer = window.setTimeout(
            () => {
              if (epoch === this.generation) this.connect();
            },
            Math.min(3000 * ++this.failures, 30000),
          );
      })();
    };
    // A proxy can leave EventSource CONNECTING without ever sending headers.
    this.connectTimer = setTimeout(() => {
      reconnectDiagnostic({
        event: "stream",
        path: "/api/v1/events",
        outcome: "timeout",
      });
      source.onerror?.(new Event("error"));
    }, 8000);
  }
  /**
   * Whether the event stream is open now and following the daemon. Then the
   * host is reachable and live facts keep arriving, so a failed snapshot read
   * is a failed read, not a lost connection.
   */
  live() {
    return (
      !this.stopped &&
      !this.recovering &&
      !!this.source &&
      this.source === this.openSource
    );
  }
  /** A definite HTTP failure ends recovery progress before its hang watchdog. */
  snapshotFailed() {
    if (this.stopped || !this.recovering) return;
    clearTimeout(this.connectTimer);
    this.callbacks.onConnection?.(
      "failed",
      "Palvelimen tilaa ei saatu tarkistettua. Yritä uudelleen.",
    );
  }
  private drop() {
    this.source?.close();
    this.source = undefined;
    clearTimeout(this.connectTimer);
    ++this.generation;
    this.probe?.abort();
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
  /**
   * The network returned or the machine woke: a stream that looks open may be
   * dead without an error. Reopen it now at the validated cursor.
   */
  revive() {
    if (this.stopped) return;
    reconnectDiagnostic({ event: "revive" });
    if (this.recovering) {
      this.callbacks.onSnapshotNeeded();
      return;
    }
    this.drop();
    this.connect();
  }
  /** Explicit reconnect bypasses transport backoff without rewinding the cursor. */
  retry() {
    if (this.stopped) {
      reconnectDiagnostic({ event: "retry-stopped" });
      return;
    }
    this.drop();
    if (this.recovering) {
      // The person asked now: the unchanged cursor needs no more waiting.
      this.recoverAt = Math.min(this.recoverAt, this.sequence);
      this.callbacks.onConnection?.("connecting");
      this.connectTimer = setTimeout(() => {
        if (!this.stopped)
          this.callbacks.onConnection?.(
            "failed",
            "Palvelimen tilaa ei saatu tarkistettua. Yritä uudelleen.",
          );
      }, 8000);
      this.callbacks.onSnapshotNeeded();
    } else this.connect();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.connectTimer);
    clearTimeout(this.agentSnapshotTimer);
    this.agentSnapshotTimer = undefined;
    ++this.generation;
    this.source?.close();
    this.source = undefined;
    this.probe?.abort();
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
