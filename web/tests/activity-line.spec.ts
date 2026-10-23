import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./worker-host";

for (const width of [1440, 390]) {
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
