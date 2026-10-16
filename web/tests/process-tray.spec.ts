import AxeBuilder from "@axe-core/playwright";
import inventoryFixture from "../../contracts/v1/examples/process-inventory.json" with {
  type: "json",
};
import outputFixture from "../../contracts/v1/examples/process-output.json" with {
  type: "json",
};
import type { ProcessInventory } from "../src/app/processes";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});
// Real synthetic host for authentication/controller/navigation. The process
// endpoints are explicit wire fixtures, not evidence for the native bridge.
test("@process-tray @a11y follows bounded output, handles stale controls, and keeps the composer reachable", async ({
  page,
}) => {
  const inventory = structuredClone(inventoryFixture) as ProcessInventory;
  let tail = "ensimmäinen loppuosa";
  const stops: unknown[] = [];
  await page.route("**/api/v1/conversations/*/processes**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/output")) {
      expect(url.searchParams.get("owner_generation")).toBe("og_example");
      expect(url.searchParams.get("process_token")).toBe("pt_example");
      expect(url.searchParams.get("tail_lines")).toBe("200");
      await route.fulfill({
        json: { ...outputFixture, lines: [{ stream: "stderr", text: tail }] },
      });
    } else if (url.pathname.endsWith("/stop")) {
      stops.push(route.request().postDataJSON());
      if (stops.length === 1) {
        inventory.processes[0].status = "terminate_timeout";
        await route.fulfill({
          json: { schema_version: 1, result: "terminate_timeout" },
        });
      } else {
        inventory.processes[0].status = "killed";
        inventory.processes[0].ended_at = Date.now();
        await route.fulfill({ json: { schema_version: 1, result: "killed" } });
      }
    } else if (url.pathname.endsWith("/clear-finished")) {
      expect(route.request().postDataJSON()).toEqual({
        owner_generation: "og_example",
      });
      inventory.processes = [];
      await route.fulfill({ json: { schema_version: 1, result: "cleared" } });
    } else await route.fulfill({ json: inventory });
  });
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const tray = page.getByRole("complementary", { name: "Agentin prosessit" });
  await tray.getByRole("button", { name: /Prosessit ·/ }).click();
  await tray.getByRole("button", { name: "testit" }).click();
  await expect(tray.getByText(/ensimmäinen loppuosa/)).toBeVisible();
  await tray.getByRole("button", { name: "Pysäytä seuraaminen" }).click();
  tail = "uusi loppuosa";
  await expect(tray.getByText(/ensimmäinen loppuosa/)).toBeVisible();
  await tray.getByRole("button", { name: "Seuraa loppua" }).click();
  await expect(tray.getByText(/uusi loppuosa/)).toBeVisible();
  await tray.getByRole("button", { name: "Pysäytä", exact: true }).click();
  await tray.getByRole("button", { name: "Pakota lopetus" }).click();
  expect(stops).toEqual([
    {
      owner_generation: "og_example",
      process_token: "pt_example",
      force: false,
    },
    {
      owner_generation: "og_example",
      process_token: "pt_example",
      force: true,
    },
  ]);
  await tray.getByRole("button", { name: "Poista päättyneet" }).click();
  await expect(
    tray.getByRole("button", { name: "Ei prosesseja" }),
  ).toBeVisible();
  await expect(
    tray.getByText(/Tulostetta ei ole enää saatavilla/),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .include(".ah-process-tray")
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toBeInViewport();
});

test("@process-tray unavailable native inventory is not an empty list", async ({
  page,
}) => {
  await page.route("**/api/v1/conversations/*/processes", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        owner_generation: null,
        availability: "unavailable",
        unavailable_reason: "extension_missing",
        processes: [],
      },
    }),
  );
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await expect(
    page.getByRole("button", { name: "Prosessilaajennusta ei ole" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Ei prosesseja" })).toHaveCount(
    0,
  );
});
