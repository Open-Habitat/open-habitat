import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelPicker } from "./ModelPicker";

describe("native model observations", () => {
  it("blocks a recent refusal, but permits an old refusal and an untried future family", () => {
    const choose = vi.fn();
    render(
      <ModelPicker
        models={[
          {
            id: "recent",
            name: "Recent",
            outcome: "refused",
            observed_at: new Date().toISOString(),
          },
          {
            id: "old",
            name: "Old",
            outcome: "refused",
            observed_at: "2000-01-01T00:00:00Z",
            older: true,
          },
          { id: "future", name: "Future" },
        ]}
        selected="old"
        onSelect={choose}
      />,
    );
    const recent = screen.getByTestId("model-choice-openai-codex-recent");
    expect((recent as HTMLInputElement).disabled).toBe(true);
    expect(
      screen.getByTestId("model-choice-openai-codex-old").closest("details")
        ?.open,
    ).toBe(true);
    expect(
      (screen.getByTestId("model-choice-openai-codex-old") as HTMLInputElement)
        .disabled,
    ).toBe(false);
    fireEvent.click(screen.getByTestId("model-choice-openai-codex-future"));
    expect(choose).toHaveBeenCalledWith("future");
  });
  it("offers only native supported thinking levels, not a guessed high/xhigh capability", () => {
    const thinking = vi.fn();
    render(
      <ModelPicker
        models={[
          { id: "capped", name: "Capped", thinking_levels: ["off", "low"] },
        ]}
        selected="capped"
        thinking="low"
        onSelect={vi.fn()}
        onThinking={thinking}
      />,
    );
    expect(
      (screen.getByTestId("model-thinking-xhigh") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByTestId("model-thinking-off"));
    expect(thinking).toHaveBeenCalledWith("off");
  });
});
