import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Entry } from "./HistoryView";
import { ViewHost } from "./ViewHost";
import { resetViewLinks } from "./viewLinks";

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
      .mockResolvedValue(new Response(null, { status: 204 }));
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

describe("shared view links", () => {
  const link = {
    link_id: "labcdefghijklmnopqrstuvwxyz",
    view_id: view.view_id,
    title: view.title,
    url: `https://oh-view-${"b".repeat(52)}.example.invalid/${"K".repeat(43)}/`,
    created_at: "2026-10-29T12:00:00Z",
    expires_at: "2026-11-28T12:00:00Z",
  };
  afterEach(() => resetViewLinks());

  it("offers no link where the site has none", async () => {
    const fetch = vi.fn(async (url: string) =>
      url === "/api/v1/views"
        ? json({ schema_version: 1, views: [view] })
        : new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetch);
    const page = render(<ViewHost csrf="csrf">{entry(true)}</ViewHost>);
    await page.findByTestId("view-offer");
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/v1/view-links",
        expect.anything(),
      ),
    );
    await act(async () => {});
    expect(page.queryByTestId("view-share")).toBeNull();
  });

  it("creates a link on the person's press, shows it and revokes it", async () => {
    const writes: unknown[] = [];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/v1/views")
        return json({ schema_version: 1, views: [view] });
      if (url === "/api/v1/view-links" && !init?.method)
        return json({ schema_version: 1, max_days: 90, links: [] });
      if (url === "/api/v1/view-links") {
        writes.push(JSON.parse(String(init?.body)));
        expect(
          (init?.headers as Record<string, string> | undefined)?.[
            "X-Agent-Host-CSRF"
          ],
        ).toBe("csrf");
        return json({ schema_version: 1, link });
      }
      if (url === "/api/v1/view-links/revoke") {
        writes.push(JSON.parse(String(init?.body)));
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetch);
    const page = render(<ViewHost csrf="csrf">{entry(true)}</ViewHost>);
    fireEvent.click(await page.findByTestId("view-share"));
    const dialog = await page.findByTestId("view-link-dialog");
    // The agent's title is data, and the terms come before any link exists.
    expect(dialog.querySelector("b")).toBeNull();
    expect(dialog.textContent).toContain("Kuka tahansa, jolla on linkki");
    fireEvent.click(page.getByTestId("segment-7"));
    fireEvent.click(page.getByTestId("view-link-create"));
    const url = (await page.findByTestId("view-link-url")) as HTMLInputElement;
    expect(url.value).toBe(link.url);
    expect(writes[0]).toEqual({ view_id: view.view_id, days: 7 });
    expect(page.getByTestId("view-shared").textContent).toContain(
      "Jaettu linkillä",
    );
    fireEvent.click(page.getByTestId("view-link-revoke"));
    await page.findByTestId("view-link-revoked");
    expect(writes[1]).toEqual({ link_id: link.link_id });
    expect(page.queryByTestId("view-shared")).toBeNull();
  });
});
