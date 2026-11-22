import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Turn snapshots through the real gateway and daemon (scenario pi-snapshots,
// test/browser-host/snapshots.go): a turn changes a Git workspace only
// through shell commands, a Python script, sed -i and rm, while the
// recorder's own module records real snapshots. Muutokset lists the three
// files from them and Palaa tähän restores them on disk. The recorder and
// the rewind extension themselves run against the pinned Pi in the daemon's
// native test.
test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
  deviceScaleFactor: 2,
});

const workspace = "tilastoharjoitus";
const original = "synteettinen sisältö\n";

test("@lab a script's changes are listed from the turn's snapshots and Palaa tähän restores them", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const file = async (path: string) => {
    const response = await page.request.get(
      `/fixture/workspace-file?workspace=${workspace}&path=${encodeURIComponent(path)}`,
    );
    return response.status() === 200 ? response.text() : undefined;
  };
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
  expect(
    (await page.request.get("/fixture/scenario?value=pi-snapshots")).status(),
  ).toBe(204);
  try {
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    const session = await (await page.request.get("/auth/session")).json();
    expect(
      (
        await page.request.put("/api/v1/account/preferences", {
          headers: {
            Origin: new URL(page.url()).origin,
            "X-Agent-Host-CSRF": session.csrf,
          },
          data: { experimental: { "rewind-conversation": true } },
        })
      ).ok(),
    ).toBe(true);
    await page.reload();
    await page
      .getByRole("navigation")
      .getByTestId(`workspace-${workspace}`)
      .click();
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    const text = "Aja skripti tilastoille";
    await page.getByTestId("message-input").fill(text);
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await expect(page.getByText(`Selvä. Kysyit: "${text}".`).last()).toBeVisible(
      { timeout: 20000 },
    );
    // The commands ran in the workspace.
    expect(await file("data.csv")).toBe(`${original}4,2\n`);
    expect(await file("analyysi.py")).toBe("synteettinen analyysi\n");
    expect(await file("vanha-raportti.txt")).toBeUndefined();

    // Muutokset lists all three, each changed by a command.
    const card = page.getByTestId("turn-changes").last();
    await card.getByTestId("turn-changes-toggle").click();
    const rows = card.locator("li[data-path]");
    await expect(rows).toHaveCount(3, { timeout: 10000 });
    for (const path of ["data.csv", "analyysi.py", "vanha-raportti.txt"])
      await expect(
        card
          .locator(`li[data-path="${path}"]`)
          .locator('[data-tag="command"]'),
      ).toHaveCount(1);
    await expect(
      card
        .locator('li[data-path="vanha-raportti.txt"]')
        .locator('[data-tag="deleted"]'),
    ).toHaveCount(1);
    // A file's diff comes from the snapshots: one line removed, one added.
    const row = card.locator('li[data-path="analyysi.py"]');
    await row.getByTestId("turn-changes-file").click();
    const diff = row.getByTestId("turn-changes-diff");
    await expect(diff.getByTestId("diff-addition-label")).toHaveCount(1);
    await expect(diff.getByTestId("diff-deletion-label")).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath("changes.png") });

    // Palaa tähän before the message, with the files.
    const message = page.getByTestId("message").filter({ hasText: text });
    await message.getByTestId(/^message-menu-/).click();
    await page.getByRole("menuitem", { name: /Palaa tähän/ }).click();
    const sheet = page.getByTestId("rewind-sheet");
    await expect(sheet).toBeVisible();
    await page.getByTestId("rewind-files-toggle").click();
    const list = page.getByTestId("rewind-file-list");
    for (const path of ["data.csv", "analyysi.py", "vanha-raportti.txt"])
      await expect(list).toContainText(path);
    await page.screenshot({ path: testInfo.outputPath("sheet.png") });
    await page.getByTestId("rewind-go").click();
    await expect(sheet).toHaveCount(0, { timeout: 20000 });
    await expect(page.getByTestId("rewind-branch")).toBeVisible({
      timeout: 20000,
    });
    expect(await file("data.csv")).toBe(original);
    expect(await file("analyysi.py")).toBe(original);
    expect(await file("vanha-raportti.txt")).toBe(
      "vanha raportti\npoistetaan\n",
    );
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
});
