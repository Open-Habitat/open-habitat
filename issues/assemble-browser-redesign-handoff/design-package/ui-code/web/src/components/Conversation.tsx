import type { ReactNode } from "react";
import { Button, RadioGroup, TextArea, TextField } from "./Primitives";
import { Markdown } from "./Markdown";
import { Disclosure } from "./Overlays";
import { InlineNotice, StatusMark } from "./Status";
import type { Availability, ProblemView, TimelineItem, Tone } from "./types";
import { enabled } from "./types";

export function ConversationTimeline({
  state,
  items,
  newContentCount = 0,
  historyMode,
  emptyLabel = "Aloita keskustelu.",
  problem,
  onJumpToLatest,
  onHistoryModeChange,
}: {
  state: "loading" | "ready" | "empty" | "error" | "stale" | "unavailable";
  items: (TimelineItem & { kind?: string })[];
  newContentCount?: number;
  historyMode: "virtualized" | "pagedAccessible";
  emptyLabel?: string;
  problem?: ProblemView;
  onJumpToLatest: () => void;
  onHistoryModeChange?: (mode: "virtualized" | "pagedAccessible") => void;
}) {
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
        {items.map((item) => (
          <li key={item.id} data-kind={item.kind}>
            {item.content}
          </li>
        ))}
      </ol>
      {newContentCount > 0 ? (
        <Button
          label={`Uutta sisältöä (${newContentCount})`}
          variant="secondary"
          onPress={onJumpToLatest}
        />
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
  onCopy,
}: {
  speaker: string;
  children: ReactNode;
  time?: string;
  state?: string;
  stateTone?: Tone;
  stateAnimated?: boolean;
  onCopy: () => void;
}) {
  return (
    <article
      className={`ah-message${stateTone === "danger" || stateTone === "warning" || stateAnimated ? " ah-message-alert" : ""}`}
    >
      <header>
        <strong>{speaker}</strong>
        {time ? <time>{time}</time> : null}
        {state ? (
          <StatusMark
            label={state}
            tone={stateTone}
            animated={stateAnimated ? "running" : false}
          />
        ) : null}
      </header>
      <div className="ah-prose">{children}</div>
      <Button
        ariaLabel={`Kopioi viesti: ${speaker}`}
        label="Kopioi"
        variant="quiet"
        size="compact"
        onPress={onCopy}
      />
    </article>
  );
}
export function UserMessage({
  sourceText,
  time,
  deliveryState,
  deliveryTone = "neutral",
  onCopy,
}: {
  sourceText: string;
  time?: string;
  deliveryState?: string;
  deliveryTone?: Tone;
  onCopy: () => void;
}) {
  return (
    <Message
      speaker="Sinä"
      time={time}
      state={deliveryState}
      stateTone={deliveryTone}
      onCopy={onCopy}
    >
      <Markdown text={sourceText} />
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
    complete: "Valmis",
    interrupted: "Keskeytetty",
    failed: "Epäonnistui",
    unknown: "Tila ei tiedossa",
  };
  return (
    <Message
      speaker={modelLabel ? `Pi · ${modelLabel}` : "Pi"}
      time={time}
      state={streamState ? labels[streamState] : undefined}
      stateTone={
        streamState === "failed"
          ? "danger"
          : streamState === "unknown" || streamState === "interrupted"
            ? "warning"
            : "neutral"
      }
      stateAnimated={streamState === "streaming"}
      onCopy={onCopy}
    >
      {children}
    </Message>
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
          <code>{text}</code>
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
export function ToolRow({
  name,
  targetText,
  statusLabel,
  state,
  durationText,
  expanded,
  errorSummary,
  onToggle,
  children,
}: {
  name: string;
  targetText?: string;
  statusLabel: string;
  state: string;
  durationText?: string;
  expanded: boolean;
  errorSummary?: string;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <Disclosure
      expanded={expanded}
      label={name}
      summary={[targetText, statusLabel, durationText]
        .filter(Boolean)
        .join(" · ")}
      onToggle={onToggle}
    >
      {errorSummary ? (
        <InlineNotice
          title="Työkalu epäonnistui"
          description={errorSummary}
          tone="danger"
        />
      ) : null}
      <StatusMark label={state} tone={errorSummary ? "danger" : "neutral"} />
      {children}
    </Disclosure>
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
    <div className="ah-tool-output">
      <p>
        {streamSemantics === "unknown"
          ? "Päivitystapa ei tiedossa"
          : streamSemantics === "replacement"
            ? "Tuloste korvautuu"
            : "Tuloste jatkuu"}
      </p>
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
      <h3>{kindLabel}</h3>
      <p>{safeSummary}</p>
      {safePayloadText ? (
        <details>
          <summary>Näytä alkuperäinen sisältö</summary>
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
  activity,
  selectedWorkingMode,
  sendState,
  queueSummary,
  onChange,
  onSendNow,
  onSteer,
  onFollowUp,
  onModeChange,
  onInterrupt,
  onOpenQueue,
}: {
  value: string;
  availability?: Availability;
  activity: "idle" | "working" | "settling";
  selectedWorkingMode: "steer" | "follow_up";
  sendState?: "idle" | "pending" | "rejected" | "uncertain";
  queueSummary?: string;
  onChange: (value: string) => void;
  onSendNow: () => void;
  onSteer: () => void;
  onFollowUp: () => void;
  onModeChange: (mode: "steer" | "follow_up") => void;
  onInterrupt?: () => void;
  onOpenQueue?: () => void;
}) {
  const send =
    activity === "working"
      ? selectedWorkingMode === "steer"
        ? onSteer
        : onFollowUp
      : onSendNow;
  return (
    <section className="ah-composer" aria-label="Kirjoita viesti">
      <TextArea
        label="Viesti Pi:lle"
        value={value}
        onChange={onChange}
        availability={availability}
        hint="Enter lähettää. Shift+Enter tekee rivinvaihdon."
        onCommit={
          sendState === "pending" || availability.state !== "enabled"
            ? undefined
            : send
        }
      />
      {activity === "working" ? (
        <RadioGroup
          label="Työskentelyn aikainen lähetystapa"
          value={selectedWorkingMode}
          options={[
            {
              value: "steer",
              label: "Ohjaa tämän vuoron jälkeen",
              description: "Ei keskeytä käynnissä olevaa työkalua.",
            },
            { value: "follow_up", label: "Suorita valmistumisen jälkeen" },
          ]}
          onChange={onModeChange}
        />
      ) : null}
      <div className="ah-actions">
        <Button
          label={
            activity === "working"
              ? selectedWorkingMode === "steer"
                ? "Ohjaa tämän vuoron jälkeen"
                : "Suorita valmistumisen jälkeen"
              : "Lähetä"
          }
          availability={availability}
          pending={sendState === "pending"}
          onPress={send}
        />
        {onInterrupt ? (
          <Button
            label="Keskeytä vuoro"
            variant="secondary"
            onPress={onInterrupt}
          />
        ) : null}
        {onOpenQueue ? (
          <Button
            label={queueSummary ?? "Avaa jono"}
            variant="quiet"
            onPress={onOpenQueue}
          />
        ) : null}
      </div>
      {sendState === "rejected" ? (
        <InlineNotice
          title="Viesti hylättiin"
          description="Teksti säilytettiin. Korjaa syy ja lähetä tarkoituksella uudelleen."
          tone="danger"
        />
      ) : null}
    </section>
  );
}
export function QueuePanel({
  steeringTexts,
  followUpTexts,
  state,
  clearAvailability,
  onClearAll,
}: {
  steeringTexts: string[];
  followUpTexts: string[];
  state: "ready" | "pendingClear" | "error" | "stale";
  clearAvailability: Availability;
  onClearAll: () => void;
}) {
  return (
    <section className="ah-queue">
      <h2>Työskentelyjono</h2>
      {state === "stale" ? (
        <InlineNotice title="Jono on vanhentunut" tone="warning" />
      ) : null}
      {state === "error" ? (
        <InlineNotice
          title="Jonoa ei saatu"
          description="Jonon sisältöä ei tulkita tyhjäksi."
          tone="danger"
        />
      ) : null}
      {state !== "error" ? (
        <>
          <Queue title="Ohjaukset tämän vuoron jälkeen" texts={steeringTexts} />
          <Queue title="Valmistumisen jälkeen" texts={followUpTexts} />
        </>
      ) : null}
      <Button
        label="Tyhjennä koko jono"
        variant="secondary"
        pending={state === "pendingClear"}
        availability={clearAvailability}
        onPress={onClearAll}
      />
    </section>
  );
}
function Queue({ title, texts }: { title: string; texts: string[] }) {
  return (
    <section>
      <h3>{title}</h3>
      {texts.length ? (
        <ol>
          {keyedText(texts).map(({ key, value: text }) => (
            <li key={key}>{text}</li>
          ))}
        </ol>
      ) : (
        <p>Ei viestejä.</p>
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
