import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { snapshot } from "../lab/session.mjs";
import { expect, test } from "./lab-host";

// Real gateway/daemon, synthetic model and homes: references must preview as
// inert images and selection must survive a reload as a repository icon.
test("@workspace-icons another workspace logo and an attached image can be selected", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
  await page.waitForURL(/\/workspaces/);
  // The repository logo must reach the tool-free model as content and
  // return through the ordinary logo preview, not another workspace's image.
  await page.getByRole("navigation").getByTestId("workspace-kotisivu").click();
  await page.getByTestId("workspace-icon-picker").click();
  await page.getByTestId("workspace-icon-ask-model").click();
  const row = page.getByTestId("workspace-icon-suggestions");
  await expect(row).toHaveAttribute("data-state", "done");
  const ownLogo = row
    .getByTestId("workspace-icon-suggestion")
    .first()
    .locator("img");
  await expect(ownLogo).toBeVisible();
  await expect
    .poll(() => ownLogo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  const ownURL = new URL((await ownLogo.getAttribute("src")) ?? "", page.url());
  expect(ownURL.searchParams.get("workspace_id")).toBe(
    new URL(page.url()).pathname.split("/").pop(),
  );
  expect(ownURL.searchParams.get("logo")).toBe("1");
  const target = page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello");
  const targetID = (await target.getAttribute("href"))?.split("/").pop();
  const targetAnswer = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/workspaces/icon/suggestions") &&
      response.request().postDataJSON()?.workspace_id === targetID,
  );
  await target.click();
  await targetAnswer;
  await expect(row).toHaveAttribute("data-state", "done");
  await row.getByTestId("workspace-icon-wish").fill("kotisivu logo");
  await row.getByTestId("send").click();
  await expect(row).toHaveAttribute("data-state", "done");
  const imageChoice = row
    .getByTestId("workspace-icon-suggestion")
    .filter({ has: page.locator("img") })
    .first();
  const preview = imageChoice.locator("img");
  await expect
    .poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  const response = await page.request.get(
    (await preview.getAttribute("src")) ?? "",
  );
  expect(response.headers()["content-type"]).toBe("image/svg+xml");
  expect(response.headers()["content-security-policy"]).toContain("sandbox");
  const capture = process.env.OH_WORKSPACE_ICONS_CAPTURE;
  if (capture) {
    mkdirSync(capture, { recursive: true });
    await snapshot(page, resolve(capture, "other-workspace-logo"), {
      labOrigin: new URL(page.url()).origin,
    });
  }
  await imageChoice.click();
  await expect(row).toHaveCount(0);
  await expect(
    page.locator('[data-testid="archive-notice"][data-kind="workspace-icon"]'),
  ).toBeVisible();
  await page.reload();
  const head = page.getByTestId("workspace-icon-picker");
  await expect
    .poll(() =>
      head.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await head.click();
  await page.getByTestId("workspace-icon-ask-model").click();
  await expect(row).toHaveAttribute("data-state", "done");
  await row.locator('input[type="file"]').setInputFiles({
    name: "reference.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await row.getByTestId("send").click();
  await expect(row).toHaveAttribute("data-state", "done");
  await expect
    .poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(1);
  if (capture) {
    await snapshot(page, resolve(capture, "attachment-candidate"), {
      labOrigin: new URL(page.url()).origin,
    });
  }
  await imageChoice.click();
  await expect(row).toHaveCount(0);
  await expect(
    page.locator('[data-testid="archive-notice"][data-kind="workspace-icon"]'),
  ).toBeVisible();
  await page.reload();
  await expect
    .poll(() =>
      head.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBe(1);
  const saved = await page.request.get(
    (await head.locator("img").getAttribute("src")) ?? "",
  );
  expect(saved.headers()["content-type"]).toBe("image/png");
});
