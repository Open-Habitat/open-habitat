import { useSyncExternalStore } from "react";
import type { AgentNotice } from "../components/AgentNotice";
import { readStartPage, type StartPage } from "./composerReads";
import {
  applyTurnEvent,
  type ConversationEvent,
  commandOutput,
  cursorParts,
  initialTurn,
  keptAfterAnswer,
  type LiveTurn,
  parseConversationEvent,
  retireEndedTurns,
} from "./conversationEvents";
import { ConversationPager } from "./conversationPager";
import { status as readStatus, type Status } from "./conversations";
import type { HistoryEntry, HistoryPage } from "./history";
import {
  type RepliesSeen,
  readRepliesSeen,
  repliesSeenKey,
  writeRepliesSeen,
} from "./replySeen";
import type { Agent, Snapshot } from "./snapshot";

export type WindowView = Readonly<{
  entries: HistoryEntry[];
  cutOff?: boolean;
  /** The last read was refused because a full storage quota cut a record
   * of the native history: no re-read will change that. */
  historyCut?: boolean;
  next?: string;
  revision?: string;
  state: "loading" | "ready" | "empty" | "stale" | "error";
  live?: LiveTurn;
}>;
type WindowRecord = {
  value: WindowView;
  startPage?: { read: Promise<StartPage | null>; abort: AbortController };
  used: number;
  loading: number | false;
  deferred: boolean; // cold controlled open waits for the status proof
  // Streamed native entries win over pages captured before they arrived.
  readEntries: Map<string, { entry: HistoryEntry; appended: boolean }>;
  readAgain?: boolean;
  // Native history changed under a contiguous stream: one quiet read is owed
  // after the snapshot that answers the invalidation.
  sourceChanged?: boolean;
  // The newest read begun before this window's events were missed. Only a
  // later read can show the native entries the missed events carried.
  missedBefore?: number;
  // How far the stream had come when the current newest-page read began.
  readFrom?: { instance: string; sequence: number };
  // The read (readSeq) whose newest page the window last joined, and the
  // status version (statusVersions) current when that read began.
  newestRead?: number;
  newestReadStatus?: number;
  readStatus?: number;
};
const streamPosition = (live?: LiveTurn) =>
  live && { instance: live.instance, sequence: live.sequence };
// Status proved the native history unwritten and nothing has arrived since.
const confirmedEmpty = (record: WindowRecord) =>
  record.value.state === "empty" && !record.value.entries.length;
// Shown content may be out of date; with nothing shown, the read failed.
const unsettled = (record: WindowRecord): WindowView["state"] =>
  record.value.entries.length ? "stale" : "error";
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

export type ConversationMetadata = Metadata;
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
  private notices = new Map<string, AgentNotice[]>();
  readNotices = (id: string) => this.notices.get(id) ?? emptyNotices;
  private reconcileNotices(id: string, notices: AgentNotice[]) {
    const current = this.readNotices(id);
    if (!current.length || !notices.length) return;
    const persisted = new Set(notices.map((n) => n.notice_id));
    const remaining = current.filter((n) => !persisted.has(n.notice_id));
    if (remaining.length === current.length) return;
    this.notices.set(id, remaining);
    this.metaListeners.forEach((listener) => {
      listener();
    });
  }
  private readonly pager: ConversationPager;
  private windows = new Map<string, WindowRecord>();
  private positions = new Map<string, { key: string; offset: number }>();
  private toolExpansions = new Map<string, Map<string, boolean>>();
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
    this.rememberReply(id);
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
    const shown =
      this.visibleId === id && document.visibilityState === "visible";
    if (shown) this.rememberReply(id);
    // Another tab of this browser may have shown the reply before this
    // tab's own event or snapshot named it.
    const seen =
      shown ||
      (key.startsWith("reply:") &&
        this.repliesSeen()?.seen.get(id) === key.slice("reply:".length));
    this.metadata = {
      ...this.metadata,
      attention: new Map(this.metadata.attention).set(
        id,
        seen ? "seen" : "new",
      ),
    };
    this.metaListeners.forEach((listener) => {
      listener();
    });
  }
  // A finished turn is the person's until they have seen it in this browser,
  // whether or not this tab was connected when it settled: the snapshot's
  // last reply is compared with the replies seen here (replySeen.ts).
  private replies?: RepliesSeen;
  /** Each conversation's newest reply this tab knows of, and the event that
   * named it, so a snapshot taken before that event cannot name an older one. */
  private latestReplies = new Map<
    string,
    { id: string; instance?: string; sequence?: number }
  >();
  private repliesSeen(snapshot?: Snapshot) {
    if (this.replies) return this.replies;
    const stored = readRepliesSeen(this.identity);
    if (stored) {
      this.replies = stored;
      return stored;
    }
    if (!snapshot) return undefined;
    // This browser's first look: what has already ended is not news here.
    const captured = Date.parse(snapshot.captured_at ?? "");
    this.replies = {
      horizon: Number.isFinite(captured)
        ? captured
        : Math.max(
            0,
            ...snapshot.agents.map((a) =>
              a.last_reply ? Date.parse(a.last_reply.at) || 0 : 0,
            ),
          ),
      seen: new Map(),
    };
    writeRepliesSeen(this.identity, this.replies);
    return this.replies;
  }
  /** The conversation is shown: its newest reply is seen in this browser. */
  private rememberReply(id: string) {
    const reply =
      this.latestReplies.get(id)?.id ??
      this.metadata.agents.get(id)?.last_reply?.id;
    if (!reply) return;
    // Another tab may have written since this one read.
    const current = readRepliesSeen(this.identity) ?? this.repliesSeen();
    if (!current || current.seen.get(id) === reply) return;
    current.seen.delete(id);
    current.seen.set(id, reply);
    this.replies = current;
    writeRepliesSeen(this.identity, current);
  }
  private noticeReplies(snapshot: Snapshot) {
    const replies = this.repliesSeen(snapshot);
    if (!replies) return;
    const [, instance, sequence] = snapshot.event_cursor.split(":");
    for (const agent of snapshot.agents) {
      const reply = agent.last_reply;
      if (!reply) continue;
      const latest = this.latestReplies.get(agent.agent_id);
      if (
        latest?.sequence !== undefined &&
        latest.instance === instance &&
        latest.sequence > Number(sequence)
      )
        continue;
      this.latestReplies.set(agent.agent_id, { id: reply.id });
      if (!(Date.parse(reply.at) > replies.horizon)) continue;
      // A reply already seen here is entered as seen: it no longer asks,
      // but with Ei nyt on (experimental) it waits, read, for the answer.
      this.markAttention(agent.agent_id, `reply:${reply.id}`);
    }
  }
  // Seen in another tab of this browser, a reply stops asking here too.
  private onStorage = (event: StorageEvent) => {
    if (this.disposed || event.key !== repliesSeenKey(this.identity)) return;
    const replies = readRepliesSeen(this.identity);
    if (!replies) return;
    this.replies = replies;
    const attention = new Map(this.metadata.attention);
    for (const [id, state] of attention) {
      const key = this.attentionKeys.get(id);
      if (
        state === "new" &&
        key?.startsWith("reply:") &&
        replies.seen.get(id) === key.slice("reply:".length)
      )
        attention.set(id, "seen");
    }
    if (
      [...attention].every(([id, s]) => this.metadata.attention.get(id) === s)
    )
      return;
    this.metadata = { ...this.metadata, attention };
    this.metaListeners.forEach((listener) => {
      listener();
    });
  };
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
    window.addEventListener("storage", this.onStorage);
  }
  // The empty view's read belongs to its retained window, not the route's
  // component lifetime: switching away must not abort it and force a reread.
  startPage(id: string, workspaceId: string): Promise<StartPage | null> {
    const record = this.windows.get(id);
    if (!record || this.disposed)
      return Promise.reject(new Error("missing window"));
    if (record.startPage) return record.startPage.read;
    const abort = new AbortController();
    const read = readStartPage(workspaceId, abort.signal).catch((error) => {
      if (record.startPage?.read === read) record.startPage = undefined;
      throw error;
    });
    record.startPage = { read, abort };
    return read;
  }
  readMetadata = (): Metadata => this.metadata;
  status = (id: string): Status | undefined => this.metadata.statuses.get(id);
  // A native credential change invalidates the cached controller status.
  // The next view must read the daemon again, not replay the pre-login error.
  discardStatus(id: string) {
    this.statusVersions.set(id, (this.statusVersions.get(id) ?? 0) + 1);
    this.statusPositions.delete(id);
    const statuses = new Map(this.metadata.statuses);
    statuses.delete(id);
    this.metadata = { ...this.metadata, statuses };
    this.metaListeners.forEach((listener) => {
      listener();
    });
  }
  statusStale = (id: string): boolean => this.metadata.staleStatuses.has(id);
  position = (id: string) => this.positions.get(id);
  toolExpansion = (id: string, callId: string) => ({
    get: () => this.toolExpansions.get(id)?.get(callId),
    set: (value: boolean) => {
      let calls = this.toolExpansions.get(id);
      if (!calls) {
        calls = new Map();
        this.toolExpansions.set(id, calls);
      }
      calls.set(callId, value);
    },
  });
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
  // The value changes at once, so event order, recovery and read() stay
  // synchronous; only window renders are coalesced. A dense run delivers
  // ~160 events/s, and one synchronous render each starved a slow page until
  // fetch replies (status, receipts, Stop) arrived seconds late. A timer
  // rather than requestAnimationFrame keeps hidden tabs flushing.
  private dirty = new Set<string>();
  private flushTimer?: ReturnType<typeof setTimeout>;
  private publish(id: string, value: WindowView) {
    const record = this.windows.get(id);
    if (!record || this.disposed) return;
    record.value = value;
    this.dirty.add(id);
    this.flushTimer ??= setTimeout(this.flushWindows, 16);
  }
  private flushWindows = () => {
    this.flushTimer = undefined;
    const ids = [...this.dirty];
    this.dirty.clear();
    for (const id of ids)
      this.listeners.get(id)?.forEach((listener) => {
        listener();
      });
  };
  private seedLive(
    cursor: string,
    tail: Agent["live_tail"],
    history?: Agent["history"],
  ): LiveTurn {
    let live = initialTurn(
      cursor,
      tail.map((e) => parseConversationEvent(JSON.stringify(e))),
    );
    if (
      this.routed?.instance === live.instance &&
      this.routed.sequence > live.sequence
    )
      // A snapshot behind the stream is normal on a loaded host when a new
      // conversation opens (its creation invalidates the snapshot). With no
      // native history and no live tail there is nothing the gap could have
      // hidden, and its first read finds no history to join, so a missed mark
      // would stay until the first saved entry and flash the notice.
      live =
        history === "missing" && !tail.length
          ? { ...live, ...this.routed, fragments: [] }
          : {
              ...live,
              ...this.routed,
              fragments: [],
              truncated: true,
              missed: true,
            };
    return live;
  }
  applySnapshot(snapshot: Snapshot) {
    if (this.disposed || snapshot.identity.web_identity_id !== this.identity)
      return;
    const restarted =
      !!this.snapshotCursor &&
      this.snapshotCursor.split(":")[1] !== snapshot.event_cursor.split(":")[1];
    if (restarted)
      this.retire(
        this.snapshotCursor?.split(":")[1],
        snapshot.event_cursor.split(":")[1],
      );
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
        record.readEntries.clear();
        record.readAgain = false;
        record.readFrom = undefined;
      }
    }
    for (const [id, record] of this.windows) {
      if (
        record.value.live &&
        !cursor.startsWith(`ev1:${record.value.live.instance}:`)
      ) {
        try {
          const agent = snapshot.agents.find((a) => a.agent_id === id);
          const live = this.seedLive(
            cursor,
            agent?.live_tail ?? [],
            agent?.history,
          );
          if (live.missed) record.missedBefore = this.readSeq;
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
    this.noticeReplies(snapshot);
    this.metaListeners.forEach((listener) => {
      listener();
    });
    if (restarted)
      for (const id of this.metadata.statuses.keys()) this.notifyStatus(id);
    for (const agent of snapshot.agents) {
      const record = this.windows.get(agent.agent_id);
      if (record && !record.value.live) {
        try {
          const live = this.seedLive(
            snapshot.event_cursor,
            agent.live_tail,
            agent.history,
          );
          this.publish(agent.agent_id, { ...record.value, live });
          // A deferred window reads once its status proves the history.
          if (live.missed && record.deferred)
            record.missedBefore = this.readSeq;
          else if (live.missed) this.readMissed(agent.agent_id, record);
        } catch {
          this.markStale(agent.agent_id);
        }
      }
    }
  }
  // Each conversation's status is the newest read: the journal position it
  // was read at (journal_cursor). Two reads in flight come back in either
  // order, and on a slow link the event stream runs ahead of both, so a read
  // applied in arrival order can bring back a turn that has ended.
  private statusPositions = new Map<
    string,
    { instance: string; sequence: number }
  >();
  private statusPosition(status: Status) {
    try {
      return status.journal_cursor
        ? cursorParts(status.journal_cursor)
        : undefined;
    } catch {
      return undefined;
    }
  }
  // Daemon lives this tab has seen replaced, by the stream or a snapshot
  // moving to a new one. A status from any other life is taken: a restart's
  // first sign may be a status read, and two lives have no order of their
  // own, so a status never retires one.
  private retiredInstances = new Set<string>();
  private retire(previous: string | undefined, next: string) {
    if (previous && previous !== next) this.retiredInstances.add(previous);
  }
  /** Whether a status read is older than the one held: read at an earlier
   * position of the same daemon life, or in a life since replaced. */
  private olderStatus(id: string, status: Status) {
    const at = this.statusPosition(status);
    if (!at) return false;
    if (this.retiredInstances.has(at.instance)) return true;
    const held = this.statusPositions.get(id);
    return (
      !!held &&
      held.instance === at.instance &&
      at.sequence < held.sequence &&
      this.metadata.statuses.has(id)
    );
  }
  /** Applies a status unless it is older than the one held (see
   * statusPositions); returns whether it was applied. */
  applyStatus(id: string, status: Status): boolean {
    if (this.disposed || status.agent_id !== id) return false;
    if (this.olderStatus(id, status)) return false;
    const at = this.statusPosition(status);
    if (at) this.statusPositions.set(id, at);
    else this.statusPositions.delete(id);
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
    this.noticeSettled(id, status, at);
    return true;
  }
  /** Whether this tab knows of a reply named later in the same daemon life. */
  private newerReply(id: string, instance: string, sequence: number) {
    const latest = this.latestReplies.get(id);
    return (
      latest?.sequence !== undefined &&
      latest.instance === instance &&
      latest.sequence > sequence
    );
  }
  /** A turn seen ending in a status read is seen like one seen through its
   * event: the stream may bring turn.settled only after the person has seen
   * the answer and left. A status never raises a reply the stream or a
   * snapshot has not. */
  private noticeSettled(
    id: string,
    status: Status,
    at?: { instance: string; sequence: number },
  ) {
    const settled = status.turn_settled;
    if (
      !at ||
      settled?.state !== "settled" ||
      !settled.native_key ||
      this.visibleId !== id ||
      document.visibilityState !== "visible"
    )
      return;
    if (this.newerReply(id, at.instance, at.sequence)) return;
    this.latestReplies.set(id, { id: settled.native_key, ...at });
    this.markAttention(id, `reply:${settled.native_key}`);
  }
  view(id: string, confirmedMissing = false, deferLoad = false): WindowView {
    if (this.disposed) throw new Error("disposed store");
    let record = this.windows.get(id);
    if (!record) {
      const agent = this.metadata.agents.get(id);
      let live: LiveTurn | undefined;
      try {
        if (agent && this.snapshotCursor)
          live = this.seedLive(
            this.snapshotCursor,
            agent.live_tail,
            agent.history,
          );
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
        readEntries: new Map(),
        missedBefore: live?.missed ? this.readSeq : undefined,
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
        oldest[1].startPage?.abort.abort();
        this.windows.delete(oldest[0]);
        this.positions.delete(oldest[0]);
        this.toolExpansions.delete(oldest[0]);
      }
    }
    return record.value;
  }
  /** Every history read begun from now on is numbered above this. */
  readsBegun() {
    return this.readSeq;
  }
  /** The number of the read whose newest page the window last joined; a
   * page read begun after `readsBegun()` returned n is numbered above n. */
  newestRead(id: string) {
    return this.windows.get(id)?.newestRead ?? 0;
  }
  /** Counts the statuses applied for one conversation. */
  statusVersion(id: string) {
    return this.statusVersions.get(id) ?? 0;
  }
  /** Whether the window's newest page was read after the status held now
   * was applied: it then shows everything that status could know of. */
  historyFollowsStatus(id: string) {
    const record = this.windows.get(id);
    return (
      record?.newestReadStatus !== undefined &&
      record.newestReadStatus === (this.statusVersions.get(id) ?? 0)
    );
  }
  /** Reads the newest page now, or right after a read already running (an
   * older page, for example), so the request is never lost. */
  readNewest(id: string) {
    const record = this.windows.get(id);
    if (!record) return;
    if (record.loading) record.readAgain = true;
    else void this.reconnect(id);
  }
  async loadTail(id: string, missing = false): Promise<void> {
    const record = this.windows.get(id);
    if (!record || record.loading) return;
    record.loading = ++this.readSeq;
    record.readStatus = this.statusVersions.get(id) ?? 0;
    record.readFrom = streamPosition(record.value.live);
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
          historyCut: (error as Error).message === "history_cut",
          state: record.value.entries.length ? "stale" : "error",
        });
      }
    } finally {
      if (record.loading === read) this.finishRead(id, record);
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
    record.readStatus = this.statusVersions.get(id) ?? 0;
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
      if (record.loading === read) this.finishRead(id, record);
    }
  }
  // Two pages reach back 200 messages of missed activity, a few MiB at most;
  // a gap longer than that reloads the tail instead.
  async reconnect(id: string, maxPages = 2): Promise<void> {
    const record = this.windows.get(id);
    if (!record || record.loading) return;
    record.loading = ++this.readSeq;
    record.readStatus = this.statusVersions.get(id) ?? 0;
    record.readFrom = streamPosition(record.value.live);
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
      // Join the complete range before releasing the read overlay.
      if (!met) this.applyPage(id, pages[0], "tail", false);
      else
        for (const page of [...pages].reverse()) {
          this.applyPage(id, page, "reconnect", false, page === pages[0]);
          if (record.value.state === "stale" || record.value.state === "error")
            break;
        }
      if (record.loading === read) this.finishRead(id, record);
    } catch (error) {
      if (this.epoch === epoch && this.windows.get(id) === record) {
        // Still no native file behind a confirmed empty window is no failure.
        if (
          (error as Error).message === "history_missing" &&
          confirmedEmpty(record)
        )
          return;
        this.noteHistoryRead(id, true);
        if (!record.deferred)
          this.publish(id, {
            ...record.value,
            historyCut: (error as Error).message === "history_cut",
            state: unsettled(record),
          });
      }
    } finally {
      if (record.loading === read) this.finishRead(id, record);
    }
  }
  applyPage(
    id: string,
    page: HistoryPage,
    mode: "tail" | "older" | "reconnect" = "tail",
    flush = true,
    /** The page ends at the native leaf (a tail read, or a reconnect's
     * newest page). */
    newest = mode === "tail",
  ) {
    const record = this.windows.get(id);
    if (!record || this.disposed || page.agent_id !== id) return;
    this.reconcileNotices(
      id,
      page.entries.flatMap((entry) => (entry.notice ? [entry.notice] : [])),
    );
    const old = record.value;
    // Streamed appends are not witnesses for joining a page to the held range:
    // native entries omitted from the stream may lie between them and that range.
    const base = old.entries.filter(
      (entry) => !record.readEntries.get(entry.entry_key)?.appended,
    );
    const incoming = page.entries.map(
      (entry) => record.readEntries.get(entry.entry_key)?.entry ?? entry,
    );
    const known = new Map(base.map((entry, index) => [entry.entry_key, index]));
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
      (base.length > 0 && incoming.at(-1)?.entry_key === base[0].entry_key);
    if (mode === "older" && !validOlder) {
      this.markStale(id);
      record.loading = false;
      void this.loadTail(id);
      return;
    }
    let entries: HistoryEntry[];
    if (contiguous && validOlder) {
      const first = shared[0];
      const last = shared[shared.length - 1];
      // A newest page that goes on past its last shared entry, where the
      // held range also goes on, shows Pi on another branch of its tree
      // (Palaa tähän): what the held range had after it is no longer the
      // conversation. The stream's own deliveries are added back below.
      const lastIncoming = incoming.at(-1)?.entry_key;
      const diverged =
        newest &&
        last < base.length - 1 &&
        lastIncoming !== undefined &&
        !known.has(lastIncoming);
      entries = [
        ...base.slice(0, first),
        ...incoming,
        ...(diverged ? [] : base.slice(last + 1)),
      ];
    } else if (
      mode === "older" ||
      (mode === "reconnect" && base.length) ||
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
    // A disjoint tail can replace the old range, but not entries delivered by
    // the stream since this read began (including updates of existing keys).
    for (const { entry } of record.readEntries.values()) {
      const index = entries.findIndex((e) => e.entry_key === entry.entry_key);
      if (index >= 0) entries[index] = entry;
      else entries.push(entry);
    }
    // The older cursor belongs to the left edge, not the newest tail page.
    // In particular, undefined at a retained edge means exhausted, not unknown.
    const next =
      entries[0]?.entry_key === incoming[0]?.entry_key
        ? page.older_complete
          ? undefined
          : page.next_before
        : old.next;
    // A cached settlement from an earlier turn cannot supersede newer live
    // fragments while its status is awaiting a fresh observation.
    const settledKey = this.statusStale(id)
      ? undefined
      : this.metadata.statuses.get(id)?.turn_settled?.native_key;
    let live =
      old.live &&
      settledKey &&
      incoming.some((entry) => entry.entry_key === settledKey)
        ? {
            ...old.live,
            fragments: keptAfterAnswer(old.live.fragments),
            truncated: false,
          }
        : old.live;
    // Native history has every message of the model turns that had ended
    // when this read began: the newest ones on this page, any older ones
    // on the pages before it.
    if (live && newest && mode !== "older" && record.readFrom)
      live = retireEndedTurns(live, record.readFrom);
    // A read begun after events were missed has joined what they carried.
    if (
      live?.missed &&
      mode !== "older" &&
      record.loading !== false &&
      record.missedBefore !== undefined &&
      record.loading > record.missedBefore
    ) {
      live = { ...live, missed: false };
      record.missedBefore = undefined;
    }
    if (newest && record.loading !== false) {
      record.newestRead = record.loading;
      record.newestReadStatus = record.readStatus;
    }
    this.noteHistoryRead(id, false);
    this.publish(id, {
      entries,
      next,
      revision: page.native_revision,
      cutOff: page.cut_off,
      state: entries.length ? "ready" : "empty",
      live,
    });
    if (flush) this.finishRead(id, record);
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
  private finishRead(id: string, record: WindowRecord) {
    record.loading = false;
    record.readFrom = undefined;
    record.readEntries.clear();
    if (record.readAgain) {
      record.readAgain = false;
      void this.reconnect(id);
    }
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
      event.kind === "history.entry" &&
      event.resource.agent_id &&
      event.payload.notice
    ) {
      this.reconcileNotices(event.resource.agent_id, [
        event.payload.notice as AgentNotice,
      ]);
    }
    if (event.kind === "notice.created" && event.resource.agent_id) {
      const id = event.resource.agent_id;
      const notice = event.payload.notice as AgentNotice;
      const native = this.read(id)?.entries.some(
        (entry) => entry.notice?.notice_id === notice.notice_id,
      );
      if (notice.persistence !== "persisted" && !native) {
        this.notices.set(
          id,
          [
            ...this.readNotices(id).filter(
              (n) => n.notice_id !== notice.notice_id,
            ),
            notice,
          ].slice(-20),
        );
        if (this.notices.size > 100)
          this.notices.delete(this.notices.keys().next().value as string);
      } else {
        this.notices.set(
          id,
          this.readNotices(id).filter((n) => n.notice_id !== notice.notice_id),
        );
      }
      this.metaListeners.forEach((listener) => {
        listener();
      });
    }
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
    else if (
      event.resource.agent_id &&
      event.kind === "turn.settled" &&
      !this.newerReply(
        event.resource.agent_id,
        event.server_instance_id,
        event.sequence,
      )
    ) {
      // Keyed by the reply the snapshot will name, so a later snapshot does
      // not raise a turn already seen here again. A lagging stream's older
      // turn does not replace a newer one a status already named.
      const reply =
        event.payload.state === "settled" &&
        typeof event.payload.native_key === "string" &&
        event.payload.native_key;
      if (reply)
        this.latestReplies.set(event.resource.agent_id, {
          id: reply,
          instance: event.server_instance_id,
          sequence: event.sequence,
        });
      this.markAttention(
        event.resource.agent_id,
        reply ? `reply:${reply}` : event.event_id,
      );
    }
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
    this.retire(this.routed?.instance, event.server_instance_id);
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
    const result = applyTurnEvent(record.value.live, event, id);
    if (
      result.recover &&
      event.kind === "snapshot.invalidated" &&
      event.payload.reason !== "ring_truncated" &&
      result.turn.sequence === event.sequence
    )
      this.owedRead(id, record, result.turn);
    else if (
      result.recover &&
      event.kind === "snapshot.invalidated" &&
      event.payload.reason !== "ring_truncated"
    )
      this.publish(id, {
        ...record.value,
        live: result.turn,
        state: record.value.entries.length ? "stale" : record.value.state,
      });
    else if (result.recover === "history")
      this.catchUpHistory(id, record, result.turn);
    else if (result.recover) this.recoverWindow(id, record, event);
    else this.publish(id, { ...record.value, live: result.turn });
  }
  applyEvent(event: ConversationEvent) {
    if (this.disposed) return;
    const id = event.resource.agent_id;
    if (!id) return;
    const record = this.windows.get(id);
    if (!record) return;
    const live = record.value.live;
    if (!live) {
      this.markStale(id);
      return;
    }
    const result = applyTurnEvent(live, event, id);
    if (
      result.recover &&
      event.kind === "snapshot.invalidated" &&
      event.payload.reason !== "ring_truncated" &&
      result.turn.sequence === event.sequence
    ) {
      this.owedRead(id, record, result.turn);
      return;
    }
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
    if (result.recover === "history") {
      this.catchUpHistory(id, record, result.turn);
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
      if (record.loading)
        record.readEntries.set(result.entry.entry_key, {
          entry: result.entry,
          appended:
            record.readEntries.get(result.entry.entry_key)?.appended ??
            index < 0,
        });
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
          ? {
              ...result.turn,
              fragments: commandOutput(result.turn.fragments),
              truncated: false,
            }
          : result.turn;
      this.publish(id, { ...record.value, live: turn });
    }
  }
  // The stream is contiguous; native history only has entries the events did
  // not carry (a process notification, an oversized entry, a turn whose live
  // tail outgrew its bound). What is shown stays shown and current while one
  // read joins them; only a failed read marks the window stale.
  private catchUpHistory(id: string, record: WindowRecord, turn: LiveTurn) {
    this.publish(id, { ...record.value, live: turn });
    if (record.loading) record.readAgain = true;
    else void this.reconnect(id);
  }
  // A native write (usually Pi's own) is announced as an invalidation. With
  // the stream contiguous, the view is not known to be wrong: keep it as it is
  // and read once the snapshot has answered, so a slow host shows no warning.
  private owedRead(id: string, record: WindowRecord, turn: LiveTurn) {
    record.sourceChanged = true;
    this.publish(id, { ...record.value, live: turn });
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
        missed: true,
      },
      state: confirmedEmpty(record) ? "empty" : unsettled(record),
    });
    this.readMissed(id, record);
  }
  // Events for this window were missed. Only a native read begun after that
  // can show what they carried; until it joins, the turn is not complete.
  private readMissed(id: string, record: WindowRecord) {
    record.missedBefore = this.readSeq;
    if (record.loading) record.readAgain = true;
    else void this.reconnect(id);
  }
  reseed(snapshot: Snapshot, activeId?: string) {
    if (this.disposed || snapshot.identity.web_identity_id !== this.identity)
      return;
    ++this.epoch;
    this.pager.cancelAll();
    const instance = snapshot.event_cursor.split(":")[1];
    this.retire(this.snapshotCursor?.split(":")[1], instance);
    this.retire(this.routed?.instance, instance);
    this.snapshotCursor = snapshot.event_cursor;
    this.routed = undefined;
    for (const id of this.metadata.statuses.keys())
      if (id !== activeId) this.notifyStatus(id);
    for (const [id, record] of this.windows) {
      record.readEntries.clear();
      record.readAgain = false;
      record.loading = false;
      record.readFrom = undefined;
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
        else if (record.sourceChanged) {
          record.sourceChanged = false;
          void this.loadTail(id);
        }
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
      // A quiet catch-up cancelled above is owed again.
      const interrupted = record.loading !== false;
      if (record.loading) {
        record.readAgain = false;
        this.finishRead(id, record);
      }
      if (record.deferred) continue;
      if (record.value.state === "loading") void this.loadTail(id);
      else if (
        stale ||
        record.value.state === "stale" ||
        record.value.state === "error"
      ) {
        record.sourceChanged = false;
        this.markStale(id);
        void this.reconnect(id);
      } else if (record.sourceChanged || interrupted) {
        record.sourceChanged = false;
        if (confirmedEmpty(record)) void this.loadTail(id);
        else void this.reconnect(id);
      }
    }
  }
  markAllStale() {
    for (const id of this.windows.keys()) this.markStale(id);
  }
  markStale(id: string) {
    const record = this.windows.get(id);
    if (record?.deferred) return; // Status must first prove whether history exists.
    if (!record) return;
    // A confirmed empty window shows nothing that could be out of date and
    // nothing failed to read; it owes one quiet read in case Pi wrote since.
    if (confirmedEmpty(record)) record.sourceChanged = true;
    else this.publish(id, { ...record.value, state: unsettled(record) });
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    this.dirty.clear();
    window.removeEventListener("storage", this.onStorage);
    this.replies = undefined;
    this.latestReplies.clear();
    ++this.epoch;
    this.pager.cancelAll();
    for (const record of this.windows.values()) record.startPage?.abort.abort();
    this.windows.clear();
    this.positions.clear();
    this.toolExpansions.clear();
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
    this.notices.clear();
    this.statusRequests.clear();
    this.statusVersions.clear();
    this.statusPositions.clear();
    this.retiredInstances.clear();
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

const emptyNotices: AgentNotice[] = [];
export function useAgentNotices(store: ConversationStore, id: string) {
  return useSyncExternalStore(store.subscribeMetadata, () =>
    store.readNotices(id),
  );
}
