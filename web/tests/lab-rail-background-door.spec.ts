import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// mark-hides-background-work, direction 2 Vaeltava ovi
// (rail-background-door, experimental): while a process of the conversation
// runs, the rail mark's door drifts in every state whose ring does not
// already move, keeping the state. The lab's conversations are rewritten on
// the wire into live ones with synthetic processes.

test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "no-preference",
});

/** The synthetic processes; a test ends one by clearing it. */
type World = { sleep: boolean };

const NEW_REPLY = "pi:a1a1a1a1-0000-4000-8000-000000000001";
const QUIET_SLEEP = "pi:a1a1a1a1-0000-4000-8000-000000000002";
const WORKING = "pi:b2b2b2b2-0000-4000-8000-000000000003";
const BACKGROUND = "pi:c3c3c3c3-0000-4000-8000-000000000004";

const service = {
  process_id: "proc_5174",
  name: "vite --port 5174",
  kind: "process",
  run_ids: [],
  before_turn: true,
};
const build = {
  process_id: "proc_bench",
  name: "npm run bench",
  kind: "process",
  run_ids: [],
};

async function open(page: Page, door: boolean, world: World = { sleep: true }) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const session = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": session.csrf,
        },
        data: { experimental: { "rail-background-door": door } },
      })
    ).ok(),
  ).toBe(true);
  // After the browser's first read, so the reply is news to it.
  const at = new Date(Date.now() + 1000).toISOString();
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const agent of body.agents) {
      const live = {
        process: "terminal_observed_live",
        control: "read_only",
        run_active: false,
      };
      if (agent.agent_id === NEW_REPLY)
        Object.assign(agent, live, {
          last_reply: { id: "reply-1", at },
          waiting_on: [service],
        });
      else if (agent.agent_id === QUIET_SLEEP)
        Object.assign(agent, live, {
          waiting_on: [],
          non_waking_processes: world.sleep
            ? [{ process_id: "proc_sleep", name: "sleep 900" }]
            : undefined,
        });
      else if (agent.agent_id === WORKING)
        Object.assign(agent, live, { run_active: true, waiting_on: [service] });
      else if (agent.agent_id === BACKGROUND)
        Object.assign(agent, live, { waiting_on: [build] });
    }
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await expect(row(page, QUIET_SLEEP)).toBeVisible();
}

const row = (page: Page, id: string) =>
  page.getByRole("navigation").getByTestId(`agent-item-${id}`);
const mark = (page: Page, id: string) => row(page, id).getByTestId("rail-mark");
const ring = (page: Page, id: string) => mark(page, id).locator(".oh-ring");

/** Each row's state, whether its door drifts, and what its ring does. */
async function expectMarks(
  page: Page,
  rows: [string, string, boolean][],
  motion: "full" | "reduced",
) {
  for (const [id, state, drifts] of rows) {
    await expect(mark(page, id), id).toHaveAttribute("data-state", state);
    if (drifts) await expect(mark(page, id), id).toHaveAttribute("data-drift");
    else await expect(mark(page, id), id).not.toHaveAttribute("data-drift");
    if (!drifts) continue;
    const css = await ring(page, id).evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        animation: s.animationName,
        offset: s.strokeDashoffset,
        dash: s.strokeDasharray,
      };
    });
    // Moving, the door travels as the background state's; still, it rests a
    // quarter turn on. Either way the ring is open, a done one too.
    expect(css.animation, id).toBe(motion === "full" ? "oh-drift" : "none");
    if (motion === "reduced") expect(css.offset, id).toMatch(/^-25(px)?$/);
    expect(css.dash, id).toMatch(/^81\.3(px)?,? 18\.7(px)?$/);
  }
}

const expected: [string, string, boolean][] = [
  // A reply with a service left running: your turn, knocking, door drifts.
  [NEW_REPLY, "waiting", true],
  // A process that does not wake the agent: done, in Hiljaiset, door ajar.
  [QUIET_SLEEP, "done", true],
  // Working and background already move their door.
  [WORKING, "working", false],
  [BACKGROUND, "background", false],
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme}`, () => {
    test.use({ colorScheme: scheme });
    test(`@rail-background-door the door drifts while a process runs (${scheme})`, async ({
      page,
    }) => {
      const world = { sleep: true };
      await open(page, true, world);
      await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
      await expectMarks(page, expected, "full");
      // The non-waking process stays in Hiljaiset and is named in the row.
      await expect(
        page.getByTestId("rail-quiet").getByTestId(`agent-item-${QUIET_SLEEP}`),
      ).toBeVisible();
      await expect(row(page, QUIET_SLEEP)).toHaveAttribute(
        "title",
        /sleep 900/,
      );
      await expect(
        page.getByTestId("rail-running").getByTestId(`agent-item-${WORKING}`),
      ).toBeVisible();
      // The state keeps its colour: done is --ah-ok, your turn --ah-turn.
      const colours = await page.evaluate(
        ([done, turn]) => {
          const probe = document.createElement("span");
          document.body.append(probe);
          const read = (v: string) => {
            probe.style.color = `var(${v})`;
            return getComputedStyle(probe).color;
          };
          const result = {
            ok: read("--ah-ok"),
            turn: read("--ah-turn"),
            done: getComputedStyle(
              document.querySelector(
                `[data-testid="agent-item-${done}"] [data-testid="rail-mark"]`,
              ) as Element,
            ).color,
            waiting: getComputedStyle(
              document.querySelector(
                `[data-testid="agent-item-${turn}"] [data-testid="rail-mark"]`,
              ) as Element,
            ).color,
          };
          probe.remove();
          return result;
        },
        [QUIET_SLEEP, NEW_REPLY],
      );
      expect(colours.done).toBe(colours.ok);
      expect(colours.waiting).toBe(colours.turn);
      // Opening the reply reads it: the read mark keeps the drifting door.
      await row(page, NEW_REPLY).getByTestId("agent-link").click();
      await expectMarks(page, [[NEW_REPLY, "read", true]], "full");
      // The sleep ends: the done door shuts again.
      world.sleep = false;
      await page.reload();
      await expectMarks(page, [[QUIET_SLEEP, "done", false]], "full");
      await expect(ring(page, QUIET_SLEEP)).toHaveCSS(
        "stroke-dasharray",
        /^100(px)?,? 0(px)?$/,
      );
    });
  });
}

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("@rail-background-door still, the door rests a quarter turn on", async ({
    page,
  }) => {
    await open(page, true);
    await expectMarks(page, expected, "reduced");
  });
});

test("@rail-background-door off by default: no mark drifts and a non-waking process stays unsaid", async ({
  page,
}) => {
  await open(page, false);
  await expectMarks(
    page,
    expected.map(([id, state]) => [id, state, false]),
    "full",
  );
  await expect(row(page, QUIET_SLEEP)).not.toHaveAttribute(
    "title",
    /sleep 900/,
  );
});
