import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Agent messages between the person's conversations (agent-agent-messages,
// experimental) through the real gateway and daemon. The synthetic history
// is two conversations of the same person that exchanged six messages
// (test/browser-host/agent_messages_history.go): each side holds what it
// received as the daemon's <agent-message> block and what it sent as the
// CLI's typed tool result. The live case sends a follow-up through the
// daemon's agent route to a conversation whose turn is still running.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  locale: "fi-FI",
  timezoneId: "Europe/Helsinki",
  reducedMotion: "reduce",
});

const report = "pi:11111111-1111-4111-8111-111111111111";
const charts = "pi:44444444-4444-4444-8444-444444444444";
const m = (n: number) => `5c1e8f20-7b3a-4d9e-a6f2-00000000000${n}`;

async function prefer(page: Page, on: boolean) {
  const s = await (await page.request.get("/auth/session")).json();
  const put = await page.request.put("/api/v1/account/preferences", {
    headers: {
      Origin: new URL(page.url()).origin,
      "X-Agent-Host-CSRF": s.csrf,
    },
    data: { experimental: { "agent-agent-messages": on } },
  });
  expect(put.status()).toBe(200);
}

async function signIn(page: Page, history = true) {
  await page.request.get("/fixture/scenario?value=ready");
  if (history)
    expect(
      (await page.request.get("/fixture/history?mode=agent-messages")).status(),
    ).toBe(204);
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByTestId("workspace-navigation")).toBeAttached();
}

const feed = (page: Page) => page.locator(".ah-feed");
const message = (page: Page, n: number) =>
  feed(page).locator(`[data-agent-message="${m(n)}"]`);

for (const width of [1440, 390]) {
  test(`@agent-messages both sides, quotes and links between the conversations ${width}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await prefer(page, true);
    await page.goto(`/agents/${report}`);
    await expect(feed(page)).toContainText("Synthetic report done.", {
      timeout: 15000,
    });

    // The report sent m1, m4 and m6 and received m2, m3 and m5: every one
    // is its own block, none is the person's bubble or a tool row.
    await expect(feed(page).getByTestId("agent-letter-out")).toHaveCount(3);
    await expect(feed(page).getByTestId("agent-letter")).toHaveCount(3);
    for (const n of [1, 4, 6])
      await expect(message(page, n)).toHaveAttribute(
        "data-testid",
        "agent-letter-out",
      );
    for (const n of [2, 3, 5])
      await expect(message(page, n)).toHaveAttribute(
        "data-testid",
        "agent-letter",
      );
    await expect(feed(page)).not.toContainText("<agent-message");
    await expect(feed(page)).not.toContainText("agent_message_sent");
    await expect(feed(page)).not.toContainText("It is not the person's own");
    // Only the person's own two messages are drawn as theirs.
    await expect(
      feed(page).locator('li[data-kind="user"] [data-testid="message"]'),
    ).toHaveCount(2);

    // Who it is from or to, as a link to the same message there, and the
    // message; the accessible name says the direction.
    await expect(message(page, 2)).toHaveAttribute(
      "aria-label",
      "Viesti keskustelusta Synthetic charts",
    );
    await expect(message(page, 1)).toHaveAttribute(
      "aria-label",
      "Viesti keskusteluun Synthetic charts",
    );
    const link = message(page, 1).getByTestId("agent-letter-peer");
    await expect(link).toHaveText("Synthetic charts");
    expect(await link.getAttribute("href")).toMatch(
      new RegExp(
        `^/workspaces/ws_[A-Za-z0-9_-]+\\?conversation=${charts}&message=${m(1)}$`,
      ),
    );
    await expect(message(page, 3)).toContainText(
      "September is missing from data/q3.csv",
    );

    // A quote is one line, only where the agent quoted, ending in "…" where
    // the quoted message goes on, and not repeated under the very message
    // it quotes (m6 quotes m5 directly above it).
    for (const n of [1, 2, 3])
      await expect(
        message(page, n).getByTestId("agent-letter-quote"),
      ).toHaveCount(0);
    const quote = message(page, 4).getByTestId("agent-letter-quote");
    await expect(quote).toHaveText(
      "Synthetic gap: September is missing from data/q3.csv. …",
    );
    await expect(quote).toHaveAttribute(
      "aria-label",
      /^Lainaus: Synthetic charts klo \d{1,2}\.\d{2}\. Siirry viestiin\.$/,
    );
    const line = await quote.evaluate((el) => {
      const text = el.querySelector(".ah-agent-quote-text") as HTMLElement;
      return {
        height: text.getBoundingClientRect().height,
        lh: parseFloat(getComputedStyle(text).lineHeight) || 20,
      };
    });
    expect(line.height).toBeLessThanOrEqual(line.lh * 1.5);
    await expect(
      message(page, 5).getByTestId("agent-letter-quote"),
    ).toHaveAttribute("aria-label", /^Lainaus: tämä agentti klo /);
    await expect(
      message(page, 6).getByTestId("agent-letter-quote"),
    ).toHaveCount(0);

    expect(
      (
        await new AxeBuilder({ page })
          .include(".ah-feed")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `test-results/agent-messages-report-${width}.png`,
    });

    // Pressing a quote shows its original in this conversation.
    await message(page, 5).getByTestId("agent-letter-quote").click();
    await expect(message(page, 4)).toHaveClass(/ah-search-target/);

    // The name opens the other conversation at the same message, and the
    // route lets the message id go once it is shown.
    await link.click();
    await expect(page).toHaveURL(new RegExp(charts));
    await expect(page).not.toHaveURL(/message=/);
    await expect(message(page, 1)).toHaveClass(/ah-search-target/, {
      timeout: 15000,
    });
    await expect(message(page, 1)).toHaveAttribute(
      "data-testid",
      "agent-letter",
    );
    await expect(message(page, 1)).toBeInViewport();
    // In the charts conversation m4 arrives quoting m3, and m5 goes out
    // right below m4, which it quotes.
    await expect(message(page, 4).getByTestId("agent-letter-quote")).toHaveText(
      /^Synthetic gap: September is missing from data\/q3\.csv\. …$/,
    );
    await expect(
      message(page, 5).getByTestId("agent-letter-quote"),
    ).toHaveCount(0);
    await expect(
      message(page, 6).getByTestId("agent-letter-quote"),
    ).toHaveCount(1);
    await expect(message(page, 2)).toHaveAttribute(
      "aria-label",
      "Viesti keskusteluun Synthetic report",
    );
    await page.screenshot({
      path: `test-results/agent-messages-charts-${width}.png`,
    });
  });
}

test("@agent-messages switch off draws the old rows without the daemon's block", async ({
  page,
}) => {
  test.setTimeout(60000);
  await signIn(page);
  await prefer(page, false);
  await page.goto(`/agents/${report}`);
  await expect(feed(page)).toContainText("Synthetic report done.", {
    timeout: 15000,
  });
  await expect(feed(page).getByTestId("agent-letter")).toHaveCount(0);
  await expect(feed(page).getByTestId("agent-letter-out")).toHaveCount(0);
  await expect(feed(page)).toContainText(
    "Synthetic chart 2 is updated with the Q3 figures",
  );
  await expect(feed(page)).not.toContainText("<agent-message");
});

for (const width of [1440, 390]) {
  test(`@agent-messages a message to a busy conversation waits in its queue named by the sender ${width}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, false);
    await prefer(page, true);
    const start = async (text: string) => {
      await page.goto("/workspaces");
      await page
        .getByRole("navigation")
        .getByTestId("workspace-ordinary-dir")
        .click();
      await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
      const editor = page.getByTestId("message-input");
      await editor.fill(text);
      await page
        .getByTestId("send")
        .and(page.locator('[data-mode="send"]'))
        .click();
      await expect(
        page
          .getByTestId("composer-stop")
          .and(page.locator('[data-stop-target="agent"]')),
      ).toBeVisible({ timeout: 15000 });
      return new URL(page.url()).searchParams.get("conversation") ?? "";
    };
    const sender = await start("hidas lähettäjä");
    const receiver = await start("hidas vastaanottaja");
    await page.setViewportSize({ width, height: 900 });
    expect(sender).toMatch(/^pi:/);
    expect(receiver).toMatch(/^pi:/);
    const sent = await page.request.get(
      `/fixture/agent-message?${new URLSearchParams({ target: receiver, from: sender, kind: "follow_up", text: "Synthetic follow-up from the other conversation." })}`,
    );
    expect(sent.status()).toBe(200);
    const result = await sent.json();
    expect(result).toMatchObject({
      kind: "agent_message_sent",
      to: receiver,
      delivery: "follow-up",
      state: "pending",
      text: "Synthetic follow-up from the other conversation.",
    });
    // Waiting behind the running turn, it names the sending conversation,
    // never the daemon's block.
    const queue = page.getByTestId("composer-queue");
    await expect(queue.getByRole("listitem")).toHaveCount(1);
    await expect(queue.getByRole("listitem")).toContainText(
      "hidas lähettäjä: Synthetic follow-up from the other conversation.",
    );
    await expect(queue).not.toContainText("<agent-message");
    await page.screenshot({
      path: `test-results/agent-messages-queue-${width}.png`,
    });
    // Once the turn ends it arrives as a letter from that conversation.
    const letter = feed(page).locator(
      `[data-agent-message="${result.message_id}"]`,
    );
    await expect(letter).toHaveAttribute("data-testid", "agent-letter", {
      timeout: 60000,
    });
    await expect(letter).toContainText(
      "Synthetic follow-up from the other conversation.",
    );
    expect(
      await letter.getByTestId("agent-letter-peer").getAttribute("href"),
    ).toContain(`conversation=${sender}&message=${result.message_id}`);
  });
}
