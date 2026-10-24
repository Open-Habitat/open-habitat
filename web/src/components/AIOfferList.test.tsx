import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { expect, it } from "vitest";
import type { AIOffer } from "../app/onboardingConfig";
import {
  AIOfferList,
  type AIOption,
  aiOptionCatalog,
  suggestionOf,
} from "./AIOfferList";

const all = aiOptionCatalog.map((o) => o.id);

function Harness({
  offer,
  subscriptionsOnly,
}: {
  offer: AIOffer;
  subscriptionsOnly?: boolean;
}) {
  const [choice, setChoice] = useState<AIOption>(
    suggestionOf(offer)?.id ?? "chatgpt",
  );
  return (
    <AIOfferList
      offer={offer}
      choice={choice}
      onChoose={setChoice}
      subscriptionsOnly={subscriptionsOnly}
      keep={(o) => !o.key}
      body={(o) => <input data-testid={`body-${o.id}`} aria-label={o.id} />}
    />
  );
}

// The rows a person can see: not inside the folded-away others.
const shown = () =>
  screen
    .getAllByRole("listitem")
    .filter((li) => !li.closest("[hidden]"))
    .map((li) => li.dataset.testid?.replace("ai-option-", ""));
const expanded = (id: string) =>
  screen.getByTestId(`ai-option-${id}-choose`).getAttribute("aria-expanded");

it("offers every option side by side when the person chooses", () => {
  render(<Harness offer="all" />);
  expect(shown()).toEqual(all);
  expect(screen.queryByTestId("ai-others-toggle")).toBeNull();
  expect(screen.queryByTestId("ai-suggestion")).toBeNull();
  expect(expanded("chatgpt")).toBe("true");
});

it("treats a site key as no suggestion", () => {
  // The step shows despite a site key only when the person's Pi has no
  // usable credential; then every option is offered.
  render(<Harness offer="site_key" />);
  expect(shown()).toEqual(all);
});

for (const offer of all)
  it(`offers ${offer} alone, open, and reveals the others`, () => {
    render(<Harness offer={offer} />);
    expect(shown()).toEqual([offer]);
    expect(expanded(offer)).toBe("true");
    expect(
      within(screen.getByTestId(`ai-option-${offer}`)).getByTestId(
        "ai-suggestion",
      ),
    ).toBeTruthy();
    const toggle = screen.getByTestId("ai-others-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    // The suggestion first, then the others in the catalog's order.
    expect(shown()).toEqual([offer, ...all.filter((id) => id !== offer)]);
    expect(screen.getAllByTestId("ai-suggestion")).toHaveLength(1);
  });

it("switches to another service and folds back to the suggestion", () => {
  render(<Harness offer="anthropic_key" />);
  fireEvent.click(screen.getByTestId("ai-others-toggle"));
  fireEvent.click(screen.getByTestId("ai-option-claude-choose"));
  expect(expanded("claude")).toBe("true");
  expect(expanded("anthropic_key")).toBe("false");
  // A key field exists only while its row is open.
  expect(screen.queryByTestId("body-anthropic_key")).toBeNull();
  // Folding the others away does not leave the chosen row out of sight.
  fireEvent.click(screen.getByTestId("ai-others-toggle"));
  expect(shown()).toEqual(["anthropic_key"]);
  expect(expanded("anthropic_key")).toBe("true");
  // A subscription sign-in stays mounted while its row is folded away, so an
  // attempt in progress survives.
  expect(screen.getByTestId("body-claude")).toBeTruthy();
});

it("leaves the keys out of a subscription sign-in", () => {
  render(<Harness offer="all" subscriptionsOnly />);
  expect(shown()).toEqual(["chatgpt", "claude"]);
  // A key suggestion it cannot carry becomes the plain list.
  render(<Harness offer="deepseek_key" subscriptionsOnly />);
  expect(screen.queryByTestId("ai-others-toggle")).toBeNull();
});
