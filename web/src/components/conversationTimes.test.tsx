import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { resetLanguageForTests } from "../i18n";
import { setWorkPreference } from "../workPreference";
import { AgentTurn, type TurnStep } from "./AgentTurn";
import {
  dayKind,
  LONG_TURN_SECONDS,
  localDay,
  turnMinutes,
} from "./conversationTimes";

// Times in a conversation (conversation-times): the duration rule Jari chose
// 26.11.2026 (B Vain uusi tieto) and the day a separator names.

beforeEach(() => {
  resetLanguageForTests("fi");
  setWorkPreference("hidden");
});

const t0 = Date.parse("2026-11-23T07:30:00Z");
const s = (seconds: number) => t0 + seconds * 1000;

describe("turnMinutes", () => {
  it("shows no duration on a single-stage turn, whose work row already is it", () => {
    expect(
      turnMinutes({ startedAt: t0, endedAt: s(23 * 60 + 5), stages: 1 }),
    ).toBeUndefined();
  });

  it("starts at five minutes exactly", () => {
    expect(
      turnMinutes({
        startedAt: t0,
        endedAt: s(LONG_TURN_SECONDS - 1),
        stages: 2,
      }),
    ).toBeUndefined();
    expect(
      turnMinutes({ startedAt: t0, endedAt: s(LONG_TURN_SECONDS), stages: 2 }),
    ).toBe(5);
  });

  it("rounds down so it never says more than the work rows", () => {
    expect(
      turnMinutes({ startedAt: t0, endedAt: s(48 * 60 + 59), stages: 4 }),
    ).toBe(48);
    expect(
      turnMinutes({ startedAt: t0, endedAt: s(72 * 60 + 30), stages: 2 }),
    ).toBe(72);
  });

  it("has no duration without both saved ends, or with ends out of order", () => {
    expect(turnMinutes({ endedAt: s(600), stages: 2 })).toBeUndefined();
    expect(turnMinutes({ startedAt: t0, stages: 2 })).toBeUndefined();
    expect(
      turnMinutes({ startedAt: s(600), endedAt: t0, stages: 2 }),
    ).toBeUndefined();
  });
});

describe("day separators", () => {
  const helsinki = "Europe/Helsinki";
  const newYork = "America/New_York";
  // Tuesday 24.11.2026 10.12 in Helsinki.
  const now = Date.parse("2026-11-24T08:12:00Z");

  it("changes day at local midnight", () => {
    const before = Date.parse("2026-11-23T21:59:59Z"); // 23.59.59 Helsinki
    const after = Date.parse("2026-11-23T22:00:00Z"); // 00.00 Helsinki
    expect(localDay(after, helsinki) - localDay(before, helsinki)).toBe(1);
    expect(dayKind(before, now, helsinki)).toBe("yesterday");
    expect(dayKind(after, now, helsinki)).toBe("today");
  });

  it("names the day in the browser's zone, not the server's or UTC's", () => {
    // 01.30 on the 24th in Helsinki, 18.30 on the 23rd in New York.
    const late = Date.parse("2026-11-23T23:30:00Z");
    expect(dayKind(late, now, helsinki)).toBe("today");
    expect(dayKind(late, now, newYork)).toBe("yesterday");
  });

  it("says Eilen only for the day right before today", () => {
    expect(dayKind(Date.parse("2026-11-23T10:00:00Z"), now, helsinki)).toBe(
      "yesterday",
    );
    expect(dayKind(Date.parse("2026-11-22T10:00:00Z"), now, helsinki)).toBe(
      "earlier",
    );
    expect(dayKind(Date.parse("2025-11-23T10:00:00Z"), now, helsinki)).toBe(
      "earlier",
    );
  });
});

const tool = (key: string, at: number): TurnStep => ({
  kind: "tool",
  key,
  at,
  node: <p>{key}</p>,
});
const say = (key: string, at: number): TurnStep => ({
  kind: "text",
  key,
  text: key,
  at,
  node: <p>{key}</p>,
});

describe("AgentTurn with times", () => {
  it("puts a multi-stage turn's duration on its final answer only", () => {
    const view = render(
      <AgentTurn
        times
        startedAt={t0}
        steps={[
          tool("a", s(60)),
          say("interim", s(10 * 60)),
          tool("b", s(40 * 60)),
          say("final", s(48 * 60 + 40)),
        ]}
      />,
    );
    const interim = view.container.querySelector("[data-reply-kind=interim]");
    const final = view.container.querySelector("[data-reply-kind=final]");
    expect(interim?.querySelector("[data-testid=message-time]")).toBeTruthy();
    expect(interim?.querySelector("[data-testid=turn-took]")).toBeNull();
    expect(
      final
        ?.querySelector("[data-testid=message-time] time")
        ?.getAttribute("datetime"),
    ).toBe(new Date(s(48 * 60 + 40)).toISOString());
    expect(
      final?.querySelector("[data-testid=turn-took]")?.textContent,
    ).toMatch(/\b48 min\b/);
  });

  it("gives a single-stage turn its time but no duration", () => {
    const view = render(
      <AgentTurn
        times
        startedAt={t0}
        steps={[tool("a", s(22 * 60)), say("final", s(23 * 60 + 5))]}
      />,
    );
    expect(view.getByTestId("message-time")).toBeTruthy();
    expect(view.queryByTestId("turn-took")).toBeNull();
  });

  it("measures a stopped multi-stage turn to its aborted entry on the stop row", () => {
    const view = render(
      <AgentTurn
        times
        startedAt={t0}
        stopped={{ at: s(8 * 60 + 20) }}
        steps={[
          tool("a", s(3 * 60)),
          say("interim", s(4 * 60)),
          tool("b", s(7 * 60)),
        ]}
      />,
    );
    const stop = view.getByTestId("turn-stopped");
    expect(stop.querySelector("time")?.getAttribute("datetime")).toBe(
      new Date(s(8 * 60 + 20)).toISOString(),
    );
    expect(stop.querySelector("[data-testid=turn-took]")?.textContent).toMatch(
      /\b8 min\b/,
    );
    // The interim reply keeps only its time.
    expect(
      view.container.querySelectorAll("[data-testid=turn-took]"),
    ).toHaveLength(1);
  });

  it("gives a turn stopped mid-tool in its only stage no duration", () => {
    const view = render(
      <AgentTurn
        times
        startedAt={t0}
        stopped={{ at: s(12 * 60 + 31) }}
        steps={[tool("a", s(12 * 60 + 30))]}
      />,
    );
    expect(view.getByTestId("turn-stopped").querySelector("time")).toBeTruthy();
    expect(view.queryByTestId("turn-took")).toBeNull();
  });

  it("treats a restart-cut turn like a stopped one", () => {
    const view = render(
      <AgentTurn
        times
        startedAt={t0}
        stopped={{ at: s(11 * 60 + 10), by: "restart" }}
        steps={[
          tool("a", s(60)),
          say("interim", s(2 * 60)),
          tool("b", s(11 * 60)),
        ]}
      />,
    );
    const stop = view.getByTestId("turn-stopped");
    expect(stop.dataset.by).toBe("restart");
    expect(stop.querySelector("[data-testid=turn-took]")?.textContent).toMatch(
      /\b11 min\b/,
    );
  });

  it("gives a running turn no duration, and the switch off no times at all", () => {
    const steps = [
      tool("a", s(60)),
      say("interim", s(10 * 60)),
      tool("b", s(40 * 60)),
    ];
    const running = render(
      <AgentTurn times working startedAt={t0} steps={steps} />,
    );
    expect(running.queryByTestId("turn-took")).toBeNull();
    running.unmount();
    const off = render(
      <AgentTurn startedAt={t0} stopped={{ at: s(41 * 60) }} steps={steps} />,
    );
    expect(off.queryByTestId("message-time")).toBeNull();
    expect(off.queryByTestId("turn-took")).toBeNull();
  });
});
