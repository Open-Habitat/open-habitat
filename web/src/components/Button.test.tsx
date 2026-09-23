import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
describe("Button", () => {
  it("uses the shared accessible control", () => {
    const press = vi.fn();
    const view = render(<Button label="Jatka" onPress={press} />);
    fireEvent.click(view.getByRole("button", { name: "Jatka" }));
    expect(press).toHaveBeenCalledOnce();
  });
  it("shows a disabled reason", () => {
    const view = render(
      <Button
        label="Lähetä"
        availability={{ state: "disabled", reason: "Yhteys puuttuu" }}
        onPress={() => {}}
      />,
    );
    expect(view.getByText("Yhteys puuttuu")).toBeTruthy();
    expect((view.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
});
