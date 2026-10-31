import { formatDate, formatNumber, liveText } from "../i18n";
import { trashText } from "../text/trash";
import type {
  DeletionBlocker,
  DeletionGit,
  PiActivity,
  refusalCodes,
} from "./workspaceTrash";

const txt = liveText(trashText);

// The texts of workspace deletion and the Trash (ADR 0019), from
// text/trash.ts. Host values
// (process names, paths, run IDs) are only ever shown as code segments.
export type Segment = string | { code: string };
export type BlockerText = {
  what: Segment[];
  how: string;
  command?: string;
};

const unknownChecks = new Proxy(
  {} as Record<NonNullable<DeletionBlocker["check"]>, string>,
  { get: (_target, check: string) => txt.unknownChecks[check] },
);

const process = (b: DeletionBlocker): Segment[] =>
  b.comm
    ? [{ code: b.comm }, ` (PID ${b.pid ?? "?"})`]
    : [`PID ${b.pid ?? "?"}`];

/**
 * A busy conversation in the directory being removed, by what it is doing.
 * Idle conversations never block: deletion stops their Pi, and a later
 * message resumes it.
 */
export function piSessionText(
  activity: PiActivity | undefined,
  /** Genitive: txt.thisWorkspace or txt.thisWorktree. */
  place: string,
): BlockerText {
  switch (activity) {
    case "question":
      return {
        what: [txt.question(place)],
        how: txt.questionHow,
      };
    case "processes":
      return {
        what: [txt.processes(place)],
        how: txt.processesHow,
      };
    case "unknown":
      return {
        what: [txt.piUnknown(place)],
        how: txt.piUnknownHow,
      };
    default:
      return {
        what: [txt.working(place)],
        how: txt.workingHow,
      };
  }
}

export function blockerText(b: DeletionBlocker): BlockerText {
  const path = b.path ?? "";
  switch (b.kind) {
    case "file_operation":
      return {
        what: [txt.fileOperation],
        how: txt.fileOperationHow,
      };
    case "pi_session":
      return piSessionText(b.activity, txt.thisWorkspace);
    case "process":
      if (b.product === "terminal")
        return {
          what: [txt.terminal],
          how: txt.terminalHow,
        };
      if (b.product === "editor")
        return {
          what: [txt.editor],
          how: txt.editorHow,
        };
      return {
        what: [txt.processBefore, ...process(b), txt.processAfter],
        how: txt.processHow,
      };
    case "taskfleet_run":
      return {
        what: [txt.runBefore, { code: b.run_id ?? "" }, txt.runAfter],
        how: txt.runHow,
        command: `taskfleet run cancel ${b.run_id ?? ""}`,
      };
    case "linked_worktree":
      return {
        what: [txt.linkedBefore, { code: path }, "."],
        how: txt.linkedHow,
        command: `git worktree remove ${shellWord(path)}`,
      };
    case "locked_worktree":
      return {
        what: [txt.lockedBefore, { code: path }, "."],
        how: txt.lockedHow,
        command: `git worktree unlock ${shellWord(path)} && git worktree remove ${shellWord(path)}`,
      };
    case "is_linked_worktree":
      return {
        what: [txt.isLinked],
        how: txt.isLinkedHow,
      };
    case "contains_linked_worktree":
      return {
        what: [txt.containsBefore, { code: path }, "."],
        how: txt.containsHow,
      };
    case "mount":
      return {
        what: [txt.mountBefore, { code: path }, "."],
        how: txt.mountHow,
      };
    case "different_filesystem":
      return {
        what: [txt.differentFs],
        how: txt.differentFsHow,
      };
    case "last_workspace":
      return { what: [txt.lastWorkspace], how: txt.lastWorkspaceHow };
    case "unknown":
      if (b.check === "processes" && b.pid)
        return {
          what: [
            txt.processUnknownBefore,
            ...process(b),
            txt.processUnknownAfter,
          ],
          how: txt.unknownHow,
        };
      return {
        what: [b.check ? unknownChecks[b.check] : txt.checkFailed],
        how: txt.unknownHow,
      };
  }
}

// Only what a shell would split or expand needs quoting in a copied command.
export function shellWord(s: string): string {
  return /^[\w@%+=:,./~-]+$/.test(s) ? s : `'${s.replaceAll("'", `'\\''`)}'`;
}

type Refusal = (typeof refusalCodes)[number];
const refusals = new Proxy(
  {} as Record<
    Refusal | "identity_lost" | "invalid_reply" | "unavailable",
    string
  >,
  { get: (_target, code: string) => txt.refusals[code] },
);
export function refusalText(code: string): string {
  return refusals[code as keyof typeof refusals] ?? refusals.unavailable;
}

// What exists only on this server: the facts the confirmation and the Trash
// repeat, because a permanent deletion loses exactly these.
export function onlyHere(git: DeletionGit | undefined): string[] {
  if (!git) return [];
  const out: string[] = [];
  if (git.state !== "observed") out.push(txt.gitPartial);
  if (!git.remote_refs) out.push(txt.noRemote);
  if (git.changed) out.push(txt.changed(git.changed));
  if (git.untracked) out.push(txt.untracked(git.untracked));
  if (git.remote_refs && git.unpushed) out.push(txt.unpushed(git.unpushed));
  if (git.stash) out.push(txt.stash(git.stash));
  if (git.nested_repositories) out.push(txt.nested(git.nested_repositories));
  return out;
}

// Short labels for a Trash row.
export function gitChips(git: DeletionGit | undefined): {
  text: string;
  tone: "warn" | "ok";
}[] {
  if (!git) return [];
  const chips: { text: string; tone: "warn" | "ok" }[] = [];
  if (!git.remote_refs) chips.push({ text: txt.chipNoRemote, tone: "warn" });
  if (git.remote_refs && git.unpushed)
    chips.push({
      text: txt.chipUnpushed(git.unpushed),
      tone: "warn",
    });
  if (git.changed + git.untracked)
    chips.push({
      text: txt.chipChanges(git.changed + git.untracked),
      tone: "warn",
    });
  if (git.stash) chips.push({ text: "stash", tone: "warn" });
  if (git.state !== "observed")
    chips.push({ text: txt.chipGitUnknown, tone: "warn" });
  return chips.length ? chips : [{ text: txt.chipAllRemote, tone: "ok" }];
}

export const conversationsKept = (n: number) => txt.conversationsKept(n);

export function bytes(n: number): string {
  if (n < 1024 ** 2)
    return `${formatNumber(Math.max(1, Math.round(n / 1024)))} KiB`;
  if (n < 1024 ** 3)
    return `${formatNumber(n / 1024 ** 2, { maximumFractionDigits: n < 10 * 1024 ** 2 ? 1 : 0 })} MiB`;
  return `${formatNumber(n / 1024 ** 3, { maximumFractionDigits: 1 })} GiB`;
}

export function deletedAt(iso: string | undefined, now = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = formatDate(d, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return txt.today(time);
  return txt.onDay(
    formatDate(d, {
      day: "numeric",
      month: "numeric",
      ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
    }),
    time,
  );
}
