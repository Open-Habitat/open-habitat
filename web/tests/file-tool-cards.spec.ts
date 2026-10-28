import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
async function openFileWork(page: import("@playwright/test").Page) {
  const turn = page.getByTestId("agent-turn").first();
  const saved = turn.getByTestId("history-stage-toggle");
  await expect(saved).toBeVisible({ timeout: 25000 });
  if ((await saved.getAttribute("aria-expanded")) === "false")
    await saved.click();
}
test("@file-tool-cards saved file rows retain counts, content and accessible diff", async ({
  page,
}) => {
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").fill("näytä kortit");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  // The fake Pi writes these extra cards into native history; it does not
  // stream them as live tool events. Wait for settlement before inspecting.
  await expectNativeContent(page, 'Selvä. Kysyit: "näytä kortit".', {});
  await openFileWork(page);
  const tool = (name: string) =>
    page
      .getByTestId("tool-row")
      .and(page.locator(`[data-tool-name="${name}"]`))
      .first();
  await expect(tool("read").locator(".ah-file-stat")).toHaveText(/\b2\b/, {
    timeout: 25000,
  });
  await expect(tool("write").locator(".ah-file-stat")).toHaveText(/\b1\b/);
  await expect(tool("edit")).toContainText("+1 −1");
  const savedHistory = page.waitForResponse(
    (response) => response.url().includes("/history?limit=25") && response.ok(),
  );
  await page.reload();
  await savedHistory;
  // Reload can first paint provisional output; wait for the saved native reply
  // before opening its disclosures.
  await expectNativeContent(page, 'Selvä. Kysyit: "näytä kortit".', {});
  await openFileWork(page);
  for (const name of ["read", "write", "edit"]) {
    await expect(async () => {
      const toggle = tool(name).locator("button").first();
      if ((await toggle.getAttribute("aria-expanded")) !== "true")
        await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true", {
        timeout: 750,
      });
    }).toPass({ timeout: 10000 });
  }
  await expect(tool("read").getByTestId("output-copy")).toBeVisible();
  await expectNativeContent(tool("write"), "typescript", {});
  // The label is inside the surface, above its first line and left of the rail.
  // Over that reserved space a code label stays put under the pointer; the
  // diff card's label gives way on hover.
  for (const name of ["read", "write", "edit"]) {
    const box = tool(name).locator(
      name === "edit" ? ".ah-file-diff-box" : ".ah-output-box",
    );
    const label = box.locator(".ah-output-meta");
    await expect(label).toHaveCount(1);
    const layout = await box.evaluate((node, name) => {
      const surface = node.querySelector("pre");
      const caption = node.querySelector(".ah-output-meta");
      const rail = node.querySelector(
        name === "edit" ? "button" : ".ah-bash-rail",
      );
      if (!surface || !caption || !rail) return null;
      const firstLineTop =
        surface.getBoundingClientRect().top +
        parseFloat(getComputedStyle(surface).paddingTop);
      const c = caption.getBoundingClientRect();
      return {
        inside:
          c.top >= surface.getBoundingClientRect().top &&
          c.bottom < firstLineTop,
        clearRail: c.right < rail.getBoundingClientRect().left,
      };
    }, name);
    expect(layout).toEqual({ inside: true, clearRail: true });
    await box.hover();
    if (name === "edit") await expect(label).toHaveCSS("opacity", "0");
    else await expect(label).not.toHaveCSS("opacity", "0");
  }
  await expect(async () => {
    const toggle = tool("edit").locator("button").first();
    if ((await toggle.getAttribute("aria-expanded")) === "false")
      await toggle.click();
    await expect(tool("edit").locator("del")).toHaveText("2");
  }).toPass({ timeout: 15000 });
  await expect(tool("edit").locator("ins")).toHaveText("3");
  await expect(tool("edit").getByTestId("diff-deletion-label")).toHaveCount(1);
  await expect(tool("edit").getByTestId("diff-addition-label")).toHaveCount(1);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const caption = tool("write").locator(".ah-output-meta");
    const viewport = tool("write").locator(".ah-output-viewport");
    const labelRect = await caption.boundingBox();
    const surfaceRect = await viewport.boundingBox();
    expect(
      labelRect &&
        surfaceRect &&
        labelRect.x + labelRect.width < surfaceRect.x + surfaceRect.width,
    ).toBe(true);
    const geometry = await tool("write").evaluate((node) => {
      const row = node.getBoundingClientRect();
      const marker = node
        .closest(".ah-agent-turn")
        ?.querySelector(".ah-turn-stage");
      const reply = node
        .closest(".ah-agent-turn")
        ?.querySelector(".ah-turn-reply .ah-message");
      const inner = node.querySelector(".ah-disclosure-panel");
      return {
        right: row.right,
        markerRight: marker?.getBoundingClientRect().right,
        replyRight: reply?.getBoundingClientRect().right,
        padding: inner ? getComputedStyle(inner).paddingLeft : "",
        replyPadding: reply ? getComputedStyle(reply).paddingLeft : "",
      };
    });
    expect(Math.abs(geometry.right - (geometry.markerRight ?? 0))).toBeLessThan(
      1,
    );
    expect(Math.abs(geometry.right - (geometry.replyRight ?? 0))).toBeLessThan(
      1,
    );
    expect(geometry.padding).toBe(geometry.replyPadding);
  }
  const box = tool("write").locator(".ah-output-box");
  await expect(
    box.getByTestId("output-wrap").and(page.locator('[aria-pressed="false"]')),
  ).toHaveCount(0);
  await box.evaluate((node) => {
    (node as HTMLElement).style.width = "110px";
  });
  await expect(
    box.getByTestId("output-wrap").and(page.locator('[aria-pressed="false"]')),
  ).toBeVisible();
  await box
    .getByTestId("output-wrap")
    .and(page.locator('[aria-pressed="false"]'))
    .click();
  await expect(
    box.getByTestId("output-wrap").and(page.locator('[aria-pressed="true"]')),
  ).toBeVisible();
  expect(
    await box
      .locator(".ah-output-viewport")
      .first()
      .evaluate((pre) => pre.scrollWidth <= pre.clientWidth + 1),
  ).toBe(true);
  await box.evaluate((node) => {
    (node as HTMLElement).style.width = "";
  });
  await expect(
    box.getByTestId("output-wrap").and(page.locator('[aria-pressed="true"]')),
  ).toHaveCount(0);
  expect(
    (await new AxeBuilder({ page }).include(".ah-file-diff-box").analyze())
      .violations,
  ).toEqual([]);
});

test("@file-tool-cards failed read shows the native error without a file count", async ({
  page,
}) => {
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").fill("virhekortti");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  // This case asserts the saved failure, not the transient live disclosure.
  // Wait for settlement so the live button cannot disappear during its click.
  await expectNativeContent(page, 'Selvä. Kysyit: "virhekortti".', {});
  await openFileWork(page);
  const row = page
    .getByTestId("tool-row")
    .and(page.locator('[data-tool-name="read"]'))
    .first();
  await expect(row).toHaveAttribute("data-state", "failed", { timeout: 25000 });
  await row.locator("button").first().click();
  await expectNativeContent(row, "ENOENT: missing.ts", {});
  await expect(row.locator(".ah-output-box")).toHaveCount(0);
  await expect(row.locator(".ah-file-stat")).toHaveCount(0);
});

// Native content is asserted independently of translated controls. This helper
// only reads rendered content; it never finds an element for an interaction.
async function expectNativeContent(
  scope: import("@playwright/test").Page | import("@playwright/test").Locator,
  expected: string | RegExp,
  options: {
    count?: number;
    visible?: boolean;
    exact?: boolean;
    timeout?: number;
  } = {},
) {
  const { count, visible = true, exact = false, timeout } = options;
  const read = () =>
    scope.locator("*").evaluateAll(
      (nodes, args) => {
        const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
        const matches = (node: Element) => {
          if (["SCRIPT", "STYLE", "HEAD"].includes(node.tagName)) return false;
          const text = normalize(node.textContent ?? "");
          return args.regex
            ? new RegExp(args.regex, args.flags).test(text)
            : args.exact
              ? text === normalize(args.text)
              : text.includes(normalize(args.text));
        };
        return nodes.filter(
          (node) =>
            matches(node) &&
            ![...node.children].some(matches) &&
            (!args.visible ||
              (node.getClientRects().length > 0 &&
                getComputedStyle(node).visibility !== "hidden")),
        ).length;
      },
      {
        text: typeof expected === "string" ? expected : "",
        regex: expected instanceof RegExp ? expected.source : "",
        flags: expected instanceof RegExp ? expected.flags : "",
        exact,
        visible,
      },
    );
  if (count === undefined)
    await expect.poll(read, { timeout }).toBeGreaterThan(0);
  else await expect.poll(read, { timeout }).toBe(count);
}
