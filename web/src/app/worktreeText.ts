import { liveText, textNow } from "../i18n";
import { trashText } from "../text/trash";
import { worktreesText } from "../text/worktrees";
import { refusalReason, writerHolder } from "./mutations";
import {
  type BlockerText,
  blockerText,
  piSessionText,
  refusalText,
} from "./trashText";
import type {
  Worktree,
  WorktreeBlocker,
  WorktreeRemoveResult,
} from "./workspaceWorktrees";

// Text for worktree cleanup (ADR 0025), from text/worktrees.tsx. Host
// values (branch names, paths, process names) are only ever shown as code
// segments.

const txt = liveText(worktreesText);

const tones: Record<Worktree["state"], "ok" | "warn" | "plain"> = {
  merged: "ok",
  unmerged: "plain",
  dirty: "warn",
  missing: "plain",
  locked: "plain",
  unknown: "warn",
};

/** A state's label in the current language and its tone. */
export const stateLabel = (state: Worktree["state"]) => ({
  text: txt.state[state],
  tone: tones[state],
});

export function worktreeBlockerText(b: WorktreeBlocker): BlockerText {
  switch (b.kind) {
    case "file_operation":
      return { what: [txt.fileOperation], how: txt.fileOperationHow };
    case "pi_session":
      return piSessionText(b.activity, textNow(trashText).thisWorktree);
    case "process":
      return {
        what: [
          txt.process,
          ...(b.comm
            ? [{ code: b.comm }, ` (PID ${b.pid ?? "?"})`]
            : [`PID ${b.pid ?? "?"}`]),
          txt.processEnd,
        ],
        how: txt.processHow,
      };
    case "taskfleet_run":
      return {
        what: [txt.run, { code: b.run_id ?? "" }, txt.runEnd],
        how: txt.runHow,
        command: `taskfleet run cancel ${b.run_id ?? ""}`,
      };
    case "contains_linked_worktree":
      return {
        what: [txt.nestedWorktree, { code: b.path ?? "" }, "."],
        how: txt.nestedWorktreeHow,
      };
    case "nested_repository":
      return {
        what: [txt.nestedRepo, { code: b.path ?? "" }, "."],
        how: txt.nestedRepoHow,
      };
    case "outside_home":
      return {
        what: [txt.outsideHome, { code: b.path ?? "" }, "."],
        how: txt.outsideHomeHow,
      };
    case "last_workspace":
      return blockerText({ kind: "last_workspace" });
    case "mount":
      return {
        what: [txt.mount, { code: b.path ?? "" }, "."],
        how: txt.mountHow,
      };
    case "unknown":
      if (b.check === "worktrees")
        return { what: [txt.unknown], how: txt.unknownHow };
      return blockerText({ ...b, kind: "unknown" });
  }
}

export const plainBlocker = (b: WorktreeBlocker) =>
  worktreeBlockerText(b)
    .what.map((p) => (typeof p === "string" ? p : p.code))
    .join("");

export function worktreeFacts(w: Worktree): string[] {
  const out: string[] = [];
  if (w.changed) out.push(txt.changed(w.changed));
  if (w.untracked) out.push(txt.untracked(w.untracked));
  if (w.state !== "dirty" && w.ahead)
    out.push(txt.ahead(w.ahead, w.base ?? "?"));
  if (w.unreachable_head) out.push(txt.unreachable);
  return out;
}

export function worktreeRefusalText(code: string): string {
  if (writerHolder(code)) return refusalReason(code);
  return txt.refusals[code] ?? refusalText(code);
}

/** The same person-facing name in rows, confirmations and outcomes. */
export function worktreeName(w: Worktree): string {
  const ownerName = w.owner?.role === "helper" ? w.owner.name : w.owner?.title;
  if (ownerName) return ownerName;
  const short = w.name.replace(/^wt-[a-z0-9]+-/, "").replace(/-/g, " ");
  return /^wt-[a-z0-9]+-/.test(w.name) ? txt.leftover(short) : w.name;
}

/** What happened, for the status line after a removal. */
export function removedText(w: Worktree, r: WorktreeRemoveResult): string {
  const name = worktreeName(w);
  if (r.state === "pruned") return txt.pruned(name);
  if (r.state === "blocked")
    return txt.blocked(name, (r.blockers ?? []).map(plainBlocker).join(" "));
  if (r.state === "partial") return txt.partial(name, r.remaining ?? 1);
  const saved = r.committed ? txt.committed : "";
  const branch = !r.branch
    ? ""
    : r.branch_deleted
      ? txt.branchDeleted
      : r.branch_kept === "not_merged"
        ? txt.branchStays
        : txt.branchStayed(r.branch_kept === "moved");
  return `${txt.removed(name)}${saved}${branch}`;
}
