import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { AgentTurn, ThinkingRow } from "./AgentTurn";

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

it("keeps the reply visible when work folds and prevents folding during work", () => {
  const view = render(
    <AgentTurn
      work={<p>työ</p>}
      reply={<p>vastaus</p>}
      thinkingCount={1}
      toolCount={2}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /PI · 1 ajatusta/ }));
  expect(view.queryByText("työ")).toBeNull();
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
  expect(screen.getByRole("button", { name: /PI/ })).toHaveProperty(
    "disabled",
    true,
  );
});
