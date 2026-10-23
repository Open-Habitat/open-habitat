import { writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

const nativeId = "pi:11111111-1111-4111-8111-111111111111";
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});
async function login(page: import("@playwright/test").Page) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
}

test("native notice reopens as inert text with agent origin and timestamp", async ({
  page,
}, info) => {
  expect(
    (await page.request.get("/fixture/history?mode=notice")).status(),
  ).toBe(204);
  await login(page);
  await page.goto(`/agents/${nativeId}`);
  const card = page.getByTestId("agent-notice");
  await expect(card).toHaveAttribute("data-persistence", "persisted");
  await expect(card).toContainText("<script>alert(1)</script>");
  await expect(card.locator("script,img,a")).toHaveCount(0);
  await expect(card.locator("time")).toHaveAttribute(
    "datetime",
    "2026-10-21T10:00:00Z",
  );
  await page.reload();
  await expect(card).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="agent-notice"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath("notice.png") });
  await writeFile(info.outputPath("notice.html"), await page.content());
  await card.getByTestId("agent-notice-dismiss").click();
  await expect(card).toHaveCount(0);
  // Dismissal affects only this presentation, never the native history entry.
  await page.reload();
  await expect(card).toHaveAttribute("data-persistence", "persisted");
});

test("nonpersistent notice arrives live only in its conversation and disappears on reload", async ({
  page,
}, info) => {
  await page.request.get("/fixture/scenario?value=ready");
  await login(page);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  const originalURL = page.url();
  const id = new URL(originalURL).searchParams.get("conversation") ?? "";
  const text = "Quota full <script>alert(1)</script>";
  expect(
    (
      await page.request.get(
        `/fixture/notice?id=${encodeURIComponent(id)}&text=${encodeURIComponent(text)}`,
      )
    ).status(),
  ).toBe(204);
  const card = page.getByTestId("agent-notice");
  await expect(card).toHaveAttribute("data-persistence", "not_persisted");
  await expect(card).toContainText(text);
  await expect(card.locator("script,img,a")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("temporary-notice.png") });
  await writeFile(
    info.outputPath("temporary-notice.html"),
    await page.content(),
  );
  await page.goto(`/agents/${nativeId}`);
  await expect(card).toHaveCount(0);
  await page.goto(originalURL);
  // A full document navigation intentionally loses the transient tab model.
  await expect(card).toHaveCount(0);
});
