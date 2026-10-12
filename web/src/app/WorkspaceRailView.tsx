import { useEffect, useState } from "react";
import { AccountShelf, WorkspaceRail, WorkspaceSection } from "../components";
import { agentPresentation } from "../components/agentPresentation";
import { LinkRow } from "../components/ControlElements";
import {
  type ConversationStore,
  unreadableHistory,
  useConversationMetadata,
} from "./conversationStore";
import type { Session } from "./conversations";
import type { AccountProfile } from "./pi";
import { serverInfo } from "./serverAdministration";
import type { Snapshot, Workspace } from "./snapshot";
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
  profile,
  store,
  source,
  collapsed,
  matches,
  filter,
  railState,
  selectedId,
  selectedAgentId,
  daemonSessions,
  expanded,
  onExpand,
  onFilter,
  onToggle,
  onRefresh,
  onSettings,
  onLogout,
  pathname,
  search,
}: {
  phase: RootState["connection"]["phase"];
  snapshot: Snapshot;
  profile?: AccountProfile;
  store: ConversationStore;
  source: string;
  collapsed: boolean;
  matches: Workspace[];
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
  onFilter: (value: string) => void;
  onToggle: () => void;
  onRefresh: () => void;
  onSettings: () => void;
  onLogout: () => void;
  pathname: string;
  search: string;
}) {
  const [server, setServer] = useState<{
    name: string;
    administrator: boolean;
  }>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: Re-read the current role on navigation, including after a role removal.
  useEffect(() => {
    const controller = new AbortController();
    void serverInfo(controller.signal)
      .then(setServer)
      .catch(() => {});
    return () => controller.abort();
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
          onLogout={onLogout}
        />
      }
      homeCurrent={pathname === "/workspaces"}
      runningCount={
        phase === "authenticated"
          ? agents.filter(
              (a) =>
                agentPresentation({
                  process: daemonSessions.some((s) => s.agent_id === a.agent_id)
                    ? "daemon_managed_live"
                    : a.process,
                  command: metadata.staleStatuses.has(a.agent_id)
                    ? undefined
                    : metadata.statuses.get(a.agent_id)?.state,
                  pendingQuestion: !!metadata.statuses.get(a.agent_id)
                    ?.pending_question,
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
      listState={railState}
      onToggle={onToggle}
      onFilter={onFilter}
      onRefresh={onRefresh}
    >
      {server?.administrator && (
        <LinkRow href="/administration" kind="inline">
          Palvelimen ylläpito
        </LinkRow>
      )}
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
                a.workspace_id === w.workspace_id && a.archive !== "archived",
            )
            .map((a) => ({
              agentId: a.agent_id,
              href: daemonSessions.some(
                (s) =>
                  s.agent_id === a.agent_id &&
                  s.workspace_id === w.workspace_id,
              )
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
                    metadata.statuses.get(a.agent_id)?.pending_question !=
                      null && !metadata.staleStatuses.has(a.agent_id),
                });
                return {
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
                };
              })(),
              selected:
                a.agent_id === selectedAgentId ||
                (selectedId === w.workspace_id &&
                  new URLSearchParams(search).get("conversation") ===
                    a.agent_id),
            }))}
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
