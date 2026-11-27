import AxeBuilder from "@axe-core/playwright";
import type { Locator, Request } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { spacing } from "./control-spacing";
import { expect, type Page, test } from "./worker-host";

// Microsoft 365's Levels guide for several organisations (design section 4,
// "same guided flow as now, one step different"): the start page's first
// choice, the shared (multi-tenant) applications created in the same walk,
// and an existing single-tenant application converted with the same ids;
// each save also puts the own organisation on the allowed list. Against the
// synthetic host's real gateway, broker relay and daemon catalog: it proves
// what the browser asks the broker to write, not what Entra does.

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

// The synthetic host's own tenant and its root-set single-tenant full-level
// application (test/browser-host/integration_apps.go), and the fixture's
// client id of a root-set section by its place among the providers.
const own = "e04c61f9-3b8d-4a27-9f5e-7d1a2c48b903";
const ownFull = "5b7e0d3a-91c2-4f68-a4d1-2c9e8f60b7a3";
const ownRead = "7c2e5b1a-0d94-4f3b-8a61-3e9f2c7d0004";
const label = "Esimerkki Konsultit Oy";

async function signIn(page: Page) {
  await page.goto("/settings");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(page).not.toHaveURL(/fixture\/provider/);
}
const fixture = async (page: Page, query: string) =>
  expect(
    (await page.request.get(`/fixture/integration-apps?${query}`)).status(),
  ).toBe(204);
type Page_ = {
  apps: { provider: string; client_id?: string; tenant_id?: string }[];
  tenants: { tenant_id: string; label: string }[];
};
const listed = async (page: Page) =>
  (await (
    await page.request.get("/api/v1/server/integrations")
  ).json()) as Page_;
const clientOf = (p: Page_, section: string) =>
  p.apps.find((a) => a.provider === section)?.client_id;
/** Every POST the page sends to the broker's write paths, in order. */
function writes(page: Page) {
  const seen: { path: string; body: Record<string, unknown> }[] = [];
  page.on("request", (r: Request) => {
    const path = new URL(r.url()).pathname;
    if (
      r.method() === "POST" &&
      path.startsWith("/api/v1/server/integrations/")
    )
      seen.push({ path, body: r.postDataJSON() });
  });
  return seen;
}
async function axe(page: Page, selector: string) {
  const audit = await new AxeBuilder({ page }).include(selector).analyze();
  expect(audit.violations).toEqual([]);
}
/** Walks forward until the application's save, returning the steps passed. */
async function walkToSave(dialog: Locator) {
  const stepname = dialog.getByTestId("ml-stepname");
  const next = dialog.getByRole("button").and(dialog.getByTestId("ml-next"));
  const save = dialog.getByRole("button").and(dialog.getByTestId("ml-save"));
  const steps: string[] = [];
  while (!(await save.count())) {
    const step = (await stepname.getAttribute("data-step")) ?? "";
    if (steps.at(-1) !== step) steps.push(step);
    await next.click();
  }
  const step = (await stepname.getAttribute("data-step")) ?? "";
  if (steps.at(-1) !== step) steps.push(step);
  return steps;
}

test("@m365-shared @a11y an administrator creates the shared applications in the guide; the own organisation goes on the list once", async ({
  page,
}) => {
  await signIn(page);
  await fixture(page, "clear=microsoft");
  await page.goto("/settings/server-integrations");
  const row = page.getByTestId("si-row-microsoft");
  await expect(row).toHaveAttribute("data-status", "needs_app");
  const sent = writes(page);
  await row
    .getByRole("button")
    .and(page.getByTestId("si-setup-microsoft"))
    .click();
  const dialog = page.getByTestId("ml-dialog");
  // Nothing shared is set, so the guide opens on today's single-tenant kind.
  await expect(dialog).toHaveAttribute("data-kind", "own");
  await dialog.getByTestId("ml-kind").getByTestId("segment-shared").click();
  await expect(dialog).toHaveAttribute("data-kind", "shared");
  await dialog.getByTestId("ml-pick-nosend").click();
  await dialog.getByTestId("ml-pick-drafts").click();
  await spacing(dialog, "start page, several organisations");
  await axe(page, "[data-testid=ml-dialog]");
  await dialog.getByTestId("ml-begin").click();

  // The first application asks the organisation's name before its name,
  // and does not go on without one.
  const next = dialog.getByRole("button").and(dialog.getByTestId("ml-next"));
  const panel = dialog.getByTestId("ml-panel");
  await next.click();
  await expect(panel).toHaveAttribute("data-part", "register.full.publisher");
  await next.click();
  await expect(dialog.getByTestId("ml-field-org")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(panel).toHaveAttribute("data-part", "register.full.publisher");
  // The new sub-item's controls and the footer (the rail above them is
  // the existing walk's).
  await spacing(dialog.getByTestId("ml-panel"), "name and publisher");
  await spacing(dialog.locator(".si-foot"), "walk footer");
  await axe(page, "[data-testid=ml-dialog]");
  await dialog.getByTestId("ml-field-org").fill(label);
  await next.click();
  // The application's name carries what was typed.
  await expect(panel).toHaveAttribute("data-part", "register.full.name");
  await expect(panel).toContainText(label);
  expect(await walkToSave(dialog)).toEqual([
    "register",
    "public",
    "permissions",
    "consent",
  ]);
  const save = dialog.getByRole("button").and(dialog.getByTestId("ml-save"));
  // Nothing set yet: the tenant is asked; the missing client id opens its
  // sub-item.
  await dialog.getByTestId("ml-field-tenant").fill(own.toUpperCase());
  await save.click();
  await dialog
    .getByTestId("ml-field-client-full")
    .fill("3f2a91c4-7d0e-4b6a-9c15-e8a4b2d7f031");
  await next.click();
  await save.click();
  // Saved, and the read level follows with the tenant and the name known.
  await expect(dialog.getByTestId("ml-stepname")).toHaveAttribute(
    "data-level",
    "read",
  );
  await walkToSave(dialog);
  await expect(dialog.getByTestId("ml-tenant-known")).toHaveText(
    own.toUpperCase(),
  );
  // The first shared application's id again is refused in its field.
  await dialog.getByRole("button").and(dialog.getByTestId("ml-back")).click();
  await dialog
    .getByTestId("ml-field-client-read")
    .fill("3F2A91C4-7D0E-4B6A-9C15-E8A4B2D7F031");
  await next.click();
  await save.click();
  await expect(dialog.getByTestId("ml-field-client-read")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await dialog
    .getByTestId("ml-field-client-read")
    .fill("6d1c0b2e-8f47-4a39-b5e2-7c9a0d3f1e84");
  await dialog.getByRole("button").and(dialog.getByTestId("ml-next")).click();
  await save.click();
  await expect(dialog).toHaveAttribute("data-page", "start");
  await expect(dialog.getByTestId("ml-set-full")).toBeVisible();
  await expect(dialog.getByTestId("ml-set-read")).toBeVisible();

  // Two shared sections, and the own organisation listed once, lowercased.
  expect(sent.map((w) => w.path)).toEqual([
    "/api/v1/server/integrations/set",
    "/api/v1/server/integrations/tenants/set",
    "/api/v1/server/integrations/set",
  ]);
  expect(sent[0].body).toEqual({
    provider: "microsoft_shared",
    fields: {
      client_id: "3f2a91c4-7d0e-4b6a-9c15-e8a4b2d7f031",
      tenant_id: own.toUpperCase(),
    },
  });
  expect(sent[1].body).toEqual({ tenant_id: own, label });
  expect((sent[2].body as { provider: string }).provider).toBe(
    "microsoft_shared_read",
  );
  const after = await listed(page);
  expect(after.tenants).toEqual([
    expect.objectContaining({ tenant_id: own, label }),
  ]);
  expect(clientOf(after, "microsoft")).toBeUndefined();
  // The row offers the levels the shared applications serve, and the
  // organisations; people can connect in the own organisation.
  await expect(row.getByTestId("si-setup-microsoft")).toHaveAttribute(
    "data-count",
    "2/4",
  );
  await expect(row.getByTestId("si-orgs-microsoft")).toHaveAttribute(
    "data-count",
    "1",
  );
  await expect(row).toHaveAttribute("data-status", "ready");
});

test("@m365-shared @a11y converting the own organisation's applications saves the same ids; a refused list keeps the saved application", async ({
  page,
}) => {
  await signIn(page);
  await fixture(page, "set=microsoft_read");
  // A full allowed list: the own organisation cannot be added.
  for (let i = 0; i < 32; i++)
    await fixture(
      page,
      `tenant=0a1b2c3d-0000-4000-8000-${String(i).padStart(12, "0")}:Organisaatio ${i}`,
    );
  await page.goto("/settings/server-integrations");
  const row = page.getByTestId("si-row-microsoft");
  await expect(row).toHaveAttribute("data-status", "ready");
  const sent = writes(page);
  await row
    .getByRole("button")
    .and(page.getByTestId("si-setup-microsoft"))
    .click();
  const dialog = page.getByTestId("ml-dialog");
  await dialog.getByTestId("ml-kind").getByTestId("segment-shared").click();
  // Two levels have an own-organisation application: convert is offered.
  const choice = dialog.getByTestId("ml-convert");
  await expect(choice.getByRole("radio")).toHaveCount(2);
  await expect(choice.getByRole("radio").first()).toBeChecked();
  await dialog.getByTestId("ml-pick-nosend").click();
  await dialog.getByTestId("ml-pick-drafts").click();
  await spacing(dialog, "start page with the conversion choice");
  await axe(page, "[data-testid=ml-dialog]");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  // The new choices; the level table scrolls under the footer on a phone.
  await spacing(dialog.locator(".ml-lead"), "the kind choice on a phone");
  await spacing(choice, "the conversion choice on a phone");
  await page.setViewportSize({ width: 1280, height: 900 });
  await dialog.getByTestId("ml-begin").click();

  // Converting is switched in Entra, two steps; the organisation's name is
  // asked on the way.
  const next = dialog.getByRole("button").and(dialog.getByTestId("ml-next"));
  const panel = dialog.getByTestId("ml-panel");
  await expect(panel).toHaveAttribute("data-part", "convert.full.find");
  await next.click();
  await expect(panel).toHaveAttribute("data-part", "convert.full.accounts");
  await next.click();
  await expect(panel).toHaveAttribute("data-part", "convert.full.publisher");
  await dialog.getByTestId("ml-field-org").fill(label);
  await spacing(
    dialog.getByTestId("ml-panel"),
    "converting: name and publisher",
  );
  expect(await walkToSave(dialog)).toEqual(["convert", "save"]);
  await expect(dialog.getByTestId("ml-convert-client")).toHaveText(ownFull);
  await axe(page, "[data-testid=ml-dialog]");
  const save = dialog.getByRole("button").and(dialog.getByTestId("ml-save"));
  await save.click();
  // The application is saved; the list refused, so the walk stays.
  await expect(dialog.getByTestId("ml-refusal")).toBeVisible();
  await expect(dialog.getByTestId("ml-stepname")).toHaveAttribute(
    "data-level",
    "full",
  );
  expect(clientOf(await listed(page), "microsoft_shared")).toBe(ownFull);
  // Room on the list: Save adds the own organisation without writing the
  // application again.
  await fixture(page, "untenant=0a1b2c3d-0000-4000-8000-000000000031");
  await save.click();
  await expect(dialog.getByTestId("ml-stepname")).toHaveAttribute(
    "data-level",
    "read",
  );
  // The read level converts too; the name is now the list's.
  await expect(panel).toHaveAttribute("data-part", "convert.read.find");
  await walkToSave(dialog);
  await expect(dialog.getByTestId("ml-convert-client")).toHaveText(ownRead);
  await save.click();
  await expect(dialog).toHaveAttribute("data-page", "start");

  expect(sent.map((w) => w.path)).toEqual([
    "/api/v1/server/integrations/set",
    "/api/v1/server/integrations/tenants/set",
    "/api/v1/server/integrations/tenants/set",
    "/api/v1/server/integrations/set",
  ]);
  expect(sent[0].body).toEqual({
    provider: "microsoft_shared",
    fields: { client_id: ownFull, tenant_id: own },
  });
  expect(sent[2].body).toEqual({ tenant_id: own, label });
  expect(sent[3].body).toEqual({
    provider: "microsoft_shared_read",
    fields: { client_id: ownRead, tenant_id: own },
  });
  // The single-tenant sections stay as they were, so their connections do.
  const after = await listed(page);
  expect(clientOf(after, "microsoft")).toBe(ownFull);
  expect(clientOf(after, "microsoft_read")).toBe(ownRead);
});

test("@m365-shared choosing to create new applications walks the full creation, and the own kind is untouched", async ({
  page,
}) => {
  await signIn(page);
  await fixture(page, `tenant=${own}:${label}`);
  await page.goto("/settings/server-integrations");
  const row = page.getByTestId("si-row-microsoft");
  await row
    .getByRole("button")
    .and(page.getByTestId("si-setup-microsoft"))
    .click();
  const dialog = page.getByTestId("ml-dialog");
  // The own kind still shows the single-tenant level as set.
  await expect(dialog).toHaveAttribute("data-kind", "own");
  await expect(dialog.getByTestId("ml-set-full")).toBeVisible();
  await dialog.getByTestId("ml-kind").getByTestId("segment-shared").click();
  await expect(dialog.getByTestId("ml-set-full")).toHaveCount(0);
  await dialog
    .getByTestId("ml-convert")
    .getByRole("radio")
    .nth(1)
    .check({ force: true });
  for (const l of ["nosend", "drafts", "read"])
    await dialog.getByTestId(`ml-pick-${l}`).click();
  await dialog.getByTestId("ml-begin").click();
  const next = dialog.getByRole("button").and(dialog.getByTestId("ml-next"));
  await next.click();
  // The list names the own organisation, so its name is shown, not asked.
  await expect(dialog.getByTestId("ml-org-known")).toHaveText(label);
  await expect(dialog.getByTestId("ml-field-org")).toHaveCount(0);
  expect(await walkToSave(dialog)).toEqual([
    "register",
    "public",
    "permissions",
    "consent",
  ]);
  // The own organisation's application is another application.
  const save = dialog.getByRole("button").and(dialog.getByTestId("ml-save"));
  await save.click();
  await dialog.getByTestId("ml-field-client-full").fill(ownFull);
  await next.click();
  await save.click();
  await expect(dialog.getByTestId("ml-field-client-full")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});
