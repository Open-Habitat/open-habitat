import { useSpinoffGroups } from "./Spinoffs";
import {
  type ReactNode,
  type Ref,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ControlButton, DisclosureButton } from "./ControlElements";
import { ConversationFloatingAction } from "./ConversationFrame";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { Disclosure } from "./Overlays";
import { Button, RadioGroup, TextArea, TextField } from "./Primitives";
import type { StatusKind } from "./Status";
import { InlineNotice, StatusMark } from "./Status";
import { SyntaxCode } from "./SyntaxCode";
import type { Availability, ProblemView, TimelineItem, Tone } from "./types";
import { enabled } from "./types";

export function ConversationTimeline({
  nativeEntries = [],
  state,
  items,
  newContentCount = 0,
  showJumpToLatest = false,
  latestWorking,
  latestDuration,
  historyMode,
  emptyLabel = "Aloita keskustelu.",
  problem,
  onJumpToLatest,
  onHistoryModeChange,
}: {
  state: "loading" | "ready" | "empty" | "error" | "stale" | "unavailable";
  items: (TimelineItem & { kind?: string })[];
  nativeEntries?: { entry_key: string; timestamp?: string }[];
  newContentCount?: number;
  showJumpToLatest?: boolean;
  latestWorking?: boolean;
  latestDuration?: string;
  historyMode: "virtualized" | "pagedAccessible";
  emptyLabel?: string;
  problem?: ProblemView;
  onJumpToLatest: () => void;
  onHistoryModeChange?: (mode: "virtualized" | "pagedAccessible") => void;
}) {
  const groupedItems = useSpinoffGroups(items, nativeEntries);
  return (
    <section aria-label="Keskusteluhistoria" className="ah-timeline">
      {onHistoryModeChange ? (
        <div className="ah-timeline-tools">
          <Button
            label={
              historyMode === "virtualized"
                ? "Näytä saavutettava sivutettu historia"
                : "Käytä virtuaalista historiaa"
            }
            variant="quiet"
            size="compact"
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
      {state === "loading" ? <p>Ladataan keskustelua…</p> : null}
      {state === "empty" ? <p>{emptyLabel}</p> : null}
      {state === "error" || state === "unavailable" ? (
        <InlineNotice
          title={problem?.title ?? "Historiaa ei saada"}
          description={problem?.description}
          tone="danger"
        />
      ) : null}
      {state === "stale" ? (
        <InlineNotice
          title="Historia on vanhentunut"
          description="Näkyvää sisältöä voi lukea, mutta sen ajantasaisuutta ei voida vahvistaa."
          tone="warning"
        />
      ) : null}
      <ol className="ah-feed">
        {groupedItems.map((item) => (
          <li key={item.id} data-kind={item.kind}>
            {item.content}
          </li>
        ))}
      </ol>
      {showJumpToLatest ? (
        <ConversationFloatingAction>
          <Button
            label={
              latestWorking
                ? `● Pi työskentelee${latestDuration ? ` ${latestDuration}` : ""}${newContentCount > 0 ? ` (${newContentCount})` : ""}`
                : newContentCount > 0
                  ? `● Uusi vastaus (${newContentCount})`
                  : "Viimeisimpään"
            }
            variant="secondary"
            ariaLabel={
              latestWorking
                ? `Viimeisimpään, Pi työskentelee${newContentCount > 0 ? `, ${newContentCount} uutta viestiä` : ""}`
                : newContentCount > 0
                  ? `Viimeisimpään, uusi vastaus (${newContentCount})`
                  : "Viimeisimpään"
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
function Message({
  speaker,
  children,
  time,
  state,
  stateTone = "neutral",
  stateAnimated = false,
  stateKind = "neutral",
  replyComplete = false,
  replyModel,
  onCopy,
}: {
  speaker: string;
  replyComplete?: boolean;
  replyModel?: string;
  children: ReactNode;
  time?: string;
  state?: string;
  stateTone?: Tone;
  stateAnimated?: boolean;
  stateKind?: StatusKind;
  onCopy: () => void;
}) {
  return (
    <article
      className={`ah-message${replyComplete ? " ah-message-reply" : ""}${stateTone === "danger" || stateTone === "warning" || stateAnimated ? " ah-message-alert" : ""}`}
    >
      <header>
        <strong>
          {replyComplete ? <Icon name="check" /> : null}
          {speaker}
        </strong>
        {replyModel ? (
          <code className="ah-reply-model">{replyModel}</code>
        ) : null}
        <Button
          ariaLabel={`Kopioi viesti: ${speaker}`}
          label="Kopioi"
          icon="copy"
          presentation="messageIcon"
          variant="quiet"
          size="compact"
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
      </header>
      <div className="ah-prose">{children}</div>
    </article>
  );
}
export function UserMessage({
  sourceText,
  children,
  time,
  deliveryState,
  deliveryTone = "neutral",
  onCopy,
}: {
  sourceText: string;
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
      speaker="Sinä"
      time={time}
      state={deliveryState}
      stateTone={deliveryTone}
      onCopy={onCopy}
    >
      <div
        ref={body}
        className={
          expanded ? "ah-user-content" : "ah-user-content ah-user-collapsed"
        }
      >
        {children ?? <Markdown text={sourceText} />}
      </div>
      {long || expanded ? (
        <Button
          label={expanded ? "Supista viesti" : "Näytä koko viesti"}
          variant="quiet"
          size="compact"
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
  modelLabel,
  onCopy,
}: {
  sourceText?: string;
  children: ReactNode;
  time?: string;
  streamState?: "streaming" | "complete" | "interrupted" | "failed" | "unknown";
  modelLabel?: string;
  onCopy: () => void;
}) {
  const labels = {
    streaming: "Vastaa",
    complete: "Vuoro valmis",
    interrupted: "Keskeytetty",
    failed: "Epäonnistui",
    unknown: "Tila ei tiedossa",
  };
  return (
    <Message
      speaker={
        streamState === "streaming"
          ? "Vastaa"
          : streamState === "complete"
            ? "Vastaus valmis"
            : "Pi"
      }
      replyComplete={streamState === "complete"}
      replyModel={streamState === "complete" ? modelLabel : undefined}
      time={time}
      state={
        streamState && streamState !== "complete" && streamState !== "streaming"
          ? labels[streamState]
          : streamState === "complete"
            ? undefined
            : modelLabel
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
  const labels = {
    pending: "Lähetetään · odottaa Pi:n kuittausta",
    accepted: "Hyväksytty Pi:n RPC:ssä · vuoro voi jatkua",
    rejected: "Hylätty · teksti säilytettiin",
    uncertain:
      "? Ei tiedossa, vastaanottiko Pi viestin. Viestiä ei lähetetä uudelleen automaattisesti.",
  };
  if (state === "accepted") return null;
  return (
    <div
      className={`ah-send-observation ah-send-${state}`}
      role={state === "rejected" ? "alert" : "status"}
    >
      {showText && state === "uncertain" ? (
        <p className="ah-send-text">{text}</p>
      ) : null}
      <div className="ah-send-meta">
        <p>{labels[state]}</p>
        {state === "uncertain" ? (
          <Button label="Kopioi teksti" variant="quiet" onPress={onCopy} />
        ) : null}
      </div>
    </div>
  );
}
export function TurnSettlement({ observedAt }: { observedAt: string }) {
  return (
    <p className="ah-settled" role="status">
      <Icon name="check" /> Vuoro valmis{" "}
      {new Date(observedAt).toLocaleTimeString("fi-FI", {
        hour: "2-digit",
        minute: "2-digit",
      })}{" "}
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
    <section className="ah-native-question" aria-label="Pi:n kysymys">
      <h2>Pi:n kysymys</h2>
      <p>{prompt}</p>
      {kind === "input" && !locked ? (
        <TextField label="Vastaus" value={value} onChange={onChange} />
      ) : null}
      {kind === "select" && !locked ? (
        <RadioGroup
          label="Valitse vastaus"
          value={value}
          options={choices.map((choice) => ({ value: choice, label: choice }))}
          onChange={onChange}
        />
      ) : null}
      {kind === "unknown" && choices.length ? (
        <p>{choices.join(" · ")}</p>
      ) : null}
      {state === "uncertain" ? (
        <p role="status">
          ? Ei tiedossa, käsitteliko Pi pyynnön. Tarkista tila; älä lähetä
          uudelleen.
        </p>
      ) : null}
      {state === "stale" ? (
        <p role="status">
          ? Pyyntö voi olla vanhentunut tai toimitus epävarma. Tarkista tila.
        </p>
      ) : null}
      {state === "pending" ? <p role="status">Käsitellään…</p> : null}
      {state === "unavailable" ? (
        <p role="status">Ohjaus ei ole käytettävissä.</p>
      ) : null}
      {state === "open" ? (
        <div className="ah-actions">
          {kind === "confirm" ? (
            <>
              <Button label="Kyllä" onPress={() => onRespond("answer", true)} />
              <Button
                label="Ei"
                variant="quiet"
                onPress={() => onRespond("answer", false)}
              />
            </>
          ) : kind === "input" || kind === "select" ? (
            <Button
              label="Vastaa"
              availability={
                !value ||
                (kind === "select" && !choices.includes(value)) ||
                new TextEncoder().encode(JSON.stringify(value)).length > 60000
                  ? {
                      state: "disabled",
                      reason:
                        new TextEncoder().encode(JSON.stringify(value)).length >
                        60000
                          ? "Vastaus on liian pitkä"
                          : kind === "input"
                            ? "Kirjoita vastaus"
                            : "Valitse vastaus",
                    }
                  : { state: "enabled" }
              }
              onPress={() => onRespond("answer", value)}
            />
          ) : null}
          <Button
            label="Peruuta kysymys"
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
    <aside className="ah-model-change" aria-label="Mallin vaihto">
      <span>
        Malli vaihtui · <code>{modelId}</code>
      </span>
      <Button
        label="Kopioi mallin tunniste"
        variant="quiet"
        size="compact"
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
      {contentState === "pending" ? (
        <p>Muotoilua tarkistetaan. Sisältö näytetään tekstinä.</p>
      ) : null}
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
        {languageLabel ?? "Koodi"} ·{" "}
        {sourceState === "continued"
          ? "Sisältö jatkuu"
          : sourceState === "livePartial"
            ? "Keskeneräinen"
            : "Kokonainen"}
        {highlightState !== "ready"
          ? ` · Korostus ${highlightState === "pending" ? "odottaa" : "epäonnistui"}`
          : ""}
      </figcaption>
      {collapsed ? (
        <p>Pitkä sisältö on supistettu.</p>
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
          label="Kopioi koodi"
          variant="quiet"
          size="compact"
          onPress={onCopy}
        />
        {onToggle ? (
          <Button
            label={collapsed ? "Näytä" : "Supista"}
            variant="quiet"
            size="compact"
            onPress={onToggle}
          />
        ) : null}
        {sourceState === "continued" && onLoadMore ? (
          <Button
            label="Lataa lisää"
            variant="secondary"
            size="compact"
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
        {parseState === "ready"
          ? "Jäsennetty muutos"
          : "Yhdistetty tekstimuutos"}
      </figcaption>
      <Button
        label={
          view === "splitVisual"
            ? "Näytä saavutettava yhdistetty diff"
            : "Näytä visuaalinen diff"
        }
        variant="quiet"
        size="compact"
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
                  ? "Lisätty rivi: "
                  : diffLineKind(line) === "delete"
                    ? "Poistettu rivi: "
                    : ""}
              </span>
              {line}
              {"\n"}
            </span>
          ))}
        </code>
      </pre>
      <Button
        label="Kopioi diff"
        variant="quiet"
        size="compact"
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
  const labels = {
    running: "ajossa",
    succeeded: "valmis",
    failed: "epäonnistui",
    cancelled: "keskeytetty",
  };
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
      className={`ah-tool-row${errorSummary ? " ah-tool-error" : ""}`}
      data-state={state}
    >
      <DisclosureButton tool aria-expanded={expanded} onPress={onToggle}>
        <Icon
          name="forward"
          className={expanded ? "ah-icon-expanded" : undefined}
        />
        <span className="ah-tool-names">
          <span className="ah-tool-name">{name}</span>
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
        summary={containsException ? `${summary} · Sisältää virheen` : summary}
        expanded={expanded}
        onToggle={onToggle}
      >
        {containsException ? (
          <StatusMark label="Sisältää virheen" tone="danger" />
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
        label="Kopioi näkyvä tuloste"
        variant="quiet"
        size="compact"
        onPress={onCopy}
      />
      {sourceState === "continued" && onLoadMore ? (
        <Button
          label="Lataa lisää"
          variant="secondary"
          size="compact"
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
      <StatusMark label="Tuntematon tapahtuma" tone="warning" />
      <p>{safeSummary}</p>
      <h3>{kindLabel}</h3>
      {safePayloadText ? (
        <details>
          <summary>Alkuperäinen sisältö</summary>
          <pre>{safePayloadText}</pre>
        </details>
      ) : null}
      <Button
        label="Kopioi tiedot"
        variant="quiet"
        size="compact"
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
  const closed: Record<string, string> = {
    answered: "Vastattu",
    cancelled: "Peruttu",
    expired: "Vanhentunut",
    resolvedElsewhere: "Käsiteltiin toisessa näkymässä",
  };
  if (closed[state])
    return (
      <InlineNotice title={prompt} description={closed[state]} tone="neutral" />
    );
  if (state === "unsupported")
    return (
      <InlineNotice
        title={prompt}
        description="Kysymystyyppiä ei tueta. Vastausta ei arvata."
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
        <TextField label="Vastaus" value={value} onChange={onChange} />
      ) : null}
      {kind === "select" ? (
        <RadioGroup
          label="Valitse vastaus"
          value={value}
          options={choices.map((choice) => ({ value: choice, label: choice }))}
          onChange={onChange}
        />
      ) : null}
      <div className="ah-actions">
        {kind === "confirm" ? (
          <>
            <Button
              label="Kyllä"
              pending={state === "pending"}
              onPress={() => onRespond(true)}
            />
            <Button
              label="Ei"
              variant="secondary"
              pending={state === "pending"}
              onPress={() => onRespond(false)}
            />
          </>
        ) : (
          <Button
            label="Vastaa"
            pending={state === "pending"}
            onPress={() => onRespond(value)}
          />
        )}
        <Button
          label="Peruuta pyyntö"
          variant="quiet"
          availability={cancelAvailability}
          onPress={onCancel}
        />
      </div>
    </section>
  );
}
export function Composer({
  value,
  availability = enabled,
  editorAvailability,
  activity,
  selectedWorkingMode,
  sendState,
  suppressAvailabilityReason = false,
  queueSummary,
  queueKnown = true,
  queueOpen = false,
  onChange,
  onSendNow,
  onSteer,
  onFollowUp,
  onModeChange,
  onInterrupt,
  onOpenQueue,
  modelPicker,
}: {
  value: string;
  modelPicker?: ReactNode;
  availability?: Availability;
  editorAvailability?: Availability;
  activity: "idle" | "working" | "settling";
  selectedWorkingMode: "steer" | "follow_up";
  sendState?: "idle" | "pending" | "rejected" | "uncertain";
  suppressAvailabilityReason?: boolean;
  queueSummary?: string;
  queueKnown?: boolean;
  queueOpen?: boolean;
  onChange: (value: string) => void;
  onSendNow: () => void;
  onSteer: () => void;
  onFollowUp: () => void;
  onModeChange: (mode: "steer" | "follow_up") => void;
  onInterrupt?: () => void;
  onOpenQueue?: () => void;
}) {
  const sendAvailability: Availability =
    !value.trim() && availability.state === "enabled"
      ? { state: "disabled", reason: "Kirjoita viesti." }
      : availability;
  const send =
    activity === "working"
      ? selectedWorkingMode === "steer"
        ? onSteer
        : onFollowUp
      : onSendNow;
  return (
    <section
      className={`ah-composer${!value.trim() && availability.state === "enabled" ? " ah-composer-empty" : ""}${suppressAvailabilityReason ? " ah-composer-notice-explains-block" : ""}`}
      aria-label="Kirjoita viesti"
    >
      <div className="ah-composer-entry">
        <div
          className={`ah-composer-field${modelPicker ? " ah-composer-field-with-model" : ""}`}
        >
          <TextArea
            label="Viesti Pi:lle"
            placeholder={
              activity === "working"
                ? "Ohjaa tai lähetä jonoon…"
                : "Viesti Pi:lle"
            }
            value={value}
            onChange={onChange}
            availability={editorAvailability ?? availability}
            rows={1}
            onCommit={
              sendState === "pending" || sendAvailability.state !== "enabled"
                ? undefined
                : send
            }
          />
          {modelPicker ? (
            <div className="ah-composer-model">{modelPicker}</div>
          ) : null}
        </div>
        <Button
          label="Lähetä"
          ariaLabel="Lähetä"
          icon="up"
          availability={sendAvailability}
          pending={sendState === "pending"}
          onPress={send}
        />
      </div>
      {sendState === "rejected" ? (
        <InlineNotice
          title="Viesti hylättiin"
          description="Teksti säilytettiin. Korjaa syy ja lähetä tarkoituksella uudelleen."
          tone="danger"
        />
      ) : null}

      {onOpenQueue && (!queueKnown || queueOpen) ? (
        <ControlButton
          className="ah-queue-link"
          variant="quiet"
          aria-expanded={queueOpen}
          onPress={onOpenQueue}
        >
          {queueKnown ? queueSummary : "Jonon tila ei tiedossa"}
        </ControlButton>
      ) : null}
      {activity === "working" ? (
        <div className="ah-composer-work-row">
          {onInterrupt ? (
            <ControlButton
              className="ah-composer-stop"
              variant="quiet"
              size="micro"
              aria-label="Keskeytä"
              title="Keskeytä"
              onPress={onInterrupt}
            >
              <Icon name="stop" />
            </ControlButton>
          ) : null}
          <fieldset
            className="ah-composer-modes"
            aria-label="Viestin lähetysaika"
          >
            <ControlButton
              variant="quiet"
              size="micro"
              aria-pressed={selectedWorkingMode === "steer"}
              onPress={() => onModeChange("steer")}
            >
              Ohjaa
            </ControlButton>
            <ControlButton
              variant="quiet"
              size="micro"
              aria-pressed={selectedWorkingMode === "follow_up"}
              onPress={() => onModeChange("follow_up")}
            >
              Työn jälkeen
            </ControlButton>
          </fieldset>
        </div>
      ) : null}
    </section>
  );
}
export function EndedConversationControl({
  state,
  onContinue,
  retryAvailable = false,
}: {
  retryAvailable?: boolean;
  state:
    | "ready"
    | "pending"
    | "writer_conflict"
    | "read_only_history"
    | "control_uncertain"
    | "capacity_exceeded"
    | "uncertain";
  onContinue: () => void;
}) {
  const descriptions = {
    ready:
      "Aiemman vuoron tulos voi olla epävarma. Tarkista historia ennen uuden viestin lähettämistä.",
    pending: "Jatkamista pyydetään. Älä lähetä pyyntöä uudelleen.",
    writer_conflict:
      "Keskustelulla on yhä aktiivinen kirjoittaja tai kirjoittajan päättymistä ei ole voitu varmistaa.",
    read_only_history:
      "Tämä on terminaalin historiaa; sitä ei voi ohjata selaimesta.",
    control_uncertain:
      "Historiaa tai työtilaa ei ole vielä voitu todentaa turvalliseksi jatkaa.",
    capacity_exceeded:
      "Samanaikaisten keskustelujen raja on täynnä. Jatkamista ei käynnistetty.",
    uncertain:
      "Jatkamisen tulos on epävarma. Tarkista tila ja historia; pyyntöä ei lähetetä uudelleen automaattisesti.",
  };
  return (
    <section className="ah-composer" aria-label="Keskustelun ohjaus">
      <InlineNotice
        title={
          state === "ready"
            ? "Keskustelu ei ole ohjattavissa"
            : state === "pending"
              ? "Jatkaminen odottaa"
              : state === "uncertain"
                ? "Jatkamisen tulos epävarma"
                : "Jatkaminen estetty"
        }
        description={descriptions[state]}
        tone={state === "ready" ? "neutral" : "warning"}
      />
      {state === "ready" || (state === "uncertain" && retryAvailable) ? (
        <Button
          label={
            state === "ready" ? "Jatka keskustelua" : "Yritä jatkaa uudelleen"
          }
          variant="quiet"
          onPress={onContinue}
        />
      ) : null}
    </section>
  );
}
export function QueuePanel({
  panelRef,
  steeringTexts,
  followUpTexts,
  state,
  clearAvailability,
  onClearAll,
}: {
  panelRef?: Ref<HTMLElement>;
  steeringTexts: string[];
  followUpTexts: string[];
  state: "ready" | "pendingClear" | "error" | "stale";
  clearAvailability: Availability;
  onClearAll: () => void;
}) {
  return (
    <section
      className="ah-queue"
      ref={panelRef}
      tabIndex={-1}
      aria-label="Työskentelyjono"
    >
      <div className="ah-queue-heading">
        <h2>Odottaa Pi:tä</h2>
        {state !== "error" ? (
          <span>{steeringTexts.length + followUpTexts.length}</span>
        ) : null}
        <Button
          label="Tyhjennä jono"
          variant="quiet"
          size="compact"
          pending={state === "pendingClear"}
          availability={clearAvailability}
          onPress={onClearAll}
        />
      </div>
      {state === "stale" ? (
        <InlineNotice title="Jono on vanhentunut" tone="warning" />
      ) : null}
      {state === "error" ? (
        <InlineNotice title="Jonon tila ei tiedossa" tone="warning" />
      ) : (
        <ul className="ah-queue-items">
          {keyedText(steeringTexts).map(({ key, value }) => (
            <li key={`steer:${key}`}>
              <span>Ohjaa</span>
              {value}
            </li>
          ))}
          {keyedText(followUpTexts).map(({ key, value }) => (
            <li key={`follow:${key}`}>
              <span>Lähetä</span>
              {value}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
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
          <dt>Hyväksyntä</dt>
          <dd>{acceptance}</dd>
        </div>
        <div>
          <dt>Suoritus</dt>
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
    <section className="ah-uncertain">
      <StatusMark label="Tulos epävarma" tone="warning" />
      <h2>{commandLabel}</h2>
      <p>{explanation}</p>
      {textPreview ? <blockquote>{textPreview}</blockquote> : null}
      <code>{commandIdLabel}</code>
      <div className="ah-actions">
        <Button
          label="Tarkista tila"
          availability={availability}
          onPress={onReconcile}
        />
        <Button
          label="Kopioi teksti"
          variant="secondary"
          onPress={onCopyText}
        />
        <Button
          label="Lähetä uutena…"
          variant="secondary"
          onPress={onSendAsNew}
        />
      </div>
    </section>
  );
}
