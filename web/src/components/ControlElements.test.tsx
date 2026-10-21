import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";

// buttons-no-surface: a button labelled in words gets a surface even when
// quiet; icon-only and lone-symbol controls keep the quiet look.
it("marks only word-labelled buttons as text buttons", () => {
  render(
    <>
      <ControlButton data-testid="word-control" size="row" variant="quiet">
        Päivitä Git-tila
      </ControlButton>
      <ControlButton data-testid="mixed-control" size="row">
        <Icon name="refresh" />
        Yritä uudelleen
      </ControlButton>
      <ControlButton
        size="row"
        data-testid="symbol-control"
        variant="quiet"
        aria-label="Tyhjennä haku"
      >
        ×
      </ControlButton>
      <ControlButton data-testid="icon-control" size="row" aria-label="Päivitä">
        <Icon name="refresh" />
      </ControlButton>
      <ControlButton data-testid="back-control" size="row" presentation="back">
        Takaisin
      </ControlButton>
    </>,
  );
  const text = (id: string) =>
    screen.getByTestId(id).classList.contains("ah-button-text");
  expect(text("word-control")).toBe(true);
  expect(text("mixed-control")).toBe(true);
  expect(text("symbol-control")).toBe(false);
  expect(text("icon-control")).toBe(false);
  expect(text("back-control")).toBe(false);
});
