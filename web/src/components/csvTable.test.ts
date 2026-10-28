import { expect, it } from "vitest";
import { readTable, tableRows } from "./csvTable";

it("reads a table's quoted separators, doubled quotes and line breaks as cell text", () => {
  expect(tableRows('a,"b,c",d\r\n"say ""hi""","x\ny",z\n', false)).toEqual([
    ["a", "b,c", "d"],
    ['say "hi"', "x\ny", "z"],
  ]);
  expect(tableRows("a\tb,c\n1\t2", true)).toEqual([
    ["a", "b,c"],
    ["1", "2"],
  ]);
  expect(tableRows("1\n2\n3\n", false, 2)).toHaveLength(2);
  // One very long row is cut at the column limit.
  expect(tableRows(",".repeat(100_000), false)[0]).toHaveLength(50);
});

it("splits a CSV at the separator its first row uses", () => {
  // A Finnish spreadsheet writes semicolons; its decimal commas stay in cells.
  expect(tableRows("päivä;käynnit\nma;1,5\n", false)).toEqual([
    ["päivä", "käynnit"],
    ["ma", "1,5"],
  ]);
  // A quoted separator does not count, and a tie keeps the comma.
  expect(tableRows('a,"b;c;d",e\n', false)).toEqual([["a", "b;c;d", "e"]]);
  expect(tableRows("a;b,c\n", false)).toEqual([["a;b", "c"]]);
  expect(tableRows("a\tb\n1\t2", false)).toEqual([
    ["a", "b"],
    ["1", "2"],
  ]);
});

it("numbers each row by the text line it starts on", () => {
  // A quoted line break makes one row two lines; CRLF counts once.
  const { rows, more } = readTable('a;b\r\n"x\ny";1\r\n\r\nz;2', false, 10, 10);
  expect(rows.map((r) => r.line)).toEqual([0, 1, 3, 4]);
  expect(rows[3].cells).toEqual(["z", "2"]);
  expect(more).toBe(false);
  expect(readTable("1\n2\n3\n", false, 2, 10).more).toBe(true);
  expect(readTable("1\n2\n", false, 2, 10).more).toBe(false);
});
