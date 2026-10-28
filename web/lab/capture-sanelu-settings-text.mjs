#!/usr/bin/env node
// Synthetic lab only (sanelu-settings-text-trim): Asetukset › Sanelu, the
// administrator's Saneluavain and the composer's missing-key notice, at
// device scale factor 2.
//   scripts/lab.sh start && node web/lab/capture-sanelu-settings-text.mjs before|after
import { openLab, origin, snapshot } from "./session.mjs";

const stage = process.argv[2];
if (stage !== "before" && stage !== "after") {
  console.error(
    "usage: node web/lab/capture-sanelu-settings-text.mjs before|after",
  );
  process.exit(2);
}
const out = `issues/sanelu-settings-text-trim/${stage}`;
const ownKey = `own${"0".repeat(24)}Ab12`;
const siteKey = `site${"0".repeat(24)}Kq7Z`;
const { browser, page } = await openLab({
  width: 1280,
  height: 800,
  deviceScaleFactor: 2,
});
// The microphone is a tone; the shot only needs the notice before any stream.
await page.addInitScript(() => {
  const devices = navigator.mediaDevices ?? {};
  Object.defineProperty(navigator, "mediaDevices", { value: devices });
  devices.getUserMedia = async () => {
    const context = new AudioContext();
    const out = context.createMediaStreamDestination();
    context.createOscillator().connect(out);
    return out.stream;
  };
});
const settle = async (testid) => {
  await page.getByTestId(testid).first().waitFor();
  await page.waitForTimeout(300);
};
try {
  await page.goto(`${origin}/workspaces`);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").waitFor();
  await page.getByTestId("dictation-mic").click();
  await settle("dictation-notice");
  await snapshot(page, `${out}/01-composer-key-missing`);

  await page.goto(`${origin}/settings/speech`);
  await settle("speech-key-form");
  await snapshot(page, `${out}/02-sanelu-no-key`);

  await page.goto(`${origin}/settings/speech-key`);
  await settle("speech-key-form");
  await snapshot(page, `${out}/03-saneluavain-no-key`);
  await page.getByTestId("speech-key-input").fill(siteKey);
  await page.getByTestId("speech-key-save").click();
  await settle("site-speech-given");
  await snapshot(page, `${out}/04-saneluavain-set`);

  await page.goto(`${origin}/settings/speech`);
  await page.locator('[data-source="site"]').waitFor();
  await snapshot(page, `${out}/05-sanelu-site-key`);
  await page.getByTestId("speech-key-replace").click();
  await settle("speech-key-form");
  await snapshot(page, `${out}/06-sanelu-add-own`);
  await page.getByTestId("speech-key-input").fill(ownKey);
  await page.getByTestId("speech-key-save").click();
  await page.locator('[data-source="own"]').waitFor();
  await snapshot(page, `${out}/07-sanelu-own-key`);
  if (stage === "after") {
    await page.getByTestId("speech-key-more").locator("summary").click();
    await snapshot(page, `${out}/08-sanelu-more-open`);
    await page.goto(`${origin}/settings/speech-key`);
    await settle("site-speech-key");
    await page.getByTestId("speech-key-more").locator("summary").click();
    await snapshot(page, `${out}/09-saneluavain-more-open`);
    await page.goto(`${origin}/settings/speech`);
    await settle("speech-key-remove");
  }

  // Leave the lab's homes as they were.
  await page.getByTestId("speech-key-remove").click();
  await page.goto(`${origin}/settings/speech-key`);
  await page.getByTestId("site-speech-key-remove").click();
  await page.getByTestId("speech-key-form").waitFor();
} finally {
  await browser.close();
}
