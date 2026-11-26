import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SoundStatus, SoundSummary } from "./SoundStatus";

afterEach(cleanup);
const actions = {
  onEnable: vi.fn(),
  onUnmute: vi.fn(),
  onDisableNight: vi.fn(),
  onEditNight: vi.fn(),
};
describe("all active sound reasons", () => {
  it.each([
    [false, false, false, []],
    [true, false, false, ["off"]],
    [false, true, false, ["muted"]],
    [false, false, true, ["night"]],
    [true, true, false, ["off", "muted"]],
    [true, false, true, ["off", "night"]],
    [false, true, true, ["muted", "night"]],
    [true, true, true, ["off", "muted", "night"]],
  ] as const)("off=%s muted=%s night=%s", (off, muted, night, expected) => {
    render(
      <SoundStatus
        off={off}
        muted={muted}
        night={night}
        nightStart={22}
        nightEnd={7}
        writable
        {...actions}
      />,
    );
    expect(
      screen
        .queryAllByRole("listitem")
        .map((el) => el.getAttribute("data-testid")),
    ).toEqual(expected.map((id) => `sound-reason-${id}`));
    expect(screen.queryAllByRole("status")).toHaveLength(
      expected.length ? 1 : 0,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(
      expected.length + Number(night),
    );
  });
  it("keeps local unmute and navigation available while account writes are busy", () => {
    render(
      <SoundStatus
        off
        muted
        night
        nightStart={22}
        nightEnd={7}
        writable={false}
        {...actions}
      />,
    );
    expect(screen.getByTestId("sound-fix-off").hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.getByTestId("sound-night-off").hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.getByTestId("sound-fix-muted").hasAttribute("disabled")).toBe(
      false,
    );
    expect(
      screen.getByTestId("sound-night-settings").hasAttribute("disabled"),
    ).toBe(false);
  });
});

describe("the account menu's sound summary", () => {
  it.each([
    [false, false, false, null],
    [true, false, false, "Pois kaikilta laitteilta"],
    [false, true, false, "Tämä laite on mykistetty"],
    [false, false, true, "Yö, hiljaa klo 22.00–7.00"],
    [true, true, true, "Pois kaikilta laitteilta"],
    [false, true, true, "Yö, hiljaa klo 22.00–7.00"],
  ] as const)(
    "off=%s muted=%s night=%s shows only the main reason",
    (off, muted, night, expected) => {
      const onDetails = vi.fn();
      render(
        <SoundSummary
          off={off}
          muted={muted}
          night={night}
          nightStart={22}
          nightEnd={7}
          onDetails={onDetails}
        />,
      );
      const summary = screen.queryByTestId("sound-summary");
      if (expected === null) {
        expect(summary).toBeNull();
        return;
      }
      expect(screen.getByTestId("sound-summary-reason").textContent).toBe(
        expected,
      );
      // No list of reasons and no fix buttons: the details live in Settings.
      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
      expect(screen.getAllByRole("button")).toHaveLength(1);
      fireEvent.click(screen.getByTestId("sound-menu-details"));
      expect(onDetails).toHaveBeenCalledOnce();
    },
  );
});
