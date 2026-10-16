import { afterEach, describe, expect, it, vi } from "vitest";
import eventSchema from "../../../contracts/v1/event.schema.json";
import { ConversationJournal } from "./conversationJournal";
import type { ConversationStore } from "./conversationStore";
import type { Snapshot } from "./snapshot";

const instance = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const cursor = (n: number, server = instance) => `ev1:${server}:${n}`;
const snapshot = (n: number, server = instance) =>
  ({
    identity: { web_identity_id: "person" },
    event_cursor: cursor(n, server),
    agents: [],
  }) as unknown as Snapshot;
const event = (
  n: number,
  kind = "assistant.delta",
  server = instance,
  payload: Record<string, unknown> = { text: "hi", content_index: 0 },
) => ({
  schema_version: 1,
  event_id: `evt_${String(n).padStart(32, "0")}`,
  cursor: cursor(n, server),
  sequence: n,
  server_instance_id: server,
  kind,
  resource: { agent_id: "pi:12345678-1234-1234-1234-123456789012" },
  payload,
});
class FakeSource {
  static all: FakeSource[] = [];
  onopen?: () => void;
  onerror?: () => void;
  closed = false;
  listeners: string[] = [];
  constructor(public url: string) {
    FakeSource.all.push(this);
  }
  close() {
    this.closed = true;
  }
  addEventListener(kind: string, _listener: (event: MessageEvent) => void) {
    this.listeners.push(kind);
  }
}
const setup = (activeId?: string) => {
  const store = {
    identity: "person",
    routeEvent: vi.fn(),
    markAllStale: vi.fn(),
    reseed: vi.fn(),
    reconcileStale: vi.fn(),
    applySnapshot: vi.fn(),
  } as unknown as ConversationStore;
  const onSnapshotNeeded = vi.fn();
  const onStatusChange = vi.fn();
  const onConnection = vi.fn();
  const journal = new ConversationJournal(store, {
    activeId: () => activeId,
    onSnapshotNeeded,
    onStatusChange,
    onLogin: vi.fn(),
    onOffline: vi.fn(),
    onConnection,
  });
  return { journal, store, onSnapshotNeeded, onStatusChange, onConnection };
};
afterEach(() => {
  vi.unstubAllGlobals();
  FakeSource.all = [];
});
describe("one tab-wide journal", () => {
  it("subscribes to every named event in the wire contract", () => {
    vi.stubGlobal("EventSource", FakeSource);
    const { journal } = setup();
    journal.start(snapshot(0));
    expect(FakeSource.all[0].listeners.sort()).toEqual(
      [...eventSchema.properties.kind.enum].sort(),
    );
    journal.stop();
  });
  it("keeps one connection across route switches and routes unopened agents without allocating windows", () => {
    vi.stubGlobal("EventSource", FakeSource);
    const { journal, store, onStatusChange } = setup();
    journal.start(snapshot(0));
    journal.route(event(1) as never);
    journal.route(event(2, "turn.settled", instance, {}) as never);
    expect(FakeSource.all).toHaveLength(1);
    expect(store.routeEvent).toHaveBeenCalledTimes(2);
    expect(onStatusChange).toHaveBeenCalledTimes(1);
    journal.stop();
    expect(FakeSource.all[0].closed).toBe(true);
  });
  it("ignores exact replay, but rejects conflicting ID, skipped sequence, and SSE ID", () => {
    vi.stubGlobal("EventSource", FakeSource);
    const { journal, store, onSnapshotNeeded } = setup();
    journal.start(snapshot(0));
    journal.route(event(1) as never);
    journal.route(event(1) as never);
    expect(store.routeEvent).toHaveBeenCalledTimes(1);
    journal.route({ ...event(1), event_id: "evt_conflict" } as never);
    expect(onSnapshotNeeded).toHaveBeenCalledTimes(1);
    expect(store.markAllStale).toHaveBeenCalledTimes(1);
    journal.resume(snapshot(4));
    expect(FakeSource.all[1].url).toContain(encodeURIComponent(cursor(4)));
    journal.route(event(6) as never);
    expect(onSnapshotNeeded).toHaveBeenCalledTimes(2);
    journal.resume(snapshot(6));
    journal.route(event(7) as never, cursor(8));
    expect(onSnapshotNeeded).toHaveBeenCalledTimes(3);
    journal.stop();
  });
  it("rejects reusing an event ID for a different sequence", () => {
    vi.stubGlobal("EventSource", FakeSource);
    const { journal, onSnapshotNeeded } = setup();
    journal.start(snapshot(0));
    journal.route(event(1) as never);
    journal.route({ ...event(2), event_id: event(1).event_id } as never);
    expect(onSnapshotNeeded).toHaveBeenCalledTimes(1);
    journal.stop();
  });
  it("recovers a daemon restart and never rewinds after a concurrent snapshot", () => {
    vi.stubGlobal("EventSource", FakeSource);
    const { journal, store, onSnapshotNeeded } = setup();
    journal.start(snapshot(0));
    journal.route(event(1) as never);
    journal.resume(snapshot(0)); // fetched before the event, no new connection
    expect(FakeSource.all).toHaveLength(1);
    journal.route(
      event(2, "snapshot.invalidated", instance, {
        reason: "source_changed",
      }) as never,
    );
    journal.resume(snapshot(1)); // older than the invalidation: retry snapshot
    expect(onSnapshotNeeded).toHaveBeenCalledTimes(2);
    journal.route(event(3, "assistant.delta", other) as never);
    expect(store.markAllStale).toHaveBeenCalledTimes(1);
    journal.resume(snapshot(0, other));
    expect(store.reseed).toHaveBeenCalled();
    expect(FakeSource.all).toHaveLength(2);
    journal.stop();
  });
  it("does not resume a gap from an older in-flight snapshot", () => {
    vi.stubGlobal("EventSource", FakeSource);
    const { journal, onSnapshotNeeded, store } = setup();
    journal.start(snapshot(0));
    journal.route(event(1) as never);
    journal.route(event(3) as never);
    journal.resume(snapshot(0));
    expect(onSnapshotNeeded).toHaveBeenCalledTimes(2);
    expect(FakeSource.all).toHaveLength(1);
    expect(store.reseed).not.toHaveBeenCalled();
    journal.resume(snapshot(3));
    expect(FakeSource.all).toHaveLength(2);
    journal.stop();
  });
  it("recovers from a conflicting duplicate at an unchanged snapshot cursor", () => {
    vi.stubGlobal("EventSource", FakeSource);
    const { journal, store } = setup();
    journal.start(snapshot(0));
    journal.route(event(1) as never);
    journal.route({ ...event(1), event_id: "evt_conflict" } as never);
    journal.resume(snapshot(1));
    expect(FakeSource.all).toHaveLength(2);
    expect(store.reseed).toHaveBeenCalledTimes(1);
    journal.route(event(2) as never);
    expect(store.routeEvent).toHaveBeenCalledTimes(2);
    journal.stop();
  });
  it("ends recovery progress on snapshot failure and cancels its watchdog", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("EventSource", FakeSource);
      const { journal, onConnection } = setup();
      journal.start(snapshot(0));
      journal.route(event(2) as never);
      journal.retry();
      journal.snapshotFailed();
      expect(onConnection).toHaveBeenLastCalledWith(
        "failed",
        expect.stringContaining("tilaa ei saatu"),
      );
      const calls = onConnection.mock.calls.length;
      await vi.advanceTimersByTimeAsync(9000);
      expect(onConnection).toHaveBeenCalledTimes(calls);
      journal.retry();
      journal.resume(snapshot(0));
      FakeSource.all.at(-1)?.onopen?.();
      expect(onConnection).toHaveBeenLastCalledWith("online");
      journal.stop();
    } finally {
      vi.useRealTimers();
    }
  });
  it("retains the cursor after agent tail truncation, without a global snapshot", () => {
    vi.stubGlobal("EventSource", FakeSource);
    const { journal, onSnapshotNeeded, store } = setup();
    journal.start(snapshot(0));
    journal.route(
      event(1, "snapshot.invalidated", instance, {
        reason: "ring_truncated",
      }) as never,
    );
    journal.route(event(2) as never);
    expect(onSnapshotNeeded).not.toHaveBeenCalled();
    expect(store.routeEvent).toHaveBeenCalledTimes(2);
    expect(FakeSource.all).toHaveLength(1);
    journal.stop();
  });
  it("notifies active status on a user-scoped invalidation", () => {
    vi.stubGlobal("EventSource", FakeSource);
    const id = "pi:12345678-1234-1234-1234-123456789012";
    const { journal, onStatusChange } = setup(id);
    journal.start(snapshot(0));
    journal.route({
      ...event(1, "snapshot.invalidated", instance, {
        reason: "source_changed",
      }),
      resource: { scope: "user" },
    } as never);
    expect(onStatusChange).toHaveBeenCalledWith(id, "snapshot.invalidated");
    journal.stop();
  });
  it("cancels a pending backoff when a newer snapshot opens a replacement stream", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("EventSource", FakeSource);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          status: 503,
          ok: false,
          body: { cancel: () => Promise.resolve() },
        }),
      );
      const { journal } = setup();
      journal.start(snapshot(0));
      FakeSource.all[0].onerror?.();
      for (let i = 0; i < 5; i++) await Promise.resolve();
      journal.resume(snapshot(1));
      FakeSource.all[1].onopen?.();
      await vi.advanceTimersByTimeAsync(30000);
      expect(FakeSource.all).toHaveLength(2);
      expect(FakeSource.all[0].closed).toBe(true);
      journal.stop();
    } finally {
      vi.useRealTimers();
    }
  });
  it("explicit retry cancels backoff and reopens an unchanged cursor exactly once", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("EventSource", FakeSource);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ status: 503, ok: false }),
      );
      const { journal } = setup();
      journal.start(snapshot(0));
      journal.route(event(1) as never);
      FakeSource.all[0].onerror?.();
      for (let i = 0; i < 5; i++) await Promise.resolve();
      journal.resume(snapshot(1)); // A snapshot refresh alone does not reopen SSE.
      expect(FakeSource.all).toHaveLength(1);
      journal.retry();
      expect(FakeSource.all[1].url).toContain(encodeURIComponent(cursor(1)));
      FakeSource.all[1].onopen?.();
      await vi.advanceTimersByTimeAsync(30000);
      expect(FakeSource.all).toHaveLength(2);
      journal.stop();
      journal.retry();
      expect(FakeSource.all).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
  it("bounds a silent EventSource handshake and clears its watchdog on open", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal("EventSource", FakeSource);
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ status: 503, ok: false }),
      );
      const { journal, onConnection } = setup();
      journal.start(snapshot(0));
      await vi.advanceTimersByTimeAsync(8000);
      expect(FakeSource.all[0].closed).toBe(true);
      expect(onConnection).toHaveBeenLastCalledWith(
        "failed",
        expect.stringContaining("ei ole käytettävissä"),
      );
      journal.retry();
      FakeSource.all[1].onopen?.();
      await vi.advanceTimersByTimeAsync(30000);
      expect(FakeSource.all).toHaveLength(2);
      expect(onConnection).toHaveBeenLastCalledWith("online");
      journal.stop();
    } finally {
      vi.useRealTimers();
    }
  });
  it("keeps independent cursors and fences callbacks after stop", () => {
    vi.stubGlobal("EventSource", FakeSource);
    const a = setup(),
      b = setup();
    a.journal.start(snapshot(0));
    b.journal.start(snapshot(0));
    a.journal.route(event(1) as never);
    b.journal.route(event(1) as never);
    a.journal.stop();
    a.journal.route(event(2) as never);
    b.journal.route(event(2) as never);
    expect(a.store.routeEvent).toHaveBeenCalledTimes(1);
    expect(b.store.routeEvent).toHaveBeenCalledTimes(2);
    b.journal.stop();
  });
});
