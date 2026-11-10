import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Interim replies as stages (Vaiheet without the turn head, Jari 19.10.2026)
// against the host-backed synthetic lab: invented history and a fake Pi.
test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
}

async function openStagedHistory(page: Page) {
  await signIn(page);
  await (
    await nativeConversationLink(
      page,
      page.locator("main"),
      "Miksi CI epäonnistuu macOS:llä?",
    )
  )
    .first()
    .click();
  // Turns are found by their native replies, which the fixture wrote.
  const sync = page
    .getByTestId("agent-turn")
    .filter({ hasText: "Fleet on ajan tasalla" });
  const backup = page
    .getByTestId("agent-turn")
    .filter({ hasText: "en poista lukkoa enkä muuta mitään." });
  await expect(backup).toBeVisible({ timeout: 20000 });
  return { sync, backup };
}

test("@lab history turn reads as stages: summary rows, interim cards, final answer", async ({
  page,
}) => {
  const { sync, backup } = await openStagedHistory(page);
  // No turn head: the stage rows replace it, and no reply names the model.
  await expect(page.locator(".ah-turn-head")).toHaveCount(0);
  await expect(sync.locator(".ah-turn-head")).toHaveCount(0);
  const rows = sync.locator(".ah-turn-stage > button");
  await expect(rows).toHaveCount(3);
  for (const [index, tools, thinking] of [
    [0, 2, 1],
    [1, 2, 1],
    [2, 1, 0],
  ]) {
    await expect(rows.nth(index)).toHaveAttribute(
      "data-tool-count",
      String(tools),
    );
    await expect(rows.nth(index)).toHaveAttribute(
      "data-thinking-count",
      String(thinking),
    );
  }
  // A closed row names no command, only how long its stage took: the lab
  // saves one native entry a minute.
  for (const index of [0, 1, 2]) {
    await expect(rows.nth(index)).not.toContainText("git ");
    await expect(rows.nth(index)).toHaveAttribute(
      "data-elapsed-seconds",
      /^[1-9]\d*0$/,
    );
  }
  await expect(
    sync.getByTestId("message").and(page.locator('[data-interim="true"]')),
  ).toHaveCount(2);
  await expect(
    sync
      .getByTestId("message")
      .and(page.locator('[data-reply-complete="true"]')),
  ).toHaveCount(1);
  await expectNativeContent(sync, "claude-opus-5-5", {
    exact: true,
    count: 0,
    visible: false,
  });
  // Each row precedes the reply that closes its stage.
  const order = await sync.evaluate((node) =>
    [
      ...node.querySelectorAll(
        "[data-testid=turn-stage], [data-testid=stage-reply]",
      ),
    ].map((child) => child.getAttribute("data-testid")),
  );
  expect(order).toEqual([
    "turn-stage",
    "stage-reply",
    "turn-stage",
    "stage-reply",
    "turn-stage",
    "stage-reply",
  ]);

  // A row opens only its own stage, and it is a real disclosure button.
  const doctor = sync.getByTestId("history-stage-toggle").nth(1);
  await expect(doctor).toHaveAttribute("aria-expanded", "false");
  await doctor.focus();
  await page.keyboard.press("Enter");
  await expect(doctor).toHaveAttribute("aria-expanded", "true");
  await expect(
    sync
      .getByTestId("tool-row")
      .and(page.locator('[data-tool-target="fleetctl doctor"]'))
      .getByTestId("history-tool-toggle"),
  ).toBeVisible();
  await expectNativeContent(
    sync,
    "Running the fleet doctor across machines",
    {},
  );
  await expect(
    sync
      .getByTestId("tool-row")
      .and(page.locator('[data-tool-target^="git pull"]'))
      .getByTestId("history-tool-toggle"),
  ).toBeVisible();
  await expect(
    sync
      .getByTestId("tool-row")
      .and(page.locator('[data-tool-target^="git status"]'))
      .getByTestId("history-tool-toggle"),
  ).toHaveCount(0);
  await expect(
    sync
      .getByTestId("tool-row")
      .and(page.locator('[data-tool-target="ping -c 2 -W 2 desktop.example"]'))
      .getByTestId("history-tool-toggle"),
  ).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(doctor).toHaveAttribute("aria-expanded", "false");
  await expect(
    sync
      .getByTestId("tool-row")
      .and(page.locator('[data-tool-target="fleetctl doctor"]'))
      .getByTestId("history-tool-toggle"),
  ).toHaveCount(0);

  // A long interim reply is shown in full; the one right before the answer
  // has no stage row of its own because no work came between them.
  await expectNativeContent(backup, "en poista lukkoa enkä muuta mitään.", {});
  await expect(backup.locator(".ah-turn-stage > button")).toHaveCount(2);
  const last = backup
    .getByTestId("stage-reply")
    .and(page.locator('[data-reply-role="interim"]'))
    .last();
  await expect(last).toHaveAttribute("data-reply-role", "interim");
  const following = await last.evaluate((node) =>
    node.nextElementSibling?.getAttribute("data-reply-role"),
  );
  expect(following).toBe("final");
  // The whole page, not only one turn: this conversation has several agent
  // turns, and rules such as landmark-unique only fail across them.
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("@lab stage turns fit a phone in light and dark", async ({ page }) => {
  const { sync } = await openStagedHistory(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (value) => document.documentElement.setAttribute("data-theme", value),
      theme,
    );
    const overflow = await page.evaluate(() => {
      const stream = document.querySelector(".ah-conversation-stream");
      return stream ? stream.scrollWidth - stream.clientWidth : 0;
    });
    expect(overflow).toBeLessThanOrEqual(0);
    const row = sync.locator(".ah-turn-stage > button").first();
    const box = await row.boundingBox();
    expect(box && box.x + box.width).toBeLessThanOrEqual(390);
    const colors = await sync
      .locator(".ah-message-interim header strong")
      .first()
      .evaluate((node) => getComputedStyle(node).color);
    expect(colors).not.toBe("rgba(0, 0, 0, 0)");
  }
});

test("@lab live turn shows its interim reply once and runs the next stage in place", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.request.get("/fixture/conversations-reset");
  expect(
    (await page.request.get("/fixture/scenario?value=pi-visual-hold")).status(),
  ).toBe(204);
  try {
    await signIn(page);
    await page
      .getByTestId("workspace-navigation")
      .getByTestId("workspace-aurinkokello")
      .click();
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await page.getByTestId("message-input").fill("vaiheet");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    // Fake Pi holds at its tool: the interim reply is saved, the tool runs.
    const turn = page.getByTestId("agent-turn").last();
    const interim = turn
      .getByTestId("stage-reply")
      .and(page.locator('[data-reply-role="interim"]'))
      .first();
    await expect(interim).toHaveAttribute("data-reply-role", "interim", {
      timeout: 20000,
    });
    await expectNativeContent(page, "Katson ensin, mitä työtilassa on.", {
      exact: true,
      count: 1,
      visible: false,
    });
    await expect(page.getByTestId("agent-turn")).toHaveCount(1);
    const status = turn.getByRole("status");
    await expect(status).toHaveAttribute("data-working", "true");
    await expect(status).toContainText(/\d:\d\d/);
    // The running stage sits after the interim reply and opens on its own.
    expect(
      await interim.evaluate((node) =>
        node.nextElementSibling?.classList.contains("ah-turn-strip"),
      ),
    ).toBe(true);
    await expect(
      turn
        .getByTestId("message")
        .and(page.locator('[data-reply-complete="true"]')),
    ).toHaveCount(0);
    const show = turn.getByTestId("turn-work-toggle");
    await show.click();
    await expect(
      turn.locator('[data-tool-name="bash"][data-state="running"]'),
    ).toHaveCount(1);
    await expect(
      turn
        .getByTestId("tool-row")
        .and(page.locator('[data-tool-name="bash"]'))
        .getByTestId("history-tool-toggle"),
    ).toBeVisible();
    await expect(turn.getByTestId("turn-work-toggle")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  } finally {
    await page.request.get("/fixture/scenario?value=ready");
  }
  // Settled: the same turn now has the stage row, and the answer is last.
  const turn = page.getByTestId("agent-turn").last();
  await expect(
    turn
      .getByTestId("message")
      .and(page.locator('[data-reply-complete="true"]')),
  ).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByTestId("agent-turn")).toHaveCount(1);
  const row = turn.getByTestId("history-stage-toggle");
  await expect(row).toBeVisible();
  // The stage the reader opened while it ran stays open when the turn settles.
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await expect(
    turn.getByTestId("message").and(page.locator('[data-interim="true"]')),
  ).toHaveCount(1);
  await expect(turn).toContainText(
    /Katson ensin, mitä työtilassa on\..*Selvä\. Kysyit: "vaiheet"/s,
  );
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
