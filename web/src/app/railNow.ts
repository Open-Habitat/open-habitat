import {
  agentPresentation,
  waitingName,
  waitsOnWorker,
} from "../components/agentPresentation";
import type { AgentNavModel, WorkspaceHint } from "../components/Navigation";
import type { WorkspaceIconModel } from "../components/WorkspaceIcon";
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

export interface RailNow {
  /** A new reply or a question: the person's turn. */
  yours: AgentNavModel[];
  /** Live and not waiting for the person: working, waiting for a message, or
   * waiting on background work (a process or a worker). */
  running: AgentNavModel[];
  hints: ReadonlyMap<string, WorkspaceHint>;
}

/**
 * Sorts the visible workspaces' live conversations into the rail's Sinun
 * vuorosi and Käynnissä. Catalog order is kept within each group even though
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
  workFacts = false,
  icons,
}: {
  agents: Agent[];
  snapshot: Snapshot;
  workspaces: Workspace[];
  metadata: ConversationMetadata;
  daemonSessions: Session[];
  phase: RootState["connection"]["phase"];
  closing?: ReadonlySet<string>;
  selectedAgentId?: string;
  selectedId?: string;
  search?: string;
  /** The worker-row sentence is on: worktree rows say their work. */
  workFacts?: boolean;
  /** Workspace icons by workspace_id (workspace-icons, experimental). */
  icons?: ReadonlyMap<string, WorkspaceIconModel>;
}): RailNow {
  const yours: AgentNavModel[] = [];
  const running: AgentNavModel[] = [];
  const counts = new Map<
    string,
    { yours: number; working: number; background: number; waiting: number }
  >();
  const openConversation = new URLSearchParams(search).get("conversation");
  for (const a of agents) {
    const w = workspaces.find((w) => w.workspace_id === a.workspace_id);
    if (
      !w ||
      a.archive === "archived" ||
      snapshot.agents.find((current) => current.agent_id === a.agent_id)
        ?.archive === "archived"
    )
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
      runActive: status?.run_active ?? a.run_active,
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
    const turn = attention || (facts.pendingQuestion && observed.running);
    // A live process whose turn state is not known still runs, and so does
    // an agent whose worker works on after the agent's own turn ended.
    const workerBusy = (a.spinoffs_working ?? 0) > 0;
    // A worker whose Pi waits at its own prompt (an interactive run left for
    // review) keeps the conversation in sight without pulsing.
    const workerIdle = !workerBusy && (a.spinoffs_idle ?? 0) > 0;
    const live =
      (observed.running && observed.activity !== "closed") ||
      workerBusy ||
      workerIdle;
    // Pi ended unasked: the conversation rests until the person writes, and
    // stays in Käynnissä as failed so it is not silently gone. The snapshot's
    // rest says so; liveness cannot, because a browser conversation's
    // reaped handle is still listed and so still counts as managed.
    const crashed = !turn && a.rest?.cause === "crash" && !a.rest.awake;
    // The host's other failures: a turn that ended in an error, and a worker
    // run that failed after the conversation last changed. Both stay in
    // sight like a crash, and work that runs again is not failed any more.
    const failure = observed.activity === "working" ? undefined : a.failure;
    const failed = crashed || failure !== undefined;
    if (!turn && !live && !failed) continue;
    const name = w.display_name ?? w.name;
    const state =
      failure === "turn_error"
        ? "Vuoro päättyi virheeseen"
        : failure === "worker_failed"
          ? "Worker epäonnistui"
          : attention
            ? "Uusi vastaus"
            : facts.pendingQuestion
              ? "Kysyy sinulta"
              : crashed
                ? "Pi kaatui"
                : observed.activity === "working"
                  ? "Työskentelee"
                  : observed.activity === "waiting_background"
                    ? "Odottaa taustatyötä"
                    : observed.activity === "waiting"
                      ? "Odottaa viestiä"
                      : workerBusy
                        ? "Worker työskentelee"
                        : workerIdle
                          ? "Worker odottaa sinua"
                          : observed.activityLabel;
    const waits =
      observed.activity === "waiting_background" && a.waiting_on?.length
        ? a.waiting_on.map(waitingName).join(", ")
        : "";
    const pendingLabel = closing.has(a.agent_id) ? "Suljetaan…" : undefined;
    const changedAt = a.changed_at ? Date.parse(a.changed_at) : Number.NaN;
    const model: AgentNavModel = {
      agentId: a.agent_id,
      href: browserOwned(a, daemonSessions)
        ? `/workspaces/${w.workspace_id}?conversation=${a.agent_id}`
        : `/agents/${a.agent_id}`,
      title: a.title.display,
      workspaceId: w.workspace_id,
      workspaceName: name,
      workspaceIcon: icons?.get(w.workspace_id),
      changedAt: Number.isFinite(changedAt) ? changedAt : undefined,
      failed: failed || undefined,
      detail: [name, state, waits, presentation.operationLabel]
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
              work:
                workFacts && !merged
                  ? placeWorkClause(place?.git_summary)
                  : undefined,
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
        ? "Historia ei luettavissa"
        : metadata.historyReadFailures.has(a.agent_id) ||
            a.history === "unavailable" ||
            status?.native_history === "unavailable"
          ? "Historiaa ei voitu tarkistaa"
          : undefined,
      attentionLabel: presentation.attentionLabel,
      // A sub-agent at work, whether or not the parent still waits for it:
      // a daemon restart ends the wait, not the run.
      spinoffWorking:
        phase !== "stale" &&
        ((a.spinoffs_working ?? 0) > 0 ||
          (observed.activity === "waiting_background" &&
            waitsOnWorker(a.waiting_on))),
      selected:
        a.agent_id === selectedAgentId ||
        (selectedId === w.workspace_id && openConversation === a.agent_id),
    };
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
      else if (observed.activity === "waiting") count.waiting++;
      else if (workerBusy) count.background++;
      else if (workerIdle) count.waiting++;
    }
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
            text: `${c.yours} odottaa sinua`,
          }
        : c.working
          ? { kind: "working", count: live, text: `${live} käynnissä` }
          : c.background
            ? {
                kind: "background",
                count: live,
                text: `${live} odottaa taustatyötä`,
              }
            : { kind: "waiting", count: live, text: `${live} odottaa viestiä` },
    );
  }
  return { yours, running, hints };
}
