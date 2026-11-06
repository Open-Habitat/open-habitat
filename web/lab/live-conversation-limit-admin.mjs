// Synthetic evidence for live-conversation-limit-admin: the administrator's
// Keskustelut section in the server area and the refusal card, for the
// administrator and for anyone else. Run from the repository root against
// `scripts/lab.sh start`; writes only into the issue's evidence directory.
import { openLab, origin, snapshot } from "./session.mjs";

const out = "issues/live-conversation-limit-admin/evidence";
const hold = (page, value) =>
  page.request.get(`${origin}/fixture/scenario?value=${value}`);

async function setLimit(page, testId, value) {
  const written = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/server/conversations") &&
      r.request().method() === "PUT",
  );
  await page.getByTestId(`${testId}-input`).fill(String(value));
  await page.getByTestId(`${testId}-input`).press("Enter");
  if ((await written).status() !== 200) throw new Error("limit not written");
}

async function workspace(page, name) {
  const snap = await (
    await page.request.get(`${origin}/api/v1/snapshot`)
  ).json();
  const found = snap.workspaces.find((w) => w.name === name);
  if (!found) throw new Error(`no workspace ${name}`);
  return found.workspace_id;
}

async function busy(page, id, text) {
  await page.goto(`${origin}/workspaces/${id}`);
  await page.getByTestId("conversation-start").click();
  await page.getByTestId("command-palette").waitFor();
  await page.getByTestId("message-input").fill(text);
  await page.getByTestId("send").click();
  await page
    .locator(".ah-turn-reply > .ah-message")
    .last()
    .getByText("Katson ensin, mitä työtilassa on.")
    .waitFor({ timeout: 20000 });
}

async function refuse(page, id) {
  await page.goto(`${origin}/workspaces/${id}`);
  await page.getByTestId("conversation-start").click();
  await page
    .locator('[data-testid="creation-problem"][data-reason="capacity"]')
    .waitFor({ timeout: 20000 });
}

const alice = await openLab({ deviceScaleFactor: 2 });
const bob = await openLab({ identity: "bob", deviceScaleFactor: 2 });
try {
  const page = alice.page;
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  await page.request.get(`${origin}/fixture/conversations-reset`);
  await page.goto(`${origin}/settings/experimental`);
  const choice = page.getByTestId(
    "experimental-server-settings-own-area-choice",
  );
  await choice.getByTestId("segment-on").click();
  await page.goto(`${origin}/settings/conversations`);
  await page.getByTestId("live-limits").waitFor();
  await setLimit(page, "live-default", 2);
  await setLimit(page, "live-person-bob-limit", 1);
  await snapshot(page, `${out}/admin-1440-light`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await snapshot(page, `${out}/admin-390-dark`);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });

  await hold(page, "pi-visual-hold");
  const id = await workspace(page, "muistiinpanot");
  await busy(page, id, "Pitkä työ yksi");
  await busy(page, id, "Pitkä työ kaksi");
  await refuse(page, id);
  await snapshot(page, `${out}/card-admin-1440-light`);
  await page.getByTestId("capacity-who").click();
  await page.getByTestId("capacity-window").waitFor();
  await snapshot(page, `${out}/window-1440-light`);
  await page.getByTestId("capacity-stop").first().click();
  await page
    .locator('[data-testid="creation-problem"][data-state="room"]')
    .waitFor({ timeout: 20000 });
  await snapshot(page, `${out}/window-stopped-1440-light`);
  await page.getByTestId("capacity-close").click();
  await snapshot(page, `${out}/card-room-1440-light`);

  const other = bob.page;
  await other.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await other.setViewportSize({ width: 390, height: 844 });
  const bobs = await workspace(other, "muistiinpanot");
  await busy(other, bobs, "Pitkä työ");
  await refuse(other, bobs);
  await snapshot(other, `${out}/card-person-390-dark`);
  console.log("Captured seven synthetic screenshot/HTML pairs");
} finally {
  await hold(alice.page, "ready").catch(() => {});
  await alice.context.close().catch(() => {});
  await alice.browser.close();
  await bob.context.close().catch(() => {});
  await bob.browser.close();
}
