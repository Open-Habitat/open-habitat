import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContextRing, type ContextUsage } from "./ContextRing";

const usage = (tokens: number, extra: Partial<ContextUsage> = {}) =>
  ({
    phase: "known",
    tokens,
    window: 100000,
    autoCompaction: true,
    reserve: 16384,
    ...extra,
  }) as ContextUsage;
const level = () => screen.getByTestId("context-ring").dataset.level;

describe("ContextRing", () => {
  it("uses Pi's footer thresholds and needs a window for a share", () => {
    const { rerender } = render(<ContextRing usage={usage(69999)} />);
    expect(level()).toBe("ok");
    rerender(<ContextRing usage={usage(70000)} />);
    expect(level()).toBe("near");
    rerender(<ContextRing usage={usage(90000)} />);
    expect(level()).toBe("critical");
    rerender(<ContextRing usage={usage(90000, { window: undefined })} />);
    expect(level()).toBe("nowindow");
  });

  it("speaks a change toward the limit, not the first reading", () => {
    const { rerender } = render(<ContextRing usage={usage(95000)} />);
    const status = screen.getByTestId("context-announcement");
    expect(status.textContent).toBe("");
    rerender(<ContextRing usage={usage(95000, { phase: "compacting" })} />);
    expect(status.textContent).not.toBe("");
    rerender(<ContextRing usage={{ phase: "after", window: 100000 }} />);
    const after = status.textContent;
    rerender(<ContextRing usage={usage(31600)} />);
    // The first reading after a compaction is spoken too.
    expect(status.textContent).not.toBe(after);
  });
});
