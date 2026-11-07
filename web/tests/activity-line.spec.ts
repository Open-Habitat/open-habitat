import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./worker-host";

test.use({ reducedMotion: "no-preference", deviceScaleFactor: 2 });

for (const width of [1440, 390]) {
  test(`reduced-motion activity stays quiet across tool changes at ${width}px`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?fixture=design-quiet-turn&stream");
    await page.evaluate(() => document.fonts.ready);
    const line = page.getByTestId("turn-progress");
    const activity = line.locator(".ah-turn-activity");
    const mark = line.getByTestId("status-mark");
    await expect(line).toBeVisible();
    const baseline = await line.evaluate((node) => ({
      y: node.getBoundingClientRect().y,
      height: node.getBoundingClientRect().height,
    }));
    for (let phase = 1; phase <= 7; phase++) {
      await page.getByTestId("stream-next").click();
      await expect(page.getByTestId("stream-phase")).toHaveAttribute(
        "data-phase",
        String(phase),
      );
      await expect(activity).toBeHidden();
      await expect(mark).toBeVisible();
      await expect(line.locator(".ah-turn-clock")).toBeVisible();
      expect(
        await line.evaluate(
          (node) => node.getAnimations({ subtree: true }).length,
        ),
      ).toBe(0);
      const box = await line.evaluate((node) => ({
        y: node.getBoundingClientRect().y,
        height: node.getBoundingClientRect().height,
      }));
      expect(Math.abs(box.y - baseline.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.height - baseline.height)).toBeLessThanOrEqual(1);
    }
    // The preference can change while a turn runs, without a reload.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(activity).toBeVisible();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(activity).toBeHidden();
    await page.getByTestId("turn-work-toggle").click();
    await expect(page.locator(".ah-turn-work .ah-tool-row")).toHaveCount(3);
  });

  test(`@a11y activity line stays put through empty blocks and hidden work at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?fixture=design-quiet-turn&stream");
    await page.evaluate(() => document.fonts.ready);
    const line = page.getByTestId("turn-progress");
    await expect(line).toBeVisible();
    const mark = line.getByTestId("status-mark");
    // An actual running animation, not a static bullet or an animated label.
    expect(
      await mark.evaluate((node) =>
        node
          .getAnimations({ subtree: true })
          .some((animation) => animation.playState === "running"),
      ),
    ).toBe(true);
    expect(await mark.evaluate((node) => node.getAnimations().length)).toBe(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await mark.evaluate(
        (node) => node.getAnimations({ subtree: true }).length,
      ),
    ).toBe(0);
    await expect(mark).toBeVisible();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const top = () => line.evaluate((node) => node.getBoundingClientRect().top);
    const baseline = await top();
    const samples = [baseline];
    for (let phase = 1; phase <= 7; phase++) {
      await page.getByTestId("stream-next").click();
      await expect(page.getByTestId("stream-phase")).toHaveAttribute(
        "data-phase",
        String(phase),
      );
      samples.push(await top());
      await expect(page.getByTestId("stage-reply")).toHaveCount(0);
    }
    expect(Math.max(...samples) - Math.min(...samples)).toBeLessThanOrEqual(1);
    // Real text deliberately grows the bottom-filled thread upward. Subsequent
    // same-line deltas must not add another empty row or change the strip height.
    await page.getByTestId("stream-next").click();
    await expect(page.getByTestId("stage-reply")).toHaveCount(1);
    const writing = await top();
    await page.getByTestId("stream-next").click();
    expect(Math.abs((await top()) - writing)).toBeLessThanOrEqual(1);
    await page.getByTestId("turn-work-toggle").click();
    await expect(page.getByTestId("turn-work-toggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      (await new AxeBuilder({ page }).include("main").analyze()).violations,
    ).toEqual([]);
    await test.info().attach("activity-line-positions", {
      body: JSON.stringify(samples),
      contentType: "application/json",
    });
  });
}
