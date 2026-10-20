import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect } from "./worker-host";

const test = createHostTest();
test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("cross-workspace child belongs to target worktrees and parent spinoffs", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("cross workspace");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(page.getByText('Selvä. Kysyit: "cross workspace".')).toBeVisible(
    { timeout: 20000 },
  );
  const parentURL = page.url();
  const parent = new URL(parentURL).searchParams
    .get("conversation")
    ?.replace(/^pi:/, "");
  expect(parent).toMatch(/^[0-9a-f-]{36}$/);
  // Synthetic native Taskfleet create in B, attributed to the conversation in A.
  expect(
    (
      await page.request.get(`/fixture/cross-workspace?parent=${parent}`)
    ).status(),
  ).toBe(204);
  await page.reload();
  const strip = page.getByRole("region", { name: "Taustatyö" });
  await expect(
    strip.getByRole("button", { name: /^Spinoffit: 1 työskentelee/ }),
  ).toBeVisible();
  await strip.getByRole("button", { name: /^Spinoffit:/ }).click();
  await expect(
    strip.getByRole("button", { name: /^ui-test-ok/ }).first(),
  ).toBeVisible();
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const target = snapshot.workspaces.find(
    (w: { name: string }) => w.name === "git-project",
  );
  await page.goto(`/workspaces/${target.workspace_id}`);
  const trees = page.getByRole("region", { name: "Worktreet", exact: true });
  const child = trees.getByRole("listitem").filter({ hasText: "cross-worker" });
  await expect(child).toContainText("omistaa tämän worktreen");
  await expect(child.getByRole("button")).toHaveCount(0);
  // Not a worktree of A, even though A created the run.
  const source = snapshot.workspaces.find(
    (w: { name: string }) => w.name === "ordinary-dir",
  );
  await page.goto(`/workspaces/${source.workspace_id}`);
  await expect(page.getByText("cross-worker", { exact: true })).toHaveCount(0);
  await page.goto(parentURL);
  await expect(
    strip.getByRole("button", { name: /^Spinoffit: 1 työskentelee/ }),
  ).toBeVisible();
  const a11y = await new AxeBuilder({ page }).include(".ah-bg-strip").analyze();
  expect(
    a11y.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});
