// Synthetic evidence for server-sections-norm: every Palvelimen ylläpito
// section on the shared norm, at 1440 and 390 in light and dark, scale 2.
// Run from the repository root against `scripts/lab.sh start`:
//   node web/lab/server-sections-norm.mjs [output-dir]
// It writes only into the issue's evidence directory (or the given
// directory under .cache/lab/shots).
import { resolve } from "node:path";
import { openLab, origin, snapshot } from "./session.mjs";

const out = resolve(process.argv[2] ?? "issues/server-sections-norm/evidence");
if (
  !out.startsWith(resolve("issues/server-sections-norm")) &&
  !out.startsWith(resolve(".cache/lab/shots"))
)
  throw new Error("evidence belongs to the issue or .cache/lab/shots");

const sections = [
  ["conversations", "keskustelut", "live-limits"],
  ["disk", "levytila", "server-storage-section"],
  ["server", "yleiset", "server-name-input"],
  ["users", "kayttajat", "server-access"],
  ["ai-key", "aiavain", "site-key-page"],
  ["speech-key", "saneluavain", "site-speech-key"],
  ["server-integrations", "integraatiot", "server-integrations"],
];

// Steps a limit the way a person types it and waits for the host's reply.
async function setLimit(page, testId, value, route) {
  const written = page.waitForResponse(
    (r) => r.url().endsWith(route) && r.request().method() === "PUT",
  );
  await page.getByTestId(`${testId}-input`).fill(String(value));
  await page.getByTestId(`${testId}-input`).press("Enter");
  if (!(await written).ok()) throw new Error(`${testId} not written`);
}

const { browser, page } = await openLab({ deviceScaleFactor: 2 });
try {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${origin}/settings/experimental`);
  const choice = page.getByTestId(
    "experimental-server-settings-own-area-choice",
  );
  if (await choice.count()) await choice.getByTestId("segment-on").click();
  // Bob gets limits of his own, so both kinds of row show.
  await page.goto(`${origin}/settings/conversations`);
  await setLimit(
    page,
    "live-person-bob-limit",
    4,
    "/api/v1/server/conversations",
  );
  await page.goto(`${origin}/settings/disk`);
  await setLimit(page, "storage-limit-bob", 20, "/api/v1/server/storage");
  // Tall enough that each section shows whole.
  for (const [width, height] of [
    [1440, 1600],
    [390, 2400],
  ]) {
    await page.setViewportSize({ width, height });
    for (const theme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme: theme });
      for (const [path, name, ready] of sections) {
        await page.goto(`${origin}/settings/${path}`);
        await page.getByTestId(ready).first().waitFor();
        await page.waitForLoadState("networkidle");
        await snapshot(page, `${out}/${name}-${width}-${theme}`);
      }
    }
  }
} finally {
  await browser.close();
}
