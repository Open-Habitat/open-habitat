import {
  agentPresentation,
  backgroundServices,
  waitedFor,
  waitingName,
  waitsOnWorker,
} from "../components/agentPresentation";
import type { AgentNavModel, WorkspaceHint } from "../components/Navigation";
import type { WorkspaceIconModel } from "../components/WorkspaceIcon";
import { liveText } from "../i18n";
import { statusText } from "../text/status";
import { agentTitle } from "./agentTitle";
import {
  type ConversationMetadata,
  unreadableHistory,
} from "./conversationStore";
import type { Session } from "./conversations";
import {
  type Agent,
  browserOwned,
  type Snapshot,
  type Workspace,
  worktreeMerged,
} from "./snapshot";
import type { RootState } from "./store";
import { placeWorkClause } from "./workSentence";

const txt = liveText(statusText);

export interface RailNow {
  /** A new reply, a question or a new conversation: the person's turn. */
  yours: AgentNavModel[];
  /** Work going on without the person: working, or waiting on background
   * work (a process or a worker). */
  running: AgentNavModel[];
  /** Every other listed conversation (Hiljaiset), newest first. */
  quiet: AgentNavModel[];
  hints: ReadonlyMap<string, WorkspaceHint>;
}

/**
 * Sorts visible conversations into attention, ongoing work and the rest.
 * Catalog order is kept within the first two lists even though
 * each row carries its last change: a row that jumps on every turn is harder
 * to hit than one that stays.
 */
export function railNow({
  agents,
  snapshot,
  workspaces,
  metadata,
  daemonSessions,
  phase,
  closing = new Set(),
  selectedAgentId,
  selectedId,
  search = "",
  icons,
  creations = [],
}: {
  agents: Agent[];
  /** This tab's in-flight creations bridge the interval before the catalog
   * can name them. Drafts and creation outcomes remain owned by App. */
  creations?: {
    workspaceId: string;
    agentId?: string;
    route?: "new" | "new-worktree";
  }[];
  snapshot: Snapshot;
  workspaces: Workspace[];
  metadata: ConversationMetadata;
  daemonSessions: Session[];
  phase: RootState["connection"]["phase"];
  closing?: ReadonlySet<string>;
  selectedAgentId?: string;
  selectedId?: string;
  search?: string;
  /** Workspace icons by workspace_id (workspace-icons, experimental). */
  icons?: ReadonlyMap<string, WorkspaceIconModel>;
}): RailNow {
  const yours: AgentNavModel[] = [];
  const running: AgentNavModel[] = [];
  const quiet: AgentNavModel[] = [];
  const counts = new Map<
    string,
    { yours: number; working: number; background: number; waiting: number }
  >();
  const openConversation = new URLSearchParams(search).get("conversation");
  const raisedTimes = new Map<string, number>();
  for (const a of agents) {
    const w = workspaces.find((w) => w.workspace_id === a.workspace_id);
    // The snapshot carries the person's unconfirmed archive and mark.
    const current = snapshot.agents.find((c) => c.agent_id === a.agent_id);
    if (!w || a.archive === "archived" || current?.archive === "archived")
      continue;
    const status = metadata.statuses.get(a.agent_id);
    const fresh = !metadata.staleStatuses.has(a.agent_id);
    // A worktree conversation started under its place's ID.
    const managed = daemonSessions.some(
      (s) =>
        s.agent_id === a.agent_id &&
        s.workspace_id === (a.worktree_id ?? w.workspace_id),
    );
    // The tab's read model can outlive a conversation the catalog no longer
    // has; one this tab just started is not in the catalog yet.
    if (
      !managed &&
      !snapshot.agents.some((current) => current.agent_id === a.agent_id)
    )
      continue;
    const facts = {
      // An event can invalidate the tab's status before its replacement
      // arrives. Do not let that cached turn hide actions on a settled row.
      runActive: (fresh ? status?.run_active : undefined) ?? a.run_active,
      waitingOn: a.waiting_on,
      process: managed ? "daemon_managed_live" : a.process,
      control: managed ? "writable" : a.control,
      command: status && fresh ? status.state : undefined,
      attention: metadata.attention.get(a.agent_id),
      pendingQuestion:
        !!a.pending_question || (status?.pending_question != null && fresh),
      intentionallyClosed:
        phase !== "stale" && a.process === "confirmed_exited",
    };
    // Membership follows the last observation, so a lost connection marks
    // the rows rather than emptying the lists.
    const observed = agentPresentation(facts);
    const presentation = agentPresentation({
      ...facts,
      process: phase === "stale" ? "stale" : facts.process,
      connectionLost: phase === "stale",
    });
    const attention = facts.attention === "new";
    // A live process whose turn state is not known still runs, and so does
    // an agent whose worker works on after the agent's own turn ended.
    const workerBusy = (a.spinoffs_working ?? 0) > 0;
    // A worker whose Pi waits at its own prompt (an interactive run left for
    // review) keeps the conversation in sight without pulsing.
    const workerIdle = !workerBusy && (a.spinoffs_idle ?? 0) > 0;
    // A Pi left open after its turn ended waits for a message: the
    // conversation is finished until someone writes to it, so it leaves
    // Käynnissä and returns when its agent works again.
    const live =
      (observed.running &&
        observed.activity !== "closed" &&
        observed.activity !== "waiting") ||
      workerBusy ||
      workerIdle;
    // Raise and Ei nyt: the person's own mark, kept by their
    // daemon, decides with the replies. Opening a reply no longer answers
    // it; it waits, read, until the person replies or says Ei nyt, which
    // holds until a reply with another ID. A raise waits until the person
    // replies or lowers it; a reply after it takes its place, and work on
    // the conversation shows it in Käynnissä meanwhile.
    const mark = (current ?? a).turn_mark;
    const reply = (current ?? a).last_reply;
    const dismissed = mark?.state === "not_now" && mark.reply_id === reply?.id;
    const raised =
      mark?.state === "raised" &&
      !live &&
      !(reply && Date.parse(reply.at) > Date.parse(mark.at));
    // Read means a reply the snapshot still names: a stale entry of a reply
    // that is gone (its turn was cut, say) does not wait.
    const read = !live && !!reply && facts.attention === "seen" && !dismissed;
    // A conversation opened with + waits for the person until its first
    // message is written, as a reply does (Jari 7.11.2026): Pi has written
    // no history yet. Ei nyt, which has no reply to name, moves it to
    // Hiljaiset; a Pi that crashed before writing stays failed.
    const unanswered =
      (current ?? a).history === "missing" &&
      !live &&
      !reply &&
      !dismissed &&
      !facts.pendingQuestion &&
      !a.failure &&
      !(a.rest?.cause === "crash" && !a.rest.awake);
    const turn =
      (attention && !dismissed) ||
      read ||
      raised ||
      unanswered ||
      (facts.pendingQuestion && observed.running);
    // Pi ended unasked: the conversation rests until the person writes, and
    // stays in Käynnissä as failed so it is not silently gone. The snapshot's
    // rest says so; liveness cannot, because a browser conversation's
    // reaped handle is still listed and so still counts as managed.
    const crashed = !turn && a.rest?.cause === "crash" && !a.rest.awake;
    // Pi stopped mid-turn, for example when the daemon restarted for an
    // upgrade: the work was cut off and nobody has continued it. It stays in
    // sight like a crash until the person writes or archives it; the
    // conversation's rest card says what was cut and wakes it. A stop the
    // person (or their agent) asked for cut it by choice and is not news.
    const cut =
      !turn &&
      !crashed &&
      !!a.rest &&
      !a.rest.awake &&
      a.rest.cause !== "person" &&
      !!a.interrupted_turn;
    // A settled failed turn is not running work. Keep its failure marker
    // in the quiet list; a failed worker or interrupted process still needs
    // attention in the running list. A new turn supersedes the old failure.
    const failure = observed.activity === "working" ? undefined : a.failure;
    const failed = crashed || cut || failure !== undefined;
    // Hiljaiset lists every other conversation, finished worktree
    // conversations included (Jari 1.11.2026).
    const isQuiet =
      !turn &&
      !live &&
      (!failed || (!crashed && !cut && failure === "turn_error"));
    const name = w.display_name ?? w.name;
    const state =
      failure === "turn_error"
        ? txt.rail.turnError
        : failure === "worker_failed"
          ? txt.rail.workerFailed
          : attention && turn
            ? txt.rail.newReply
            : raised
              ? txt.rail.raised
              : read
                ? txt.rail.readReply
                : facts.pendingQuestion
                  ? txt.rail.asks
                  : crashed
                    ? txt.rail.crashed
                    : cut
                      ? txt.rail.turnCut
                      : observed.activity === "working"
                        ? txt.rail.working
                        : observed.activity === "waiting_background"
                          ? txt.rail.background
                          : workerBusy
                            ? txt.rail.workerWorking
                            : workerIdle
                              ? txt.rail.workerWaiting
                              : observed.activityLabel;
    const waits =
      observed.activity === "waiting_background" && a.waiting_on?.length
        ? a.waiting_on.filter(waitedFor).map(waitingName).join(", ")
        : "";
    // A process the agent left running behind an ended turn does not keep
    // the conversation in Käynnissä; the row still says it runs.
    const services =
      phase === "stale" || !observed.running
        ? []
        : backgroundServices(a.waiting_on).map(waitingName);
    const servicesClause = services.length
      ? txt.rail.backgroundService(services.join(", "))
      : "";
    const pendingLabel = closing.has(a.agent_id) ? txt.rail.closing : undefined;
    const changedAt = a.changed_at ? Date.parse(a.changed_at) : Number.NaN;
    const model: AgentNavModel = {
      agentId: a.agent_id,
      href: browserOwned(a, daemonSessions)
        ? `/workspaces/${w.workspace_id}?conversation=${a.agent_id}`
        : `/agents/${a.agent_id}`,
      title: agentTitle(a.title),
      workspaceId: w.workspace_id,
      workspaceName: name,
      workspaceIcon: icons?.get(w.workspace_id),
      changedAt: Number.isFinite(changedAt) ? changedAt : undefined,
      failed: failed || undefined,
      detail: [name, state, waits, servicesClause, presentation.operationLabel]
        .filter(Boolean)
        .join(" · "),
      pendingLabel,
      worktree: a.worktree_id
        ? (() => {
            const place = w.worktrees?.find(
              (p) => p.worktree_id === a.worktree_id,
            );
            const merged = worktreeMerged(place);
            return {
              merged,
              work: !merged ? placeWorkClause(place?.git_summary) : undefined,
            };
          })()
        : undefined,
      question: !attention && facts.pendingQuestion,
      activity: presentation.activity,
      activityLabel: state,
      activityShortLabel: presentation.activityShortLabel,
      controlLabel: presentation.controlLabel,
      operationLabel: presentation.operationLabel,
      historyLabel: unreadableHistory(a, managed, status)
        ? txt.rail.historyUnreadable
        : metadata.historyReadFailures.has(a.agent_id) ||
            a.history === "unavailable" ||
            status?.native_history === "unavailable"
          ? txt.rail.historyUnknown
          : undefined,
      // Ei nyt said on another device answers a reply this one has not shown.
      attentionLabel: dismissed ? undefined : presentation.attentionLabel,
      turnMark: raised ? "raised" : read ? "read" : undefined,
      turnAction: isQuiet
        ? "raise"
        : raised
          ? "lower"
          : turn && !facts.pendingQuestion && !live
            ? "not_now"
            : undefined,
      // A sub-agent at work, whether or not the parent still waits for it:
      // a daemon restart ends the wait, not the run.
      spinoffWorking: phase !== "stale" && (a.spinoffs_working ?? 0) > 0,
      spinoffIdle: phase !== "stale" && workerIdle,
      backgroundService: services.length ? services.join(", ") : undefined,
      spinoffWaited:
        phase !== "stale" &&
        observed.activity === "waiting_background" &&
        waitsOnWorker(a.waiting_on),
      selected:
        a.agent_id === selectedAgentId ||
        (selectedId === w.workspace_id && openConversation === a.agent_id),
    };
    if (raised && mark) raisedTimes.set(a.agent_id, Date.parse(mark.at));
    if (isQuiet) {
      quiet.push(model);
      continue;
    }
    const count = counts.get(w.workspace_id) ?? {
      yours: 0,
      working: 0,
      background: 0,
      waiting: 0,
    };
    counts.set(w.workspace_id, count);
    if (turn) {
      yours.push(model);
      count.yours++;
    } else {
      running.push(model);
      if (failed) continue;
      if (observed.activity === "working") count.working++;
      else if (observed.activity === "waiting_background") count.background++;
      else if (workerBusy) count.background++;
      else if (workerIdle) count.waiting++;
    }
  }
  for (const creation of creations) {
    const w = workspaces.find((w) => w.workspace_id === creation.workspaceId);
    if (!w) continue;
    const id = creation.agentId ?? `new:${w.workspace_id}`;
    if ([...yours, ...running, ...quiet].some((row) => row.agentId === id))
      continue;
    const conversation = creation.agentId ?? creation.route ?? "new";
    yours.push({
      agentId: id,
      href: `/workspaces/${w.workspace_id}?conversation=${conversation}`,
      title: txt.newConversation,
      workspaceId: w.workspace_id,
      workspaceName: w.display_name ?? w.name,
      workspaceIcon: icons?.get(w.workspace_id),
      activityLabel: "",
      controlLabel: "",
      selected:
        selectedId === w.workspace_id && openConversation === conversation,
    });
    const count = counts.get(w.workspace_id) ?? {
      yours: 0,
      working: 0,
      background: 0,
      waiting: 0,
    };
    count.yours++;
    counts.set(w.workspace_id, count);
  }
  const hints = new Map<string, WorkspaceHint>();
  for (const [id, c] of counts) {
    const live = c.working + c.background + c.waiting;
    if (!c.yours && !live) continue;
    hints.set(
      id,
      c.yours
        ? {
            kind: "attention",
            count: c.yours,
            text: txt.rail.hintYours(c.yours),
          }
        : c.working
          ? { kind: "working", count: live, text: txt.rail.hintWorking(live) }
          : c.background
            ? {
                kind: "background",
                count: live,
                text: txt.rail.hintBackground(live),
              }
            : {
                kind: "waiting",
                count: live,
                text: txt.rail.hintWaiting(live),
              },
    );
  }
  // The newest raise leads Sinun vuorosi, and so the next-waiting round.
  const raisedAt = (row: AgentNavModel) =>
    row.turnMark === "raised" ? (raisedTimes.get(row.agentId) ?? 0) : -1;
  yours.sort((a, b) => raisedAt(b) - raisedAt(a));
  quiet.sort(
    (a, b) =>
      (b.changedAt ?? 0) - (a.changedAt ?? 0) ||
      a.agentId.localeCompare(b.agentId),
  );
  return { yours, running, quiet, hints };
}
