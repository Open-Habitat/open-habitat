import { expect, it } from "vitest";
import {
  changeCount,
  landing,
  lineChanges,
  replaced,
  threeWay,
} from "./editorMerge";

const origin = "a\nb\nc\nd\ne\nf\ng";

it("keeps both sides' changes on separate lines and marks the incoming ones", () => {
  const mine = origin.replace("b", "B mine");
  const theirs = origin.replace("f", "F disk").concat("\nh");
  const m = threeWay(mine, origin, theirs);
  expect(m.text).toBe("a\nB mine\nc\nd\ne\nF disk\ng\nh");
  expect(m.conflicts).toEqual([]);
  expect(m.incoming).toEqual([
    [5, 6],
    [7, 8],
  ]);
  expect(changeCount(m)).toBe(2);
});

it("treats changes to adjacent lines as a conflict and keeps the person's lines", () => {
  const mine = origin.replace("c", "C mine");
  const theirs = origin.replace("d", "D disk");
  const m = threeWay(mine, origin, theirs);
  expect(m.text).toBe(mine);
  expect(m.conflicts).toEqual([
    { line: 2, mine: ["C mine", "d"], theirs: ["c", "D disk"] },
  ]);
});

it("does not count an identical change on both sides", () => {
  const both = origin.replace("e", "E");
  const m = threeWay(both, origin, both);
  expect(m.text).toBe(both);
  expect(changeCount(m)).toBe(0);
});

it("lists exactly the disk changes a save replaced, in the disk version's lines", () => {
  const theirs = origin.replace("b", "B disk").replace("f", "F disk");
  const keptOne = origin.replace("f", "F disk");
  expect(replaced(keptOne, origin, theirs)).toEqual([
    { line: 2, theirs: ["B disk"] },
  ]);
  expect(replaced(theirs, origin, theirs)).toEqual([]);
  // A conflict resolved as the person's own line replaced the disk's.
  expect(replaced(origin.replace("b", "B mine"), origin, theirs)).toEqual([
    { line: 2, theirs: ["B disk"] },
    { line: 6, theirs: ["F disk"] },
  ]);
});

it("places waiting changes on the person's shifted lines", () => {
  // The person inserted two lines at the top; the disk changed line "e".
  const mine = `x\ny\n${origin}`;
  const theirs = origin.replace("e", "E disk");
  expect(landing(mine, origin, theirs)).toEqual([6]);
  // An append past the person's last line lands on that line.
  expect(landing(origin, origin, `${origin}\nh`)).toEqual([6]);
});

it("turns one text into another with minimal line changes", () => {
  const apply = (text: string, changes: ReturnType<typeof lineChanges>) =>
    [...changes]
      .reverse()
      .reduce(
        (t, c) => t.slice(0, c.from) + c.insert + t.slice(c.to ?? c.from),
        text,
      );
  const pairs: [string, string][] = [
    [origin, origin.replace("c", "C")],
    [origin, `${origin}\nh\ni`],
    [origin, origin.replace("\nf\ng", "")],
    [origin, `0\n${origin}`],
    [origin, ""],
    ["", "new"],
    ["only", "only\n"],
    [`${origin}\n`, origin],
    [origin, "a\nX\nc\nd\nY\nZ"],
  ];
  for (const [now, next] of pairs)
    expect(apply(now, lineChanges(now, next))).toBe(next);
  // Untouched lines are not rewritten.
  const changes = lineChanges(origin, origin.replace("f", "F"));
  expect(changes).toEqual([{ from: 10, to: 12, insert: "F\n" }]);
});
