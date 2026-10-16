import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("@thinking-title @a11y reasoning titles stay on their own disclosure row in both states", async ({
  page,
}) => {
  // Supply invented reasoning through the validated history boundary. This
  // tests production rendering, not native Pi's choice of summary wording.
  await page.route("**/api/v1/agents/*/history?*", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    if (!json.entries) return route.fulfill({ response });
    const content = (text: string) => ({
      media_type: "text/plain",
      text,
      complete: true,
    });
    json.entries = [
      {
        entry_key: "thinking-user",
        kind: "user",
        content: content("Explain the extension message"),
      },
      {
        entry_key: "thinking-assistant",
        kind: "assistant",
        content: content("Synthetic reply"),
        blocks: [
          {
            type: "thinking",
            text: "**Interpreting extension messages**\n\nKeep **other emphasis** and the rest of the reasoning.\n\n- First point\n- Second point",
          },
          {
            type: "thinking",
            text: "**Checking the source**\n\nThis second block has its own title.",
          },
          { type: "text", text: "Synthetic reply" },
        ],
      },
    ];
    await route.fulfill({ response, json });
  });
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page.goto("/agents/pi:11111111-1111-4111-8111-111111111111");
  await page.getByRole("button", { name: /PI.*2 ajatusta/ }).click();
  const first = page.getByRole("button", {
    name: "Ajattelu · Interpreting extension messages",
    exact: true,
  });
  const second = page.getByRole("button", {
    name: "Ajattelu · Checking the source",
    exact: true,
  });
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(second).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("other emphasis", { exact: true })).toHaveCount(
    0,
  );
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(second).toHaveAttribute("aria-expanded", "false");
  const body = page.locator(".ah-think-long blockquote");
  await expect(body.locator("strong")).toHaveText("other emphasis");
  await expect(body.getByRole("listitem")).toHaveText([
    "First point",
    "Second point",
  ]);
  await expect(body).not.toContainText("Interpreting extension messages");
  await second.click();
  await expect(
    page.getByText("This second block has its own title."),
  ).toBeVisible();
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(second).toHaveAttribute("aria-expanded", "true");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await first.evaluate((button) => {
      const [label, title] = [...button.children].map((child) =>
        child.getBoundingClientRect(),
      );
      const row = button.getBoundingClientRect();
      return {
        sameRow: Math.abs(label.top - title.top) < 1,
        fits: row.right <= window.innerWidth,
      };
    });
    expect(geometry).toEqual({ sameRow: true, fits: true });
  }
  expect(
    (
      await new AxeBuilder({ page })
        .include(".ah-conversation-stream")
        .analyze()
    ).violations,
  ).toEqual([]);
});
