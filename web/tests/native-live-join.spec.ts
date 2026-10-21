import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("native catch-up keeps the held tool and continued answer in one turn", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.request.get("/fixture/scenario?value=pi-visual-hold");
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "ordinary-dir" })
    .click();
  await page
    .getByRole("button", { name: "Aloita uusi agenttikeskustelu" })
    .click();
  const editor = page.getByRole("textbox", { name: "Viesti agentille" });
  await editor.fill("hidas native join");
  // Mutation samples catch even a duplicate that disappears before an assertion.
  await page.evaluate(() => {
    const samples: {
      turns: number;
      completed: number;
      answering: boolean;
      editor?: number;
    }[] = [];
    const sample = () =>
      samples.push({
        turns: document.querySelectorAll('[aria-label="Agentin vuoro"]').length,
        completed: [
          ...document.querySelectorAll(
            ".ah-message-reply:not(.ah-message-interim)",
          ),
        ].filter((node) => node.textContent?.includes("Vastaus valmis")).length,
        answering:
          document
            .querySelector('[aria-label="Agentin vuoro"]')
            ?.textContent?.includes("Selvä. Kysyit:") ?? false,
        editor: document.querySelector(".ah-cbox")?.getBoundingClientRect().top,
      });
    const observer = new MutationObserver(sample);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    Object.assign(window, {
      joinSamples: samples,
      stopJoinSampling: () => observer.disconnect(),
    });
  });
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  const turn = page.getByRole("region", { name: "Agentin vuoro", exact: true });
  await expect(turn).toHaveCount(1);
  await expect(turn).toContainText("Katson ensin, mitä työtilassa on.", {
    timeout: 15000,
  });
  // Confirm a real native-history read includes the call while Pi is held.
  const id = new URL(page.url()).searchParams.get("conversation");
  expect(id).toBeTruthy();
  await expect
    .poll(async () => {
      const response = await page.request.get(`/api/v1/agents/${id}/history`);
      const history = await response.json();
      return history.entries?.some((entry: { blocks?: { type: string }[] }) =>
        entry.blocks?.some((block) => block.type === "toolCall"),
      );
    })
    .toBe(true);
  // Force the same native read through the browser, independently of SSE timing.
  await page.getByRole("button", { name: "Tiedot", exact: true }).click();
  await page
    .getByRole("button", { name: "Tarkista keskustelun tila", exact: true })
    .click();
  await expect(turn).toHaveCount(1);
  await expect(turn).toContainText("Ajaa bash");
  await expect(turn.getByText("Vastaus valmis", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    turn.getByText("Katson ensin, mitä työtilassa on.", { exact: true }),
  ).toHaveCount(1);
  const editorTop = await page
    .locator(".ah-cbox")
    .evaluate((node) => node.getBoundingClientRect().top);
  expect(
    await page.evaluate(() =>
      (
        window as typeof window & { joinSamples: { completed: number }[] }
      ).joinSamples.some((sample) => sample.completed > 0),
    ),
  ).toBe(false);
  await page.request.get("/fixture/scenario?value=pi-deltas");
  await expect(turn).toContainText('Selvä. Kysyit: "hidas native join".', {
    timeout: 20000,
  });
  await expect(turn.getByText("Vastaus valmis", { exact: true })).toHaveCount(
    1,
  );
  await expect(turn).toHaveCount(1);
  const samples = await page.evaluate(() => {
    const capture = window as typeof window & {
      joinSamples: {
        turns: number;
        completed: number;
        answering: boolean;
        editor?: number;
      }[];
      stopJoinSampling: () => void;
    };
    capture.stopJoinSampling();
    return capture.joinSamples;
  });
  expect(Math.max(...samples.map((sample) => sample.turns))).toBe(1);
  expect(
    samples.some((sample) => sample.answering && sample.completed === 0),
  ).toBe(true);
  const tops = samples.flatMap((sample) =>
    sample.turns && sample.editor !== undefined ? [sample.editor] : [],
  );
  expect(editorTop).toBeGreaterThan(0);
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
  await test.info().attach("native-join-mutations", {
    body: JSON.stringify(samples),
    contentType: "application/json",
  });
  await page.reload();
  await expect(turn).toHaveCount(1);
  await expect(turn.getByText("Vastaus valmis", { exact: true })).toHaveCount(
    1,
  );
  await expect(
    turn.getByText("Katson ensin, mitä työtilassa on.", { exact: true }),
  ).toHaveCount(1);
});
