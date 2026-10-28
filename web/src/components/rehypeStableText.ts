import type { ElementContent, Root, RootContent } from "hast";

/** Characters per text node; only the last piece of a growing run changes. */
export const STABLE_TEXT_CHUNK = 64;

/**
 * Splits text at fixed offsets from its start. A streamed reply only appends,
 * so every piece but the last keeps its exact value and React leaves that DOM
 * text node alone. Rewriting one node's whole value would collapse a
 * selection anywhere inside it (DOM "replace data").
 */
export function stableChunks(text: string): string[] {
  if (text.length <= STABLE_TEXT_CHUNK) return [text];
  const chunks: string[] = [];
  for (let at = 0; at < text.length; ) {
    let end = at + STABLE_TEXT_CHUNK;
    // Never cut a character apart: not a surrogate pair, a combining mark or
    // variation selector from its base, nor a joined emoji sequence.
    while (end < text.length && joined(text, end)) end++;
    chunks.push(text.slice(at, end));
    at = end;
  }
  return chunks;
}
// Whether a cut before text[at] would separate code units of one character.
function joined(text: string, at: number): boolean {
  const before = text.charCodeAt(at - 1);
  const next = text.charCodeAt(at);
  return (
    (before >= 0xd800 && before <= 0xdbff) || // high surrogate
    before === 0x200d || // zero width joiner
    next === 0x200d ||
    next === 0xfe0e ||
    next === 0xfe0f || // variation selectors
    // Skin tone modifiers U+1F3FB–U+1F3FF.
    (next === 0xd83c &&
      text.charCodeAt(at + 1) >= 0xdffb &&
      text.charCodeAt(at + 1) <= 0xdfff) ||
    combining.test(text[at])
  );
}
const combining = /^\p{M}$/u;

// Code and links read their text as one string (fence content, file
// references, download names), so their text stays whole.
const whole = new Set(["pre", "code", "a"]);

export default function rehypeStableText() {
  return (tree: Root) => {
    function visit(node: Root | RootContent) {
      if (!("children" in node)) return;
      if (node.type === "element" && whole.has(node.tagName)) return;
      const children: (RootContent | ElementContent)[] = node.children;
      node.children = children.flatMap<RootContent | ElementContent>(
        (child) => {
          if (child.type !== "text") {
            visit(child);
            return [child];
          }
          return stableChunks(child.value).map((value) => ({
            type: "text" as const,
            value,
          }));
        },
      ) as typeof node.children;
    }
    visit(tree);
  };
}
