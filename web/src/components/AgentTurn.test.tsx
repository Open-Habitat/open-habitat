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
  expect(
    await screen.findByText("Yhteenveto", {}, { timeout: 10000 }),
  ).toHaveProperty("tagName", "STRONG");
  expect(view.queryByText("Toinen")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Ajattelu · Ensimmäinen" }),
  );
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

it.each([
  "**Summary**\n\nBody with **other emphasis**",
  "\r\n  **Summary**  \r\n\r\nBody with **other emphasis**",
])(
  "moves only a standalone leading bold heading into the toggle: %s",
  async (text) => {
    const view = render(<ThinkingRow text={text} />);
    const toggle = screen.getByRole("button", { name: "Ajattelu · Summary" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(view.queryByText("other emphasis")).toBeNull();
    fireEvent.click(toggle);
    expect(
      await screen.findByText("other emphasis", {}, { timeout: 10000 }),
    ).toHaveProperty("tagName", "STRONG");
    expect(
      view.container.querySelector("blockquote")?.textContent,
    ).not.toContain("Summary");
  },
);

it.each([
  [
    "**Not a heading** followed by body\nSecond line",
    "Not a heading followed by body",
  ],
  [
    "**Not a heading** followed by **more emphasis**\nSecond line",
    "Not a heading followed by more emphasis",
  ],
  ["An introduction\n\n**Later heading**\nBody", "An introduction"],
  ["**Unfinished heading\nBody", "Unfinished heading"],
])(
  "previews an inline, later or unfinished heading's first line without moving it: %s",
  async (text, preview) => {
    const view = render(<ThinkingRow text={text} />);
    fireEvent.click(
      screen.getByRole("button", { name: `Ajattelu · ${preview}` }),
    );
    expect(await view.findByText(/Body|Second line/)).toBeTruthy();
    // The previewed line stays in the reasoning itself.
    expect(view.container.querySelector("blockquote")?.textContent).toContain(
      preview.split(" ")[0],
    );
  },
);

it("titles untitled (Claude-shaped) reasoning with its first line; titled (OpenAI-shaped) unchanged", () => {
  const long = `The user wants me to check ${"why the build fails on macOS and ".repeat(5)}what to do.`;
  render(
    <>
      <ThinkingRow
        text={
          "**Interpreting extension messages**\n\nThe extension sends a frame."
        }
      />
      <ThinkingRow
        text={
          "\n  The user is asking about `go test` failures.\nLet me look at the CI log.\n\nSecond paragraph."
        }
      />
      <ThinkingRow text={`${long}\nNext line`} />
      <ThinkingRow text={"- First, read the config\n- Then run it"} />
    </>,
  );
  expect(
    screen.getByRole("button", {
      name: "Ajattelu · Interpreting extension messages",
    }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", {
      name: "Ajattelu · The user is asking about go test failures.",
    }),
  ).toBeTruthy();
  const truncated = screen.getByRole("button", {
    name: /^Ajattelu · The user wants/,
  });
  const label = truncated.getAttribute("aria-label") ?? "";
  expect(label.endsWith("…")).toBe(true);
  expect(label.length).toBeLessThanOrEqual("Ajattelu · ".length + 120);
  expect(
    screen.getByRole("button", { name: "Ajattelu · First, read the config" }),
  ).toBeTruthy();
});

it("never exposes redacted reasoning or extracts a title from a live delta", async () => {
  const view = render(
    <ThinkingRow text={"**Secret**\nHidden body"} redacted />,
  );
  expect(view.container.textContent).toBe("Ajattelu · piilotettu");
  view.rerender(
    <ThinkingRow text={"**Streaming heading**\nCurrent line"} live />,
  );
  expect(await screen.findByText("Current line")).toBeTruthy();
  expect(view.queryByText("Streaming heading")).toBeNull();
});
