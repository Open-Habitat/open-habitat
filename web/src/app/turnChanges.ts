import {
  argsOf,
  type Edit,
  editLines,
  readContent,
} from "../components/FileToolCard";

// What the agent changed in one turn (turn-changes, experimental), computed
// in the browser from the turn's own tool calls: Pi's edit and write
// arguments, the reads that show a file as it was, and the files a command
// names. Nothing here reads the disk or Git, so a command's effect is known
// only where the command names its file, and a file's text before the turn
// only where the turn read it whole first.

/** One tool call of the turn, with its arguments and result as Pi saved them. */
export type ToolStep = {
  callId: string;
  tool: string;
  /** The arguments JSON; empty when they could not be read. */
  args: string;
  output?: string;
  failed: boolean;
  /** When Pi saved the result (else the call), epoch ms. */
  at?: number;
};

/** One thing that changed a file, in the order the agent did it. */
export type FileEvent = {
  callId: string;
  tool: "edit" | "write" | "bash";
  at?: number;
  edits?: Edit[];
  content?: string;
  command?: string;
};

/**
 * modified: edited, or written over a file the turn had seen.
 * written: written without the turn having seen the file before, so new or
 * replaced, which the tool call does not tell.
 * deleted: a command removed it. command: a command touched it otherwise.
 */
export type Change = "modified" | "written" | "deleted" | "command";

export type Counts = { add: number; del: number };

export type FileChange = {
  /** Workspace-relative where the path is inside the workspace. */
  path: string;
  /** The path is relative to the workspace, so the editor can open it. */
  inWorkspace: boolean;
  change: Change;
  events: FileEvent[];
  /** The first command that touched the file. */
  command?: string;
  /** Text before the turn, when the turn read it whole first. */
  before?: string;
  /** Text after the turn, when every step is known. */
  after?: string;
  counts?: Counts;
  /** Where the editor opens: the first changed line, when known. */
  firstLine?: number;
};

type Op = [" " | "-" | "+", string];

const strip = (text: string) =>
  text ? text.replace(/\n$/, "").split("\n") : [];

/** A line diff; common head and tail lines are left out of the bounded LCS
 * so a small change in a long file stays small. */
export function lineDiff(before: string, after: string): Op[] {
  const a = strip(before);
  const b = strip(after);
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  )
    tail++;
  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const middle: Op[] =
    !midA.length && !midB.length
      ? []
      : !midA.length
        ? midB.map((l): Op => ["+", l])
        : !midB.length
          ? midA.map((l): Op => ["-", l])
          : editLines(midA.join("\n"), midB.join("\n"));
  return [
    ...a.slice(0, head).map((l): Op => [" ", l]),
    ...middle,
    ...a.slice(a.length - tail).map((l): Op => [" ", l]),
  ];
}

const countOps = (ops: Op[]): Counts => ({
  add: ops.filter((o) => o[0] === "+").length,
  del: ops.filter((o) => o[0] === "-").length,
});

/** The net change as the native unified diff FileToolCard already reads:
 * three lines of context and a quiet "⋯" row between hunks. */
export function unifiedDiff(path: string, before = "", after = ""): string {
  const ops = lineDiff(before, after);
  const keep = ops.map(() => false);
  ops.forEach(([op], i) => {
    if (op === " ") return;
    for (let j = Math.max(0, i - 3); j <= Math.min(ops.length - 1, i + 3); j++)
      keep[j] = true;
  });
  const lines: string[] = [];
  let gap = false;
  ops.forEach(([op, text], i) => {
    if (!keep[i]) {
      gap = lines.length > 0;
      return;
    }
    if (gap) lines.push(" ⋯");
    gap = false;
    lines.push(`${op}${text}`);
  });
  return `--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n${lines.join("\n")}`;
}

/** The first changed line after the change, 1-based. */
function firstChanged(before: string, after: string): number {
  let line = 0;
  for (const [op] of lineDiff(before, after)) {
    if (op !== "-") line++;
    if (op !== " ") return Math.max(1, op === "-" ? line + 1 : line);
  }
  return 1;
}

/** One event's own line counts, as its tool card showed them. */
export function eventCounts(e: FileEvent): Counts | undefined {
  if (e.edits)
    return countOps(e.edits.flatMap((x) => editLines(x.oldText, x.newText)));
  if (e.content !== undefined) return { add: strip(e.content).length, del: 0 };
  return undefined;
}

/** Pi's path as the workspace knows it: Pi strips a leading @ and resolves
 * relative paths against its working directory, the workspace. */
export function workspacePath(
  raw: string,
  root?: string,
): { path: string; inWorkspace: boolean } | undefined {
  let path = raw.trim().replace(/^@/, "");
  if (!path || path.includes("\0")) return undefined;
  const absolute = path.startsWith("/");
  const base = root?.replace(/\/+$/, "");
  if (absolute && base && path.startsWith(`${base}/`))
    path = path.slice(base.length + 1);
  else if (absolute || path.startsWith("~"))
    return { path, inWorkspace: false };
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (!parts.length) return { path: raw.trim(), inWorkspace: false };
      parts.pop();
    } else parts.push(part);
  }
  return parts.length
    ? { path: parts.join("/"), inWorkspace: true }
    : undefined;
}

// ---------- Commands ----------

/** Marks a word that was quoted: it is never an operator, flag or glob. */
const QUOTED = "\uE000";

/** Split a command line into simple commands and their words. Quotes are
 * honoured; anything this cannot read with confidence (substitutions,
 * variables, globs, a change of directory) ends what is known. */
function simpleCommands(line: string): string[][] {
  const out: string[][] = [];
  let words: string[] = [];
  let word = "";
  let quoted = false;
  let started = false;
  const end = () => {
    if (started) words.push(quoted ? QUOTED + word : word);
    word = "";
    quoted = false;
    started = false;
  };
  const close = () => {
    end();
    if (words.length) out.push(words);
    words = [];
  };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'") {
      const j = line.indexOf("'", i + 1);
      if (j < 0) return out;
      word += line.slice(i + 1, j);
      quoted = started = true;
      i = j;
    } else if (c === '"') {
      let j = i + 1;
      let text = "";
      for (; j < line.length && line[j] !== '"'; j++) {
        if (line[j] === "\\" && j + 1 < line.length) text += line[++j];
        else if (line[j] === "$" || line[j] === "`") return out;
        else text += line[j];
      }
      if (j >= line.length) return out;
      word += text;
      quoted = started = true;
      i = j;
    } else if (c === "\\" && i + 1 < line.length) {
      word += line[++i];
      started = true;
    } else if (c === "$" || c === "`" || c === "(" || c === ")") {
      // An expansion or subshell: this command and what follows are not known.
      return out;
    } else if (c === "<" && line[i + 1] === "<") {
      // A here-document's body is text, not commands.
      close();
      return out;
    } else if (c === ";" || c === "\n" || c === "|" || c === "&") {
      close();
      // `2>&1` and `&>` are redirections, not separators.
      if (c === "&" && line[i + 1] === ">") {
        words.push("&>");
        i++;
      }
    } else if (c === ">" || c === "<") {
      end();
      let op = c;
      if (line[i + 1] === ">" || line[i + 1] === "&" || line[i + 1] === "|")
        op += line[++i];
      // A descriptor before > belongs to the operator (2>, 1>>).
      const last = words.at(-1);
      if (last && /^[0-9]$/.test(last)) words[words.length - 1] = last + op;
      else words.push(op);
    } else if (c === " " || c === "\t") end();
    else {
      word += c;
      started = true;
    }
  }
  close();
  return out;
}

const plain = (word: string) => !word.startsWith(QUOTED);
const text = (word: string) => (plain(word) ? word : word.slice(1));
const unsure = (word: string) => plain(word) && /[*?[\]{}~]/.test(word);

/** The files a command names as created, changed or removed, in its order.
 * A file it only reads is not here. Where the command changes directory or
 * expands anything, what follows is left out rather than guessed. */
export function commandFiles(
  command: string,
): { path: string; deleted: boolean }[] {
  const out: { path: string; deleted: boolean }[] = [];
  const add = (word: string | undefined, deleted = false) => {
    if (word === undefined || unsure(word)) return;
    const path = text(word);
    if (!path || path === "/dev/null" || path.startsWith("-")) return;
    out.push({ path, deleted });
  };
  for (const all of simpleCommands(command)) {
    // Redirections: > file, >> file, 1> file, &> file; not 2>&1 or < file.
    const words: string[] = [];
    for (let i = 0; i < all.length; i++) {
      const w = all[i];
      if (plain(w) && /^([0-9]?>>?|&>|>\|)$/.test(w)) add(all[++i]);
      else if (plain(w) && /^[0-9]?(<|>&|<&)$/.test(w)) i++;
      else words.push(w);
    }
    while (
      words.length &&
      plain(words[0]) &&
      /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])
    )
      words.shift();
    if (words[0] === "sudo" || words[0] === "command") words.shift();
    let name = words[0] && text(words[0]);
    let args = words.slice(1);
    if (name === "git" && args.length) {
      // git -C elsewhere changes the directory.
      if (args.some((a) => a === "-C")) return out;
      name = `git ${text(args[0])}`;
      args = args.slice(1);
    }
    if (name === "cd" || name === "pushd" || name === "popd") return out;
    let operands = true;
    const files = args.filter((a) => {
      if (operands && plain(a) && a === "--") {
        operands = false;
        return false;
      }
      return !(operands && plain(a) && a.startsWith("-"));
    });
    switch (name) {
      case "rm":
      case "unlink":
      case "git rm":
        for (const f of files) add(f, true);
        break;
      case "mv":
      case "git mv":
        if (files.length >= 2) {
          for (const f of files.slice(0, -1)) add(f, true);
          add(files.at(-1));
        }
        break;
      case "cp":
      case "install":
      case "ln":
        if (files.length >= 2) add(files.at(-1));
        break;
      case "touch":
      case "tee":
        for (const f of files) add(f);
        break;
      case "sed":
      case "perl": {
        // In place only. A script follows -e or -f; without them the
        // first operand is the script.
        if (!args.some((a) => plain(a) && /^-[a-zA-Z]*i/.test(a))) break;
        const operands: string[] = [];
        let scripted = false;
        for (let i = 0; i < args.length; i++) {
          const a = args[i];
          if (plain(a) && (a === "-e" || a === "-f")) {
            scripted = true;
            i++;
          } else if (!(plain(a) && a.startsWith("-"))) operands.push(a);
        }
        for (const f of scripted ? operands : operands.slice(1)) add(f);
        break;
      }
    }
  }
  return out;
}

// ---------- The turn ----------

type State = {
  change: FileChange;
  /** The file's text as the steps so far leave it; undefined when unknown. */
  known?: string;
};

/**
 * The files the turn changed, in the order the turn first changed them.
 * A failed tool call changed nothing and is left out.
 */
export function turnChanges(steps: ToolStep[], root?: string): FileChange[] {
  const files = new Map<string, State>();
  const seen = new Map<string, string>();
  const state = (where: { path: string; inWorkspace: boolean }) => {
    let s = files.get(where.path);
    if (!s) {
      const before = seen.get(where.path);
      s = {
        change: {
          path: where.path,
          inWorkspace: where.inWorkspace,
          change: "modified",
          events: [],
          before,
        },
        known: before,
      };
      files.set(where.path, s);
    }
    return s;
  };
  for (const step of steps) {
    if (step.failed) continue;
    if (step.tool === "bash") {
      let command: string | undefined;
      try {
        const value: unknown = JSON.parse(step.args);
        command =
          value && typeof value === "object" && "command" in value
            ? String((value as { command: unknown }).command)
            : undefined;
      } catch {
        command = undefined;
      }
      if (!command) continue;
      for (const named of commandFiles(command)) {
        const where = workspacePath(named.path, root);
        if (!where) continue;
        const s = state(where);
        s.change.events.push({
          callId: step.callId,
          tool: "bash",
          at: step.at,
          command,
        });
        s.change.command ??= command;
        if (named.deleted) {
          s.change.change = "deleted";
          s.known = "";
        } else {
          if (s.change.change === "deleted") s.change.change = "command";
          else if (!s.change.events.some((e) => e.tool !== "bash"))
            s.change.change = "command";
          s.known = undefined;
        }
      }
      continue;
    }
    const args = argsOf(step.args);
    if (!args?.path) continue;
    const where = workspacePath(args.path, root);
    if (!where) continue;
    if (step.tool === "read") {
      // Only a whole read shows the file as it was; one that a later step
      // changed is already tracked from its first change.
      const raw = JSON.parse(step.args) as Record<string, unknown>; // argsOf parsed it
      if (raw.offset !== undefined || raw.limit !== undefined) continue;
      if (step.output === undefined) continue;
      const { text, note } = readContent(step.output);
      if (note || files.has(where.path)) continue;
      seen.set(where.path, text);
      continue;
    }
    if (step.tool === "edit" && args.edits?.length) {
      const s = state(where);
      s.change.events.push({
        callId: step.callId,
        tool: "edit",
        at: step.at,
        edits: args.edits,
      });
      if (s.change.change === "deleted") s.change.change = "command";
      if (s.known !== undefined) {
        let next: string | undefined = s.known;
        for (const e of args.edits) {
          const at = next.indexOf(e.oldText);
          if (at < 0) {
            next = undefined;
            break;
          }
          next =
            next.slice(0, at) + e.newText + next.slice(at + e.oldText.length);
        }
        s.known = next;
      }
      continue;
    }
    if (step.tool === "write" && args.content !== undefined) {
      const s = state(where);
      const first = !s.change.events.length;
      s.change.events.push({
        callId: step.callId,
        tool: "write",
        at: step.at,
        content: args.content,
      });
      // A write is a whole new text: what follows is known again.
      const seenBefore = s.change.before !== undefined;
      if (first && !seenBefore) s.change.change = "written";
      else if (s.change.change === "deleted" || s.change.change === "command")
        s.change.change = seenBefore ? "modified" : "written";
      s.known = args.content;
    }
  }
  return [...files.values()].map(({ change: f, known }) => {
    const before = f.before;
    if (f.change === "deleted") {
      if (before !== undefined)
        f.counts = { add: 0, del: strip(before).length };
      return f;
    }
    f.after = known;
    if (known === undefined) {
      // The file before the turn is unknown. Edits alone still add up, as
      // the sum of their cards; after a command nothing does.
      if (f.events.every((e) => e.tool === "edit"))
        f.counts = countOps(
          f.events.flatMap((e) =>
            (e.edits ?? []).flatMap((x) => editLines(x.oldText, x.newText)),
          ),
        );
      return f;
    }
    if (before !== undefined) {
      // The net change, however the steps got there.
      f.counts = countOps(lineDiff(before, known));
      f.firstLine = firstChanged(before, known);
    } else if (f.change === "written") {
      f.counts = { add: strip(known).length, del: 0 };
      f.firstLine = 1;
    }
    return f;
  });
}

/** The turn's line counts: the files whose counts are known, summed. */
export function totalCounts(files: FileChange[]): Counts {
  return files.reduce(
    (sum, f) =>
      f.counts
        ? { add: sum.add + f.counts.add, del: sum.del + f.counts.del }
        : sum,
    { add: 0, del: 0 },
  );
}
