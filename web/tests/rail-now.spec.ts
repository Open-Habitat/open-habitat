import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("@rail-now @a11y workspaces stay alphabetical, the filter finds archived ones, and the narrow rail keeps live work", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  // Wire seam: one workspace archived and one renamed so that catalog order
  // is not alphabetical, without a host write.
  await page.route("**/api/v1/snapshot", async (route) => {
    // A page load can dispose a read that is still in flight.
    try {
      const response = await route.fetch();
      const body = await response.json();
      for (const w of body.workspaces)
        if (w.name === "without-metadata") w.visibility = "hidden";
        else if (w.name === "git-project") w.display_name = "zeta-project";
      await route.fulfill({ response, json: body });
    } catch {
      await route.abort().catch(() => {});
    }
  });
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const nav = page
    .getByRole("navigation")
    .and(page.getByTestId("workspace-navigation"));
  const rows = nav.locator(".ah-workspace-list a[data-workspace-name]");
  await expect(rows.first()).toBeVisible();
  const names = await rows.evaluateAll((links) =>
    links.map((a) => a.getAttribute("data-workspace-name") ?? ""),
  );
  expect(names).toEqual(["ordinary-dir", "zeta-project"]);

  // The filter narrows the list and opens the archived group on a match.
  const toggle = nav.getByTestId("toggle-archived");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await nav.getByTestId("workspace-filter").fill("metadata");
  await expect(rows).toHaveCount(0);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(
    nav
      .getByTestId("archived-workspaces")
      .getByTestId("workspace-without-metadata"),
  ).toBeVisible();
  await expect(nav.getByTestId("filter-empty")).toHaveCount(0);
  await nav.getByTestId("clear-filter").click();

  // A conversation at work is live work: it shows in Käynnissä, not under
  // its workspace, and stays reachable from the narrow rail. The slow turn
  // lasts long enough for these checks.
  await nav.getByTestId("workspace-ordinary-dir").click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  await page.getByTestId("message-input").fill("hidas työ");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const url = new URL(page.url());
  const href = url.pathname + url.search;
  await expect(
    nav.getByTestId("rail-running").locator(`a[href="${href}"]`),
  ).toBeVisible();
  await expect(
    nav.locator(".ah-workspace-list").getByTestId("agent-link"),
  ).toHaveCount(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="workspace-navigation"]')
        .analyze()
    ).violations,
  ).toEqual([]);

  await nav.getByTestId("close-navigation").click();
  const dot = nav.getByTestId("rail-running").locator(`a[href="${href}"]`);
  await expect(dot).toBeVisible();
  await expect(nav.getByTestId("workspace-filter")).toHaveCount(0);
  await expect(nav.getByTestId("workspace-ordinary-dir")).toHaveCount(0);
  await nav.getByTestId("rail-all-workspaces").click();
  await expect(nav.getByTestId("workspace-ordinary-dir")).toBeVisible();
});
