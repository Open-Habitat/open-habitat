import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecapCard } from "./RecapCard";

const recap = {
  recap: "Työ etenee.",
  next: "Tarkista testit",
  through: "two",
  generated_at: 1750000000000,
};
const base = {
  pending: false,
  error: false,
  unavailable: false,
  onRequest: vi.fn(),
};
describe("native conversation recap", () => {
  it("keeps the suggestion separate from transcript and marks a newer turn stale", () => {
    const view = render(<RecapCard {...base} recap={recap} stale={true} />);
    expect(
      view.getByRole("complementary", { name: "Keskustelun yhteenveto" })
        .textContent,
    ).toContain("Työ etenee.");
    expect(
      view.getByText(/Seuraavaksi voisi/).parentElement?.textContent,
    ).toContain("Tarkista testit");
    expect(view.getByText(/Vanha – uusia viestejä/)).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Päivitä katsaus" }));
    expect(base.onRequest).toHaveBeenCalledOnce();
  });
  it("shows generation and failure without duplicating the recap", () => {
    const view = render(
      <RecapCard {...base} recap={null} stale={false} pending={true} />,
    );
    expect(view.getByRole("status").textContent).toContain("Luodaan");
    view.rerender(
      <RecapCard {...base} recap={recap} stale={false} error={true} />,
    );
    expect(view.getAllByRole("alert")[0].textContent).toContain(
      "ei voitu luoda",
    );
    expect(view.getByText("Työ etenee.")).toBeTruthy();
  });
});
