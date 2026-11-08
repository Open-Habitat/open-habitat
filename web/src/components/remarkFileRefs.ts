import type { Link, Root, RootContent, Text } from "mdast";
import { parseFileRef, webAddress } from "./fileRefs";

// Work on Markdown nodes, never the source string: fences, existing links and
// inline code must not be scanned as prose (or produce nested anchors).
export default function remarkFileRefs() {
  return (tree: Root) => {
    function visit(node: Root | RootContent) {
      if (node.type === "link" || node.type === "definition") {
        const web = webAddress(node.url);
        if (web) node.url = web;
        else if (parseFileRef(node.url))
          node.url = `./${node.url.replace(/^\.\//, "")}`;
        return;
      }
      if (node.type === "code" || node.type === "inlineCode") return;
      if (!("children" in node)) return;
      const children: RootContent[] = node.children;
      node.children = children.flatMap<RootContent>((child) => {
        if (child.type !== "text") {
          visit(child);
          return [child];
        }
        const parts: (Text | Link)[] = [];
        let offset = 0;
        for (const match of child.value.matchAll(/\S+/g)) {
          const word = match[0];
          const leading = word.match(/^[([“"']*/)?.[0].length ?? 0;
          const candidate = word.slice(leading).replace(/[)\],;.!?“”"']+$/, "");
          const web = webAddress(candidate);
          if (!web && !parseFileRef(candidate)) continue;
          const start = match.index + leading;
          if (start > offset)
            parts.push({
              type: "text",
              value: child.value.slice(offset, start),
            });
          parts.push({
            type: "link",
            url: web ?? `./${candidate.replace(/^\.\//, "")}`,
            children: [{ type: "text", value: candidate }],
          });
          offset = start + candidate.length;
        }
        if (!parts.length) return [child];
        if (offset < child.value.length)
          parts.push({ type: "text", value: child.value.slice(offset) });
        return parts;
      }) as typeof node.children;
    }
    visit(tree);
  };
}
