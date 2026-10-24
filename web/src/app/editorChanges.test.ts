import { expect, it } from "vitest";
import { attribution, messageFor, toolPath } from "./editorChanges";

const report = (tool: string, path?: string) => ({
  workspace: "w",
  conversation: "c",
  tool,
  path,
});

it("reads the path of a complete or truncated tool argument text", () => {
  expect(toolPath('{"path":"docs/a.md","edits":[]}')).toBe("docs/a.md");
  expect(toolPath('{"path":"docs/\\"q\\".md","content":"long and cut')).toBe(
    'docs/"q".md',
  );
  expect(toolPath('{"command":"ls"}')).toBeUndefined();
  expect(toolPath(undefined)).toBeUndefined();
});

it("names the agent only for its file tools on the open file", () => {
  expect(attribution(report("edit", "docs/a.md"), "docs/a.md")).toBe("agent");
  expect(attribution(report("write", "./docs/a.md"), "docs/a.md")).toBe(
    "agent",
  );
  expect(attribution(report("edit", "@docs/a.md"), "docs/a.md")).toBe("agent");
  expect(attribution(report("edit", "/home/u/ws/docs/a.md"), "docs/a.md")).toBe(
    "agent",
  );
  // A same-named file elsewhere or a suffix of another name is another file.
  expect(attribution(report("edit", "docs/b.md"), "docs/a.md")).toBe("other");
  expect(attribution(report("edit", "xdocs/a.md"), "docs/a.md")).toBe("other");
  // Bash or an unknown tool may have changed it, but not as a file tool.
  expect(attribution(report("bash"), "docs/a.md")).toBe("maybe");
  expect(attribution(report("custom_tool"), "docs/a.md")).toBe("maybe");
  expect(attribution(report("edit"), "docs/a.md")).toBe("maybe");
  expect(attribution(report("read", "docs/a.md"), "docs/a.md")).toBe("other");
});

it("tells the agent the path and to read the file again, in one line", () => {
  const message = messageFor({
    id: 1,
    workspace: "w",
    conversation: "c",
    path: "docs/a.md",
    at: "14.34",
    changes: [
      { line: 3, theirs: ["new line"] },
      { line: 9, theirs: [] },
    ],
  });
  expect(message).toContain("docs/a.md");
  expect(message).not.toContain("new line");
  expect(message.split("\n")).toHaveLength(1);
});
