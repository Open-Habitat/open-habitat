import { openLab, origin, snapshot } from "./session.mjs";

const stage = process.argv[2];
if (!["before", "after"].includes(stage))
  throw Error("before or after required");
const { browser, page } = await openLab();
try {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const workspace = await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello", exact: true })
    .first()
    .getAttribute("href");
  await page.goto(`${origin}${workspace}`);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").waitFor();
  await page.getByTestId("message-input").fill("Synthetic notice evidence");
  await page.getByTestId("send").click();
  await page.getByTestId("message-input").waitFor({ state: "visible" });
  const conversationURL = page.url();
  await page.route("**/api/v1/workspaces/terminals?*", (route) =>
    route.fulfill({ status: 503, body: "" }),
  );
  await page.getByTestId("toggle-terminal").click();
  await page
    .getByTestId(stage === "before" ? "toast" : "terminal-event-notice")
    .waitFor();
  await snapshot(page, `issues/notices-app-wide/evidence/${stage}-terminal`);
  await page.route("**/assets/BrowserDocument-*.js", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.getByTestId("toggle-editor").click();
  await page.getByTestId("connection-version-changed").waitFor();
  await snapshot(page, `issues/notices-app-wide/evidence/${stage}-connection`);
  await page.unroute("**/assets/BrowserDocument-*.js");
  await page.goto(conversationURL);
  await page.route("**/api/v1/workspaces", async (route) => {
    if (route.request().postDataJSON()?.action !== "conversation_archive")
      return route.continue();
    return route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "control_uncertain" } }),
    });
  });
  const id = new URL(conversationURL).searchParams.get("conversation");
  const row = page.getByRole("navigation").getByTestId(`agent-item-${id}`);
  await row.hover();
  await row.getByTestId("rail-archive-conversation").click();
  await page.getByTestId("archive-error").waitFor();
  await snapshot(page, `issues/notices-app-wide/evidence/${stage}-archive`);
  await page.goto(
    `${origin}${workspace}?conversation=pi%3A11111111-1111-4111-8111-111111111111`,
  );
  await page
    .locator(stage === "before" ? ".ah-notice" : ".ah-warning")
    .first()
    .waitFor();
  await snapshot(page, `issues/notices-app-wide/evidence/${stage}-page`);
} finally {
  await browser.close();
}
