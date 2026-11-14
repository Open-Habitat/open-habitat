import { HabitatMark } from "./HabitatMark";
import { useOpenSpinoff } from "./Spinoffs";
import "./ProcessTray.css";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import {
  controlProcess,
  exitReading,
  fetchProcesses,
  fetchProcessOutput,
  type InterruptedProcess,
  interruptedLabel,
  type ProcessEvent,
  type ProcessInventory,
  type ProcessOutput,
  type ProcessRecord,
  processLabel,
  processLive,
  recordExit,
  spinoffLabel,
} from "../app/processes";
import { formatDate, textNow, useText } from "../i18n";
import { processTrayText } from "../text/processTray";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { PiToolUse } from "./PiBlocks";

export type BackgroundKind = "spin" | "help" | "proc";
interface ProcessView {
  inventory?: ProcessInventory;
  deliveryFor: (event: ProcessEvent) => ProcessEvent["delivery"];
  failed: boolean;
  refresh: () => void;
  /** Open the process in its own window. */
  select: (p: ProcessRecord) => void;
  /** Open the background panel on the process tab. */
  showInventory: () => void;
  panel: BackgroundKind | null;
  setPanel: (kind: BackgroundKind | null) => void;
  /** Stop one process (a wait stops only the wait), or clear finished ones. */
  control: (p?: ProcessRecord, force?: boolean) => Promise<void>;
  pending: boolean;
  canControl: boolean;
  notice: string;
}
const Context = createContext<ProcessView | null>(null);
export function useProcessView() {
  return useContext(Context);
}
export function ProcessProvider({
  id,
  csrf,
  onLogin,
  onStatusEvent,
  children,
}: {
  id?: string;
  csrf?: string;
  onLogin: () => void;
  onStatusEvent: (
    listener: (
      id: string,
      kind: string,
      payload?: Record<string, unknown>,
    ) => void,
  ) => () => void;
  children: ReactNode;
}) {
  // Route-keyed provider: fetched state is disposable and never enters the native store.
  const [inventory, setInventory] = useState<ProcessInventory>();
  const [failed, setFailed] = useState(false);
  const [deliveries, setDeliveries] = useState<
    Record<string, ProcessEvent["delivery"]>
  >({});
  const inventoryLoad = useRef<() => void>(() => {});
  const [panel, setPanel] = useState<BackgroundKind | null>(null);
  const [selected, setSelected] = useState<string>();
  const [outputTick, setOutputTick] = useState(0);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const refresh = useCallback(() => inventoryLoad.current(), []);
  useEffect(() => {
    if (!id) return;
    let active = true;
    let inflight = false;
    const controller = new AbortController();
    const load = async () => {
      if (inflight) return;
      inflight = true;
      try {
        const next = await fetchProcesses(id, controller.signal);
        if (active) {
          setInventory(next);
          setFailed(false);
        }
      } catch (error) {
        if (active) {
          setFailed(true);
          if ((error as Error).message === "identity_lost") onLogin();
        }
      } finally {
        inflight = false;
      }
    };
    inventoryLoad.current = () => {
      void load();
    };
    void load();
    const timer = window.setInterval(() => {
      void load();
      setOutputTick((n) => n + 1);
    }, 2000);
    return () => {
      active = false;
      inventoryLoad.current = () => {};
      controller.abort();
      window.clearInterval(timer);
    };
  }, [id, onLogin]);
  useEffect(
    () =>
      onStatusEvent((agentId, kind, payload) => {
        if (agentId !== id) return;
        if (
          kind === "process.notification" &&
          typeof payload?.notification_key === "string" &&
          ["wake", "steer", "context"].includes(String(payload.delivery))
        ) {
          const key = payload.notification_key;
          const delivery = payload.delivery as ProcessEvent["delivery"];
          setDeliveries((previous) =>
            Object.fromEntries([
              ...Object.entries(previous).slice(-63),
              [key, delivery],
            ]),
          );
        }
        if (kind === "process.changed") refresh();
        if (["process.output", "process.changed"].includes(kind))
          setOutputTick((n) => n + 1);
      }),
    [id, onStatusEvent, refresh],
  );
  const owner = inventory?.owner_generation;
  const control = async (p?: ProcessRecord, force = false) => {
    if (!id || !owner || !csrf || pending) return;
    setPending(true);
    setNotice("");
    const txt = textNow(processTrayText).notice;
    try {
      const result = await controlProcess(id, owner, csrf, p, force);
      if (!alive.current) return;
      setNotice(
        result === "error"
          ? txt.error
          : result === "terminate_timeout"
            ? txt.timeout
            : p?.run_ids.length
              ? txt.waitStopped
              : p
                ? txt.stopped
                : txt.cleared,
      );
    } catch (error) {
      if (!alive.current) return;
      if ((error as Error).message === "identity_lost") onLogin();
      else
        setNotice(
          (error as Error).message === "stale_process" ? txt.stale : txt.failed,
        );
    } finally {
      if (alive.current) {
        setPending(false);
        refresh();
      }
    }
  };
  const visible = failed ? undefined : inventory;
  const value: ProcessView = {
    deliveryFor: (event) =>
      event.delivery ??
      (event.notification_key
        ? (deliveries[event.notification_key] ?? null)
        : null),
    showInventory: () => setPanel("proc"),
    inventory: visible,
    failed,
    refresh,
    select: (p) => {
      if (owner) setSelected(processSelection(owner, p));
    },
    panel,
    setPanel,
    control,
    pending,
    canControl: !!csrf && !!owner,
    notice,
  };
  const selectedRecord = visible?.processes.find(
    (p) => processSelection(owner, p) === selected,
  );
  return (
    <Context.Provider value={value}>
      {children}
      {selected && id && owner ? (
        <ProcessWindow
          id={id}
          owner={owner}
          process={selectedRecord}
          view={value}
          tick={outputTick}
          onLogin={onLogin}
          onClose={() => setSelected(undefined)}
        />
      ) : null}
    </Context.Provider>
  );
}

// Jari 16.10.2026 (proto-background-strip-riff): a process opens in its own
// window rather than an expanding shelf: output, follow or pause, stop, force
// stop and clearing what has finished. pi-processes clears finished processes
// together; it has no single-process removal, so the window says so.
function ProcessWindow({
  id,
  owner,
  process,
  view,
  tick,
  onLogin,
  onClose,
}: {
  id: string;
  owner: string;
  process?: ProcessRecord;
  view: ProcessView;
  tick: number;
  onLogin: () => void;
  onClose: () => void;
}) {
  const txt = useText(processTrayText);
  const live = process ? processLive(process) : false;
  return (
    <ModalOverlay
      className="ah-overlay"
      isDismissable
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal className="ah-modal ah-process-window">
        <AriaDialog
          data-testid="process-dialog"
          className="ah-dialog"
          aria-label={process ? txt.processNamed(process.name) : txt.process}
        >
          <div className="ah-process-window-head">
            {process ? <ProcessMark process={process} /> : null}
            <Heading slot="title" className="ah-process-window-title">
              {process?.name ?? txt.process}
            </Heading>
            {process ? (
              <span
                className="ah-process-window-state"
                data-tone={live ? undefined : recordExit(process).tone}
              >
                {processLabel(process)}
                {!live && process.exit_code !== null
                  ? txt.code(process.exit_code)
                  : ""}
                {process.signal ? ` · ${process.signal}` : ""}
              </span>
            ) : null}
            <ControlButton
              data-testid="process-close"
              className="ah-process-window-close"
              size="inline"
              variant="quiet"
              slot="close"
              aria-label={txt.close}
            >
              <Icon name="cross" />
            </ControlButton>
          </div>
          {process ? (
            <>
              <code className="ah-process-window-command">
                $ {process.command_preview}
              </code>
              <ProcessOutputView
                key={`${owner}:${process.process_token}`}
                id={id}
                owner={owner}
                process={process}
                tick={tick}
                refresh={view.refresh}
                onLogin={onLogin}
              />
              <div className="ah-process-window-actions">
                {live ? (
                  <ControlButton
                    data-force={process.status === "terminate_timeout"}
                    size="row"
                    variant={
                      process.status === "terminate_timeout"
                        ? "danger-subtle"
                        : "secondary"
                    }
                    isDisabled={
                      !view.canControl ||
                      view.pending ||
                      process.status === "terminating"
                    }
                    data-testid="process-stop"
                    onPress={() =>
                      void view.control(
                        process,
                        process.status === "terminate_timeout",
                      )
                    }
                    title={txt.stopTitle}
                  >
                    <Icon name="stop" />
                    {process.status === "terminate_timeout"
                      ? txt.force
                      : txt.stop}
                  </ControlButton>
                ) : (
                  <ControlButton
                    data-testid="clear-finished-processes"
                    size="row"
                    variant="secondary"
                    isDisabled={!view.canControl || view.pending}
                    onPress={() => void view.control().then(onClose)}
                    title={txt.clearTitle}
                  >
                    <Icon name="trash" />
                    {txt.clear}
                  </ControlButton>
                )}
                {live && process.status !== "terminate_timeout" ? (
                  <ControlButton
                    data-testid="force-stop-process"
                    size="row"
                    variant="quiet"
                    isDisabled={!view.canControl || view.pending}
                    onPress={() => void view.control(process, true)}
                    title={txt.forceTitle}
                  >
                    {txt.force}
                  </ControlButton>
                ) : null}
              </div>
              {view.notice ? <p role="status">{view.notice}</p> : null}
            </>
          ) : (
            <p data-testid="process-output-unavailable">{txt.outputGone}</p>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
// No output or controls: the process and its log ended with the earlier Pi.
export function InterruptedProcesses({
  processes,
}: {
  processes: InterruptedProcess[];
}) {
  const txt = useText(processTrayText);
  return (
    <>
      <section
        data-testid="disconnected-processes"
        aria-label={txt.interrupted}
      >
        <div className="ah-process-group-heading">
          <h2>{txt.interrupted}</h2>
        </div>
        {processes.map((p) => (
          <div
            className="ah-process-row"
            data-state="interrupted"
            key={`${p.id}:${p.started_at}`}
          >
            <div className="ah-process-heading ah-process-interrupted">
              <span className="ah-process-mark" aria-hidden="true">
                <Icon name="stop" />
              </span>
              <span className="ah-process-name">{p.name}</span>
              <span className="ah-process-meta">
                {interruptedLabel(p)}
                {" · "}
                <time dateTime={new Date(p.started_at).toISOString()}>
                  {txt.started(
                    formatDate(p.started_at, {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  )}
                </time>
              </span>
              <code className="ah-process-command">{p.command_preview}</code>
            </div>
          </div>
        ))}
      </section>
      <p>{txt.interruptedNote}</p>
    </>
  );
}
export function ProcessMark({ process }: { process: ProcessRecord }) {
  return (
    <span
      className="ah-process-mark"
      aria-hidden="true"
      data-tone={
        processLive(process) || process.status === "killed"
          ? undefined
          : recordExit(process).tone
      }
    >
      {process.status === "running" ? (
        <span className="ah-process-dot" />
      ) : (
        <Icon
          name={
            processLive(process)
              ? "refresh"
              : process.status === "killed"
                ? "stop"
                : {
                    ok: "check" as const,
                    neutral: "system" as const,
                    err: "cross" as const,
                  }[recordExit(process).tone]
          }
        />
      )}
    </span>
  );
}
function ProcessOutputView({
  id,
  owner,
  process,
  tick,
  refresh,
  onLogin,
}: {
  id: string;
  owner: string;
  process: ProcessRecord;
  tick: number;
  refresh: () => void;
  onLogin: () => void;
}) {
  const txt = useText(processTrayText);
  const [follow, setFollow] = useState(true);
  const [output, setOutput] = useState<ProcessOutput>();
  const [failed, setFailed] = useState(false);
  const body = useRef<HTMLPreElement>(null);
  // Fences are scalar dependencies: inventory polling must not cancel output reads.
  const token = process.process_token;
  const processId = process.id;
  const outputLoad = useRef<() => void>(() => {});
  useEffect(() => {
    if (!follow) return;
    const controller = new AbortController();
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending || !active) return;
      pending = true;
      try {
        const next = await fetchProcessOutput(
          id,
          owner,
          { id: processId, process_token: token } as ProcessRecord,
          controller.signal,
        );
        if (active) {
          setOutput(next);
          setFailed(false);
        }
      } catch (error) {
        if (active) {
          setFailed(true);
          if ((error as Error).message === "identity_lost") onLogin();
          if ((error as Error).message === "stale_process") refresh();
        }
      } finally {
        pending = false;
      }
    };
    outputLoad.current = () => {
      void load();
    };
    void load();
    return () => {
      active = false;
      outputLoad.current = () => {};
      controller.abort();
    };
  }, [id, owner, token, processId, follow, onLogin, refresh]);
  useEffect(() => {
    void tick;
    outputLoad.current();
  }, [tick]);
  useEffect(() => {
    void output; // Scroll only after the bounded replacement tail commits.
    if (follow && body.current)
      body.current.scrollTop = body.current.scrollHeight;
  }, [follow, output]);
  return (
    <div className="ah-process-output">
      <div className="ah-process-output-head">
        {process.run_ids.length ? (
          <p>{txt.workerRuns(process.run_ids.join(", "))}</p>
        ) : null}
        <ControlButton
          size="inline"
          variant="quiet"
          aria-pressed={!follow}
          data-testid="process-follow"
          onPress={() => setFollow(!follow)}
        >
          {follow ? txt.pauseFollow : txt.follow}
        </ControlButton>
      </div>
      {!follow ? <p>{txt.paused}</p> : null}
      {failed ? <p role="status">{txt.outputFailed}</p> : null}
      {output ? (
        <>
          <p>
            {output.omitted_before === null
              ? txt.tailUnknown
              : output.omitted_before
                ? txt.omitted(output.omitted_before)
                : txt.tail}{" "}
            {output.retention_restarted === true
              ? txt.retentionRestarted
              : output.retention_restarted === null
                ? txt.retentionUnknown
                : ""}
          </p>
          {/* biome-ignore lint/a11y/useSemanticElements: Named scroll region for preformatted native output. */}
          <pre
            data-testid="process-output"
            role="region"
            aria-label={txt.output}
            ref={body}
            // biome-ignore lint/a11y/noNoninteractiveTabindex: Scrollable native output must be keyboard focusable.
            tabIndex={0}
          >
            {output.lines.map((line, index) => (
              <span
                className={
                  line.stream === "stderr" ? "ah-process-stderr" : undefined
                }
                // biome-ignore lint/suspicious/noArrayIndexKey: Stateless lines in a replaced tail, not native identities.
                key={`${index}:${line.stream}`}
              >
                {line.stream === "stderr" ? "stderr · " : ""}
                {line.text}
                {"\n"}
              </span>
            ))}
          </pre>
        </>
      ) : !failed ? (
        <p>{txt.loading}</p>
      ) : null}
    </div>
  );
}
export function ProcessCompletion({ event }: { event: ProcessEvent }) {
  const txt = useText(processTrayText);
  const context = useContext(Context);
  const [expanded, setExpanded] = useState(false);
  const delivery = context?.deliveryFor(event) ?? event.delivery;
  const reading =
    event.kind === "log_match" || event.kind === "log_match_suppressed"
      ? {
          tone: "neutral" as const,
          label:
            event.kind === "log_match" ? txt.logMatch : txt.logMatchSuppressed,
        }
      : exitReading({ ...event, killed: event.kind === "killed" });
  return (
    <div
      data-testid="process-completion"
      data-delivery={delivery}
      data-tone={reading.tone}
      className="ah-process-completion"
      role="note"
    >
      <Icon
        name={
          reading.tone === "ok"
            ? "check"
            : reading.tone === "err"
              ? "cross"
              : "system"
        }
      />
      <ControlButton
        data-testid="process-completion-toggle"
        size="inline"
        variant="quiet"
        aria-expanded={expanded}
        onPress={() => setExpanded(!expanded)}
      >
        <span className="ah-process-completion-name">{event.process_name}</span>{" "}
        · <span className="ah-process-completion-label">{reading.label}</span>
        {event.exit_code !== null ? txt.code(event.exit_code) : ""}
        {delivery === "wake"
          ? txt.woke
          : delivery === "steer"
            ? txt.steer
            : delivery === "context"
              ? txt.context
              : ""}
      </ControlButton>
      {expanded ? (
        <div>
          {event.summary ? <p>{event.summary}</p> : null}
          {event.signal ? (
            <p>
              {event.signal} · {event.end_reason}
            </p>
          ) : null}
          {event.spinoff?.length ? (
            <ul>
              {event.spinoff.map((run) => (
                <li key={run.run_id}>
                  {run.title || run.run_id} · {spinoffLabel(run)}
                  {run.commit ? ` · ${run.commit.slice(0, 8)}` : ""}{" "}
                  <small>{txt.now}</small>
                </li>
              ))}
            </ul>
          ) : event.run_ids.length ? (
            <p>{txt.runsUnknown}</p>
          ) : null}
          {event.run_ids.length && event.exit_code === 2 ? (
            <p>{txt.waitTimedOut}</p>
          ) : event.run_ids.length && event.exit_code === 3 ? (
            <p>{txt.waitFailed}</p>
          ) : event.run_ids.length && event.exit_code === 4 ? (
            <p>{txt.checkIn}</p>
          ) : reading.tone === "neutral" && event.exit_code ? (
            <p>{txt.codeUnknown}</p>
          ) : null}
          {context ? (
            <ControlButton
              size="row"
              variant="quiet"
              data-testid="process-inventory"
              onPress={context.showInventory}
            >
              {txt.openInventory}
            </ControlButton>
          ) : null}
          <p>{txt.kept}</p>
        </div>
      ) : null}
    </div>
  );
}
export function ProcessStartCard({
  argumentsText,
  result,
}: {
  argumentsText: string;
  result?: string;
}) {
  const txt = useText(processTrayText);
  const context = useContext(Context);
  let args: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(argumentsText);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      args = parsed as Record<string, unknown>;
  } catch {
    /* Partial tool arguments remain text below. */
  }
  const record = joinProcess(context?.inventory, result);
  return (
    <div className="ah-process-start">
      <p>
        process · {typeof args.action === "string" ? args.action : txt.call}
        {typeof args.name === "string" ? ` · ${args.name}` : ""}
      </p>
      {record ? (
        <>
          <p>
            {processLabel(record)} · {record.command_preview}
          </p>
          <ControlButton
            size="row"
            variant="quiet"
            data-testid="process-receipt-open"
            onPress={() => context?.select(record)}
          >
            {txt.showProcess}
          </ControlButton>
        </>
      ) : (
        <p>{txt.notJoined}</p>
      )}
      <details>
        <summary>{txt.callDetails}</summary>
        <pre>{argumentsText}</pre>
        {result ? <pre>{result}</pre> : null}
      </details>
    </div>
  );
}

// Keep the ordinary tool row while distinguishing a successful start call from
// a process that is still working. Unfenced old history stays a tool receipt.
export function ProcessAwareToolUse({
  argumentsText,
  result,
  ...props
}: Parameters<typeof PiToolUse>[0] & {
  argumentsText?: string;
  result?: string;
}) {
  const txt = useText(processTrayText);
  const context = useContext(Context);
  const record =
    props.name === "process"
      ? joinProcess(context?.inventory, result)
      : undefined;
  let target = props.targetText;
  let started = false;
  if (props.name === "process") {
    try {
      const args = JSON.parse(argumentsText ?? "{}");
      if (args?.action === "start") {
        started = true;
        target = `start · ${typeof args.name === "string" ? args.name : txt.processFallback}`;
      }
    } catch {
      /* Partial arguments are not a process identity. */
    }
  }
  return (
    <PiToolUse
      {...props}
      targetText={target}
      statusLabel={
        record
          ? processLabel(record)
          : started && props.state === "succeeded"
            ? txt.started_
            : undefined
      }
      state={
        record
          ? processLive(record)
            ? "running"
            : record.status === "killed"
              ? "cancelled"
              : {
                  ok: "succeeded" as const,
                  neutral: "cancelled" as const,
                  err: "failed" as const,
                }[recordExit(record).tone]
          : props.state
      }
    />
  );
}
function joinProcess(
  inventory: ProcessInventory | undefined,
  result?: string,
): ProcessRecord | undefined {
  if (!result || inventory?.availability !== "available") return;
  try {
    const native = JSON.parse(result);
    const source =
      native.process ?? native.details?.process ?? native.details ?? native;
    return inventory.processes.find(
      (p) =>
        p.id === source.id &&
        (p.process_token === source.process_token ||
          p.started_at ===
            (source.started_at ?? source.startedAt ?? source.startTime)),
    );
  } catch {
    return;
  }
}

export function ProcessWaitingChip({ label }: { label: string }) {
  const txt = useText(processTrayText);
  const openSpinoff = useOpenSpinoff();
  const context = useContext(Context);
  const awaited = context?.inventory?.processes.filter(
    (p) => p.status === "running" && p.wakes_agent,
  );
  const first =
    awaited?.find((p) =>
      p.spinoff?.some((r) => r.status === "pending" || r.status === "running"),
    ) ?? awaited?.[0];
  const name = first?.spinoff?.length
    ? first.spinoff
        .map((r) => `${r.title || r.run_id} · ${spinoffLabel(r)}`)
        .join(", ")
    : first?.name;
  return (
    <ControlButton
      data-testid={
        first?.spinoff?.length ? "spinoff-waiting" : "process-waiting"
      }
      size="row"
      variant="quiet"
      // The top status names the state only; what is awaited is in the
      // tooltip and in the window this opens.
      title={
        name
          ? `${name}${awaited && awaited.length > 1 ? ` +${awaited.length - 1}` : ""}`
          : txt.showWaited
      }
      onPress={() =>
        first
          ? first.run_ids.some((id) => openSpinoff(id))
            ? undefined
            : context?.select(first)
          : context?.showInventory()
      }
    >
      <HabitatMark state="background" size={16} />
      {label}
    </ControlButton>
  );
}

function processSelection(
  owner: string | null | undefined,
  p: ProcessRecord,
): string {
  return JSON.stringify([owner, p.id, p.process_token]);
}
