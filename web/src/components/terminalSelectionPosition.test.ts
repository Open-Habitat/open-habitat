import { describe, expect, it } from "vitest";
import { terminalSelectionPosition as place } from "./terminalSelectionPosition";

const panel = { width: 400, height: 240 };
const toolbar = { width: 220, height: 36 };
describe("terminal selection actions", () => {
  it("sits above the first selected row, not the last row", () => {
    expect(place({ top: 100, bottom: 220, left: 12 }, panel, toolbar)).toEqual({
      top: 60,
      left: 12,
    });
  });
  it("uses the bottom of all selected rows near the top edge", () => {
    expect(place({ top: 8, bottom: 68, left: 12 }, panel, toolbar)).toEqual({
      top: 72,
      left: 12,
    });
  });
  it("keeps a bottom-edge single-line selection unobscured", () => {
    expect(place({ top: 216, bottom: 236, left: 390 }, panel, toolbar)).toEqual(
      { top: 176, left: 176 },
    );
  });
  it("clamps horizontally on either side", () => {
    expect(
      place({ top: 100, bottom: 120, left: -30 }, panel, toolbar).left,
    ).toBe(4);
    expect(
      place({ top: 100, bottom: 120, left: 900 }, panel, toolbar).left,
    ).toBe(176);
  });
  it("uses the header when neither side has room, rather than covering a row", () => {
    expect(place({ top: -100, bottom: 500, left: 0 }, panel, toolbar)).toEqual({
      top: -40,
      left: 4,
    });
    expect(place(undefined, panel, toolbar)).toEqual({ top: -40, left: 4 });
  });
  it("measures taller toolbars instead of assuming a fixed height", () => {
    expect(
      place({ top: 60, bottom: 100, left: 20 }, panel, {
        width: 200,
        height: 60,
      }),
    ).toEqual({ top: 104, left: 20 });
  });
});
