import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { setWorkPreference } from "../workPreference";
import { AgentTurn, elapsedLabel, ThinkingRow } from "./AgentTurn";

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
  fireEvent.click(screen.getByRole("button"));
  expect(await screen.findByText(/Toinen/)).toBeTruthy();
});

const work = (
  key: string,
  text: string,
  kind: "thinking" | "tool" = "tool",
  at?: number,
) => ({ kind, key, at, node: <p>{`työssä ${text}`}</p> }) as const;
const say = (key: string, text: string, at?: number) =>
  ({ kind: "text", key, text, at, node: <p>{text}</p> }) as const;

it("has no turn head; a stage row replaces it and opens its work", () => {
  const view = render(
    <AgentTurn
      steps={[
        work("t", "pohdinta", "thinking"),
        work("a", "git status"),
        work("b", "git log"),
        say("f", "vastaus"),
      ]}
    />,
  );

  const row = within(view.getByTestId("turn-stage")).getByRole("button");
  expect(row.getAttribute("aria-expanded")).toBe("false");
  expect(view.queryByText("työssä git status")).toBeNull();

  fireEvent.click(row);
  expect(row.getAttribute("aria-expanded")).toBe("true");
  expect(view.getByText("työssä git status")).toBeTruthy();
  expect(view.getByText("vastaus")).toBeTruthy();
});

it("shows each interim reply as its own card and opens only its stage", () => {
  const view = render(
    <AgentTurn
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
  expect(rows).toHaveLength(2);

  expect(
    view.container.querySelectorAll("[data-reply-kind=interim]"),
  ).toHaveLength(2);
  expect(
    view.container.querySelectorAll("[data-reply-kind=final]"),
  ).toHaveLength(1);
  fireEvent.click(rows[1]);
  expect(view.getByText("työssä toka")).toBeTruthy();
  expect(view.queryByText("työssä eka")).toBeNull();
  for (const text of ["välivastaus yksi", "välivastaus kaksi", "lopullinen"])
    expect(view.getByText(text)).toBeTruthy();
});

it("times each stage from the entry before it to the entry that closed it", () => {
  const t0 = Date.parse("2026-10-24T08:00:00Z");
  const view = render(
    <AgentTurn
      startedAt={t0}
      steps={[
        work("a", "eka", "tool", t0 + 4000),
        say("s1", "välivastaus", t0 + 14_000),
        work("b", "toka", "tool", t0 + 30_000),
        // Its own entry has no timestamp: the last timed work ends the stage.
        work("c", "kolmas", "tool", t0 + 79_000),
        say("f", "vastaus"),
      ]}
    />,
  );
  const rows = view.getAllByTestId("history-stage-toggle");
  expect(rows.map((row) => row.dataset.elapsedSeconds)).toEqual(["14", "65"]);
});

it("leaves the time out when the turn's start or a stage's end is unknown", () => {
  const t0 = Date.parse("2026-10-24T08:00:00Z");
  const view = render(
    <AgentTurn
      steps={[
        work("a", "eka", "tool", t0 + 4000),
        say("s1", "välivastaus", t0 + 14_000),
        work("b", "toka"),
        say("f", "vastaus"),
      ]}
    />,
  );
  for (const row of view.getAllByTestId("history-stage-toggle"))
    expect(row.dataset.elapsedSeconds).toBeUndefined();
});

it.each([
  [0, "0 s"],
  [59.4, "59 s"],
  [65, "1 min 05 s"],
  [3599, "59 min 59 s"],
  [3725, "1 h 02 min"],
])("formats %s seconds of stage time as %s", (seconds, label) => {
  expect(elapsedLabel(seconds)).toBe(label);
});

it("names failures in the stage row and treats trailing work as no answer", () => {
  const view = render(
    <AgentTurn
      steps={[
        say("s", "aloitan"),
        {
          kind: "tool",
          key: "a",
          failed: true,
          node: null,
        },
      ]}
    />,
  );
  expect(
    within(view.getByTestId("turn-stage")).getByRole("button"),
  ).toBeTruthy();
  expect(view.getByTestId("turn-failures")).toBeTruthy();
  expect(view.container.querySelector("[data-reply-kind=final]")).toBeNull();
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
    within(view.getByTestId("turn-stage")).getByRole("button"),
  ).toBeTruthy();
  expect(view.queryByText("työssä git pull")).toBeNull();
  fireEvent.click(screen.getByTestId("turn-work-toggle"));
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
  expect(view.getByText("kirjoit")).toBeTruthy();
  expect(
    view.container.querySelector("[data-reply-kind=streaming]"),
  ).toBeTruthy();
  expect(view.container.querySelector("[data-reply-kind=final]")).toBeNull();
});

it("does not let empty text close a work stage or mount a blank reply", () => {
  const steps = [
    work("t", "pohdinta", "thinking"),
    say("empty", "\n  "),
    work("a", "ls"),
  ];
  const view = render(<AgentTurn working steps={steps} />);
  expect(view.queryAllByTestId("stage-reply")).toHaveLength(0);
  expect(view.queryAllByTestId("turn-stage")).toHaveLength(0);
  view.rerender(
    <AgentTurn
      steps={[...steps, say("answer", "vastaus"), say("trailing", "")]}
    />,
  );
  expect(view.getAllByTestId("turn-stage")).toHaveLength(1);
  expect(view.getAllByTestId("stage-reply")).toHaveLength(1);
  expect(view.getByTestId("stage-reply").getAttribute("data-reply-role")).toBe(
    "final",
  );
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
  const button = screen.getByTestId("turn-work-toggle");
  view.rerender(turn(true, "Ajaa bash"));
  expect(screen.getByTestId("turn-work-toggle")).toBe(button);
  fireEvent.click(button);
  view.rerender(turn(true, "Vastaa"));
  expect(screen.getByTestId("turn-work-toggle")).toBe(button);
  view.rerender(turn(false, "", true));
  // The stage the reader opened while it ran stays open when the turn settles.
  expect(view.getByText("työssä työ")).toBeTruthy();
  fireEvent.click(within(view.getByTestId("turn-stage")).getByRole("button"));
  expect(view.queryByText("työssä työ")).toBeNull();
});

it.each([
  "**Summary**\n\nBody with **other emphasis**",
  "\r\n  **Summary**  \r\n\r\nBody with **other emphasis**",
])(
  "moves only a standalone leading bold heading into the toggle: %s",
  async (text) => {
    const view = render(<ThinkingRow text={text} />);
    const toggle = screen.getByRole("button");
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
    fireEvent.click(screen.getByRole("button"));
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
  const buttons = screen.getAllByRole("button");
  expect(buttons[0].textContent).toContain("Interpreting extension messages");
  expect(buttons[1].textContent).toContain(
    "The user is asking about go test failures.",
  );
  // This title is extracted native reasoning, not the translated disclosure label.
  const title =
    buttons[2].querySelector(".ah-think-title")?.getAttribute("title") ?? "";
  expect(title.endsWith("…")).toBe(true);
  expect(title.length).toBeLessThanOrEqual(120);
  expect(buttons[3].textContent).toContain("First, read the config");
});

it("never exposes redacted reasoning or extracts a title from a live delta", async () => {
  const view = render(
    <ThinkingRow text={"**Secret**\nHidden body"} redacted />,
  );
  expect(view.container.textContent).not.toMatch(/Secret|Hidden body/);
  view.rerender(
    <ThinkingRow text={"**Streaming heading**\nCurrent line"} live />,
  );
  expect(await screen.findByText("Current line")).toBeTruthy();
  expect(view.queryByText("Streaming heading")).toBeNull();
});
