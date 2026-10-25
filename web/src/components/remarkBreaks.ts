import type { Break, Root, RootContent, Text } from "mdast";

// A person's own message keeps the lines they typed: a single newline is a
// line break, not a Markdown soft break that joins lines into one paragraph.
// Only prose text nodes are split; code keeps its value untouched.
export default function remarkBreaks() {
  return (tree: Root) => {
    function visit(node: Root | RootContent) {
      if (!("children" in node)) return;
      const children: RootContent[] = node.children;
      node.children = children.flatMap<RootContent>((child) => {
        if (child.type !== "text") {
          visit(child);
          return [child];
        }
        if (!child.value.includes("\n")) return [child];
        return child.value.split(/[ \t]*\r?\n[ \t]*/).flatMap((value, i) => {
          const parts: (Text | Break)[] = i ? [{ type: "break" }] : [];
          if (value) parts.push({ type: "text", value });
          return parts;
        });
      }) as typeof node.children;
    }
    visit(tree);
  };
}
