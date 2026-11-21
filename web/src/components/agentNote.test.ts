import { describe, expect, it } from "vitest";
import { noteQuestions, noteText, tidyOwnWords } from "./agentNote";

const words = {
  title: "# T",
  titleAdded: "## T",
  me: (n: string) => `I'm ${n}.`,
  own: "## Own",
  langLine: { fi: "FI.", en: "EN.", sv: "SV." },
  style: [{ prose: "S0." }, { prose: "S1." }],
  ask: [{ prose: "A0." }],
};

describe("agent note", () => {
  it("keeps the person's words and line breaks, fixing only capitals and stops", () => {
    expect(
      tidyOwnWords("i live here. i dont like long answers\nsecond line"),
    ).toBe("I live here. I dont like long answers.\nSecond line.");
    expect(tidyOwnWords("- a list item\nok!")).toBe("- a list item\nOk!");
  });

  it("asks an existing note no language and adds after it untouched", () => {
    expect(noteQuestions(true)).not.toContain("lang");
    expect(noteQuestions(false)[0]).toBe("lang");
    const existing = "# Mine\n\n- Keep me exactly  \n\n";
    const text = noteText(
      words,
      { lang: "sv", style: 1, own: "Mine." },
      "Ann",
      existing,
    );
    expect(text.startsWith(existing)).toBe(true);
    expect(text).not.toContain("SV.");
    expect(text).not.toContain("I'm Ann");
    expect(text).toContain("## Own\n\nMine.");
  });

  it("leaves an existing note as it was when nothing was answered", () => {
    expect(noteText(words, {}, "Ann", "# Mine")).toBe("# Mine");
  });

  it("writes a new note from the answers in order", () => {
    expect(noteText(words, { lang: "fi", style: 0, ask: 0 }, " Ann ")).toBe(
      "# T\n\nI'm Ann.\n\nFI. S0.\n\nA0.\n",
    );
  });
});
