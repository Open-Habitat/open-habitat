import type { HistoryEntry } from "./history";
import type { Spinoff } from "./spinoffs";

// Kerro agentille (Jari 28.–29.10.2026, proto-ended-worker-lifecycle round 3,
// Vanhempi): an ended worker's row sends the conversation that started it a
// request to look at exactly that worktree and recommend what to do. The
// request is the person's own message through the composer's send path. It
// names the Taskfleet run, so the conversation itself is the record of which
// rows are being handled: nothing else stores it.

/** Where a row's request is: waiting in the queue, sent but not yet in the
 * history, the agent checking, waiting for the person's answer, or the
 * agent acting on that answer. */
export type RequestPhase = "queued" | "sent" | "checking" | "answer" | "acting";

/** Whether an ended row is one the agent is asked about: its branch or
 * worktree is still on disk. */
export function askable(run: Spinoff) {
  return (
    run.preserved &&
    (run.state === "unmerged" ||
      run.state === "failed" ||
      run.state === "merged")
  );
}

/** Work that has not reached the source branch: the row's red ball. */
export function unfinished(run: Spinoff) {
  return askable(run) && run.state !== "merged";
}

const marker = (run: Spinoff) => `Taskfleet-ajo ${run.run_id}`;

const clock = (iso?: string) => {
  const ms = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(ms)
    ? new Date(ms)
        .toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })
        .replace(":", ".")
    : "";
};

function oneLine(run: Spinoff) {
  const at = clock(run.ended_at);
  const when = at ? ` klo ${at}` : "";
  const what =
    run.state === "merged"
      ? "mergetty, worktree jäljellä"
      : run.state === "failed"
        ? `epäonnistui${when}, työ tallessa`
        : `päättyi${when}, ei mergetty, työ tallessa`;
  const facts = [
    marker(run),
    run.branch ? `haara ${run.branch}` : "",
    run.worktree ? `worktree ${run.worktree}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return `”${run.title || run.run_id}” (${facts}): ${what}`;
}

/** The request as the person's message. `parent` names the conversation
 * that started the workers when the request goes elsewhere. */
export function requestText(runs: Spinoff[], parent?: string) {
  const tail = "Älä muuta mitään ennen kuin vastaan.";
  if (runs.length === 1) {
    const [run] = runs;
    const from = parent ? ` Sen käynnisti keskustelu ”${parent}”.` : "";
    const verbs =
      run.state === "merged" ? "siivotaanko se" : "mergeä, jatka tai hylkää";
    return `Käsittele worker ${oneLine(run)}.${from} Tarkista sen tila ja suosittele, mitä sille tehdään: ${verbs}. ${tail}`;
  }
  const from = parent ? `Workerit käynnisti keskustelu ”${parent}”.\n` : "";
  return `Käsittele nämä ${runs.length} keskeneräistä workeria:\n${runs
    .map((r, i) => `${i + 1}. ${oneLine(r)}`)
    .join(
      "\n",
    )}\n${from}Tarkista kunkin tila ja suosittele, mitä niille tehdään: mergeä, jatka tai hylkää. ${tail}`;
}

/**
 * Each askable row's phase, read from the conversation that received the
 * request: its queue, the daemon's held messages and a send not yet in the
 * history, then the newest user message naming the run after it ended.
 * When that message is still the newest one, the agent is checking (in a
 * turn) or waiting for the answer (turn over, a reply after it). A later
 * message is the person's answer: the agent acts on it in its turn, and
 * once that turn is over a row still on disk is unhandled again ("jätä
 * toistaiseksi" brings back the ball).
 */
export function requestPhases({
  runs,
  entries,
  queued = [],
  sent = [],
  working,
}: {
  runs: Spinoff[];
  entries: HistoryEntry[];
  /** Texts in Pi's steering and follow-up queues. */
  queued?: string[];
  /** Texts held by the daemon until Pi runs, or a send not yet in history. */
  sent?: string[];
  /** The conversation is in a turn. */
  working: boolean;
}): Record<string, RequestPhase> {
  const phases: Record<string, RequestPhase> = {};
  const users = entries
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.kind === "user");
  const delivered = new Set(users.map(({ e }) => e.content.text));
  for (const run of runs) {
    if (!askable(run)) continue;
    const name = marker(run);
    if (queued.some((t) => t.includes(name))) {
      phases[run.run_id] = "queued";
      continue;
    }
    // A send the history already shows is no longer on its way.
    if (sent.some((t) => t.includes(name) && !delivered.has(t))) {
      phases[run.run_id] = "sent";
      continue;
    }
    const ended = run.ended_at ? Date.parse(run.ended_at) : Number.NaN;
    const request = users.findLast(({ e }) => {
      if (!e.content.text.includes(name)) return false;
      const at = e.timestamp ? Date.parse(e.timestamp) : Number.NaN;
      // A message from before the run ended is not a request about it.
      return !(Number.isFinite(at) && Number.isFinite(ended) && at < ended);
    });
    if (!request) continue;
    const later = users.filter(({ i }) => i > request.i);
    if (later.length) {
      // Only the turn on the person's answer, still the newest message,
      // acts on it; a later unrelated message is no handling of this row.
      if (working && later.length === 1) phases[run.run_id] = "acting";
      continue;
    }
    if (working) phases[run.run_id] = "checking";
    else
      phases[run.run_id] = entries
        .slice(request.i + 1)
        .some((e) => e.kind === "assistant")
        ? "answer"
        : "sent";
  }
  return phases;
}
