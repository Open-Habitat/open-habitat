import { describe, expect, it, vi } from "vitest";
import { create, worktreeNameFrom } from "./conversations";
import { browserOwned, type WorktreePlace, worktreeMerged } from "./snapshot";

// Worktree agents (ADR 0025): the browser names the branch from the first
// message, checks that the daemon answered for a place of the asked
// workspace, and calls the work merged only when Git says so of a branch
// that has moved.
describe("worktree agents", () => {
  it("names the branch from the first words, safely", () => {
    expect(worktreeNameFrom("Kirjoita muistiinpano ja commitoi se")).toBe(
      "kirjoita-muistiinpano-ja-commitoi",
    );
    expect(worktreeNameFrom("Äänitä öljyn hinta!")).toBe("aanita-oljyn-hinta");
    expect(worktreeNameFrom("../../etc/passwd")).toBe("etc-passwd");
    expect(worktreeNameFrom("ありがとう")).toBe("agentti");
    expect(worktreeNameFrom("x".repeat(60))).toBe("x".repeat(40));
  });

  it("accepts a creation reply only for a place of the asked workspace", async () => {
    const reply = (body: object) =>
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const session = {
      schema_version: 1,
      agent_id: "pi:11111111-1111-4111-8111-111111111111",
      state: "starting",
    };
    let fetch = reply({
      ...session,
      workspace_id: "ws_placeplace",
      worktree_of: "ws_parentpar",
    });
    await expect(
      create("ws_parentpar", "csrf", undefined, "tilarivit"),
    ).resolves.toMatchObject({ workspace_id: "ws_placeplace" });
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toMatchObject({
      workspace_id: "ws_parentpar",
      new_worktree: { name: "tilarivit" },
    });
    fetch.mockRestore();
    // Another workspace's place, or the workspace itself, is not this one.
    for (const wrong of [
      { workspace_id: "ws_placeplace", worktree_of: "ws_otherone" },
      { workspace_id: "ws_parentpar", worktree_of: "ws_parentpar" },
    ]) {
      fetch = reply({ ...session, ...wrong });
      await expect(
        create("ws_parentpar", "csrf", undefined, "tilarivit"),
      ).rejects.toThrow("invalid create");
      fetch.mockRestore();
    }
    await expect(
      create("ws_parentpar", "csrf", undefined, "../ulos"),
    ).rejects.toThrow("invalid worktree name");
  });

  it("calls a worktree merged only after its branch moved", () => {
    const base = {
      name: "main",
      ref: "main",
      source: "recorded" as const,
      ahead: 0,
      behind: 0,
      merged: true,
    };
    const place = (moved: boolean, dirty = 0): WorktreePlace => ({
      worktree_id: "ws_placeplace",
      entry: "x",
      name: "x",
      path: "/home/a/src/app__worktrees/x",
      git_summary: { branch: "wt/x", dirty_count: dirty, base },
      branch_moved: moved,
    });
    expect(worktreeMerged(place(false))).toBe(false);
    expect(worktreeMerged(place(true))).toBe(true);
    expect(worktreeMerged(place(true, 2))).toBe(false);
    expect(worktreeMerged(undefined)).toBe(false);
  });

  it("knows a browser conversation in a worktree by its place", () => {
    const agent = {
      agent_id: "pi:1",
      workspace_id: "ws_parentpar",
      worktree_id: "ws_placeplace",
    };
    expect(
      browserOwned(agent, [
        { agent_id: "pi:1", workspace_id: "ws_placeplace" },
      ]),
    ).toBe(true);
    expect(
      browserOwned(agent, [{ agent_id: "pi:1", workspace_id: "ws_parentpar" }]),
    ).toBe(false);
  });
});
