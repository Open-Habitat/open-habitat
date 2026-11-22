import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { type RailPlace, RailPlaces, type RailSearch } from "./AdaptiveRail";
import type { Step } from "./railAllocation";

const places: RailPlace[] = [
  { id: "home", testId: "home-link", label: "Etusivu", href: "/workspaces" },
  { id: "shares", testId: "rail-shares", label: "Tuotokset", href: "/shares" },
  {
    id: "browser",
    testId: "browser-rail-row",
    label: "Oma selain",
    onOpen: () => {},
    state: "agent",
    stateText: "agentti",
    said: "Oma selain, agentti käyttää",
  },
];
const search: RailSearch = {
  label: "Hae",
  keyHint: "Ctrl+K",
  onOpen: () => {},
};
const view = (step: Step) => (
  <MemoryRouter>
    <RailPlaces step={step} places={places} search={search} />
  </MemoryRouter>
);

describe("the adaptive rail's places", () => {
  // Each step draws its own controls; the keyboard keeps its place when the
  // height moves the step under it.
  for (const [from, to] of [
    [0, 1],
    [1, 2],
    [2, 0],
  ] as const)
    for (const id of ["home-link", "browser-rail-row", "search-door"])
      it(`keeps focus on ${id} from step ${from} to ${to}`, () => {
        const { rerender } = render(view(from));
        screen.getByTestId(id).focus();
        rerender(view(to));
        expect(document.activeElement).toBe(screen.getByTestId(id));
      });

  it("leaves focus alone when it was elsewhere", () => {
    const { rerender } = render(
      <>
        <button type="button" data-testid="outside" />
        {view(0)}
      </>,
    );
    screen.getByTestId("outside").focus();
    rerender(
      <>
        <button type="button" data-testid="outside" />
        {view(2)}
      </>,
    );
    expect(document.activeElement).toBe(screen.getByTestId("outside"));
  });
});
