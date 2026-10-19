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

const work = (key: string, text: string, kind: "thinking" | "tool" = "tool") =>
  kind === "tool"
    ? ({ kind, key, target: text, node: <p>{`työssä ${text}`}</p> } as const)
    : ({ kind, key, node: <p>{`työssä ${text}`}</p> } as const);
const say = (key: string, text: string) =>
  ({ kind: "text", key, text, node: <p>{text}</p> }) as const;

it("has no turn head; a stage row replaces it and the answer keeps its model", () => {
  const view = render(
    <AgentTurn
      model="claude-opus-5-5"
      steps={[
        work("t", "pohdinta", "thinking"),
        work("a", "git status"),
        work("b", "git log"),
        say("f", "vastaus"),
      ]}
    />,
  );
  expect(view.queryByText(/^PI/)).toBeNull();
  const row = screen.getByRole("button", {
    name: "1 ajatus · 2 työkalua · git log",
  });
  expect(row.getAttribute("aria-expanded")).toBe("false");
  expect(view.queryByText("työssä git status")).toBeNull();
  expect(view.getByText("Vastaus valmis")).toBeTruthy();
  expect(view.getByText("claude-opus-5-5")).toBeTruthy();
  fireEvent.click(row);
  expect(row.getAttribute("aria-expanded")).toBe("true");
  expect(view.getByText("työssä git status")).toBeTruthy();
  expect(view.getByText("vastaus")).toBeTruthy();
});

it("shows each interim reply as its own card and opens only its stage", () => {
  const view = render(
    <AgentTurn
      model="m"
      steps={[
        work("a", "eka"),
        say("s1", "välivastaus yksi"),
        work("b", "toka", "thinking"),
        work("c", "kolmas"),
        say("s2", "välivastaus kaksi"),
        say("f", "lopullinen"),
      ]}
    />,
  );
  // The interim reply right before the answer closes a stage without work.
  const rows = view.getAllByRole("button", { expanded: false });
  expect(rows.map((row) => row.textContent)).toEqual([
    "1 työkalu · eka",
    "1 ajatus · 1 työkalu · kolmas",
  ]);
  expect(view.getAllByText("Välivastaus")).toHaveLength(2);
  expect(view.getAllByText("Vastaus valmis")).toHaveLength(1);
  // The model appears only on the final answer.
  expect(view.getAllByText("m")).toHaveLength(1);
  fireEvent.click(rows[1]);
  expect(view.getByText("työssä toka")).toBeTruthy();
  expect(view.queryByText("työssä eka")).toBeNull();
  for (const text of ["välivastaus yksi", "välivastaus kaksi", "lopullinen"])
    expect(view.getByText(text)).toBeTruthy();
});

it("names failures in the stage row and treats trailing work as no answer", () => {
  const view = render(
    <AgentTurn
      steps={[
        say("s", "aloitan"),
        {
          kind: "tool",
          key: "a",
          target: "npm test",
          failed: true,
          node: null,
        },
      ]}
    />,
  );
  expect(
    screen.getByRole("button", {
      name: "1 työkalu · 1 epäonnistui · npm test",
    }),
  ).toBeTruthy();
  expect(view.getByText("Välivastaus")).toBeTruthy();
  expect(view.queryByText("Vastaus valmis")).toBeNull();
});

it("shows the running stage as the information row and streams the latest text", () => {
  const view = render(
    <AgentTurn
      working
      activity="Ajaa git pull"
      duration="0:31"
      steps={[
        work("a", "git status"),
        say("s1", "välivastaus"),
        work("b", "git pull"),
      ]}
    />,
  );
  expect(screen.getByRole("status").textContent).toContain("Ajaa git pull");
  // The finished stage has its row; the running one is behind Näytä työ.
  expect(
    screen.getByRole("button", { name: "1 työkalu · git status" }),
  ).toBeTruthy();
  expect(view.queryByText("työssä git pull")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Näytä työ" }));
  expect(view.getByText("työssä git pull")).toBeTruthy();
  expect(view.queryByText("työssä git status")).toBeNull();
  view.rerender(
    <AgentTurn
      working
      activity="Vastaa"
      steps={[
        work("a", "git status"),
        say("s1", "välivastaus"),
        work("b", "git pull"),
        say("f", "kirjoit"),
      ]}
    />,
  );
  expect(view.container.querySelector("article strong")?.textContent).toBe(
    "Välivastaus",
  );
  expect(
    view.container.querySelectorAll("article strong")[1]?.textContent,
  ).toBe("Vastaa");
  expect(view.queryByText("Vastaus valmis")).toBeNull();
});

it("retains the reader's fold choice across streaming updates and settlement", () => {
  const steps = [work("a", "työ"), say("f", "vastaus")];
  const turn = (working: boolean, activity: string, done = false) => (
    <AgentTurn
      working={working}
      activity={activity}
      duration="0:02"
      steps={done ? steps : steps.slice(0, 1)}
    />
  );
  const view = render(turn(true, "Ajattelee"));
  const button = screen.getByRole("button", { name: "Näytä työ" });
  view.rerender(turn(true, "Ajaa bash"));
  expect(screen.getByRole("button", { name: "Näytä työ" })).toBe(button);
  fireEvent.click(button);
  view.rerender(turn(true, "Vastaa"));
  expect(screen.getByRole("button", { name: "Piilota työ" })).toBe(button);
  view.rerender(turn(false, "", true));
  // The stage the reader opened while it ran stays open when the turn settles.
  expect(view.getByText("työssä työ")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "1 työkalu · työ" }));
  expect(view.queryByText("työssä työ")).toBeNull();
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
