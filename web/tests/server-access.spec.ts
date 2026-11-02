import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

// The synthetic broker: Alice (42) is site.json's administrator, Bob (43) a
// runtime entry who has joined, Carol (44) a GitHub account with no
// admission. /fixture/access delays broker writes so the wait shows.

async function signIn(page: Page, who: 0 | 1) {
  await page.goto("/settings");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(who).click();
  await expect(page).not.toHaveURL(/fixture\/provider/);
}

test("@server-access an administrator adds, removes and restores a person; removal ends their session", async ({
  page,
  browser,
}) => {
  const bobContext = await browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
  });
  const bob = await bobContext.newPage();
  await signIn(bob, 1);
  expect((await bob.request.get("/api/v1/server")).status()).toBe(200);

  await signIn(page, 0);
  await page.goto("/settings/users");
  const row = (id: string) => page.getByTestId(`access-row-${id}`);
  await expect(row("43")).toHaveAttribute("data-state", "joined");
  // Root's administrator has no remove action and no role control here.
  await expect(row("42").getByRole("button")).toHaveCount(0);
  // The broker keeps no login for root's entry; the gateway names it from
  // GitHub, so the label is the login and not the numeric id.
  await expect(page.getByTestId("access-login-42")).toContainText("alice");
  await expect(page.getByTestId("access-login-42")).not.toHaveAttribute(
    "data-unnamed",
  );
  await expect(page.getByTestId("account-role-toggle")).toHaveCount(0);

  expect((await page.request.get("/fixture/access?delay=600")).status()).toBe(
    204,
  );

  // Add several at once: each login is checked on GitHub on its own, and
  // only Carol, a person with no admission yet, goes to the broker by
  // numeric id.
  await page
    .getByTestId("access-login-input")
    .fill("@Carol, bob\nexample-org nobody-here");
  await page.getByRole("button").and(page.getByTestId("access-add")).click();
  const item = (login: string) =>
    page.locator(`[data-testid=access-batch-item][data-login="${login}"]`);
  await expect(item("Carol")).toHaveAttribute("data-kind", "found");
  await expect(item("bob")).toHaveAttribute("data-kind", "duplicate");
  await expect(item("example-org")).toHaveAttribute("data-kind", "problem");
  await expect(item("example-org")).toContainText("henkilön GitHub-tili");
  await expect(item("nobody-here")).toHaveAttribute("data-kind", "problem");
  await expect(page.getByTestId("access-add")).toHaveText("Salli 1");
  await page.getByRole("button").and(page.getByTestId("access-add")).click();
  await expect(row("44")).toHaveAttribute("data-pending", "add");
  await expect(row("44")).not.toHaveAttribute("data-pending", /./);
  await expect(row("44")).toHaveAttribute("data-state", "allowed");
  await expect(item("Carol")).toHaveAttribute("data-kind", "added");

  // A duplicate is reported under the field.
  await page.getByTestId("access-login-input").fill("bob");
  await page.getByRole("button").and(page.getByTestId("access-add")).click();
  await expect(page.getByTestId("access-check")).toHaveAttribute(
    "data-kind",
    "duplicate",
  );

  // Remove Bob: the row waits, then stays as withdrawn, and his browser
  // session is gone.
  await page
    .getByRole("button")
    .and(page.getByTestId("access-remove-43"))
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button")
    .and(page.getByTestId("access-remove-confirm"))
    .click();
  await expect(row("43")).toHaveAttribute("data-pending", "remove");
  await expect(row("43")).toHaveAttribute("data-state", "withdrawn");
  await expect(row("43")).not.toHaveAttribute("data-pending", /./);
  expect((await bob.request.get("/api/v1/server")).status()).toBe(401);

  // Restore Bob: he signs in to the same account again.
  await page
    .getByRole("button")
    .and(page.getByTestId("access-restore-43"))
    .click();
  await expect(row("43")).toHaveAttribute("data-pending", "restore");
  await expect(row("43")).toHaveAttribute("data-state", "joined");
  await signIn(bob, 1);
  expect((await bob.request.get("/api/v1/server")).status()).toBe(200);

  // The list after a reload agrees with what the replies showed.
  await page.reload();
  await expect(row("43")).toHaveAttribute("data-state", "joined");
  await expect(row("44")).toHaveAttribute("data-state", "allowed");
  await bobContext.close();
});

test("@server-access @a11y a lost broker reply leaves the row uncertain until refreshed; open mode locks the list", async ({
  page,
}) => {
  await signIn(page, 0);
  await page.goto("/settings/users");
  const row = page.getByTestId("access-row-43");
  await expect(row).toHaveAttribute("data-state", "joined");
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-testid=server-access]")
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(row).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  expect((await page.request.get("/fixture/access?lose=1")).status()).toBe(204);
  await page
    .getByRole("button")
    .and(page.getByTestId("access-remove-43"))
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button")
    .and(page.getByTestId("access-remove-confirm"))
    .click();
  await expect(row).toHaveAttribute("data-pending", "uncertain");
  await page
    .getByRole("button")
    .and(page.getByTestId("access-refresh-43"))
    .click();
  // The broker committed it; the reply was only lost.
  await expect(row).toHaveAttribute("data-state", "withdrawn");
  await expect(row).not.toHaveAttribute("data-pending", /./);

  expect((await page.request.get("/fixture/access?mode=any")).status()).toBe(
    204,
  );
  await page.reload();
  await expect(page.getByTestId("access-open")).toBeVisible();
  await expect(page.getByTestId("access-login-input")).toHaveCount(0);
  await expect(page.getByTestId("access-restore-43")).toBeDisabled();
});

test("@server-access an administrator names a person before their first sign-in; the role binds then and is revocable", async ({
  page,
  browser,
}) => {
  // Bob is admitted but has never signed in: no binding exists yet.
  expect((await page.request.get("/fixture/access?unbound=43")).status()).toBe(
    204,
  );
  await signIn(page, 0);
  await page.goto("/settings/users");
  const row = page.getByTestId("access-row-43");
  const role = page.getByRole("button").and(page.getByTestId("access-role-43"));
  const name = async () => {
    await role.click();
    await page
      .getByRole("dialog")
      .getByRole("button")
      .and(page.getByTestId("access-grant-confirm"))
      .click();
  };
  await expect(row).toHaveAttribute("data-state", "allowed");
  await name();
  await expect(row).toHaveAttribute("data-admin", "pending");
  await page.reload();
  await expect(row).toHaveAttribute("data-admin", "pending");
  // Revocable while it waits.
  await role.click();
  await expect(row).not.toHaveAttribute("data-admin", /./);
  await page.reload();
  await expect(row).not.toHaveAttribute("data-admin", /./);
  await name();
  await expect(row).toHaveAttribute("data-admin", "pending");

  // Bob's first sign-in creates his binding and he is administrator from
  // its first request.
  const bobContext = await browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
  });
  const bob = await bobContext.newPage();
  await signIn(bob, 1);
  const server = async () =>
    (await (await bob.request.get("/api/v1/server")).json()).administrator;
  expect(await server()).toBe(true);
  expect(
    (await bob.request.get("/api/v1/server/administration")).status(),
  ).toBe(200);
  await page.reload();
  await expect(row).toHaveAttribute("data-state", "joined");
  await expect(row).toHaveAttribute("data-admin", "granted");

  // Revoking a granted designation ends the role at once.
  await role.click();
  await expect(row).not.toHaveAttribute("data-admin", /./);
  expect(await server()).toBe(false);
  expect(
    (await bob.request.get("/api/v1/server/administration")).status(),
  ).toBe(403);
  await bobContext.close();
});

test("@server-access @a11y a team is added in the same field, rows show their reasons, and a leaver is raised as a notice", async ({
  page,
}) => {
  expect((await page.request.get("/fixture/access?leaver=44")).status()).toBe(
    204,
  );
  await signIn(page, 0);
  await page.goto("/settings/users");
  // Carol's latest sign-in found her gone from the team: a notice above the
  // list, and her row's chip says so; Bob's says he is allowed one by one.
  const notice = page.getByTestId("access-leaver-44");
  await expect(notice).toContainText("@carol");
  await expect(notice).toContainText("example-org/habitat");
  await expect(page.getByTestId("access-reasons-43")).toContainText(
    "henkilönä",
  );
  await expect(page.getByTestId("access-reasons-44")).toContainText(
    "example-org/habitat – lähti",
  );
  await expect(page.getByTestId("access-row-44")).toHaveAttribute(
    "data-state",
    "withdrawn",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-testid=server-access]")
        .analyze()
    ).violations,
  ).toEqual([]);

  // A team goes in the same field: checked first, then added on its own.
  await page.getByTestId("access-login-input").fill("example-org/Ops");
  await page.getByRole("button").and(page.getByTestId("access-add")).click();
  await expect(page.getByTestId("access-team-found")).toContainText(
    "example-org/ops",
  );
  await expect(page.getByTestId("access-add")).toHaveText("Lisää tiimi");
  await page.getByRole("button").and(page.getByTestId("access-add")).click();
  const ops = page.getByTestId("access-team-61230001-ops");
  await expect(ops).toContainText("Kukaan tiimin jäsen ei ole vielä");
  await expect(page.getByTestId("access-login-input")).toHaveValue("");

  // Dismissing the notice forgets the leaver; the account is not touched.
  await page
    .getByRole("button")
    .and(page.getByTestId("access-leaver-dismiss-44"))
    .click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByTestId("access-row-44")).toHaveCount(0);

  // Detaching asks first and says what ends.
  await page
    .getByRole("button")
    .and(page.getByTestId("access-detach-61230001-ops"))
    .click();
  await expect(page.getByTestId("access-detach-dialog")).toContainText(
    "seuraavalla kirjautumisellaan",
  );
  await page
    .getByRole("dialog")
    .getByRole("button")
    .and(page.getByTestId("access-detach-confirm"))
    .click();
  await expect(ops).toHaveCount(0);
});
