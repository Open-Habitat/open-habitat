import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { markedParts, Switcher, type SwitcherItem } from "./Switcher";

const words = {
  dialog: "Search conversations",
  placeholder: "Search conversations",
  previous: "previous",
  archived: "Archived",
  more: (n: number) => `+${n} hits`,
  moreLabel: (n: number, open: boolean) => (open ? "Hide" : `Show ${n}`),
};

const items = (open: boolean): SwitcherItem[] => [
  {
    kind: "conversation",
    key: "c-a",
    title: "Map tile cache",
    titleTerms: ["map"],
    workspace: "retkiopas",
    mark: "done",
    ago: "today",
    line: { who: "You", text: "Could the map be saved?", terms: ["map"] },
    more: { count: 2, open },
  },
  ...(open
    ? ([
        {
          kind: "hit",
          key: "h-a-1",
          who: "Agent",
          text: "map one",
          terms: ["map"],
          ago: "today",
        },
        {
          kind: "hit",
          key: "h-a-2",
          who: "You",
          text: "map two",
          terms: ["map"],
          ago: "yesterday",
        },
      ] as SwitcherItem[])
    : []),
  {
    kind: "conversation",
    key: "c-b",
    title: "Glossary",
    titleTerms: [],
    workspace: "kirjanpito",
    mark: "done",
    archived: true,
  },
];

function Harness({
  onChoose,
  onExpandSpy,
  onClose = () => {},
}: {
  onChoose: (i: number) => void;
  onExpandSpy: (i: number, open: boolean) => void;
  onClose?: () => void;
}) {
  const [query, setQuery] = useState("map");
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  return (
    <Switcher
      open
      query={query}
      items={items(open)}
      foot="foot"
      words={words}
      selected={selected}
      onQuery={setQuery}
      onSelect={setSelected}
      onChoose={onChoose}
      onExpand={(i, on) => {
        onExpandSpy(i, on);
        setOpen(on);
        setSelected(on ? i + 1 : i);
      }}
      onClose={onClose}
    />
  );
}

it("moves, opens and folds with the keys, → only at the end of the text", () => {
  const choose = vi.fn();
  const expand = vi.fn();
  render(<Harness onChoose={choose} onExpandSpy={expand} />);
  const input = screen.getByTestId("switcher-input") as HTMLInputElement;
  expect(
    screen.getByTestId("switcher-row-c-a").getAttribute("aria-selected"),
  ).toBe("true");
  // The caret in the middle of the text: → belongs to the field.
  input.setSelectionRange(1, 1);
  fireEvent.keyDown(input, { key: "ArrowRight" });
  expect(expand).not.toHaveBeenCalled();
  input.setSelectionRange(3, 3);
  fireEvent.keyDown(input, { key: "ArrowRight" });
  expect(expand).toHaveBeenLastCalledWith(0, true);
  expect(
    screen.getByTestId("switcher-row-h-a-1").getAttribute("aria-selected"),
  ).toBe("true");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(
    screen.getByTestId("switcher-row-h-a-2").getAttribute("aria-selected"),
  ).toBe("true");
  // ← on a sub-row folds its conversation.
  fireEvent.keyDown(input, { key: "ArrowLeft" });
  expect(expand).toHaveBeenLastCalledWith(0, false);
  expect(screen.queryByTestId("switcher-row-h-a-1")).toBeNull();
  // ← with nothing open belongs to the field.
  fireEvent.keyDown(input, { key: "ArrowLeft" });
  expect(expand).toHaveBeenCalledTimes(2);
  fireEvent.keyDown(input, { key: "ArrowUp" });
  expect(
    screen.getByTestId("switcher-row-c-b").getAttribute("aria-selected"),
  ).toBe("true");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(choose).toHaveBeenCalledWith(1);
  expect(input.getAttribute("aria-activedescendant")).toMatch(/c-b$/);
});

it("shows the sentence with its words marked, the count and the archived tag", () => {
  render(<Harness onChoose={() => {}} onExpandSpy={() => {}} />);
  const row = screen.getByTestId("switcher-row-c-a");
  expect([...row.querySelectorAll("mark")].map((m) => m.textContent)).toEqual([
    "Map",
    "map",
  ]);
  expect(screen.getByTestId("switcher-more-c-a").textContent).toContain(
    "+2 hits",
  );
  expect(screen.getByTestId("switcher-row-c-b").textContent).toContain(
    "Archived",
  );
});

it("closes on Escape", () => {
  const close = vi.fn();
  render(
    <Harness onChoose={() => {}} onExpandSpy={() => {}} onClose={close} />,
  );
  fireEvent.keyDown(screen.getByTestId("switcher-input"), { key: "Escape" });
  expect(close).toHaveBeenCalled();
});

it("markedParts marks whole words that contain a term", () => {
  expect(markedParts("Tilikartan kartta, ei muuta.", ["kart"])).toEqual([
    { text: "Tilikartan", mark: true },
    { text: " ", mark: false },
    { text: "kartta", mark: true },
    { text: ", ei muuta.", mark: false },
  ]);
  expect(markedParts("plain", [])).toEqual([{ text: "plain", mark: false }]);
});
