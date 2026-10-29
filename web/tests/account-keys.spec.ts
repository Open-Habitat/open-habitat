import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Settings › Avaimet (direction Taulukko) against the real gateway and the
// real daemon handler, whose ssh-keygen writes into the synthetic home.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
});

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeAttached();
}

const keyRow = (page: Page, file: string) =>
  page.locator(`[data-testid="account-key"][data-file="${file}"]`);
const missing = (page: Page, kind: string) =>
  page.locator(`[data-testid="account-key-missing"][data-kind="${kind}"]`);

test("@account-keys a created SSH key shows its public half and the agent's keys are marked until seen", async ({
  page,
}, testInfo) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page);
  await page.goto("/settings/keys");
  await expect(page.getByTestId("account-keys")).toBeVisible();
  await expect(page.getByTestId("account-key")).toHaveCount(0);

  await missing(page, "ssh")
    .getByRole("button")
    .and(page.getByTestId("account-key-create"))
    .click();
  const made = keyRow(page, "~/.ssh/id_ed25519");
  await expect(made).toBeVisible();
  await expect(missing(page, "ssh")).toHaveCount(0);
  // Made here: neither unseen nor offered again.
  await expect(made).not.toHaveAttribute("data-unseen", /.*/);

  await made
    .getByRole("button")
    .and(page.getByTestId("account-key-toggle"))
    .click();
  const line = made.getByTestId("account-key-line");
  await expect(line).toHaveText(/^ssh-ed25519 AAAAC3NzaC1lZDI1NTE5[^ ]+ /);
  await expect(page.locator("body")).not.toContainText("PRIVATE KEY");
  await made
    .getByRole("button")
    .and(page.getByTestId("account-key-copy"))
    .click();
  await expect(made.getByTestId("account-key-copied")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    await line.textContent(),
  );
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-testid=account-keys]")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);

  // The agent makes a key of its own beside the page.
  expect(
    (await page.request.get("/fixture/agent-key?name=deploy_ed25519")).status(),
  ).toBe(204);
  await page.reload();
  const agent = keyRow(page, "~/.ssh/deploy_ed25519");
  await expect(agent).toHaveAttribute("data-unseen", "true");
  await expect(made).not.toHaveAttribute("data-unseen", /.*/);
  await agent
    .getByRole("button")
    .and(page.getByTestId("account-key-seen"))
    .click();
  await expect(agent).not.toHaveAttribute("data-unseen", /.*/);
  await page.reload();
  await expect(agent).toBeVisible();
  await expect(agent).not.toHaveAttribute("data-unseen", /.*/);

  // The agent replaces the default key: same file, a new key, marked again.
  expect(
    (await page.request.get("/fixture/agent-key?name=id_ed25519")).status(),
  ).toBe(204);
  await page.reload();
  await expect(made).toHaveAttribute("data-unseen", "true");
  await expect(missing(page, "ssh")).toHaveCount(0);
  // Review material, not a visual assertion.
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: testInfo.outputPath(
        `evidence/avaimet-uusi-avain-1280-${scheme}.png`,
      ),
    });
  }
});

test("@account-keys an age key is created when the host has age-keygen, and the list fits a phone", async ({
  page,
}, testInfo) => {
  await signIn(page);
  await page.goto("/settings/keys");
  const age = missing(page, "age");
  await expect(age).toBeVisible();
  const create = age
    .getByRole("button")
    .and(page.getByTestId("account-key-create"));
  if ((await create.count()) === 1) {
    await create.click();
    const row = keyRow(page, "~/.config/sops/age/keys.txt");
    await expect(row).toBeVisible();
    await row
      .getByRole("button")
      .and(page.getByTestId("account-key-toggle"))
      .click();
    await expect(row.getByTestId("account-key-line")).toHaveText(
      /^age1[02-9ac-hj-np-z]{58}$/,
    );
    await expect(page.locator("body")).not.toContainText("AGE-SECRET-KEY");
  }
  expect(
    (await page.request.get("/fixture/agent-key?name=id_ed25519")).status(),
  ).toBe(204);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  const row = keyRow(page, "~/.ssh/id_ed25519");
  await row
    .getByRole("button")
    .and(page.getByTestId("account-key-toggle"))
    .click();
  await expect(
    row.getByRole("button").and(page.getByTestId("account-key-copy")),
  ).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath("evidence/avaimet-rivi-auki-puhelin.png"),
    fullPage: true,
  });
  expect(
    await page
      .getByTestId("account-keys")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
});
