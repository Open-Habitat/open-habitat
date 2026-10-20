import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

test("@lab live turn never flashes recovery controls or moves the editor while streaming", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=pi-deltas");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello" })
    .click();
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  // Make the ordinary native-history invalidation observable across frames.
  await page.route("**/api/v1/agents/*/history*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    // A read still delayed here when the test swaps this route for the
    // failing one below has already been taken over by that route.
    await route.continue().catch(() => {});
  });
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("hidas tallennettu vuoro");
  await page.evaluate(() => {
    const samples: {
      check: boolean;
      stale: boolean;
      editor: number | undefined;
      working: boolean;
      streaming: boolean;
    }[] = [];
    const sample = () => {
      samples.push({
        check: [...document.querySelectorAll("button")].some(
          (node) => node.textContent === "Tarkista keskustelun tila",
        ),
        stale:
          document.body.textContent?.includes("Historia on vanhentunut") ??
          false,
        editor: document.querySelector(".ah-cbox")?.getBoundingClientRect().top,
        working: !!document.querySelector(".ah-working-progress"),
        streaming:
          document.querySelector("textarea")?.placeholder.startsWith("Ohjaa") ??
          false,
      });
    };
    const observer = new MutationObserver(sample);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    const timer = setInterval(sample, 16);
    Object.assign(window, {
      liveTurnSamples: samples,
      stopLiveTurnSampling: () => {
        observer.disconnect();
        clearInterval(timer);
      },
    });
  });
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    page.getByText("Katson ensin,", { exact: false }).first(),
  ).toBeVisible({ timeout: 15000 });
  const editorTop = await page
    .locator(".ah-cbox")
    .evaluate((node) => node.getBoundingClientRect().top);
  await expect(
    page
      .getByText('Selvä. Kysyit: "hidas tallennettu vuoro".', { exact: false })
      .first(),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  const samples = await page.evaluate(() => {
    const capture = window as typeof window & {
      liveTurnSamples: {
        check: boolean;
        stale: boolean;
        editor?: number;
        working: boolean;
        streaming: boolean;
      }[];
      stopLiveTurnSampling: () => void;
    };
    capture.stopLiveTurnSampling();
    return capture.liveTurnSamples;
  });
  expect(samples.length).toBeGreaterThan(100);
  expect(samples.filter((sample) => sample.check || sample.stale)).toEqual([]);
  expect(samples.some((sample) => sample.working)).toBe(false);
  // Send/queue mode and final recap are deliberate transitions. During the
  // intervening stream, the visible editor must remain anchored.
  expect(editorTop).toBeGreaterThan(0);
  const tops = samples
    .filter((sample) => sample.streaming)
    .flatMap((sample) => (sample.editor === undefined ? [] : [sample.editor]));
  expect(tops.length).toBeGreaterThan(100);
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
  await test.info().attach("live-turn-samples", {
    body: JSON.stringify(samples),
    contentType: "application/json",
  });

  // A real sustained history failure must still offer recovery (not hidden
  // forever to satisfy the no-flicker assertion).
  await page.unroute("**/api/v1/agents/*/history*");
  await page.route("**/api/v1/agents/*/history*", (route) =>
    route.fulfill({ status: 503, body: "synthetic failure" }),
  );
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Tarkista keskustelun tila",
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
});
