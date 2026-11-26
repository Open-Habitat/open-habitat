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

  it("shows listening only once the microphone captures, and cancels until it finishes", () => {
    const cancel = vi.fn();
    const bar = render(
      <DictationBar
        dictation={state(view({ phase: "connecting" }))}
        onCancel={cancel}
      />,
    );
    // While the microphone opens, nothing said is heard yet.
    const listening = () =>
      bar.getByTestId("dictation-bar").getAttribute("data-listening");
    expect(listening()).toBe("false");
    // Captured audio waits for the stream, so live is listening already.
    bar.rerender(
      <DictationBar
        dictation={state(view({ phase: "live" }))}
        onCancel={cancel}
      />,
    );
    expect(listening()).toBe("true");
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
