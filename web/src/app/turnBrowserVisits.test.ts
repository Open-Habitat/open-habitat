import { describe, expect, it } from "vitest";
import { turnBrowserVisits } from "./turnBrowserVisits";
import type { ToolStep } from "./turnChanges";

const result = (browser_action: string, fields: Record<string, unknown> = {}) =>
  JSON.stringify(
    {
      schema_version: 1,
      data: {
        cli_version: "test",
        result: {
          browser_action,
          tab: "A",
          url: "https://stays.example/trips/123?token=secret#private",
          title: "Trip",
          ...fields,
        },
      },
      warnings: [],
    },
    null,
    2,
  );
const step = (callId: string, output: string, at = 100): ToolStep => ({
  callId,
  tool: "bash",
  args: JSON.stringify({ command: "open-habitat agent browser …" }),
  output,
  failed: false,
  at,
});

describe("turnBrowserVisits", () => {
  it("counts visits rather than observations, preserves revisits and groups sites across tabs", () => {
    const steps = [
      step("1", result("goto")),
      step("2", result("text")),
      step(
        "3",
        result("click", {
          selector: "#expand",
          source_url: "https://stays.example/trips/123?token=secret#private",
          source_title: "Trip",
        }),
      ),
      step(
        "4",
        result("click", {
          selector: "#next",
          source_url: "https://stays.example/trips/123?token=secret#private",
          source_title: "Trip",
          url: "https://help.stays.example/guide?q=hidden",
          title: "Guide",
        }),
        200,
      ),
      step("5", result("goto", { tab: "B" }), 300),
      step("6", result("close", { closed: true }), 400),
    ];
    const visits = turnBrowserVisits(steps, "owner");
    expect(visits?.summary).toEqual({
      sites: ["https://stays.example", "https://help.stays.example"],
      pageCount: 3,
      downloadCount: 0,
      actionCount: 2,
      startedAt: 100,
      endedAt: 400,
    });
    expect(visits?.detail?.pages).toEqual([
      {
        callId: "1",
        at: 100,
        origin: "https://stays.example",
        path: "/trips/123",
        title: "Trip",
      },
      {
        callId: "4",
        at: 200,
        origin: "https://help.stays.example",
        path: "/guide",
        title: "Guide",
      },
      {
        callId: "5",
        at: 300,
        origin: "https://stays.example",
        path: "/trips/123",
        title: "Trip",
      },
    ]);
    expect(visits?.detail?.actions[1].page?.path).toBe("/trips/123");
    expect(JSON.stringify(visits)).not.toMatch(/token|secret|private|hidden/);
  });

  it("does not count anchor or hash-route clicks, but does count query navigation", () => {
    const visits = turnBrowserVisits(
      [
        step(
          "1",
          result("click", {
            source_url: "https://stays.example/trips",
            source_title: "Trips",
            url: "https://stays.example/trips#",
          }),
        ),
        step(
          "2",
          result("click", {
            source_url: "https://stays.example/trips#one",
            source_title: "Trips",
            url: "https://stays.example/trips#/two",
          }),
        ),
        step(
          "3",
          result("click", {
            source_url: "https://stays.example/trips?q=%23one#top",
            source_title: "Trips",
            url: "https://stays.example/trips?q=%23two#top",
          }),
        ),
      ],
      "owner",
    );
    expect(visits?.summary).toMatchObject({ pageCount: 1, actionCount: 3 });
    expect(visits?.detail?.pages[0].callId).toBe("3");
    expect(JSON.stringify(visits)).not.toMatch(/%23|#|one|two/);
  });

  it("lists downloads and selectors but never copies typed text, scripts, result values or download URLs", () => {
    const visits = turnBrowserVisits(
      [
        step(
          "1",
          result("download", {
            file_name: "receipt.pdf",
            target_folder: "/home/alice/Downloads",
            path: "/home/alice/Downloads/receipt.pdf",
            value: "download-secret",
          }),
        ),
        step(
          "2",
          result("type", {
            selector: "input[name=query]",
            value: "typed-secret",
            text: "typed-secret",
          }),
        ),
        step(
          "3",
          result("eval", { selector: "script-secret", value: "script-secret" }),
        ),
      ],
      "owner",
    );
    expect(visits?.detail?.downloads).toEqual([
      {
        callId: "1",
        at: 100,
        fileName: "receipt.pdf",
        targetFolder: "/home/alice/Downloads",
      },
    ]);
    expect(
      visits?.detail?.actions.map(({ kind, selector }) => ({ kind, selector })),
    ).toEqual([
      { kind: "type", selector: "input[name=query]" },
      { kind: "eval", selector: undefined },
    ]);
    expect(visits?.summary).toMatchObject({
      pageCount: 0,
      downloadCount: 1,
      actionCount: 2,
    });
    expect(JSON.stringify(visits)).not.toContain("secret");
  });

  it("returns only summary to participants, including those with full agent rights", () => {
    const steps = [
      step("1", result("goto")),
      step(
        "2",
        result("download", {
          file_name: "private.pdf",
          target_folder: "/private-folder",
        }),
      ),
      step("3", result("type", { selector: "#private-selector" })),
    ];
    const participant = turnBrowserVisits(steps, "participant");
    expect(participant?.summary).toEqual(
      turnBrowserVisits(steps, "owner")?.summary,
    );
    expect(participant).not.toHaveProperty("detail");
    expect(JSON.stringify(participant)).not.toMatch(
      /Trip|trips|private|selector|fileName|targetFolder/,
    );
  });

  it("handles multiple pretty envelopes in one bash call without parsing shell or eval contents", () => {
    const call = step(
      "1",
      `${result("goto")}\n${result("eval", { value: { misleading: '} { \\"', browser_action: "goto" } })}\n${result("goto")}\n`,
    );
    expect(turnBrowserVisits([call, call], "owner")?.summary).toMatchObject({
      pageCount: 2,
      actionCount: 1,
    });
  });

  it("does not invent evidence from failed, missing, truncated, old, or unrelated output", () => {
    for (const output of [
      "",
      "{}",
      result("goto").slice(0, -1),
      `log\n${result("goto")}`,
      `${result("goto")}\n[truncated]`,
      JSON.stringify({
        schema_version: 1,
        data: { cli_version: "old", result: { tab: "A", loaded: true } },
      }),
      result("status"),
    ]) {
      expect(turnBrowserVisits([step("1", output)], "owner")).toBeUndefined();
    }
    expect(
      turnBrowserVisits(
        [{ ...step("1", result("goto")), failed: true }],
        "owner",
      ),
    ).toBeUndefined();
    expect(
      turnBrowserVisits(
        [{ ...step("1", result("goto")), tool: "read" }],
        "owner",
      ),
    ).toBeUndefined();
  });

  it("drops non-web pages and URL credentials, and never infers navigation from a click without before metadata", () => {
    const visits = turnBrowserVisits(
      [
        step("1", result("goto", { url: "file:///private/path" })),
        step(
          "2",
          result("goto", {
            url: "https://user:password@example.test/a?q=private#hidden",
          }),
        ),
        step("3", result("click", { selector: "#ok" })),
        step("4", result("goto", { url: "malformed" }), Number.NaN),
      ],
      "owner",
    );
    expect(visits?.summary.pageCount).toBe(1);
    expect(visits?.detail?.pages[0]).toMatchObject({
      origin: "https://example.test",
      path: "/a",
    });
    expect(JSON.stringify(visits)).not.toMatch(
      /password|user:|private|hidden|NaN/,
    );
  });

  const W1 = "0A1B2C3D4E5F60718293A4B5C6D7E8F9";
  const W2 = "F9E8D7C6B5A4938271605F4E3D2C1B0A";
  /** The browser's status, as `agent browser request` and `status` answer. */
  const status = (request?: { window: string; text: string }) =>
    JSON.stringify(
      {
        schema_version: 1,
        data: {
          cli_version: "test",
          result: {
            schema_version: 1,
            state: "running",
            skill_command: "open-habitat skill print browser",
            windows: [],
            ...(request ? { request: { ...request, age_ms: 0 } } : {}),
          },
        },
      },
      null,
      2,
    );
  const bash = (callId: string, command: string, output: string, at = 500) => ({
    ...step(callId, output, at),
    args: JSON.stringify({ command }),
  });

  it("links the owner's turn to the windows its commands acted in and the request it made", () => {
    const visits = turnBrowserVisits(
      [
        step("1", result("goto", { tab: W1 })),
        bash(
          "2",
          `open-habitat agent browser request --window ${W2} --text 'Vahvista' --json`,
          status({ window: W2, text: "Vahvista kirjautuminen" }),
          600,
        ),
      ],
      "owner",
    );
    expect(visits?.windows).toEqual([W1, W2]);
    expect(visits?.request).toEqual({
      callId: "2",
      at: 600,
      window: W2,
      text: "Vahvista kirjautuminen",
    });
    expect(visits?.summary.endedAt).toBe(600);
    // A participant gets neither: the live state is the owner's.
    const participant = turnBrowserVisits(
      [
        step("1", result("goto", { tab: W1 })),
        bash(
          "2",
          "open-habitat agent browser request --text x --json",
          status({ window: W2, text: "x" }),
        ),
      ],
      "participant",
    );
    expect(participant).not.toHaveProperty("windows");
    expect(participant).not.toHaveProperty("request");
  });

  it("tells a request from a look at the status only by the command, and a later clear ends it", () => {
    // A status that shows another conversation's request is not this turn's.
    expect(
      turnBrowserVisits(
        [
          bash(
            "1",
            "open-habitat agent browser status --json",
            status({ window: W2, text: "x" }),
          ),
        ],
        "owner",
      ),
    ).toBeUndefined();
    const cleared = turnBrowserVisits(
      [
        bash(
          "1",
          `open-habitat agent browser request --window ${W2} --text x --json`,
          status({ window: W2, text: "x" }),
        ),
        bash(
          "2",
          "open-habitat agent browser request --clear --json",
          status(),
        ),
      ],
      "owner",
    );
    expect(cleared).toBeDefined();
    expect(cleared?.request).toBeUndefined();
    expect(cleared?.summary.pageCount).toBe(0);
  });
});
