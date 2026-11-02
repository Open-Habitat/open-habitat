import AxeBuilder from "@axe-core/playwright";
import type { Route } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { archiveFromConfirmedView } from "./archive-proof";
import { expect, test } from "./worker-host";

const host = hostOrigin;
const agent = "pi:11111111-1111-4111-8111-111111111111";
test.use({
  baseURL: host,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});
async function fixture(page: import("@playwright/test").Page, mode: string) {
  expect(
    (await page.request.get(`/fixture/history?mode=${mode}`)).status(),
  ).toBe(204);
}
async function login(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  if ((page.viewportSize()?.width ?? 1280) <= 800) {
    await expect(page.getByTestId("navigation-open")).toBeVisible();
  } else {
    await expect(page.getByTestId("workspace-navigation")).toContainText(
      "Alice",
    );
  }
}
test("@native-history native page, continuation, unknown, reopen and no writes", async ({
  page,
}) => {
  await fixture(page, "short");
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(r.url());
  });
  await login(page);
  await (
    await nativeConversationLink(
      page,
      page.locator("main"),
      /Synteettinen viesti 0/,
    )
  ).click();
  await expect(page).toHaveURL(`/agents/${agent}`);
  await expect(page.locator(".ah-feed li")).toHaveCount(101);
  await expectNativeContent(
    page.locator(".ah-feed"),
    "Synteettinen viesti 151",
    { exact: true },
  );
  await expect(page.locator(".ah-read-only-footer")).toBeVisible();
  for (let i = 0; i < 2; i++) await page.getByTestId("older-history").click();
  await expect(page.locator(".ah-feed li")).toHaveCount(251);
  const older = page.getByTestId("older-history");
  await expect(older).toHaveCount(0);
  const refresh = page.waitForResponse((response) =>
    response.url().includes("/history?"),
  );
  await page.getByTestId("snapshot-refresh").click();
  await refresh;
  await expect(page.locator(".ah-feed li")).toHaveCount(251);
  await expect(older).toHaveCount(0);
  await expect(page.getByTestId("unknown-event")).toBeVisible();
  await page.getByTestId("history-block-load").click();
  await expect(page.locator(".ah-feed li").nth(248)).not.toContainText(
    "<script>alert('bad')</script>",
  );
  expect(await page.locator(".ah-feed script").count()).toBe(0);
  expect(writes).toHaveLength(0);
  await page.reload();
  await expect(page.locator(".ah-feed li")).toHaveCount(101);
  await expectNativeContent(
    page.locator(".ah-feed"),
    "Synteettinen viesti 151",
    { exact: true },
  );
});
test("@native-history unwritten terminal session can archive and restore", async ({
  page,
}) => {
  // This journey includes a forced refusal, fresh-page rediscovery and native
  // eligibility re-probes; their bounded waits can exceed the default 30 s.
  test.setTimeout(60000);
  await fixture(page, "ready");
  // Force the same definite refusal that a changed native revision produces
  // under load. Rediscovery must reopen this view, not the optimistic workspace.
  let stale = true;
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const snapshot = await response.json();
    if (stale) {
      const entry = snapshot.agents.find(
        (entry: { agent_id: string }) => entry.agent_id === agent,
      );
      entry.observation_token = "obs_stale_archive";
    }
    await route.fulfill({ response, json: snapshot });
  });
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/v1/workspaces"
    )
      stale = false;
  });
  await login(page);
  await page.goto(`/agents/${agent}`);
  const refused = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/workspaces",
  );
  const bar = page.locator(".ah-agent-header");
  await archiveFromConfirmedView(page, () =>
    bar
      .getByTestId("archive-conversation")
      .and(page.locator(':not([data-archive-state="archived"])')),
  );
  expect((await refused).status()).toBe(409);
  await page.unrouteAll({ behavior: "wait" });
  await page.goto(`/agents/${agent}`);
  await expect(
    bar
      .getByTestId("restore-conversation")
      .or(
        bar
          .getByTestId("archive-conversation")
          .and(page.locator('[data-archive-state="archived"]')),
      ),
  ).toBeEnabled();
  await bar
    .getByTestId("restore-conversation")
    .or(
      bar
        .getByTestId("archive-conversation")
        .and(page.locator('[data-archive-state="archived"]')),
    )
    .click();
  // Eligibility is re-probed every 5 s. A transient unknown after restore
  // must get another observation before the assertion's deadline.
  await expect(
    bar
      .getByTestId("archive-conversation")
      .and(page.locator(':not([data-archive-state="archived"])')),
  ).toBeEnabled({
    timeout: 15000,
  });
  const titleReply = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(`/api/v1/conversations/${agent.slice(3)}/history_title`) &&
      response.request().method() === "POST",
  );
  await bar.getByTestId("conversation-retitle").click();
  const response = await titleReply;
  if (response.status() === 409) {
    // A native proof can become uncertain after restore. The browser must not
    // claim a rename when the daemon refuses the write.
    await expect(page.getByTestId("title-error")).toBeVisible();
    await expect(bar).not.toContainText("Synteettinen otsikko");
  } else {
    expect(response.status()).toBe(200);
    await expect(bar).toContainText("Synteettinen otsikko");
  }
});
test("@native-history settled terminal history can be titled through Pi", async ({
  page,
}) => {
  test.setTimeout(60000);
  await fixture(page, "ready");
  await login(page);
  await page.goto(`/agents/${agent}`);
  const bar = page.locator(".ah-agent-header");
  // Read a definite refusal before delivering it to the app. A page response
  // body can become unavailable while the view is replaced during recovery.
  const path = `**/api/v1/conversations/${agent.slice(3)}/history_title`;
  let refusal: string | undefined;
  let forwarding: Promise<void> | undefined;
  const capture = (route: Route) => {
    forwarding = (async () => {
      const upstream = await route.fetch();
      if (upstream.status() === 409) {
        try {
          refusal = (await upstream.json()).error?.code;
        } catch {
          refusal = undefined;
        }
      }
      await route.fulfill({ response: upstream });
    })();
    return forwarding;
  };
  await page.route(path, capture);
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await page.reload();
      refusal = undefined;
      const title = bar.getByTestId("conversation-retitle");
      await expect(title).toBeEnabled({ timeout: 15000 });
      const titleReply = page.waitForResponse(
        (response) =>
          response
            .url()
            .endsWith(
              `/api/v1/conversations/${agent.slice(3)}/history_title`,
            ) && response.request().method() === "POST",
      );
      await title.click();
      const response = await titleReply;
      await forwarding;
      if (response.status() === 409 && attempt < 2) {
        // historyTitle returns this only before launching a writer. A later
        // native census may be unknown even after the UI observed eligibility.
        expect(refusal).toBe("control_uncertain");
        await expect(page.getByTestId("title-error")).toBeVisible();
        continue; // a new view and affirmative observation, never an uncertain write
      }
      expect(response.status()).toBe(200);
      await expect(bar).toContainText("Synteettinen otsikko");
      return;
    }
  } finally {
    await forwarding;
    await page.unroute(path, capture);
  }
});
test("@native-history empty native session is read-only", async ({ page }) => {
  await fixture(page, "empty");
  await login(page);
  await page.goto(`/agents/${agent}`);
  await expect(page.getByTestId("conversation-empty")).toBeVisible();
  await expect(page.locator(".ah-feed li")).toHaveCount(0);
  await fixture(page, "ready");
});
test("@native-history mapped identity isolates native content", async ({
  page,
}) => {
  await fixture(page, "ready");
  await page.goto("/");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=43"]')).click();
  await page.goto(`/agents/${agent}`);
  await expect(page.locator(".ah-feed li").first()).toContainText(
    "Bobin synteettinen viesti 150",
  );
  const spoofed = await page.request.get(
    `/api/v1/agents/${agent}/history?limit=1&after=`,
    {
      headers: {
        "X-Agent-Host-Identity": "wid_forged",
        "X-Agent-Host-Display-Name": "GitHub user 42",
      },
    },
  );
  expect(spoofed.status()).toBe(200);
  expect((await spoofed.json()).entries[0].content.text).toBe(
    "Bobin synteettinen viesti 0",
  );
  await expect(page.locator(".ah-feed")).not.toContainText(
    "Synteettinen viesti 0",
  );
});
test("@native-history missing, corrupt and read-only states", async ({
  page,
}) => {
  await fixture(page, "ready");
  await login(page);
  await page.goto(`/agents/${agent}`);
  await expectNativeContent(
    page.locator(".ah-feed"),
    "Synteettinen viesti 151",
    { exact: true },
  );
  await fixture(page, "corrupt");
  await page.getByTestId("snapshot-refresh").click();
  await expect(page.getByTestId("history-stale")).toBeVisible();
  await page.goto(`/agents/${agent}`);
  await page.screenshot({
    path: "test-results/evidence/history-corrupt.png",
    fullPage: true,
  });
  await fixture(page, "missing");
  await page.getByTestId("snapshot-refresh").click();
  await expect(page.getByTestId("conversation-observation")).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/history-missing.png",
    fullPage: true,
  });
  await fixture(page, "ready");
});

test("@native-history narrow history keeps actions visible without page overflow", async ({
  page,
}) => {
  await fixture(page, "ready");
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto(`/agents/${agent}`);
  await expect(page.locator(".ah-feed li").first()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  await expect(
    page.locator(".ah-feed").getByTestId("message-copy").first(),
  ).toBeVisible();
});
test("@native-history older page keeps the visible native row anchored", async ({
  page,
}) => {
  await fixture(page, "ready");
  await login(page);
  await page.goto(`/agents/${agent}`);
  await expect(page.locator(".ah-feed li")).toHaveCount(101);
  await page.locator(".ah-conversation-stream").evaluate((el) => {
    el.scrollTop = 0;
  });
  const pager = page.getByTestId("older-history");
  const pagerBox = await pager.boundingBox();
  const firstBox = await page.locator(".ah-feed li").first().boundingBox();
  if (!pagerBox || !firstBox) throw new Error("missing history layout");
  // Older history belongs above the loaded entries, inside their column.
  // A direct bare button after the timeline (the live report) fails both.
  expect(pagerBox.y + pagerBox.height).toBeLessThanOrEqual(firstBox.y);
  expect(Math.abs(pagerBox.x - firstBox.x)).toBeLessThan(2);
  expect(Math.abs(pagerBox.width - firstBox.width)).toBeLessThan(2);
  const before = await page
    .locator(".ah-feed li")
    .first()
    .evaluate((el) => el.getBoundingClientRect().top);
  // Avoid scrolling the viewport to the footer button while measuring the first row.
  await page
    .getByTestId("older-history")
    .evaluate((button: HTMLElement) => button.click());
  await expect(page.locator(".ah-feed li")).toHaveCount(201);
  const after = await page
    .locator(".ah-feed li")
    .nth(100)
    .evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(after - before)).toBeLessThan(3);
});
test("@native-history warm return paints from cache while revalidating history", async ({
  page,
}) => {
  await fixture(page, "ready");
  await login(page);
  await page.goto(`/agents/${agent}`);
  await expect(page.locator(".ah-feed li")).toHaveCount(101);
  await page.locator("#main").getByTestId("new-conversation-link").click();
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/")) requests.push(request.url());
  });
  const start = await page.evaluate(() => performance.now());
  await (
    await nativeConversationLink(
      page,
      page.locator("main"),
      /Synteettinen viesti 0/,
    )
  ).click();
  await expect(page.locator(".ah-feed li")).toHaveCount(101);
  const paint = await page.evaluate(
    () =>
      new Promise<number>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve(performance.now())),
        ),
      ),
  );
  // A warm read-only view paints immediately but checks the native source on
  // open if inotify has failed while the user was away.
  await expect
    .poll(
      () =>
        requests.filter((url) => url.includes(`/agents/${agent}/history`))
          .length,
    )
    .toBe(1);
  // Synthetic lab only: two animation frames, not a WAN latency promise.
  console.log(
    `warm read-only return: ${Math.round(paint - start)} ms, ${requests.length} API requests`,
  );
  expect(paint - start).toBeLessThan(2000);
});

test("@native-history read-only control retains safe history actions on desktop and phone", async ({
  page,
}) => {
  await fixture(page, "ready");
  await login(page);
  await page.goto(`/agents/${agent}`);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const bar = page.locator(".ah-agent-header");
    await expect(bar).toHaveAttribute("data-control", "read-only");
    if (width === 1280) {
      for (const testId of ["conversation-retitle", "archive-conversation"])
        await expect(bar.getByTestId(testId)).toBeEnabled();
      const details = bar
        .getByRole("button")
        .and(page.getByTestId("workspace-details"));
      await expect(details).toBeEnabled();
      if ((await details.getAttribute("aria-expanded")) === "false")
        await details.click();
    } else {
      // The phone keeps the same actions in the conversation's menu.
      await bar.getByTestId("conversation-menu").click();
      for (const id of ["retitle", "archive", "details"])
        await expect(
          page.getByRole("menuitem").and(page.getByTestId(`menu-${id}`)),
        ).toBeEnabled();
      await page.keyboard.press("Escape");
    }
    await expect(page.locator(".ah-details-popover")).toBeVisible();
    await expect(page.locator(".ah-read-only-footer")).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).include(".ah-agent-header").analyze())
        .violations,
    ).toEqual([]);
  }
});

test("@native-history cut-off tail preserves readable pages and offers a new conversation", async ({
  page,
}) => {
  await fixture(page, "cut-off");
  await login(page);
  await (
    await nativeConversationLink(
      page,
      page.locator("main"),
      /Synteettinen viesti 0/,
    )
  ).click();
  await expect(page.getByTestId("history-cut-off")).toBeVisible();
  await expect(page.locator(".ah-feed li")).toHaveCount(101);
  await expect(page.getByTestId("new-conversation-link")).toBeVisible();
  await page.getByTestId("older-history").click();
  await expect(page.getByTestId("history-cut-off")).toBeVisible();
  // Audit the added notice; the older native unknown-event row is unrelated.
  const results = await new AxeBuilder({ page })
    .include(".ah-notice")
    .analyze();
  expect(results.violations).toEqual([]);
});

// Resolve native conversation identity from the host, not translated link copy.
async function nativeConversationLink(
  page: import("@playwright/test").Page,
  scope: import("@playwright/test").Page | import("@playwright/test").Locator,
  title: string | RegExp,
) {
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const agent = snapshot.agents.find((entry: { title: { display: string } }) =>
    typeof title === "string"
      ? entry.title.display.includes(title)
      : title.test(entry.title.display),
  );
  if (!agent) throw new Error("Missing native conversation identity");
  return scope
    .getByTestId(/^(agent-link|home-conversation-.*)$/)
    .and(
      page.locator(
        `a[href*="conversation=${encodeURIComponent(agent.agent_id)}"], a[href*="conversation=${agent.agent_id}"], a[href="/agents/${agent.agent_id}"]`,
      ),
    );
}

// Native content is asserted independently of translated controls. This helper
// only reads rendered content; it never finds an element for an interaction.
async function expectNativeContent(
  scope: import("@playwright/test").Page | import("@playwright/test").Locator,
  expected: string | RegExp,
  options: {
    count?: number;
    visible?: boolean;
    exact?: boolean;
    timeout?: number;
  } = {},
) {
  const { count, visible = true, exact = false, timeout } = options;
  const read = () =>
    scope.locator("*").evaluateAll(
      (nodes, args) => {
        const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
        const matches = (node: Element) => {
          if (["SCRIPT", "STYLE", "HEAD"].includes(node.tagName)) return false;
          const text = normalize(node.textContent ?? "");
          return args.regex
            ? new RegExp(args.regex, args.flags).test(text)
            : args.exact
              ? text === normalize(args.text)
              : text.includes(normalize(args.text));
        };
        return nodes.filter(
          (node) =>
            matches(node) &&
            ![...node.children].some(matches) &&
            (!args.visible ||
              (node.getClientRects().length > 0 &&
                getComputedStyle(node).visibility !== "hidden")),
        ).length;
      },
      {
        text: typeof expected === "string" ? expected : "",
        regex: expected instanceof RegExp ? expected.source : "",
        flags: expected instanceof RegExp ? expected.flags : "",
        exact,
        visible,
      },
    );
  if (count === undefined)
    await expect.poll(read, { timeout }).toBeGreaterThan(0);
  else await expect.poll(read, { timeout }).toBe(count);
}
