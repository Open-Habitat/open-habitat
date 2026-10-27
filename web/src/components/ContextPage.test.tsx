import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContextPage, contextView } from "./ContextPage";
import { claudeAfterCompaction, piReading } from "./ContextPage.fixtures";
import type { ContextUsage } from "./ContextRing";

const usage: ContextUsage = {
  phase: "known",
  tokens: 204220,
  window: 272000,
  autoCompaction: true,
  reserve: 16384,
};

describe("contextView", () => {
  it("leaves the gap between Pi's measurement and its estimate unexplained", () => {
    const detail = {
      ...piReading,
      measured_tokens: 100000,
      trailing_tokens: 2000,
      parts: {
        instructions: 10000,
        tools: 0,
        summary: 0,
        conversation: 20000,
        tool_output: 30000,
        attachments: 0,
      },
    };
    const view = contextView(detail, usage);
    // Parts are estimates; the remainder of measured + trailing is its own row.
    expect(view.categories.find((k) => k.key === "rest")?.tokens).toBe(42000);
    expect(view.base).toBe(102000);
    expect(view.threshold).toBe(272000 - 16384);
  });

  it("claims no measurement or gap right after a compaction", () => {
    const view = contextView(claudeAfterCompaction, {
      ...usage,
      phase: "after",
    });
    expect(view.measured).toBeUndefined();
    expect(view.percent).toBeUndefined();
    expect(view.total).toBe(56240);
    expect(view.categories.some((k) => k.key === "rest")).toBe(false);
  });
});

describe("ContextPage", () => {
  it("takes focus on opening and closes on Escape", () => {
    const close = vi.fn();
    render(
      <ContextPage
        detail={{ state: "ready", detail: piReading }}
        usage={usage}
        title="Status-skripti"
        onClose={close}
      />,
    );
    const heading = screen.getByRole("heading", { level: 2 });
    expect(document.activeElement).toBe(heading);
    fireEvent.keyDown(heading, { key: "Escape" });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps an earlier reading visible when a reread fails", () => {
    render(
      <ContextPage
        detail={{ state: "unavailable", detail: piReading }}
        usage={usage}
        title="Status-skripti"
        onClose={() => {}}
      />,
    );
    expect(screen.getByTestId("context-parts")).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
