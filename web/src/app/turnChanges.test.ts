import { describe, expect, it } from "vitest";
import {
  commandFiles,
  type ToolStep,
  totalCounts,
  turnChanges,
  unifiedDiff,
  workspacePath,
} from "./turnChanges";

const root = "/home/alice/src/retkiopas";
let n = 0;
const step = (
  tool: string,
  args: Record<string, unknown>,
  extra: Partial<ToolStep> = {},
): ToolStep => ({
  callId: `c${++n}`,
  tool,
  args: JSON.stringify(args),
  failed: false,
  at: n * 1000,
  ...extra,
});

const FILE = "a\nb\nc\nd\ne\nf\ng\nh\n";

describe("turnChanges", () => {
  it("nets several edits to a file the turn read into one change from its first changed line", () => {
    const files = turnChanges(
      [
        step("read", { path: "src/haku.ts" }, { output: FILE }),
        step("edit", {
          path: "src/haku.ts",
          edits: [{ oldText: "c\n", newText: "C\n" }],
        }),
        // The second edit rewrites the first one's line: net, c→C2 is one
        // changed line, not two.
        step("edit", {
          path: `${root}/src/haku.ts`,
          edits: [{ oldText: "C\n", newText: "C2\n" }],
        }),
        step("edit", {
          path: "./src/haku.ts",
          edits: [{ oldText: "g\n", newText: "g\nG\n" }],
        }),
      ],
      root,
    );
    expect(files).toHaveLength(1);
    const [f] = files;
    expect(f.path).toBe("src/haku.ts");
    expect(f.inWorkspace).toBe(true);
    expect(f.change).toBe("modified");
    expect(f.events.map((e) => e.tool)).toEqual(["edit", "edit", "edit"]);
    expect(f.after).toBe("a\nb\nC2\nd\ne\nf\ng\nG\nh\n");
    expect(f.counts).toEqual({ add: 2, del: 1 });
    expect(f.firstLine).toBe(3);
  });

  it("sums the edit cards when the file before the turn is unknown, and gives no line", () => {
    const [f] = turnChanges([
      step("edit", {
        path: "README.md",
        edits: [{ oldText: "npm rnu dev", newText: "npm run dev" }],
      }),
      step("edit", {
        path: "README.md",
        oldText: "x",
        newText: "y\nz",
      }),
    ]);
    expect(f.counts).toEqual({ add: 3, del: 2 });
    expect(f.firstLine).toBeUndefined();
    expect(f.after).toBeUndefined();
  });

  it("diffs a write over a file the turn had read; a write over an unseen file is only 'written'", () => {
    const files = turnChanges([
      step("read", { path: "kausi.ts" }, { output: "one\ntwo\nthree\n" }),
      step("write", { path: "kausi.ts", content: "one\n2\nthree\nfour\n" }),
      step("write", { path: "uusi.ts", content: "x\ny\n" }),
    ]);
    const [over, fresh] = files;
    expect(over.change).toBe("modified");
    expect(over.counts).toEqual({ add: 2, del: 1 });
    expect(over.firstLine).toBe(2);
    expect(fresh.change).toBe("written");
    expect(fresh.counts).toEqual({ add: 2, del: 0 });
    expect(fresh.firstLine).toBe(1);
    expect(totalCounts(files)).toEqual({ add: 4, del: 1 });
  });

  it("leaves out failed tool calls and partial reads", () => {
    const files = turnChanges([
      step(
        "edit",
        { path: "a.ts", edits: [{ oldText: "x", newText: "y" }] },
        { failed: true, output: "Could not find the exact text" },
      ),
      step("write", { path: "b.ts", content: "b" }, { failed: true }),
      step("bash", { command: "rm c.ts" }, { failed: true }),
      // A read with a continuation note is not the whole file.
      step(
        "read",
        { path: "d.ts" },
        {
          output: "1\n2\n\n[Showing lines 1-2 of 9. Use offset=3 to continue.]",
        },
      ),
      step("edit", { path: "d.ts", edits: [{ oldText: "1", newText: "one" }] }),
    ]);
    expect(files.map((f) => f.path)).toEqual(["d.ts"]);
    expect(files[0].before).toBeUndefined();
    expect(files[0].firstLine).toBeUndefined();
  });

  it("marks the files a command names, deleted ones as deleted, with the command", () => {
    const files = turnChanges(
      [
        step("read", { path: "src/vanha.ts" }, { output: "1\n2\n3\n" }),
        step("bash", { command: "git rm -q src/vanha.ts && npm test" }),
        step("bash", { command: "node gen.mjs > public/laavu.svg 2>&1" }),
        step("bash", { command: `rm ${root}/tmp/out.log` }),
        step("bash", { command: "ls -la src" }),
      ],
      root,
    );
    expect(files.map((f) => [f.path, f.change, f.command, f.counts])).toEqual([
      [
        "src/vanha.ts",
        "deleted",
        "git rm -q src/vanha.ts && npm test",
        { add: 0, del: 3 },
      ],
      [
        "public/laavu.svg",
        "command",
        "node gen.mjs > public/laavu.svg 2>&1",
        undefined,
      ],
      ["tmp/out.log", "deleted", `rm ${root}/tmp/out.log`, undefined],
    ]);
  });

  it("keeps an edited file's tool-call counts out once a command changed it", () => {
    const [f] = turnChanges([
      step("edit", { path: "a.ts", edits: [{ oldText: "x", newText: "y" }] }),
      step("bash", { command: "sed -i 's/y/z/' a.ts" }),
    ]);
    expect(f.change).toBe("modified");
    expect(f.command).toBe("sed -i 's/y/z/' a.ts");
    expect(f.counts).toBeUndefined();
  });
});

describe("commandFiles", () => {
  it.each([
    ["rm -f a.txt 'b c.txt'", ["-a.txt", "-b c.txt"]],
    ["mv old.ts new.ts", ["-old.ts", "+new.ts"]],
    ["git mv -k src/a.ts lib/a.ts", ["-src/a.ts", "+lib/a.ts"]],
    ["cp a.ts b.ts; touch c.ts", ["+b.ts", "+c.ts"]],
    ["echo hi >> log.txt", ["+log.txt"]],
    ["echo hi | tee -a x.txt", ["+x.txt"]],
    ["sed -i -e 's/a/b/' -e 's/c/d/' one.ts two.ts", ["+one.ts", "+two.ts"]],
    ["sed 's/a/b/' one.ts > two.ts", ["+two.ts"]],
    ["cat > notes.md <<'EOF'\nrm everything.txt\nEOF", ["+notes.md"]],
    // Not known: a change of directory, an expansion, a glob, a pipe to /dev/null.
    ["cd lib && rm a.ts", []],
    ["rm $TARGET", []],
    ["rm *.log", []],
    ["make 2>/dev/null", []],
    ["git -C ../muu rm x.ts", []],
  ])("%s", (command, expected) => {
    expect(
      commandFiles(command).map((f) => `${f.deleted ? "-" : "+"}${f.path}`),
    ).toEqual(expected);
  });
});

describe("workspacePath", () => {
  it("relativises the workspace and keeps outside paths unlinkable", () => {
    expect(workspacePath("@./src/../src/a.ts", root)).toEqual({
      path: "src/a.ts",
      inWorkspace: true,
    });
    expect(workspacePath("/etc/hosts", root)).toEqual({
      path: "/etc/hosts",
      inWorkspace: false,
    });
    expect(workspacePath("../muu/a.ts", root)?.inWorkspace).toBe(false);
  });
});

describe("unifiedDiff", () => {
  it("keeps three lines of context and marks the gap between hunks", () => {
    const before = Array.from({ length: 20 }, (_, i) => `l${i}`).join("\n");
    const after = before.replace("l2", "L2").replace("l17", "L17");
    const lines = unifiedDiff("x.ts", before, after).split("\n").slice(3);
    expect(lines.filter((l) => l === " ⋯")).toHaveLength(1);
    expect(lines.filter((l) => l.startsWith("-"))).toEqual(["-l2", "-l17"]);
    expect(lines.filter((l) => l.startsWith("+"))).toEqual(["+L2", "+L17"]);
  });
});
