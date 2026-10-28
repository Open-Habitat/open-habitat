import { expect, it } from "vitest";
import { STABLE_TEXT_CHUNK, stableChunks } from "./rehypeStableText";

it("keeps earlier pieces when text is appended", () => {
  const text = "sana ".repeat(40);
  const before = stableChunks(text);
  const after = stableChunks(`${text}lisää`);
  expect(after.slice(0, before.length - 1)).toEqual(before.slice(0, -1));
  expect(after.join("")).toBe(`${text}lisää`);
});

it("never splits a character across pieces", () => {
  const pad = "x".repeat(STABLE_TEXT_CHUNK - 1);
  for (const character of ["😀", "é", "👩‍💻", "❤️", "👍🏽"]) {
    const text = `${pad}${character}${"y".repeat(STABLE_TEXT_CHUNK)}`;
    const pieces = stableChunks(text);
    expect(pieces.join("")).toBe(text);
    expect(pieces.some((piece) => piece.includes(character))).toBe(true);
  }
});
