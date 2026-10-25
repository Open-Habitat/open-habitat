import { type Agent, browserOwned } from "./snapshot";

/** Use the catalog, not the rail's filtered/collapsed presentation. */
export function unreadReplies(
  agents: Agent[],
  attention: ReadonlyMap<string, "new" | "seen">,
  sessions: { agent_id: string; workspace_id: string }[],
  currentAgents: Agent[],
) {
  return agents
    .filter(
      (a) =>
        attention.get(a.agent_id) === "new" &&
        a.archive !== "archived" &&
        currentAgents.some(
          (current) =>
            current.agent_id === a.agent_id && current.archive !== "archived",
        ),
    )
    .map((a) =>
      browserOwned(a, sessions)
        ? `/workspaces/${a.workspace_id}?conversation=${a.agent_id}`
        : `/agents/${a.agent_id}`,
    );
}
