import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./lab-host";

// Workspace deletion and the Trash from the UI (ADR 0019, direction
// Tallennustila) through the real gateway, CSRF check and daemon handler on a
// synthetic home: the /proc scan, the Trash and the fetch before an outright
// deletion are the production code paths.

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByRole("navigation").first()).toBeVisible();
}

async function openWorkspace(page: Page, name: string) {
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const workspace = snapshot.workspaces.find(
    (w: { name: string }) => w.name === name,
  );
  expect(workspace, name).toBeDefined();
  await page.goto(`/workspaces/${workspace.workspace_id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  return workspace.workspace_id as string;
}

const dialog = (page: Page) => page.getByRole("dialog");
async function accessible(page: Page) {
  // react-aria's live announcer keeps a role=img node whose label points at
  // a dialog heading for a few seconds after the dialog closed.
  const result = await new AxeBuilder({ page })
    .exclude("[data-live-announcer]")
    .analyze();
  expect(
    result.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}
const trashStatus = (page: Page) =>
  page.getByRole("region").and(page.getByTestId("trash")).getByRole("status");
const trashRow = (page: Page, name: string) =>
  page.getByRole("listitem").and(page.getByTestId(`trash-row-${name}`));

test("@workspace-trash delete, undo, restore, purge and empty from the UI", async ({
  page,
}) => {
  await signIn(page);
  // An installed Taskfleet that answers with no runs; one that cannot be
  // read blocks every Git workspace, as the ADR requires.
  expect(
    (await page.request.get("/fixture/taskfleet?status=empty")).status(),
  ).toBe(204);

  // A directory has nowhere else that holds it: it goes to the Trash, and
  // the notice undoes the move.
  const id = await openWorkspace(page, "muistiinpanot");
  await page
    .getByRole("button")
    .and(page.getByTestId("delete-workspace"))
    .click();
  await expect(dialog(page).getByRole("heading")).toBeVisible();
  await expect(dialog(page)).toBeVisible();
  await expect(
    dialog(page).getByRole("button").and(page.getByTestId("purge-workspace")),
  ).toHaveCount(0);
  await dialog(page)
    .getByRole("button")
    .and(page.getByTestId("trash-workspace"))
    .click();
  const notice = page.locator(".ah-archive-notice");
  await expect(notice).toBeVisible();
  await expect(page).toHaveURL(/\/workspaces$/);
  await notice
    .getByRole("button")
    .and(page.getByTestId("restore-notice"))
    .click();
  await expect(page).toHaveURL(new RegExp(`/workspaces/${id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Moved again, the notice leads to the Trash in Tallennustila.
  await page
    .getByRole("button")
    .and(page.getByTestId("delete-workspace"))
    .click();
  await dialog(page)
    .getByRole("button")
    .and(page.getByTestId("trash-workspace"))
    .click();
  await notice.getByRole("button").and(page.getByTestId("notice-link")).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(trashRow(page, "muistiinpanot")).toBeVisible();
  await expect(
    page.getByRole("img").and(page.getByTestId("storage-usage")),
  ).toBeVisible();
  await trashRow(page, "muistiinpanot")
    .getByRole("button")
    .and(page.getByTestId("restore-trash"))
    .click();
  await expect(trashRow(page, "muistiinpanot")).toHaveCount(0);
  await expect(page.getByTestId("trash-empty")).toBeVisible();

  // A real process inside blocks, names itself and moves nothing.
  expect(
    (
      await page.request.get("/fixture/busy-process?name=reseptikirja")
    ).status(),
  ).toBe(204);
  await openWorkspace(page, "reseptikirja");
  await page
    .getByRole("button")
    .and(page.getByTestId("delete-workspace"))
    .click();
  await expect(dialog(page).getByRole("heading")).toBeVisible();
  await expect(dialog(page)).toContainText("sleep");
  await accessible(page);
  await expect(
    dialog(page).getByRole("button").and(page.getByTestId("trash-workspace")),
  ).toHaveCount(0);
  await page.request.get("/fixture/busy-process?name=reseptikirja&stop=1");
  await dialog(page)
    .getByRole("button")
    .and(page.getByTestId("recheck"))
    .click();
  await dialog(page)
    .getByRole("button")
    .and(page.getByTestId("trash-workspace"))
    .click();
  await expect(notice).toContainText("reseptikirja");

  // A clean, fully pushed clone is deleted outright after a fetch; there is
  // no Trash alternative, and its ignored files are named.
  expect(
    (
      await page.request.get("/fixture/pushed-clone?name=kokeilu-wasm")
    ).status(),
  ).toBe(204);
  await page.reload();
  await openWorkspace(page, "kokeilu-wasm");
  await page
    .getByRole("button")
    .and(page.getByTestId("delete-workspace"))
    .click();
  await expect(dialog(page).getByRole("heading")).toBeVisible();
  await expect(dialog(page)).toContainText(".env");
  await expect(
    dialog(page).getByRole("button").and(page.getByTestId("trash-workspace")),
  ).toHaveCount(0);
  await dialog(page)
    .getByRole("button")
    .and(page.getByTestId("purge-workspace"))
    .click();
  await expect(notice).toBeVisible();

  // Permanent deletion of one entry needs its name; emptying removes the rest.
  await openWorkspace(page, "muistiinpanot");
  await page
    .getByRole("button")
    .and(page.getByTestId("delete-workspace"))
    .click();
  await dialog(page)
    .getByRole("button")
    .and(page.getByTestId("trash-workspace"))
    .click();
  await page.goto("/settings/tallennustila");
  await trashRow(page, "muistiinpanot")
    .getByRole("button")
    .and(page.getByTestId("purge-trash"))
    .click();
  const purge = dialog(page)
    .getByRole("button")
    .and(page.getByTestId("purge-workspace"));
  await expect(purge).toBeDisabled();
  await dialog(page).getByRole("textbox").fill("muistiinpanot");
  await purge.click();
  await expect(trashRow(page, "muistiinpanot")).toHaveCount(0);
  await expect(trashRow(page, "reseptikirja")).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  await accessible(page);
  await page
    .getByRole("button")
    .and(page.getByTestId("open-empty-trash"))
    .click();
  await dialog(page)
    .getByRole("button")
    .and(page.getByTestId("empty-trash"))
    .click();
  await expect(trashStatus(page)).toBeVisible();
  await expect(page.getByTestId("trash-empty")).toBeVisible();

  // The gateway's write check still applies to every deletion action.
  const forged = await page.evaluate(async () => {
    const r = await fetch("/api/v1/workspaces", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "trash_list" }),
    });
    return r.status;
  });
  expect(forged).toBe(403);
});
