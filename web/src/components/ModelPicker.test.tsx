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
    const recent = screen.getByRole("radio", { name: /Recent/ });
    expect((recent as HTMLInputElement).disabled).toBe(true);
    expect(
      screen.getByRole("radio", { name: /Old/ }).closest("details")?.open,
    ).toBe(true);
    expect(
      (screen.getByRole("radio", { name: /Old/ }) as HTMLInputElement).disabled,
    ).toBe(false);
    fireEvent.click(screen.getByRole("radio", { name: /Future/ }));
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
      (screen.getByRole("button", { name: "xhigh" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "off" }));
    expect(thinking).toHaveBeenCalledWith("off");
  });
});
