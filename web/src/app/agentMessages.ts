import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import type { AgentMessageControl } from "../components/AgentMessage";
import { agentTitle } from "./agentTitle";
import {
  type ConversationStore,
  useConversationMetadata,
} from "./conversationStore";
import { jumpToMessage } from "./searchJump";

/**
 * Agent messages between the person's conversations (agent-agent-messages):
 * the other conversation's current name and place from the rail, and a
 * quote's original by its message id, for a conversation view.
 */
export function useAgentMessageControls(
  store: ConversationStore | undefined,
  id: string | undefined,
): AgentMessageControl {
  const metadata = useConversationMetadata(store);
  return useMemo<AgentMessageControl>(
    () => ({
      peer: (agentId) => {
        const agent = metadata.agents.get(agentId);
        return agent
          ? { title: agentTitle(agent.title), workspaceId: agent.workspace_id }
          : undefined;
      },
      onJump: (messageId) => {
        if (id) jumpToMessage(id, messageId);
      },
    }),
    [metadata.agents, id],
  );
}

/**
 * A link from another conversation's agent message opens this one at the
 * same message: the view reads back to it as to a quote's original, and the
 * route drops the id once it is taken.
 */
export function useMessageLink(id: string | undefined) {
  const location = useLocation();
  const navigate = useNavigate();
  const message = new URLSearchParams(location.search).get("message");
  useEffect(() => {
    if (!id || !message) return;
    if (/^[0-9a-fA-F-]{36}$/.test(message)) jumpToMessage(id, message);
    const q = new URLSearchParams(location.search);
    q.delete("message");
    navigate(`${location.pathname}${q.size ? `?${q}` : ""}`, {
      replace: true,
      state: location.state,
    });
  }, [
    id,
    message,
    location.pathname,
    location.search,
    location.state,
    navigate,
  ]);
}
