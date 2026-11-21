import type { HistoryEntry } from "./history";
import type { Members } from "./multiplayer";
import type { ProcessRecord } from "./processes";

// The take-back card (ADR 0038, round 2 "Kortti"): after the owner takes a
// participant's full rights back or removes them, the processes the agent
// started on that person's turns are offered for stopping. Which turn started
// a process is read from the conversation's history as the browser has it: the
// process tool call whose result names the process, and the message that
// opened that turn (the owner's own message, or a participant's). The daemon's
// inventory says what runs; nothing here is stored beyond the tab.

/** Who opened the turn in which the agent started a process. */
export type Origin =
  | {
      by: "participant";
      subject: string;
      display_name: string;
      message_id: string;
      text: string;
      /** The participant message's timestamp (ISO), when history has one. */
      at?: string;
    }
  | { by: "owner" }
  | { by: "unknown" };

export const processKey = (p: Pick<ProcessRecord, "id" | "started_at">) =>
  `${p.id}:${p.started_at}`;

/** The process a `process` start call's result names, as the companion's
 * tool result carries it (the same reading as the process receipt). */
function startedProcess(
  result: string | undefined,
): { id: string; startedAt?: number; token?: string } | undefined {
  if (!result) return;
  try {
    const native = JSON.parse(result);
    const source =
      native?.process ?? native?.details?.process ?? native?.details ?? native;
    if (typeof source?.id !== "string") return;
    const startedAt =
      source.started_at ?? source.startedAt ?? source.startTime ?? undefined;
    return {
      id: source.id,
      startedAt: typeof startedAt === "number" ? startedAt : undefined,
      token:
        typeof source.process_token === "string"
          ? source.process_token
          : undefined,
    };
  } catch {
    return;
  }
}

function startCall(argumentsText: string | undefined): boolean {
  try {
    return JSON.parse(argumentsText ?? "")?.action === "start";
  } catch {
    return false;
  }
}

const resultText = (entry: HistoryEntry) =>
  entry.blocks
    ?.filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");

/** Each process's origin. A process whose start call is not in the loaded
 * history falls back to the turn open at its start time, when the loaded
 * history reaches back that far; otherwise its origin is unknown. Unknown is
 * never read as the owner's: such a process is still offered. */
export function processOrigins(
  entries: readonly HistoryEntry[],
  processes: readonly ProcessRecord[],
): Map<string, Origin> {
  const origins = new Map<string, Origin>();
  const results = new Map<string, string | undefined>();
  for (const entry of entries)
    if (entry.kind === "tool" && entry.tool_call_id)
      results.set(entry.tool_call_id, resultText(entry));
  // Openers in history order, with their time, for the fallback.
  const timeline: { at: number; origin: Origin }[] = [];
  let opener: Origin = { by: "unknown" };
  let firstAt: number | undefined;
  // Participant messages by ID: the owner's continue line names one, and
  // the run it starts acts on that person's request.
  const messages = new Map<string, Origin>();
  for (const entry of entries) {
    const at = entry.timestamp ? Date.parse(entry.timestamp) : Number.NaN;
    if (firstAt === undefined && Number.isFinite(at)) firstAt = at;
    const fact = entry.participant_message;
    if (fact) {
      opener = {
        by: "participant",
        subject: fact.subject,
        display_name: fact.display_name,
        message_id: fact.message_id,
        text: fact.text,
        at: entry.timestamp,
      };
      messages.set(fact.message_id, opener);
      if (Number.isFinite(at)) timeline.push({ at, origin: opener });
      continue;
    }
    const line = entry.conversation_line;
    if (line?.kind === "continue" && line.request) {
      // The line names the requester; without their loaded message there
      // is only no quote to show.
      opener = messages.get(line.request) ?? {
        by: "participant",
        subject: line.subject,
        display_name: line.display_name,
        message_id: "",
        text: "",
      };
      if (Number.isFinite(at)) timeline.push({ at, origin: opener });
      continue;
    }
    if (entry.kind === "user") {
      opener = { by: "owner" };
      if (Number.isFinite(at)) timeline.push({ at, origin: opener });
      continue;
    }
    if (entry.kind !== "assistant") continue;
    for (const block of entry.blocks ?? []) {
      if (
        block.type !== "toolCall" ||
        block.tool_name !== "process" ||
        !block.tool_call_id
      )
        continue;
      // Only the start call says whose turn started it: a later write or
      // rename names the same process from another turn.
      if (!startCall(block.text)) continue;
      const started = startedProcess(results.get(block.tool_call_id));
      if (!started) continue;
      const record = processes.find(
        (p) =>
          p.id === started.id &&
          (p.process_token === started.token ||
            p.started_at === started.startedAt),
      );
      if (record) origins.set(processKey(record), opener);
    }
  }
  for (const p of processes) {
    const key = processKey(p);
    if (origins.has(key)) continue;
    let origin: Origin = { by: "unknown" };
    if (firstAt !== undefined && firstAt <= p.started_at)
      for (const t of timeline) {
        if (t.at > p.started_at) break;
        origin = t.origin;
      }
    origins.set(key, origin);
  }
  return origins;
}

const live = (p: ProcessRecord) =>
  p.status === "running" ||
  p.status === "terminating" ||
  p.status === "terminate_timeout";

/** A take-back the owner made in this tab, before history carries its line. */
export type TakeBack = {
  kind: "took" | "removed";
  subject: string;
  name: string;
  /** When it was made (ms). */
  at: number;
  revocation?: Members["revocation"];
};

export type OfferRow = {
  process: ProcessRecord;
  origin: Extract<Origin, { by: "participant" }> | { by: "unknown" };
};

/** One person's take-back with the processes it offers for stopping. */
export type Offer = {
  take: TakeBack;
  /** From this tab's action (shown even with nothing running), or only
   * from history (shown while something of theirs runs). */
  fromAction: boolean;
  /** The person's processes: live ones, and those that ended since the
   * take-back, which stay struck through until the offer resolves. */
  rows: OfferRow[];
  /** Live processes of unknown origin, offered too. Only on the newest
   * offer, so they are not listed twice. */
  unknown: OfferRow[];
  /** How many of the person's processes still run. */
  running: number;
  /** Live processes not offered: the owner's own and other people's. */
  others: number;
};

/** The latest take-back per person: this tab's actions and history's
 * Habitat lines, the newer winning. A person who has full rights again has
 * no offer. */
export function takeBackOffers(
  entries: readonly HistoryEntry[],
  actions: readonly TakeBack[],
  processes: readonly ProcessRecord[],
  members: Members | undefined,
): Offer[] {
  const latest = new Map<string, { take: TakeBack; fromAction: boolean }>();
  for (const entry of entries) {
    const line = entry.conversation_line;
    if (
      line?.kind !== "membership" ||
      (line.event !== "full_rights_taken" && line.event !== "removed")
    )
      continue;
    const at = entry.timestamp ? Date.parse(entry.timestamp) : 0;
    latest.set(line.subject, {
      take: {
        kind: line.event === "removed" ? "removed" : "took",
        subject: line.subject,
        name: line.display_name,
        at: Number.isFinite(at) ? at : 0,
      },
      fromAction: false,
    });
    // A later grant of full rights ends an earlier take-back's offer.
  }
  for (const entry of entries) {
    const line = entry.conversation_line;
    if (line?.kind === "membership" && line.event === "full_rights_given") {
      const prior = latest.get(line.subject);
      const at = entry.timestamp ? Date.parse(entry.timestamp) : 0;
      if (prior && !prior.fromAction && prior.take.at <= at)
        latest.delete(line.subject);
    }
  }
  for (const take of actions) {
    const prior = latest.get(take.subject);
    // The action outranks its own line once history carries it: it knows
    // whether the running Pi was told.
    if (!prior || prior.take.at <= take.at + 60_000)
      latest.set(take.subject, { take, fromAction: true });
  }
  if (!latest.size) return [];
  const origins = processOrigins(entries, processes);
  const offers: Offer[] = [];
  for (const { take, fromAction } of latest.values()) {
    const member = members?.members.find((m) => m.subject === take.subject);
    if (member?.role === "full_rights") continue;
    const rows: OfferRow[] = [];
    for (const p of processes) {
      const origin = origins.get(processKey(p));
      if (origin?.by !== "participant" || origin.subject !== take.subject)
        continue;
      if (live(p) || (p.ended_at ?? 0) >= take.at)
        rows.push({ process: p, origin });
    }
    const running = rows.filter((r) => live(r.process)).length;
    offers.push({ take, fromAction, rows, unknown: [], running, others: 0 });
  }
  offers.sort((a, b) => a.take.at - b.take.at);
  // Live processes of unknown origin go on the newest take-back, which then
  // stays even when nothing known of that person's runs (after a reload the
  // start may lie beyond the loaded history).
  const unknown: OfferRow[] = processes
    .filter((p) => live(p) && origins.get(processKey(p))?.by === "unknown")
    .map((p) => ({ process: p, origin: { by: "unknown" } }));
  const newest = offers.at(-1);
  if (newest) newest.unknown = unknown;
  const shown = offers.filter(
    (o) => o.fromAction || o.running > 0 || o.unknown.length > 0,
  );
  for (const offer of shown)
    offer.others = processes.filter(
      (p) =>
        live(p) &&
        !offer.rows.some((r) => r.process === p) &&
        !offer.unknown.some((r) => r.process === p),
    ).length;
  return shown;
}
