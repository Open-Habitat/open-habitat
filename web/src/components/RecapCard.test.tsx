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
  now: recap.generated_at + 10 * 60000,
};
describe("native conversation recap", () => {
  it("keeps the suggestion separate from transcript and marks a newer turn stale", () => {
    const view = render(<RecapCard {...base} recap={recap} stale={true} />);
    // The card leads with its own heading; no waiting/activity label above it.
    const card = view.getByRole("complementary", {
      name: "Keskustelun yhteenveto",
    });
    expect(card.firstElementChild?.textContent).toMatch(/^Tilannekatsaus/);
    expect(card.textContent).not.toMatch(/Odottaa sinua/);
    expect(
      view.getByRole("complementary", { name: "Keskustelun yhteenveto" })
        .textContent,
    ).toContain("Työ etenee.");
    expect(view.getByText(/Seuraavaksi/).parentElement?.textContent).toContain(
      "Tarkista testit",
    );
    expect(view.getByText(/uusia viestejä/)).toBeTruthy();
    expect(view.getByText("10 min sitten")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Päivitä katsaus" }));
    expect(base.onRequest).toHaveBeenCalledOnce();
  });
  it("keeps the last known recap visible when its native freshness cannot be checked", () => {
    const view = render(
      <RecapCard {...base} recap={recap} stale={false} unverifiable={true} />,
    );
    expect(view.getByText("Työ etenee.")).toBeTruthy();
    expect(view.getByText("ajantasaisuus ei tiedossa")).toBeTruthy();
    expect(view.getByRole("alert").textContent).toContain("ei voitu tarkistaa");
    view.rerender(
      <RecapCard {...base} recap={recap} stale={false} uncertain={true} />,
    );
    expect(view.getByRole("alert").textContent).toContain(
      "tulos ei ole tiedossa",
    );
  });
  it("shows generation and failure without duplicating the recap", () => {
    const view = render(
      <RecapCard {...base} recap={null} stale={false} pending={true} />,
    );
    expect(
      view.getByRole("status", { name: "Luodaan katsausta" }),
    ).toBeTruthy();
    view.rerender(
      <RecapCard {...base} recap={recap} stale={false} error={true} />,
    );
    expect(view.getAllByRole("alert")[0].textContent).toContain(
      "ei voitu luoda",
    );
    expect(view.getByText("Työ etenee.")).toBeTruthy();
  });
  it("dismisses and keeps a disabled refresh visible during a running turn", () => {
    const close = vi.fn();
    const view = render(
      <RecapCard
        {...base}
        recap={{ ...recap, trigger: "automatic" }}
        stale={false}
        unavailable
        unavailableReason="Odota agentin vuoron päättymistä."
        onDismiss={close}
      />,
    );
    expect(view.getByText("luotu automaattisesti")).toBeTruthy();
    expect(
      view.getByRole("button", { name: "Päivitä katsaus" }),
    ).toHaveProperty("disabled", true);
    fireEvent.click(view.getByRole("button", { name: "Sulje katsaus" }));
    expect(close).toHaveBeenCalledOnce();
  });
});
