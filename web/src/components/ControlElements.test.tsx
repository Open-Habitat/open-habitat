import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

// buttons-no-surface: a button labelled in words gets a surface even when
// quiet; icon-only and lone-symbol controls keep the quiet look.
it("marks only word-labelled buttons as text buttons", () => {
  render(
    <>
      <ControlButton size="row" variant="quiet">
        Päivitä Git-tila
      </ControlButton>
      <ControlButton size="row">
        <Icon name="refresh" />
        Yritä uudelleen
      </ControlButton>
      <ControlButton size="row" variant="quiet" aria-label="Tyhjennä haku">
        ×
      </ControlButton>
      <ControlButton size="row" aria-label="Päivitä">
        <Icon name="refresh" />
      </ControlButton>
      <ControlButton size="row" presentation="back">
        Takaisin
      </ControlButton>
    </>,
  );
  const text = (name: string) =>
    screen.getByRole("button", { name }).classList.contains("ah-button-text");
  expect(text("Päivitä Git-tila")).toBe(true);
  expect(text("Yritä uudelleen")).toBe(true);
  expect(text("Tyhjennä haku")).toBe(false);
  expect(text("Päivitä")).toBe(false);
  expect(text("Takaisin")).toBe(false);
});
