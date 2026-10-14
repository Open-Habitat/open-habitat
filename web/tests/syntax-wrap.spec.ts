import { expect, test } from "./worker-host";

test("@syntax-wrap fenced reply wrap mode does not hide long code lines", async ({
  page,
}) => {
  await page.goto("/?fixture=design");
  const widths = await page.evaluate(() => {
    const root = document.createElement("div");
    root.className = "ah-message";
    root.innerHTML = `<div class="ah-prose"><figure class="ah-markdown-code"><div class="ah-bash-window"><pre class="ah-output-viewport ah-output-wrap" style="width:200px"><code class="ah-syntax">${"longlonglong".repeat(35)}</code></pre></div></figure></div>`;
    document.body.append(root);
    const pre = root.querySelector("pre") as HTMLPreElement;
    const result = {
      scroll: pre.scrollWidth,
      width: pre.clientWidth,
      whiteSpace: getComputedStyle(pre).whiteSpace,
    };
    root.remove();
    return result;
  });
  expect(widths.whiteSpace).toBe("pre-wrap");
  expect(widths.scroll).toBeLessThanOrEqual(widths.width + 1);
});
