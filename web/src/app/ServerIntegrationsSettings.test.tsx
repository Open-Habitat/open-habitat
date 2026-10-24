import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { ServerIntegrationsSettings } from "./ServerIntegrationsSettings";

afterEach(() => vi.restoreAllMocks());

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const refusal = (code: string, status: number) =>
  json(
    { schema_version: 1, error: { code, message: "x", retryable: false } },
    status,
  );
const app = {
  provider: "dropbox",
  client_id: "p3n8vq1zt6ka0rw",
  usable: true,
  source: "site_admin",
  actor: "42",
  at: "2026-10-24T12:00:00Z",
};

/** A host whose Dropbox is in use exactly while the broker holds its app. */
function host(write: (url: string, body: string) => Response | undefined) {
  let set = false;
  const writes: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === "POST") {
      writes.push(url);
      const reply = write(url, String(init.body));
      if (reply) return reply;
      set = url.endsWith("/set");
      return json({
        schema_version: 1,
        browser_setup: true,
        apps: set ? [app] : [],
      });
    }
    if (url === "/api/v1/server/integrations")
      return json({
        schema_version: 1,
        browser_setup: true,
        apps: set ? [app] : [],
      });
    if (url === "/api/v1/integrations")
      return json({
        schema_version: 1,
        providers: [
          {
            id: "dropbox",
            available: set,
            ...(set ? {} : { unavailable_reason: "app_credentials_required" }),
            login: "pasted_redirect",
            services: ["dropbox"],
          },
        ],
        accounts: [],
        skill: "none",
      });
    return json({}, 404);
  });
  render(
    <MemoryRouter>
      <ServerIntegrationsSettings csrf="csrf" />
    </MemoryRouter>,
  );
  return writes;
}
const row = () => screen.getByTestId("si-row-dropbox");
const setDropbox = async () => {
  fireEvent.click(await screen.findByTestId("si-setup-dropbox"));
  fireEvent.click(screen.getByTestId("si-skip"));
  fireEvent.change(screen.getByTestId("si-field-client_id"), {
    target: { value: "p3n8vq1zt6ka0rw" },
  });
  fireEvent.change(screen.getByTestId("si-field-client_secret"), {
    target: { value: "h2m5c9xj4ub7ye1" },
  });
  fireEvent.click(screen.getByTestId("si-save"));
};

it("shows in use only once the host confirms the app and the catalog says so", async () => {
  const writes = host(() => undefined);
  await setDropbox();
  await waitFor(() => expect(row().dataset.status).toBe("ready"));
  expect(screen.queryByTestId("si-setup-dialog")).toBeNull();
  expect(writes).toEqual(["/api/v1/server/integrations/set"]);
});

it("keeps a change whose reply was lost uncertain until read again, and never resends it", async () => {
  const writes = host(() => refusal("outcome_uncertain", 503));
  await setDropbox();
  await waitFor(() => expect(row().dataset.status).toBe("uncertain"));
  fireEvent.click(screen.getByTestId("si-refresh-dropbox"));
  await waitFor(() => expect(row().dataset.status).toBe("needs_app"));
  expect(writes).toEqual(["/api/v1/server/integrations/set"]);
});

it("shows a refused removal on its row with nothing changed", async () => {
  let first = true;
  host((url) => {
    if (url.endsWith("/set") || !first) return undefined;
    first = false;
    return refusal("host_busy", 409);
  });
  await setDropbox();
  await waitFor(() => expect(row().dataset.status).toBe("ready"));
  fireEvent.click(
    screen.getByTestId("si-menu-dropbox").querySelector("button") as Element,
  );
  fireEvent.click(await screen.findByTestId("menu-remove"));
  fireEvent.click(screen.getByTestId("si-remove-confirm"));
  await waitFor(() => expect(row().querySelector("[role=alert]")).toBeTruthy());
  expect(row().dataset.status).toBe("ready");
});

it("never lets an older catalog answer undo a later confirmed removal", async () => {
  const set = new Set(["microsoft", "dropbox"]);
  const appOf = (provider: string) => ({ ...app, provider });
  let hold: ((r: Response) => void) | undefined;
  let holdNext = false;
  const catalog = () =>
    json({
      schema_version: 1,
      providers: ["microsoft", "dropbox"].map((id) => ({
        id,
        available: set.has(id),
        ...(set.has(id)
          ? {}
          : { unavailable_reason: "app_credentials_required" }),
        login: "pasted_redirect",
        services: ["dropbox"],
      })),
      accounts: [],
      skill: "none",
    });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === "POST") {
      set.delete(JSON.parse(String(init.body)).provider);
      // Dropbox's follow-up catalog read is answered late, from before
      // Microsoft's removal.
      holdNext = set.size === 1;
      return json({
        schema_version: 1,
        browser_setup: true,
        apps: [...set].map(appOf),
      });
    }
    if (url === "/api/v1/server/integrations")
      return json({
        schema_version: 1,
        browser_setup: true,
        apps: [...set].map(appOf),
      });
    if (url === "/api/v1/integrations") {
      const answer = catalog();
      if (holdNext) {
        holdNext = false;
        return new Promise<Response>((resolve) => {
          hold = () => resolve(answer);
        });
      }
      return answer;
    }
    return json({}, 404);
  });
  render(
    <MemoryRouter>
      <ServerIntegrationsSettings csrf="csrf" />
    </MemoryRouter>,
  );
  const remove = async (p: string) => {
    fireEvent.click(
      (await screen.findByTestId(`si-menu-${p}`)).querySelector(
        "button",
      ) as Element,
    );
    fireEvent.click(await screen.findByTestId("menu-remove"));
    fireEvent.click(screen.getByTestId("si-remove-confirm"));
  };
  await remove("dropbox");
  await waitFor(() => expect(hold).toBeDefined());
  await remove("microsoft");
  const microsoft = () => screen.getByTestId("si-row-microsoft");
  await waitFor(() => expect(microsoft().dataset.status).toBe("needs_app"));
  hold?.(new Response());
  await waitFor(() =>
    expect(screen.getByTestId("si-row-dropbox").dataset.status).not.toBe(
      "clear",
    ),
  );
  expect(microsoft().dataset.status).toBe("needs_app");
});
