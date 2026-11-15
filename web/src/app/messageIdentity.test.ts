import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "./history";
import { messageIdentity, settleMessageIds } from "./messageIdentity";

const user = (key: string, text: string): HistoryEntry => ({
  entry_key: key,
  kind: "user",
  content: { media_type: "text/plain", text, complete: true },
});

describe("mounted message identity", () => {
  it("joins a held message in the same render history arrives, before its receipt retires it", () => {
    const memory = messageIdentity();
    const pending = [{ key: "held:command", text: "hello", before: [] }];
    settleMessageIds(memory, "creation-view", [], pending);
    expect(
      settleMessageIds(
        memory,
        "creation-view",
        [user("native", "hello")],
        pending,
      ).get("native"),
    ).toBe("held:command");
    expect(
      settleMessageIds(
        memory,
        "creation-view",
        [user("native", "hello")],
        [],
      ).get("native"),
    ).toBe("held:command");
  });

  it("keeps a direct send's key when its controller retires it as history arrives, including skill expansion", () => {
    const memory = messageIdentity();
    settleMessageIds(
      memory,
      "view",
      [user("old", "same")],
      [{ key: "sent:command", text: "/skill:check", direct: true }],
    );
    const aliases = settleMessageIds(
      memory,
      "view",
      [user("old", "same"), user("new", "expanded skill")],
      [],
    );
    expect(aliases.get("new")).toBe("sent:command");
    expect(aliases.has("old")).toBe(false);
  });

  it("does not merge identical repeated sends with old history or with each other", () => {
    const memory = messageIdentity();
    const pending = ["a", "b"].map((key) => ({
      key,
      text: "again",
      before: ["old"],
    }));
    const entries = [
      user("old", "again"),
      user("one", "again"),
      user("two", "again"),
    ];
    settleMessageIds(memory, "view", [entries[0]], pending);
    const aliases = settleMessageIds(memory, "view", entries, pending);
    expect([...aliases]).toEqual([
      ["one", "a"],
      ["two", "b"],
    ]);
  });

  it.each([false, true])(
    "does not claim older pages or a replaced history window (direct=%s)",
    (direct) => {
      const memory = messageIdentity();
      const pending = [{ key: "pending", text: "continue", direct }];
      const latest = user("latest", "continue");
      settleMessageIds(memory, "view", [latest], pending);
      expect(
        settleMessageIds(
          memory,
          "view",
          [user("older", "continue"), latest],
          pending,
        ).size,
      ).toBe(0);
      expect(
        settleMessageIds(
          memory,
          "view",
          [user("other-window", "continue")],
          pending,
        ).size,
      ).toBe(0);
      expect(
        settleMessageIds(
          memory,
          "view",
          [latest, user("new", "continue")],
          pending,
        ).get("new"),
      ).toBe("pending");
    },
  );

  it.each([false, true])(
    "anchors a tool-only tail rather than claiming older users (direct=%s)",
    (direct) => {
      const memory = messageIdentity();
      const pending = [{ key: "pending", text: "continue", direct }];
      const tool: HistoryEntry = {
        ...user("latest-tool", "output"),
        kind: "tool",
      };
      settleMessageIds(memory, "view", [tool], pending);
      expect(
        settleMessageIds(
          memory,
          "view",
          [user("older", "continue"), tool],
          pending,
        ).size,
      ).toBe(0);
      expect(
        settleMessageIds(
          memory,
          "view",
          [tool, user("new", "continue")],
          pending,
        ).get("new"),
      ).toBe("pending");
    },
  );

  it("does not treat a cold history read as delivery of a daemon-held message", () => {
    const memory = messageIdentity();
    const pending = [{ key: "held:other-tab", text: "ok" }];
    settleMessageIds(memory, "view", [], pending, false);
    const old = user("old", "looks ok to me");
    expect(settleMessageIds(memory, "view", [old], pending, true).size).toBe(0);
    expect(
      settleMessageIds(memory, "view", [old, user("new", "ok")], pending).get(
        "new",
      ),
    ).toBe("held:other-tab");
  });

  it("drops refused or uncertain presentation candidates and isolates other views", () => {
    const memory = messageIdentity();
    settleMessageIds(
      memory,
      "view",
      [],
      [{ key: "held:cancelled", text: "hello" }],
    );
    settleMessageIds(memory, "view", [], []);
    expect(
      settleMessageIds(memory, "view", [user("later", "hello")], []).size,
    ).toBe(0);
    settleMessageIds(
      memory,
      "view",
      [],
      [{ key: "held:another", text: "hello" }],
    );
    expect(
      settleMessageIds(memory, "other", [user("later", "hello")], []).size,
    ).toBe(0);
  });
});
