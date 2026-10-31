import { type ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router";
import {
  AccountShelf,
  ArchivedWorkspaces,
  NowSections,
  type RailArchive,
  type RailRename,
  WorkspaceNavRow,
  WorkspaceRail,
} from "../components";
import { RailClones } from "../components/ClonePage";
import type { Tone } from "../components/types";
import { WorkspaceActions } from "../components/WorkspaceActions";
import type { WorkspaceIconModel } from "../components/WorkspaceIcon";
import { liveText } from "../i18n";
import { statusText } from "../text/status";
import { type CloneJobs, cloneLabel, useCloneView } from "./cloneJobs";
import {
  type ConversationStore,
  useConversationMetadata,
} from "./conversationStore";
import type { AccountProfile } from "./pi";
import { type RailNow, railNow } from "./railNow";
import { serverInfo, serverInformationChanges } from "./serverAdministration";
import type { Snapshot, Workspace } from "./snapshot";
import type { RootState } from "./store";

const txt = liveText(statusText);

export function sourceLabel(state: string) {
  return txt.sources[state] ?? txt.sources.unknown;
}
/** The server's name and the person's role on it, read again on navigation. */
export function useServer(pathname: string) {
  const [server, setServer] = useState<{
    name: string;
    administrator: boolean;
    version?: string;
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
  return server;
}
export function serverLabel(server?: { name: string }) {
  return server?.name || window.location.hostname.split(".")[0] || txt.server;
}
export function connectionStatus(
  phase: RootState["connection"]["phase"],
  source: string,
): { label: string; tone: Tone } {
  return phase === "stale"
    ? { label: txt.operation.disconnected, tone: "danger" }
    : source === "confirmed"
      ? { label: txt.connected, tone: "success" }
      : { label: txt.incomplete, tone: "warning" };
}
/** The rail's Sinun vuorosi and Käynnissä; the app also badges the phone's
 * menu button with the first. */
export function useRailNow({
  store,
  snapshot,
  workspaces,
  ...rest
}: Omit<Parameters<typeof railNow>[0], "agents" | "metadata" | "snapshot"> & {
  store?: ConversationStore;
  snapshot?: Snapshot;
}): RailNow {
  const metadata = useConversationMetadata(store);
  if (!snapshot) return { yours: [], running: [], hints: new Map() };
  return railNow({
    ...rest,
    snapshot,
    workspaces,
    metadata,
    agents: metadata.agents.size
      ? [...metadata.agents.values()]
      : snapshot.agents,
  });
}
const alphabetical = (a: Workspace, b: Workspace) =>
  (a.display_name ?? a.name).localeCompare(b.display_name ?? b.name, "fi");
// Navigation and catalog presentation live here; the loader and route switch stay in App.
export function WorkspaceRailView({
  only,
  phase,
  snapshot,
  profile,
  source,
  collapsed,
  now,
  matches,
  archived = [],
  onRestoreWorkspace,
  visibilityProblem,
  filter,
  railState,
  selectedId,
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
  clones,
  bell,
  archiveConversation,
  renameConversation,
  icons,
}: {
  /** The conversation rows' rename; absent where none is offered. */
  renameConversation?: RailRename;
  /** Workspace icons by workspace_id while the experimental feature is on. */
  icons?: ReadonlyMap<string, WorkspaceIconModel>;
  /** The conversation rows' archive button; absent where none is offered. */
  archiveConversation?: RailArchive;
  /** The status bell, where no top bar carries it. */
  bell?: ReactNode;
  /** The only visible workspace in a confirmed listing: named, not listed. */
  only?: Workspace;
  phase: RootState["connection"]["phase"];
  snapshot: Snapshot;
  profile?: AccountProfile;
  source: string;
  collapsed: boolean;
  /** From useRailNow, over every visible workspace whatever the filter. */
  now: RailNow;
  matches: Workspace[];
  archived?: Workspace[];
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
  clones?: CloneJobs;
}) {
  const cloneView = useCloneView(clones);
  const queued = cloneView.queue.filter((q) => q.state !== "present");
  const server = useServer(pathname);
  const { search } = useLocation();
  // With one workspace there is no filter field, so nothing filters.
  const term = only ? "" : filter.toLocaleLowerCase();
  const archivedMatches = archived
    .filter((w) =>
      (w.display_name ?? w.name).toLocaleLowerCase().includes(term),
    )
    .sort(alphabetical);
  return (
    <WorkspaceRail
      bell={bell}
      collapsed={collapsed}
      serverLabel={serverLabel(server)}
      connectionLabel={connectionStatus(phase, source).label}
      connectionTone={connectionStatus(phase, source).tone}
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
      now={
        <NowSections
          yours={now.yours}
          running={now.running}
          collapsed={collapsed}
          archive={archiveConversation}
          rename={renameConversation}
          card={
            icons
              ? { onNew: onNewConversation, newReason: (id) => newReason?.(id) }
              : undefined
          }
        />
      }
      filterValue={filter}
      resultSummary={
        source === "confirmed" ? `${matches.length}` : txt.found(matches.length)
      }
      onCreateWorkspace={onCreateWorkspace}
      only={
        only && {
          name: only.display_name ?? only.name,
          href: `/workspaces/${only.workspace_id}`,
          current:
            pathname === `/workspaces/${only.workspace_id}` &&
            !new URLSearchParams(search).has("conversation"),
          adding: pathname === "/workspaces/new",
        }
      }
      listState={railState}
      onToggle={onToggle}
      onFilter={onFilter}
      onRefresh={onRefresh}
      clones={
        <RailClones
          current={pathname === "/workspaces/new"}
          items={[
            ...cloneView.jobs
              .filter(
                (j, i, all) =>
                  all.findIndex((k) => k.full_name === j.full_name) === i &&
                  (j.state === "running" || j.state === "failed") &&
                  !cloneView.interrupted.some(
                    (i) => i.full_name === j.full_name,
                  ) &&
                  !(
                    j.state === "failed" &&
                    queued.some((q) => q.full_name === j.full_name)
                  ),
              )
              .map((j) => ({
                name: j.full_name.split("/")[1],
                label: cloneLabel(j),
                live: j.state === "running",
              })),
            ...cloneView.interrupted.map((i) => ({
              name: i.full_name.split("/")[1],
              label: cloneLabel("interrupted"),
              live: false,
            })),
            ...queued
              .filter(
                (q) =>
                  !cloneView.jobs.some(
                    (j) => j.state === "running" && j.full_name === q.full_name,
                  ),
              )
              .map((q) => ({
                name: q.full_name.split("/")[1],
                label: cloneLabel(q.state === "refused" ? "refused" : "queued"),
                live: q.state !== "refused",
              })),
          ]}
        />
      }
      archived={
        <ArchivedWorkspaces
          forceOpen={!!term}
          workspaces={archivedMatches.map((w) => ({
            id: w.workspace_id,
            name: w.display_name ?? w.name,
            href: `/workspaces/${w.workspace_id}`,
            selected: selectedId === w.workspace_id,
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
              ? txt.disconnectedReason
              : snapshot.write_state === "read_only"
                ? txt.readOnlyReason
                : undefined
          }
          problem={visibilityProblem}
        />
      }
    >
      {[...matches].sort(alphabetical).map((w) => (
        <WorkspaceNavRow
          key={w.workspace_id}
          name={w.display_name ?? w.name}
          href={`/workspaces/${w.workspace_id}`}
          selected={selectedId === w.workspace_id}
          icon={icons?.get(w.workspace_id)}
          hint={now.hints.get(w.workspace_id)}
          summary={`${w.kind === "git_main_worktree" ? "Git" : txt.directory} · ${sourceLabel(w.facts.find((f) => f.source === "filesystem")?.state ?? "unknown")}`}
          mutationState={
            snapshot.write_state === "read_only"
              ? undefined
              : w.mutation_state === "read_only"
                ? txt.readOnly
                : undefined
          }
          workspaceMenu={
            <WorkspaceActions
              workspace={w}
              onNew={onNewConversation}
              newReason={newReason?.(w.workspace_id)}
              rail
            />
          }
        />
      ))}
    </WorkspaceRail>
  );
}
