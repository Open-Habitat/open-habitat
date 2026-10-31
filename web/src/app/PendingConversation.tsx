import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  AgentHeader,
  Composer,
  ConversationFrame,
  ConversationStream,
  ConversationTimeline,
  InlineNotice,
  WaitingMessage,
} from "../components";
import { controlClassName } from "../components/ControlElements";
import { Icon } from "../components/Icon";
import { liveText } from "../i18n";
import { pendingConversationText } from "../text/pendingConversation";
import {
  readCommands,
  readFiles,
  readPreview,
  type StartPage,
} from "./composerReads";
import {
  composerGoals,
  conversationGoal,
  creationGuideOwner,
  guideOpensItself,
  prepareField,
  setGuide,
  useGuide,
  usePreparedField,
} from "./goalGuide";
import {
  creationKeys,
  type LocalHeld,
  readHeld,
  restoreToDraft,
  writeHeld,
} from "./heldMessages";
import { shortModel, usePiModels } from "./PiModels";
import { StartPageRead } from "./StartPageRead";
import { settingsHref } from "./settingsRoute";
import type { Workspace } from "./snapshot";
import { GuideHeaderControl } from "./ViewHost";

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

const txt = liveText(pendingConversationText);

// A route-local presentation, not a speculative native conversation or history.
// While an existing conversation loads, the field keeps what is typed.
export function PendingConversation({
  workspace,
  message = txt.loading,
  problem,
  onRetry,
  retryLabel = txt.retry,
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
          title={txt.newConversation}
          workspaceLabel={workspace.display_name ?? workspace.name}
          workspaceHref={`/workspaces/${workspace.workspace_id}`}
          activityLabel={problem ? txt.unconfirmed : message}
          activityAnimated={!problem}
          controlLabel=""
          detailsFacts={[{ label: txt.workspace, value: workspace.path ?? "" }]}
          detailsExpanded={details}
          onToggleDetails={() => setDetails(!details)}
        />
        <ConversationStream>
          {problem ? (
            <InlineNotice
              data-state="uncertain"
              data-testid="creation-problem"
              title={txt.stateUnconfirmed}
              description={problem}
              tone="warning"
              actions={
                onRetry ? [{ label: retryLabel, onPress: onRetry }] : undefined
              }
            />
          ) : (
            <p data-testid="conversation-loading" role="status">
              {message}
            </p>
          )}
        </ConversationStream>
        <Composer
          modelPicker={
            <span
              className={`md-pill ${controlClassName({ size: "inline", presentation: "pill" })}`}
              aria-disabled="true"
            >
              {txt.agent}
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
  retryLabel = txt.retry,
  refused = false,
  onCreateAgain,
  worktree,
  csrf,
  onDictating,
}: {
  workspace: Workspace;
  identity: string;
  problem?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** The host refused the creation: nothing was created, the text stays. */
  refused?: boolean;
  onCreateAgain?: () => void;
  /** A new worktree agent (ADR 0025): nothing exists until the first
   * message, which creates the branch and worktree from `base`. */
  worktree?: {
    base?: string;
    dirty?: number;
    blocked?: string;
    onFirstMessage?: (text: string) => void;
  };
  /** Speech input needs it, as in the created conversation. */
  csrf?: string;
  /** A dictation is under way: the created conversation waits for it, so
   * its text reaches the draft the conversation takes over. */
  onDictating?: (active: boolean) => void;
}) {
  const sources = useMemo(
    () => ({
      commands: (signal: AbortSignal) =>
        readCommands({ workspaceId: workspace.workspace_id }, signal),
      files: (query: string, signal: AbortSignal) =>
        readFiles(workspace.workspace_id, query, signal),
      preview: (path: string, signal: AbortSignal) =>
        readPreview(workspace.workspace_id, path, signal),
      workspaceName: workspace.display_name ?? workspace.name,
    }),
    [workspace.workspace_id, workspace.display_name, workspace.name],
  );
  const navigate = useNavigate();
  // One object per view, so the composer keeps its dictation engine.
  const speech = useMemo(
    () => ({ onOpenSettings: () => navigate(settingsHref("sanelu")) }),
    [navigate],
  );
  const { data: models } = usePiModels();
  const displayModel = shortModel(models?.default_model ?? undefined);
  const keys = creationKeys(identity, workspace.workspace_id);
  const [details, setDetails] = useState(false);
  const [draft, setDraftState] = useState(
    () => sessionStorage.getItem(keys.draft) ?? "",
  );
  const [waiting, setWaiting] = useState<LocalHeld[]>(() =>
    readHeld(keys.held),
  );
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState<StartPage | null>();
  const goals = useMemo(() => composerGoals(page), [page]);
  const guideOwner = creationGuideOwner(identity, workspace.workspace_id);
  const started = useGuide(guideOwner)?.goal;
  const section = useRef<HTMLDivElement>(null);
  // The person just asked for this conversation: the field takes focus from
  // the + or workspace button so they can type at once. A goal chosen on the
  // workspace page also selects its placeholder, here and once created.
  useEffect(() => {
    section.current?.querySelector("textarea")?.focus({ preventScroll: true });
  }, []);
  usePreparedField(guideOwner, section);
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
    setNotice(waiting.length > 1 ? txt.manyReturned : txt.oneReturned);
    setHeld([]);
    section.current?.querySelector("textarea")?.focus();
  };
  // A refusal reverts in place and keeps what was written: messages that
  // waited for the conversation go back into the field.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the refusal itself gives the messages back.
  useEffect(() => {
    if (refused) giveBack();
  }, [refused]);
  return (
    <div ref={section} className="ah-pending-conversation">
      <ConversationFrame>
        <AgentHeader
          title={worktree ? txt.newWorktreeAgent : txt.newConversation}
          workspaceLabel={workspace.display_name ?? workspace.name}
          workspaceHref={`/workspaces/${workspace.workspace_id}`}
          activityLabel={
            refused
              ? txt.notCreated
              : problem
                ? txt.unconfirmed
                : worktree && waiting.length
                  ? txt.creatingWorktree
                  : ""
          }
          activityAnimated={!!worktree && !!waiting.length && !problem}
          controlLabel=""
          detailsFacts={[{ label: txt.workspace, value: workspace.path ?? "" }]}
          detailsExpanded={details}
          onToggleDetails={() => setDetails(!details)}
          guideControl={
            <GuideHeaderControl
              owner={guideOwner}
              goal={conversationGoal(page, started, [], draft)}
              page={page && !("state" in page) ? page.title : undefined}
            />
          }
        />
        <ConversationStream>
          {worktree && !waiting.length ? (
            <WorktreeIntro workspace={workspace} {...worktree} />
          ) : null}
          <ConversationTimeline
            state={waiting.length ? "ready" : "empty"}
            emptyLabel={
              <StartPageRead
                workspaceId={workspace.workspace_id}
                draft={draft}
                onChange={setDraft}
                onPage={setPage}
                onStarted={(goal, title, prepared) => {
                  prepareField(guideOwner, {
                    text: prepared.text,
                    start: prepared.selectionStart,
                    end: prepared.selectionEnd,
                  });
                  setGuide(guideOwner, {
                    goal,
                    page: title,
                    open: guideOpensItself(),
                  });
                }}
              />
            }
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
              data-testid="creation-problem"
              data-state={refused ? "refused" : "uncertain"}
              title={
                refused ? txt.conversationNotCreated : txt.stateUnconfirmed
              }
              description={problem}
              tone="warning"
              actions={[
                ...(onCreateAgain
                  ? [
                      {
                        testId: "retry",
                        label: txt.retry,
                        onPress: onCreateAgain,
                      },
                    ]
                  : []),
                ...(onRetry
                  ? [
                      {
                        testId: "creation-recheck",
                        label: retryLabel,
                        onPress: onRetry,
                      },
                    ]
                  : []),
                ...(waiting.length
                  ? [{ label: txt.edit, onPress: giveBack }]
                  : []),
              ]}
            />
          ) : null}
        </ConversationStream>
        {notice ? (
          <div className="ah-conversation-notices">
            <p
              data-testid="creation-uncertain"
              className="ah-held-notice"
              role="status"
            >
              {notice}
            </p>
          </div>
        ) : null}
        <Composer
          modelPicker={
            <span
              className={`md-pill ${controlClassName({ size: "inline", presentation: "pill" })}`}
              aria-disabled="true"
            >
              {displayModel ?? txt.modelUnknown} ·{" "}
              {models?.default_thinking ?? txt.agent}
            </span>
          }
          csrf={csrf}
          speech={speech}
          onDictating={onDictating}
          value={draft}
          goals={goals}
          sources={sources}
          availability={
            problem
              ? {
                  state: "disabled",
                  reason: refused
                    ? txt.notCreatedReason
                    : txt.creationUnconfirmed,
                }
              : worktree?.blocked
                ? { state: "disabled", reason: worktree.blocked }
                : { state: "enabled" }
          }
          editorAvailability={{ state: "enabled" }}
          activity="idle"
          selectedWorkingMode="follow_up"
          onChange={setDraft}
          onSendNow={(text = draft) => {
            if (!text.trim() || problem || worktree?.blocked) return;
            setHeld([
              ...waiting,
              { command_id: crypto.randomUUID(), text, posted: false },
            ]);
            setDraft("");
            setNotice("");
            if (!waiting.length) worktree?.onFirstMessage?.(text);
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

/** What the first message of a worktree agent will do, before it is sent. */
function WorktreeIntro({
  workspace,
  base,
  dirty,
}: {
  workspace: Workspace;
  base?: string;
  dirty?: number;
}) {
  return (
    <div
      data-testid="worktree-intro"
      data-base={base}
      data-dirty={dirty}
      className="ah-worktree-intro"
    >
      <Icon name="worktreeNew" className="ah-worktree-intro-icon" />
      <p className="ah-worktree-intro-text ah-worktree-intro-lead">
        {txt.worktreeLead(
          <code className="ah-worktree-intro-code">
            {workspace.display_name ?? workspace.name}
          </code>,
        )}
      </p>
      <p className="ah-worktree-intro-text">
        {txt.worktreeFirst(
          base ? <code className="ah-worktree-intro-code">{base}</code> : null,
        )}
      </p>
      {dirty ? (
        <p className="ah-worktree-intro-text ah-worktree-intro-note">
          {txt.worktreeDirty(dirty)}
        </p>
      ) : null}
      <p className="ah-worktree-intro-text ah-worktree-intro-note">
        {txt.worktreeMerge}
      </p>
    </div>
  );
}
