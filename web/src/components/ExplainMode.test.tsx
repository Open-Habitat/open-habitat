import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExplainMode, placeBeside, readSituation } from "./ExplainMode";
import { start, stop } from "./explainModeState";

// The explain-follow switch, per test.
const flags = vi.hoisted(() => ({ follow: false }));
vi.mock("../app/accountPreferences", async (original) => ({
  ...(await original<typeof import("../app/accountPreferences")>()),
  useExperimentalFeature: (id: string) =>
    id === "explain-follow" && flags.follow,
}));

vi.mock("./explainFeedback", async (original) => ({
  ...(await original<typeof import("./explainFeedback")>()),
  readVersion: () => Promise.resolve("test"),
}));

import { parts } from "./explainParts";

const turn = (inner: string) =>
  `<ol class="ah-feed"><li data-kind="assistant"><section data-testid="agent-turn">${inner}</section></li></ol>`;
const view = (activity: string, body = "", header = "") => {
  const root = document.createElement("div");
  root.innerHTML = `<header class="ah-agent-header" data-activity="${activity}">${header}</header>${body}`;
  return root;
};

afterEach(() => {
  cleanup();
  stop();
  flags.follow = false;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("F opens the report for immediate typing without inserting the shortcut", async () => {
  const user = userEvent.setup();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(100, 100, 120, 40),
  );
  render(
    <>
      <button type="button" data-testid="context-ring">
        Context
      </button>
      <ExplainMode />
    </>,
  );
  act(() => start());
  // Without a shown card, F does not open a report.
  await user.keyboard("f");
  expect(screen.queryByTestId("explain-feedback-text")).toBeNull();
  await user.tab();
  expect(screen.getByTestId("explain-card").getAttribute("data-card")).toBe(
    "Y05",
  );
  await user.keyboard("fFirst correction");
  const field = screen.getByTestId<HTMLTextAreaElement>(
    "explain-feedback-text",
  );
  expect(document.activeElement).toBe(field);
  expect(field.value).toBe("First correction");
  expect(screen.getByTestId("explain-card").getAttribute("data-pinned")).toBe(
    "true",
  );
  expect(screen.getByTestId("explain-card").getAttribute("aria-live")).toBe(
    "polite",
  );
  await user.keyboard("{Escape}");
  expect(screen.queryByTestId("explain-feedback-text")).toBeNull();
  expect(screen.queryByTestId("explain-card")).not.toBeNull();
  await user.keyboard("{Escape}");
  expect(screen.queryByTestId("explain-card")).toBeNull();
});

describe("readSituation", () => {
  it("is null outside a conversation and while the state is unknown", () => {
    expect(readSituation(document.createElement("div"))).toBeNull();
    expect(readSituation(view("unknown"))).toBeNull();
  });

  it("reads the situation the header and the latest turn show", () => {
    expect(
      readSituation(view("neutral", '<div data-testid="conversation-empty">')),
    ).toBe("notStarted");
    expect(readSituation(view("working", turn("")))).toBe("working");
    expect(
      readSituation(
        view("neutral", "", '<button data-testid="spinoff-waiting"></button>'),
      ),
    ).toBe("background");
    expect(
      readSituation(
        view(
          "neutral",
          turn('<div data-testid="stage-reply" data-reply-kind="failed">'),
        ),
      ),
    ).toBe("failed");
    expect(
      readSituation(
        view(
          "neutral",
          turn(
            '<div data-testid="stage-reply" class="ah-turn-interim"></div><div data-testid="turn-stage"></div>',
          ),
        ),
      ),
    ).toBe("stopped");
    expect(
      readSituation(
        view(
          "neutral",
          turn(
            '<div data-testid="turn-stage"></div><div data-testid="stage-reply"></div>',
          ),
        ),
      ),
    ).toBe("yourTurn");
  });
});

it("names every part by a selector the browser accepts", () => {
  for (const [id, part] of Object.entries(parts))
    expect(() => document.querySelector(part.sel), id).not.toThrow();
});

describe("explain-follow", () => {
  const setup = () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(100, 100, 120, 40),
    );
    render(
      <>
        <button type="button" data-testid="context-ring">
          Context
        </button>
        <button type="button" data-testid="toggle-editor">
          Editor
        </button>
        <ExplainMode />
      </>,
    );
    act(() => start());
  };

  it("off: the card keeps its report button and does not follow", async () => {
    const user = userEvent.setup();
    setup();
    await user.tab();
    const card = screen.getByTestId("explain-card");
    expect(card.hasAttribute("data-follow")).toBe(false);
    expect(screen.queryByTestId("explain-report")).not.toBeNull();
    expect(screen.queryByTestId("explain-report-key")).toBeNull();
  });

  it("on: F alone pins the card into its report; Esc lets go, a second Esc ends", async () => {
    flags.follow = true;
    const user = userEvent.setup();
    setup();
    await user.tab();
    const card = screen.getByTestId("explain-card");
    expect(card.hasAttribute("data-follow")).toBe(true);
    // No report button to press: the card never takes the pointer.
    expect(screen.queryByTestId("explain-report")).toBeNull();
    expect(screen.queryByTestId("explain-report-key")).not.toBeNull();
    // Keyboard focus puts the card below the part.
    expect(Number.parseInt(card.style.top, 10)).toBeGreaterThanOrEqual(140);
    await user.keyboard("fWrong");
    const field = screen.getByTestId<HTMLTextAreaElement>(
      "explain-feedback-text",
    );
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe("Wrong");
    expect(card.getAttribute("data-pinned")).toBe("true");
    // Esc drops what was typed without asking and keeps the mode.
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("explain-feedback-text")).toBeNull();
    expect(card.hasAttribute("data-pinned")).toBe(false);
    expect(screen.queryByTestId("explain-card")).not.toBeNull();
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("explain-card")).toBeNull();
  });

  it("on: focus leaving an empty report lets the card go; a written one holds", async () => {
    flags.follow = true;
    const user = userEvent.setup();
    setup();
    await user.tab();
    await user.keyboard("f");
    expect(screen.getByTestId("explain-card").dataset.pinned).toBe("true");
    act(() => screen.getByTestId("toggle-editor").focus());
    expect(screen.queryByTestId("explain-feedback-text")).toBeNull();
    await user.keyboard("fNote");
    act(() => screen.getByTestId("context-ring").focus());
    expect(
      screen.getByTestId<HTMLTextAreaElement>("explain-feedback-text").value,
    ).toBe("Note");
  });
});

describe("placeBeside", () => {
  const card = (w = 320, h = 200) => {
    const el = document.createElement("div");
    Object.defineProperty(el, "offsetWidth", { value: w });
    Object.defineProperty(el, "offsetHeight", { value: h });
    return el;
  };
  const at = (el: HTMLElement) => [
    Number.parseInt(el.style.left, 10),
    Number.parseInt(el.style.top, 10),
  ];
  const part = { x: 80, y: 80, w: 60, h: 30 };
  const reduce = (on: boolean) =>
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({ matches: on && query.includes("reduce") }) as MediaQueryList,
    );

  it("sits below right of the pointer and flips at the edges, flipping back only with room", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1000);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    reduce(false);
    const el = card();
    const side = { current: "" };
    placeBeside(el, part, { x: 100, y: 100 }, false, side, true);
    expect(at(el)).toEqual([118, 122]);
    // Near the right edge it goes left of the pointer…
    placeBeside(el, part, { x: 900, y: 100 }, false, side, false);
    expect(at(el)).toEqual([562, 122]);
    // …and stays left where right would only just fit.
    placeBeside(el, part, { x: 640, y: 100 }, false, side, false);
    expect(el.dataset.placement).toBe("LD");
    placeBeside(el, part, { x: 500, y: 100 }, false, side, false);
    expect(el.dataset.placement).toBe("RD");
    // Near the bottom it goes above the pointer.
    placeBeside(el, part, { x: 100, y: 700 }, false, side, false);
    expect(at(el)).toEqual([118, 486]);
  });

  it("is a sheet at the bottom on a touch screen, at the top when the part is down there", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(390);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    const el = card(374, 200);
    const side = { current: "" };
    placeBeside(el, part, null, true, side, true);
    expect(at(el)).toEqual([8, 592]);
    placeBeside(el, { ...part, y: 650 }, null, true, side, true);
    expect(at(el)).toEqual([8, 8]);
  });

  it("with less motion does not trail within a part, but never stays under the pointer", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1000);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    reduce(true);
    const el = card();
    const side = { current: "" };
    placeBeside(el, part, { x: 100, y: 100 }, false, side, true);
    el.dataset.placed = "Y05";
    vi.spyOn(el, "getBoundingClientRect").mockReturnValue(
      new DOMRect(118, 122, 320, 200),
    );
    placeBeside(el, part, { x: 104, y: 98 }, false, side, false);
    expect(at(el)).toEqual([118, 122]);
    placeBeside(el, part, { x: 200, y: 200 }, false, side, false);
    expect(at(el)).toEqual([218, 222]);
    // A new part places it beside the pointer at once.
    placeBeside(el, part, { x: 60, y: 60 }, false, side, true);
    expect(at(el)).toEqual([78, 82]);
  });
});
