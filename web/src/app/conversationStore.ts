import { useSyncExternalStore } from "react";
import {
  applyTurnEvent,
  initialTurn,
  parseConversationEvent,
  type ConversationEvent,
  type LiveTurn,
} from "./conversationEvents";
import { type ConversationPager, conversationPager } from "./conversationPager";
import type { HistoryEntry, HistoryPage } from "./history";
import type { Agent, Snapshot } from "./snapshot";
import type { Status } from "./conversations";

export type WindowView = Readonly<{
  entries: HistoryEntry[];
  next?: string;
  revision?: string;
  state: "loading" | "ready" | "empty" | "stale" | "error";
  live?: LiveTurn;
}>;
type WindowRecord = {
  value: WindowView;
  used: number;
  loading: boolean;
  queued: ConversationEvent[];
};
type Metadata = Readonly<{
  agents: ReadonlyMap<string, Agent>;
  statuses: ReadonlyMap<string, Status>;
}>;

/** One tab's native read model. A missing window never implies an empty native history. */
export class ConversationStore {
  readonly identity: string;
  private readonly pager: ConversationPager;
  private windows = new Map<string, WindowRecord>();
  private metadata: Metadata = { agents: new Map(), statuses: new Map() };
  private metaListeners = new Set<() => void>();
  private listeners = new Map<string, Set<() => void>>();
  private clock = 0;
  private epoch = 0;
  private snapshotCursor?: string;
  private disposed = false;
  constructor(
    identity: string,
    pager: ConversationPager = conversationPager,
    private readonly capacity = 50,
  ) {
    this.identity = identity;
    this.pager = pager;
  }
  readMetadata = (): Metadata => this.metadata;
  subscribeMetadata = (listener: () => void) => {
    this.metaListeners.add(listener);
    return () => {
      this.metaListeners.delete(listener);
    };
  };
  read = (id: string): WindowView | undefined => this.windows.get(id)?.value;
  subscribe = (id: string, listener: () => void) => {
    let group = this.listeners.get(id);
    if (!group) {
      group = new Set();
      this.listeners.set(id, group);
    }
    group.add(listener);
    return () => {
      group.delete(listener);
      if (!group.size) this.listeners.delete(id);
    };
  };
  private publish(id: string, value: WindowView) {
    const record = this.windows.get(id);
    if (!record || this.disposed) return;
    record.value = value;
    this.listeners.get(id)?.forEach((listener) => {
      listener();
    });
  }
  applySnapshot(snapshot: Snapshot) {
    if (this.disposed || snapshot.identity.web_identity_id !== this.identity)
      return;
    this.snapshotCursor = snapshot.event_cursor;
    this.metadata = {
      ...this.metadata,
      agents: new Map(snapshot.agents.map((agent) => [agent.agent_id, agent])),
    };
    this.metaListeners.forEach((listener) => {
      listener();
    });
    for (const agent of snapshot.agents) {
      const record = this.windows.get(agent.agent_id);
      if (record && !record.value.live) {
        try {
          const live = initialTurn(
            snapshot.event_cursor,
            agent.live_tail.map((e) =>
              parseConversationEvent(JSON.stringify(e)),
            ),
          );
          this.publish(agent.agent_id, { ...record.value, live });
        } catch {
          this.markStale(agent.agent_id);
        }
      }
    }
  }
  applyStatus(id: string, status: Status) {
    if (this.disposed || status.agent_id !== id) return;
    this.metadata = {
      ...this.metadata,
      statuses: new Map(this.metadata.statuses).set(id, status),
    };
    this.metaListeners.forEach((listener) => {
      listener();
    });
    this.listeners.get(id)?.forEach((listener) => {
      listener();
    });
  }
  view(id: string): WindowView {
    if (this.disposed) throw new Error("disposed store");
    let record = this.windows.get(id);
    if (!record) {
      const agent = this.metadata.agents.get(id);
      let live: LiveTurn | undefined;
      try {
        if (agent && this.snapshotCursor)
          live = initialTurn(
            this.snapshotCursor,
            agent.live_tail.map((e) =>
              parseConversationEvent(JSON.stringify(e)),
            ),
          );
      } catch {
        /* A stale snapshot is recovered by the event router. */
      }
      record = {
        value: { entries: [], state: "loading", live },
        used: 0,
        loading: false,
        queued: [],
      };
      this.windows.set(id, record);
      this.loadTail(id);
    }
    record.used = ++this.clock;
    if (this.windows.size > this.capacity) {
      const oldest = [...this.windows]
        .filter(([key]) => key !== id)
        .sort((a, b) => a[1].used - b[1].used)[0];
      if (oldest) this.windows.delete(oldest[0]);
    }
    return record.value;
  }
  async loadTail(id: string, missing = false): Promise<void> {
    const record = this.windows.get(id);
    if (!record || record.loading) return;
    record.loading = true;
    const epoch = this.epoch;
    try {
      const page = await this.pager.tail(id);
      if (
        this.disposed ||
        this.epoch !== epoch ||
        this.windows.get(id) !== record
      )
        return;
      this.applyPage(id, page, "tail");
    } catch (error) {
      if (
        this.disposed ||
        this.epoch !== epoch ||
        this.windows.get(id) !== record
      )
        return;
      if ((error as Error).message === "history_missing" && missing)
        this.publish(id, {
          ...record.value,
          entries: [],
          next: undefined,
          state: "empty",
        });
      else
        this.publish(id, {
          ...record.value,
          state: record.value.entries.length ? "stale" : "error",
        });
    } finally {
      record.loading = false;
    }
  }
  /** The caller must confirm a missing native history, not infer it from a 404 alone. */
  confirmMissing(id: string) {
    const record = this.windows.get(id);
    if (record)
      this.publish(id, {
        ...record.value,
        entries: [],
        next: undefined,
        state: "empty",
      });
  }
  async older(id: string): Promise<void> {
    const record = this.windows.get(id);
    const cursor = record?.value.next;
    if (!record || !cursor || record.loading) return;
    record.loading = true;
    const epoch = this.epoch;
    try {
      const page = await this.pager.older(id, cursor);
      if (
        this.disposed ||
        this.epoch !== epoch ||
        this.windows.get(id) !== record
      )
        return;
      this.applyPage(
        id,
        page,
        page.entries.some((entry) => entry.entry_key === cursor)
          ? "older"
          : "tail",
      );
    } catch {
      if (this.windows.get(id) === record) this.markStale(id);
    } finally {
      record.loading = false;
    }
  }
  async reconnect(id: string, maxPages = 8): Promise<void> {
    const record = this.windows.get(id);
    if (!record || record.loading) return;
    record.loading = true;
    const epoch = this.epoch;
    try {
      const { pages, met } = await this.pager.reconnect(
        id,
        new Set(record.value.entries.map((e) => e.entry_key)),
        maxPages,
      );
      if (
        this.disposed ||
        this.epoch !== epoch ||
        this.windows.get(id) !== record
      )
        return;
      // The pager returns newest first; contiguous pages are applied oldest first.
      if (!met) this.applyPage(id, pages[0], "tail");
      else
        for (const page of [...pages].reverse())
          this.applyPage(id, page, "reconnect");
    } catch {
      if (this.windows.get(id) === record) this.markStale(id);
    } finally {
      record.loading = false;
    }
  }
  applyPage(
    id: string,
    page: HistoryPage,
    mode: "tail" | "older" | "reconnect" = "tail",
  ) {
    const record = this.windows.get(id);
    if (!record || this.disposed || page.agent_id !== id) return;
    const old = record.value;
    const incoming = page.entries;
    const known = new Map(
      old.entries.map((entry, index) => [entry.entry_key, index]),
    );
    const shared = incoming
      .map((entry) => known.get(entry.entry_key))
      .filter((index): index is number => index !== undefined);
    const ordered = shared.every(
      (index, i) => i === 0 || index > shared[i - 1],
    );
    const contiguous =
      shared.length > 0 &&
      ordered &&
      shared.every((index, i) => i === 0 || index === shared[i - 1] + 1);
    // An older page must contain the boundary as its last entry. Never join guesses.
    const validOlder =
      mode !== "older" ||
      (old.entries.length > 0 &&
        incoming.at(-1)?.entry_key === old.entries[0].entry_key);
    if (mode === "older" && !validOlder) {
      this.markStale(id);
      void this.loadTail(id);
      return;
    }
    let entries: HistoryEntry[];
    if (contiguous && validOlder) {
      const first = shared[0];
      entries = [
        ...old.entries.slice(0, first),
        ...incoming,
        ...old.entries.slice(shared[shared.length - 1] + 1),
      ];
    } else if (
      mode === "older" ||
      (mode === "reconnect" && old.entries.length) ||
      (shared.length > 0 && !ordered)
    ) {
      this.markStale(id);
      return;
    } else entries = [...incoming];
    const seen = new Set<string>();
    entries = entries.filter((entry) => {
      if (seen.has(entry.entry_key)) return false;
      seen.add(entry.entry_key);
      return true;
    });
    const next =
      mode === "older" || !contiguous
        ? page.next_before
        : (old.next ?? page.next_before);
    const settledKey = this.metadata.statuses.get(id)?.turn_settled?.native_key;
    const live =
      old.live &&
      settledKey &&
      incoming.some((entry) => entry.entry_key === settledKey)
        ? { ...old.live, fragments: [], truncated: false }
        : old.live;
    this.publish(id, {
      entries,
      next:
        page.older_complete && (mode === "older" || !contiguous)
          ? undefined
          : next,
      revision: page.native_revision,
      state: entries.length ? "ready" : "empty",
      live,
    });
    record.loading = false;
    const queued = record.queued.splice(0);
    for (const event of queued) this.applyEvent(event);
  }
  applyEvent(event: ConversationEvent) {
    if (this.disposed) return;
    const id = event.resource.agent_id;
    if (!id) return;
    const record = this.windows.get(id);
    if (!record) return;
    if (record.loading) {
      record.queued.push(event);
      return;
    }
    const live = record.value.live;
    if (!live) {
      this.markStale(id);
      return;
    }
    const result = applyTurnEvent(live, event, id);
    if (result.recover) {
      this.markStale(id);
      void this.reconnect(id);
      return;
    }
    if (result.entry) {
      const old = record.value;
      const index = old.entries.findIndex(
        (e) => e.entry_key === result.entry?.entry_key,
      );
      const entries =
        index >= 0
          ? old.entries.map((e, i) =>
              i === index ? (result.entry as HistoryEntry) : e,
            )
          : [...old.entries, result.entry];
      this.publish(id, { ...old, entries, state: "ready", live: result.turn });
    } else {
      const turn =
        event.kind === "command.changed" && event.payload.state === "pending"
          ? { ...result.turn, fragments: [], truncated: false }
          : result.turn;
      this.publish(id, { ...record.value, live: turn });
    }
  }
  markStale(id: string) {
    const record = this.windows.get(id);
    if (record)
      this.publish(id, {
        ...record.value,
        state: record.value.entries.length ? "stale" : "error",
      });
  }
  dispose() {
    this.disposed = true;
    ++this.epoch;
    this.pager.cancelAll();
    this.windows.clear();
    this.metadata = { agents: new Map(), statuses: new Map() };
    this.metaListeners.forEach((listener) => {
      listener();
    });
    this.listeners.forEach((group) => {
      group.forEach((listener) => {
        listener();
      });
    });
  }
}
export function useWindow(store: ConversationStore, id: string) {
  return useSyncExternalStore(
    (listener) => store.subscribe(id, listener),
    () => store.read(id),
  );
}
export function useConversationMetadata(store: ConversationStore) {
  return useSyncExternalStore(store.subscribeMetadata, store.readMetadata);
}
