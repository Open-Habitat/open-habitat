import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "./history";
import {
  DELIVERY_GRACE_MS,
  type QueuedSend,
  reconcileQueued,
  sendArrived,
  shownQueue,
  userKeys,
} from "./sentMessages";

const entry = (
  entry_key: string,
  kind: HistoryEntry["kind"],
  text: string,
): HistoryEntry => ({
  entry_key,
  kind,
  content: { media_type: "text/plain", text, complete: true },
});

describe("sendArrived", () => {
  const before = [entry("u1", "user", "hei"), entry("a1", "assistant", "moi")];
  it("takes the next native user message as the send, whatever its text", () => {
    // Pi records a skill invocation's arguments, not the typed command.
    const after = [...before, entry("u2", "user", "vain argumentit")];
    expect(sendArrived(after, userKeys(before))).toBe(true);
    expect(sendArrived(before, userKeys(before))).toBe(false);
  });
  it("is not shown by an older page", () => {
    const older = [entry("u0", "user", "hei"), ...before];
    expect(sendArrived(older, userKeys(before))).toBe(false);
  });
});

describe("queued messages", () => {
  const message = (command: string, text: string, extra = {}): QueuedSend => ({
    command,
    kind: "steer",
    text,
    preexisting: [],
    ...extra,
  });
  const empty = { steering: [], follow_up: [] };

  it("draws a message before Pi's queue shows it, and an equal one twice", () => {
    const local = [message("c1", "sama"), message("c2", "sama")];
    expect(
      shownQueue({ steering: ["sama"], follow_up: ["muu"] }, local),
    ).toEqual({
      steering: ["sama", "sama"],
      follow_up: ["muu"],
    });
  });

  it("keeps a delivered message until native history shows it", () => {
    const accepted = [message("c1", "ohjaa", { accepted: true })];
    const queued = reconcileQueued(
      accepted,
      { steering: ["ohjaa"], follow_up: [] },
      [],
      0,
    );
    expect(queued[0].left).toBeUndefined();
    // Pi delivered it: gone from its queue, not yet in native history.
    const delivered = reconcileQueued(queued, empty, [], 1000);
    expect(shownQueue(empty, delivered)?.steering).toEqual(["ohjaa"]);
    const native = [entry("u9", "user", "ohjaa")];
    expect(reconcileQueued(delivered, empty, native, 1100)).toEqual([]);
  });

  it("an earlier equal native message does not show it, the grace ends it", () => {
    const native = [entry("u1", "user", "ohjaa")];
    const local = [
      message("c1", "ohjaa", { accepted: true, preexisting: ["u1"] }),
    ];
    const left = reconcileQueued(local, empty, native, 0);
    expect(left).toHaveLength(1);
    expect(
      reconcileQueued(left, empty, native, DELIVERY_GRACE_MS - 1),
    ).toHaveLength(1);
    expect(reconcileQueued(left, empty, native, DELIVERY_GRACE_MS)).toEqual([]);
  });

  it("one native message shows one of two equal ones, never an unacknowledged one", () => {
    const local = [
      message("c1", "uudelleen", { accepted: true }),
      message("c2", "uudelleen", { accepted: true }),
      message("c3", "uudelleen"),
    ];
    const native = [entry("u2", "user", "uudelleen")];
    expect(
      reconcileQueued(local, empty, native, 0).map((m) => m.command),
    ).toEqual(["c2", "c3"]);
  });

  it("an unacknowledged message is never dropped for being absent from Pi's queue", () => {
    const local = [message("c1", "matkalla")];
    expect(reconcileQueued(local, empty, [], 10 * DELIVERY_GRACE_MS)).toEqual(
      local,
    );
  });
});
