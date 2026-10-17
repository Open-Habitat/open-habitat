import { useEffect, useState } from "react";
import {
  AccountShelf,
  ArchivedWorkspaces,
  WorkspaceRail,
  WorkspaceSection,
} from "../components";
import { agentPresentation } from "../components/agentPresentation";
import { WorkspaceActions } from "../components/WorkspaceActions";
import {
  type ConversationStore,
  unreadableHistory,
  useConversationMetadata,
} from "./conversationStore";
import type { Session } from "./conversations";
import type { AccountProfile } from "./pi";
import { serverInfo, serverInformationChanges } from "./serverAdministration";
import { browserOwned, type Snapshot, type Workspace } from "./snapshot";
import type { RootState } from "./store";

export function sourceLabel(state: string) {
  return (
    (
      {
        confirmed: "Vahvistettu",
        absent: "Lähde puuttuu",
        unavailable: "Lähde ei ole saatavilla",
        unknown: "Tieto ei ole tiedossa",
        conflicting: "Ristiriitainen tieto",
      } as Record<string, string>
    )[state] ?? "Tieto ei ole tiedossa"
  );
}
// Navigation and catalog presentation live here; the loader and route switch stay in App.
export function WorkspaceRailView({
  phase,
  snapshot,
  pendingArchive = new Set(),
  profile,
  store,
  source,
  collapsed,
  matches,
  archived = [],
  pendingVisibility,
  onRestoreWorkspace,
  visibilityProblem,
  filter,
  railState,
  selectedId,
  selectedAgentId,
  daemonSessions,
  expanded,
  onExpand,
  onNewConversation,
  newReason,
  onCreateWorkspace,
  onFilter,
  onToggle,
  onRefresh,
  onSettings,
  onLogout,
  onAdministration,
  pathname,
  search,
}: {
  phase: RootState["connection"]["phase"];
  snapshot: Snapshot;
  pendingArchive?: ReadonlySet<string>;
  profile?: AccountProfile;
  store: ConversationStore;
  source: string;
  collapsed: boolean;
  matches: Workspace[];
  archived?: Workspace[];
  pendingVisibility?: ReadonlyMap<string, string>;
  onRestoreWorkspace?: (workspace: Workspace) => void;
  visibilityProblem?: string;
  filter: string;
  railState:
    | "loading"
    | "error"
    | "source-absent"
    | "unknown"
    | "empty"
    | "filtered-empty"
    | "ready";
  selectedId: string | undefined;
  selectedAgentId: string | undefined;
  daemonSessions: Session[];
  expanded: Record<string, boolean>;
  onExpand: (next: Record<string, boolean>) => void;
  onNewConversation?: (workspaceId: string) => void;
  newReason?: (id: string) => string;
  onCreateWorkspace?: () => void;
  onFilter: (value: string) => void;
  onToggle: () => void;
  onRefresh: () => void;
  onSettings: () => void;
  onLogout: () => void;
  onAdministration: () => void;
  pathname: string;
  search: string;
}) {
  const [server, setServer] = useState<{
    name: string;
    administrator: boolean;
  }>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: Re-read the current role on navigation, including after a role removal.
  useEffect(() => {
    let controller: AbortController;
    const refresh = () => {
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      void serverInfo(signal)
        .then((next) => {
          if (!signal.aborted) setServer(next);
        })
        .catch(() => {});
    };
    serverInformationChanges.addEventListener("change", refresh);
    refresh();
    return () => {
      controller.abort();
      serverInformationChanges.removeEventListener("change", refresh);
    };
  }, [pathname]);
  const metadata = useConversationMetadata(store);
  const agents = metadata.agents.size
    ? [...metadata.agents.values()]
    : snapshot.agents;
  return (
    <WorkspaceRail
      collapsed={collapsed}
      serverLabel={
        server?.name || window.location.hostname.split(".")[0] || "Palvelin"
      }
      connectionLabel={
        phase === "stale"
          ? "Yhteys poikki"
          : source === "confirmed"
            ? "Yhdistetty"
            : "Tietoja puuttuu"
      }
      connectionTone={
        phase === "stale"
          ? "danger"
          : source === "confirmed"
            ? "success"
            : "warning"
      }
      sessionActions={
        <AccountShelf
          profile={
            profile ?? {
              name: snapshot.identity.display_name,
              email: "",
              avatar_url: "",
            }
          }
          onSettings={onSettings}
          onAdministration={
            server?.administrator ? onAdministration : undefined
          }
          onLogout={onLogout}
        />
      }
      homeCurrent={pathname === "/workspaces"}
      runningCount={
        phase === "authenticated"
          ? agents.filter(
              (a) =>
                agentPresentation({
                  runActive:
                    metadata.statuses.get(a.agent_id)?.run_active ??
                    a.run_active,
                  waitingOn: a.waiting_on,
                  process: daemonSessions.some((s) => s.agent_id === a.agent_id)
                    ? "daemon_managed_live"
                    : a.process,
                  command: metadata.staleStatuses.has(a.agent_id)
                    ? undefined
                    : metadata.statuses.get(a.agent_id)?.state,
                  pendingQuestion:
                    !!metadata.statuses.get(a.agent_id)?.pending_question ||
                    !!a.pending_question,
                }).activity === "working",
            ).length
          : undefined
      }
      attentionCount={
        [...metadata.attention.values()].filter((v) => v === "new").length
      }
      filterValue={filter}
      resultSummary={`${matches.length} ${source === "confirmed" ? "työtilaa" : "löydettyä työtilaa"}`}
      summaryAction={undefined}
      onCreateWorkspace={onCreateWorkspace}
      listState={railState}
      onToggle={onToggle}
      onFilter={onFilter}
      onRefresh={onRefresh}
      archived={
        <ArchivedWorkspaces
          workspaces={archived.map((w) => ({
            id: w.workspace_id,
            name: w.display_name ?? w.name,
            href: `/workspaces/${w.workspace_id}`,
            selected: selectedId === w.workspace_id,
            pending: pendingVisibility?.has(w.workspace_id),
          }))}
          onRestore={
            onRestoreWorkspace
              ? (id) => {
                  const w = archived.find((a) => a.workspace_id === id);
                  if (w) onRestoreWorkspace(w);
                }
              : undefined
          }
          restoreReason={
            phase === "stale"
              ? "Yhteys poikki."
              : snapshot.write_state === "read_only"
                ? "Vain luku."
                : undefined
          }
          problem={visibilityProblem}
        />
      }
    >
      {matches.map((w) => (
        <WorkspaceSection
          key={w.workspace_id}
          workspaceId={w.workspace_id}
          name={w.display_name ?? w.name}
          href={`/workspaces/${w.workspace_id}`}
          expanded={
            expanded[w.workspace_id] ??
            Boolean(agents.some((a) => a.workspace_id === w.workspace_id))
          }
          selected={selectedId === w.workspace_id}
          summary={`${w.kind === "git_main_worktree" ? "Git" : "Hakemisto"} · ${sourceLabel(w.facts.find((f) => f.source === "filesystem")?.state ?? "unknown")}`}
          mutationState={
            snapshot.write_state === "read_only"
              ? undefined
              : w.mutation_state === "read_only"
                ? "Vain luku"
                : undefined
          }
          agents={agents
            .filter(
              (a) =>
                a.workspace_id === w.workspace_id &&
                a.archive !== "archived" &&
                snapshot.agents.find(
                  (current) => current.agent_id === a.agent_id,
                )?.archive !== "archived" &&
                !pendingArchive.has(a.agent_id),
            )
            .map((a) => ({
              agentId: a.agent_id,
              href: browserOwned(a, daemonSessions)
                ? `/workspaces/${w.workspace_id}?conversation=${a.agent_id}`
                : `/agents/${a.agent_id}`,
              title: a.title.display,
              ...(() => {
                const managed = daemonSessions.some(
                  (s) =>
                    s.agent_id === a.agent_id &&
                    s.workspace_id === w.workspace_id,
                );
                const presentation = agentPresentation({
                  runActive:
                    metadata.statuses.get(a.agent_id)?.run_active ??
                    a.run_active,
                  waitingOn: a.waiting_on,
                  process:
                    phase === "stale"
                      ? "stale"
                      : managed
                        ? "daemon_managed_live"
                        : a.process,
                  control: managed ? "writable" : a.control,
                  command:
                    metadata.statuses.has(a.agent_id) &&
                    !metadata.staleStatuses.has(a.agent_id)
                      ? metadata.statuses.get(a.agent_id)?.state
                      : undefined,
                  connectionLost: phase === "stale",
                  attention: metadata.attention.get(a.agent_id),
                  pendingQuestion:
                    !!a.pending_question ||
                    (metadata.statuses.get(a.agent_id)?.pending_question !=
                      null &&
                      !metadata.staleStatuses.has(a.agent_id)),
                  intentionallyClosed:
                    phase !== "stale" && a.process === "confirmed_exited",
                });
                const isNew = managed && a.history === "missing";
                const attention = metadata.attention.get(a.agent_id) === "new";
                return {
                  finished: presentation.activity === "closed" && !attention,
                  priority: isNew
                    ? 0
                    : attention
                      ? 1
                      : presentation.activity === "working"
                        ? 2
                        : presentation.activity === "waiting"
                          ? 3
                          : 4,
                  activityLabel: presentation.activityLabel,
                  activityShortLabel: presentation.activityShortLabel,
                  controlLabel: presentation.controlLabel,
                  operationLabel: presentation.operationLabel,
                  historyLabel: unreadableHistory(
                    a,
                    managed,
                    metadata.statuses.get(a.agent_id),
                  )
                    ? "Historia ei luettavissa"
                    : metadata.historyReadFailures.has(a.agent_id) ||
                        a.history === "unavailable" ||
                        metadata.statuses.get(a.agent_id)?.native_history ===
                          "unavailable"
                      ? "Historiaa ei voitu tarkistaa"
                      : undefined,
                  attentionLabel: presentation.attentionLabel,
                  // A sub-agent at work, whether or not the parent still
                  // waits for it: a daemon restart ends the wait, not the run.
                  spinoffWorking:
                    phase !== "stale" &&
                    ((a.spinoffs_working ?? 0) > 0 ||
                      presentation.activity === "waiting_spinoff"),
                };
              })(),
              selected:
                a.agent_id === selectedAgentId ||
                (selectedId === w.workspace_id &&
                  new URLSearchParams(search).get("conversation") ===
                    a.agent_id),
            }))}
          workspaceMenu={
            <WorkspaceActions
              workspace={w}
              onNew={onNewConversation}
              newReason={newReason?.(w.workspace_id)}
              rail
            />
          }
          onToggle={() =>
            onExpand({
              ...expanded,
              [w.workspace_id]: !(
                expanded[w.workspace_id] ??
                Boolean(agents.some((a) => a.workspace_id === w.workspace_id))
              ),
            })
          }
        />
      ))}
    </WorkspaceRail>
  );
}
