import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Entry } from "./HistoryView";
import { ViewHost } from "./ViewHost";

const view = {
  view_id: "vabcdefghijklmnopqrstuvwxyz",
  title: "Raportti <b>x</b>",
  entry: "index.html",
  files: 2,
  bytes: 2048,
  created_at: "2026-10-25T12:00:00Z",
  conversation_id: "pi:11111111-1111-4111-8111-111111111111",
};
const handoff = `https://oh-view-${"a".repeat(52)}.example.invalid/_open-habitat/handoff?token=${"T".repeat(43)}`;
const notice = {
  notice_id: "22222222-2222-4222-8222-222222222222",
  origin: "agent" as const,
  timestamp: "2026-10-25T12:00:00Z",
  text: view.title,
  persistence: "persisted" as const,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function entry(withView: boolean) {
  return (
    <Entry
      entry={{
        entry_key: withView ? "offer" : "plain",
        kind: "unknown",
        content: {
          media_type: "text/plain",
          text: notice.text,
          complete: true,
        },
        notice: withView
          ? { ...notice, view }
          : { ...notice, notice_id: "33333333-3333-4333-8333-333333333333" },
      }}
    />
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("agent HTML view offers", () => {
  it("shows no offer where the installation has no view origin", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    const page = render(
      <ViewHost csrf="csrf">
        {entry(true)}
        {entry(false)}
      </ViewHost>,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await act(async () => {});
    expect(page.queryByTestId("view-offer")).toBeNull();
    // An ordinary notice is unaffected.
    expect(page.getByTestId("agent-notice")).toBeTruthy();
  });

  it("opens the panel in a sandboxed frame and a tab only through the app's own page", async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/v1/views")
        return json({ schema_version: 1, views: [view] });
      if (url === "/auth/view") {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          view_id: view.view_id,
        });
        return json({ schema_version: 1, url: handoff });
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const page = render(<ViewHost csrf="csrf">{entry(true)}</ViewHost>);
    const card = await page.findByTestId("view-offer");
    // Agent text is data.
    expect(card.querySelectorAll("b,script,a")).toHaveLength(0);

    fireEvent.click(page.getByTestId("view-open-tab"));
    expect(open).toHaveBeenCalledWith(
      `/view?id=${view.view_id}`,
      "_blank",
      expect.stringContaining("noopener"),
    );

    const button = page.getByTestId("view-open");
    button.focus();
    fireEvent.click(button);
    const frame = (await page.findByTestId("view-frame")) as HTMLIFrameElement;
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.src).toBe(handoff);
    expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");

    fireEvent.click(page.getByTestId("close-view"));
    expect(page.queryByTestId("view-panel")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(button));
  });
});
