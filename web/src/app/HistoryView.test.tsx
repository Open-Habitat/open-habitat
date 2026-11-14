import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Entry, TurnText, timelineItems } from "./HistoryView";
import type { HistoryEntry } from "./history";

const entry: HistoryEntry = {
  entry_key: "synthetic-1",
  kind: "user",
  content: {
    media_type: "text/plain",
    text: "Visible before outage",
    complete: false,
    truncated: true,
  },
};

afterEach(() => vi.unstubAllGlobals());

it.each([
  { blocks: undefined },
  { blocks: [] },
  { blocks: [{ type: "text" as const, text: "" }] },
])(
  "formats the person's own message as Markdown and copies it unchanged when blocks are $blocks",
  async ({ blocks }) => {
    const copy = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
    const text =
      "**worker** valmis\nToinen rivi <script>not executable</script>";
    const { container } = render(
      <Entry
        entry={{
          ...entry,
          blocks: blocks?.map((b) => ({ ...b, text })),
          content: { media_type: "text/plain", text, complete: true },
        }}
      />,
    );
    const content = screen.getByTestId("user-content");
    await waitFor(
      () => expect(content.querySelector("strong")?.textContent).toBe("worker"),
      { timeout: 10000 },
    );
    expect(content.querySelectorAll("p br")).toHaveLength(1);
    expect(container.querySelector("script")).toBeNull();
    fireEvent.click(screen.getByTestId("message-copy"));
    expect(copy).toHaveBeenLastCalledWith(text);
  },
);

it("does not claim a projected assistant message completed the Pi turn", () => {
  const assistant: HistoryEntry = {
    ...entry,
    kind: "assistant",
    content: {
      media_type: "text/markdown",
      text: "Katson ensin, mitä työtilassa on.",
      complete: true,
    },
  };
  const { container } = render(<Entry entry={assistant} />);
  const card = container.querySelector(".ah-message");
  expect(card?.textContent).toContain(assistant.content.text);
  expect(container.querySelector(".ah-message-reply")).toBeNull();
  expect(screen.getByRole("button")).toBeTruthy();
});

it("keeps orphan results accessible without grouping and bounds large output", () => {
  const tool: HistoryEntry = {
    ...entry,
    kind: "tool",
    content: {
      media_type: "text/plain",
      text: `bash\n${"x".repeat(14000)}`,
      complete: true,
    },
  };
  const items = timelineItems([
    tool,
    { ...tool, entry_key: "second" },
    {
      ...entry,
      entry_key: "future",
      kind: "unknown",
      content: {
        media_type: "text/plain",
        text: "<script>unsafe</script> question",
        complete: true,
      },
    },
  ]);
  expect(items).toHaveLength(3);
  render(items.map((item) => <div key={item.id}>{item.content}</div>));
  const rows = screen.getAllByTestId("history-tool-toggle");
  expect(rows).toHaveLength(2);
  expect(rows[0].getAttribute("aria-expanded")).toBe("false");
  for (const row of rows) fireEvent.click(row);
  expect(screen.getAllByTestId("history-output-toggle")).toHaveLength(2);
  expect(document.querySelector("script")).toBeNull();
  expect(document.querySelector(".ah-unknown")).toBeTruthy();
});

it("joins native call and saved result at the call position without reordering continuation", () => {
  const assistant: HistoryEntry = {
    ...entry,
    kind: "assistant",
    entry_key: "a",
    blocks: [
      { type: "text", text: "Ensin" },
      { type: "thinking", text: "Ajatus" },
      {
        type: "toolCall",
        tool_call_id: "c1",
        tool_name: "read",
        readable: true,
      },
      { type: "text", text: "Sitten" },
    ],
  };
  const result: HistoryEntry = {
    ...entry,
    kind: "tool",
    entry_key: "r",
    tool_call_id: "c1",
    is_error: true,
    content: { media_type: "text/plain", text: "read\nresult", complete: true },
    blocks: [{ type: "text", text: "result" }],
  };
  const items = timelineItems([assistant, result]);
  expect(items).toHaveLength(1);
  const { container } = render(items[0].content);
  // "Ensin" is an interim reply closing an empty stage; "Sitten" answers.
  expect(container.querySelector(".ah-turn-interim")).toBeTruthy();
  expect(
    container.querySelector(".ah-message-reply:not(.ah-message-interim)"),
  ).toBeTruthy();
  fireEvent.click(screen.getByTestId("history-stage-toggle"));
  expect(container.textContent).toMatch(/Ensin.*read.*Sitten/s);
  expect(screen.getAllByTestId("history-tool-toggle")).toHaveLength(1);
  fireEvent.click(screen.getByTestId("history-tool-toggle"));
  expect(container.textContent).toContain("result");
  expect(container.querySelector("[data-state=failed]")).toBeTruthy();
});

it("renders safely projected visible extension content without raw unknown payloads", () => {
  const { container } = render(
    <Entry
      entry={{
        ...entry,
        kind: "unknown",
        entry_key: "extension",
        blocks: [{ type: "text", text: "Plan saved" }],
        content: {
          media_type: "text/plain",
          text: "untrusted raw",
          complete: true,
        },
      }}
    />,
  );
  expect(container.textContent).toContain("Plan saved");
  expect(container.textContent).not.toContain("untrusted raw");
});

it("hides native startup model metadata", () => {
  const model: HistoryEntry = {
    ...entry,
    kind: "model_change",
    content: { ...entry.content, text: "openai/gpt-5-codex" },
  };
  expect(timelineItems([model])).toEqual([]);
});

it("keeps a real model switch before the first prompt and uses an unknown baseline silently", () => {
  const model = (entry_key: string, text: string): HistoryEntry => ({
    ...entry,
    entry_key,
    kind: "model_change",
    content: { ...entry.content, text },
  });
  expect(
    timelineItems([
      model("initial", "claude-bridge/claude-opus-5-5"),
      model("repeat", "claude-bridge/claude-opus-5-5"),
      model("change", "claude-bridge/claude-fable-5-1"),
    ]).map((item) => item.id),
  ).toEqual(["change"]);
  // A history window starting mid-session cannot invent the previous setting.
  expect(
    timelineItems([
      entry,
      model("first-seen", "claude-bridge/claude-fable-5-1"),
    ]).map((item) => item.id),
  ).toEqual([entry.entry_key]);
});

it("pages one long text block without exposing its other fields", async () => {
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const fetch = vi.fn((_url: string) => pending);
  vi.stubGlobal("fetch", fetch);
  render(
    <Entry
      agentId="pi:11111111-1111-4111-8111-111111111111"
      revision="rev1"
      entry={{
        ...entry,
        kind: "assistant",
        blocks: [
          { type: "text", text: "Visible before outage", readable: true },
        ],
      }}
    />,
  );
  fireEvent.click(screen.getByTestId("history-block-load"));
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  expect(fetch.mock.calls[0][0]).toContain(
    "/entries/synthetic-1/blocks/0?revision=rev1&offset=0&limit_bytes=65536",
  );
  finish(
    new Response(
      JSON.stringify({
        schema_version: 1,
        agent_id: "pi:11111111-1111-4111-8111-111111111111",
        native_revision: "rev1",
        entry_key: "synthetic-1",
        block_index: 0,
        offset: 0,
        chunk: {
          media_type: "text/plain",
          text: "Visible before outage continued text",
          complete: true,
        },
      }),
      { headers: { "content-type": "application/json" } },
    ),
  );
  await waitFor(() =>
    expect(
      screen.getByText("Visible before outage continued text"),
    ).toBeTruthy(),
  );
});

it("renders ordered typed blocks without exposing redacted or unknown payloads", () => {
  const { container } = render(
    <Entry
      entry={{
        ...entry,
        kind: "assistant",
        model: "synthetic",
        blocks: [
          { type: "thinking", redacted: true },
          { type: "text", text: "First" },
          { type: "toolCall", tool_call_id: "c1", tool_name: "read" },
          { type: "image", mime_type: "image/png" },
          { type: "unknown" },
          { type: "text", text: "Last" },
        ],
        content: {
          media_type: "text/plain",
          text: "unchecked-secret",
          complete: true,
        },
      }}
    />,
  );
  const blocks = container.querySelector(".ah-ordered-blocks");
  expect(blocks?.textContent).toMatch(/First.*read.*image\/png.*Last/s);
  expect(container.textContent).not.toContain("unchecked-secret");
});

it("shows image-only user prompts and full text when typed blocks were truncated", () => {
  const { container } = render(
    <>
      <Entry
        entry={{
          ...entry,
          blocks: [{ type: "image", mime_type: "image/png" }],
          content: { media_type: "text/plain", text: "", complete: true },
        }}
      />
      <Entry
        entry={{
          ...entry,
          entry_key: "long",
          kind: "assistant",
          blocks: [{ type: "text", text: "short" }],
          truncated_blocks: true,
          content: {
            media_type: "text/plain",
            text: "full assistant text",
            complete: true,
          },
        }}
      />
    </>,
  );
  expect(container.textContent).toContain("image/png");
  expect(container.textContent).toContain("short");
  expect(container.textContent).not.toContain("full assistant text");
});

it.each(["user", "assistant"] as const)(
  "only hides the dimension suffix for a native image in a %s entry",
  (kind) => {
    const text =
      "Look\n\n[Image: original 1170x2532, displayed at 924x2000. Multiply coordinates by 1.27 to map to original image.]";
    const { container } = render(
      <Entry
        entry={{
          ...entry,
          kind,
          blocks: [
            { type: "text", text },
            { type: "image", mime_type: "image/png" },
          ],
          content: { media_type: "text/plain", text, complete: true },
        }}
      />,
    );
    expect(container.textContent).toContain("Look");
    expect(container.textContent?.includes("Multiply coordinates")).toBe(
      kind === "assistant",
    );
  },
);

it("shows an attached image as its chip without Pi's dimension note", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const text = `Katso\n![shot.png](/api/v1/attachments/${id})\nAttachment path: /home/p/attachments/${id}\n\n[Image: original 1170x2532, displayed at 924x2000. Multiply coordinates by 1.27 to map to original image.]`;
  const { container } = render(
    <Entry
      agentId="pi:11111111-1111-4111-8111-111111111111"
      revision="rev1"
      entry={{
        ...entry,
        blocks: [
          { type: "text", text },
          { type: "image", mime_type: "image/png", readable: true },
        ],
        content: { media_type: "text/plain", text, complete: true },
      }}
    />,
  );
  expect(screen.getAllByTestId("attachment-chip")).toHaveLength(1);
  expect(screen.queryByTestId("history-block-load")).toBeNull();
  expect(container.textContent).not.toContain("image/png");
  expect(screen.getByTestId("user-content").textContent).toBe("Katso");
});

it("keeps redacted and unknown blocks inert while loading a result image by its own index", async () => {
  const fetch = vi.fn(
    async (_url: string) =>
      new Response(
        JSON.stringify({
          schema_version: 1,
          agent_id: "pi:11111111-1111-4111-8111-111111111111",
          native_revision: "rev2",
          entry_key: "result",
          block_index: 2,
          offset: 0,
          chunk: { media_type: "image/png", data: "QUJD", complete: true },
        }),
        { headers: { "content-type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const { container } = render(
    <Entry
      agentId="pi:11111111-1111-4111-8111-111111111111"
      revision="rev2"
      entry={{
        ...entry,
        entry_key: "result",
        kind: "tool",
        tool_call_id: "call",
        blocks: [
          { type: "thinking", redacted: true },
          { type: "unknown" },
          { type: "image", mime_type: "image/png", readable: true },
        ],
        content: { media_type: "text/plain", text: "result", complete: true },
      }}
    />,
  );
  fireEvent.click(screen.getByTestId("history-tool-toggle"));
  expect(screen.getAllByTestId("history-block-load")).toHaveLength(1);
  fireEvent.click(screen.getByTestId("history-block-load"));
  await waitFor(() =>
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "data:image/png;base64,QUJD",
    ),
  );
  expect(container.querySelector("img")?.className).toBe("ah-history-image");
  expect(fetch.mock.calls[0][0]).toContain("/entries/result/blocks/2?");
  expect(container.textContent).not.toContain("secret");
});

it("rejects a mismatched block response without replacing the visible prefix", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            schema_version: 1,
            agent_id: "pi:11111111-1111-4111-8111-111111111111",
            native_revision: "stale",
            entry_key: "synthetic-1",
            block_index: 0,
            offset: 0,
            chunk: { media_type: "text/plain", text: "wrong", complete: true },
          }),
          { headers: { "content-type": "application/json" } },
        ),
    ),
  );
  render(
    <Entry
      entry={{
        ...entry,
        kind: "assistant",
        blocks: [{ type: "text", text: "prefix", readable: true }],
      }}
      agentId="pi:11111111-1111-4111-8111-111111111111"
      revision="rev1"
    />,
  );
  fireEvent.click(screen.getByTestId("history-block-load"));
  await waitFor(() =>
    expect(document.querySelector(".ah-notice.ah-tone-warning")).toBeTruthy(),
  );
  expect(screen.getByText("prefix")).toBeTruthy();
  expect(screen.queryByText("wrong")).toBeNull();
});

it("uses the saved entry revision for a live block even when the window still has an older revision", async () => {
  const fetch = vi.fn(
    async (_url: string) =>
      new Response(
        JSON.stringify({
          schema_version: 1,
          agent_id: "pi:11111111-1111-4111-8111-111111111111",
          native_revision: "new",
          entry_key: "synthetic-1",
          block_index: 0,
          offset: 0,
          chunk: { media_type: "text/plain", text: "complete", complete: true },
        }),
        { headers: { "content-type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetch);
  render(
    <Entry
      entry={{
        ...entry,
        kind: "assistant",
        native_revision: "new",
        blocks: [{ type: "text", text: "prefix", readable: true }],
      }}
      agentId="pi:11111111-1111-4111-8111-111111111111"
      revision="old"
    />,
  );
  fireEvent.click(screen.getByTestId("history-block-load"));
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  expect(fetch.mock.calls[0][0]).toContain("revision=new");
  await waitFor(() => expect(screen.getByText("complete")).toBeTruthy());
});

it("loads a multi-chunk image after one explicit action", async () => {
  const fetch = vi.fn(async (url: string) => {
    const offset = new URL(url, "https://synthetic.invalid").searchParams.get(
      "offset",
    );
    return new Response(
      JSON.stringify({
        schema_version: 1,
        agent_id: "pi:11111111-1111-4111-8111-111111111111",
        native_revision: "rev-image",
        entry_key: "img",
        block_index: 0,
        offset: Number(offset),
        chunk:
          offset === "0"
            ? {
                media_type: "image/png",
                data: "QUJD",
                complete: false,
                next_offset: 4,
              }
            : { media_type: "image/png", data: "REVG", complete: true },
      }),
      { headers: { "content-type": "application/json" } },
    );
  });
  vi.stubGlobal("fetch", fetch);
  const { container } = render(
    <Entry
      agentId="pi:11111111-1111-4111-8111-111111111111"
      revision="rev-image"
      entry={{
        ...entry,
        entry_key: "img",
        kind: "user",
        blocks: [{ type: "image", mime_type: "image/png", readable: true }],
        content: { media_type: "text/plain", text: "", complete: true },
      }}
    />,
  );
  fireEvent.click(screen.getByTestId("history-block-load"));
  await waitFor(() =>
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "data:image/png;base64,QUJDREVG",
    ),
  );
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("renders a long user block only once inside the user bubble", () => {
  const { container } = render(
    <Entry
      agentId="pi:11111111-1111-4111-8111-111111111111"
      revision="rev1"
      entry={{
        ...entry,
        blocks: [{ type: "text", text: "single prefix", readable: true }],
        content: {
          media_type: "text/plain",
          text: "single prefix",
          complete: false,
          truncated: true,
        },
      }}
    />,
  );
  expect(container.querySelectorAll(".ah-message")).toHaveLength(1);
  expect(container.textContent?.split("single prefix")).toHaveLength(2);
  expect(screen.getByTestId("history-block-load")).toBeTruthy();
});

it("labels a saved typed tool result complete while its block can still be read", () => {
  const { container } = render(
    <Entry
      agentId="pi:11111111-1111-4111-8111-111111111111"
      revision="rev1"
      entry={{
        ...entry,
        kind: "tool",
        blocks: [{ type: "text", text: "first", readable: true }],
        content: {
          media_type: "text/plain",
          text: "tool\nfirst",
          complete: false,
          truncated: true,
        },
      }}
    />,
  );
  expect(container.querySelector("[data-state=succeeded]")).toBeTruthy();
  expect(screen.queryByTestId("history-output-toggle")).toBeNull();
  fireEvent.click(screen.getByTestId("history-tool-toggle"));
  expect(screen.getByTestId("history-block-load")).toBeTruthy();
});

it("renders saved local command output and marker metadata without treating either as an assistant reply", () => {
  const command: HistoryEntry = {
    ...entry,
    kind: "bash",
    entry_key: "command-1",
    exit_code: 2,
    output_truncated: true,
    exclude_from_context: true,
    blocks: [
      { type: "text", text: "echo test" },
      {
        type: "text",
        text: "failure\n# literal heading\n<script>not code</script>",
      },
    ],
  };
  const marker: HistoryEntry = {
    ...entry,
    kind: "unknown",
    entry_key: "marker-1",
    entry_type: "session_info",
    blocks: [{ type: "text", text: "Synthetic session" }],
  };
  const { container } = render(
    timelineItems([command, marker]).map((item) => (
      <div key={item.id}>{item.content}</div>
    )),
  );
  expect(
    container.querySelector(".ah-cmd-run")?.getAttribute("data-exit-code"),
  ).toBe("2");
  expect(
    container
      .querySelector(".ah-cmd-run")
      ?.getAttribute("data-exclude-from-context"),
  ).toBe("true");
  expect(
    container.querySelector('.ah-cmd-run [data-kind="error"]'),
  ).toBeTruthy();
  expect(container.querySelector(".ah-pi-boundary")).toBeTruthy();
  expect(container.querySelector(".ah-crow-bang")).toBeTruthy();
  expect(
    container
      .querySelector('[data-testid="command-run-toggle"]')
      ?.getAttribute("aria-expanded"),
  ).toBe("true");
  expect(container.textContent).toContain("failure");
  expect(container.textContent).toContain("# literal heading");
  expect(container.querySelector("h1")).toBeNull();
  expect(container.querySelector(".ah-unknown")).toBeNull();
  expect(container.querySelector("script")).toBeNull();
});

it("keeps consecutive native replies as separate foldable threads", () => {
  const one: HistoryEntry = {
    ...entry,
    kind: "assistant",
    entry_key: "one",
    blocks: [{ type: "text", text: "Ensimmäinen vastaus" }],
    content: { ...entry.content, text: "Ensimmäinen vastaus" },
  };
  const two: HistoryEntry = {
    ...one,
    entry_key: "two",
    blocks: [{ type: "text", text: "Toinen vastaus" }],
    content: { ...one.content, text: "Toinen vastaus" },
  };
  const items = timelineItems([one, two]);
  expect(items).toHaveLength(2);
  render(items.map((item) => <div key={item.id}>{item.content}</div>));
  expect(screen.getAllByTestId("agent-turn")).toHaveLength(2);
});

it("reads a call's arguments only when its stage and row are opened", async () => {
  const agentId = "pi:11111111-1111-4111-8111-111111111111";
  const response = {
    schema_version: 1,
    agent_id: agentId,
    native_revision: "rev",
    entry_key: "a",
    block_index: 0,
    offset: 0,
    chunk: {
      media_type: "text/plain",
      text: '{"command":"echo ok"}',
      complete: true,
    },
  };
  const fetch = vi.fn().mockImplementation(
    async () =>
      new Response(JSON.stringify(response), {
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetch);
  const call: HistoryEntry = {
    ...entry,
    entry_key: "a",
    kind: "assistant",
    blocks: [
      {
        type: "toolCall",
        tool_name: "bash",
        tool_call_id: "c",
        readable: true,
      },
    ],
    content: { ...entry.content, text: "" },
  };
  render(timelineItems([call], undefined, agentId, "rev")[0].content);
  // A closed stage names no command, so it reads nothing.
  const row = screen.getByTestId("history-stage-toggle");
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(row);
  fireEvent.click(screen.getByTestId("history-tool-toggle"));
  expect(await screen.findByText(/\$ echo ok/)).toBeTruthy();
  for (const [url] of fetch.mock.calls)
    expect(url).toContain("/entries/a/blocks/0?");
});

it("hides startup and no-op settings while preserving real changes and compaction", () => {
  const model = (key: string, text: string): HistoryEntry => ({
    ...entry,
    entry_key: key,
    kind: "model_change",
    content: { ...entry.content, text },
  });
  const thinking = (key: string, text: string): HistoryEntry => ({
    ...entry,
    entry_key: key,
    kind: "unknown",
    entry_type: "thinking_level_change",
    content: { ...entry.content, text },
  });
  const entries: HistoryEntry[] = [
    model("m1", "claude-bridge/claude-opus-5-5"),
    thinking("t1", "medium"),
    { ...entry, entry_key: "user1" },
    model("noop", "claude-bridge/claude-opus-5-5"),
    thinking("noop-thinking", "medium"),
    model("m2", "claude-bridge/claude-fable-5-1"),
    thinking("t2", "high"),
    {
      ...entry,
      entry_key: "compact",
      kind: "unknown",
      entry_type: "compaction",
      content: { ...entry.content, text: "Tiivistetty" },
    },
    {
      ...entry,
      entry_key: "name",
      kind: "unknown",
      entry_type: "session_info",
    },
  ];
  const items = timelineItems(entries);
  expect(items.map((item) => item.id)).toEqual([
    "user1",
    "m2",
    "t2",
    "compact",
  ]);
  const view = render(
    items.map((item) => <div key={item.id}>{item.content}</div>),
  );
  expect(view.container.querySelectorAll(".ah-session-settings")).toHaveLength(
    3,
  );
  expect(view.container.textContent).not.toContain("claude-bridge/");
  expect(view.container.textContent).toMatch(/Opus 5.5.*Fable 5.1/s);
  expect(
    view.container.querySelectorAll('[data-testid="thinking-change"]'),
  ).toHaveLength(1);
  expect(view.container.querySelector(".ah-unknown")).toBeNull();
});

it("splits a settled turn into stages closed by its interim replies", () => {
  const user: HistoryEntry = {
    ...entry,
    entry_key: "u",
    timestamp: "2026-10-13T10:00:00Z",
  };
  const call = (
    key: string,
    id: string,
    command: string,
    timestamp: string,
  ): HistoryEntry => ({
    ...entry,
    entry_key: key,
    kind: "assistant",
    model: "claude-opus-5-5",
    timestamp,
    blocks: [
      { type: "thinking", text: "Tarkistan" },
      {
        type: "toolCall",
        tool_call_id: id,
        tool_name: "bash",
        text: JSON.stringify({ command }),
      },
    ],
  });
  const result = (key: string, id: string): HistoryEntry => ({
    ...entry,
    entry_key: key,
    kind: "tool",
    tool_call_id: id,
    blocks: [{ type: "text", text: "ok" }],
  });
  const items = timelineItems([
    user,
    call("a1", "c1", "git status --short", "2026-10-13T10:00:20Z"),
    result("r1", "c1"),
    {
      ...entry,
      entry_key: "a2",
      kind: "assistant",
      model: "claude-opus-5-5",
      timestamp: "2026-10-13T10:00:41Z",
      blocks: [
        { type: "text", text: "Työpuu on puhdas." },
        {
          type: "toolCall",
          tool_call_id: "c2",
          tool_name: "bash",
          text: JSON.stringify({ command: "git pull --rebase\necho" }),
        },
      ],
    },
    result("r2", "c2"),
    {
      ...entry,
      entry_key: "a3",
      kind: "assistant",
      model: "claude-opus-5-5",
      timestamp: "2026-10-13T10:01:07Z",
      // An interim reply right before the answer, with no work between.
      blocks: [
        { type: "text", text: "Pull meni läpi." },
        { type: "text", text: "Valmis." },
      ],
    },
  ]);
  expect(items.map((item) => item.id)).toEqual(["u", "turn:u"]);
  const view = render(
    items.map((item) => <div key={item.id}>{item.content}</div>),
  );
  const rows = view.getAllByTestId("history-stage-toggle");
  expect(rows).toHaveLength(2);
  // Each closed stage runs from the saved entry before it to the one that
  // closed it: the person's message to the first reply, then on to the next.
  expect(rows.map((row) => row.dataset.elapsedSeconds)).toEqual(["41", "26"]);
  for (const row of rows) expect(row.textContent).not.toContain("git ");
  expect(
    rows.every((row) => row.getAttribute("aria-expanded") === "false"),
  ).toBe(true);
  expect(view.container.querySelectorAll(".ah-turn-interim")).toHaveLength(2);
  expect(
    view.container.querySelectorAll(
      ".ah-message-reply:not(.ah-message-interim)",
    ),
  ).toHaveLength(1);
  // The model is named in the conversation header, not on the answer.
  expect(view.queryByText("claude-opus-5-5")).toBeNull();
  // The settled turn names no duration: its head row is gone.
  expect(view.container.querySelector(".ah-turn-clock")).toBeNull();
  expect(view.container.querySelector(".ah-turn-strip")).toBeNull();
});

it("continues the saved part of a running turn with its live tail", () => {
  const user: HistoryEntry = { ...entry, entry_key: "u" };
  const saved: HistoryEntry = {
    ...entry,
    entry_key: "a1",
    kind: "assistant",
    blocks: [
      { type: "text", text: "Katson ensin." },
      { type: "toolCall", tool_call_id: "c1", tool_name: "bash" },
    ],
  };
  const live = {
    working: true,
    activity: "Ajaa bash",
    duration: "0:04",
    steps: [
      {
        kind: "text" as const,
        key: "l1",
        text: "Kirjoitan",
        node: <p>Kirjoitan</p>,
      },
    ],
  };
  const items = timelineItems(
    [user, saved],
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    live,
  );
  expect(items.map((item) => [item.id, !!item.live])).toEqual([
    ["u", false],
    ["turn:u", true],
  ]);
  const view = render(items[1].content);
  // One turn: the saved interim reply, then the running stage and its text.
  expect(view.getAllByTestId("agent-turn")).toHaveLength(1);
  expect(view.container.querySelector(".ah-turn-interim")).toBeTruthy();
  expect(view.getByText("Katson ensin.")).toBeTruthy();
  expect(
    view.container.querySelector(".ah-message-reply:not(.ah-message-interim)"),
  ).toBeNull();
  expect(view.getByRole("status")).toBeTruthy();
  // Pi is writing after the call: that stage is still the running one, so it
  // is behind Näytä työ and the text streams as Vastaa.
  expect(view.queryByTestId("history-stage-toggle")).toBeNull();
  expect(
    view.getByTestId("turn-work-toggle").getAttribute("aria-expanded"),
  ).toBe("false");
  expect(view.getByText("Kirjoitan")).toBeTruthy();
  // Before any answer is saved the live turn follows the person's message
  // under the same identity; a closed turn is not continued.
  expect(
    timelineItems(
      [user],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      live,
    ).map((item) => [item.id, !!item.live]),
  ).toEqual([
    ["u", false],
    ["turn:u", true],
  ]);
  const closed = timelineItems(
    [user, { ...saved, blocks: [{ type: "text", text: "Valmis." }] }],
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    live,
  );
  expect(closed.some((item) => item.live)).toBe(false);
});

it("shows the real pi-processes XML content as text, not discarded HTML", async () => {
  const content =
    '<process_event type="lifecycle" kind="success">\n  <summary>Build finished</summary>\n  <command>npm test</command>\n</process_event>';
  const { container } = render(
    <Entry
      entry={{
        ...entry,
        kind: "unknown",
        blocks: [{ type: "text", text: content }],
      }}
    />,
  );
  expect(container.textContent).toContain("Build finished");
  expect(container.querySelector("pre")?.textContent).toBe(content);
  expect(container.querySelector("process_event")).toBeNull();
});

it("copies a portable invocation, including for a skill-only message, without source metadata", () => {
  const copy = vi.fn();
  vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
  const skill: HistoryEntry = {
    ...entry,
    skill: { name: "review" },
    content: {
      media_type: "text/plain",
      text: "My extra text",
      complete: true,
    },
    blocks: [{ type: "text", text: "# Review\n\nCheck the interface." }],
  };
  const view = render(<Entry entry={skill} />);
  fireEvent.click(view.getByTestId("message-copy"));
  expect(copy).toHaveBeenLastCalledWith("/skill:review My extra text");
  view.rerender(
    <Entry entry={{ ...skill, content: { ...skill.content, text: "" } }} />,
  );
  fireEvent.click(view.getByTestId("message-copy"));
  expect(copy).toHaveBeenLastCalledWith("/skill:review");
});

it("marks only the turn Pi saved as aborted, and its interrupted tool as stopped, not failed", () => {
  const user = (key: string): HistoryEntry => ({ ...entry, entry_key: key });
  const call = (key: string, id: string): HistoryEntry => ({
    ...entry,
    entry_key: key,
    kind: "assistant",
    stop_reason: "toolUse",
    blocks: [
      {
        type: "toolCall",
        tool_call_id: id,
        tool_name: "bash",
        text: JSON.stringify({ command: "git log README.md" }),
      },
    ],
  });
  const failed = (
    key: string,
    id: string,
    failure_cause: HistoryEntry["failure_cause"],
  ): HistoryEntry => ({
    ...entry,
    entry_key: key,
    kind: "tool",
    tool_call_id: id,
    is_error: true,
    failure_cause,
    blocks: [{ type: "text", text: failure_cause?.status_line ?? "" }],
  });
  const end = (key: string, stop_reason: string): HistoryEntry => ({
    ...entry,
    entry_key: key,
    kind: "assistant",
    stop_reason,
    timestamp: "2026-10-24T09:43:03Z",
    content: { media_type: "text/plain", text: "", complete: true },
    blocks: [],
  });
  const items = timelineItems([
    user("u1"),
    call("a1", "c1"),
    failed("r1", "c1", { kind: "aborted", status_line: "Command aborted" }),
    end("a2", "aborted"),
    user("u2"),
    call("a3", "c2"),
    failed("r2", "c2", {
      kind: "exit",
      amount: 1,
      status_line: "Command exited with code 1",
    }),
    end("a4", "error"),
  ]);
  const view = render(
    items.map((item) => <div key={item.id}>{item.content}</div>),
  );
  const turns = view.getAllByTestId("agent-turn");
  expect(turns).toHaveLength(2);
  const [stopped, errored] = turns;
  expect(stopped.querySelector('[data-testid="turn-stopped"] time')).not.toBe(
    null,
  );
  expect(
    stopped
      .querySelector('[data-testid="history-stage-toggle"]')
      ?.getAttribute("data-failures"),
  ).toBe("0");
  // A model error is not a stop, and a tool that failed on its own still did.
  expect(errored.querySelector('[data-testid="turn-stopped"]')).toBeNull();
  expect(
    errored
      .querySelector('[data-testid="history-stage-toggle"]')
      ?.getAttribute("data-failures"),
  ).toBe("1");
  fireEvent.click(
    stopped.querySelector('[data-testid="history-stage-toggle"]') as Element,
  );
  expect(
    stopped
      .querySelector('[data-testid="tool-row"]')
      ?.getAttribute("data-state"),
  ).toBe("cancelled");
});

it.each([
  "Failed to authenticate: OAuth session expired and could not be refreshed",
  "Invalid API key · Fix external API key",
])("preserves the native failed stop for %s", (text) => {
  const items = timelineItems([
    {
      ...entry,
      kind: "assistant",
      stop_reason: "error",
      content: { media_type: "text/plain", text, complete: true },
      blocks: [{ type: "text", text }],
    },
  ]);
  const view = render(
    items.map((item) => <div key={item.id}>{item.content}</div>),
  );
  expect(view.getByTestId("stage-reply").getAttribute("data-reply-role")).toBe(
    "failed",
  );
  expect(
    view.container.querySelector('[data-reply-complete="true"]'),
  ).toBeNull();
});

it("keeps a reply's elements when its streamed text becomes a saved preview", () => {
  const text = `Ensimmäinen kappale.\n\n${"Pitkä jatko. ".repeat(40)}`;
  const { container, rerender } = render(
    <TurnText block={{ type: "text", text }} index={0} entryKey="live-1" />,
  );
  const first = container.querySelector("p");
  rerender(
    <TurnText
      block={{ type: "text", text: text.slice(0, 200), readable: true }}
      index={0}
      entryKey="native-1"
      agentId="pi:agent"
      revision="r1"
    />,
  );
  expect(container.querySelector("p")).toBe(first);
  expect(screen.getByTestId("history-block-load")).toBeTruthy();
});

it("says a refused sign-in in one short row, without the provider's words", () => {
  const text =
    "Failed to authenticate: OAuth session expired and could not be refreshed";
  const failed: HistoryEntry = {
    ...entry,
    kind: "assistant",
    stop_reason: "error",
    refused_by: "claude-bridge",
    content: { media_type: "text/plain", text, complete: true },
    blocks: [{ type: "text", text }],
  };
  const view = render(
    timelineItems([failed]).map((item) => (
      <div key={item.id}>{item.content}</div>
    )),
  );
  expect(view.getByTestId("turn-short").textContent).toBe(
    "Claude-kirjautuminen on vanhentunut. Viestiäsi ei käsitelty.",
  );
  expect(view.container.textContent).not.toContain("OAuth session");
});

it("folds many large pictures into one row until the person opens them", () => {
  const picture = {
    type: "image" as const,
    mime_type: "image/png",
    readable: true,
    bytes: 4 * 1024 * 1024,
  };
  const { rerender } = render(
    <Entry
      agentId="pi:11111111-1111-4111-8111-111111111111"
      revision="rev1"
      entry={{
        ...entry,
        entry_key: "pictures",
        blocks: [{ type: "text", text: "Kuvat" }, ...Array(20).fill(picture)],
      }}
    />,
  );
  const row = screen.getByTestId("history-pictures-folded");
  expect(row.textContent).toContain("20 kuvaa, yhteensä 80 Mt");
  expect(screen.queryAllByTestId("history-block-load")).toHaveLength(0);
  fireEvent.click(screen.getByTestId("history-pictures-open"));
  expect(screen.queryByTestId("history-pictures-folded")).toBeNull();
  expect(screen.getAllByTestId("history-block-load")).toHaveLength(20);
  // A few pictures, or small ones, show as before.
  rerender(
    <Entry
      agentId="pi:11111111-1111-4111-8111-111111111111"
      revision="rev1"
      entry={{
        ...entry,
        entry_key: "few",
        blocks: [{ type: "text", text: "Kuvat" }, picture, picture],
      }}
    />,
  );
  expect(screen.queryByTestId("history-pictures-folded")).toBeNull();
});

it("says a server restart, not the person, ended a turn the restart cut", () => {
  const user = (key: string): HistoryEntry => ({ ...entry, entry_key: key });
  const aborted = (key: string): HistoryEntry => ({
    ...entry,
    entry_key: key,
    kind: "assistant",
    stop_reason: "aborted",
    content: { media_type: "text/plain", text: "", complete: true },
    blocks: [],
  });
  const answer = (key: string): HistoryEntry => ({
    ...entry,
    entry_key: key,
    kind: "assistant",
    stop_reason: "stop",
    content: { media_type: "text/plain", text: "Valmis", complete: true },
    blocks: [{ type: "text", text: "Valmis" }],
  });
  const catchUp = (
    key: string,
    cause: "restart" | "idle",
    interrupted_turn: boolean,
  ): HistoryEntry => ({
    ...entry,
    entry_key: key,
    kind: "unknown",
    restart: {
      stopped: { cause, at: "2026-11-14T04:10:20Z" },
      interrupted_turn,
      processes: [],
      runs: [],
      still_running: [],
    },
  });
  const stops = (items: ReturnType<typeof timelineItems>) =>
    Array.from(
      render(
        items.map((item) => <div key={item.id}>{item.content}</div>),
      ).container.querySelectorAll('[data-testid="turn-stopped"]'),
    ).map((row) => row.getAttribute("data-by"));
  // The restart's catch-up says the turn never finished: the abort before it
  // was the restart's. A person's stop the restart did not interrupt stays
  // theirs, and so does one after an earlier restart.
  expect(
    stops(
      timelineItems([
        user("u1"),
        aborted("a1"),
        user("u2"),
        catchUp("c1", "restart", true),
        answer("a2"),
        user("u3"),
        aborted("a3"),
        user("u4"),
        catchUp("c2", "restart", false),
        answer("a4"),
        user("u5"),
        aborted("a5"),
      ]),
    ),
  ).toEqual(["restart", "person", "person"]);
  // While it still rests, the snapshot says the latest turn was cut.
  const resting = [user("u1"), aborted("a1")];
  expect(
    stops(
      timelineItems(
        resting,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true,
      ),
    ),
  ).toEqual(["restart"]);
  expect(stops(timelineItems(resting))).toEqual(["person"]);
});
