import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

// Speech input in the composer (speech-input-composer) through the real
// gateway and daemon routes against the browser host's synthetic Soniox:
// the daemon mints a temporary key with the person's Soniox key from their
// home, the browser streams PCM straight to the fake real-time socket, and
// the case decides what "Soniox" hears. The microphone is an oscillator, so
// no device, real key or network is involved. Same-UID synthetic evidence:
// it proves routing, the contract and the browser's stream handling, not
// Soniox itself or UID isolation.

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

// The person's key has the Soniox console's dotted project shape and the
// administrator's the plain one, so both shapes are saved end to end.
const ownKey = `snx_proj_${"0".repeat(43)}.${"0".repeat(86)}.00Ab12`;
const siteKey = `site${"0".repeat(24)}Kq7Z`;

test.beforeEach(async ({ page }) => {
  // The browser's microphone is a tone, or refused when the case says so.
  await page.addInitScript(() => {
    const devices = navigator.mediaDevices ?? ({} as MediaDevices);
    Object.defineProperty(navigator, "mediaDevices", { value: devices });
    devices.getUserMedia = async () => {
      if ((window as { denyMicrophone?: boolean }).denyMicrophone)
        throw new DOMException("denied", "NotAllowedError");
      const context = new AudioContext();
      const tone = context.createOscillator();
      const out = context.createMediaStreamDestination();
      tone.connect(out);
      tone.start();
      return out.stream;
    };
  });
});

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByTestId("account-menu-trigger")).toBeVisible();
}

async function openConversation(page: Page) {
  await page.goto("/workspaces");
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
}

const soniox = async (page: Page) =>
  (await (await page.request.get("/fixture/soniox?action=state")).json()) as {
    minted: number;
    open: number;
    configs: { audio_format: string; num_channels: number }[];
    audio: number;
    ended: number;
    authorization: string;
    asked: string[];
  };

async function say(
  page: Page,
  tokens: {
    text: string;
    is_final: boolean;
    start_ms?: number;
    end_ms?: number;
  }[],
) {
  // The stream counts as open once the fake has read its start message.
  await expect.poll(async () => (await soniox(page)).open).toBe(1);
  expect(
    (
      await page.request.post("/fixture/soniox?action=say", {
        data: tokens,
      })
    ).status(),
  ).toBe(204);
}

async function control(page: Page, query: string) {
  expect(
    (await page.request.get(`/fixture/soniox?action=${query}`)).status(),
  ).toBe(204);
}

/** The layout Chromium's layout map reports, and a Mac's platform when the
 * case wants one, so the hint and the key's place do not hang on the host. */
async function keyboard(
  page: Page,
  layout: Record<string, string>,
  platform?: string,
) {
  await page.addInitScript(
    ({ layout, platform }) => {
      Object.defineProperty(navigator, "keyboard", {
        value: {
          getLayoutMap: async () => new Map(Object.entries(layout)),
        },
      });
      if (platform)
        Object.defineProperty(navigator, "platform", { get: () => platform });
    },
    { layout, platform },
  );
}

async function saveOwnKey(page: Page) {
  await page.goto("/settings/speech");
  await page.getByTestId("speech-key-input").fill(ownKey);
  await page.getByTestId("speech-key-save").click();
  await expect(page.getByTestId("speech-key-source")).toHaveAttribute(
    "data-source",
    "own",
  );
}

const mic = (page: Page) =>
  page.getByRole("button").and(page.getByTestId("dictation-mic"));
const pill = (page: Page) => page.getByTestId("dictation-stop");
const notice = (page: Page) => page.getByTestId("dictation-notice");

test("@speech without a key the mic leads to Sanelu; with one the dictation streams, shows the guess dimmed and sends", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page);
  await openConversation(page);
  const conversation = page.url();
  await page.getByTestId("message-input").fill("Alku");
  await mic(page).click();
  await expect(notice(page)).toHaveAttribute(
    "data-notice",
    "speech_key_missing",
  );
  // No stream was opened and nothing was minted without a key.
  expect((await soniox(page)).minted).toBe(0);
  await notice(page)
    .getByRole("button")
    .and(page.getByTestId("dictation-settings"))
    .click();
  await expect(page).toHaveURL(/\/settings\/speech$/);
  await page.getByTestId("speech-key-input").fill(ownKey);
  await page.getByTestId("speech-key-save").click();
  await expect(page.getByTestId("speech-key-source")).toHaveAttribute(
    "data-source",
    "own",
  );

  await page.goto(conversation);
  await page.getByTestId("message-input").fill("Alku");
  await mic(page).click();
  await expect(pill(page)).toHaveAttribute("data-phase", "live");
  // The daemon minted with the person's own key; the browser streams PCM.
  // The microphone listens before the stream has opened.
  await expect.poll(async () => (await soniox(page)).open).toBe(1);
  const state = await soniox(page);
  expect(state.authorization).toBe(`Bearer ${ownKey}`);
  expect(state.configs[0]).toMatchObject({
    audio_format: "pcm_s16le",
    num_channels: 1,
  });
  await expect.poll(async () => (await soniox(page)).audio).toBeGreaterThan(0);
  await say(page, [
    { text: " sanelun", start_ms: 0, end_ms: 400, is_final: true },
    { text: " ensimmäi", is_final: false },
  ]);
  await expect(page.getByTestId("dictation-final")).toHaveText("sanelun");
  await expect(page.getByTestId("dictation-interim")).toHaveText(" ensimmäi");
  // While dictating the field shows the dictation, not an editable box.
  await expect(page.getByTestId("message-input")).toBeHidden();
  await say(page, [
    {
      text: " ensimmäinen lause.",
      start_ms: 400,
      end_ms: 1200,
      is_final: true,
    },
  ]);
  await expect(page.getByTestId("dictation-interim")).toHaveText("");
  // Send ends the dictation and sends what was said after what was written.
  await page.getByRole("button").and(page.getByTestId("send")).click();
  await expect(page.locator("main")).toContainText(
    'Kysyit: "Alku sanelun ensimmäinen lause."',
    { timeout: 20_000 },
  );
  await expect.poll(async () => (await soniox(page)).ended).toBe(1);
  await expect(pill(page)).toHaveCount(0);
  await expect(mic(page)).toBeVisible();
});

test("@speech Enter ends a dictation as Valmis does and sends nothing; the shortcut starts and ends one; Enter then sends", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await keyboard(page, { Backquote: "`", IntlBackslash: "\\", KeyA: "a" });
  await signIn(page);
  await saveOwnKey(page);
  await openConversation(page);
  const field = page.getByTestId("message-input");
  // Off the Mac the shortcut is Ctrl and the key left of 1, named after
  // what the layout types there: ` on this US layout.
  await expect(mic(page)).toHaveAttribute("aria-keyshortcuts", "Control+`");
  await expect(page.getByTestId("dictation-mic-tip").locator("kbd")).toHaveText(
    "Ctrl+`",
  );

  await field.fill("Alku");
  await page.keyboard.press("Control+Backquote");
  await expect(pill(page)).toHaveAttribute("data-phase", "live");
  await expect(pill(page)).toBeFocused();
  await say(page, [
    { text: " sanelu", start_ms: 0, end_ms: 400, is_final: true },
  ]);
  await expect(page.getByTestId("dictation-final")).toHaveText("sanelu");
  await page.keyboard.press("Enter");
  await expect(pill(page)).toHaveCount(0);
  await expect(field).toHaveValue("Alku sanelu");
  await expect(field).toBeFocused();
  await expect.poll(async () => (await soniox(page)).ended).toBe(1);
  await expect(page.locator("main")).not.toContainText("Kysyit:");

  // The shortcut from the field starts a dictation and ends it as Valmis,
  // whatever the key types; Ctrl and the key beside the left Shift does
  // nothing.
  await page.keyboard.press("Control+Backquote");
  await expect(pill(page)).toHaveAttribute("data-phase", "live");
  await expect.poll(async () => (await soniox(page)).open).toBe(1);
  const ctrl = (key: string, code: string) =>
    pill(page).evaluate(
      (el, { key, code }) =>
        el.dispatchEvent(
          new KeyboardEvent("keydown", {
            key,
            code,
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          }),
        ),
      { key, code },
    );
  await ctrl("<", "IntlBackslash");
  await expect(pill(page)).toHaveAttribute("data-phase", "live");
  await ctrl("§", "Backquote");
  await expect(pill(page)).toHaveCount(0);
  await expect.poll(async () => (await soniox(page)).ended).toBe(2);
  await expect(field).toHaveValue("Alku sanelu");

  // Outside a dictation Enter sends, as before.
  await field.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toContainText('Kysyit: "Alku sanelu"', {
    timeout: 20_000,
  });
});

test("@speech on a Mac ISO board ⌘ and the key left of 1 dictates at the caret, never ⌘<", async ({
  page,
}) => {
  test.setTimeout(90_000);
  // Chromium on a Finnish Mac ISO board: the key left of 1 (§) reports
  // IntlBackslash and the key beside the left Shift (<) Backquote.
  await keyboard(page, { IntlBackslash: "§", Backquote: "<" }, "MacIntel");
  await signIn(page);
  await saveOwnKey(page);
  await openConversation(page);
  const field = page.getByTestId("message-input");
  await expect(mic(page)).toHaveAttribute(
    "aria-keyshortcuts",
    "Meta+§ Meta+Shift+Space",
  );
  await expect(page.getByTestId("dictation-mic-tip").locator("kbd")).toHaveText(
    "⌘§",
  );

  const press = (key: string, code: string) =>
    field.evaluate(
      (el, { key, code }) =>
        el.dispatchEvent(
          new KeyboardEvent("keydown", {
            key,
            code,
            metaKey: true,
            bubbles: true,
            cancelable: true,
          }),
        ),
      { key, code },
    );
  await field.fill("Alku loppu");
  // The caret after "Alku ".
  await field.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 5));
  // ⌘<, macOS's window cycling here, whose code is Backquote, does nothing.
  await press("<", "Backquote");
  await expect(mic(page)).toBeVisible();
  await press("§", "IntlBackslash");
  await expect(pill(page)).toHaveAttribute("data-phase", "live");
  await say(page, [
    { text: " keskellä", start_ms: 0, end_ms: 400, is_final: true },
    { text: " vielä", is_final: false },
  ]);
  // What is said, and the guess, show where the caret was.
  await expect(page.getByTestId("dictation-live")).toHaveText(
    "Alku keskellä vielä loppu",
  );
  await say(page, [
    { text: " vielä", start_ms: 400, end_ms: 800, is_final: true },
  ]);
  await expect(page.getByTestId("dictation-final")).toHaveText(
    "keskellä vielä",
  );
  await page.keyboard.press("Enter");
  await expect(pill(page)).toHaveCount(0);
  await expect(field).toHaveValue("Alku keskellä vielä loppu");
  await expect(field).toBeFocused();
  // The caret is right after what was said, so typing goes on from there.
  expect(
    await field.evaluate((el: HTMLTextAreaElement) => [
      el.selectionStart,
      el.selectionEnd,
    ]),
  ).toEqual([19, 19]);

  // A selection is replaced.
  await field.evaluate((el: HTMLTextAreaElement) =>
    el.setSelectionRange(5, 19),
  );
  await press("§", "IntlBackslash");
  await expect(pill(page)).toHaveAttribute("data-phase", "live");
  await expect.poll(async () => (await soniox(page)).open).toBe(1);
  await say(page, [
    { text: " tässä", start_ms: 0, end_ms: 400, is_final: true },
  ]);
  await expect(page.getByTestId("dictation-final")).toHaveText("tässä");
  await press("§", "IntlBackslash");
  await expect(pill(page)).toHaveCount(0);
  await expect(field).toHaveValue("Alku tässä loppu");
});

test("@speech the microphone listens from the press: what is said while a slow key and stream open reaches Soniox, even after Valmis", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page);
  await page.goto("/settings/speech");
  await page.getByTestId("speech-key-input").fill(ownKey);
  await page.getByTestId("speech-key-save").click();
  await expect(page.getByTestId("speech-key-source")).toHaveAttribute(
    "data-source",
    "own",
  );
  await openConversation(page);
  const before = await soniox(page);
  await control(page, "mint-delay&value=2000");
  await mic(page).click();
  // Listening at once, while the key is still on its way.
  await expect(pill(page)).toHaveAttribute("data-phase", "live");
  await expect(page.getByTestId("dictation-bar")).toContainText("kuuntelee");
  expect((await soniox(page)).minted).toBe(before.minted);
  await page.waitForTimeout(1_200);
  // Valmis before the stream has opened: the microphone stops, and what
  // it kept still goes to Soniox before the stream ends.
  await pill(page).click();
  await expect(pill(page)).toHaveAttribute("data-phase", "finishing");
  await expect
    .poll(async () => (await soniox(page)).ended, { timeout: 10_000 })
    .toBe(before.ended + 1);
  const after = await soniox(page);
  expect(after.minted).toBe(before.minted + 1);
  // At least a second of 16-bit mono audio at the browser's rate.
  const rate = await page.evaluate(() => new AudioContext().sampleRate);
  expect(after.audio - before.audio).toBeGreaterThanOrEqual(rate * 2);
  await expect(pill(page)).toHaveCount(0);
  await control(page, "mint-delay&value=0");
});

test("@speech the administrator's key reaches the person; a dropped stream reconnects once, then ends keeping the text", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page);
  await page.goto("/settings/speech-key");
  await page.getByTestId("speech-key-input").fill(siteKey);
  await page.getByTestId("speech-key-save").click();
  await expect(page.getByTestId("site-speech-key")).toContainText("Kq7Z");
  await expect(page.getByTestId("site-speech-given")).toBeVisible();
  await page.goto("/settings/speech");
  await expect(page.getByTestId("speech-key-source")).toHaveAttribute(
    "data-source",
    "site",
  );

  await openConversation(page);
  await mic(page).click();
  await expect(pill(page)).toHaveAttribute("data-phase", "live");
  await expect
    .poll(async () => (await soniox(page)).authorization)
    .toBe(`Bearer ${siteKey}`);
  await say(page, [
    { text: "Ensimmäinen", start_ms: 0, end_ms: 500, is_final: true },
    { text: " osa", is_final: false },
  ]);
  await expect(page.getByTestId("dictation-final")).toHaveText("Ensimmäinen");
  await control(page, "drop");
  // One reconnect with a new single-use key; the unconfirmed words stay.
  // The first key minted was the save's check of the administrator's key.
  await expect.poll(async () => (await soniox(page)).minted).toBe(3);
  await expect(pill(page)).toHaveAttribute("data-phase", "live");
  await expect(page.getByTestId("dictation-final")).toHaveText(
    "Ensimmäinen osa",
  );
  await say(page, [{ text: " toinen", is_final: true }]);
  await expect(page.getByTestId("dictation-final")).toHaveText(
    "Ensimmäinen osa toinen",
  );
  await control(page, "drop");
  await expect(notice(page)).toHaveAttribute("data-notice", "dropped");
  expect((await soniox(page)).minted).toBe(3);
  await expect(page.getByTestId("message-input")).toHaveValue(
    "Ensimmäinen osa toinen",
  );
  await expect(page.getByTestId("dictation-resume")).toBeVisible();
});

test("@speech a refused key, a reached limit and a refused microphone reach the person as fixed notices", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page);
  await page.goto("/settings/speech");
  await page.getByTestId("speech-key-input").fill(ownKey);
  await page.getByTestId("speech-key-save").click();
  await expect(page.getByTestId("speech-key-source")).toHaveAttribute(
    "data-source",
    "own",
  );
  await openConversation(page);

  await control(page, "mint&value=rejected");
  await mic(page).click();
  await expect(notice(page)).toHaveAttribute(
    "data-notice",
    "speech_key_rejected",
  );
  // Soniox's own words never reach the page.
  await expect(notice(page)).not.toContainText("synthetic detail");

  await control(page, "mint&value=limit");
  await mic(page).click();
  await expect(notice(page)).toHaveAttribute(
    "data-notice",
    "speech_limit_reached",
  );

  // A temporary key Soniox refuses at the stream's start is a refused key.
  await control(page, "mint&value=ok");
  await control(page, "refuse");
  await mic(page).click();
  await expect(notice(page)).toHaveAttribute(
    "data-notice",
    "speech_key_rejected",
  );

  await page.evaluate(() => {
    (window as { denyMicrophone?: boolean }).denyMicrophone = true;
  });
  await mic(page).click();
  await expect(notice(page)).toHaveAttribute(
    "data-notice",
    "microphone_denied",
  );
  await expect(page.getByTestId("message-input")).toBeEditable();
});

async function keyRegion(page: Page, key: string, region: string) {
  expect(
    (
      await page.request.post(
        `/fixture/soniox?action=key-region&value=${region}`,
        { data: key, headers: { "Content-Type": "text/plain" } },
      )
    ).status(),
  ).toBe(204);
}

test("@speech a key is saved in the region Soniox takes it in, refused when none does, and a wrong stored region heals at dictation", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page);
  // A key no region takes is not saved, and the page says why.
  const refusedKey = `nowhere${"0".repeat(21)}Nn00`;
  await keyRegion(page, refusedKey, "none");
  await page.goto("/settings/speech");
  await page.getByTestId("speech-key-input").fill(refusedKey);
  await page.getByTestId("speech-key-save").click();
  await expect(page.getByTestId("speech-key-refused")).toContainText(
    "Avainta ei tallennettu: Soniox ei tunne sitä EU- eikä USA-alueella",
  );
  await expect(
    page.getByTestId("speech-key-refused").getByRole("link"),
  ).toHaveAttribute("href", "https://console.soniox.com");
  await expect(page.getByTestId("speech-key-refused")).not.toContainText(
    "synthetic detail",
  );
  await expect(page.getByTestId("speech-key-source")).toHaveAttribute(
    "data-source",
    "none",
  );
  // The EU, the default here, is asked first: a US project's key is
  // refused there, saved as US, and the page says it is not the default.
  await keyRegion(page, ownKey, "us");
  await page.getByTestId("speech-key-input").fill(ownKey);
  await page.getByTestId("speech-key-save").click();
  await expect(page.getByTestId("speech-key-saved")).toHaveText(
    "Avain tallennettu. Soniox hyväksyi sen USA-alueella, ei oletuksena olevalla EU-alueella.",
  );
  await expect(page.getByTestId("speech-key-source")).toContainText("(USA)");
  expect((await soniox(page)).asked.slice(-2)).toEqual(["eu", "us"]);
  expect((await soniox(page)).minted).toBe(1);

  // The same key now answers only in the EU, as a key stored under the
  // wrong region does: the dictation still starts, says nothing about the
  // region, and the file is fixed.
  await keyRegion(page, ownKey, "eu");
  await openConversation(page);
  await mic(page).click();
  await expect(pill(page)).toHaveAttribute("data-phase", "live");
  expect((await soniox(page)).asked.slice(-2)).toEqual(["us", "eu"]);
  await expect(notice(page)).toHaveCount(0);
  await page.getByTestId("dictation-stop").click();
  await page.goto("/settings/speech");
  await expect(page.getByTestId("speech-key-source")).toContainText("(EU)");
});

test("@speech the administrator's key is saved in its region and refused when Soniox takes it nowhere", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page);
  await page.goto("/settings/speech-key");
  const refusedKey = `nowhere${"0".repeat(21)}Nn01`;
  await keyRegion(page, refusedKey, "none");
  await page.getByTestId("speech-key-input").fill(refusedKey);
  await page.getByTestId("speech-key-save").click();
  await expect(page.getByTestId("site-speech-key-problem")).toContainText(
    "Avainta ei tallennettu: Soniox ei tunne sitä",
  );
  await expect(page.getByTestId("site-speech-key")).toContainText(
    "Ei yhteistä avainta.",
  );
  await keyRegion(page, siteKey, "eu");
  await page.getByTestId("speech-key-input").fill(siteKey);
  await page.getByTestId("speech-key-save").click();
  await expect(page.getByTestId("site-speech-key-saved")).toHaveText(
    "Avain tallennettu. Soniox hyväksyi sen EU-alueella.",
  );
  await expect(page.getByTestId("site-speech-key")).toContainText("(EU)");
  await page.goto("/settings/speech");
  await expect(page.getByTestId("speech-key-source")).toContainText(
    "Ylläpitäjän avain …Kq7Z (EU).",
  );
});

test("@speech the dictation warns a minute before the ten-minute ceiling and ends there with the text", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.clock.install();
  await signIn(page);
  await page.goto("/settings/speech");
  await page.getByTestId("speech-key-input").fill(ownKey);
  await page.getByTestId("speech-key-save").click();
  await expect(page.getByTestId("speech-key-source")).toHaveAttribute(
    "data-source",
    "own",
  );
  await openConversation(page);
  await mic(page).click();
  await expect(pill(page)).toHaveAttribute("data-phase", "live");
  await say(page, [{ text: "Pitkä sanelu", is_final: true }]);
  await expect(page.getByTestId("dictation-final")).toHaveText("Pitkä sanelu");
  await page.clock.runFor("08:50");
  await expect(page.getByTestId("dictation-ceiling")).toHaveCount(0);
  await page.clock.runFor("00:20");
  await expect(page.getByTestId("dictation-ceiling")).toBeVisible();
  await page.clock.runFor("01:00");
  await expect(notice(page)).toHaveAttribute("data-notice", "ceiling");
  await expect(page.getByTestId("message-input")).toHaveValue("Pitkä sanelu");
  await expect.poll(async () => (await soniox(page)).ended).toBe(1);
});

test("@speech a new conversation dictates before it exists and keeps what was said once created", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page);
  await saveOwnKey(page);
  // The creation reply waits until the dictation is under way, so the
  // conversation is created in the middle of it.
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let replied = false;
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const response = await route.fetch();
    await released;
    await route.fulfill({ response });
    replied = true;
  });
  await page.goto("/workspaces");
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=new$/);
  await page.getByTestId("message-input").fill("Alku");
  await mic(page).click();
  await expect(pill(page)).toHaveAttribute("data-phase", "live");
  await say(page, [
    { text: " ennen", start_ms: 0, end_ms: 400, is_final: true },
    { text: " keskustelua.", start_ms: 400, end_ms: 900, is_final: true },
  ]);
  await expect(page.getByTestId("dictation-final")).toHaveText(
    "ennen keskustelua.",
  );
  release();
  await expect.poll(() => replied).toBe(true);
  // The created conversation waits for the dictation instead of ending it.
  await page.waitForTimeout(1000);
  await expect(page).toHaveURL(/conversation=new$/);
  await expect(pill(page)).toHaveAttribute("data-phase", "live");
  await pill(page).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  await expect(page.getByTestId("message-input")).toHaveValue(
    "Alku ennen keskustelua.",
  );
  await expect.poll(async () => (await soniox(page)).ended).toBe(1);
  await page.getByRole("button").and(page.getByTestId("send")).click();
  await expect(page.locator("main")).toContainText(
    'Kysyit: "Alku ennen keskustelua."',
    { timeout: 20_000 },
  );
});

test("@speech a worktree agent's first message can be dictated and is the message that creates it", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page);
  await saveOwnKey(page);
  await page.goto("/workspaces");
  await page
    .getByRole("navigation")
    .getByTestId("workspace-git-project")
    .click();
  await page
    .locator("main")
    .getByRole("button")
    .and(page.getByTestId("new-worktree"))
    .click();
  await expect(page).toHaveURL(/conversation=new-worktree$/);
  await expect(page.getByTestId("worktree-intro")).toBeVisible();
  await mic(page).click();
  await expect(pill(page)).toHaveAttribute("data-phase", "live");
  await say(page, [
    { text: "Korjaa testit.", start_ms: 0, end_ms: 800, is_final: true },
  ]);
  await expect(page.getByTestId("dictation-final")).toHaveText(
    "Korjaa testit.",
  );
  // Send ends the dictation; its text is the message that creates the
  // agent. This workspace has no commit to branch from, so the host refuses
  // and the message comes back to the field: it was what was sent.
  const creation = page.waitForRequest(
    (r) =>
      r.method() === "POST" &&
      new URL(r.url()).pathname === "/api/v1/conversations",
  );
  await page.getByRole("button").and(page.getByTestId("send")).click();
  await creation;
  await expect(page.getByTestId("creation-problem")).toHaveAttribute(
    "data-state",
    "refused",
  );
  await expect(page.getByTestId("message-input")).toHaveValue("Korjaa testit.");
  await expect.poll(async () => (await soniox(page)).ended).toBe(1);
  await expect(mic(page)).toBeVisible();
});

test.describe("@speech Sanelu settings layout", () => {
  test.use({ deviceScaleFactor: 2 });

  test("@speech @a11y the Soniox key form sits inside its card's padding beside the mic", async ({
    page,
  }, testInfo) => {
    await signIn(page);
    await page.goto("/settings/speech");
    const card = page.locator(".s-card").filter({
      has: page.getByTestId("speech-key-state"),
    });
    const form = page.getByTestId("speech-key-form");
    await expect(form).toBeVisible();
    // Reduced motion: neither the shots nor axe may catch the theme switch
    // mid-transition.
    const theme = async (colorScheme: "light" | "dark") => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        colorScheme,
      );
    };
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const colorScheme of ["light", "dark"] as const) {
        await theme(colorScheme);
        await card.screenshot({
          path: testInfo.outputPath(`sanelu-${width}-${colorScheme}.png`),
          animations: "disabled",
        });
      }
    }
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const box = async (locator: ReturnType<Page["locator"]>) => {
        const b = await locator.boundingBox();
        if (!b) throw new Error("not laid out");
        return b;
      };
      const c = await box(card);
      // The key field, its note and Tallenna keep the row's inset from every
      // card edge, as the other Settings rows do.
      for (const part of [
        page.getByTestId("speech-key-input"),
        form.locator("p.s-desc"),
        page.getByTestId("speech-key-save"),
      ]) {
        const b = await box(part);
        expect(b.x - c.x).toBeGreaterThanOrEqual(12);
        expect(c.x + c.width - (b.x + b.width)).toBeGreaterThanOrEqual(12);
        expect(c.y + c.height - (b.y + b.height)).toBeGreaterThanOrEqual(12);
      }
      // The row's title follows its mic icon instead of floating mid-card.
      const icon = await box(
        page.getByTestId("speech-key-state").locator("svg").first(),
      );
      const title = await box(
        page.getByTestId("speech-key-state").locator("strong").first(),
      );
      expect(title.x - (icon.x + icon.width)).toBeLessThanOrEqual(24);
      expect(title.x).toBeGreaterThan(icon.x);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);
    }
    for (const colorScheme of ["light", "dark"] as const) {
      await theme(colorScheme);
      expect(
        (await new AxeBuilder({ page }).include(".s-main").analyze())
          .violations,
      ).toEqual([]);
    }
    // The Soniox console permissions and the key file wait behind the
    // card's disclosure instead of lengthening the form's note.
    const more = page.getByTestId("speech-key-more");
    await expect(more.getByText("Temporary API keys")).toBeHidden();
    await more.locator("summary").click();
    await expect(more.getByText("Temporary API keys")).toBeVisible();
    await expect(more).toContainText("~/.config/soniox/key.json");
  });
});
