import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { backgroundExcluded, ModelPicker } from "./ModelPicker";

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
    const recent = screen.getByTestId("model-recent");
    expect((recent as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByTestId("model-old").closest("details")?.open).toBe(true);
    expect((screen.getByTestId("model-old") as HTMLInputElement).disabled).toBe(
      false,
    );
    fireEvent.click(screen.getByTestId("model-future"));
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
      (screen.getByTestId("segment-xhigh") as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByTestId("segment-off"));
    expect(thinking).toHaveBeenCalledWith("off");
  });
});

describe("background use (Tilannekatsaus › Malli)", () => {
  it("offers Automaattinen first and refuses Fable and Opus classes", () => {
    const choose = vi.fn();
    const automatic = vi.fn();
    render(
      <ModelPicker
        models={[
          { id: "claude-opus-5-5", name: "Opus 5.5" },
          { id: "proxy", name: "Fable via proxy" },
          { id: "claude-sonnet-5-5", name: "Sonnet 5.5" },
        ]}
        selected="claude-sonnet-5-5"
        onSelect={choose}
        unavailable={(m) => (backgroundExcluded(m) ? "x" : undefined)}
        auto={{ detail: "", selected: true, onSelect: automatic }}
      />,
    );
    const auto = screen.getByTestId("model-automatic") as HTMLInputElement;
    expect(auto.checked).toBe(true);
    // Automatic is the choice, so the model it now picks is not checked.
    expect(
      (screen.getByTestId("model-claude-sonnet-5-5") as HTMLInputElement)
        .checked,
    ).toBe(false);
    for (const id of ["claude-opus-5-5", "proxy"])
      expect(
        (screen.getByTestId(`model-${id}`) as HTMLInputElement).disabled,
      ).toBe(true);
    fireEvent.click(screen.getByTestId("model-claude-sonnet-5-5"));
    expect(choose).toHaveBeenCalledWith("claude-sonnet-5-5");
  });
});
