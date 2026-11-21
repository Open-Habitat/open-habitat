import type { Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

// The agent asks the person's permission before an account action (2 Kenttä,
// Jari 21.11.2026). The fake Pi asks exactly as the companion's askPermission
// does (a prefixed confirm) when a prompt says "pyydä lupaa", so this drives
// the real daemon controller, its typed question and the answer back to Pi.
test.beforeEach(async ({ page }) => {
  expect((await page.request.get("/fixture/reset-clock")).status()).toBe(204);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});

async function ask(page: Page, prompt: string) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").fill(prompt);
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
}

test("@permission-question the question takes the composer's place until answered, one at a time", async ({
  page,
}) => {
  let answers: unknown[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/question"))
      answers.push(request.postDataJSON());
  });
  await ask(page, "pyydä lupaa kahdesti");
  const dock = page.getByTestId("permission-dock");
  await expect(dock).toBeVisible();
  // The person cannot write past the question; the composer waits under it.
  await expect(page.getByTestId("message-input")).toBeHidden();
  await expect(page.getByTestId("permission-title")).toHaveText(
    "Poista postikansio ’Laskut 2024’",
  );
  await expect(page.getByTestId("permission-account")).toHaveText(
    "Microsoft-tilillä aino@example.test",
  );
  await expect(dock).toContainText(
    "Kansio ja sen 37 viestiä poistetaan postilaatikosta.",
  );
  const technical = page.getByTestId("permission-technical");
  await technical.locator("summary").click();
  await expect(technical).toContainText("ms-admin · delete-mail-folder");
  await expect(technical).toContainText("AAMkExample");
  // The stream line and the header say the agent waits.
  const lines = page.getByTestId("permission-line");
  await expect(lines).toHaveCount(1);
  await expect(lines.first()).toHaveText(
    "Agentti odottaa lupaasi · Poista postikansio ’Laskut 2024’",
  );
  const header = page.locator(".ah-agent-header");
  await expect(header).toContainText("Odottaa lupaasi");
  await expect(header.locator('.oh-mark[data-state="waiting"]')).toHaveCount(1);
  await expect(page.getByTestId("permission-stop")).toBeEnabled();

  await page.getByTestId("permission-allow").click();
  await expect(page.getByTestId("permission-title")).toHaveText(
    "Jaa kalenteri ’Perhe’ henkilölle Ville Virtanen",
  );
  await expect(lines.first()).toHaveText(
    "Sallit · Poista postikansio ’Laskut 2024’",
  );
  await expect(lines.nth(1)).toHaveText(
    "Agentti odottaa lupaasi · Jaa kalenteri ’Perhe’ henkilölle Ville Virtanen",
  );
  await page.getByTestId("permission-deny").click();
  await expect(dock).toHaveCount(0);
  await expect(page.getByTestId("message-input")).toBeVisible();
  await expect(page.getByTestId("conversation-timeline")).toContainText(
    "Jätin tekemättä, koska et sallinut: Jaa kalenteri",
  );
  expect(answers).toHaveLength(2);
  expect(answers[0]).toMatchObject({ action: "answer", value: true });
  expect(answers[1]).toMatchObject({ action: "answer", value: false });
  answers = [];
  // A reload sends nothing again.
  await page.reload();
  await expect(page.getByTestId("message-input")).toBeVisible();
  await expect(page.getByTestId("permission-dock")).toHaveCount(0);
  expect(answers).toHaveLength(0);
});

test("@permission-question on a phone it is a bottom sheet, and Stop still stops", async ({
  page,
}) => {
  await ask(page, "pyydä lupaa");
  const question = page.getByTestId("permission-question");
  await expect(question).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await question.boundingBox();
  const allow = await page.getByTestId("permission-allow").boundingBox();
  const deny = await page.getByTestId("permission-deny").boundingBox();
  if (!box || !allow || !deny) throw new Error("question not laid out");
  // Edge to edge at the bottom of the screen, with wide buttons.
  expect(box.x).toBeLessThanOrEqual(1);
  expect(box.width).toBeGreaterThanOrEqual(388);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  expect(box.y + box.height).toBeGreaterThan(700);
  expect(allow.width).toBeGreaterThan(120);
  expect(Math.abs(allow.width - deny.width)).toBeLessThan(2);
  await page.getByTestId("permission-stop").click();
  await expect(question).toHaveCount(0);
  await expect(page.getByTestId("message-input")).toBeVisible();
});
