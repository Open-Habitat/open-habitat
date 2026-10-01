import { AccountShelf, WorkspaceRail, WorkspaceSection } from "../components";
import type { Session } from "./conversations";
import type { Snapshot, Workspace } from "./snapshot";
import type { RootState } from "./store";

function agentProcessLabel(process: string): string {
  return (
    (
      {
        daemon_managed_live: "Prosessi käynnissä",
        terminal_observed_live: "Käynnissä terminaalissa",
        confirmed_exited: "Ei käynnissä",
        not_observed: "Prosessia ei havaittu",
        stale: "Tieto vanhentunut",
      } as Record<string, string>
    )[process] ?? "Prosessin tila ei tiedossa"
  );
}
function agentControlLabel(control: string): string {
  return (
    (
      {
        read_only: "Vain luku",
        transfer_possible: "Siirrettävissä",
        unavailable: "Ohjaus ei saatavilla",
        unknown: "Ohjaus ei tiedossa",
      } as Record<string, string>
    )[control] ?? ""
  );
}
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
  return (
    <WorkspaceRail
      collapsed={collapsed}
      serverLabel={window.location.host}
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
          name="Oma tili"
          onSettings={onSettings}
          onLogout={onLogout}
        />
      }
      homeCurrent={pathname === "/workspaces"}
      runningCount={
        phase === "authenticated"
          ? snapshot.agents.filter(
              (a) =>
                a.process === "daemon_managed_live" ||
                a.process === "terminal_observed_live",
            ).length
          : undefined
      }
      filterValue={filter}
      resultSummary={`${matches.length} ${source === "confirmed" ? "työtilaa" : "löydettyä työtilaa"}`}
      summaryAction={undefined}
      listState={railState}
      onToggle={onToggle}
      onFilter={onFilter}
      onRefresh={onRefresh}
    >
      {matches.map((w) => (
        <WorkspaceSection
          key={w.workspace_id}
          workspaceId={w.workspace_id}
          name={w.display_name ?? w.name}
          href={`/workspaces/${w.workspace_id}`}
          expanded={
            expanded[w.workspace_id] ??
            Boolean(
              snapshot.agents.some((a) => a.workspace_id === w.workspace_id),
            )
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
          agents={snapshot.agents
            .filter((a) => a.workspace_id === w.workspace_id)
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
              activityLabel: agentProcessLabel(a.process),
              activityShortLabel:
                agentProcessLabel(a.process) === "Prosessin tila ei tiedossa"
                  ? "Tila ei tiedossa"
                  : undefined,
              controlLabel: daemonSessions.some(
                (s) =>
                  s.agent_id === a.agent_id &&
                  s.workspace_id === w.workspace_id,
              )
                ? ""
                : agentControlLabel(a.control),
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
                Boolean(
                  snapshot.agents.some(
                    (a) => a.workspace_id === w.workspace_id,
                  ),
                )
              ),
            })
          }
        />
      ))}
    </WorkspaceRail>
  );
}
