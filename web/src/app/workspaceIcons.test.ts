import { describe, expect, it } from "vitest";
import type { Workspace } from "./snapshot";
import { glyphLetters, workspaceIcons } from "./workspaceIcons";

const ws = (name: string, over: Partial<Workspace> = {}): Workspace => ({
  workspace_id: `ws_${name.replace(/[^A-Za-z0-9]/g, "")}00000000`,
  name,
  kind: "git_main_worktree",
  visibility: "visible",
  mutation_state: "allowed",
  presence: "present",
  facts: [],
  ...over,
});

describe("workspace icons", () => {
  it("derives two letters, skipping generic words", () => {
    expect(glyphLetters("northwind-monorepo")).toBe("3D");
    expect(glyphLetters("open-habitat")).toBe("OH");
    expect(glyphLetters("issuectl")).toBe("IS");
    expect(glyphLetters("kunnollavauhtiin-monorepo")).toBe("KU");
    expect(glyphLetters("äänet")).toBe("ÄÄ");
  });
  it("follows the chain: the repository's icon, else its logo, else the glyph", () => {
    const icons = workspaceIcons([
      ws("emoji", {
        icon: { kind: "emoji", source: "config", value: "🦊" },
      }),
      ws("logo", {
        icon: {
          kind: "image",
          source: "logo",
          path: "public/favicon.svg",
          version: "0123456789abcdef",
        },
      }),
      ws("plain", { display_name: "Kotisivu" }),
    ]);
    const emoji = icons.get("ws_emoji00000000");
    expect(emoji?.show).toEqual({ kind: "emoji", value: "🦊" });
    expect(emoji?.where).toBe(".open-habitat.yaml");
    const logo = icons.get("ws_logo00000000");
    expect(logo?.show).toEqual({
      kind: "image",
      src: "/api/v1/workspaces/icon?workspace_id=ws_logo00000000&v=0123456789abcdef",
    });
    expect(logo?.source).toBe("Repon logo");
    const plain = icons.get("ws_plain00000000");
    expect(plain?.show).toEqual({ kind: "glyph" });
    expect(plain?.name).toBe("Kotisivu");
    expect(plain?.glyph.letters).toBe("KO");
  });
  it("moves a tile that would repeat another's letters and hue", () => {
    // Same letters; whatever the hash, no two tiles share letters and hue.
    const names = ["ab-x", "ab-y", "ax-b", "a-b", "aa-bb", "ab", "abc", "abd"];
    const icons = workspaceIcons(names.map((n) => ws(n)));
    const tiles = [...icons.values()].map(
      (i) => `${i.glyph.letters}:${i.glyph.hue}`,
    );
    expect(new Set(tiles).size).toBe(tiles.length);
  });
});
