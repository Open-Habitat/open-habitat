import { describe, expect, it } from "vitest";
import { restoreToDraft, waitingMessages } from "./heldMessages";

const a = "aaaaaaaa-0000-4000-8000-00000000000a";
const b = "aaaaaaaa-0000-4000-8000-00000000000b";
const c = "aaaaaaaa-0000-4000-8000-00000000000c";

describe("waiting messages", () => {
  it("draws each held message once, the daemon's order first", () => {
    // b was posted by this tab and is now held; c is still being posted; a
    // came from another tab. A message must never appear twice.
    const view = waitingMessages(
      [
        { command_id: b, text: "toinen", posted: true },
        { command_id: c, text: "kolmas", posted: false },
      ],
      [
        { command_id: a, text: "ensimmäinen" },
        { command_id: b, text: "toinen" },
      ],
      "starting",
    );
    expect(view.map((v) => [v.command_id, v.state])).toEqual([
      [a, "waiting"],
      [b, "waiting"],
      [c, "waiting"],
    ]);
  });

  it("marks held messages failed after a failed start, but not unposted ones", () => {
    const view = waitingMessages(
      [{ command_id: c, text: "kolmas", posted: false }],
      [{ command_id: a, text: "ensimmäinen" }],
      "start_failed",
    );
    expect(view.map((v) => v.state)).toEqual(["failed", "waiting"]);
  });

  it("keeps an uncertain message visible and drops a delivered one", () => {
    const view = waitingMessages(
      [
        { command_id: a, text: "epävarma", posted: true, uncertain: true },
        { command_id: b, text: "perillä", posted: true, delivered: 1 },
      ],
      [],
      "stopped",
    );
    expect(view).toEqual([
      { command_id: a, text: "epävarma", state: "uncertain" },
    ]);
  });
});

it("returns taken-back messages ahead of the draft, in order", () => {
  expect(restoreToDraft(["yksi", "kaksi"], "luonnos")).toBe(
    "yksi\n\nkaksi\n\nluonnos",
  );
  expect(restoreToDraft(["yksi"], "  ")).toBe("yksi");
});
