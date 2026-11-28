import { mkdir, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Scheduled wake: the agent's wake (here created by the
// fixture as the conversation's Pi would run agent wake create --current
// during its turn, followed by section update --section quiet for a turn that
// only waits) shows the wake time at the row's end in Hiljaiset, the bar lets the person move or cancel it, and archiving
// asks first in the archive window, whose notice's undo brings the wake back.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

const row = (page: Page, section: string, id: string) =>
  page.getByTestId(section).getByTestId(`agent-item-${id}`);

async function start(page: Page): Promise<string> {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto(`${hostOrigin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const session = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": session.csrf,
        },
        data: { experimental: { "scheduled-wake": false } },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  return new URL(page.url()).searchParams.get("conversation") ?? "";
}

/** The agent sets a wake during its running turn and, since the turn only
 * waits for it, places the conversation in Hiljaiset: the wake alone does
 * not move it. */
async function wake(page: Page, id: string, at: Date, note: string) {
  await expect
    .poll(
      async () =>
        (
          await page.request.get(
            `/fixture/wake?id=${encodeURIComponent(id)}&at=${encodeURIComponent(at.toISOString().replace(/\.\d+Z$/, "Z"))}&note=${encodeURIComponent(note)}`,
          )
        ).status(),
      { timeout: 15000 },
    )
    .toBe(204);
  expect(
    (
      await page.request.get(
        `/fixture/agent-section?id=${encodeURIComponent(id)}&section=quiet`,
      )
    ).status(),
  ).toBe(204);
}

const inDays = (days: number, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

test("@scheduled-wake the waiting row shows its wake time and the bar moves and cancels it", async ({
  page,
}) => {
  test.setTimeout(120000);
  const id = await start(page);
  await page.getByTestId("message-input").fill("hidas muistuta torstaina");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("composer-stop")).toBeVisible();
  const first = inDays(2);
  await wake(page, id, first, "Muistuta poistamaan backup-2024");
  await expect(page.getByTestId("composer-stop")).toHaveCount(0, {
    timeout: 60000,
  });
  // The reply waits in Hiljaiset, and the row's end says when it wakes.
  const quiet = row(page, "rail-quiet", id);
  await expect(quiet).toBeVisible({ timeout: 30000 });
  await expect(row(page, "rail-yours", id)).toHaveCount(0);
  const time = quiet.getByTestId("rail-wake-time");
  await expect(time).toHaveAttribute("datetime", first.toISOString());
  const bar = page.getByTestId("wake-bar");
  await expect(bar).toBeVisible();
  // The agent's note is its own content, shown unchanged.
  await expect(bar.getByTestId("wake-bar-note")).toHaveText(
    "Muistuta poistamaan backup-2024",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="wake-bar"]')
        .analyze()
    ).violations,
  ).toEqual([]);

  // Notices, turns and the composer share one column even when the frame
  // is wider than its maximum measure, or narrowed to a phone.
  for (const width of [1280, 1440, 1920, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () => {
        const notice = await bar.boundingBox();
        const composer = await page.locator(".ah-cbox").boundingBox();
        const turn = await page.getByTestId("agent-turn").last().boundingBox();
        if (!notice || !composer || !turn) return Number.POSITIVE_INFINITY;
        return Math.max(
          ...[composer, turn].flatMap((column) => [
            Math.abs(notice.x - column.x),
            Math.abs(notice.x + notice.width - column.x - column.width),
          ]),
        );
      })
      .toBeLessThanOrEqual(1);
    if (process.env.OH_WAKE_CAPTURE) {
      const directory = process.env.OH_WAKE_CAPTURE;
      await mkdir(directory, { recursive: true });
      await page.screenshot({ path: `${directory}/wake-${width}.png` });
      await writeFile(`${directory}/wake-${width}.html`, await page.content());
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  // Muuta aikaa…: the person moves it a day on.
  const moved = inDays(3, 10);
  await bar.getByTestId("wake-change").click();
  const pad = (n: number) => String(n).padStart(2, "0");
  await bar
    .getByTestId("wake-input")
    .fill(
      `${moved.getFullYear()}-${pad(moved.getMonth() + 1)}-${pad(moved.getDate())}T10:00`,
    );
  await bar.getByTestId("wake-save").click();
  await expect(time).toHaveAttribute("datetime", moved.toISOString());

  // A reload reads the same from the person's daemon.
  await page.reload();
  await expect(
    row(page, "rail-quiet", id).getByTestId("rail-wake-time"),
  ).toHaveAttribute("datetime", moved.toISOString(), { timeout: 15000 });

  // Peru herätys: the bar and the time go; the row stays in Hiljaiset.
  await page.getByTestId("wake-bar").getByTestId("wake-cancel").click();
  await expect(page.getByTestId("wake-bar")).toHaveCount(0);
  await expect(
    row(page, "rail-quiet", id).getByTestId("rail-wake-time"),
  ).toHaveCount(0);
  await expect(row(page, "rail-quiet", id)).toBeVisible();
});

test("@scheduled-wake archiving asks in the window with focus on archive, and the notice's undo restores the wake", async ({
  page,
}) => {
  test.setTimeout(120000);
  const id = await start(page);
  await page.getByTestId("message-input").fill("hidas muistuta myöhemmin");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("composer-stop")).toBeVisible();
  const at = inDays(5);
  await wake(page, id, at, "Tarkista vuokrasopimus");
  await expect(page.getByTestId("composer-stop")).toHaveCount(0, {
    timeout: 60000,
  });
  const quiet = row(page, "rail-quiet", id);
  await expect(quiet.getByTestId("rail-wake-time")).toBeVisible({
    timeout: 30000,
  });
  let writes = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/v1/workspaces") &&
      request.postDataJSON()?.action === "conversation_archive"
    )
      writes++;
  });
  const archive = quiet.getByTestId("rail-archive-conversation");
  await quiet.hover();
  await expect(archive).toBeEnabled({ timeout: 25000 });
  await archive.click();
  const confirm = page.getByTestId("helper-archive-confirm");
  await expect(confirm.getByTestId("wake-archive-row")).toHaveCount(1);
  await expect(confirm.getByTestId("helper-archive-accept")).toBeFocused();
  expect(writes).toBe(0);
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
  ).toEqual([]);
  // Esc keeps the conversation and its wake.
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  expect(writes).toBe(0);
  // Focus is back on the row's archive button, which stands in the time's
  // place while the row holds focus; the wake itself stays.
  await expect(archive).toBeFocused();
  await expect(quiet.getByTestId("rail-wake-time")).toHaveCount(1);

  // Enter archives: the window starts on the archive action.
  await quiet.hover();
  await archive.click();
  await expect(confirm.getByTestId("helper-archive-accept")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("navigation").getByTestId(`agent-item-${id}`),
  ).toHaveCount(0);
  expect(writes).toBe(1);
  await expect(page.getByTestId("archive-notice-detail")).toHaveCount(1);

  // The notice's Palauta brings back the conversation and its wake; the
  // archive cleared the agent's quiet choice, so the row may stand in any
  // section, still showing its wake time.
  await page.getByTestId("restore-notice").click();
  await expect(
    page
      .getByRole("navigation")
      .getByTestId(`agent-item-${id}`)
      .getByTestId("rail-wake-time"),
  ).toHaveAttribute("datetime", at.toISOString(), { timeout: 15000 });
  expect(writes).toBe(2);
});

test("@scheduled-wake a fired wake is Habitat's line in the conversation, not a clock on the row", async ({
  page,
}) => {
  // The native session holds a wake that fired and the reply it started.
  expect(
    (await page.request.get("/fixture/history?mode=wake-fired")).status(),
  ).toBe(204);
  const nativeId = "pi:11111111-1111-4111-8111-111111111111";
  await page.goto(`${hostOrigin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.goto(`/agents/${nativeId}`);
  const line = page.getByTestId("wake-line");
  // The line stands at the turn the wake started: after the reply that set
  // it, before the woken reply, and says in words that Habitat woke the
  // agent, when, and the agent's note.
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(line).toBeVisible({ timeout: 15000 });
    await expect(line).toHaveAttribute("data-kind", "fired");
    await expect(line).toContainText(/Open Habitat herätti agentin .*klo/);
    await expect(line).toContainText("Tarkista, valmistuiko ajo");
  }
  const order = await page
    .locator('[data-testid="wake-line"], [data-testid="agent-turn"]')
    .evaluateAll((nodes) =>
      nodes.map((n) =>
        n.getAttribute("data-testid") === "wake-line"
          ? "wake"
          : (n.textContent ?? "").includes("Ajo valmistui")
            ? "woken"
            : (n.textContent ?? "").includes("Asetin herätyksen")
              ? "set"
              : "other",
      ),
    );
  expect(order.filter((o) => o !== "other")).toEqual(["set", "wake", "woken"]);
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="wake-line"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  // The fired wake leaves the rail row's time slot to the row's age.
  await page.setViewportSize({ width: 1280, height: 900 });
  const item = page
    .getByRole("navigation")
    .getByTestId(`agent-item-${nativeId}`);
  await expect(item).toBeVisible({ timeout: 15000 });
  await expect(item.getByTestId("rail-wake-time")).toHaveCount(0);
});
