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
    // Agent text is data: the card's only link is its own download.
    expect(card.querySelectorAll("b,script")).toHaveLength(0);
    expect(
      [...card.querySelectorAll("a")].map((a) => a.dataset.testid),
    ).toEqual(["offer-download"]);

    fireEvent.click(page.getByTestId("offer-open-tab"));
    expect(open).toHaveBeenCalledWith(
      `/view?id=${view.view_id}`,
      "_blank",
      expect.stringContaining("noopener"),
    );

    // The whole card opens the view beside the conversation.
    const button = page.getByTestId("offer-open");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    button.focus();
    fireEvent.click(button);
    const frame = (await page.findByTestId("view-frame")) as HTMLIFrameElement;
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.src).toBe(handoff);
    expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(card.dataset.open).toBe("true");
    expect(button.getAttribute("aria-expanded")).toBe("true");
    // Its zip downloads from the app's own route.
    expect(page.getAllByTestId("offer-download")[0].getAttribute("href")).toBe(
      `/api/v1/views/${view.view_id}/zip`,
    );

    fireEvent.click(page.getByTestId("close-view"));
    expect(page.queryByTestId("view-panel")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(button));

    // Pressing the open card again closes the panel.
    fireEvent.click(button);
    await page.findByTestId("view-frame");
    fireEvent.click(button);
    await waitFor(() => expect(page.queryByTestId("view-panel")).toBeNull());
    expect(card.dataset.open).toBeUndefined();
  });
});

describe("shared view addresses", () => {
  const reserved = {
    address_id: "aabcdefghijklmnopqrstuvwxyz",
    view_id: view.view_id,
    title: view.title,
    url: `https://${window.location.host}/n/${"E".repeat(43)}`,
    content_url: `https://oh-view-${"b".repeat(52)}.example.invalid/${"K".repeat(43)}/`,
    state: "private",
    created_at: "2026-10-29T12:00:00Z",
  };
  const shared = {
    ...reserved,
    state: "public",
    public_until: "2999-11-28T12:00:00Z",
  };
  afterEach(() => resetViewLinks());

  it("offers no public switch where the site has no addresses or shares nothing", async () => {
    for (const reply of [
      () => new Response(null, { status: 204 }),
      () => json({ schema_version: 1, max_days: 0, addresses: [shared] }),
    ]) {
      resetViewLinks();
      const fetch = vi.fn(async (url: string) =>
        url === "/api/v1/views"
          ? json({ schema_version: 1, views: [view] })
          : reply(),
      );
      vi.stubGlobal("fetch", fetch);
      const page = render(<ViewHost csrf="csrf">{entry(true)}</ViewHost>);
      await page.findByTestId("view-offer");
      await waitFor(() =>
        expect(fetch).toHaveBeenCalledWith(
          "/api/v1/view-addresses",
          expect.anything(),
        ),
      );
      await act(async () => {});
      expect(page.queryByTestId("view-public")).toBeNull();
      expect(page.queryByTestId("view-copy-link")).toBeNull();
      page.unmount();
    }
  });

  function host(
    write: (url: string, body: Record<string, unknown>) => Response,
    list: () => Response = () =>
      json({ schema_version: 1, max_days: 90, addresses: [] }),
  ) {
    const writes: [string, unknown][] = [];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/v1/views")
        return json({ schema_version: 1, views: [view] });
      if (url === "/api/v1/view-addresses" && !init?.method) return list();
      const body = JSON.parse(String(init?.body));
      writes.push([url, body]);
      expect(
        (init?.headers as Record<string, string> | undefined)?.[
          "X-Agent-Host-CSRF"
        ],
      ).toBe("csrf");
      return write(url, body);
    });
    vi.stubGlobal("fetch", fetch);
    return { writes, fetch };
  }

  it("makes the view public in one press, copies and opens one address, and back", async () => {
    const { writes } = host((url) => {
      if (url === "/api/v1/view-addresses")
        return json({ schema_version: 1, address: reserved });
      if (url === "/api/v1/view-addresses/publish")
        return json({ schema_version: 1, address: shared });
      if (url === "/api/v1/view-addresses/duration")
        return json({
          schema_version: 1,
          address: { ...shared, public_until: "2999-12-05T12:00:00Z" },
        });
      if (url === "/api/v1/view-addresses/private")
        return json({ schema_version: 1, address: reserved });
      throw new Error(`unexpected ${url}`);
    });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    // The same view offered twice: both cards show one state.
    const page = render(
      <ViewHost csrf="csrf">
        {entry(true)}
        {entry(true)}
      </ViewHost>,
    );
    const switches = await page.findAllByTestId("view-public");
    expect(switches).toHaveLength(2);
    expect(page.queryByTestId("view-copy-link")).toBeNull();
    fireEvent.click(switches[0]);
    await waitFor(() =>
      expect(page.getAllByTestId("view-copy-link")).toHaveLength(2),
    );
    // Public from now for the default length: no dialog, no choice.
    expect(writes).toEqual([
      ["/api/v1/view-addresses", { view_id: view.view_id }],
      [
        "/api/v1/view-addresses/publish",
        { address_id: shared.address_id, days: 30 },
      ],
    ]);
    for (const s of page.getAllByTestId("view-public"))
      expect(s.getAttribute("aria-pressed")).toBe("true");

    // The host resolves the current address; the rendered one may have
    // been deleted in another tab while a refresh is still in flight.
    fireEvent.click(page.getAllByTestId("offer-open-tab")[1]);
    expect(open).toHaveBeenLastCalledWith(
      `/view?id=${view.view_id}`,
      "_blank",
      expect.stringContaining("noopener"),
    );
    const copy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: copy },
      configurable: true,
    });
    fireEvent.click(page.getAllByTestId("view-copy-link")[0]);
    await waitFor(() => expect(copy).toHaveBeenCalledWith(shared.url));

    // The date opens the lengths; a choice changes only the duration.
    fireEvent.click(page.getAllByTestId("view-public-until")[0]);
    fireEvent.click(await page.findByTestId("view-duration-7"));
    await waitFor(() => expect(writes).toHaveLength(3));
    expect(writes[2]).toEqual([
      "/api/v1/view-addresses/duration",
      { address_id: shared.address_id, days: 7 },
    ]);

    fireEvent.click(page.getAllByTestId("view-public")[1]);
    await waitFor(() =>
      expect(page.queryAllByTestId("view-copy-link")).toHaveLength(0),
    );
    expect(writes[3]).toEqual([
      "/api/v1/view-addresses/private",
      { address_id: shared.address_id },
    ]);
  });

  it("settles a lost reply by reading again, never by sending the write again", async () => {
    let listed: unknown[] = [];
    const { writes, fetch } = host(
      (url) => {
        if (url === "/api/v1/view-addresses/publish") {
          // The write went through, but its reply was lost.
          listed = [shared];
          return new Response("", { status: 502 });
        }
        throw new Error(`unexpected ${url}`);
      },
      () => json({ schema_version: 1, max_days: 90, addresses: listed }),
    );
    listed = [reserved];
    const page = render(<ViewHost csrf="csrf">{entry(true)}</ViewHost>);
    fireEvent.click(await page.findByTestId("view-public"));
    await waitFor(() =>
      expect(page.getByTestId("view-public").getAttribute("aria-pressed")).toBe(
        "true",
      ),
    );
    expect(writes.map(([url]) => url)).toEqual([
      "/api/v1/view-addresses/publish",
    ]);
    const reads = fetch.mock.calls.filter(
      ([url, init]) => url === "/api/v1/view-addresses" && !init?.method,
    );
    expect(reads.length).toBeGreaterThanOrEqual(2);
    expect(page.getByRole("status")).toBeTruthy();
    expect(page.getByTestId("view-copy-link")).toBeTruthy();
  });
});

describe("shared file offer addresses", () => {
  const offer = {
    offer_id: "fabcdefghijklmnopqrstuvwxyz",
    title: "Taulukko",
    files: 1,
    bytes: 40,
    created_at: "2026-11-08T10:30:00Z",
    conversation_id: view.conversation_id,
  };
  const manifest = {
    schema_version: 1,
    offer,
    items: [{ path: "taulu.csv", bytes: 40, kind: "csv", lines: 3 }],
  };
  const reserved = {
    address_id: "acbcdefghijklmnopqrstuvwxyz",
    offer_id: offer.offer_id,
    title: offer.title,
    url: `https://${window.location.host}/n/${"G".repeat(43)}`,
    content_url: `https://oh-view-${"c".repeat(52)}.example.invalid/${"C".repeat(43)}/`,
    state: "private",
    created_at: "2026-11-08T12:00:00Z",
  };
  const shared = {
    ...reserved,
    state: "public",
    public_until: "2999-12-08T12:00:00Z",
  };
  afterEach(() => resetViewLinks());

  function offerEntry() {
    return (
      <Entry
        entry={{
          entry_key: "file-offer",
          kind: "unknown",
          content: {
            media_type: "text/plain",
            text: offer.title,
            complete: true,
          },
          notice: {
            ...notice,
            notice_id: "44444444-4444-4444-8444-444444444444",
            text: offer.title,
            file_offer: offer,
          },
        }}
      />
    );
  }

  function host(maxDays: number, views: boolean) {
    const writes: [string, unknown][] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/v1/views")
          return views
            ? json({ schema_version: 1, views: [] })
            : new Response(null, { status: 204 });
        if (url === `/api/v1/file-offers/${offer.offer_id}`)
          return json(manifest);
        if (url === "/api/v1/view-addresses" && !init?.method)
          return json({ schema_version: 1, max_days: maxDays, addresses: [] });
        const body = JSON.parse(String(init?.body));
        writes.push([url, body]);
        if (url === "/api/v1/view-addresses")
          return json({ schema_version: 1, address: reserved });
        if (url === "/api/v1/view-addresses/publish")
          return json({ schema_version: 1, address: shared });
        if (url === "/api/v1/view-addresses/private")
          return json({ schema_version: 1, address: reserved });
        throw new Error(`unexpected ${url}`);
      }),
    );
    return writes;
  }

  it("publishes the offer in one press at its own address, and back", async () => {
    const writes = host(90, true);
    const page = render(<ViewHost csrf="csrf">{offerEntry()}</ViewHost>);
    const card = await page.findByTestId("file-offer");
    await waitFor(() => expect(card.getAttribute("data-public")).toBe("false"));
    expect(page.queryByTestId("view-copy-link")).toBeNull();
    fireEvent.click(page.getByTestId("view-public"));
    await waitFor(() =>
      expect(page.getByTestId("view-copy-link")).toBeTruthy(),
    );
    expect(card.getAttribute("data-public")).toBe("true");
    expect(writes).toEqual([
      ["/api/v1/view-addresses", { offer_id: offer.offer_id }],
      [
        "/api/v1/view-addresses/publish",
        { address_id: shared.address_id, days: 30 },
      ],
    ]);
    fireEvent.click(page.getByTestId("view-public"));
    await waitFor(() =>
      expect(page.queryByTestId("view-copy-link")).toBeNull(),
    );
    expect(writes[2]).toEqual([
      "/api/v1/view-addresses/private",
      { address_id: shared.address_id },
    ]);
  });

  it("offers no globe where the site shares nothing or has no views", async () => {
    for (const [maxDays, views] of [
      [0, true],
      [90, false],
    ] as const) {
      resetViewLinks();
      host(maxDays, views);
      const page = render(<ViewHost csrf="csrf">{offerEntry()}</ViewHost>);
      const card = await page.findByTestId("file-offer");
      await waitFor(() =>
        expect(card.getAttribute("data-state")).toBe("ready"),
      );
      await act(async () => {});
      expect(page.queryByTestId("view-public")).toBeNull();
      page.unmount();
    }
  });
});
