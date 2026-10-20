import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Interim replies as stages (Vaiheet without the turn head, Jari 19.10.2026)
// against the host-backed synthetic lab: invented history and a fake Pi.
test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
}

async function openStagedHistory(page: Page) {
  await signIn(page);
  await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "Miksi CI epäonnistuu macOS:llä?" })
    .first()
    .click();
  const sync = page
    .getByRole("region", { name: "Agentin vuoro" })
    .filter({ hasText: "Fleetrepo on ajan tasalla" });
  const backup = page
    .getByRole("region", { name: "Agentin vuoro" })
    .filter({ hasText: "Gitean varmuuskopio on kunnossa." });
  await expect(backup).toBeVisible({ timeout: 20000 });
  return { sync, backup };
}

test("@lab history turn reads as stages: summary rows, interim cards, final answer", async ({
  page,
}) => {
  const { sync, backup } = await openStagedHistory(page);
  // No turn head: the stage rows replace it, and the model is only on the answer.
  await expect(page.locator(".ah-turn-head")).toHaveCount(0);
  await expect(sync.getByText(/^PI/)).toHaveCount(0);
  const rows = sync.locator(".ah-turn-stage > button");
  await expect(rows).toHaveText([
    "1 ajatus · 2 työkalua · git rev-list --count origin/main..HEAD",
    "1 ajatus · 2 työkalua · fleetrepo fleet doctor",
    "1 työkalu · ping -c 2 -W 2 rowan.local",
  ]);
  await expect(sync.getByText("Välivastaus", { exact: true })).toHaveCount(2);
  await expect(sync.getByText("Vastaus valmis", { exact: true })).toHaveCount(
    1,
  );
  await expect(sync.getByText("claude-opus-5-5", { exact: true })).toHaveCount(
    1,
  );
  // Each row precedes the reply that closes its stage.
  await expect(sync).toContainText(
    /git rev-list.*Working tree on puhdas.*fleetrepo fleet doctor.*Pull meni läpi.*ping -c 2.*Fleetrepo on ajan tasalla/s,
  );

  // A row opens only its own stage, and it is a real disclosure button.
  const doctor = sync.getByRole("button", {
    name: "1 ajatus · 2 työkalua · fleetrepo fleet doctor",
  });
  await expect(doctor).toHaveAttribute("aria-expanded", "false");
  await doctor.focus();
  await page.keyboard.press("Enter");
  await expect(doctor).toHaveAttribute("aria-expanded", "true");
  await expect(
    sync.getByRole("button", { name: /^bash\s*fleetrepo fleet doctor/ }),
  ).toBeVisible();
  await expect(
    sync.getByText("Running the fleet doctor across machines"),
  ).toBeVisible();
  await expect(
    sync.getByRole("button", { name: /^bash\s*git pull/ }),
  ).toBeVisible();
  await expect(
    sync.getByRole("button", { name: /^bash\s*git status/ }),
  ).toHaveCount(0);
  await expect(sync.getByRole("button", { name: /^bash\s*ping/ })).toHaveCount(
    0,
  );
  await page.keyboard.press("Space");
  await expect(doctor).toHaveAttribute("aria-expanded", "false");
  await expect(
    sync.getByRole("button", { name: /^bash\s*fleetrepo fleet doctor/ }),
  ).toHaveCount(0);

  // A long interim reply is shown in full; the one right before the answer
  // has no stage row of its own because no work came between them.
  await expect(
    backup.getByText("en poista lukkoa enkä muuta mitään.", { exact: false }),
  ).toBeVisible();
  await expect(backup.locator(".ah-turn-stage > button")).toHaveCount(2);
  const last = backup.locator(".ah-turn-reply").filter({
    hasText: "Eheystarkistus ei löytänyt virheitä",
  });
  await expect(last.locator("header")).toHaveText("Välivastaus");
  const following = await last.evaluate(
    (node) => node.nextElementSibling?.textContent ?? "",
  );
  expect(following).toContain("Vastaus valmis");
  expect(
    (
      await new AxeBuilder({ page })
        .include(".ah-agent-turn")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("@lab stage turns fit a phone in light and dark", async ({ page }) => {
  const { sync } = await openStagedHistory(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (value) => document.documentElement.setAttribute("data-theme", value),
      theme,
    );
    const overflow = await page.evaluate(() => {
      const stream = document.querySelector(".ah-conversation-stream");
      return stream ? stream.scrollWidth - stream.clientWidth : 0;
    });
    expect(overflow).toBeLessThanOrEqual(0);
    const row = sync.locator(".ah-turn-stage > button").first();
    const box = await row.boundingBox();
    expect(box && box.x + box.width).toBeLessThanOrEqual(390);
    // The long command is clipped within the row, not wrapped or overflowing.
    await expect(row.locator(".ah-stage-target")).toHaveCSS(
      "text-overflow",
      "ellipsis",
    );
    const colors = await sync
      .locator(".ah-message-interim header strong")
      .first()
      .evaluate((node) => getComputedStyle(node).color);
    expect(colors).not.toBe("rgba(0, 0, 0, 0)");
  }
});

test("@lab live turn shows its interim reply once and runs the next stage in place", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.request.get("/fixture/conversations-reset");
  expect(
    (await page.request.get("/fixture/scenario?value=pi-visual-hold")).status(),
  ).toBe(204);
  try {
    await signIn(page);
    await page
      .getByRole("navigation", { name: "Työtilat ja keskustelut" })
      .getByRole("link", { name: "aurinkokello", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Aloita uusi agenttikeskustelu" })
      .click();
    await page
      .getByRole("textbox", { name: "Viesti agentille" })
      .fill("vaiheet");
    await page.getByRole("button", { name: "Lähetä", exact: true }).click();
    // Fake Pi holds at its tool: the interim reply is saved, the tool runs.
    const turn = page.getByRole("region", { name: "Agentin vuoro" }).last();
    const interim = turn
      .locator(".ah-turn-reply")
      .filter({ hasText: "Katson ensin, mitä työtilassa on." });
    await expect(interim.locator("header")).toHaveText("Välivastaus", {
      timeout: 20000,
    });
    await expect(
      page.getByText("Katson ensin, mitä työtilassa on.", { exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("region", { name: "Agentin vuoro" }),
    ).toHaveCount(1);
    const status = turn.getByRole("status");
    await expect(status).toContainText("Agentti työskentelee");
    await expect(status).toContainText("Ajaa bash");
    await expect(status).toContainText(/\d:\d\d/);
    // The running stage sits after the interim reply and opens on its own.
    expect(
      await interim.evaluate((node) =>
        node.nextElementSibling?.classList.contains("ah-turn-strip"),
      ),
    ).toBe(true);
    await expect(turn.getByText("Vastaus valmis")).toHaveCount(0);
    const show = turn.getByRole("button", { name: "Näytä työ" });
    await show.click();
    await expect(turn.getByRole("button", { name: /^bash/ })).toBeVisible();
    await expect(
      turn.getByRole("button", { name: "Piilota työ" }),
    ).toHaveAttribute("aria-expanded", "true");
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
  // Settled: the same turn now has the stage row, and the answer is last.
  const turn = page.getByRole("region", { name: "Agentin vuoro" }).last();
  await expect(turn.getByText("Vastaus valmis")).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByRole("region", { name: "Agentin vuoro" })).toHaveCount(
    1,
  );
  const row = turn.getByRole("button", { name: /^1 työkalu · ls/ });
  await expect(row).toBeVisible();
  // The stage the reader opened while it ran stays open when the turn settles.
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await expect(turn.getByText("Välivastaus", { exact: true })).toHaveCount(1);
  await expect(turn).toContainText(
    /Katson ensin, mitä työtilassa on\..*1 työkalu.*Vastaus valmis.*Selvä\. Kysyit: "vaiheet"/s,
  );
});
