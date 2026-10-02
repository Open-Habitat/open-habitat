import {
  parseConversationEvent,
  type ConversationEvent,
} from "./conversationEvents";
import type { ConversationStore } from "./conversationStore";
import type { Snapshot } from "./snapshot";

const kinds = [
  "snapshot.invalidated",
  "history.entry",
  "assistant.delta",
  "tool.started",
  "tool.updated",
  "tool.finished",
  "queue.changed",
  "turn.settled",
  "command.changed",
  "agent.changed",
  "workspace.changed",
  "title.changed",
  "source.warning",
  "question.requested",
  "question.resolved",
  "operation.changed",
  "unknown.native",
];
const statusKinds = new Set([
  "turn.settled",
  "command.changed",
  "queue.changed",
  "question.requested",
  "question.resolved",
]);
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
  private timer?: number;
  private probe?: AbortController;
  private generation = 0;
  private stopped = true;
  private recovering = false;
  private failures = 0;
  private invalidation = 0;
  private offline = false;
  constructor(
    private readonly store: ConversationStore,
    private readonly callbacks: {
      onSnapshotNeeded: () => void;
      onStatusChange: (id: string, kind: string) => void;
      activeId: () => string | undefined;
      onLogin: () => void;
      onOffline: (offline: boolean) => void;
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
    if (this.recovering) {
      // An in-flight snapshot from before the gap is not a recovery point.
      // Replaying it would loop on the same malformed/missing event.
      if (next.instance === this.instance && next.sequence <= this.sequence) {
        this.callbacks.onSnapshotNeeded();
        return;
      }
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
      ++this.generation;
      this.store.reseed(snapshot);
      this.reset(snapshot);
      this.connect();
    }
    this.store.applySnapshot(snapshot);
    // A stale snapshot taken before an invalidation cannot discharge it.
    if (next.instance === this.instance && next.sequence < this.invalidation)
      this.callbacks.onSnapshotNeeded();
    else {
      if (this.invalidation) this.store.reconcileStale();
      this.invalidation = 0;
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
      return this.recover();
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
      } else {
        this.invalidation = event.sequence;
        this.callbacks.onSnapshotNeeded();
      }
    } else if (
      [
        "agent.changed",
        "workspace.changed",
        "title.changed",
        "source.warning",
      ].includes(event.kind)
    ) {
      this.invalidation = event.sequence;
      this.callbacks.onSnapshotNeeded();
    }
    if (event.resource.agent_id && statusKinds.has(event.kind))
      this.callbacks.onStatusChange(event.resource.agent_id, event.kind);
  }
  private recover() {
    if (this.stopped || this.recovering) return;
    this.recovering = true;
    this.source?.close();
    this.source = undefined;
    ++this.generation;
    this.probe?.abort();
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.setOffline(true);
    this.store.markAllStale();
    this.callbacks.onSnapshotNeeded();
  }
  private connect() {
    if (this.stopped || this.recovering) return;
    const epoch = ++this.generation;
    const source = new EventSource(
      `/api/v1/events?after=${encodeURIComponent(this.cursor)}`,
    );
    this.source = source;
    source.onopen = () => {
      if (this.stopped || epoch !== this.generation) return;
      this.failures = 0;
      this.setOffline(false);
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
      if (this.stopped || epoch !== this.generation) return;
      source.close();
      this.source = undefined;
      this.setOffline(true);
      const probe = new AbortController();
      this.probe = probe;
      const timeout = setTimeout(() => probe.abort(), 5000);
      void (async () => {
        try {
          const response = await fetch(
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
            this.recover();
            return;
          }
        } catch {
          /* offline: retry with the last validated cursor */
        } finally {
          clearTimeout(timeout);
          if (this.probe === probe) this.probe = undefined;
        }
        if (!this.stopped && epoch === this.generation)
          this.timer = window.setTimeout(
            () => this.connect(),
            Math.min(3000 * ++this.failures, 30000),
          );
      })();
    };
  }
  stop() {
    this.stopped = true;
    ++this.generation;
    this.source?.close();
    this.source = undefined;
    this.probe?.abort();
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
