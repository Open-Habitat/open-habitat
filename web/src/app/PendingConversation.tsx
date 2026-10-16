import { useEffect, useRef, useState } from "react";
import {
  AgentHeader,
  Composer,
  ConversationFrame,
  ConversationStream,
  ConversationTimeline,
  InlineNotice,
  WaitingMessage,
} from "../components";
import {
  creationKeys,
  type LocalHeld,
  readHeld,
  restoreToDraft,
  writeHeld,
} from "./heldMessages";
import type { Workspace } from "./snapshot";

/** Focus the field when a view opens without another focus target, so the
 * person can type at once. */
function useOpeningFocus(section: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (document.activeElement === document.body || !document.activeElement)
      section.current
        ?.querySelector("textarea")
        ?.focus({ preventScroll: true });
  }, [section]);
}

// A route-local presentation, not a speculative native conversation or history.
// While an existing conversation loads, the field keeps what is typed.
export function PendingConversation({
  workspace,
  message = "Ladataan keskustelua…",
  problem,
  onRetry,
  retryLabel = "Yritä uudelleen",
  value = "",
  onChange,
}: {
  workspace: Workspace;
  message?: string;
  problem?: string;
  onRetry?: () => void;
  retryLabel?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [details, setDetails] = useState(false);
  const section = useRef<HTMLDivElement>(null);
  useOpeningFocus(section);
  const blocked = { state: "disabled" as const, reason: problem || message };
  return (
    <div ref={section} className="ah-pending-conversation">
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
                onRetry ? [{ label: retryLabel, onPress: onRetry }] : undefined
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
          value={value}
          availability={blocked}
          editorAvailability={onChange ? { state: "enabled" } : blocked}
          suppressAvailabilityReason
          activity="idle"
          selectedWorkingMode="follow_up"
          onChange={onChange ?? (() => {})}
          onSendNow={() => {}}
          onSteer={() => {}}
          onFollowUp={() => {}}
          onModeChange={() => {}}
        />
      </ConversationFrame>
    </div>
  );
}

// A new conversation is usable at once (Jari 16.10.2026): the field is enabled
// while the daemon creates it, and messages sent before it has an ID wait in
// this tab as dashed bubbles. The created conversation posts them in order;
// the daemon holds them until Pi runs. Nothing says that Pi is starting.
export function CreatingConversation({
  workspace,
  identity,
  problem,
  onRetry,
  retryLabel = "Yritä uudelleen",
}: {
  workspace: Workspace;
  identity: string;
  problem?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const keys = creationKeys(identity, workspace.workspace_id);
  const [details, setDetails] = useState(false);
  const [draft, setDraftState] = useState(
    () => sessionStorage.getItem(keys.draft) ?? "",
  );
  const [waiting, setWaiting] = useState<LocalHeld[]>(() =>
    readHeld(keys.held),
  );
  const [notice, setNotice] = useState("");
  const section = useRef<HTMLDivElement>(null);
  useOpeningFocus(section);
  const setDraft = (value: string) => {
    setDraftState(value);
    if (value) sessionStorage.setItem(keys.draft, value);
    else sessionStorage.removeItem(keys.draft);
  };
  const setHeld = (value: LocalHeld[]) => {
    writeHeld(keys.held, value);
    setWaiting(value);
  };
  // Nothing has been posted: taking the messages back is local and exact.
  const giveBack = () => {
    if (!waiting.length) return;
    setDraft(
      restoreToDraft(
        waiting.map((w) => w.text),
        draft,
      ),
    );
    setNotice(
      waiting.length > 1
        ? "Viestit eivät lähteneet. Ne ovat taas kentässä."
        : "Viesti ei lähtenyt. Se on taas kentässä.",
    );
    setHeld([]);
    section.current?.querySelector("textarea")?.focus();
  };
  return (
    <div ref={section} className="ah-pending-conversation">
      <ConversationFrame>
        <AgentHeader
          title="Uusi keskustelu"
          workspaceLabel={workspace.display_name ?? workspace.name}
          workspaceHref={`/workspaces/${workspace.workspace_id}`}
          activityLabel={problem ? "Tilaa ei voitu vahvistaa" : ""}
          controlLabel=""
          detailsFacts={[{ label: "Työtila", value: workspace.path ?? "" }]}
          detailsExpanded={details}
          onToggleDetails={() => setDetails(!details)}
        />
        <ConversationStream>
          <ConversationTimeline
            state={waiting.length ? "ready" : "empty"}
            emptyLabel="Otsikko syntyy keskustelusta."
            historyMode="pagedAccessible"
            onJumpToLatest={() => {}}
            items={waiting.map((w) => ({
              id: `held:${w.command_id}`,
              kind: "user",
              content: (
                <WaitingMessage
                  text={w.text}
                  state={problem ? "failed" : "waiting"}
                  onCopy={() => void navigator.clipboard?.writeText(w.text)}
                />
              ),
            }))}
          />
          {problem ? (
            <InlineNotice
              title="Keskustelun tilaa ei voitu vahvistaa"
              description={problem}
              tone="warning"
              actions={[
                ...(onRetry ? [{ label: retryLabel, onPress: onRetry }] : []),
                ...(waiting.length
                  ? [{ label: "Muokkaa", onPress: giveBack }]
                  : []),
              ]}
            />
          ) : null}
        </ConversationStream>
        {notice ? (
          <div className="ah-conversation-notices">
            <p className="ah-held-notice" role="status">
              {notice}
            </p>
          </div>
        ) : null}
        <Composer
          value={draft}
          availability={{ state: "enabled" }}
          activity="idle"
          selectedWorkingMode="follow_up"
          onChange={setDraft}
          onSendNow={() => {
            if (!draft.trim()) return;
            setHeld([
              ...waiting,
              { command_id: crypto.randomUUID(), text: draft, posted: false },
            ]);
            setDraft("");
            setNotice("");
          }}
          onSteer={() => {}}
          onFollowUp={() => {}}
          onModeChange={() => {}}
          onStopWaiting={waiting.length && !problem ? giveBack : undefined}
        />
      </ConversationFrame>
    </div>
  );
}
