import {
  type ComponentProps,
  type RefObject,
  useEffect,
  useState,
} from "react";
import {
  type AgentHeader,
  Button,
  ConversationStream,
  ConversationTimeline,
  WaitingMessage,
} from "../components";
import { Icon } from "../components/Icon";
import { WarningBanner } from "../components/WarningBanner";
import { liveText } from "../i18n";
import { pendingConversationText } from "../text/pendingConversation";
import { CapacityCard } from "./CapacityCard";
import type { StartPage } from "./composerReads";
import { guideOpensItself, prepareField, setGuide } from "./goalGuide";
import type { WaitingView } from "./heldMessages";
import { StartPageRead } from "./StartPageRead";
import type { Snapshot, Workspace } from "./snapshot";

const txt = liveText(pendingConversationText);

// The conversation view before it can show a native conversation: while this
// tab creates one, and while an existing one's first status read is out. They
// are states of BrowserConversation, not views of their own, so the field the
// person types in (and the frame around it) stays the same element from the
// first key to the opened conversation.

/** A new conversation this tab is creating (Jari 16.10.2026): the field is
 * enabled while the daemon creates it, and messages sent before it has an ID
 * wait in this tab as dashed bubbles. The created conversation posts them in
 * order; the daemon holds them until Pi runs. Nothing says that Pi is
 * starting. */
export type Creation = {
  problem?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** The host refused the creation: nothing was created, the text stays. */
  refused?: boolean;
  /** The refusal was the limit on conversations working at once; `tries`
   * counts the attempts since the first refusal. */
  capacity?: { tries: number };
  onCreateAgain?: () => void;
  /** A refused creation has no native history to archive; close its local view. */
  onClose?: () => void;
  /** A new worktree agent (ADR 0025): nothing exists until the first
   * message, which creates the branch and worktree from `base`. */
  worktree?: {
    base?: string;
    dirty?: number;
    blocked?: string;
    onFirstMessage?: (text: string) => void;
  };
  /** A dictation is under way: the created conversation waits for it. */
  onDictating?: (active: boolean) => void;
};

type HeaderProps = ComponentProps<typeof AgentHeader>;

/** The top bar while an existing conversation's first status read is out. */
export function loadingHeader(
  workspace: Workspace,
  problem: string | undefined,
  details: boolean,
  onToggleDetails: () => void,
): HeaderProps {
  return {
    title: txt.newConversation,
    workspaceLabel: workspace.display_name ?? workspace.name,
    workspaceHref: `/workspaces/${workspace.workspace_id}`,
    activityLabel: problem ? txt.unconfirmed : txt.loading,
    activityAnimated: !problem,
    controlLabel: "",
    detailsFacts: [{ label: txt.workspace, value: workspace.path ?? "" }],
    detailsExpanded: details,
    onToggleDetails,
  };
}

export function LoadingStream({
  waiting,
  problem,
  onRetry,
}: {
  /** Messages sent while it loads; they go once it has opened. */
  waiting: string[];
  problem?: string;
  onRetry?: () => void;
}) {
  return (
    <ConversationStream>
      {waiting.map((text, index) => (
        <WaitingMessage
          // biome-ignore lint/suspicious/noArrayIndexKey: kept messages only grow at the end until they go.
          key={index}
          text={text}
          state="waiting"
          onCopy={() => void navigator.clipboard?.writeText(text)}
        />
      ))}
      {problem ? (
        <WarningBanner
          data-state="uncertain"
          data-testid="creation-problem"
          title={txt.stateUnconfirmed}
          tone="neutral"
          actions={
            onRetry ? (
              <Button
                size="row"
                variant="secondary"
                label={txt.retry}
                onPress={onRetry}
              />
            ) : undefined
          }
        >
          {problem}
        </WarningBanner>
      ) : (
        <p data-testid="conversation-loading" role="status">
          {txt.loading}
        </p>
      )}
    </ConversationStream>
  );
}

/** The top bar of a conversation being created. */
export function creationHeader(
  workspace: Workspace,
  creation: Creation,
  waiting: number,
  details: boolean,
  onToggleDetails: () => void,
  guideControl: HeaderProps["guideControl"],
): HeaderProps {
  const { refused, problem, worktree } = creation;
  return {
    title: worktree ? txt.newWorktreeAgent : txt.newConversation,
    workspaceLabel: workspace.display_name ?? workspace.name,
    workspaceHref: `/workspaces/${workspace.workspace_id}`,
    activityLabel: refused
      ? txt.notCreated
      : problem
        ? txt.unconfirmed
        : worktree && waiting
          ? txt.creatingWorktree
          : "",
    activityAnimated: !!worktree && !!waiting && !problem,
    activityMark: refused ? "error" : undefined,
    controlLabel: "",
    detailsFacts: [{ label: txt.workspace, value: workspace.path ?? "" }],
    detailsExpanded: details,
    onToggleDetails,
    guideControl,
  };
}

/** Why the field cannot send into the conversation being created. */
export function creationBlock(creation: Creation) {
  return creation.problem
    ? creation.refused
      ? txt.notCreatedReason
      : txt.creationUnconfirmed
    : creation.worktree?.blocked;
}

export function CreationStream({
  workspace,
  creation,
  waiting,
  draft,
  guide,
  snapshot,
  csrf,
  onChange,
  onPage,
  onGiveBack,
  onSend,
}: {
  workspace: Workspace;
  creation: Creation;
  /** Names the conversations a refusal at the limit lists. */
  snapshot?: Snapshot;
  csrf?: string;
  /** This tab's messages for the conversation, in order. */
  waiting: WaitingView[];
  draft: string;
  guide: string;
  onChange: (value: string) => void;
  onPage: (page: StartPage | null) => void;
  onGiveBack: () => void;
  onSend: (text: string) => boolean;
}) {
  const { problem, refused, worktree, onCreateAgain, onRetry } = creation;
  return (
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
            onChange={onChange}
            onPage={onPage}
            onStarted={(goal, title, prepared, immediate) => {
              prepareField(guide, {
                text: prepared.text,
                start: prepared.selectionStart,
                end: prepared.selectionEnd,
              });
              setGuide(guide, {
                goal,
                page: title,
                open: guideOpensItself(),
              });
              return immediate && onSend(prepared.text);
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
      <div className="ah-creation-notices">
        {problem && refused && creation.capacity ? (
          // At the limit there is nothing to edit: the text is already back
          // in the field (Jari 6.11.2026, Muokkaa pois).
          <CapacityCard
            workspace={workspace}
            snapshot={snapshot}
            csrf={csrf}
            tries={creation.capacity.tries}
            onRetry={onCreateAgain}
            fallback={
              <WarningBanner
                data-testid="creation-problem"
                data-state="refused"
                title={txt.conversationNotCreated}
                tone="danger"
                actions={
                  onCreateAgain ? (
                    <Button
                      data-testid="retry"
                      size="row"
                      variant="secondary"
                      label={txt.retry}
                      onPress={onCreateAgain}
                    />
                  ) : undefined
                }
              >
                {problem}
              </WarningBanner>
            }
          />
        ) : problem ? (
          <WarningBanner
            data-testid="creation-problem"
            data-state={refused ? "refused" : "uncertain"}
            title={refused ? txt.conversationNotCreated : txt.stateUnconfirmed}
            tone={refused ? "danger" : "neutral"}
            actions={
              <>
                {onCreateAgain ? (
                  <Button
                    data-testid="retry"
                    size="row"
                    variant="secondary"
                    label={txt.retry}
                    onPress={onCreateAgain}
                  />
                ) : null}
                {onRetry ? (
                  <Button
                    data-testid="creation-recheck"
                    size="row"
                    variant="secondary"
                    label={creation.retryLabel ?? txt.retry}
                    onPress={onRetry}
                  />
                ) : null}
                {waiting.length ? (
                  <Button
                    size="row"
                    variant="secondary"
                    label={txt.edit}
                    onPress={onGiveBack}
                  />
                ) : null}
              </>
            }
          >
            {problem}
          </WarningBanner>
        ) : null}
      </div>
    </ConversationStream>
  );
}

export function CreationNotice({ notice }: { notice: string }) {
  return notice ? (
    <div className="ah-conversation-notices">
      <WarningBanner
        data-testid="creation-uncertain"
        tone="neutral"
        lifetime="event"
      >
        {notice}
      </WarningBanner>
    </div>
  ) : null;
}

/** What only a conversation being created does: it takes the field when the
 * person asks for it, and a refusal gives the waiting messages back into the
 * field. Nothing was posted, so taking them back is local and exact. */
export function useCreation(
  creation: Creation | undefined,
  takeBack: () => number,
  section: RefObject<HTMLElement | null>,
) {
  const [notice, setNotice] = useState("");
  const giveBack = () => {
    const count = takeBack();
    if (!count) return;
    setNotice(count > 1 ? txt.manyReturned : txt.oneReturned);
    section.current?.querySelector("textarea")?.focus();
  };
  const creating = !!creation;
  // The person just asked for this conversation: the field takes focus from
  // the + or workspace button so they can type at once.
  useEffect(() => {
    if (creating)
      section.current
        ?.querySelector<HTMLTextAreaElement>(".ah-composer textarea")
        ?.focus({ preventScroll: true });
  }, [creating, section]);
  // A refusal reverts in place and keeps what was written.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the refusal itself gives the messages back.
  useEffect(() => {
    if (creation?.refused) giveBack();
  }, [creation?.refused]);
  return { notice: creating ? notice : "", setNotice, giveBack };
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
