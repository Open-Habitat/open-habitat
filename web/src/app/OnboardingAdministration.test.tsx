import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import { OnboardingAdministration } from "./OnboardingAdministration";
import { settingsHref } from "./settingsRoute";

afterEach(() => vi.restoreAllMocks());
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const config = (version: number, defaults: string[]) => ({
  schema_version: 1,
  version,
  repositories: { mode: "preselected", defaults },
  integrations: [{ provider: "google", required: false }],
  ai_account: { offer: "all" },
});

function mockHost(
  onPut: (body: Record<string, unknown>) => Response | Promise<Response>,
) {
  let current = config(2, ["example-org/product"]);
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/v1/server/onboarding" && init?.method === "PUT") {
        const r = await onPut(JSON.parse(String(init.body)));
        if (r.ok) current = (await r.clone().json()) as typeof current;
        return r;
      }
      if (url === "/api/v1/server/onboarding") return json(current);
      if (url === "/api/v1/integrations")
        return json({
          schema_version: 1,
          providers: [
            {
              id: "google",
              available: true,
              login: "pasted_redirect",
              services: ["mail"],
            },
            {
              id: "dropbox",
              available: false,
              login: "pasted_redirect",
              services: ["dropbox"],
            },
          ],
          accounts: [],
          skill: "none",
        });
      return new Response("", { status: 503 });
    });
  return {
    fetch,
    replace: (next: ReturnType<typeof config>) => {
      current = next;
    },
  };
}

function page(entry = settingsHref("kayttoonotto")) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/settings/*"
          element={<OnboardingAdministration csrf="csrf" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const answer = (version: number, body: Record<string, unknown>) =>
  json({
    schema_version: 1,
    version,
    repositories: body.repositories,
    integrations: body.integrations,
    ai_account: body.ai_account,
  });
const removeProduct = async () =>
  fireEvent.click(
    await screen.findByTestId("onboarding-remove-example-org/product"),
  );
const saveState = () =>
  screen.getByTestId("onboarding-save-state").getAttribute("data-state");

it("saves each change as it is made, the next under the version the last returned", async () => {
  const puts: Record<string, unknown>[] = [];
  let release: () => void = () => {};
  const first = new Promise<void>((r) => {
    release = r;
  });
  // The first write is held so a second change lands while it is on its way.
  mockHost(async (body) => {
    puts.push(body);
    if (puts.length === 1) await first;
    return answer(2 + puts.length, body);
  });
  page();
  await removeProduct();
  expect(saveState()).toBe("saving");
  fireEvent.click(
    within(screen.getByTestId("onboarding-repository-mode")).getByTestId(
      "segment-skip",
    ),
  );
  release();
  await waitFor(() => expect(saveState()).toBe("saved"));
  expect(puts).toEqual([
    {
      expected_version: 2,
      repositories: { mode: "preselected", defaults: [] },
      integrations: [{ provider: "google", required: false }],
      ai_account: { offer: "all" },
    },
    {
      expected_version: 3,
      repositories: { mode: "skip", defaults: [] },
      integrations: [{ provider: "google", required: false }],
      ai_account: { offer: "all" },
    },
  ]);
});

it("stops on a conflict, writes nothing more, and reloads the host's version", async () => {
  let puts = 0;
  const host = mockHost(() => {
    puts += 1;
    return json(
      { schema_version: 1, error: { code: "version_conflict" } },
      409,
    );
  });
  page();
  await removeProduct();
  await screen.findByTestId("onboarding-save-failure");
  expect(saveState()).toBe("conflict");
  // Editing is closed until the host is read again: no write on a guess.
  const mode = within(screen.getByTestId("onboarding-repository-mode"));
  fireEvent.click(mode.getByTestId("segment-skip"));
  expect(puts).toBe(1);
  host.replace(config(3, ["example-org/product", "example-org/docs"]));
  fireEvent.click(screen.getByTestId("onboarding-reload"));
  await screen.findByTestId("onboarding-default-example-org/docs");
  expect(screen.queryByTestId("onboarding-save-failure")).toBeNull();
  expect(saveState()).toBe("idle");
});

it("shows a refused change undone, and an unconfirmed one stops editing", async () => {
  let reply = () =>
    json({ schema_version: 1, error: { code: "admin_required" } }, 403);
  mockHost(() => reply());
  page();
  await removeProduct();
  await screen.findByRole("alert");
  expect(saveState()).toBe("refused");
  // Nothing was written, so the page shows the host's list again.
  expect(
    screen.getByTestId("onboarding-default-example-org/product"),
  ).toBeTruthy();
  reply = () => {
    throw new TypeError("network");
  };
  await removeProduct();
  await screen.findByTestId("onboarding-save-failure");
  expect(saveState()).toBe("uncertain");
});

it("adds and removes a default picked in the finder through the route, saving each", async () => {
  const puts: Record<string, unknown>[] = [];
  mockHost((body) => {
    puts.push(body);
    return answer(2 + puts.length, body);
  });
  page(`${settingsHref("kayttoonotto")}?lisaa=example-org%2Fdocs`);
  await screen.findByTestId("onboarding-default-example-org/docs");
  await waitFor(() => expect(saveState()).toBe("saved"));
  cleanup();
  page(`${settingsHref("kayttoonotto")}?pois=Example-Org%2FProduct`);
  await waitFor(() => expect(puts).toHaveLength(2));
  expect(
    puts.map((p) => (p.repositories as { defaults: string[] }).defaults),
  ).toEqual([
    ["example-org/product", "example-org/docs"],
    ["example-org/docs"],
  ]);
});

it("offers only ready integrations and shows a configured unready one as hidden", async () => {
  const host = mockHost(() => json({}, 500));
  host.replace({
    ...config(2, ["example-org/product"]),
    integrations: [
      { provider: "google", required: false },
      { provider: "dropbox", required: true },
    ],
  });
  page();
  // Dropbox stays in the configuration but is not on the person's route.
  const google = await screen.findByTestId(
    "onboarding-route-integration:google",
  );
  await waitFor(() => expect(google.dataset.shown).toBe("true"));
  const dropbox = screen.getByTestId("onboarding-route-integration:dropbox");
  expect(dropbox.dataset.shown).toBe("false");
  fireEvent.click(dropbox);
  expect(screen.getByTestId("onboarding-step-hidden")).toBeTruthy();
  cleanup();
  host.replace({ ...config(3, []), integrations: [] });
  page();
  fireEvent.click(
    await screen.findByTestId("onboarding-route-add-integration"),
  );
  // Only a ready integration can be added; one that is not ready is listed
  // without an add action, and one the catalog does not mention is not ready.
  await screen.findByTestId("onboarding-add-google");
  expect(screen.queryByTestId("onboarding-add-dropbox")).toBeNull();
  expect(screen.queryByTestId("onboarding-add-microsoft")).toBeNull();
  expect(screen.getByTestId("onboarding-unready-dropbox")).toBeTruthy();
  expect(screen.getByTestId("onboarding-unready-microsoft")).toBeTruthy();
});

it("holds every other edit while a key write is on its way, then starts from the host's answer", async () => {
  const puts: unknown[] = [];
  let release: () => void = () => {};
  const held = new Promise<void>((r) => {
    release = r;
  });
  const host = mockHost((body) => {
    puts.push(body);
    return answer(9, body);
  });
  host.replace({
    ...config(3, ["example-org/product"]),
    ai_account: { offer: "site_key" },
    site_key: {
      provider: "openai",
      suffix: "Abcd",
      set_at: "2026-10-24T09:00:00Z",
    },
  } as ReturnType<typeof config>);
  const fallback = host.fetch.getMockImplementation();
  host.fetch.mockImplementation(async (input, init) => {
    if (String(input) === "/api/v1/server/onboarding/ai-key/delete") {
      await held;
      return json(config(4, ["example-org/product"]));
    }
    return fallback?.(input, init) as Promise<Response>;
  });
  page();
  fireEvent.click(await screen.findByTestId("onboarding-route-ai"));
  fireEvent.click(
    within(screen.getByTestId("onboarding-ai-way")).getByTestId("segment-all"),
  );
  fireEvent.click(await screen.findByTestId("site-key-remove-confirm"));
  await waitFor(() => expect(saveState()).toBe("saving"));
  fireEvent.click(screen.getByTestId("onboarding-route-repositories"));
  const skip = within(
    screen.getByTestId("onboarding-repository-mode"),
  ).getByTestId("segment-skip");
  expect((skip as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(skip);
  release();
  await waitFor(() => expect(saveState()).toBe("saved"));
  expect(puts).toEqual([]);
  expect(
    screen.getByTestId("onboarding-route-ai").getAttribute("data-shown"),
  ).toBe("true");
});
