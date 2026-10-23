import { describe, expect, it } from "vitest";
import { type PiCommand, resolveSkillAlias } from "./composerReads";

const skill: PiCommand = {
  name: "skill:demo",
  source: "skill",
  scope: "project",
  terminal_only: false,
  description: "",
};
describe("native skill aliases", () => {
  it("respects native command collisions and leaves unknown or nonleading commands alone", () => {
    expect(resolveSkillAlias("/demo body", [skill])).toBe("/skill:demo body");
    expect(
      resolveSkillAlias("/demo body", [
        skill,
        { ...skill, name: "demo", source: "extension" },
      ]),
    ).toBe("/demo body");
    for (const text of [
      "/unknown body",
      "text /demo",
      "/skill:demo body",
      "/demo/path",
      "!/demo",
    ])
      expect(resolveSkillAlias(text, [skill])).toBe(text);
    expect(
      resolveSkillAlias("/demo body", [{ ...skill, source: "prompt" }]),
    ).toBe("/demo body");
  });
});
