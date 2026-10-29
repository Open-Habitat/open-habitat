import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Settings › Omat koneet (direction Ohjattu) against the real gateway and the
// real daemon handler. The person's user manager, tailscaled and machines are
// the browser host's fakes (tailnetfake): nothing joins a tailnet.
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

async function fixture(page: Page, query: string) {
  expect(
    (await page.request.get(`/fixture/own-machines?${query}`)).status(),
  ).toBe(204);
}

const button = (page: Page, id: string) =>
  page.getByRole("button").and(page.getByTestId(id));
const wizard = (page: Page) => page.getByTestId("own-machines-wizard");
const machine = (page: Page, name: string) =>
  page.locator(`[data-testid="own-machine"][data-machine="${name}"]`);

/** Steps 2–4 for one machine, up to an accepted key. */
async function chooseAndAccept(page: Page, peer: string, address: string) {
  await expect(wizard(page)).toHaveAttribute("data-step", "2");
  await page.getByTestId(`own-machines-peer-${peer}`).check();
  await page.getByTestId("own-machines-user").fill("alice");
  await button(page, "own-machines-next").click();
  await expect(wizard(page)).toHaveAttribute("data-step", "3");
  await button(page, "own-machines-next").click();
  await expect(wizard(page)).toHaveAttribute("data-step", "4");
  await expect(page.getByTestId("own-machines-command")).toBeVisible();
  await expect(button(page, "own-machines-next")).toBeDisabled();
  // The machine refuses the key until the line is on it.
  await button(page, "own-machines-check").click();
  await expect(page.getByTestId("own-machines-check-result")).toHaveAttribute(
    "data-result",
    "key_rejected",
  );
  await expect(button(page, "own-machines-next")).toBeDisabled();
  await fixture(page, `do=machine&address=${address}&mode=ok`);
  await button(page, "own-machines-check").click();
  await expect(page.getByTestId("own-machines-check-result")).toHaveAttribute(
    "data-result",
    "ok",
  );
  await button(page, "own-machines-next").click();
  await expect(wizard(page)).toHaveAttribute("data-step", "5");
  await expect(page.getByTestId("own-machines-host-key")).toHaveText(
    /^SHA256:[A-Za-z0-9+/]{43}$/,
  );
}

test("@own-machines join the tailnet, add two machines, renew, remove and leave", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page);
  await page.goto("/settings/machines");
  await expect(page.getByTestId("own-machines-tailscale")).toHaveAttribute(
    "data-state",
    "off",
  );
  await expect(page.getByTestId("own-machine")).toHaveCount(0);

  // 1 Tailscale: the login link is Tailscale's own, and the dialog moves on
  // by itself once the person has approved the node there.
  await button(page, "own-machines-add").click();
  await expect(wizard(page)).toHaveAttribute("data-step", "1");
  await expect(button(page, "own-machines-next")).toBeDisabled();
  await button(page, "own-machines-connect").click();
  const login = page
    .getByRole("link")
    .and(page.getByTestId("own-machines-login-open"));
  await expect(login).toHaveAttribute(
    "href",
    /^https:\/\/login\.tailscale\.com\/a\//,
  );
  await expect(login).toHaveAttribute("target", "_blank");
  await expect(page.getByTestId("device-qr")).toBeVisible();
  await fixture(page, "do=approve");
  await expect(page.getByTestId("own-machines-wizard-joined")).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-testid=own-machines-wizard]")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await button(page, "own-machines-next").click();

  // 2–5 for the Mac: a phone cannot be chosen.
  await expect(
    page.getByTestId("own-machines-peer-alice-phone"),
  ).toBeDisabled();
  await expect(page.getByTestId("own-machines-peer-gaming-pc")).toBeEnabled();
  await chooseAndAccept(page, "alice-macbook", "100.88.14.53");
  await expect(wizard(page).getByTestId("own-machine-truths")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("evidence/omat-koneet-vahvistus-1280-light.png"),
  });
  await button(page, "own-machines-save").click();
  await expect(wizard(page)).toHaveCount(0);
  await expect(machine(page, "alice-macbook")).toHaveAttribute(
    "data-state",
    "active",
  );

  // Another machine afterwards. A fingerprint the person says differs saves
  // nothing.
  await button(page, "own-machines-add").click();
  await expect(
    page.getByTestId("own-machines-peer-alice-macbook"),
  ).toBeDisabled();
  await chooseAndAccept(page, "workstation", "100.71.203.9");
  await button(page, "own-machines-mismatch-button").click();
  await expect(page.getByTestId("own-machines-mismatch")).toBeVisible();
  await expect(button(page, "own-machines-save")).toHaveCount(0);
  await button(page, "own-machines-wizard-close").click();
  await expect(page.getByTestId("own-machine")).toHaveCount(1);
  // The person takes the line off and starts again.
  await fixture(page, "do=machine&address=100.71.203.9&mode=rejected");
  await button(page, "own-machines-add").click();
  await chooseAndAccept(page, "workstation", "100.71.203.9");
  await button(page, "own-machines-save").click();
  await expect(page.getByTestId("own-machine")).toHaveCount(2);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.waitForTimeout(300);
    await page.screenshot({
      path: testInfo.outputPath(
        `evidence/omat-koneet-kaksi-1280-${scheme}.png`,
      ),
      fullPage: true,
    });
  }
  await page.emulateMedia({ colorScheme: "light" });

  // The line is taken away on the Mac: a check says so, and renewal opens
  // at the key line without comparing the host key again.
  await fixture(page, "do=machine&address=100.88.14.53&mode=rejected");
  const mac = machine(page, "alice-macbook");
  await mac
    .getByRole("button")
    .and(page.getByTestId("own-machine-check"))
    .click();
  await expect(mac).toHaveAttribute("data-state", "revoked");
  await mac
    .getByRole("button")
    .and(page.getByTestId("own-machine-renew"))
    .click();
  await expect(wizard(page)).toHaveAttribute("data-step", "4");
  await expect(page.getByTestId("own-machines-command")).toBeVisible();
  await fixture(page, "do=machine&address=100.88.14.53&mode=ok");
  await button(page, "own-machines-check").click();
  await expect(page.getByTestId("own-machines-check-result")).toHaveAttribute(
    "data-result",
    "ok",
  );
  await expect(wizard(page).getByTestId("own-machine-truths")).toBeVisible();
  await button(page, "own-machines-save").click();
  await expect(wizard(page)).toHaveCount(0);
  await expect(mac).toHaveAttribute("data-state", "active");

  // Another host key at the Mac's address is never taken for the Mac.
  await fixture(page, "do=hostkey&address=100.88.14.53&seed=B");
  await mac
    .getByRole("button")
    .and(page.getByTestId("own-machine-check"))
    .click();
  await expect(mac).toHaveAttribute("data-state", "changed");
  await expect(
    mac.getByRole("button").and(page.getByTestId("own-machine-renew")),
  ).toBeDisabled();

  // Removing one says the line is still on the machine.
  const ws = machine(page, "workstation");
  await ws
    .getByRole("button")
    .and(page.getByTestId("own-machine-remove"))
    .click();
  await button(page, "own-machine-remove-yes").click();
  await expect(page.getByTestId("own-machine")).toHaveCount(1);
  await expect(page.getByTestId("own-machine-removed")).toBeVisible();

  // Leaving the tailnet removes every machine.
  await button(page, "own-machines-disconnect").click();
  await button(page, "own-machines-disconnect-yes").click();
  await expect(page.getByTestId("own-machines-tailscale")).toHaveAttribute(
    "data-state",
    "off",
  );
  await expect(page.getByTestId("own-machine")).toHaveCount(0);
});

test("@own-machines the page and the dialog fit a phone", async ({
  page,
}, testInfo) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings/machines");
  await button(page, "own-machines-add").click();
  await button(page, "own-machines-connect").click();
  await expect(
    page.getByRole("link").and(page.getByTestId("own-machines-login-open")),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("evidence/omat-koneet-kirjautuminen-puhelin.png"),
  });
  await fixture(page, "do=approve");
  await button(page, "own-machines-next").click();
  await chooseAndAccept(page, "alice-macbook", "100.88.14.53");
  await button(page, "own-machines-save").click();
  await expect(machine(page, "alice-macbook")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("evidence/omat-koneet-puhelin.png"),
    fullPage: true,
  });
  expect(
    await page
      .getByTestId("own-machines")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
});

test("@own-machines a Windows machine gets PowerShell, with the administrators' file as its own choice", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/machines");
  await button(page, "own-machines-add").click();
  await button(page, "own-machines-connect").click();
  await expect(
    page.getByRole("link").and(page.getByTestId("own-machines-login-open")),
  ).toBeVisible();
  await fixture(page, "do=approve");
  await expect(page.getByTestId("own-machines-wizard-joined")).toBeVisible();
  await button(page, "own-machines-next").click();
  await page.getByTestId("own-machines-peer-gaming-pc").check();
  await page.getByTestId("own-machines-user").fill("alice");
  await button(page, "own-machines-next").click();
  await button(page, "own-machines-next").click();
  await expect(wizard(page)).toHaveAttribute("data-step", "4");
  // The command is the daemon's: the administrator's by default, the
  // user's own file when the person says they are not one.
  const command = page.getByTestId("own-machines-command").locator("code");
  await expect(command).toContainText("administrators_authorized_keys");
  const choice = page.getByTestId("own-machines-windows-admin");
  await choice.getByTestId("segment-user").click();
  await expect(command).not.toContainText("administrators_authorized_keys");
  await expect(command).toContainText("Join-Path $HOME .ssh");
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-testid=own-machines-wizard]")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("@own-machines a command run on the person's machine names it, and the header shows the open connection", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  // Pi streams its tool calls, as the real one does.
  await page.request.get("/fixture/scenario?value=pi-deltas");
  await signIn(page);
  await page.goto("/settings/machines");
  await button(page, "own-machines-add").click();
  await button(page, "own-machines-connect").click();
  await expect(
    page.getByRole("link").and(page.getByTestId("own-machines-login-open")),
  ).toBeVisible();
  await fixture(page, "do=approve");
  await expect(page.getByTestId("own-machines-wizard-joined")).toBeVisible();
  await button(page, "own-machines-next").click();
  await chooseAndAccept(page, "alice-macbook", "100.88.14.53");
  await button(page, "own-machines-save").click();
  await expect(machine(page, "alice-macbook")).toBeVisible();
  // The agent's command leaves its SSH connection open (ControlMaster).
  await fixture(page, "do=open&name=alice-macbook");

  await page.goto("/workspaces");
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page
    .getByTestId("message-input")
    .fill("Katso macOS:n versio omalla koneellani");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  // While the agent works, before any row is unfolded.
  const open = page.locator(".ah-agent-header").getByTestId("machine-open");
  await expect(open).toContainText("alice-macbook", { timeout: 30_000 });
  const turn = page.getByTestId("agent-turn").first();
  const stages = turn.getByTestId("history-stage-toggle");
  await expect(stages).toBeVisible({ timeout: 30_000 });
  if ((await stages.getAttribute("aria-expanded")) !== "true")
    await stages.click();
  const row = turn
    .getByTestId("tool-row")
    .and(page.locator('[data-tool-name="bash"]'));
  await expect(row.getByTestId("tool-machine")).toHaveAttribute(
    "data-machine",
    "alice-macbook",
  );
  await expect(open).toContainText("alice-macbook");
  await page.screenshot({
    path: testInfo.outputPath("evidence/oma-kone-keskustelussa-1280.png"),
  });

  // Once the connection closes the header says nothing; the row still
  // names where the command ran.
  await fixture(page, "do=close&name=alice-macbook");
  await page.reload();
  await expect(page.getByTestId("agent-turn").first()).toBeVisible();
  const again = page.getByTestId("agent-turn").first();
  const stagesAgain = again.getByTestId("history-stage-toggle");
  if ((await stagesAgain.getAttribute("aria-expanded")) !== "true")
    await stagesAgain.click();
  await expect(
    again
      .getByTestId("tool-row")
      .and(page.locator('[data-tool-name="bash"]'))
      .getByTestId("tool-machine"),
  ).toHaveAttribute("data-machine", "alice-macbook");
  await expect(open).toHaveCount(0);
});
