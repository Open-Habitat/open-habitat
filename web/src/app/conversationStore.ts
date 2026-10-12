import { useSyncExternalStore } from "react";
import {
  applyTurnEvent,
  type ConversationEvent,
  initialTurn,
  type LiveTurn,
  parseConversationEvent,
} from "./conversationEvents";
import { ConversationPager } from "./conversationPager";
import { status as readStatus, type Status } from "./conversations";
import type { HistoryEntry, HistoryPage } from "./history";
import type { Agent, Snapshot } from "./snapshot";

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
  loading: number | false;
  deferred: boolean; // cold controlled open waits for the status proof
  queued: ConversationEvent[];
};
export function unreadableHistory(
  agent: Agent,
  managed: boolean,
  status?: Status,
): boolean {
  if (agent.history === "corrupt") return true;
  if (agent.history !== "missing") return false;
  if (
    status?.native_history === "present" ||
    status?.native_history === "unavailable"
  )
    return false;
  // A controller has not yet written the first native entry in an empty chat.
  return !managed || !!status?.turn_settled;
}

type Metadata = Readonly<{
  agents: ReadonlyMap<string, Agent>;
  statuses: ReadonlyMap<string, Status>;
  staleStatuses: ReadonlySet<string>;
  historyReadFailures: ReadonlySet<string>;
  attention: ReadonlyMap<string, "new" | "seen">;
}>;

/** One tab's native read model. A missing window never implies an empty native history. */
export class ConversationStore {
  readonly identity: string;
  private readonly pager: ConversationPager;
  private windows = new Map<string, WindowRecord>();
  private positions = new Map<string, { key: string; offset: number }>();
  private metadata: Metadata = {
    agents: new Map(),
    statuses: new Map(),
    staleStatuses: new Set(),
    historyReadFailures: new Set(),
    attention: new Map(),
  };
  private metaListeners = new Set<() => void>();
  private attentionKeys = new Map<string, string>();
  private visibleId?: string;
  setVisible = (id?: string) => {
    this.visibleId = id;
    if (id && document.visibilityState === "visible") this.markSeen(id);
  };
  markSeen = (id: string) => {
    if (
      !this.metadata.attention.has(id) ||
      this.metadata.attention.get(id) === "seen"
    )
      return;
    this.metadata = {
      ...this.metadata,
      attention: new Map(this.metadata.attention).set(id, "seen"),
    };
    this.metaListeners.forEach((listener) => {
      listener();
    });
  };
  private markAttention(id: string, key: string) {
    if (this.attentionKeys.get(id) === key) return;
    this.attentionKeys.set(id, key);
    this.metadata = {
      ...this.metadata,
      attention: new Map(this.metadata.attention).set(
        id,
        this.visibleId === id && document.visibilityState === "visible"
          ? "seen"
          : "new",
      ),
    };
    this.metaListeners.forEach((listener) => {
      listener();
    });
  }
  private listeners = new Map<string, Set<() => void>>();
  private clock = 0;
  private readSeq = 0;
  private statusRequests = new Map<string, Promise<void>>();
  private statusVersions = new Map<string, number>();
  private epoch = 0;
  private snapshotCursor?: string;
  private routed?: { cursor: string; instance: string; sequence: number };
  private disposed = false;
  constructor(
    identity: string,
    pager: ConversationPager = new ConversationPager(),
    private readonly capacity = 50,
    private readonly statusReader: (id: string) => Promise<Status> = readStatus,
  ) {
    this.identity = identity;
    this.pager = pager;
  }
  readMetadata = (): Metadata => this.metadata;
  status = (id: string): Status | undefined => this.metadata.statuses.get(id);
  statusStale = (id: string): boolean => this.metadata.staleStatuses.has(id);
  position = (id: string) => this.positions.get(id);
  savePosition = (id: string, value?: { key: string; offset: number }) => {
    if (value) this.positions.set(id, value);
    else this.positions.delete(id);
  };
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
  private seedLive(cursor: string, tail: Agent["live_tail"]): LiveTurn {
    let live = initialTurn(
      cursor,
      tail.map((e) => parseConversationEvent(JSON.stringify(e))),
    );
    if (
      this.routed?.instance === live.instance &&
      this.routed.sequence > live.sequence
    )
      live = { ...live, ...this.routed, fragments: [], truncated: true };
    return live;
  }
  applySnapshot(snapshot: Snapshot) {
    if (this.disposed || snapshot.identity.web_identity_id !== this.identity)
      return;
    const restarted =
      !!this.snapshotCursor &&
      this.snapshotCursor.split(":")[1] !== snapshot.event_cursor.split(":")[1];
    this.snapshotCursor = snapshot.event_cursor;
    const cursor = snapshot.event_cursor;
    if (
      [...this.windows.values()].some(
        (record) =>
          record.value.live &&
          !cursor.startsWith(`ev1:${record.value.live.instance}:`),
      )
    ) {
      ++this.epoch;
      this.pager.cancelAll();
      for (const record of this.windows.values()) {
        record.loading = false;
        record.queued = [];
      }
    }
    for (const [id, record] of this.windows) {
      if (
        record.value.live &&
        !cursor.startsWith(`ev1:${record.value.live.instance}:`)
      ) {
        try {
          const agent = snapshot.agents.find((a) => a.agent_id === id);
          const live = this.seedLive(cursor, agent?.live_tail ?? []);
          this.publish(id, {
            ...record.value,
            live,
            state: record.value.entries.length ? "stale" : record.value.state,
          });
          if (record.value.entries.length) void this.reconnect(id);
          else if (record.value.state === "loading" && !record.deferred)
            void this.loadTail(id);
        } catch {
          this.markStale(id);
        }
      }
    }
    // An unwritten history for an open, empty controller is not a read failure.
    for (const agent of snapshot.agents) {
      const previous = this.metadata.agents.get(agent.agent_id);
      // Without the controller catalog, a first missing observation is
      // ambiguous. A readable history disappearing is not.
      const failed =
        agent.history === "corrupt" ||
        (agent.history === "missing" &&
          (previous?.history === "readable" ||
            !!this.metadata.statuses.get(agent.agent_id)?.turn_settled));
      if (failed) {
        if (
          !previous ||
          previous.history !== agent.history ||
          !this.attentionKeys.get(agent.agent_id)?.startsWith("history:")
        )
          this.markAttention(agent.agent_id, `history:${agent.history}`);
      } else if (
        this.attentionKeys.get(agent.agent_id)?.startsWith("history:")
      ) {
        this.attentionKeys.delete(agent.agent_id);
        const attention = new Map(this.metadata.attention);
        attention.delete(agent.agent_id);
        this.metadata = { ...this.metadata, attention };
      }
    }
    this.metadata = {
      ...this.metadata,
      agents: new Map(snapshot.agents.map((agent) => [agent.agent_id, agent])),
    };
    this.metaListeners.forEach((listener) => {
      listener();
    });
    if (restarted)
      for (const id of this.metadata.statuses.keys()) this.notifyStatus(id);
    for (const agent of snapshot.agents) {
      const record = this.windows.get(agent.agent_id);
      if (record && !record.value.live) {
        try {
          const live = this.seedLive(snapshot.event_cursor, agent.live_tail);
          this.publish(agent.agent_id, { ...record.value, live });
        } catch {
          this.markStale(agent.agent_id);
        }
      }
    }
  }
  applyStatus(id: string, status: Status) {
    if (this.disposed || status.agent_id !== id) return;
    this.statusVersions.set(id, (this.statusVersions.get(id) ?? 0) + 1);
    if (status.pending_question)
      this.markAttention(id, `question:${status.pending_question.request_id}`);
    this.metadata = {
      ...this.metadata,
      statuses: new Map(this.metadata.statuses).set(id, status),
      staleStatuses: new Set(
        [...this.metadata.staleStatuses].filter((key) => key !== id),
      ),
    };
    this.metaListeners.forEach((listener) => {
      listener();
    });
    this.listeners.get(id)?.forEach((listener) => {
      listener();
    });
  }
  view(id: string, confirmedMissing = false, deferLoad = false): WindowView {
    if (this.disposed) throw new Error("disposed store");
    let record = this.windows.get(id);
    if (!record) {
      const agent = this.metadata.agents.get(id);
      let live: LiveTurn | undefined;
      try {
        if (agent && this.snapshotCursor)
          live = this.seedLive(this.snapshotCursor, agent.live_tail);
      } catch {
        /* A stale snapshot is recovered by the event router. */
      }
      record = {
        value: {
          entries: [],
          state: confirmedMissing ? "empty" : "loading",
          live,
        },
        used: 0,
        loading: false,
        deferred: deferLoad,
        queued: [],
      };
      this.windows.set(id, record);
      if (!confirmedMissing && !deferLoad) void this.loadTail(id);
    }
    if (!deferLoad) record.deferred = false;
    if (
      confirmedMissing &&
      !record.value.entries.length &&
      record.value.state !== "empty"
    )
      this.confirmMissing(id);
    else if (!deferLoad && record.value.state === "loading" && !record.loading)
      void this.loadTail(id);
    record.used = ++this.clock;
    if (this.windows.size > this.capacity) {
      const oldest = [...this.windows]
        .filter(([key]) => key !== id)
        .sort((a, b) => a[1].used - b[1].used)[0];
      if (oldest) {
        this.windows.delete(oldest[0]);
        this.positions.delete(oldest[0]);
      }
    }
    return record.value;
  }
  async loadTail(id: string, missing = false): Promise<void> {
    const record = this.windows.get(id);
    if (!record || record.loading) return;
    record.loading = ++this.readSeq;
    const read = record.loading;
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
      if (
        (error as Error).message === "history_missing" &&
        (missing || record.value.state === "empty")
      )
        this.publish(id, {
          ...record.value,
          entries: [],
          next: undefined,
          state: "empty",
        });
      else {
        this.noteHistoryRead(id, true);
        this.publish(id, {
          ...record.value,
          state: record.value.entries.length ? "stale" : "error",
        });
      }
    } finally {
      if (record.loading === read) this.releaseQueued(record);
    }
  }
  /** The caller must confirm a missing native history, not infer it from a 404 alone. */
  confirmMissing(id: string) {
    const record = this.windows.get(id);
    if (record) {
      record.deferred = false;
      this.publish(id, {
        ...record.value,
        entries: [],
        next: undefined,
        state: "empty",
      });
    }
  }
  async older(id: string): Promise<void> {
    const record = this.windows.get(id);
    const cursor = record?.value.next;
    if (!record || !cursor || record.loading) return;
    record.loading = ++this.readSeq;
    const read = record.loading;
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
      if (this.epoch === epoch && this.windows.get(id) === record)
        this.markStale(id);
    } finally {
      if (record.loading === read) this.releaseQueued(record);
    }
  }
  async reconnect(id: string, maxPages = 8): Promise<void> {
    const record = this.windows.get(id);
    if (!record || record.loading) return;
    record.loading = ++this.readSeq;
    const read = record.loading;
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
      // Keep one owner until every page is joined. Events wait for the complete range.
      if (!met) this.applyPage(id, pages[0], "tail", false);
      else
        for (const page of [...pages].reverse()) {
          this.applyPage(id, page, "reconnect", false);
          if (record.value.state === "stale" || record.value.state === "error")
            break;
        }
      if (record.loading === read) this.releaseQueued(record);
    } catch {
      if (this.epoch === epoch && this.windows.get(id) === record) {
        this.noteHistoryRead(id, true);
        this.markStale(id);
      }
    } finally {
      if (record.loading === read) this.releaseQueued(record);
    }
  }
  applyPage(
    id: string,
    page: HistoryPage,
    mode: "tail" | "older" | "reconnect" = "tail",
    flush = true,
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
      shared.every((index, i) => i === 0 || index === shared[i - 1] + 1) &&
      incoming.filter((e) => known.has(e.entry_key)).length ===
        incoming.slice(
          incoming.findIndex((e) => known.has(e.entry_key)),
          incoming.findLastIndex((e) => known.has(e.entry_key)) + 1,
        ).length;
    // An older page must contain the boundary as its last entry. Never join guesses.
    const validOlder =
      mode !== "older" ||
      (old.entries.length > 0 &&
        incoming.at(-1)?.entry_key === old.entries[0].entry_key);
    if (mode === "older" && !validOlder) {
      this.markStale(id);
      record.loading = false;
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
    // A cached settlement from an earlier turn cannot supersede newer live
    // fragments while its status is awaiting a fresh observation.
    const settledKey = this.statusStale(id)
      ? undefined
      : this.metadata.statuses.get(id)?.turn_settled?.native_key;
    const live =
      old.live &&
      settledKey &&
      incoming.some((entry) => entry.entry_key === settledKey)
        ? { ...old.live, fragments: [], truncated: false }
        : old.live;
    this.noteHistoryRead(id, false);
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
    if (flush) this.releaseQueued(record);
  }
  private noteHistoryRead(id: string, failed: boolean) {
    if (this.metadata.historyReadFailures.has(id) === failed) return;
    const historyReadFailures = new Set(this.metadata.historyReadFailures);
    if (failed) historyReadFailures.add(id);
    else historyReadFailures.delete(id);
    this.metadata = { ...this.metadata, historyReadFailures };
    this.metaListeners.forEach((listener) => {
      listener();
    });
  }
  private releaseQueued(record: WindowRecord) {
    record.loading = false;
    const queued = record.queued.splice(0);
    const id = [...this.windows].find(([, value]) => value === record)?.[0];
    if (id) for (const event of queued) this.advanceWindow(id, record, event);
  }
  setLive(id: string, live: LiveTurn) {
    const record = this.windows.get(id);
    if (record) this.publish(id, { ...record.value, live });
  }
  private notifyStatus(id: string) {
    if (!this.metadata.statuses.has(id)) return;
    const version = (this.statusVersions.get(id) ?? 0) + 1;
    this.statusVersions.set(id, version);
    if (!this.metadata.staleStatuses.has(id)) {
      this.metadata = {
        ...this.metadata,
        staleStatuses: new Set(this.metadata.staleStatuses).add(id),
      };
      this.metaListeners.forEach((listener) => {
        listener();
      });
    }
    if (this.statusRequests.has(id)) return;
    const epoch = this.epoch;
    const fetchStatus = async () => {
      try {
        const value = await this.statusReader(id);
        if (this.disposed || this.epoch !== epoch) return;
        if (this.statusVersions.get(id) !== version) {
          // A notification crossed the read. Take one fresh observation.
          this.statusRequests.delete(id);
          this.notifyStatus(id);
          return;
        }
        this.applyStatus(id, value);
      } catch {
        // Keep the cached status explicitly stale; an explicit check can retry.
      } finally {
        if (this.statusRequests.get(id) === request)
          this.statusRequests.delete(id);
      }
    };
    const request = fetchStatus();
    this.statusRequests.set(id, request);
  }
  routeEvent(event: ConversationEvent, activeId?: string) {
    if (this.disposed) return;
    if (
      event.resource.agent_id &&
      (event.kind === "question.resolved" ||
        (event.kind === "command.changed" && event.payload.state === "pending"))
    ) {
      const id = event.resource.agent_id;
      this.attentionKeys.delete(id);
      if (this.metadata.attention.has(id)) {
        const attention = new Map(this.metadata.attention);
        attention.delete(id);
        this.metadata = { ...this.metadata, attention };
        this.metaListeners.forEach((listener) => {
          listener();
        });
      }
    }
    if (event.resource.agent_id && event.kind === "question.requested")
      this.markAttention(
        event.resource.agent_id,
        `question:${event.payload.request_id}`,
      );
    else if (event.resource.agent_id && event.kind === "turn.settled")
      this.markAttention(event.resource.agent_id, event.event_id);
    if (event.kind === "snapshot.invalidated" && !event.resource.agent_id)
      for (const id of this.metadata.statuses.keys())
        if (id !== activeId) this.notifyStatus(id);
    if (
      event.resource.agent_id &&
      event.kind === "command.changed" &&
      event.payload.state === "pending"
    )
      this.notifyStatus(event.resource.agent_id);
    else if (
      event.resource.agent_id &&
      event.resource.agent_id !== activeId &&
      [
        "turn.settled",
        "snapshot.invalidated",
        "command.changed",
        "queue.changed",
        "question.requested",
        "question.resolved",
      ].includes(event.kind)
    )
      this.notifyStatus(event.resource.agent_id);
    if (
      !this.routed ||
      this.routed.instance !== event.server_instance_id ||
      event.sequence > this.routed.sequence
    )
      this.routed = {
        cursor: event.cursor,
        instance: event.server_instance_id,
        sequence: event.sequence,
      };
    for (const [id, record] of this.windows)
      this.advanceWindow(id, record, event);
  }
  private advanceWindow(
    id: string,
    record: WindowRecord,
    event: ConversationEvent,
  ) {
    if (!record.value.live) return;
    if (
      record.value.live.instance === event.server_instance_id &&
      record.value.live.sequence >= event.sequence
    )
      return;
    if (id === event.resource.agent_id) {
      this.applyEvent(event);
      return;
    }
    if (record.loading) {
      record.queued.push(event);
      return;
    }
    const result = applyTurnEvent(record.value.live, event, id);
    if (
      result.recover &&
      event.kind === "snapshot.invalidated" &&
      event.payload.reason !== "ring_truncated"
    )
      this.publish(id, {
        ...record.value,
        live: result.turn,
        state: record.value.entries.length ? "stale" : record.value.state,
      });
    else if (result.recover) this.recoverWindow(id, record, event);
    else this.publish(id, { ...record.value, live: result.turn });
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
    if (
      result.recover &&
      event.kind === "snapshot.invalidated" &&
      event.payload.reason !== "ring_truncated"
    ) {
      this.publish(id, {
        ...record.value,
        live: result.turn,
        state: record.value.entries.length ? "stale" : record.value.state,
      });
      return;
    }
    if (result.recover) {
      this.recoverWindow(id, record, event);
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
      this.publish(id, {
        ...old,
        entries,
        state: old.state === "loading" ? "loading" : "ready",
        live: result.turn,
      });
    } else {
      const turn =
        event.kind === "command.changed" && event.payload.state === "pending"
          ? { ...result.turn, fragments: [], truncated: false }
          : result.turn;
      this.publish(id, { ...record.value, live: turn });
    }
  }
  private recoverWindow(
    id: string,
    record: WindowRecord,
    event: ConversationEvent,
  ) {
    this.publish(id, {
      ...record.value,
      live: {
        cursor: event.cursor,
        instance: event.server_instance_id,
        sequence: event.sequence,
        fragments: [],
        truncated: true,
      },
      state: record.value.entries.length ? "stale" : "error",
    });
    if (!record.loading) void this.reconnect(id);
  }
  reseed(snapshot: Snapshot, activeId?: string) {
    if (this.disposed || snapshot.identity.web_identity_id !== this.identity)
      return;
    ++this.epoch;
    this.pager.cancelAll();
    this.snapshotCursor = snapshot.event_cursor;
    this.routed = undefined;
    for (const id of this.metadata.statuses.keys())
      if (id !== activeId) this.notifyStatus(id);
    for (const [id, record] of this.windows) {
      record.queued = [];
      record.loading = false;
      try {
        const agent = snapshot.agents.find((a) => a.agent_id === id);
        const live = initialTurn(
          snapshot.event_cursor,
          agent?.live_tail.map((e) =>
            parseConversationEvent(JSON.stringify(e)),
          ) ?? [],
        );
        this.publish(id, {
          ...record.value,
          live,
          state: record.value.entries.length ? "stale" : record.value.state,
        });
        if (record.value.entries.length) void this.reconnect(id);
        else if (record.value.state === "loading" && !record.deferred)
          void this.loadTail(id);
      } catch {
        this.markStale(id);
      }
    }
  }
  reconcileStale() {
    // A read begun before the authoritative snapshot must not turn a stale
    // window back into a ready one after reconciliation has been scheduled.
    ++this.epoch;
    this.pager.cancelAll();
    for (const [id, record] of this.windows) {
      const stale =
        record.value.state === "stale" || record.value.state === "error";
      if (record.loading) this.releaseQueued(record);
      if (record.deferred) continue;
      if (record.value.state === "loading") void this.loadTail(id);
      else if (
        stale ||
        record.value.state === "stale" ||
        record.value.state === "error"
      ) {
        this.markStale(id);
        void this.reconnect(id);
      }
    }
  }
  markAllStale() {
    for (const id of this.windows.keys()) this.markStale(id);
  }
  markStale(id: string) {
    const record = this.windows.get(id);
    if (record?.deferred) return; // Status must first prove whether history exists.
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
    this.positions.clear();
    this.attentionKeys.clear();
    this.visibleId = undefined;
    this.routed = undefined;
    this.metadata = {
      agents: new Map(),
      statuses: new Map(),
      staleStatuses: new Set(),
      historyReadFailures: new Set(),
      attention: new Map(),
    };
    this.statusRequests.clear();
    this.statusVersions.clear();
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
const emptyMetadata: Metadata = {
  agents: new Map(),
  statuses: new Map(),
  staleStatuses: new Set(),
  historyReadFailures: new Set(),
  attention: new Map(),
};
const noSubscribe = () => () => {};
const readEmpty = () => emptyMetadata;
export function useConversationMetadata(store?: ConversationStore) {
  return useSyncExternalStore(
    store?.subscribeMetadata ?? noSubscribe,
    store?.readMetadata ?? readEmpty,
  );
}
