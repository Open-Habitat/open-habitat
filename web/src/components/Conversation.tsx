import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { formatDate, liveText } from "../i18n";
import { conversationText } from "../text/conversation";
import { AttachmentChips, attachmentsIn, messageText } from "./AttachmentChips";
import { DisclosureButton } from "./ControlElements";
import { ConversationFloatingAction } from "./ConversationFrame";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { Disclosure } from "./Overlays";
import { Button, RadioGroup, TextField } from "./Primitives";
import type { StatusKind } from "./Status";
import { InlineNotice, StatusMark } from "./Status";
import { SyntaxCode } from "./SyntaxCode";
import type { Availability, ProblemView, TimelineItem, Tone } from "./types";

const txt = liveText(conversationText);

export function ConversationTimeline({
  state,
  items,
  newContentCount = 0,
  showJumpToLatest = false,
  latestWorking,
  latestDuration,
  historyMode,
  emptyLabel = txt.start,
  problem,
  onJumpToLatest,
  onHistoryModeChange,
}: {
  state: "loading" | "ready" | "empty" | "error" | "stale" | "unavailable";
  items: (TimelineItem & { kind?: string })[];
  newContentCount?: number;
  showJumpToLatest?: boolean;
  latestWorking?: boolean;
  latestDuration?: string;
  historyMode: "virtualized" | "pagedAccessible";
  emptyLabel?: ReactNode;
  problem?: ProblemView;
  onJumpToLatest: () => void;
  onHistoryModeChange?: (mode: "virtualized" | "pagedAccessible") => void;
}) {
  return (
    <section
      data-testid="conversation-timeline"
      aria-label={txt.history}
      className="ah-timeline"
    >
      {onHistoryModeChange ? (
        <div className="ah-timeline-tools">
          <Button
            label={
              historyMode === "virtualized"
                ? txt.pagedHistory
                : txt.virtualHistory
            }
            variant="quiet"
            size="row"
            onPress={() =>
              onHistoryModeChange(
                historyMode === "virtualized"
                  ? "pagedAccessible"
                  : "virtualized",
              )
            }
          />
        </div>
      ) : null}
      {state === "loading" ? <p>{txt.loading}</p> : null}
      {state === "empty" ? (
        <div data-testid="conversation-empty">{emptyLabel}</div>
      ) : null}
      {state === "error" || state === "unavailable" ? (
        <InlineNotice
          data-testid="history-read-error"
          title={problem?.title ?? txt.historyUnavailable}
          description={problem?.description}
          tone="danger"
        />
      ) : null}
      {state === "stale" ? (
        <InlineNotice
          data-testid="history-stale"
          title={txt.stale}
          description={txt.staleDetail}
          tone="warning"
        />
      ) : null}
      <ol className="ah-feed">
        {items.map((item) => (
          <li key={item.id} data-kind={item.kind}>
            {item.content}
          </li>
        ))}
      </ol>
      {showJumpToLatest ? (
        <ConversationFloatingAction>
          <Button
            data-unread-count={newContentCount}
            data-working={latestWorking}
            data-testid="jump-latest"
            size="row"
            label={
              latestWorking
                ? txt.jumpWorking(latestDuration ?? "", newContentCount)
                : newContentCount > 0
                  ? txt.jumpReply(newContentCount)
                  : txt.jumpLatest
            }
            variant="secondary"
            ariaLabel={
              latestWorking
                ? txt.jumpWorkingLabel(newContentCount)
                : newContentCount > 0
                  ? txt.jumpReplyLabel(newContentCount)
                  : txt.jumpLatest
            }
            trailingIcon="down"
            presentation="floating"
            onPress={onJumpToLatest}
          />
        </ConversationFloatingAction>
      ) : null}
    </section>
  );
}
/**
 * Whose conversation the messages belong to. A worker's conversation is not
 * the person's: its prompts come from the main agent, and the first is the
 * task the main agent gave (worker view, Kehys).
 */
export const ConversationVoice = createContext<"person" | "worker" | "brief">(
  "person",
);
function Message({
  speaker,
  person = false,
  children,
  time,
  state,
  stateTone = "neutral",
  stateAnimated = false,
  stateKind = "neutral",
  replyComplete = false,
  interim = false,
  delivery,
  onCopy,
  actions,
}: {
  speaker: string;
  /** A message's own actions in its top-right corner, such as Palaa tähän's menu. */
  actions?: ReactNode;
  /** A message this page sent that Pi's history does not show yet. */
  delivery?: "pending" | "accepted";
  /** The person's own message, which a worker's view gives to the main agent. */
  person?: boolean;
  interim?: boolean;
  replyComplete?: boolean;
  children: ReactNode;
  time?: string;
  state?: string;
  stateTone?: Tone;
  stateAnimated?: boolean;
  stateKind?: StatusKind;
  onCopy: () => void;
}) {
  const voice = useContext(ConversationVoice);
  if (voice !== "person")
    speaker = person
      ? voice === "brief"
        ? txt.mainAgentTask
        : txt.mainAgent
      : txt.worker(
          speaker === txt.agent || speaker === txt.replyDone
            ? txt.workerReply
            : speaker.toLocaleLowerCase(),
        );
  return (
    <article
      data-testid="message"
      data-reply-complete={replyComplete || undefined}
      data-interim={interim || undefined}
      data-delivery={delivery}
      data-voice={voice === "person" ? undefined : voice}
      className={`ah-message${replyComplete ? " ah-message-reply" : ""}${interim ? " ah-message-reply ah-message-interim" : ""}${stateTone === "danger" || stateTone === "warning" || stateAnimated ? " ah-message-alert" : ""}`}
    >
      <header>
        <strong>
          {replyComplete ? <Icon name="check" /> : null}
          {interim ? <Icon name="message" /> : null}
          {speaker}
        </strong>
        <Button
          data-testid="message-copy"
          ariaLabel={txt.copyMessage(speaker)}
          label={txt.copy}
          icon="copy"
          presentation="messageIcon"
          variant="quiet"
          size="row"
          onPress={onCopy}
        />
        {time ? <time>{time}</time> : null}
        {state ? (
          <StatusMark
            label={state}
            tone={stateTone}
            animated={stateAnimated ? "running" : false}
            kind={stateKind}
          />
        ) : null}
        {/* The card's own menu sits in its top-right corner, apart from
            copy and the time. */}
        {actions ? <span className="ah-message-actions">{actions}</span> : null}
      </header>
      <div className="ah-prose">{children}</div>
    </article>
  );
}
export function UserMessage({
  sourceText,
  skill,
  children,
  time,
  deliveryState,
  deliveryTone = "neutral",
  delivery,
  onCopy,
  actions,
}: {
  sourceText: string;
  actions?: ReactNode;
  delivery?: "pending" | "accepted";
  skill?: ReactNode;
  children?: ReactNode;
  time?: string;
  deliveryState?: string;
  deliveryTone?: Tone;
  onCopy: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [long, setLong] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const check = () => setLong(el.scrollHeight > el.clientHeight + 2);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <Message
      speaker={txt.you}
      person
      time={time}
      state={deliveryState}
      stateTone={deliveryTone}
      delivery={delivery}
      onCopy={onCopy}
      actions={actions}
    >
      {skill}
      <div
        ref={body}
        data-testid="user-content"
        className={
          expanded || skill
            ? "ah-user-content"
            : `ah-user-content ah-user-collapsed${long ? " ah-user-clipped" : ""}`
        }
      >
        {children ?? <Markdown text={messageText(sourceText)} breaks />}
      </div>
      {/* Outside the collapsed text: a long message must not hide its
          attachments below the cut. */}
      <AttachmentChips attachments={attachmentsIn(sourceText ?? "")} />
      {!skill && (long || expanded) ? (
        <Button
          data-testid="expand-message"
          label={expanded ? txt.collapseMessage : txt.showMessage}
          variant="quiet"
          size="row"
          onPress={() => setExpanded(!expanded)}
        />
      ) : null}
    </Message>
  );
}
export function AssistantMessage({
  children,
  time,
  streamState,
  onCopy,
}: {
  sourceText?: string;
  children: ReactNode;
  time?: string;
  streamState?: "streaming" | "complete" | "interrupted" | "failed" | "unknown";
  onCopy: () => void;
}) {
  const labels = txt.streamStates;
  return (
    <Message
      speaker={
        streamState === "streaming"
          ? txt.replying
          : streamState === "complete"
            ? txt.replyDone
            : txt.agent
      }
      replyComplete={streamState === "complete"}
      time={time}
      state={
        streamState && streamState !== "complete" && streamState !== "streaming"
          ? labels[streamState]
          : undefined
      }
      stateTone={
        streamState === "failed"
          ? "danger"
          : streamState === "unknown" || streamState === "interrupted"
            ? "warning"
            : "neutral"
      }
      stateAnimated={streamState === "streaming"}
      stateKind={
        streamState === "complete"
          ? "success"
          : streamState === "streaming"
            ? "working"
            : streamState === "failed"
              ? "error"
              : streamState === "unknown"
                ? "unknown"
                : "neutral"
      }
      onCopy={onCopy}
    >
      {children}
    </Message>
  );
}
/**
 * Pi's message to the person in the middle of a turn: a reply card where it
 * was written, a step quieter than the final answer.
 */
export function InterimMessage({
  children,
  onCopy,
}: {
  children: ReactNode;
  onCopy: () => void;
}) {
  return (
    <Message speaker={txt.interim} interim onCopy={onCopy}>
      {children}
    </Message>
  );
}
/** A message the daemon holds until Pi runs: dashed and muted until Pi takes
 * it (Kupla odottaa, Jari 16.10.2026). A failed start keeps it. One whose
 * outcome is unknown is not drawn: its text is back in the field. */
export function WaitingMessage({
  text,
  state,
  onCopy,
}: {
  text: string;
  state: "waiting" | "failed";
  onCopy: () => void;
}) {
  const label = state === "failed" ? txt.notSent : txt.waitingAgent;
  return (
    <article
      data-testid="waiting-message"
      className={`ah-message ah-waiting-message ah-waiting-${state}`}
      data-waiting={state}
    >
      <header>
        <strong>{txt.you}</strong>
        <Button
          data-testid="message-copy"
          ariaLabel={txt.copyMessage(txt.you)}
          label={txt.copy}
          icon="copy"
          presentation="messageIcon"
          variant="quiet"
          size="row"
          onPress={onCopy}
        />
        <StatusMark
          label={label}
          tone={state === "failed" ? "danger" : "neutral"}
          animated={state === "waiting" ? "running" : false}
          kind={state === "failed" ? "error" : "neutral"}
        />
      </header>
      <div className="ah-prose">
        <div data-testid="user-content" className="ah-user-content">
          <Markdown text={messageText(text)} breaks />
          <AttachmentChips attachments={attachmentsIn(text)} />
        </div>
      </div>
    </article>
  );
}
/** Pi did not start: the held messages are kept, with one primary retry and
 * a way to take them back for editing (Jari 16.10.2026, Kupla odottaa). */
export function HeldStartFailure({
  count,
  reason,
  onRetry,
  onEdit,
}: {
  count: number;
  /** Why, when the host said: four other conversations are working. */
  reason?: string;
  onRetry: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      data-testid="agent-start-failed"
      className="ah-held-failure"
      role="alert"
    >
      <span className="ah-held-failure-text">
        <Icon name="cross" />
        {txt.heldFailed(reason, count)}
      </span>
      <span className="ah-held-failure-actions">
        <Button
          data-testid="retry"
          label={txt.retry}
          variant="primary"
          size="row"
          onPress={onRetry}
        />
        <Button
          label={txt.edit}
          variant="secondary"
          size="row"
          onPress={onEdit}
        />
      </span>
    </div>
  );
}
export function SendObservation({
  text,
  state,
  showText,
  onCopy,
}: {
  text: string;
  state: "pending" | "accepted" | "rejected" | "uncertain";
  showText: boolean;
  onCopy: () => void;
}) {
  const labels = txt.sendStates;
  if (state === "accepted") return null;
  return (
    <div
      data-testid={
        state === "rejected"
          ? "message-rejected"
          : state === "uncertain"
            ? "send-uncertain"
            : "send-pending"
      }
      className={`ah-send-observation ah-send-${state}`}
      role={state === "rejected" ? "alert" : "status"}
    >
      {showText && state === "uncertain" ? (
        <p className="ah-send-text">{text}</p>
      ) : null}
      <div className="ah-send-meta">
        <p>{labels[state]}</p>
        {state === "uncertain" ? (
          <Button
            data-testid="message-copy"
            size="row"
            label={txt.copyText}
            variant="quiet"
            onPress={onCopy}
          />
        ) : null}
      </div>
    </div>
  );
}
export function TurnSettlement({ observedAt }: { observedAt: string }) {
  return (
    <p className="ah-settled" role="status">
      <Icon name="check" />{" "}
      {txt.turnDone(
        formatDate(new Date(observedAt), {
          hour: "2-digit",
          minute: "2-digit",
        }),
      )}{" "}
    </p>
  );
}
export function NativeQuestion({
  kind,
  prompt,
  choices,
  value,
  state,
  onChange,
  onRespond,
}: {
  kind: "input" | "confirm" | "select" | "unknown";
  prompt: string;
  choices: string[];
  value: string;
  state: "open" | "pending" | "uncertain" | "stale" | "unavailable";
  onChange: (value: string) => void;
  onRespond: (action: "answer" | "cancel", value?: string | boolean) => void;
}) {
  const locked = state !== "open";
  return (
    <section
      data-testid="agent-question"
      className="ah-native-question"
      aria-label={txt.question}
    >
      <h2>{txt.question}</h2>
      <p>{prompt}</p>
      {kind === "input" && !locked ? (
        <TextField label={txt.answer} value={value} onChange={onChange} />
      ) : null}
      {kind === "select" && !locked ? (
        <RadioGroup
          label={txt.chooseAnswer}
          value={value}
          options={choices.map((choice) => ({ value: choice, label: choice }))}
          onChange={onChange}
        />
      ) : null}
      {kind === "unknown" && choices.length ? (
        <p>{choices.join(" · ")}</p>
      ) : null}
      {state === "uncertain" ? (
        <p role="status">{txt.questionUncertain}</p>
      ) : null}
      {state === "stale" ? <p role="status">{txt.questionStale}</p> : null}
      {state === "pending" ? <p role="status">{txt.processing}</p> : null}
      {state === "unavailable" ? <p role="status">{txt.noControl}</p> : null}
      {state === "open" ? (
        <div className="ah-actions">
          {kind === "confirm" ? (
            <>
              <Button
                size="row"
                label={txt.yes}
                onPress={() => onRespond("answer", true)}
              />
              <Button
                data-testid="question-decline"
                size="row"
                label={txt.no}
                variant="quiet"
                onPress={() => onRespond("answer", false)}
              />
            </>
          ) : kind === "input" || kind === "select" ? (
            <Button
              data-testid="question-answer"
              size="row"
              label={txt.respond}
              availability={
                !value ||
                (kind === "select" && !choices.includes(value)) ||
                new TextEncoder().encode(JSON.stringify(value)).length > 60000
                  ? {
                      state: "disabled",
                      reason:
                        new TextEncoder().encode(JSON.stringify(value)).length >
                        60000
                          ? txt.answerTooLong
                          : kind === "input"
                            ? txt.writeAnswer
                            : txt.chooseAnswer,
                    }
                  : { state: "enabled" }
              }
              onPress={() => onRespond("answer", value)}
            />
          ) : null}
          <Button
            data-testid="question-cancel"
            size="row"
            label={txt.cancelQuestion}
            variant="quiet"
            onPress={() => onRespond("cancel")}
          />
        </div>
      ) : null}
    </section>
  );
}
export function ModelChange({
  modelId,
  onCopy,
}: {
  modelId: string;
  onCopy: () => void;
}) {
  return (
    <aside className="ah-model-change" aria-label={txt.modelChange}>
      <span>{txt.modelChanged(<code>{modelId}</code>)}</span>
      <Button
        data-testid="message-copy"
        label={txt.copyModelId}
        variant="quiet"
        size="row"
        onPress={onCopy}
      />
    </aside>
  );
}
export function MarkdownContent({
  children,
  contentState = "ready",
}: {
  children: ReactNode;
  contentState?: "pending" | "ready" | "failed";
}) {
  return (
    <div className="ah-markdown" data-content-state={contentState}>
      {contentState === "pending" ? <p>{txt.formatting}</p> : null}
      {children}
    </div>
  );
}
export function CodeBlock({
  text,
  languageLabel,
  sourceState = "complete",
  highlightState = "ready",
  collapsed = false,
  onCopy,
  onToggle,
  onLoadMore,
}: {
  text: string;
  languageLabel?: string;
  sourceState?: "complete" | "continued" | "livePartial";
  highlightState?: "pending" | "ready" | "failed";
  collapsed?: boolean;
  onCopy: () => void;
  onToggle?: () => void;
  onLoadMore?: () => void;
}) {
  return (
    <figure className="ah-code">
      <figcaption>
        {languageLabel ?? txt.code} ·{" "}
        {sourceState === "continued"
          ? txt.continues
          : sourceState === "livePartial"
            ? txt.partial
            : txt.complete}
        {highlightState !== "ready"
          ? highlightState === "pending"
            ? txt.highlightPending
            : txt.highlightFailed
          : ""}
      </figcaption>
      {collapsed ? (
        <p>{txt.collapsedContent}</p>
      ) : (
        <pre>
          <SyntaxCode
            text={text}
            language={languageLabel}
            complete={sourceState === "complete"}
            detect={!languageLabel}
          />
        </pre>
      )}
      <div className="ah-actions">
        <Button
          data-testid="message-copy"
          label={txt.copyCode}
          variant="quiet"
          size="row"
          onPress={onCopy}
        />
        {onToggle ? (
          <Button
            label={collapsed ? txt.show : txt.collapse}
            variant="quiet"
            size="row"
            onPress={onToggle}
          />
        ) : null}
        {sourceState === "continued" && onLoadMore ? (
          <Button
            label={txt.loadMore}
            variant="secondary"
            size="row"
            onPress={onLoadMore}
          />
        ) : null}
      </div>
    </figure>
  );
}
function keyedText(values: string[]) {
  const occurrences = new Map<string, number>();
  return values.map((value) => {
    const occurrence = (occurrences.get(value) ?? 0) + 1;
    occurrences.set(value, occurrence);
    return { key: `${value}:${occurrence}`, value };
  });
}

function diffLineKind(line: string) {
  if (line.startsWith("+++ ") || line.startsWith("--- ")) return "meta";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "delete";
  return "context";
}

export function DiffView({
  pathLabel,
  unifiedText,
  parseState,
  view,
  onCopy,
  onViewChange,
}: {
  pathLabel: string;
  unifiedText: string;
  parseState: "pending" | "ready" | "failed" | "unsupported";
  view: "splitVisual" | "unifiedAccessible";
  onCopy: () => void;
  onViewChange: (view: "splitVisual" | "unifiedAccessible") => void;
}) {
  return (
    <figure className="ah-diff">
      <figcaption>
        {pathLabel} ·{" "}
        {parseState === "ready" ? txt.parsedDiff : txt.unifiedDiff}
      </figcaption>
      <Button
        label={view === "splitVisual" ? txt.accessibleDiff : txt.visualDiff}
        variant="quiet"
        size="row"
        onPress={() =>
          onViewChange(
            view === "splitVisual" ? "unifiedAccessible" : "splitVisual",
          )
        }
      />
      <pre>
        <code>
          {keyedText(unifiedText.split("\n")).map(({ key, value: line }) => (
            <span
              className={
                diffLineKind(line) === "add"
                  ? "ah-diff-add"
                  : diffLineKind(line) === "delete"
                    ? "ah-diff-del"
                    : undefined
              }
              key={key}
            >
              <span className="ah-visually-hidden">
                {diffLineKind(line) === "add"
                  ? txt.addedLine
                  : diffLineKind(line) === "delete"
                    ? txt.removedLine
                    : ""}
              </span>
              {line}
              {"\n"}
            </span>
          ))}
        </code>
      </pre>
      <Button
        data-testid="message-copy"
        label={txt.copyDiff}
        variant="quiet"
        size="row"
        onPress={onCopy}
      />
    </figure>
  );
}
/** Live fragments expose a name and lifecycle state, not arguments or duration. */
export function LiveToolRow({
  name,
  state,
}: {
  name: string;
  state: "running" | "succeeded" | "failed" | "cancelled";
}) {
  const labels = txt.liveStates;
  return (
    <div
      className="ah-tool-row ah-live-tool-row"
      role="status"
      aria-label={`${name} ${labels[state]}`}
    >
      <strong>{name}</strong>
      <StatusMark
        label={labels[state]}
        kind={
          state === "running"
            ? "working"
            : state === "succeeded"
              ? "success"
              : "error"
        }
        tone={state === "failed" ? "danger" : "neutral"}
        animated={state === "running" ? "running" : false}
      />
    </div>
  );
}
export function ToolRow({
  name,
  targetText,
  machine,
  stat,
  statusLabel,
  statusTitle,
  state,
  durationText,
  expanded,
  errorSummary,
  keepMounted = false,
  onToggle,
  children,
}: {
  name: string;
  targetText?: string;
  /** The person's own computer the command ran on, not this server. */
  machine?: string;
  stat?: string;
  statusLabel: string;
  statusTitle?: string;
  state: string;
  durationText?: string;
  expanded: boolean;
  errorSummary?: string;
  keepMounted?: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <section
      data-testid="tool-row"
      data-tool-name={name}
      data-tool-target={targetText}
      className={`ah-tool-row${errorSummary ? " ah-tool-error" : ""}`}
      data-state={state}
    >
      <DisclosureButton
        data-testid="history-tool-toggle"
        tool
        aria-expanded={expanded}
        onPress={onToggle}
      >
        <Icon
          name="forward"
          className={expanded ? "ah-icon-expanded" : undefined}
        />
        <span className="ah-tool-names">
          <span className="ah-tool-name">{name}</span>
          {machine ? (
            <span
              className="ah-machine-chip"
              data-testid="tool-machine"
              data-machine={machine}
              title={txt.ranOn(machine)}
            >
              <Icon name="laptop" className="ah-machine-chip-icon" />
              {machine}
            </span>
          ) : null}
          {targetText ? (
            <code className="ah-tool-target">
              {targetText.split(/\r?\n/, 1)[0]}
            </code>
          ) : null}
        </span>
        {stat ? <span className="ah-file-stat">{stat}</span> : null}
        <span title={statusTitle}>
          <StatusMark
            label={statusLabel}
            tone={errorSummary ? "danger" : "neutral"}
            kind={
              errorSummary
                ? "error"
                : state === "succeeded"
                  ? "success"
                  : "neutral"
            }
          />
        </span>
        {durationText ? <small>{durationText}</small> : null}
      </DisclosureButton>
      {expanded || keepMounted ? (
        <div className="ah-disclosure-panel" hidden={!expanded}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
export function ToolGroup({
  title,
  summary,
  expanded,
  containsException,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  expanded: boolean;
  containsException?: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className={
        containsException ? "ah-tool-group ah-has-error" : "ah-tool-group"
      }
    >
      <Disclosure
        label={title}
        summary={
          containsException ? `${summary} · ${txt.containsError}` : summary
        }
        expanded={expanded}
        onToggle={onToggle}
      >
        {containsException ? (
          <StatusMark label={txt.containsError} tone="danger" />
        ) : null}
        {children}
      </Disclosure>
    </section>
  );
}
export function ToolOutput({
  text,
  streamSemantics,
  sourceState,
  onCopy,
  onLoadMore,
}: {
  text: string;
  streamSemantics: "replacement" | "append" | "unknown";
  sourceState: "complete" | "continued" | "livePartial";
  onCopy: () => void;
  onLoadMore?: () => void;
}) {
  return (
    <div className="ah-tool-output" data-stream-semantics={streamSemantics}>
      <pre>{text}</pre>
      <Button
        data-testid="message-copy"
        label={txt.copyVisibleOutput}
        variant="quiet"
        size="row"
        onPress={onCopy}
      />
      {sourceState === "continued" && onLoadMore ? (
        <Button
          label={txt.loadMore}
          variant="secondary"
          size="row"
          onPress={onLoadMore}
        />
      ) : null}
    </div>
  );
}
export function UnknownEvent({
  kindLabel,
  safeSummary,
  safePayloadText,
  onCopy,
}: {
  kindLabel: string;
  safeSummary: string;
  safePayloadText?: string;
  onCopy: () => void;
}) {
  return (
    <article className="ah-unknown">
      <StatusMark
        data-testid="unknown-event"
        label={txt.unknownEvent}
        tone="warning"
      />
      <p>{safeSummary}</p>
      <h3>{kindLabel}</h3>
      {safePayloadText ? (
        <details>
          <summary>{txt.originalContent}</summary>
          <pre>{safePayloadText}</pre>
        </details>
      ) : null}
      <Button
        data-testid="message-copy"
        label={txt.copyDetails}
        variant="quiet"
        size="row"
        onPress={onCopy}
      />
    </article>
  );
}
export function SupportedQuestion({
  kind,
  prompt,
  choices = [],
  value = "",
  state,
  cancelAvailability,
  problem,
  onChange,
  onRespond,
  onCancel,
}: {
  requestId: string;
  kind: "input" | "confirm" | "select";
  prompt: string;
  choices?: string[];
  value?: string;
  state:
    | "open"
    | "pending"
    | "answered"
    | "cancelled"
    | "expired"
    | "resolvedElsewhere"
    | "failed"
    | "unsupported";
  cancelAvailability?: Availability;
  problem?: ProblemView;
  onChange: (value: string) => void;
  onRespond: (value: string | boolean) => void;
  onCancel: () => void;
}) {
  const closed: Record<string, string> = txt.closed;
  if (closed[state])
    return (
      <InlineNotice title={prompt} description={closed[state]} tone="neutral" />
    );
  if (state === "unsupported")
    return (
      <InlineNotice
        title={prompt}
        description={txt.unsupportedQuestion}
        tone="warning"
      />
    );
  return (
    <section className="ah-question">
      <h3>{prompt}</h3>
      {problem ? (
        <InlineNotice
          title={problem.title}
          description={problem.description}
          tone="danger"
        />
      ) : null}
      {kind === "input" ? (
        <TextField label={txt.answer} value={value} onChange={onChange} />
      ) : null}
      {kind === "select" ? (
        <RadioGroup
          label={txt.chooseAnswer}
          value={value}
          options={choices.map((choice) => ({ value: choice, label: choice }))}
          onChange={onChange}
        />
      ) : null}
      <div className="ah-actions">
        {kind === "confirm" ? (
          <>
            <Button
              size="row"
              label={txt.yes}
              pending={state === "pending"}
              onPress={() => onRespond(true)}
            />
            <Button
              size="row"
              label={txt.no}
              variant="secondary"
              pending={state === "pending"}
              onPress={() => onRespond(false)}
            />
          </>
        ) : (
          <Button
            data-testid="question-answer"
            size="row"
            label={txt.respond}
            pending={state === "pending"}
            onPress={() => onRespond(value)}
          />
        )}
        <Button
          size="row"
          label={txt.cancelRequest}
          variant="quiet"
          availability={cancelAvailability}
          onPress={onCancel}
        />
      </div>
    </section>
  );
}
export { Composer } from "./composer/Composer";
export function CommandReceipt({
  kindLabel,
  acceptance,
  execution,
  problem,
}: {
  kindLabel: string;
  acceptance: string;
  execution: string;
  problem?: ProblemView;
}) {
  return (
    <section className="ah-receipt">
      <h3>{kindLabel}</h3>
      <dl>
        <div>
          <dt>{txt.acceptance}</dt>
          <dd>{acceptance}</dd>
        </div>
        <div>
          <dt>{txt.execution}</dt>
          <dd>{execution}</dd>
        </div>
      </dl>
      {problem ? (
        <InlineNotice
          title={problem.title}
          description={problem.description}
          tone="danger"
        />
      ) : null}
    </section>
  );
}
export function UncertainCommandCard({
  commandLabel,
  textPreview,
  commandIdLabel,
  explanation,
  availability,
  onReconcile,
  onCopyText,
  onSendAsNew,
}: {
  commandLabel: string;
  textPreview?: string;
  commandIdLabel: string;
  explanation: string;
  availability: Availability;
  onReconcile: () => void;
  onCopyText: () => void;
  onSendAsNew: () => void;
}) {
  return (
    <section data-testid="uncertain-command" className="ah-uncertain">
      <StatusMark label={txt.uncertain} tone="warning" />
      <h2>{commandLabel}</h2>
      <p>{explanation}</p>
      {textPreview ? <blockquote>{textPreview}</blockquote> : null}
      <code>{commandIdLabel}</code>
      <div className="ah-actions">
        <Button
          size="row"
          label={txt.checkStatus}
          availability={availability}
          onPress={onReconcile}
        />
        <Button
          data-testid="message-copy"
          size="row"
          label={txt.copyText}
          variant="secondary"
          onPress={onCopyText}
        />
        <Button
          size="row"
          label={txt.sendAsNew}
          variant="secondary"
          onPress={onSendAsNew}
        />
      </div>
    </section>
  );
}
