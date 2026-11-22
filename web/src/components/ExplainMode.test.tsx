import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExplainMode, readSituation } from "./ExplainMode";
import { start, stop } from "./explainModeState";

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
  vi.restoreAllMocks();
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
