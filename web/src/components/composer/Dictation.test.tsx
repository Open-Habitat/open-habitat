import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DictationView } from "../../app/dictation";
import { DictationBar, type DictationState } from "./Dictation";

const view = (over: Partial<DictationView>): DictationView => ({
  phase: "live",
  final: "",
  interim: "",
  elapsedMs: 6_000,
  level: 0,
  quietMs: 0,
  ...over,
});
const state = (v: DictationView) =>
  ({ view: v, active: true, holding: false }) as unknown as DictationState;

describe("DictationBar", () => {
  afterEach(() => vi.useRealTimers());

  it("draws the microphone's level as a waveform that scrolls in from the right", () => {
    vi.useFakeTimers();
    const bar = render(
      <DictationBar
        dictation={state(view({ level: 0.6 }))}
        onCancel={vi.fn()}
      />,
    );
    const bars = () =>
      Array.from(bar.container.querySelectorAll(".ah-dictation-wave i")).map(
        (i) => (i as HTMLElement).style.transform,
      );
    expect(bars().at(-1)).toBe("scaleY(0.10)");
    act(() => vi.advanceTimersByTime(200));
    expect(bars().at(-1)).toBe("scaleY(0.84)");
    expect(bars().at(0)).toBe("scaleY(0.10)");
    // Finishing: the microphone is closed, so the wave flattens.
    bar.rerender(
      <DictationBar
        dictation={state(view({ phase: "finishing", level: 0.6 }))}
        onCancel={vi.fn()}
      />,
    );
    act(() => vi.advanceTimersByTime(100));
    expect(bars().at(-1)).toBe("scaleY(0.10)");
  });

  it("says it listens while the stream opens, and cancels until it finishes", () => {
    const cancel = vi.fn();
    const bar = render(
      <DictationBar
        dictation={state(view({ phase: "connecting" }))}
        onCancel={cancel}
      />,
    );
    expect(bar.container.textContent).toContain("kuuntelee · yhdistää…");
    fireEvent.click(bar.getByTestId("dictation-cancel"));
    expect(cancel).toHaveBeenCalledOnce();
    bar.rerender(
      <DictationBar
        dictation={state(view({ phase: "finishing" }))}
        onCancel={cancel}
      />,
    );
    expect(
      (bar.getByTestId("dictation-cancel") as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
