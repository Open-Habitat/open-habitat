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

it("groups adjacent results, leaves unknown entries as readable text and bounds large output", () => {
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
  expect(items).toHaveLength(2);
  render(items.map((item) => <div key={item.id}>{item.content}</div>));
  fireEvent.click(screen.getByRole("button", { name: /Työkalut/ }));
  const rows = screen.getAllByRole("button", { name: /bash/ });
  for (const row of rows) fireEvent.click(row);
  expect(screen.getAllByText("Näytä koko ladattu tuloste")).toHaveLength(2);
  expect(document.querySelector("script")).toBeNull();
  expect(screen.getAllByText(/question/).length).toBeGreaterThan(0);
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
  const { container } = render(<Entry entry={model} />);
  expect(screen.getByText("openai/gpt-5-codex").tagName).toBe("CODE");
  expect(container.querySelector(".ah-model-change")).toBeTruthy();
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
