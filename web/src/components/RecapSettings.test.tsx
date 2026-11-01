import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  RecapSettings,
  type RecapSettingsValue,
  recapLevel,
  recapLevels,
} from "./RecapSettings";

const standard: RecapSettingsValue = {
  level: "standard",
  delay_seconds: 180,
  model: null,
  ...recapLevels.standard,
};

function renderSettings(value: RecapSettingsValue) {
  const onChange = vi.fn();
  render(<RecapSettings value={value} modelField={null} onChange={onChange} />);
  return onChange;
}

describe("Tilannekatsaus levels", () => {
  it.each(["short", "standard", "thorough"] as const)(
    "selected On preserves the %s preset",
    (level) => {
      const onChange = renderSettings({
        ...standard,
        ...recapLevels[level],
        level,
      });
      fireEvent.click(
        within(screen.getByTestId("recap-automatic")).getByTestId("segment-on"),
      );
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it("a level whose numbers no longer match it is Oma", () => {
    expect(recapLevel(standard)).toBe("standard");
    expect(recapLevel({ ...standard, words: 45 })).toBe("custom");
    expect(recapLevel({ ...standard, level: "custom" })).toBe("custom");
  });

  it("choosing a level writes its numbers, keeping delay and model", () => {
    const onChange = renderSettings({
      ...standard,
      delay_seconds: 300,
      model: "claude-bridge/claude-sonnet-5-5",
    });
    fireEvent.click(
      within(screen.getByTestId("recap-level")).getByTestId("segment-short"),
    );
    expect(onChange).toHaveBeenCalledWith({
      level: "short",
      delay_seconds: 300,
      model: "claude-bridge/claude-sonnet-5-5",
      ...recapLevels.short,
    });
  });

  it("numbers are editable only in Oma, and changing one leaves the level", () => {
    renderSettings(standard);
    expect(screen.queryByTestId("recap-words")).toBeNull();
    cleanup();
    const onChange = renderSettings({ ...standard, level: "custom" });
    fireEvent.click(screen.getByTestId("recap-words-more"));
    expect(onChange).toHaveBeenCalledWith({
      ...standard,
      level: "custom",
      words: 45,
    });
  });

  it("warns before a response limit cuts the recap short", () => {
    renderSettings({ ...standard, level: "custom", response_tokens: 128 });
    expect(screen.getByTestId("recap-response-warning")).toBeTruthy();
  });
});
