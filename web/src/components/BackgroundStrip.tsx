import { type ReactNode, useContext, useEffect, useRef, useState } from "react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import {
  type ProcessRecord,
  processLabel,
  processLive,
  recordExit,
} from "../app/processes";
import type { Spinoff } from "../app/spinoffs";
import { ControlButton } from "./ControlElements";
import { Icon, type IconName } from "./Icon";
import {
  type BackgroundKind,
  InterruptedProcesses,
  ProcessMark,
  useProcessView,
} from "./ProcessTray";
import { SpinoffContext } from "./Spinoffs";
import "./BackgroundStrip.css";

// Merkit (Jari 16.10.2026, round 2026-10-16-taustatyo-riff): two small pills
// above the composer, one for the agent's spinoffs and one for its processes.
// At rest a pill says only whether something of its kind runs (icon and
// count) and whether a spinoff needs the person (red dot, until its branch
// is gone). A pill opens a floating panel with the two kinds as tabs; a
// process opens in a window. The process pill has no corner cue for a
// waited process (Jari 27.10.2026): a tiny bell read as a clock, and the
// top bar already says the agent waits. Its sentence names what it waits on.
// A `taskfleet run wait` belongs to its spinoff, never a process row.
//
// Pisteet (Jari 26.10.2026, proto-background-waits direction 3): the spinoff
// pill shows one mark per working spinoff instead of a count. The agent's
// background-wait mark means its ended turn waits on that spinoff; a dashed
// ring means nobody does, so a wait the agent forgot is visible on the closed
// pill. Not waiting is a fact, never an error. A live run in another state
// (Taskfleet doubts its supervisor, or it waits on its parent) keeps a muted
// mark: the closed pill must never read as "no workers" while one is live.

const duration = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60
    ? `${s} s`
    : s < 3600
      ? `${Math.floor(s / 60)} min`
      : `${Math.floor(s / 3600)} h ${Math.floor(s / 60) % 60} min`;
};
const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
  });
const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export interface SpinoffItem {
  run: Spinoff;
  live: boolean;
  wait?: ProcessRecord;
  /** The agent's turn resumes when this spinoff settles. */
  waited: boolean;
  attention: boolean;
}
/** Above this many marks the pill counts each kind instead. */
const MAX_MARKS = 5;
/** Live, but neither waited on nor known to be working. */
const other = (i: SpinoffItem) => !i.waited && i.run.state !== "working";
/** Working without the agent waiting on it: the dashed ring. */
const unwaited = (marks: SpinoffItem[]) =>
  marks.filter((i) => !i.waited && i.run.state === "working");

/** Everything the strip knows about each kind, derived in one place. */
export function backgroundFacts({
  runs,
  spinoffsStale,
  processes,
  interrupted,
  availability,
  reason,
  failed,
  agentIdle,
  piNotRunning = false,
}: {
  runs: Spinoff[];
  spinoffsStale: boolean;
  processes: ProcessRecord[];
  interrupted: number;
  availability?: "available" | "unavailable";
  reason?: string | null;
  failed: boolean;
  agentIdle: boolean;
  piNotRunning?: boolean;
}) {
  // The daemon joins a running wait to its run ids; Taskfleet may not answer.
  const waits = processes.filter((p) => p.run_ids.length && processLive(p));
  const known = new Set(runs.map((r) => r.run_id));
  const waitOnly: Spinoff[] = waits.flatMap((p) =>
    p.run_ids
      .filter((id) => !known.has(id))
      .map((id) => ({
        run_id: id,
        title: p.spinoff?.find((r) => r.run_id === id)?.title || id,
        state: "unknown" as const,
        created_at: new Date(p.started_at).toISOString(),
        preserved: false,
        branch: "",
        worktree: "",
        source_branch: "",
        summary: "",
      })),
  );
  // Only a wait whose end starts a turn is the agent waiting (the daemon's
  // waiting_on rule); any running wait can still be stopped from its row.
  const waking = (p?: ProcessRecord) => p?.wakes_agent === true;
  const spin: SpinoffItem[] = [...runs, ...waitOnly].map((run) => {
    const live = ["working", "waiting_parent", "unknown"].includes(run.state);
    const wait = waits.find((p) => p.run_ids.includes(run.run_id));
    return {
      run,
      live,
      wait,
      waited: live && waking(wait),
      // Jari 16.10.2026: a failed spinoff needs the person until its branch
      // is gone (merged or discarded), not until it has been looked at.
      attention:
        (run.state === "unmerged" || run.state === "failed") && run.preserved,
    };
  });
  const live = [
    ...spin.filter((i) => i.waited),
    ...spin.filter((i) => i.live && !i.waited),
  ];
  const records = processes.filter((p) => p.run_ids.length === 0);
  const available = availability === "available";
  // The conversation has no running Pi (stopped, or starting because a send
  // starts it, ADR 0020): a missing process bridge is then no connection
  // problem, and the waiting bubble already says what happens.
  const stopped = reason === "pi_not_running" || piNotRunning;
  const liveProcs = records.filter(processLive);
  return {
    spin: {
      items: spin,
      live,
      // One mark per live spinoff; its look says waited, working without
      // a wait, or another state.
      marks: live,
      ended: spin.filter((i) => !i.live),
      // The count says "työskentelee": unknown and parent-waiting runs are
      // listed with their own labels but not counted as working.
      working: spin.filter((i) => i.run.state === "working").length,
      attention: spin.filter((i) => i.attention).length,
      present: spin.length > 0,
      stale: spinoffsStale,
    },
    proc: {
      records,
      live: [
        ...liveProcs.filter((p) => p.wakes_agent),
        ...liveProcs.filter((p) => !p.wakes_agent),
      ],
      ended: records.filter((p) => !processLive(p)),
      waited: agentIdle && liveProcs.some((p) => p.wakes_agent),
      available,
      // Without a running Pi there is nothing to observe; saying so only
      // repeats what sending a message changes.
      present:
        records.length > 0 ||
        interrupted > 0 ||
        ((failed || availability === "unavailable") && !stopped),
      known: available,
    },
  };
}

export function BackgroundStrip({
  agentIdle,
  piNotRunning,
}: {
  agentIdle?: boolean;
  /** No Pi runs yet for this conversation (stopped, starting or failed). */
  piNotRunning?: boolean;
}) {
  const view = useProcessView();
  const spinoffs = useContext(SpinoffContext);
  const [endedOpen, setEndedOpen] = useState<Record<BackgroundKind, boolean>>({
    spin: false,
    proc: false,
  });
  const pills = useRef<Partial<Record<BackgroundKind, HTMLButtonElement>>>({});
  const inventory = view?.inventory;
  const interrupted = (inventory?.interrupted ?? []).filter(
    (p) => p.run_ids.length === 0,
  );
  const facts = backgroundFacts({
    runs: spinoffs?.data?.runs ?? [],
    spinoffsStale:
      !!spinoffs?.stale ||
      (!!spinoffs?.data && spinoffs.data.availability !== "available"),
    processes: inventory?.processes ?? [],
    interrupted: interrupted.length,
    availability: inventory?.availability,
    reason: inventory?.unavailable_reason,
    failed: !!view?.failed,
    agentIdle: !!agentIdle,
    piNotRunning: !!piNotRunning,
  });
  const kinds = (["spin", "proc"] as const).filter((k) => facts[k].present);
  const panel = view?.panel && kinds.includes(view.panel) ? view.panel : null;
  const close = () => {
    const kind = panel;
    view?.setPanel(null);
    if (kind) queueMicrotask(() => pills.current[kind]?.focus());
  };
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    // Escape closes the floating panel and returns focus to its pill; an
    // open process window handles its own Escape first.
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel]);
  useEffect(() => {
    // The finished part opens by itself where the red dot points.
    if (panel === "spin" && facts.spin.attention)
      setEndedOpen((o) => (o.spin ? o : { ...o, spin: true }));
  }, [panel, facts.spin.attention]);
  if (!view || !kinds.length) return null;
  const unavailable = view.failed
    ? "Prosessitietoja ei saatu"
    : ({
        pi_not_running: "Agentti ei ole käynnissä",
        terminal_control: "Agenttia ohjataan terminaalista",
        extension_missing: "Prosessilaajennusta ei ole",
        bridge_unavailable: "Prosessiyhteys ei ole saatavilla",
        error: "Prosessitietoja ei saatu",
      }[inventory?.unavailable_reason ?? "error"] ??
      "Prosessitietoja ei saatu");
  const sentence = (kind: BackgroundKind) => {
    if (kind === "spin") {
      const f = facts.spin;
      return [
        `Workerit: ${f.working ? `${f.working} työskentelee` : "ei työskentele"}`,
        f.live.length > f.working
          ? `${f.live.length - f.working} muussa tilassa`
          : "",
        f.marks.length
          ? [
              f.marks.some((i) => i.waited)
                ? `odotetaan: ${f.marks
                    .filter((i) => i.waited)
                    .map((i) => i.run.title || i.run.run_id)
                    .join(", ")}`
                : "",
              unwaited(f.marks).length
                ? `${unwaited(f.marks).length} ilman odotusta`
                : "",
            ]
              .filter(Boolean)
              .join(", ")
          : "",
        f.attention
          ? `${count(f.attention, "ei mergetty", "ei mergetty")}, työ tallessa`
          : "",
        f.ended.length ? count(f.ended.length, "päättynyt", "päättynyttä") : "",
      ]
        .filter(Boolean)
        .join(", ");
    }
    const f = facts.proc;
    if (!f.known)
      return interrupted.length
        ? `Prosessit: ${interrupted.length} katkesi`
        : `Prosessit: ei tiedossa (${unavailable})`;
    return [
      `Prosessit: ${f.live.length ? `${f.live.length} käynnissä` : "ei käynnissä"}`,
      f.waited
        ? `agentti odottaa: ${f.live
            .filter((p) => p.wakes_agent)
            .map((p) => p.name)
            .join(", ")}`
        : "",
      f.ended.length ? count(f.ended.length, "päättynyt", "päättynyttä") : "",
      interrupted.length ? `${interrupted.length} katkesi` : "",
    ]
      .filter(Boolean)
      .join(", ");
  };
  const icon: Record<BackgroundKind, IconName> = {
    spin: "branch",
    proc: "terminal",
  };
  const label: Record<BackgroundKind, string> = {
    spin: "Workerit",
    proc: "Prosessit",
  };
  const number = (kind: BackgroundKind) =>
    kind === "proc" && !facts.proc.known
      ? interrupted.length
        ? String(interrupted.length)
        : "?"
      : String(kind === "spin" ? facts.spin.working : facts.proc.live.length);
  const ended = (kind: BackgroundKind, n: number, rows: ReactNode) =>
    n ? (
      <>
        <div className="ah-bg-endhead">
          <ControlButton
            data-testid="ended-runs"
            variant="quiet"
            size="inline"
            className="ah-bg-endfold"
            aria-expanded={endedOpen[kind]}
            onPress={() => setEndedOpen((o) => ({ ...o, [kind]: !o[kind] }))}
          >
            <Icon name="forward" className="ah-bg-chev" />
            <span>{count(n, "päättynyt", "päättynyttä")}</span>
            {kind === "spin" && facts.spin.attention && !endedOpen.spin ? (
              <span
                className="ah-bg-attn-dot"
                role="img"
                aria-label="Vaatii huomiota"
              />
            ) : null}
          </ControlButton>
          {kind === "proc" && endedOpen.proc ? (
            <ControlButton
              data-testid="clear-finished-processes"
              variant="quiet"
              size="inline"
              className="ah-bg-clear"
              isDisabled={!view.canControl || view.pending}
              onPress={() => void view.control()}
              title="Poistaa päättyneet prosessit ja niiden lokit. Päättyneet workerit jäävät: ne ovat Taskfleetin ajoja."
            >
              <Icon name="trash" />
              <span>Poista päättyneet</span>
            </ControlButton>
          ) : null}
        </div>
        {endedOpen[kind] ? (
          // biome-ignore lint/a11y/useSemanticElements: A labelled group of rows, not a form fieldset.
          <div
            className="ah-bg-group"
            role="group"
            aria-label={`${label[kind]}: päättyneet`}
          >
            {rows}
          </div>
        ) : null}
      </>
    ) : null;
  // Rivi (Jari 27.10.2026, proto-worker-panel direction 1): two lines per
  // worker. The second line says in words what the row means for the agent
  // ("agentti odottaa" / "agentti ei odota") or how the run ended, so the
  // panel needs no legend; then the harness and profile, and the repository
  // only when the worker works in another one than this conversation.
  const spinRow = (i: SpinoffItem) => {
    const r = i.run;
    const word = stateWord(i);
    const when = i.live
      ? r.state === "working" || r.state === "waiting_parent"
        ? duration(Date.now() - Date.parse(r.created_at))
        : ""
      : r.ended_at && Number.isFinite(Date.parse(r.ended_at))
        ? clock(Date.parse(r.ended_at))
        : "";
    const agent = runAgent(r);
    return (
      <div
        className="ah-bg-row"
        data-kind="spin"
        data-state={r.state}
        data-attention={i.attention || undefined}
        data-waited={i.live ? i.waited : undefined}
        key={r.run_id}
      >
        <button
          data-testid={`spinoff-${r.title || r.run_id}`}
          type="button"
          className="ah-bg-main"
          onClick={() => spinoffs?.open(r)}
          title="Avaa workerin näkymä"
        >
          <span className="ah-bg-mark" aria-hidden="true">
            {i.live ? (
              <WaitMark item={i} />
            ) : (
              <Icon
                name={
                  r.state === "merged"
                    ? "merge"
                    : r.state === "failed" && !r.preserved
                      ? "cross"
                      : "warning"
                }
              />
            )}
          </span>
          <span className="ah-bg-lines">
            <span className="ah-bg-line">
              <span className="ah-bg-name">{r.title || r.run_id}</span>
              {when ? <span className="ah-bg-meta">{when}</span> : null}
            </span>
            <span className="ah-bg-sub" data-testid="spinoff-facts">
              <span className="ah-bg-word" data-tone={word.tone}>
                {word.text}
              </span>
              {agent ? (
                <>
                  <span className="ah-bg-sep" aria-hidden="true">
                    ·
                  </span>
                  <span>{agent}</span>
                </>
              ) : null}
              {r.other_repository ? (
                <>
                  <span className="ah-bg-sep" aria-hidden="true">
                    ·
                  </span>
                  <span
                    className="ah-bg-repo"
                    data-testid="spinoff-repository"
                    title="Eri repositorio kuin tämä keskustelu"
                  >
                    {r.other_repository}
                  </span>
                </>
              ) : null}
            </span>
          </span>
        </button>
        {i.wait ? (
          <ControlButton
            data-testid="stop-wait"
            className="ah-bg-stop"
            size="inline"
            variant="quiet"
            aria-label={`Lopeta odotus: ${r.title || r.run_id}`}
            title="Lopettaa agentin odotuksen. Worker jatkaa työtään, eikä agentti herää sen valmistuessa."
            isDisabled={!view.canControl || view.pending}
            onPress={() => i.wait && void view.control(i.wait)}
          >
            <Icon name="stop" />
          </ControlButton>
        ) : (
          <span className="ah-bg-gap" aria-hidden="true" />
        )}
      </div>
    );
  };
  const procRow = (p: ProcessRecord) => {
    const live = processLive(p);
    const exit = live ? undefined : recordExit(p);
    const meta =
      p.status === "running"
        ? duration(Date.now() - p.started_at)
        : [
            processLabel(p),
            exit?.tone !== "ok" && p.exit_code !== null
              ? `koodi ${p.exit_code}`
              : "",
            exit?.tone === "err" && p.signal ? p.signal : "",
          ]
            .filter(Boolean)
            .join(" · ") +
          (!live && p.ended_at ? ` · ${clock(p.ended_at)}` : "");
    return (
      <div
        className="ah-bg-row"
        data-kind="proc"
        data-state={p.status}
        data-tone={exit?.tone}
        key={p.process_token}
      >
        <button
          data-process-id={p.id}
          data-testid="process-open"
          type="button"
          className="ah-bg-main"
          aria-haspopup="dialog"
          onClick={() => view.select(p)}
        >
          <span className="ah-bg-mark" aria-hidden="true">
            <ProcessMark process={p} />
          </span>
          <span className="ah-bg-name ah-bg-mono">{p.name}</span>
          <code className="ah-bg-cmd">{p.command_preview}</code>
          <span className="ah-bg-meta">{meta}</span>
        </button>
        {live && p.wakes_agent ? (
          <span
            className="ah-bg-wake"
            role="img"
            aria-label="Agentti odottaa tätä"
            title="Agentti jatkaa, kun tämä päättyy"
          >
            <Icon name="bell" />
          </span>
        ) : null}
        {live ? (
          <ControlButton
            data-testid="stop-process"
            className="ah-bg-stop"
            size="inline"
            variant="quiet"
            aria-label={`Pysäytä ${p.name}`}
            title={`Pysäytä prosessi ${p.name}. Agentti ei saa tästä ilmoitusta.`}
            isDisabled={
              !view.canControl || view.pending || p.status === "terminating"
            }
            onPress={() =>
              void view.control(p, p.status === "terminate_timeout")
            }
          >
            <Icon name="stop" />
          </ControlButton>
        ) : (
          <span className="ah-bg-gap" aria-hidden="true" />
        )}
      </div>
    );
  };
  const spinPanel = (
    <>
      {facts.spin.stale ? (
        <p
          data-testid="background-stale"
          className="ah-bg-unavail"
          role="status"
        >
          Tila voi olla vanhentunut.
        </p>
      ) : null}
      {facts.spin.live.length ? (
        // biome-ignore lint/a11y/useSemanticElements: A labelled group of rows, not a form fieldset.
        <div
          className="ah-bg-group"
          role="group"
          aria-label="Workerit: käynnissä"
        >
          {facts.spin.live.map(spinRow)}
        </div>
      ) : (
        <p className="ah-bg-empty">Ei työskenteleviä workereita.</p>
      )}
      {ended("spin", facts.spin.ended.length, facts.spin.ended.map(spinRow))}
    </>
  );
  const procPanel = (
    <>
      {!facts.proc.known &&
      inventory?.unavailable_reason !== "pi_not_running" ? (
        <p data-testid="process-unavailable" className="ah-bg-unavail">
          {unavailable}. Puuttuva tieto ei tarkoita, ettei prosesseja ole.
        </p>
      ) : null}
      {interrupted.length ? (
        <InterruptedProcesses processes={interrupted} />
      ) : null}
      {facts.proc.live.length ? (
        // biome-ignore lint/a11y/useSemanticElements: A labelled group of rows, not a form fieldset.
        <div
          className="ah-bg-group"
          role="group"
          aria-label="Prosessit: käynnissä"
        >
          {facts.proc.live.map(procRow)}
        </div>
      ) : facts.proc.known ? (
        <p data-testid="process-empty" className="ah-bg-empty">
          Ei käynnissä olevia prosesseja.
        </p>
      ) : null}
      {ended("proc", facts.proc.ended.length, facts.proc.ended.map(procRow))}
    </>
  );
  return (
    <section
      data-testid="background-work"
      className="ah-bg-strip"
      aria-label="Taustatyö"
    >
      <div className="ah-bg-wrap">
        {panel ? (
          <div className="ah-bg-pop">
            <Tabs
              selectedKey={panel}
              onSelectionChange={(key) =>
                view.setPanel(String(key) as BackgroundKind)
              }
            >
              <div className="ah-bg-tabs">
                <TabList aria-label="Taustatyö" className="ah-bg-tablist">
                  {kinds.map((kind) => (
                    <Tab
                      data-testid={`background-tab-${kind === "proc" ? "process" : "spinoff"}`}
                      id={kind}
                      key={kind}
                      className="ah-bg-tab"
                    >
                      <Icon name={icon[kind]} className="ah-bg-kind-ic" />
                      {label[kind]}
                      <span className="ah-bg-tab-n">{number(kind)}</span>
                    </Tab>
                  ))}
                </TabList>
                <ControlButton
                  data-testid="close"
                  className="ah-bg-x"
                  size="inline"
                  variant="quiet"
                  aria-label="Sulje"
                  onPress={close}
                >
                  <Icon name="cross" />
                </ControlButton>
              </div>
              {kinds.map((kind) => (
                <TabPanel id={kind} key={kind} className="ah-bg-pop-body">
                  {kind === "spin" ? spinPanel : procPanel}
                </TabPanel>
              ))}
            </Tabs>
          </div>
        ) : null}
        {/* biome-ignore lint/a11y/useSemanticElements: A labelled group of two disclosure pills, not a form fieldset. */}
        <div
          data-testid="background-badges"
          className="ah-bg-badges"
          role="group"
          aria-label="Taustatyö"
        >
          {kinds.map((kind) => {
            const f = facts[kind];
            const idle =
              kind === "proc" && !facts.proc.known
                ? !interrupted.length
                : kind === "spin"
                  ? !facts.spin.live.length
                  : !f.live.length;
            return (
              <ControlButton
                data-testid={`background-${kind === "spin" ? "spinoffs" : "processes"}`}
                data-working={
                  kind === "spin" ? facts.spin.working : f.live.length
                }
                data-count={number(kind)}
                data-waited={
                  kind === "spin"
                    ? facts.spin.marks.filter((i) => i.waited).length
                    : undefined
                }
                data-unwaited={
                  kind === "spin"
                    ? unwaited(facts.spin.marks).length
                    : undefined
                }
                key={kind}
                size="inline"
                presentation="pill"
                ref={(node) => {
                  if (node) pills.current[kind] = node;
                }}
                className={`ah-bg-badge${idle ? " idle" : ""}`}
                data-kind={kind}
                aria-expanded={panel === kind}
                aria-label={sentence(kind)}
                title={sentence(kind)}
                onPress={() => view.setPanel(panel === kind ? null : kind)}
              >
                <Icon name={icon[kind]} className="ah-bg-kind-ic" />
                {kind === "spin" && facts.spin.marks.length ? (
                  <WaitMarks marks={facts.spin.marks} />
                ) : (
                  <span className="ah-bg-n">{number(kind)}</span>
                )}
                {kind === "spin" && facts.spin.attention ? (
                  <span className="ah-bg-corner attn" aria-hidden="true" />
                ) : null}
              </ControlButton>
            );
          })}
        </div>
      </div>
      {view.notice ? (
        <p className="ah-bg-notice" role="status">
          {view.notice}
        </p>
      ) : null}
    </section>
  );
}

/** The row's second line opens with this: what it means for the agent, or
 * how the run ended. */
export function stateWord(i: SpinoffItem): {
  text: string;
  tone: "wait" | "ok" | "err" | "muted";
} {
  const r = i.run;
  const kept = r.preserved ? " · työ tallessa" : "";
  if (r.state === "merged") return { text: "laskeutui", tone: "ok" };
  if (r.state === "failed") return { text: `epäonnistui${kept}`, tone: "err" };
  if (r.state === "unmerged")
    return {
      text: `ei mergetty${kept}`,
      tone: r.preserved ? "err" : "muted",
    };
  const state =
    r.state === "waiting_parent"
      ? "odottaa pääagenttia"
      : r.state === "unknown"
        ? "tila ei tiedossa"
        : "";
  if (i.waited)
    return {
      text: state ? `agentti odottaa · ${state}` : "agentti odottaa",
      tone: "wait",
    };
  return { text: state || "agentti ei odota", tone: "muted" };
}

const harnessName = { pi: "Pi", claude: "Claude" } as const;
/** "Pi · nopea": the worker's agent and Taskfleet profile, when known. */
function runAgent(r: Spinoff) {
  const name =
    r.harness === "pi" || r.harness === "claude" ? harnessName[r.harness] : "";
  // A profile named after its harness repeats it ("Claude · claude").
  const profile =
    r.profile && r.profile.toLowerCase() !== name.toLowerCase()
      ? r.profile
      : "";
  return [name, profile].filter(Boolean).join(" · ");
}

/** A live spinoff's mark: waited on, working without a wait, or neither. */
function WaitMark({ item }: { item: SpinoffItem }) {
  return item.waited ? (
    <span className="ah-bg-wait-dot ah-background-dot" />
  ) : item.run.state === "working" ? (
    <span className="ah-bg-wait-dot nowait" />
  ) : (
    <span className="ah-bg-dot unknown" />
  );
}

function WaitMarks({ marks }: { marks: SpinoffItem[] }) {
  if (marks.length <= MAX_MARKS)
    return (
      <span className="ah-bg-marks" aria-hidden="true">
        {marks.map((i) => (
          <WaitMark item={i} key={i.run.run_id} />
        ))}
      </span>
    );
  // Many workers: one mark per kind with its count, so the dashed ring of
  // a forgotten wait can never be cut off.
  const waited = marks.filter((i) => i.waited).length;
  const working = unwaited(marks).length;
  const rest = marks.filter(other).length;
  return (
    <span className="ah-bg-marks" aria-hidden="true">
      {waited ? (
        <>
          <span className="ah-bg-wait-dot ah-background-dot" />
          {waited}
        </>
      ) : null}
      {working ? (
        <>
          <span className="ah-bg-wait-dot nowait" />
          {working}
        </>
      ) : null}
      {rest ? (
        <>
          <span className="ah-bg-dot unknown" />
          {rest}
        </>
      ) : null}
    </span>
  );
}
