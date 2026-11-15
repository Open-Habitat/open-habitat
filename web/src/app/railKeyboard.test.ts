import { afterEach, describe, expect, it } from "vitest";
import type { AgentNavModel } from "../components/Navigation";
import {
  railKeyboardDirection,
  railKeyboardOrder,
  railKeyboardTarget,
} from "./railKeyboard";

const row = (
  id: string,
  extra: Partial<AgentNavModel> = {},
): AgentNavModel => ({
  agentId: id,
  href: `/agents/${id}`,
  title: id,
  activityLabel: "Idle",
  controlLabel: "",
  ...extra,
});
const yours = [row("a"), row("b")];
const now = {
  yours,
  running: [row("c")],
  quiet: [
    row("z", { workspaceId: "one" }),
    row("d", { workspaceId: "two", selected: true }),
  ],
  hints: new Map(),
};
const choice = { sort: "name" as const, workspace: null };
const order = () => railKeyboardOrder(now, choice, [], false, false);

afterEach(() => {
  document.body.innerHTML = "";
});
describe("rail keyboard", () => {
  it("uses all sections and Quiet's displayed sort/filter; folded rows and a collapsed rail are skipped", () => {
    expect(order().map((r) => r.agentId)).toEqual(["a", "b", "c", "d", "z"]);
    expect(
      railKeyboardOrder(
        now,
        { ...choice, workspace: "one" },
        [],
        false,
        false,
      ).map((r) => r.agentId),
    ).toEqual(["a", "b", "c", "z", "d"]);
    expect(
      railKeyboardOrder(now, choice, [], true, false).map((r) => r.agentId),
    ).toEqual(["a", "b", "c", "d"]);
    expect(
      railKeyboardOrder(now, choice, [], false, true).map((r) => r.agentId),
    ).toEqual(["a", "b", "c"]);
  });
  it("steps both ways across sections and stops at the ends", () => {
    expect(
      railKeyboardTarget(order(), "/agents/b", 1, false, yours)?.agentId,
    ).toBe("c");
    expect(
      railKeyboardTarget(order(), "/agents/d", -1, false, yours)?.agentId,
    ).toBe("c");
    expect(
      railKeyboardTarget(order(), "/agents/z", 1, false, yours),
    ).toBeUndefined();
    expect(
      railKeyboardTarget(order(), "/agents/a", -1, false, yours),
    ).toBeUndefined();
  });
  it("Shift cycles only waiting rows, even from another section", () => {
    expect(
      railKeyboardTarget(order(), "/agents/z", 1, true, yours)?.agentId,
    ).toBe("a");
    expect(
      railKeyboardTarget(order(), "/agents/c", -1, true, yours)?.agentId,
    ).toBe("b");
    expect(
      railKeyboardTarget(order(), "/agents/b", 1, true, yours)?.agentId,
    ).toBe("a");
    expect(
      railKeyboardTarget(order(), "/agents/a", -1, true, yours)?.agentId,
    ).toBe("b");
    expect(
      railKeyboardTarget(order(), "/agents/a", 1, true, [yours[0]]),
    ).toBeUndefined();
  });
  it("matches physical arrows, allows Shift/repeat, refuses composition, AltGr and other chords", () => {
    const key = (extra: KeyboardEventInit = {}) =>
      new KeyboardEvent("keydown", {
        code: "ArrowDown",
        altKey: true,
        ...extra,
      });
    expect(railKeyboardDirection(key())).toBe(1);
    expect(
      railKeyboardDirection(
        key({ code: "ArrowUp", shiftKey: true, repeat: true }),
      ),
    ).toBe(-1);
    for (const extra of [
      { ctrlKey: true },
      { metaKey: true },
      { isComposing: true },
      { altKey: false },
      { code: "ArrowLeft" },
    ])
      expect(railKeyboardDirection(key(extra))).toBe(0);
  });
  it("leaves terminal, editor, dialogs and composer lists alone", () => {
    for (const selector of [
      'class="ah-terminal-surface"',
      'class="cm-editor"',
      'role="dialog"',
      'role="menu"',
    ]) {
      document.body.innerHTML = `<div ${selector}><textarea></textarea></div>`;
      const field = document.querySelector("textarea");
      if (!field) throw new Error("Missing fixture field");
      let direction = 99;
      field.addEventListener("keydown", (event) => {
        direction = railKeyboardDirection(event);
      });
      field.dispatchEvent(
        new KeyboardEvent("keydown", { code: "ArrowDown", altKey: true }),
      );
      expect(direction).toBe(0);
    }
    document.body.innerHTML =
      '<div class="ah-composer"><div role="listbox"></div></div>';
    expect(
      railKeyboardDirection(
        new KeyboardEvent("keydown", { code: "ArrowDown", altKey: true }),
      ),
    ).toBe(0);
  });
});
