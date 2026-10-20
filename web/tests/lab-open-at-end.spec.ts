import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});

test("@lab opening from home, sidebar and workspace always lands at latest", async ({
  page,
}) => {
  await page.request.get("/fixture/open-at-end");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  const end = async () => {
    await expect(
      page.getByText("Viimeisin vastaus on tässä.", { exact: true }),
    ).toBeInViewport();
    await expect
      .poll(() =>
        page
          .locator(".ah-conversation-stream")
          .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
      )
      .toBeLessThan(2);
  };
  const leave = async () => {
    await page.locator(".ah-conversation-stream").hover();
    await page.mouse.wheel(0, -4000);
    await expect
      .poll(() =>
        page
          .locator(".ah-conversation-stream")
          .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
      )
      .toBeGreaterThan(100);
    await page.getByRole("link", { name: "Etusivu", exact: true }).click();
  };
  const card = page
    .locator(".ah-home-card")
    .filter({ hasText: "Avaamisen tarkistus" });
  await card.getByRole("link", { name: /^Avaa →$/ }).click();
  await end();
  await leave();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: /Avaamisen tarkistus/ })
    .click();
  await end();
  await leave();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello", exact: true })
    .click();
  await page
    .locator("main")
    .getByRole("link", { name: /Avaamisen tarkistus/ })
    .click();
  await end();
});

test("@lab native extension messages keep process summaries and omit empty cards", async ({
  page,
}) => {
  await page.request.get("/fixture/open-at-end");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
  // Native structured details, never XML, determine the completion block.
  const notification = page
    .getByRole("note")
    .filter({ hasText: "test · valmis" });
  await expect(notification).toHaveCount(1);
  const toggle = notification.getByRole("button", {
    name: "test · valmis · koodi 0",
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(
    notification.getByText(/Merkintä säilyy historiassa/),
  ).toBeVisible();
  await expect(notification.locator("pre, process_event")).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".ah-feed")).not.toContainText("<process_event");
  await expect(
    page.getByText("Laajennuksen viesti", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".ah-feed")).not.toContainText(
    "not for the browser",
  );
  await expect(page.locator(".ah-feed")).not.toContainText(
    "Synthetic internal instruction",
  );
});

test("@lab a controlled conversation reopens at latest instead of its old reading anchor", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Aloita uusi agenttikeskustelu" })
    .click();
  await page
    .getByRole("textbox", { name: "Viesti agentille" })
    .fill(
      "Ohjatun avauksen tarkistus\n\n" +
        "Pitkä synteettinen kappale.\n\n".repeat(30),
    );
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti agentille" }),
  ).toBeEnabled({ timeout: 20000 });
  await expect(page.locator(".ah-turn-reply").last()).toContainText(
    "Selvä. Kysyit:",
    { timeout: 20000 },
  );
  const href = new URL(page.url()).pathname + new URL(page.url()).search;
  for (const from of ["home", "sidebar", "workspace"]) {
    const stream = page.locator(".ah-conversation-stream");
    await stream.hover();
    await page.mouse.wheel(0, -4000);
    await expect
      .poll(() =>
        stream.evaluate(
          (el) => el.scrollHeight - el.scrollTop - el.clientHeight,
        ),
      )
      .toBeGreaterThan(100);
    await page.getByRole("link", { name: "Etusivu", exact: true }).click();
    if (from === "home") {
      await page
        .locator(".ah-home-card")
        .filter({ hasText: "Ohjatun avauksen tarkistus" })
        .getByRole("link", { name: /^(Avaa|Lue vastaus|Vastaa) →$/ })
        .click();
    } else if (from === "sidebar") {
      await page.getByRole("navigation").locator(`a[href="${href}"]`).click();
    } else {
      await page
        .getByRole("navigation")
        .getByRole("link", { name: "aurinkokello", exact: true })
        .click();
      await page.locator("main").locator(`a[href="${href}"]`).first().click();
    }
    await expect
      .poll(() =>
        page
          .locator(".ah-conversation-stream")
          .evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight),
      )
      .toBeLessThan(2);
  }
});
