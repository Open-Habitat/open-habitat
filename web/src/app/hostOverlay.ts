import type { MutationLayer } from "./mutations";
import type { Snapshot, TurnMark } from "./snapshot";

// Keys of the optimistic commands whose values are presented over host state.
export const visibilityKey = (workspaceId: string) =>
  `workspace:${workspaceId}:visibility`;
export const renameKey = (workspaceId: string) =>
  `workspace:${workspaceId}:name`;
export const archiveKey = (agentId: string) =>
  `conversation:${agentId}:archive`;
export const conversationNameKey = (agentId: string) =>
  `conversation:${agentId}:name`;
export const turnMarkKey = (agentId: string) => `conversation:${agentId}:turn`;
export const closeKey = (agentId: string) => `conversation:${agentId}:close`;

/** The host snapshot as the person should see it now: unconfirmed optimistic
 * commands presented over it. A pure view; nothing here is kept. */
export function overlaid(
  snapshot: Snapshot | undefined,
  layer: MutationLayer | undefined,
): Snapshot | undefined {
  if (!snapshot || !layer) return snapshot;
  const pending =
    layer.entries("workspace:").length + layer.entries("conversation:").length;
  if (!pending) return snapshot;
  return {
    ...snapshot,
    workspaces: snapshot.workspaces.map((w) => {
      const visibility = layer.get<"visible" | "hidden">(
        visibilityKey(w.workspace_id),
      )?.value;
      const name = layer.get<string>(renameKey(w.workspace_id))?.value;
      return visibility || name !== undefined
        ? {
            ...w,
            ...(visibility ? { visibility } : {}),
            ...(name !== undefined ? { display_name: name || w.name } : {}),
          }
        : w;
    }),
    agents: snapshot.agents.map((a) => {
      const archive = layer.get<"active" | "archived">(
        archiveKey(a.agent_id),
      )?.value;
      const name = layer.get<string>(conversationNameKey(a.agent_id))?.value;
      const turn = layer.get<TurnMark>(turnMarkKey(a.agent_id))?.value;
      return archive || name !== undefined || turn
        ? {
            ...a,
            ...(archive ? { archive } : {}),
            ...(turn ? { turn_mark: turn } : {}),
            ...(name !== undefined
              ? { title: { display: name, source: "native_session" as const } }
              : {}),
          }
        : a;
    }),
  };
}

/** Splits a key into its kind, target id (which may hold a colon) and field. */
export function parseKey(key: string) {
  const first = key.indexOf(":");
  const last = key.lastIndexOf(":");
  return {
    kind: key.slice(0, first),
    id: key.slice(first + 1, last),
    field: key.slice(last + 1),
  };
}
