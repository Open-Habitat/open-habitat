import type { GitSummaryFacts } from "../components/GitStatus";
import type { WorkerPullRequest, WorkerWork } from "./spinoffWork";

// Lause (proto-worker-row-work-facts, Jari 29.10.2026): a worker row says in
// words, on its existing second line, whether the worker has produced
// anything. Unknown is never said as zero: "ei vielä muutoksia" only when Git
// answered and counted nothing, and a pull request that gh could not read is
// left unsaid rather than called absent.

export type WorkTone = "work" | "muted";
export type CheckTone = "ok" | "err" | "run" | "muted";
export interface WorkClause {
  text: string;
  tone: WorkTone;
}

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** The row's work clause: "2 committia · 3 muutosta", "ei vielä muutoksia"
 * or "työn tila ei tiedossa". Undefined when nothing can be said. */
export function workClause(work: {
  git: WorkerWork["git"];
  ahead?: number;
  dirty_count?: number;
}): WorkClause | undefined {
  if (work.git !== "available")
    return { text: "työn tila ei tiedossa", tone: "muted" };
  const { ahead, dirty_count: dirty } = work;
  if (ahead === 0 && !dirty)
    return { text: "ei vielä muutoksia", tone: "muted" };
  const parts = [
    ahead ? count(ahead, "commit", "committia") : "",
    // "muutos/muutosta" as the home page's worktree card says it.
    dirty ? count(dirty, "muutos", "muutosta") : "",
  ].filter(Boolean);
  // Without the comparison a clean worktree says nothing for sure.
  if (!parts.length) return undefined;
  return { text: parts.join(" · "), tone: "work" };
}

/** The checks in one word and tone: a failure outranks a running check,
 * which outranks success. */
export function checksWord(pr: WorkerPullRequest): {
  text: string;
  short: string;
  tone: CheckTone;
} {
  if (pr.state === "merged")
    return { text: "yhdistetty", short: "yhdistetty", tone: "ok" };
  if (pr.state === "closed")
    return { text: "suljettu", short: "suljettu", tone: "muted" };
  const { passed, failed, pending } = pr.checks;
  if (failed)
    return {
      text:
        failed === 1
          ? "tarkistus epäonnistui"
          : `${failed} tarkistusta epäonnistui`,
      short: "epäonnistui",
      tone: "err",
    };
  if (pending)
    return { text: "tarkistukset käynnissä", short: "käynnissä", tone: "run" };
  if (passed) return { text: "tarkistukset läpi", short: "läpi", tone: "ok" };
  return { text: "ei tarkistuksia", short: "", tone: "muted" };
}

/** "PR #412 luonnos": the pull request's name on the row. */
export function prName(pr: WorkerPullRequest) {
  return `PR #${pr.number}${pr.state === "draft" ? " luonnos" : ""}`;
}

/** The whole sentence, for the worker view and the row's accessible name:
 * "2 committia haarassa, 3 tiedostoa commitoimatta. 146 riviä lisätty ja 12
 * poistettu. main on edennyt 5 commitilla. PR #412 (luonnos): tarkistukset
 * käynnissä." */
export function workSentence(work: WorkerWork, sourceBranch: string): string {
  const parts: string[] = [];
  const clause = workClause(work);
  if (work.git !== "available")
    parts.push("Työn tila ei tiedossa: Git ei vastannut workerin haarasta.");
  else if (clause?.tone === "muted") parts.push("Ei vielä muutoksia.");
  else if (clause) {
    const said = [
      work.ahead !== undefined
        ? `${count(work.ahead, "commit", "committia")} haarassa`
        : "",
      work.dirty_count !== undefined
        ? `${count(work.dirty_count, "tiedosto", "tiedostoa")} commitoimatta`
        : "",
    ].filter(Boolean);
    parts.push(`${said.join(", ")}.`);
    if (work.added !== undefined && work.removed !== undefined)
      parts.push(
        `${count(work.added, "rivi", "riviä")} lisätty ja ${work.removed} poistettu.`,
      );
  }
  if (work.behind)
    parts.push(
      `${sourceBranch || "Lähtöhaara"} on edennyt ${work.behind} commitilla.`,
    );
  if (work.pull_request_state === "found" && work.pull_request) {
    const pr = work.pull_request;
    const checks = checksWord(pr).text;
    parts.push(
      `PR #${pr.number}${pr.state === "draft" ? " (luonnos)" : ""}: ${checks}.`,
    );
  } else if (work.pull_request_state === "none")
    parts.push("Ei pull requestia.");
  else if (work.pull_request_state === "unknown")
    parts.push("PR-tieto ei saatavilla.");
  return parts.join(" ");
}

/** A worktree conversation's short line in the rail, from the snapshot's own
 * Git summary of the place: "2 committia · 1 muutos". The rail asks GitHub
 * nothing. */
export function placeWorkClause(
  summary: GitSummaryFacts | undefined,
): WorkClause | undefined {
  if (!summary) return { text: "työn tila ei tiedossa", tone: "muted" };
  return workClause({
    git: "available",
    ahead: summary.base?.ahead,
    dirty_count: summary.dirty_count,
  });
}
