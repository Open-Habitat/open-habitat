import { useState } from "react";
import {
  AgentHeader,
  Composer,
  ConversationFrame,
  ConversationStream,
  InlineNotice,
} from "../components";
import type { Workspace } from "./snapshot";

// A route-local presentation, not a speculative native conversation or history.
export function PendingConversation({
  workspace,
  message = "Luodaan keskustelua…",
  problem,
  onRetry,
}: {
  workspace: Workspace;
  message?: string;
  problem?: string;
  onRetry?: () => void;
}) {
  const [details, setDetails] = useState(false);
  const blocked = { state: "disabled" as const, reason: problem || message };
  return (
    <ConversationFrame>
      <AgentHeader
        title="Uusi keskustelu"
        workspaceLabel={workspace.display_name ?? workspace.name}
        workspaceHref={`/workspaces/${workspace.workspace_id}`}
        activityLabel={problem ? "Tilaa ei voitu vahvistaa" : message}
        activityAnimated={!problem}
        controlLabel=""
        detailsFacts={[{ label: "Työtila", value: workspace.path ?? "" }]}
        detailsExpanded={details}
        onToggleDetails={() => setDetails(!details)}
      />
      <ConversationStream>
        {problem ? (
          <InlineNotice
            title="Keskustelun tilaa ei voitu vahvistaa"
            description={problem}
            tone="warning"
            actions={
              onRetry
                ? [{ label: "Yritä uudelleen", onPress: onRetry }]
                : undefined
            }
          />
        ) : (
          <p role="status">{message}</p>
        )}
      </ConversationStream>
      <Composer
        modelPicker={
          <span className="md-pill" aria-disabled="true">
            Pi
          </span>
        }
        value=""
        availability={blocked}
        editorAvailability={blocked}
        suppressAvailabilityReason
        activity="idle"
        selectedWorkingMode="follow_up"
        onChange={() => {}}
        onSendNow={() => {}}
        onSteer={() => {}}
        onFollowUp={() => {}}
        onModeChange={() => {}}
      />
    </ConversationFrame>
  );
}
