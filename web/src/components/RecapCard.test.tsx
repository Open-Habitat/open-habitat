import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecapCard, useMinuteNow } from "./RecapCard";

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
  it("keeps the suggestion separate from transcript and requests a refresh", () => {
    const view = render(<RecapCard {...base} recap={recap} />);

    expect(view.getByRole("complementary").textContent).toContain(
      "Työ etenee.",
    );
    expect(view.getByText("Tarkista testit")).toBeTruthy();

    fireEvent.click(view.getByTestId("recap-refresh"));
    expect(base.onRequest).toHaveBeenCalledOnce();
  });
  it("keeps the last known recap visible when its native freshness cannot be checked", () => {
    const view = render(
      <RecapCard {...base} recap={recap} unverifiable={true} />,
    );
    expect(view.getByText("Työ etenee.")).toBeTruthy();
    expect(view.getByRole("alert")).toBeTruthy();

    view.rerender(<RecapCard {...base} recap={recap} uncertain={true} />);
    expect(view.getByRole("alert")).toBeTruthy();
  });
  it("shows generation and failure without duplicating the recap", () => {
    const view = render(<RecapCard {...base} recap={null} pending={true} />);
    expect(view.getByRole("status")).toBeTruthy();
    view.rerender(<RecapCard {...base} recap={recap} error={true} />);
    expect(view.getAllByRole("alert")).toHaveLength(1);
    expect(view.getByText("Työ etenee.")).toBeTruthy();
  });
  it("dismisses and keeps a disabled refresh visible during a running turn", () => {
    const close = vi.fn();
    const view = render(
      <RecapCard
        {...base}
        recap={{ ...recap, trigger: "automatic" }}
        unavailable
        unavailableReason="Odota agentin vuoron päättymistä."
        onDismiss={close}
      />,
    );

    expect(view.getByTestId("recap-refresh")).toHaveProperty("disabled", true);
    fireEvent.click(view.getByTestId("recap-dismiss"));
    expect(close).toHaveBeenCalledOnce();
  });
  it("counts from the latest native message, not from the recap", () => {
    const latestAt = new Date(recap.generated_at - 50 * 60000).toISOString();
    const view = render(
      <RecapCard {...base} recap={recap} latestAt={latestAt} />,
    );
    const age = view.getByTestId("recap-age");
    expect(age.textContent).toBe("1 t sitten");
    expect(age.getAttribute("datetime")).toBe(latestAt);
    view.rerender(<RecapCard {...base} recap={recap} latestAt={null} />);
    expect(view.queryByTestId("recap-age")).toBeNull();
  });
  it("moves the age on as time passes", () => {
    vi.useFakeTimers({ now: recap.generated_at });
    try {
      const latestAt = new Date(recap.generated_at).toISOString();
      function Ticking() {
        return (
          <RecapCard
            {...base}
            recap={recap}
            latestAt={latestAt}
            now={useMinuteNow()}
          />
        );
      }
      const view = render(<Ticking />);
      expect(view.getByTestId("recap-age").textContent).toBe("juuri nyt");
      act(() => vi.advanceTimersByTime(3 * 60000));
      expect(view.getByTestId("recap-age").textContent).toBe("3 min sitten");
    } finally {
      vi.useRealTimers();
    }
  });
});
