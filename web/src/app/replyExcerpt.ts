// Replying to one agent message (reply-to-message, experimental; Jari
// 23.11.2026). The daemon reads the excerpt the agent receives from the
// native session (internal/replyblock); the field shows the same excerpt
// before sending, so this is the same rule over the text the view already
// has. The person's sent message then shows the daemon's own excerpt.

import type { HistoryEntry } from "./history";

export const maxExcerpt = 160;

const fence = /^\s*(`{3,}|~{3,})/;
const listItem = /^\s*(?:[-*+]|\d{1,9}[.)])\s+\S/;
const attachmentRef = /\/api\/v1\/attachments\/[0-9a-f-]{36}/g;

/** The agent message's text blocks as the excerpt reads them. */
export function replyText(entry: HistoryEntry): string {
  if (!entry.blocks?.length) return entry.content.text;
  return entry.blocks
    .filter((b) => b.type === "text" && b.text?.trim())
    .map((b) => b.text ?? "")
    .join("\n\n");
}

/** The first sentence of the first line, at most 160 characters cut at a
 * word with " …"; a list keeps its first item with the marker, a code block
 * its fence and first code line, closed again. */
export function replyExcerpt(source: string): string {
  let text = source.replace(/\r\n?/g, "\n");
  while (text.includes("</reply-to")) text = text.replaceAll("</reply-to", "");
  text = text.replace(attachmentRef, "[attachment]").trim();
  if (!text) return "";
  const lines = text.split("\n");
  const first = lines[0].replace(/[ \t]+$/, "");
  const opening = fence.exec(first);
  if (opening) {
    const head = first.trim();
    let code = "";
    let consumed = 1;
    for (let i = 1; i < lines.length; i++) {
      if (fence.test(lines[i])) {
        consumed = i + 1;
        break;
      }
      if (lines[i].trim()) {
        code = lines[i].replace(/[ \t]+$/, "");
        consumed = i + 1;
        break;
      }
    }
    let after = lines.slice(consumed);
    if (after.length && fence.test(after[0])) after = after.slice(1);
    const more = after.join("\n").trim() !== "";
    const budget = maxExcerpt - runes(head) - runes(opening[1]) - 2;
    if (budget < 8) return cut(head, maxExcerpt, true);
    return `${head}\n${cut(code, budget, more)}\n${opening[1]}`;
  }
  const sentence = listItem.test(first)
    ? first
    : firstSentence(first.replace(/^[ \t]+/, ""));
  const more = lines.length > 1 || sentence.trim() !== first.trim();
  return cut(sentence.trim(), maxExcerpt, more);
}

const stops = new Set([".", "!", "?"]);
const closers = new Set([".", "!", "?", ")", '"', "'", "”", "*", "_"]);
const starters = new Set(['"', "“", "'", "(", "«", "*", "_", "[", "`", "#"]);

function firstSentence(line: string): string {
  const r = Array.from(line);
  for (let i = 0; i < r.length; i++) {
    if (!stops.has(r[i])) continue;
    let j = i + 1;
    while (j < r.length && closers.has(r[j])) j++;
    if (j === r.length) return line;
    if (!/\s/u.test(r[j])) continue;
    let k = j;
    while (k < r.length && /\s/u.test(r[k])) k++;
    if (k === r.length || isUpper(r[k]) || starters.has(r[k]))
      return r.slice(0, j).join("");
  }
  return line;
}

function isUpper(c: string) {
  return c !== c.toLowerCase() && c === c.toUpperCase();
}

function cut(s: string, max: number, more: boolean): string {
  let r = Array.from(s);
  if (r.length <= max) {
    if (!more) return s;
    if (r.length + 2 <= max) return `${s} …`;
  }
  r = r.slice(0, max - 2);
  let space = -1;
  for (let i = r.length - 1; i >= 0; i--)
    if (/\s/u.test(r[i])) {
      space = i;
      break;
    }
  if (space >= Math.floor((max - 2) / 2)) r = r.slice(0, space);
  return `${r.join("").replace(/[ \t]+$/, "")} …`;
}

function runes(s: string) {
  return Array.from(s).length;
}
