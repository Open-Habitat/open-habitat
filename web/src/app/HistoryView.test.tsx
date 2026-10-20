import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Entry, timelineItems } from "./HistoryView";
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
  expect(card?.querySelector("header")?.textContent).toBe("Pi");
  expect(screen.queryByText("Valmis")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Kopioi viesti: Pi" }),
  ).toBeTruthy();
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
  const rows = screen.getAllByRole("button", { name: /bash/ });
  expect(rows).toHaveLength(2);
  expect(rows[0].getAttribute("aria-expanded")).toBe("false");
  for (const row of rows) fireEvent.click(row);
  expect(screen.getAllByText("Näytä koko ladattu tuloste")).toHaveLength(2);
  expect(document.querySelector("script")).toBeNull();
  expect(screen.getByText(/Sisältöä ei tueta/)).toBeTruthy();
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
  expect(screen.getByText("Välivastaus")).toBeTruthy();
  expect(screen.getByText("Vastaus valmis")).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", {
      name: "1 ajatus · 1 työkalu · 1 epäonnistui · read",
    }),
  );
  expect(container.textContent).toMatch(/Ensin.*Ajattelu.*read.*Sitten/s);
  expect(screen.getAllByRole("button", { name: /^read/ })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: /^read/ }));
  expect(container.textContent).toContain("result");
  expect(container.textContent).toContain("epäonnistui");
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
  expect(container.textContent).toContain("Laajennuksen viesti");
  expect(container.textContent).toContain("Plan saved");
  expect(container.textContent).not.toContain("untrusted raw");
});

it("puts unfamiliar question text ahead of inert, collapsed JSON", () => {
  const raw =
    '{"type":"futureQuestion","prompt":"Mitä seuraavaksi?","description":"<img src=x onerror=alert(1)>"}';
  const view = render(
    <Entry
      entry={{
        ...entry,
        kind: "assistant",
        content: {
          media_type: "text/plain",
          text: `[Sisältöä ei tueta: futureQuestion] ${raw}`,
          complete: true,
        },
      }}
    />,
  );
  expect(screen.getByText("Mitä seuraavaksi?")).toBeTruthy();
  expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
  const details = view.container.querySelector("details");
  expect(details?.open).toBe(false);
  expect(details?.textContent).toContain(raw);
  expect(screen.queryByRole("button", { name: "Kyllä" })).toBeNull();
  const malformed = render(
    <Entry
      entry={{
        ...entry,
        entry_key: "bad",
        kind: "assistant",
        content: {
          media_type: "text/plain",
          text: "[Sisältöä ei tueta: future] {broken",
          complete: true,
        },
      }}
    />,
  );
  expect(malformed.container.textContent).toContain("{broken");
});

it("shows an exact model ID as copyable timeline metadata, not code", () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
  const model = {
    ...entry,
    kind: "model_change" as const,
    content: { ...entry.content, text: "openai/gpt-5-codex", complete: true },
  };
  const { container } = render(
    timelineItems([model]).map((item) => (
      <div key={item.id}>{item.content}</div>
    )),
  );
  expect(screen.getByText("openai/gpt-5-codex").tagName).toBe("CODE");
  expect(container.querySelector(".ah-session-settings")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Kopioi koodi" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Kopioi mallin tunniste" }),
  );
  expect(copy).toHaveBeenCalledWith("openai/gpt-5-codex");
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
  fireEvent.click(screen.getByRole("button", { name: "Lataa lohkon sisältö" }));
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
  expect(blocks?.textContent).toMatch(
    /Ajattelu.*First.*read.*image\/png.*Tuntematon.*Last/s,
  );
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
  fireEvent.click(screen.getByRole("button", { name: /result/ }));
  expect(
    screen.getAllByRole("button", { name: "Lataa lohkon sisältö" }),
  ).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Lataa lohkon sisältö" }));
  await waitFor(() =>
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "data:image/png;base64,QUJD",
    ),
  );
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
  fireEvent.click(screen.getByRole("button", { name: "Lataa lohkon sisältö" }));
  await waitFor(() =>
    expect(screen.getByText("Lohkon sisältöä ei saatu")).toBeTruthy(),
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
  fireEvent.click(screen.getByRole("button", { name: "Lataa lohkon sisältö" }));
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
  fireEvent.click(screen.getByRole("button", { name: "Lataa lohkon sisältö" }));
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
  expect(
    screen.getByRole("button", { name: "Lataa lohkon sisältö" }),
  ).toBeTruthy();
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
  expect(container.textContent).toContain("valmis");
  expect(container.textContent).not.toContain("Tulosta lisää");
  fireEvent.click(screen.getByRole("button", { name: /tool/ }));
  expect(
    screen.getByRole("button", { name: "Lataa lohkon sisältö" }),
  ).toBeTruthy();
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
  expect(container.textContent).toContain("paluuarvo 2");
  expect(container.textContent).toContain(
    "Pi katkaisi paikallisen komennon tulosteen",
  );
  expect(container.textContent).not.toContain("ei mallin kontekstissa");
  expect(container.querySelector(".ah-crow-bang")?.textContent).toBe("!!");
  expect(container.querySelector("details")?.open).toBe(true);
  expect(container.textContent).toContain("failure");
  expect(container.textContent).toContain("# literal heading");
  expect(container.querySelector("h1")).toBeNull();
  expect(container.textContent).not.toContain("Keskustelun tieto");
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
  expect(screen.getAllByRole("region", { name: "Agentin vuoro" })).toHaveLength(
    2,
  );
});

it("reads bash arguments for the collapsed native call header", async () => {
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
  // The closed stage reads its last call's arguments to name the command.
  const row = await screen.findByRole("button", {
    name: "1 työkalu · echo ok",
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(row);
  fireEvent.click(screen.getByRole("button", { name: /^bash/ }));
  expect(await screen.findByText(/\$ echo ok/)).toBeTruthy();
  for (const [url] of fetch.mock.calls)
    expect(url).toContain("/entries/a/blocks/0?");
});

it("merges native start settings and presents later changes and compaction as one row family", () => {
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
    model("m1", "provider/a"),
    thinking("t1", "medium"),
    { ...entry, entry_key: "user1" },
    model("m2", "provider/b"),
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
    "m1",
    "user1",
    "m2",
    "t2",
    "compact",
  ]);
  const view = render(
    items.map((item) => <div key={item.id}>{item.content}</div>),
  );
  expect(view.container.querySelectorAll(".ah-session-settings")).toHaveLength(
    4,
  );
  expect(
    view.container.querySelector(".ah-session-settings")?.textContent,
  ).toContain("medium");
  expect(view.container.textContent).toContain("provider/a →");
  expect(view.container.textContent).toContain("medium → high");
  expect(view.queryByText("Keskustelun tieto")).toBeNull();
});

it("splits a settled turn into stages closed by its interim replies", () => {
  const user: HistoryEntry = {
    ...entry,
    entry_key: "u",
    timestamp: "2026-10-13T10:00:00Z",
  };
  const call = (key: string, id: string, command: string): HistoryEntry => ({
    ...entry,
    entry_key: key,
    kind: "assistant",
    model: "claude-opus-5-5",
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
    call("a1", "c1", "git status --short"),
    result("r1", "c1"),
    {
      ...entry,
      entry_key: "a2",
      kind: "assistant",
      model: "claude-opus-5-5",
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
  const rows = view.getAllByRole("button", { expanded: false });
  expect(rows.slice(0, 2).map((row) => row.textContent)).toEqual([
    "1 ajatus · 1 työkalu · git status --short",
    "1 työkalu · git pull --rebase",
  ]);
  expect(view.getAllByText("Välivastaus")).toHaveLength(2);
  expect(view.getAllByText("Vastaus valmis")).toHaveLength(1);
  expect(view.getAllByText("claude-opus-5-5")).toHaveLength(1);
  // The settled turn names no duration: its head row is gone.
  expect(view.container.textContent).not.toContain("1:07");
  expect(view.container.textContent).not.toMatch(/PI ·/);
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
  expect(view.getAllByRole("region", { name: "Agentin vuoro" })).toHaveLength(
    1,
  );
  expect(view.getByText("Välivastaus")).toBeTruthy();
  expect(view.getByText("Katson ensin.")).toBeTruthy();
  expect(view.queryByText("Vastaus valmis")).toBeNull();
  expect(view.getByRole("status").textContent).toContain("Ajaa bash");
  // Pi is writing after the call: that stage is still the running one, so it
  // is behind Näytä työ and the text streams as Vastaa.
  expect(view.queryByRole("button", { name: "1 työkalu · bash" })).toBeNull();
  expect(view.getByRole("button", { name: "Näytä työ" })).toBeTruthy();
  expect(view.getByText("Vastaa")).toBeTruthy();
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
  expect(container.textContent).toContain("Prosessin ilmoitus");
  expect(container.textContent).toContain("Build finished");
  expect(container.querySelector("pre")?.textContent).toBe(content);
  expect(container.querySelector("process_event")).toBeNull();
});
