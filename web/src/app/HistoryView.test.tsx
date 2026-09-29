import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Entry } from "./HistoryView";
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
