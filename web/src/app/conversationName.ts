/** The most a conversation name may be: one line, at most 160 UTF-8 bytes
 * (validTitle in the daemon). Returns "" when nothing nameable remains. */
export function conversationName(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what a name may not hold.
  let name = text.replace(/[\u0000-\u001f\u007f\s]+/g, " ").trim();
  const encoder = new TextEncoder();
  while (encoder.encode(name).length > 160)
    name = Array.from(name).slice(0, -1).join("").trimEnd();
  return name;
}
