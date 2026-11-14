import { join } from "node:path";
import { snapshot } from "../lab/session.mjs";
import { labWorkerHostPort } from "../test-ports.mjs";
import { createHostTest, expect } from "./worker-host";

const test = createHostTest(true, { BROWSER_HOST_VIEWS: "1" });
const port = labWorkerHostPort(Number(process.env.TEST_PARALLEL_INDEX ?? 0));
test.use({
  reducedMotion: "reduce",
  baseURL: `https://app.oh.localhost:${port}`,
  launchOptions: {
    args: [`--host-resolver-rules=MAP *.oh.localhost:443 127.0.0.1:${port}`],
  },
});

test("view and file rows align in every theme at desktop and 390px", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const state = await (await page.request.get("/api/v1/snapshot")).json();
  const workspace = state.workspaces.find(
    (w: { name: string }) => w.name === "aurinkokello",
  );
  await page.goto(`/workspaces/${workspace.workspace_id}`);
  await page
    .getByTestId(/^(new-conversation|conversation-start)$/)
    .first()
    .click();
  await expect(page).toHaveURL(/conversation=pi:/);
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";
  for (const set of ["types", "folder"]) {
    const response = await page.request.get(
      `/fixture/files?target=${encodeURIComponent(id)}&set=${set}`,
    );
    expect(response.status()).toBe(200);
    const { offer_ids: ids } = await response.json();
    for (const fileId of ids) {
      await expect(page.locator(`[data-offer-id="${fileId}"]`)).toHaveAttribute(
        "data-state",
        "ready",
      );
    }
  }
  // Offer the view last so it remains visible beside the file rows in narrow captures.
  const response = await page.request.get(
    `/fixture/view?target=${encodeURIComponent(id)}`,
  );
  expect(response.status()).toBe(200);
  await expect(page.getByTestId("assets-chip")).toHaveAttribute(
    "data-views",
    "1",
  );
  await page.getByTestId("assets-chip").click();
  const rows = page.getByTestId("assets-list").getByTestId("asset-open");
  await expect(rows).toHaveCount(9);
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark", "contrast"]) {
      await page.locator("html").evaluate((html, value) => {
        html.setAttribute("data-theme", value);
      }, theme);
      const positions = await rows.evaluateAll((elements) =>
        elements.map((row) => {
          const mark = row.querySelector(".ah-offer-mark-s");
          const title = row.querySelector(".ah-asset-title");
          if (!mark || !title) throw new Error("Asset row lacks mark or title");
          return {
            icon: mark.getBoundingClientRect().x,
            width: mark.getBoundingClientRect().width,
            title: title.getBoundingClientRect().x,
          };
        }),
      );
      for (const position of positions) {
        expect(position.width).toBe(24);
        expect(position.icon).toBeCloseTo(positions[0].icon, 1);
        expect(position.title).toBeCloseTo(positions[0].title, 1);
      }
      await expect(rows.locator(".ah-view-offer-mark")).toHaveCSS(
        "font-size",
        "10px",
      );
      const evidence = process.env.OH_ASSET_ALIGNMENT_EVIDENCE;
      if (evidence) {
        // The types fixture includes unsupported thumbnails outside this list.
        // Do not ask the offline capture to fetch those already-broken images.
        await page.locator("img").evaluateAll(async (images) => {
          await Promise.all(
            images.map(async (image) => {
              if (!(image instanceof HTMLImageElement)) return;
              image.loading = "eager";
              try {
                await image.decode();
              } catch {
                image.removeAttribute("src");
              }
            }),
          );
        });
        await snapshot(page, join(evidence, `asset-rows-${width}-${theme}`), {
          labOrigin: new URL(page.url()).origin,
        });
      }
    }
  }
});
