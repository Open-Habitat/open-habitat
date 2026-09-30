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
    content_id: "ct_abcdefgh",
    next_offset: 21,
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
  const items = timelineItems(
    [
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
    ],
    false,
  );
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

it("does not add a late content chunk after the view becomes stale", async () => {
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    finish = resolve;
  });
  const fetch = vi.fn(() => pending);
  vi.stubGlobal("fetch", fetch);
  const view = render(<Entry entry={entry} />);
  fireEvent.click(screen.getByRole("button", { name: "Lataa lisää sisältöä" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  view.rerender(<Entry entry={entry} stale />);
  finish(
    new Response(
      JSON.stringify({
        schema_version: 1,
        content_id: "ct_abcdefgh",
        offset: 21,
        content: {
          media_type: "text/plain",
          text: " private new text",
          complete: true,
        },
      }),
      { headers: { "content-type": "application/json" } },
    ),
  );
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Ladataan…" })).toBeNull(),
  );
  expect(screen.getByText("Visible before outage")).toBeTruthy();
  expect(screen.queryByText(/private new text/)).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Lataa lisää sisältöä" }),
  ).toBeNull();
});
