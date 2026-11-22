import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SoundStatus } from "./SoundStatus";

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
