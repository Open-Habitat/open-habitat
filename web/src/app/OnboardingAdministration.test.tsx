import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function mockHost(onPut: (body: Record<string, unknown>) => Response) {
  let current = config(2, ["example-org/product"]);
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "/api/v1/server/onboarding" && init?.method === "PUT") {
        const r = onPut(JSON.parse(String(init.body)));
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

it("saves an edited draft under the version it was read at", async () => {
  const puts: Record<string, unknown>[] = [];
  mockHost((body) => {
    puts.push(body);
    return json({
      ...config(3, body.repositories ? [] : []),
      repositories: body.repositories,
      integrations: body.integrations,
      ai_account: body.ai_account,
    });
  });
  page();
  fireEvent.click(
    await screen.findByTestId("onboarding-remove-example-org/product"),
  );
  fireEvent.click(screen.getByTestId("onboarding-save"));
  await screen.findByText(/Käyttöönotto tallennettu/);
  expect(puts).toEqual([
    {
      expected_version: 2,
      repositories: { mode: "preselected", defaults: [] },
      integrations: [{ provider: "google", required: false }],
      ai_account: { offer: "all" },
    },
  ]);
  expect(screen.getByTestId("onboarding-dirty").textContent).toBe(
    "Ei tallentamattomia muutoksia",
  );
});

it("keeps nothing of a conflicting save and reloads the host's version", async () => {
  const host = mockHost(() =>
    json({ schema_version: 1, error: { code: "version_conflict" } }, 409),
  );
  page();
  fireEvent.click(
    await screen.findByTestId("onboarding-remove-example-org/product"),
  );
  fireEvent.click(screen.getByTestId("onboarding-save"));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "muutettu toisaalla",
  );
  expect(
    screen.getByTestId("onboarding-save").getAttribute("data-disabled"),
  ).toBe("true");
  // Discarding the draft does not resolve the conflict: the warning stays
  // until the host is read again.
  fireEvent.click(screen.getByTestId("onboarding-discard"));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "muutettu toisaalla",
  );
  host.replace(config(3, ["example-org/product", "example-org/docs"]));
  fireEvent.click(screen.getByTestId("onboarding-reload"));
  await screen.findByTestId("onboarding-default-example-org/docs");
  expect(screen.queryByRole("alert")).toBeNull();
});

it("adds a default picked in the finder through the route", async () => {
  mockHost(() => json({}, 500));
  page(`${settingsHref("kayttoonotto")}?lisaa=example-org%2Fdocs`);
  await screen.findByTestId("onboarding-default-example-org/docs");
  expect(
    screen.getByTestId("onboarding-route-repositories-hint").textContent,
  ).toBe("2 esivalittuna");
});

it("shows an integration this installation lacks as not installed", async () => {
  mockHost(() => json({}, 500));
  page();
  fireEvent.click(
    await screen.findByTestId("onboarding-route-add-integration"),
  );
  await waitFor(() =>
    expect(
      screen.getByTestId("onboarding-integration-choices").textContent,
    ).toContain("Ei asennettu"),
  );
});
