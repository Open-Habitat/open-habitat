import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewOpenPage } from "./ViewOpenPage";

const secret = "E".repeat(43);
const viewId = "vabcdefghijklmnopqrstuvwxyz";
const handoff = `https://oh-view-${"a".repeat(52)}.example.invalid/_open-habitat/handoff?token=${"T".repeat(43)}`;
const session = {
  schema_version: 1,
  provider: "github",
  csrf: "C".repeat(43),
  web_identity_id: "wid_example-a",
  profile: { name: "", email: "", avatar_url: "" },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function address() {
  return {
    address_id: "aabcdefghijklmnopqrstuvwxyz",
    view_id: viewId,
    title: "Raportti",
    url: `https://${window.location.host}/n/${secret}`,
    content_url: `https://oh-view-${"b".repeat(52)}.example.invalid/${"K".repeat(43)}/`,
    state: "private",
    created_at: "2026-11-01T12:00:00Z",
  };
}

function at(path: string) {
  window.history.replaceState(null, "", path);
}

afterEach(() => {
  at("/");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a view at its stable address", () => {
  it("asks a signed-out visitor to sign in, naming nothing", async () => {
    at(`/n/${secret}`);
    const fetch = vi.fn(async (url: string) =>
      url === "/auth/session"
        ? new Response(null, { status: 401 })
        : new Response(null, { status: 500 }),
    );
    vi.stubGlobal("fetch", fetch);
    render(<ViewOpenPage />);
    expect(await screen.findByTestId("view-sign-in")).toBeTruthy();
    expect(
      screen.getByText("Kirjaudu sisään avataksesi näkymän."),
    ).toBeTruthy();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/auth/session"]);
  });

  it("frames the owner's view after resolving the secret in a body", async () => {
    at(`/n/${secret}`);
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/auth/session") return json(session);
      if (url === "/api/v1/view-addresses/open") {
        expect(JSON.parse(String(init?.body))).toEqual({ entry: secret });
        return json({ schema_version: 1, address: address() });
      }
      if (url === "/auth/view") {
        expect(JSON.parse(String(init?.body))).toEqual({ view_id: viewId });
        return json({ schema_version: 1, url: handoff });
      }
      if (url === "/api/v1/views") return new Response(null, { status: 204 });
      return new Response(null, { status: 500 });
    });
    vi.stubGlobal("fetch", fetch);
    render(<ViewOpenPage />);
    await waitFor(() =>
      expect(screen.getByTestId("view-frame").getAttribute("src")).toBe(
        handoff,
      ),
    );
    // No request carries the secret in its URL.
    expect(fetch.mock.calls.some(([url]) => url.includes(secret))).toBe(false);
  });

  it("says only that the view is unavailable to anyone but its owner", async () => {
    at(`/n/${secret}`);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/auth/session"
          ? json(session)
          : json(
              {
                schema_version: 1,
                error: {
                  code: "view_address_not_found",
                  message: "Request could not be completed",
                  retryable: false,
                  correlation_id: "req_00000000",
                },
              },
              404,
            ),
      ),
    );
    render(<ViewOpenPage />);
    expect(
      await screen.findByText("Tämä näkymä ei ole saatavilla."),
    ).toBeTruthy();
    expect(screen.queryByTestId("view-frame")).toBeNull();
  });

  it("refuses a malformed address without asking anyone", async () => {
    at(`/n/${secret.slice(1)}`);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<ViewOpenPage />);
    expect(
      await screen.findByText("Tämä näkymä ei ole saatavilla."),
    ).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("still opens a view whose address cannot be reserved", async () => {
    at(`/view?id=${viewId}`);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/auth/session") return json(session);
        if (url === "/api/v1/view-addresses")
          return json(
            {
              schema_version: 1,
              error: {
                code: "view_addresses_limited",
                message: "Request could not be completed",
                retryable: false,
                correlation_id: "req_00000000",
              },
            },
            429,
          );
        if (url === "/auth/view")
          return json({ schema_version: 1, url: handoff });
        return new Response(null, { status: 204 });
      }),
    );
    render(<ViewOpenPage />);
    await waitFor(() =>
      expect(screen.getByTestId("view-frame").getAttribute("src")).toBe(
        handoff,
      ),
    );
  });
});

describe("a file offer at its stable address", () => {
  const offerId = "fabcdefghijklmnopqrstuvwxyz";
  const offer = {
    offer_id: offerId,
    title: "Kuvat",
    folder: "kuvat",
    files: 2,
    bytes: 6,
    created_at: "2026-11-08T10:30:00Z",
    conversation_id: "pi:11111111-1111-4111-8111-111111111111",
  };
  const manifest = {
    schema_version: 1,
    offer,
    items: [
      { path: "kuvat/a.txt", bytes: 3, kind: "text", lines: 1 },
      { path: "kuvat/b.txt", bytes: 3, kind: "text", lines: 1 },
    ],
  };

  it("shows the owner's offer, not a view frame", async () => {
    at(`/n/${secret}`);
    const { view_id: _, ...rest } = address();
    const fetch = vi.fn(async (url: string) => {
      if (url === "/auth/session") return json(session);
      if (url === "/api/v1/view-addresses/open")
        return json({
          schema_version: 1,
          address: { ...rest, offer_id: offerId, title: offer.title },
        });
      if (url === `/api/v1/file-offers/${offerId}`) return json(manifest);
      return new Response(null, { status: 500 });
    });
    vi.stubGlobal("fetch", fetch);
    render(<ViewOpenPage />);
    const page = await screen.findByTestId("offer-open-page");
    await waitFor(() =>
      expect(page.getAttribute("data-offer-id")).toBe(offerId),
    );
    expect(screen.queryByTestId("view-frame")).toBeNull();
    expect(fetch.mock.calls.map(([url]) => url)).not.toContain("/auth/view");
  });
});
