import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Status } from "./conversations";
import type { HistoryEntry } from "./history";
import {
  DELIVERY_GRACE_MS,
  lastUserKey,
  lostSendArrived,
  lostSendVerdict,
  type QueuedSend,
  reconcileQueued,
  sendArrived,
  shownQueue,
  userKeys,
  useSentMessages,
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

describe("lostSendArrived", () => {
  const before = [
    entry("u1", "user", "Päällä ovat."),
    entry("a1", "assistant", "ok"),
  ];
  const after = lastUserKey(before);
  it("is shown by a newer native message carrying its text", () => {
    const later = [...before, entry("u2", "user", "Päällä ovat.")];
    expect(lostSendArrived(later, "Päällä ovat. ", after)).toBe(true);
  });
  it("is not shown by an equal earlier message or another newer one", () => {
    expect(lostSendArrived(before, "Päällä ovat.", after)).toBe(false);
    const other = [...before, entry("u2", "user", "jotain muuta")];
    expect(lostSendArrived(other, "Päällä ovat.", after)).toBe(false);
  });
  it("proves nothing from history that no longer reaches the mark", () => {
    const rewound = [entry("u2", "user", "Päällä ovat.")];
    expect(lostSendArrived(rewound, "Päällä ovat.", after)).toBe(false);
  });
  it("is never shown for a send kept without a mark", () => {
    const later = [...before, entry("u2", "user", "Päällä ovat.")];
    expect(lostSendArrived(later, "Päällä ovat.", null)).toBe(false);
  });
  it("counts every message of a conversation empty at sending", () => {
    expect(lastUserKey([])).toBe("");
    expect(lostSendArrived([entry("u1", "user", "eka")], "eka", "")).toBe(true);
  });
});

describe("lostSendVerdict", () => {
  const command = "c1";
  const before = [
    entry("u1", "user", "aiempi"),
    entry("a1", "assistant", "ok"),
  ];
  const idle = {
    state: "idle",
    run_active: false,
    command_id: "",
    native_history: "present",
    queue: { revision: 1, steering: [], follow_up: [] },
    held: [],
  } as unknown as Status;
  const verdict = (
    fields: Partial<Parameters<typeof lostSendVerdict>[0]> = {},
  ) =>
    lostSendVerdict({
      text: "Tee se.",
      command,
      after: lastUserKey(before),
      entries: before,
      status: idle,
      historyCurrent: true,
      ...fields,
    });
  it("sends again what an idle agent with fresh history never got", () => {
    expect(verdict()).toBe("resend");
    expect(verdict({ status: { ...idle, state: "rejected" } })).toBe("resend");
  });
  it("reads history first when the shown history may predate the finding", () => {
    expect(verdict({ historyCurrent: false })).toBe("read-history");
  });
  it("keeps the text out of a conversation that moved on", () => {
    const moved = [...before, entry("u2", "user", "toinen asia")];
    expect(verdict({ entries: moved })).toBe("moved-on");
    // Even while that newer turn still runs.
    expect(
      verdict({ entries: moved, status: { ...idle, state: "accepted" } }),
    ).toBe("moved-on");
  });
  it("proves nothing while anything else could still be the message", () => {
    expect(verdict({ status: { ...idle, state: "accepted" } })).toBeUndefined();
    expect(verdict({ status: { ...idle, run_active: true } })).toBeUndefined();
    expect(verdict({ status: { ...idle, state: "stopped" } })).toBeUndefined();
    expect(
      verdict({
        status: {
          ...idle,
          queue: { revision: 2, steering: ["x"], follow_up: [] },
        },
      }),
    ).toBeUndefined();
    expect(
      verdict({
        status: { ...idle, held: [{ command_id: "h", text: "x" }] },
      }),
    ).toBeUndefined();
    // The host names the command: its own record decides.
    expect(
      verdict({ status: { ...idle, command_id: command } }),
    ).toBeUndefined();
  });
  it("proves nothing without readable history reaching the mark", () => {
    expect(
      verdict({ status: { ...idle, native_history: "missing" } }),
    ).toBeUndefined();
    expect(verdict({ after: null })).toBeUndefined();
    expect(verdict({ entries: [entry("u9", "user", "x")] })).toBeUndefined();
  });
  it("counts a rewind since the send as the conversation moving on", () => {
    // The delivered message may be off the branch now: never a proof.
    const rewound = [...before, entry("r1", "rewind", "")];
    expect(verdict({ entries: rewound })).toBe("moved-on");
  });
  it("reads history again only for an agent that looks settled", () => {
    expect(
      verdict({
        historyCurrent: false,
        status: { ...idle, state: "accepted" },
      }),
    ).toBeUndefined();
  });
  it("leaves a message history shows to be settled as arrived", () => {
    const arrived = [...before, entry("u2", "user", "Tee se.")];
    expect(verdict({ entries: arrived })).toBeUndefined();
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

describe("this tab's sent message", () => {
  it("is not drawn again once Pi's message replaced it, even when history goes back before it", () => {
    const before = [
      entry("u1", "user", "hei"),
      entry("a1", "assistant", "moi"),
    ];
    const props = {
      scope: "person:pi:1",
      queue: undefined,
      sendObservation: undefined,
      draft: "",
      changeDraft: () => {},
    };
    const { result, rerender } = renderHook(
      (entries: HistoryEntry[]) => useSentMessages({ ...props, entries }),
      { initialProps: before },
    );
    act(() =>
      result.current.onSent({
        command: "c1",
        text: "toinen",
        before: userKeys(before),
      }),
    );
    expect(result.current.own?.text).toBe("toinen");
    rerender([...before, entry("u2", "user", "toinen")]);
    expect(result.current.own).toBeUndefined();
    // Palaa tähän: the active branch no longer has the message.
    rerender([...before, entry("m1", "rewind", "")]);
    expect(result.current.own).toBeUndefined();
  });
});
