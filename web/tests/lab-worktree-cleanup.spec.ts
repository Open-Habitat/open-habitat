import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./lab-host";

// Worktree cleanup from the UI (ADR 0025) through the real gateway, CSRF
// check and daemon handler on a synthetic home: Git's registry, the removal
// walk, the commit to the branch and the Taskfleet guard are the production
// code paths.

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await expect(page.getByRole("navigation").first()).toBeVisible();
}

const section = (page: Page) =>
  page.getByRole("region", { name: "Worktreet", exact: true });
const row = (page: Page, name: string) =>
  section(page)
    .getByRole("listitem")
    .filter({
      has: page.locator("code.ah-trash-name", {
        hasText: new RegExp(`^${name}$`),
      }),
    });
const dialog = (page: Page) => page.getByRole("dialog");
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page })
    .exclude("[data-live-announcer]")
    .analyze();
  expect(
    result.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}

test("@worktree-cleanup list, prune, remove, save, force and clean merged", async ({
  page,
}) => {
  // A button that just became enabled is mid-transition for 120 ms, which
  // axe would read as a contrast failure.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page);
  expect((await page.request.get("/fixture/worktrees")).status()).toBe(204);
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const workspace = snapshot.workspaces.find(
    (w: { name: string }) => w.name === "aurinkokello",
  );
  await page.goto(`/workspaces/${workspace.workspace_id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "aurinkokello" }),
  ).toBeVisible();

  // Each Git state, and the removals the host offers for it.
  await expect(section(page).getByRole("listitem")).toHaveCount(6);
  await expect(row(page, "valmis")).toContainText("yhdistetty");
  await expect(row(page, "kesken")).toContainText("ei yhdistetty");
  await expect(row(page, "muokattu")).toContainText("muutoksia");
  await expect(row(page, "kadonnut")).toContainText("hakemisto puuttuu");
  await expect(row(page, "ajossa")).toContainText("omistaa tämän worktreen");
  await expect(row(page, "ajossa").getByRole("button")).toHaveCount(0);
  await expect(
    row(page, "muokattu").getByRole("button", {
      name: "Tallenna ja poista muokattu…",
    }),
  ).toBeVisible();
  await section(page).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/evidence/worktree-cleanup-workspace-desktop.png",
    fullPage: true,
  });
  await accessible(page);

  // A missing directory: only Git's entry goes, without a dialog.
  await row(page, "kadonnut")
    .getByRole("button", { name: "Siivoa merkintä kadonnut" })
    .click();
  await expect(section(page).getByRole("status")).toContainText(
    "vanhentunut merkintä poistettu",
  );
  await expect(row(page, "kadonnut")).toHaveCount(0);

  // Not merged: the checkout goes, the branch stays.
  await row(page, "kesken")
    .getByRole("button", { name: "Poista kesken…" })
    .click();
  await expect(dialog(page)).toContainText("säilyy");
  await dialog(page).getByRole("button", { name: "Poista" }).click();
  await expect(section(page).getByRole("status")).toContainText(
    "kesken poistettu. Haara kesken säilyy.",
  );
  await expect(row(page, "kesken")).toHaveCount(0);

  // Uncommitted changes saved to the branch first.
  await row(page, "muokattu")
    .getByRole("button", {
      name: "Tallenna ja poista muokattu…",
    })
    .click();
  await expect(dialog(page)).toContainText("1 uusi tiedosto");
  await page.screenshot({
    path: "test-results/evidence/worktree-cleanup-save-dialog.png",
  });
  await dialog(page)
    .getByRole("button", { name: "Tallenna ja poista" })
    .click();
  await expect(section(page).getByRole("status")).toContainText(
    /muokattu poistettu\. Muutokset tallennettiin haaraan commitiksi [0-9a-f]{7}\./,
  );

  // Forced: only once the name is typed.
  await row(page, "hylatty")
    .getByRole("button", { name: "Poista pakolla hylatty…" })
    .click();
  const force = dialog(page).getByRole("button", { name: "Poista pakolla" });
  await expect(force).toBeDisabled();
  await dialog(page)
    .getByLabel(/vahvistukseksi/)
    .fill("hylatty");
  await page.screenshot({
    path: "test-results/evidence/worktree-cleanup-force-dialog.png",
  });
  await accessible(page);
  await force.click();
  await expect(section(page).getByRole("status")).toContainText(
    "hylatty poistettu. Haara hylatty säilyy.",
  );

  // Asetukset › Tallennustila lists every workspace's worktrees and cleans
  // the merged ones it showed.
  await page.goto("/settings/tallennustila");
  await expect(row(page, "valmis")).toContainText("aurinkokello");
  await expect(section(page).getByRole("listitem")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await section(page).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/evidence/worktree-cleanup-storage-phone.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await section(page)
    .getByRole("button", { name: "Siivoa kaikki yhdistetyt (1)…" })
    .click();
  await expect(dialog(page)).toContainText("valmis");
  await dialog(page).getByRole("button", { name: "Siivoa 1 worktree" }).click();
  await expect(section(page).getByRole("status")).toContainText(
    "1 worktree siivottiin.",
  );
  await expect(row(page, "valmis")).toHaveCount(0);
  await expect(row(page, "ajossa")).toHaveCount(1);
  await accessible(page);
});
