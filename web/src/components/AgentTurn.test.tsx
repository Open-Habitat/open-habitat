import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { setWorkPreference } from "../workPreference";
import { AgentTurn, ThinkingRow } from "./AgentTurn";

beforeEach(() => setWorkPreference("hidden"));

it("renders single-line Markdown directly and opens multi-line thinking only on demand", async () => {
  const view = render(
    <>
      <ThinkingRow text="**Yhteenveto**" />
      <ThinkingRow text={"Ensimmäinen\nToinen"} />
    </>,
  );
  expect(await screen.findByText("Yhteenveto")).toHaveProperty(
    "tagName",
    "STRONG",
  );
  expect(view.queryByText("Toinen")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ajattelu" }));
  expect(await screen.findByText(/Toinen/)).toBeTruthy();
});

it("starts settled work closed and keeps the reply visible while work toggles", () => {
  const view = render(
    <AgentTurn
      work={<p>työ</p>}
      reply={<p>vastaus</p>}
      thinkingCount={1}
      toolCount={2}
    />,
  );
  expect(view.queryByText("työ")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /PI · 1 ajatusta/ }));
  expect(view.getByText("työ")).toBeTruthy();
  expect(view.getByText("vastaus")).toBeTruthy();
  view.rerender(
    <AgentTurn
      working
      work={<p>työ</p>}
      reply={<p>vastaus</p>}
      thinkingCount={1}
      toolCount={2}
    />,
  );
  const button = screen.getByRole("button", { name: "Piilota työ" });
  expect(button).toBeTruthy();
  fireEvent.click(button);
  expect(view.queryByText("työ")).toBeNull();
});

it("retains the reader's fold choice across streaming updates and settlement", () => {
  const turn = (working: boolean, activity: string) => (
    <AgentTurn
      working={working}
      activity={activity}
      duration="0:02"
      thinkingCount={1}
      toolCount={1}
      work={<p>työ</p>}
      reply={<p>vastaus</p>}
    />
  );
  const view = render(turn(true, "Ajattelee"));
  const button = screen.getByRole("button", { name: "Näytä työ" });
  view.rerender(turn(true, "Ajaa bash"));
  expect(screen.getByRole("button", { name: "Näytä työ" })).toBe(button);
  fireEvent.click(button);
  view.rerender(turn(true, "Vastaa"));
  expect(screen.getByRole("button", { name: "Piilota työ" })).toBe(button);
  view.rerender(turn(false, ""));
  expect(view.getByText("työ")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /PI · 1 ajatusta/ }));
  view.rerender(turn(false, ""));
  expect(view.queryByText("työ")).toBeNull();
});
