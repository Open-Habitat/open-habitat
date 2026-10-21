import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  type CatalogueSkill,
  isNewSkill,
  skillDraft,
  StartHere,
} from "./StartHere";

const skill: CatalogueSkill = {
  name: "skill:fixture",
  description: "Native description",
  source: "skill",
  scope: "project",
  terminal_only: false,
  discovery: {
    repository: true,
    start: 0,
    example: "An editable example",
    added: {
      author: "Fixture",
      at: "2026-10-20T12:00:00+03:00",
      commit: "a".repeat(40),
    },
  },
};
describe("skill discovery intent", () => {
  it("keeps the existing draft and inserts one native invocation without sending", () => {
    expect(skillDraft(skill, "Existing draft.  ")).toBe(
      "Existing draft.\n\n/skill:fixture An editable example",
    );
    expect(skillDraft({ ...skill, discovery: undefined }, " ")).toBe(
      "/skill:fixture",
    );
  });
  it("requires a known repository addition after an explicitly acknowledged instant", () => {
    expect(isNewSkill(skill)).toBe(false);
    expect(isNewSkill(skill, Date.parse("2026-10-20T09:00:00Z"))).toBe(false);
    expect(isNewSkill(skill, Date.parse("2026-10-20T08:59:59Z"))).toBe(true);
    expect(isNewSkill({ ...skill, discovery: { repository: true } }, 1)).toBe(
      false,
    );
    expect(
      isNewSkill(
        { ...skill, discovery: { ...skill.discovery, repository: false } },
        1,
      ),
    ).toBe(false);
  });
  it("offers only repository-marked goals, including order zero", () => {
    const onTry = vi.fn();
    render(
      <StartHere
        skills={[
          skill,
          {
            ...skill,
            name: "skill:global",
            scope: "user",
            discovery: { repository: false, start: 1 },
          },
        ]}
        state="ready"
        onRetry={() => {}}
        onAcknowledge={() => {}}
        onOpen={() => {}}
        onTry={onTry}
      />,
    );
    expect(screen.getAllByTestId("starting-goal")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("starting-goal"));
    expect(onTry).toHaveBeenCalledWith(skill);
  });
});
