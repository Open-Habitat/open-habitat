import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import { labOrigin } from "../test-ports.mjs";
import { openHeaderPanel } from "./conversation-view";
import { expect, test } from "./lab-host";

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

test("@lab editor opening measurement", async ({ page }, testInfo) => {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
  const timings: number[] = [];
  const mountTimings: number[] = [];
  for (let i = 0; i < 7; i++) {
    await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
    await page.getByTestId("toggle-editor").click();
    await page
      .getByTestId("editor-file-entry")
      .and(page.locator('[data-path="cmd"]'))
      .click();
    await expect(
      page
        .getByTestId("editor-file-entry")
        .and(page.locator('[data-path="cmd/main.go"]')),
    ).toBeVisible();
    await page.evaluate(() => {
      performance.mark("editor-open");
      document.querySelector('[data-path="cmd/main.go"]')?.addEventListener(
        "click",
        () => {
          performance.mark("editor-click");
          const observer = new MutationObserver(() => {
            if (document.querySelector('[data-testid="editor-document"]')) {
              performance.mark("editor-mounted");
              observer.disconnect();
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
        },
        { once: true },
      );
    });
    await page
      .getByTestId("editor-file-entry")
      .and(page.locator('[data-path="cmd/main.go"]'))
      .click();
    await expect(page.getByTestId("editor-document")).toBeVisible();
    timings.push(
      await page.evaluate(
        () =>
          performance.now() -
          performance.getEntriesByName("editor-open")[0].startTime,
      ),
    );
    mountTimings.push(
      await page.evaluate(
        () =>
          performance.getEntriesByName("editor-mounted")[0].startTime -
          performance.getEntriesByName("editor-click")[0].startTime,
      ),
    );
    await expect(
      page
        .getByTestId("editor-document")
        .locator("span")
        .filter({ hasText: /^package$/ }),
    ).toHaveCount(1);
  }
  await testInfo.attach("opening-ms", {
    body: JSON.stringify(timings),
    contentType: "application/json",
  });
  console.log("EDITOR_OPENING_MS", JSON.stringify(timings));
  console.log("EDITOR_MOUNT_MS", JSON.stringify(mountTimings));
});

const samples = [
  {
    path: "View.tsx",
    content:
      '// Workspace summary\ninterface Workspace {\n  name: string;\n  agents: number;\n}\n\nexport function Summary({ name, agents }: Workspace) {\n  const active = true;\n  return (\n    <section className="summary">\n      <h1>{name}</h1>\n      <p>{agents} agents</p>\n      <button disabled={!active}>Open workspace</button>\n    </section>\n  );\n}\n',
    token: "export",
    color: "--ah-syntax-keyword",
  },
  {
    path: "index.php",
    content: '<?php\nfunction greet() { return "hello"; }\n',
    token: "return",
    color: "--ah-syntax-keyword",
  },
  {
    path: "Cargo.toml",
    content: '[package]\nname = "hello"\nversion = 42\n',
    token: '"hello"',
    color: "--ah-syntax-string",
  },
  {
    path: "query.sql",
    content: "SELECT name FROM people WHERE id = 42;\n",
    token: "SELECT",
    color: "--ah-syntax-keyword",
  },
];
for (const width of [1440, 390])
  for (const theme of ["light", "dark"]) {
    test(`@lab @a11y editor syntax ${width} ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      await page.goto("/agents/pi:a1a1a1a1-0000-4000-8000-000000000001");
      await page.route("**/api/v1/workspaces/editor/list?**", async (route) => {
        const url = new URL(route.request().url());
        await route.fulfill({
          json: {
            schema_version: 1,
            workspace_id: url.searchParams.get("workspace_id"),
            path: "",
            truncated: false,
            entries: [
              ...samples.map(({ path }) => ({ name: path, kind: "file" })),
              { name: "plain.unknown", kind: "file" },
            ],
          },
        });
      });
      await page.route("**/api/v1/workspaces/editor/file?**", async (route) => {
        const url = new URL(route.request().url());
        const path = url.searchParams.get("path");
        // Presentation fixtures only; save/security behavior is covered by browser-editor.
        const content =
          samples.find((s) => s.path === path)?.content ??
          'const plain = "not highlighted";';
        await route.fulfill({
          json: {
            schema_version: 1,
            workspace_id: url.searchParams.get("workspace_id"),
            path,
            content,
            version: `sha256:v1:${"a".repeat(64)}`,
            encoding: "utf-8",
            bom: false,
            newline: "lf",
            size_bytes: new TextEncoder().encode(content).length,
            mode: 420,
          },
        });
      });
      await page.locator("html").evaluate((el, value) => {
        el.dataset.theme = value;
      }, theme);
      await openHeaderPanel(page, "toggle-editor");
      const entry = (path: string) =>
        page
          .getByTestId("editor-file-entry")
          .and(page.locator(`[data-path="${path}"]`));
      const doc = page.getByTestId("editor-document");
      await expect(entry("View.tsx")).toBeVisible();
      for (const sample of samples) {
        if (!(await entry(sample.path).isVisible()))
          await page.getByTestId("editor-picker").click();
        await entry(sample.path).click();
        await expect(doc.locator(".cm-line")).toHaveText(
          sample.content.split("\n"),
        );
        const token = doc
          .locator("span")
          .filter({ hasText: new RegExp(`^${sample.token}$`) })
          .first();
        await expect(token).toBeVisible();
        const expected = await doc.evaluate((el, variable) => {
          const probe = document.createElement("span");
          probe.style.color = `var(${variable})`;
          el.append(probe);
          const color = getComputedStyle(probe).color;
          probe.remove();
          return color;
        }, sample.color);
        await expect(token).toHaveCSS("color", expected);
        if (sample.path === "View.tsx") {
          // Theme updates must affect the existing editor without losing its buffer.
          await page.locator("html").evaluate(
            (el, value) => {
              el.dataset.theme = value;
            },
            theme === "light" ? "dark" : "light",
          );
          await expect(token).not.toHaveCSS("color", expected);
          await page.locator("html").evaluate((el, value) => {
            el.dataset.theme = value;
          }, theme);
          await expect(token).toHaveCSS("color", expected);
          expect(
            (
              await new AxeBuilder({ page })
                .include('[data-testid="browser-editor"]')
                .analyze()
            ).violations,
          ).toEqual([]);
          await snapshot(
            page,
            testInfo.outputPath(`syntax-${width}-${theme}`),
            { labOrigin: new URL(page.url()).origin },
          );
        }
      }
      if (!(await entry("plain.unknown").isVisible()))
        await page.getByTestId("editor-picker").click();
      await entry("plain.unknown").click();
      await expect(doc).toContainText('const plain = "not highlighted";');
      await expect(doc.locator("span[class]")).toHaveCount(0);
      await doc.fill('const changed = "still editable";');
      await expect(page.getByTestId("editor-save")).toBeEnabled();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    });
  }
