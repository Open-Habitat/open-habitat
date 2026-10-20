import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

type Sample = {
  gap: boolean;
  check: boolean;
  stale: boolean;
  words: number;
  streaming: boolean;
};

// A long streamed answer (or a spinoff brief streamed as tool arguments) used
// to outgrow the 128-frame live tail: the daemon stopped streaming, the browser
// showed "Tapahtumia jäi väliin", dropped the partial text and marked the
// history stale until the saved message arrived. Pi's own native writes also
// marked the open history stale until a slow snapshot and read answered.
test("@lab a long stream keeps its text and shows no gap or recovery", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=pi-deltas");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello" })
    .click();
  await page
    .getByRole("button", { name: "Aloita uusi agenttikeskustelu" })
    .click();
  // Live snapshots and native-history reads take more than a second on the
  // test server (gateway journal, 2026-10-17); the 800 ms warning delay alone
  // does not hide an intermediate state that slow.
  await page.route("**/api/v1/agents/*/history*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.route("**/api/v1/snapshot*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1700));
    await route.continue();
  });
  await page
    .getByRole("textbox", { name: "Viesti agentille" })
    .fill("pitkä virta");
  await page.evaluate(() => {
    const samples: Sample[] = [];
    const sample = () => {
      const text = document.querySelector("main")?.textContent ?? "";
      samples.push({
        gap: text.includes("Tapahtumia jäi väliin"),
        check: [...document.querySelectorAll("button")].some(
          (node) => node.textContent === "Tarkista keskustelun tila",
        ),
        stale: text.includes("Historia on vanhentunut"),
        words: (text.match(/sana\d+/g) ?? []).length,
        streaming:
          document.querySelector("textarea")?.placeholder.startsWith("Ohjaa") ??
          false,
      });
    };
    const timer = setInterval(sample, 25);
    Object.assign(window, {
      streamSamples: samples,
      stopStreamSampling: () => clearInterval(timer),
    });
  });
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(page.getByText("sana5 ", { exact: false }).first()).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText("sana199", { exact: false }).first()).toBeVisible(
    { timeout: 30000 },
  );
  await expect(
    page.getByRole("button", { name: "Lähetä", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  const samples = await page.evaluate(() => {
    const capture = window as typeof window & {
      streamSamples: Sample[];
      stopStreamSampling: () => void;
    };
    capture.stopStreamSampling();
    return capture.streamSamples;
  });
  await test.info().attach("long-stream-samples", {
    body: JSON.stringify(samples),
    contentType: "application/json",
  });
  // Run-length summary of the visible states, for the issue's evidence.
  const runs: string[] = [];
  for (const s of samples) {
    const key = `gap=${s.gap} check=${s.check} stale=${s.stale} text=${s.words > 0}`;
    if (runs.at(-1)?.startsWith(key)) {
      const [, n] = (runs.at(-1) as string).split(" ×");
      runs[runs.length - 1] = `${key} ×${Number(n) + 1}`;
    } else runs.push(`${key} ×1`);
  }
  console.log(`long-stream states (25 ms samples):\n${runs.join("\n")}`);
  expect(samples.length).toBeGreaterThan(200);
  expect(samples.filter((s) => s.gap)).toEqual([]);
  expect(samples.filter((s) => s.check || s.stale)).toEqual([]);
  // The stream keeps arriving to its end rather than freezing at a bound
  // (the daemon used to stop publishing after 128 tail frames).
  let stall = 0;
  let longest = 0;
  for (let i = 1; i < samples.length; i++) {
    const held =
      samples[i].streaming &&
      samples[i].words >= 30 &&
      samples[i].words < 200 &&
      samples[i].words === samples[i - 1].words;
    stall = held ? stall + 1 : 0;
    longest = Math.max(longest, stall);
  }
  // One history read may hold queued events for its own duration (1.2 s here).
  expect(longest * 25).toBeLessThan(2000);
  // Once streaming text is shown it only grows until the saved answer.
  const first = samples.findIndex((s) => s.words > 0);
  expect(first).toBeGreaterThanOrEqual(0);
  const shrinks = samples
    .slice(first)
    .filter(
      (s, i, list) => i > 0 && s.words < list[i - 1].words && s.words < 190,
    );
  expect(shrinks).toEqual([]);
});
