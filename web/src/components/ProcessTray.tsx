import { useOpenSpinoff } from "./Spinoffs";
import "./ProcessTray.css";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  controlProcess,
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
  spinoffLabel,
} from "../app/processes";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { PiToolUse } from "./PiBlocks";

interface ProcessView {
  tray?: ReactNode;
  inventory?: ProcessInventory;
  deliveryFor: (event: ProcessEvent) => ProcessEvent["delivery"];
  failed: boolean;
  refresh: () => void;
  select: (p: ProcessRecord) => void;
  showInventory: () => void;
}
const Context = createContext<ProcessView | null>(null);
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
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>();
  const [outputTick, setOutputTick] = useState(0);
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
  const value: ProcessView = {
    deliveryFor: (event) =>
      event.delivery ??
      (event.notification_key
        ? (deliveries[event.notification_key] ?? null)
        : null),
    showInventory: () => setOpen(true),
    inventory: failed ? undefined : inventory,
    failed,
    refresh,
    select: (p) => {
      setOpen(true);
      if (inventory?.owner_generation)
        setSelected(processSelection(inventory.owner_generation, p));
    },
  };
  value.tray = (
    <ProcessTrayView
      id={id}
      csrf={csrf}
      onLogin={onLogin}
      value={value}
      open={open}
      setOpen={setOpen}
      selected={selected}
      setSelected={setSelected}
      outputTick={outputTick}
    />
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function ProcessTraySlot() {
  return useContext(Context)?.tray ?? null;
}

function ProcessTrayView({
  id,
  csrf,
  onLogin,
  value,
  open,
  setOpen,
  selected,
  setSelected,
  outputTick,
}: {
  id?: string;
  csrf?: string;
  onLogin: () => void;
  value: ProcessView;
  open: boolean;
  setOpen: (v: boolean) => void;
  selected?: string;
  setSelected: (v?: string) => void;
  outputTick: number;
}) {
  const stateLabelId = useId();
  const [pending, setPending] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const [notice, setNotice] = useState("");
  const inventory = value.inventory;
  // run_ids are daemon recognition of a Taskfleet wait, independent of whether
  // Taskfleet enrichment succeeds. Keep the full inventory for native wake facts
  // and history joins, but never list a spinoff's waiter as another process.
  const records = (inventory?.processes ?? []).filter(
    (p) => p.run_ids.length === 0,
  );
  // A cut-off wait's spinoff already shows in its group, as a live wait does.
  const interrupted = (inventory?.interrupted ?? []).filter(
    (p) => p.run_ids.length === 0,
  );
  const available = inventory?.availability === "available";
  const owner = inventory?.owner_generation;
  const action = async (p?: ProcessRecord, force = false) => {
    if (!id || !owner || !csrf || pending) return;
    setPending(true);
    setNotice("");
    try {
      const result = await controlProcess(id, owner, csrf, p, force);
      if (!alive.current) return;
      setNotice(
        result === "error"
          ? "Toiminto epäonnistui."
          : result === "terminate_timeout"
            ? "Prosessi ei pysähtynyt. Voit pakottaa lopetuksen."
            : p
              ? "Odottaminen tai prosessi pysäytettiin. Agentti ei saa ilmoitusta; spinoff jatkaa työtään."
              : "Päättyneet prosessit ja niiden lokit poistettiin. Historia säilyy.",
      );
    } catch (error) {
      if (!alive.current) return;
      if ((error as Error).message === "identity_lost") onLogin();
      else
        setNotice(
          (error as Error).message === "stale_process"
            ? "Prosessin omistaja vaihtui. Tiedot päivitetään; toimintoa ei toistettu."
            : "Toiminto epäonnistui. Tarkista tila.",
        );
    } finally {
      if (alive.current) {
        setPending(false);
        value.refresh();
      }
    }
  };
  const unavailable = value.failed
    ? "Prosessitietoja ei saatu"
    : {
        pi_not_running: "Pi ei ole käynnissä",
        terminal_control: "Ohjataan terminaalista",
        extension_missing: "Prosessilaajennusta ei ole",
        bridge_unavailable: "Prosessiyhteys ei ole saatavilla",
        error: "Prosessitietoja ei saatu",
      }[inventory?.unavailable_reason ?? "error"];
  const selectedRecord = records.find(
    (p) => processSelection(owner, p) === selected,
  );
  // Without a running Pi there is no inventory to show, and saying that Pi
  // is not running only repeats what sending a message changes.
  // What a restart cut off stays visible until the agent has been told.
  const piStopped = inventory?.unavailable_reason === "pi_not_running";
  if (
    records.length === 0 &&
    interrupted.length === 0 &&
    (available || piStopped)
  )
    return null;
  const node = (
    <aside className="ah-process-tray" aria-label="Agentin prosessit">
      <div className="ah-process-bar-heading" data-open={open}>
        <ControlButton
          className="ah-process-bar"
          variant="quiet"
          aria-expanded={open}
          onPress={() => setOpen(!open)}
        >
          <Icon name="forward" className="ah-process-chevron" />
          <Icon name="terminal" />
          <span className="ah-process-summary">
            {available || (piStopped && interrupted.length) ? (
              <>
                <strong>
                  Prosessit ·{" "}
                  {available
                    ? `${records.filter(processLive).length} käynnissä`
                    : `${interrupted.length} katkesi`}
                </strong>
                <span className="ah-process-names">
                  {records
                    .filter(processLive)
                    .map((p) => p.name)
                    .join(", ")}
                </span>
              </>
            ) : inventory || value.failed ? (
              unavailable
            ) : (
              "Ladataan prosesseja…"
            )}
          </span>
          {available && records.some((p) => !processLive(p)) ? (
            <span className="ah-process-done">
              {records.filter((p) => !processLive(p)).length} päättynyt
            </span>
          ) : null}
          {available && interrupted.length ? (
            <span className="ah-process-done">
              {interrupted.length} katkesi
            </span>
          ) : null}
        </ControlButton>
        {available && records.some((p) => !processLive(p)) ? (
          <ControlButton
            className="ah-process-clear"
            size="micro"
            variant="quiet"
            isDisabled={!csrf || pending}
            onPress={() => void action()}
            title="Poistaa päättyneet prosessit ja niiden lokit. Keskustelun historia säilyy."
          >
            Poista päättyneet
          </ControlButton>
        ) : null}
      </div>
      {open ? (
        <div className="ah-process-list">
          {!available && !piStopped ? (
            <p>
              {unavailable}. Puuttuva tieto ei tarkoita, ettei prosesseja ole.
            </p>
          ) : null}
          {interrupted.length ? (
            <InterruptedProcesses processes={interrupted} />
          ) : null}
          {available
            ? (
                [
                  [
                    "Agentille ilmoittavat",
                    records.filter((p) => processLive(p) && p.wakes_agent),
                  ],
                  [
                    "Muut käynnissä",
                    records.filter((p) => processLive(p) && !p.wakes_agent),
                  ],
                  ["Päättyneet", records.filter((p) => !processLive(p))],
                ] as [string, ProcessRecord[]][]
              ).map(([label, group]) =>
                group.length ? (
                  <section key={label} aria-label={label}>
                    <div className="ah-process-group-heading">
                      <h2>{label}</h2>
                    </div>
                    {group.map((p) => (
                      <div
                        className="ah-process-row"
                        data-state={p.status}
                        data-failed={p.exit_code !== null && p.exit_code !== 0}
                        key={p.process_token}
                      >
                        <div className="ah-process-heading">
                          <ControlButton
                            className="ah-process-select"
                            aria-label={
                              p.spinoff?.length
                                ? p.spinoff
                                    .map(
                                      (run) =>
                                        `${run.title || run.run_id} · ${spinoffLabel(run)}`,
                                    )
                                    .join(", ")
                                : p.name
                            }
                            aria-describedby={`${stateLabelId}-${p.process_token}`}
                            variant="quiet"
                            aria-expanded={
                              selected === processSelection(owner, p)
                            }
                            onPress={() =>
                              setSelected(
                                selected === processSelection(owner, p)
                                  ? undefined
                                  : processSelection(owner, p),
                              )
                            }
                          >
                            <Icon
                              name="forward"
                              className="ah-process-chevron"
                            />
                            <ProcessMark process={p} />
                            <span className="ah-process-name">
                              {p.spinoff?.length
                                ? p.spinoff
                                    .map(
                                      (run) =>
                                        `${run.title || run.run_id} · ${spinoffLabel(run)}`,
                                    )
                                    .join(", ")
                                : p.name}
                              {p.run_ids.length && processLive(p)
                                ? " · odottaa spinoffia"
                                : ""}
                            </span>
                            <span
                              className="ah-process-meta"
                              id={`${stateLabelId}-${p.process_token}`}
                            >
                              {processLabel(p)}
                              {" · "}
                              <time
                                dateTime={new Date(p.started_at).toISOString()}
                              >
                                {Math.max(
                                  0,
                                  Math.floor(
                                    ((p.ended_at ?? Date.now()) -
                                      p.started_at) /
                                      1000,
                                  ),
                                )}{" "}
                                s
                              </time>
                            </span>
                            <code className="ah-process-command">
                              {p.command_preview}
                            </code>
                          </ControlButton>
                          {p.wakes_agent && processLive(p) ? (
                            <span
                              className="ah-process-wake"
                              title="Ilmoittaa agentille"
                            >
                              <Icon name="agent" />
                            </span>
                          ) : null}
                          {processLive(p) ? (
                            <ControlButton
                              className="ah-process-stop"
                              size="micro"
                              variant={
                                p.status === "terminate_timeout"
                                  ? "danger-subtle"
                                  : "quiet"
                              }
                              isDisabled={
                                !csrf || pending || p.status === "terminating"
                              }
                              onPress={() =>
                                void action(p, p.status === "terminate_timeout")
                              }
                              title={
                                p.run_ids.length
                                  ? "Lopettaa odottamisen. Spinoff jatkaa, eikä agentti saa ilmoitusta."
                                  : "Pysäyttää prosessin. Agentti ei saa tästä ilmoitusta."
                              }
                            >
                              <Icon name="stop" />
                              {p.status === "terminate_timeout"
                                ? "Pakota lopetus"
                                : p.run_ids.length
                                  ? "Lopeta odotus"
                                  : "Pysäytä"}
                            </ControlButton>
                          ) : null}
                        </div>
                        {selected === processSelection(owner, p) &&
                        id &&
                        owner ? (
                          <ProcessOutputView
                            key={`${owner}:${p.process_token}`}
                            id={id}
                            owner={owner}
                            process={p}
                            tick={outputTick}
                            refresh={value.refresh}
                            onLogin={onLogin}
                          />
                        ) : null}
                      </div>
                    ))}
                  </section>
                ) : null,
              )
            : null}
          {selected && !selectedRecord ? (
            <p>
              Tulostetta ei ole enää saatavilla. Prosessi on voitu poistaa tai
              Pi on käynnistetty uudelleen.
            </p>
          ) : null}
          <p className="ah-process-life">
            Selaimen sulkeminen tai agentin vuoron päättyminen ei pysäytä
            prosesseja.
          </p>
        </div>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
    </aside>
  );
  return id ? node : null;
}
// No output or controls: the process and its log ended with the earlier Pi.
function InterruptedProcesses({
  processes,
}: {
  processes: InterruptedProcess[];
}) {
  return (
    <>
      <section aria-label="Katkenneet">
        <div className="ah-process-group-heading">
          <h2>Katkenneet</h2>
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
                  aloitettu{" "}
                  {new Date(p.started_at).toLocaleTimeString("fi-FI", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </span>
              <code className="ah-process-command">{p.command_preview}</code>
            </div>
          </div>
        ))}
      </section>
      <p>
        Agentti kuulee katkenneista prosesseista seuraavan viestisi yhteydessä.
      </p>
    </>
  );
}
function ProcessMark({ process }: { process: ProcessRecord }) {
  return (
    <span className="ah-process-mark" aria-hidden="true">
      {process.status === "running" ? (
        <span className="ah-process-dot" />
      ) : (
        <Icon
          name={
            process.status === "exited" && process.exit_code === 0
              ? "check"
              : processLive(process)
                ? "refresh"
                : process.status === "exited"
                  ? "cross"
                  : "stop"
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
        <code>{process.command_preview}</code>
        {process.run_ids.length ? (
          <p>
            Spinoff-ajot: {process.run_ids.join(", ")}. Odotuksen lopettaminen
            ei pysäytä ajoja.
          </p>
        ) : null}
        <ControlButton
          size="micro"
          variant="quiet"
          aria-pressed={!follow}
          onPress={() => setFollow(!follow)}
        >
          {follow ? "Pysäytä seuraaminen" : "Seuraa loppua"}
        </ControlButton>
      </div>
      {!follow ? (
        <p>
          Seuraaminen tauolla. Prosessi jatkaa; jatkaminen hakee uuden
          loppuosan.
        </p>
      ) : null}
      {failed ? (
        <p role="status">
          Tulostetta ei saatu. Aiempi tuloste ei ole ajantasainen.
        </p>
      ) : null}
      {output ? (
        <>
          <p>
            {output.omitted_before === null
              ? "Näytetään säilytetty loppuosa; aiempien rivien määrä ei ole tiedossa."
              : output.omitted_before
                ? `${output.omitted_before} aiempaa riviä ei näytetä.`
                : "Säilytetty loppuosa."}{" "}
            {output.retention_restarted === true
              ? "Lokin säilytys on alkanut uudelleen."
              : output.retention_restarted === null
                ? "Lokin aiempi säilytys ei ole tiedossa."
                : ""}
          </p>
          {/* biome-ignore lint/a11y/useSemanticElements: Named scroll region for preformatted native output. */}
          <pre
            role="region"
            aria-label="Prosessin tuloste"
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
        <p>Ladataan tulostetta…</p>
      ) : null}
      {!processLive(process) ? (
        <p>
          {processLabel(process)} · koodi {process.exit_code ?? "ei tiedossa"}
          {process.signal ? ` · ${process.signal}` : ""}
        </p>
      ) : null}
    </div>
  );
}
export function ProcessCompletion({ event }: { event: ProcessEvent }) {
  const context = useContext(Context);
  const [expanded, setExpanded] = useState(false);
  const delivery = context?.deliveryFor(event) ?? event.delivery;
  const ordinaryLabel = {
    success: "valmis",
    failure: "epäonnistui",
    crash: "kaatui",
    killed: "pysäytetty",
    log_match: "lokiosuma",
    log_match_suppressed: "lokiosumien ilmoituksia jätettiin pois",
  }[event.kind];
  const label =
    event.run_ids.length && event.exit_code === 2
      ? "odotus aikakatkaistiin"
      : event.run_ids.length && event.exit_code === 3
        ? "ajo epäonnistui"
        : ordinaryLabel;
  return (
    <div className="ah-process-completion" role="note">
      <Icon name={event.kind === "success" ? "check" : "system"} />
      <ControlButton
        size="micro"
        variant="quiet"
        aria-expanded={expanded}
        onPress={() => setExpanded(!expanded)}
      >
        <span className="ah-process-completion-name">{event.process_name}</span>{" "}
        · {label}
        {event.exit_code !== null ? ` · koodi ${event.exit_code}` : ""}
        {delivery === "wake"
          ? " · herätti agentin"
          : delivery === "steer"
            ? " · agentille työn aikana"
            : delivery === "context"
              ? " · agentin kontekstiin"
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
                  <small>(nykytila)</small>
                </li>
              ))}
            </ul>
          ) : event.run_ids.length ? (
            <p>Spinoff-ajot: nykytilaa ei saatu.</p>
          ) : null}
          {event.run_ids.length && event.exit_code === 2 ? (
            <p>Odotus aikakatkaistiin. Spinoffit voivat yhä työskennellä.</p>
          ) : event.run_ids.length && event.exit_code === 3 ? (
            <p>Odotusehto päättyi epäonnistuneeseen ajoon.</p>
          ) : null}
          {context ? (
            <ControlButton variant="quiet" onPress={context.showInventory}>
              Avaa nykyiset prosessit
            </ControlButton>
          ) : null}
          <p>
            Merkintä säilyy historiassa. Aiemman prosessin tulosteen saatavuutta
            ei voida varmistaa.
          </p>
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
        process · {typeof args.action === "string" ? args.action : "kutsu"}
        {typeof args.name === "string" ? ` · ${args.name}` : ""}
      </p>
      {record ? (
        <>
          <p>
            {processLabel(record)} · {record.command_preview}
          </p>
          <ControlButton
            variant="quiet"
            onPress={() => context?.select(record)}
          >
            Näytä prosessi ja tuloste
          </ControlButton>
        </>
      ) : (
        <p>
          Nykyistä prosessia ei voitu yhdistää tähän kutsuun. Tarkista prosessit
          kentän yllä.
        </p>
      )}
      <details>
        <summary>Kutsun tiedot</summary>
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
        target = `start · ${typeof args.name === "string" ? args.name : "prosessi"}`;
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
            ? "Käynnistetty"
            : undefined
      }
      state={
        record
          ? processLive(record)
            ? "running"
            : record.status === "killed"
              ? "cancelled"
              : record.exit_code === 0
                ? "succeeded"
                : "failed"
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
      variant="quiet"
      title="Näytä mitä agentti odottaa"
      onPress={() =>
        first
          ? first.run_ids.some((id) => openSpinoff(id))
            ? undefined
            : context?.select(first)
          : context?.showInventory()
      }
    >
      {label}
      {name ? ` · ${name}` : ""}
      {awaited && awaited.length > 1 ? ` +${awaited.length - 1}` : ""}
    </ControlButton>
  );
}

function processSelection(
  owner: string | null | undefined,
  p: ProcessRecord,
): string {
  return JSON.stringify([owner, p.id, p.process_token]);
}
