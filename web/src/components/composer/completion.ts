// The composer's text rules, as Pi's TUI has them: a leading `!` runs the
// text as a shell command in the workspace, `!!` keeps its output from Pi; a
// `/command` runs only at the start of a message, so a mid-line `/` is a
// mention; `@path` is inserted as text and Pi reads the file itself.

export type CaretToken = {
  kind: "cmd" | "file";
  start: number;
  end: number;
  query: string;
  /** A `/` with only whitespace before it: Pi would run the command. */
  atStart: boolean;
};

// Markdown image references are prompts, not shell commands.
export const isShell = (text: string) =>
  text.startsWith("!") && !text.startsWith("![");
/** `!!`: Pi records the output but never gives it to the model. */
export const shellExcluded = (text: string) => text.startsWith("!!");
export const shellCommand = (text: string) => text.replace(/^!!?/, "").trim();

/** The `/` or `@` token the caret is in, if any. In a shell command both are
 * the shell's own text. `/` opens only at a word start and only for name
 * characters, so a path such as /tmp/notes.md closes it. */
export function caretToken(text: string, caret: number): CaretToken | null {
  if (isShell(text)) return null;
  const before = text.slice(0, caret);
  let m = before.match(/(^|\s)@([^\s]*)$/);
  if (m)
    return {
      kind: "file",
      start: caret - m[2].length - 1,
      end: caret,
      query: m[2],
      atStart: false,
    };
  m = before.match(/(^|\s)\/([\w:.-]*)$/);
  if (m) {
    const start = caret - m[2].length - 1;
    return {
      kind: "cmd",
      start,
      end: caret,
      query: m[2],
      atStart: before.slice(0, start).trim() === "",
    };
  }
  return null;
}

/** Zero when the query's characters do not occur in order. Consecutive
 * characters, word starts and a whole-substring match score more; longer text
 * a little less. The daemon ranks files the same way. */
export function fuzzyScore(text: string, query: string): number {
  if (!query) return 1;
  const s = text.toLowerCase();
  const q = query.toLowerCase();
  let at = 0;
  let last = -2;
  let score = 0;
  for (const ch of q) {
    const j = s.indexOf(ch, at);
    if (j < 0) return 0;
    score +=
      (j === last + 1 ? 3 : 1) +
      (j === 0 || "/._-:".includes(s[j - 1]) ? 2 : 0);
    last = j;
    at = j + ch.length;
  }
  return score + (s.includes(q) ? 6 : 0) - s.length * 0.01;
}

/** A path as a shell word: bare when it is plainly safe, else single-quoted. */
export function shellQuote(path: string): string {
  return /^[\w@%+=:,./-]+$/.test(path)
    ? path
    : `'${path.replace(/'/g, `'\\''`)}'`;
}

/** How chosen files go into the text: `@path` in a message, a quoted path in
 * a shell command, as tmux-file-picker does for a non-agent pane. */
export function fileInsertion(paths: string[], shell: boolean): string {
  return `${paths.map((p) => (shell ? shellQuote(p) : `@${p}`)).join(" ")} `;
}

/** A command chosen from a button or the palette goes to the start of the
 * message, where Pi runs it, replacing a command already there. */
export function withLeadingCommand(text: string, name: string) {
  const lead = text.match(/^\/[\w:.-]+ ?/);
  const replaced = lead ? lead[0].length : 0;
  return { start: 0, end: replaced, insert: `/${name} ` };
}
