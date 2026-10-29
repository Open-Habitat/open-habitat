import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Dialog, DialogTrigger, Heading, Popover } from "react-aria-components";
import {
  type Spinoff,
  type Spinoffs,
  spinoffStateLabel,
  type WorkerTranscript,
} from "../app/spinoffs";
import { ControlButton } from "./ControlElements";
import {
  ConversationTimeline,
  ConversationVoice,
  UserMessage,
} from "./Conversation";
import { ConversationFrame, ConversationStream } from "./ConversationFrame";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { AgentHeader } from "./Navigation";
import { PiBoundary } from "./PiBlocks";
import { Button } from "./Primitives";
import { InlineNotice, type StatusKind } from "./Status";
import type { TimelineItem } from "./types";
import "./Spinoffs.css";
export const SpinoffContext = createContext<{
  data?: Spinoffs;
  stale?: boolean;
  open: (run: Spinoff) => void;
  /** A run whose Kerro agentille was pressed in its own view: the parent
   * conversation sends the request once it is back. */
  request?: string;
  setRequest?: (run?: string) => void;
} | null>(null);

const harnessName = { pi: "Pi", claude: "Claude Code", unknown: "Agentti" };

/** Whether the worker can still be at work: its window may exist. */
export function workerLive(run?: Spinoff) {
  return (
    !!run &&
    (run.state === "working" ||
      run.state === "waiting_parent" ||
      run.state === "unknown")
  );
}

/** Whether the worker's run has ended in Taskfleet's own words. */
export function workerEnded(run: Spinoff) {
  return (
    run.state === "merged" || run.state === "unmerged" || run.state === "failed"
  );
}

function stateKind(run: Spinoff): StatusKind {
  if (run.state === "working") return "working";
  if (run.state === "merged") return "success";
  if (run.state === "unmerged" || run.state === "failed") return "error";
  if (run.state === "unknown") return "unknown";
  return "neutral";
}

/**
 * Instead of a composer: the person asks through the main agent. Only a live
 * Pi worker can receive the main agent's message (`taskfleet run message` is
 * Pi-only), so what the main agent can do depends on the harness and on
 * whether the worker still runs.
 */
function WorkerAsk({ run, onParent }: { run?: Spinoff; onParent: () => void }) {
  const live = workerLive(run);
  const [lead, body] = !live
    ? [
        "Worker on päättynyt.",
        "Pääagentti on saanut sen raportin. Kysy jatkosta pääkeskustelussa.",
      ]
    : run?.harness === "pi"
      ? [
          "Workerille ei kirjoiteta suoraan.",
          "Pääagentti voi lähettää sille viestin. Kysy pääkeskustelussa, niin pääagentti välittää kysymyksen.",
        ]
      : [
          "Workerille ei kirjoiteta suoraan.",
          "Tälle workerille ei voi lähettää viestiä kesken työn, mutta pääagentti näkee sen tilan. Kysy pääkeskustelussa.",
        ];
  return (
    <DialogTrigger>
      <ControlButton
        data-testid="worker-ask"
        size="inline"
        presentation="pill"
        variant="secondary"
        className="ah-worker-ask"
        aria-label={`${lead} ${body}`}
      >
        <Icon name={live ? "message" : "info"} />
        <span className="ah-worker-ask-long">
          {live
            ? "Vain luku · kysy pääagentin kautta"
            : "Päättynyt · kysy jatkosta pääagentilta"}
        </span>
        <span className="ah-worker-ask-short">Kysy</span>
      </ControlButton>
      <Popover placement="bottom end" className="ah-popover">
        <Dialog
          className="ah-dialog ah-worker-ask-dialog"
          data-testid="worker-ask-notice"
        >
          {({ close }) => (
            <>
              <Heading slot="title">{lead}</Heading>
              <p>{body}</p>
              <ControlButton
                data-testid="worker-ask-parent"
                size="inline"
                variant="primary"
                onPress={() => {
                  close();
                  onParent();
                }}
              >
                {live ? "Kysy pääkeskustelussa" : "Pääkeskusteluun"}
                <Icon name="forward" />
              </ControlButton>
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

/** What the worker's run ended in, from Taskfleet's own report. */
function WorkerResult({ run, onTell }: { run: Spinoff; onTell?: () => void }) {
  if (!workerEnded(run)) return null;
  const merged = run.state === "merged";
  return (
    <aside
      className="ah-worker-result"
      data-tone={merged ? "ok" : "err"}
      data-testid="spinoff-result"
      aria-label="Tulos"
    >
      <header>
        <Icon name={merged ? "merge" : "warning"} />
        <strong>
          {merged
            ? `Laskeutui ${run.source_branch || "lähtöhaaraan"}`
            : spinoffStateLabel(run)}
        </strong>
        {!merged && run.branch ? <code>{run.branch}</code> : null}
      </header>
      {run.summary ? <Markdown text={run.summary} /> : null}
      {!merged ? (
        <p className="ah-worker-recover">
          Palautus pääagentin kautta:{" "}
          <code>taskfleet run show {run.run_id}</code> ·{" "}
          <code>taskfleet run salvage {run.run_id}</code>
        </p>
      ) : null}
      {onTell ? (
        <div className="ah-worker-decide" data-testid="worker-decide">
          <p>
            <strong>Mitä tälle työlle tehdään?</strong> Agentti tarkistaa sen ja
            suosittelee; sinä päätät vastaamalla pääkeskustelussa.
          </p>
          <ControlButton
            data-testid="worker-tell"
            size="row"
            variant="secondary"
            onPress={onTell}
          >
            <Icon name="message" />
            Kerro agentille
          </ControlButton>
        </div>
      ) : null}
    </aside>
  );
}

/**
 * A Taskfleet worker's view in place of its parent conversation (Kehys with
 * Pääte keskustelussa, Jari 26.10.2026): the worker's own native
 * conversation in the conversation's components, no composer, a band that
 * says whose worker this is, and the worker's terminal inside the
 * conversation: a card under the task while its history cannot be read,
 * then one row at the end.
 */
export function WorkerView({
  run,
  transcript,
  items,
  stale,
  loading = false,
  parentTitle,
  workspaceLabel,
  workspaceHref,
  terminal,
  historyArrived = false,
  onParent,
  onTell,
}: {
  run?: Spinoff;
  transcript?: WorkerTranscript;
  /** The worker's history in conversation form; empty when unreadable. */
  items: TimelineItem[];
  stale: boolean;
  loading?: boolean;
  parentTitle?: string;
  workspaceLabel: string;
  workspaceHref: string;
  /** The live worker's read-only terminal, when its window is known. */
  terminal?: ReactNode;
  /** The history became readable while this view was open. */
  historyArrived?: boolean;
  onParent: () => void;
  /** Sends the parent conversation a request about this worker's work. */
  onTell?: () => void;
}) {
  const [full, setFull] = useState(false);
  const [details, setDetails] = useState(false);
  // Follow the worker's newest work, unless the reader scrolled up.
  const stream = useRef<HTMLElement>(null);
  const follow = useRef(true);
  const live = workerLive(run);
  const readable = transcript?.availability === "available";
  const harness = harnessName[run?.harness ?? "unknown"];
  const why = !transcript
    ? "Workerin historiaa ei saatu luettua."
    : transcript.availability === "unsupported"
      ? `Habitat ei lue ${harness}-workerin keskustelua, joten sen työ näkyy päätteenä.`
      : "Workerin vastaukset ja työkalut korvaavat päätteen tässä, kun sen istunto löytyy.";
  const feed: (TimelineItem & { kind?: string })[] = [];
  // The brief opens the conversation whenever the history does not show it
  // itself: before it can be read, or when only its newest part is read.
  if (run?.brief && (!readable || transcript.truncated || !items.length))
    feed.push({
      id: "worker-brief",
      kind: "user",
      content: <WorkerBrief text={run.brief} />,
    });
  if (readable && transcript.truncated)
    feed.push({
      id: "worker-truncated",
      kind: "marker",
      content: (
        <PiBoundary>Näytetään workerin historian viimeisin osa.</PiBoundary>
      ),
    });
  if (readable) feed.push(...items);
  if (run?.awaiting_input && live)
    feed.push({
      id: "worker-prompt",
      kind: "marker",
      content: (
        <div className="ah-worker-prompt" role="status">
          <span>
            <Icon name="warning" />
            <strong>Worker odottaa vastausta päätteessä</strong>
          </span>
          {terminal ? (
            <Button
              data-testid="worker-prompt-terminal"
              size="inline"
              variant="secondary"
              label="Näytä pääte"
              onPress={() => setFull(true)}
            />
          ) : null}
          <small>
            Kehotteeseen vastataan workerin natiivissa päätteessä (
            <code>taskfleet run attach {run.run_id}</code>). Selaimen pääte on
            vain luku, eikä pääagentin viesti vastaa kehotteeseen.
          </small>
        </div>
      ),
    });
  if (live && readable && terminal)
    feed.push({
      id: "worker-terminal-row",
      kind: "marker",
      content: (
        <ControlButton
          data-testid="worker-terminal-row"
          size="row"
          variant="quiet"
          className="ah-worker-termrow"
          onPress={() => setFull(true)}
        >
          <Icon name="terminal" />
          <span>Pääte · vain luku</span>
          <span className="ah-worker-termrow-tail">
            {run?.awaiting_input ? "odottaa syötettä" : "avaa koko näkymään"}
          </span>
          <Icon name="expand" />
        </ControlButton>
      ),
    });
  if (live && !readable && run)
    feed.push({
      id: "worker-terminal-card",
      kind: "marker",
      content: (
        <section
          className="ah-worker-termcard"
          data-testid="worker-terminal-card"
          aria-label="Workerin pääte"
        >
          <header>
            <Icon name="terminal" />
            <strong>Pääte</strong>
            <span className="ah-terminal-ro">vain luku</span>
            <span className="ah-worker-grow" />
            {terminal ? (
              <Button
                data-testid="worker-terminal-expand"
                size="row"
                variant="quiet"
                icon="expand"
                label="Avaa pääte koko näkymään"
                ariaLabel="Avaa pääte koko näkymään"
                onPress={() => setFull(true)}
              />
            ) : null}
          </header>
          {terminal && !full ? (
            <div className="ah-worker-termcard-body">{terminal}</div>
          ) : !terminal ? (
            <p className="ah-worker-termcard-none">
              Workerin päätettä ei löytynyt.
            </p>
          ) : null}
          <p className="ah-worker-termcard-why">
            {transcript?.availability === "unavailable" ? (
              <span className="ah-worker-wait" aria-hidden="true" />
            ) : null}
            {why}
          </p>
        </section>
      ),
    });
  if (!live && !readable && run)
    feed.push({
      id: "worker-closed",
      kind: "marker",
      content: (
        <p className="ah-worker-closed" data-testid="worker-closed">
          <Icon name="terminal" />
          <span>
            <strong>Workerin pääte on suljettu.</strong> Worker on päättynyt
            {transcript?.availability === "unsupported"
              ? `, eikä Habitat lue ${harness}-workerin keskustelua`
              : ", eikä sen keskustelua saatu luettua"}
            . Jäljellä on raportti.
          </span>
        </p>
      ),
    });
  if (historyArrived && readable && live && terminal)
    feed.push({
      id: "worker-history-arrived",
      kind: "marker",
      content: (
        <p className="ah-worker-arrived" role="status">
          <Icon name="restore" />
          Historia tuli luettavaksi: pääte on nyt keskustelun lopussa.
        </p>
      ),
    });
  if (run && workerEnded(run))
    feed.push({
      id: "worker-result",
      kind: "marker",
      content: <WorkerResult run={run} onTell={onTell} />,
    });
  const last = feed.at(-1)?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new last item or a returned stream is the trigger.
  useLayoutEffect(() => {
    const el = stream.current;
    if (el && follow.current) el.scrollTop = el.scrollHeight;
  }, [last, feed.length, full, items]);
  return (
    <ConversationFrame className="ah-worker-frame">
      <div
        className="ah-worker-band"
        data-testid="worker-band"
        data-state={run?.state}
      >
        <span className="ah-worker-kind">
          <Icon name="branch" />
          Worker
        </span>
        <ControlButton
          data-testid="parent-top"
          size="inline"
          variant="quiet"
          className="ah-worker-parent"
          aria-label={`Pääkeskusteluun: ${parentTitle ?? "pääagentti"}`}
          onPress={onParent}
        >
          <Icon name="back" />
          <span>{parentTitle || "Pääkeskustelu"}</span>
        </ControlButton>
        {run ? (
          <span className="ah-worker-meta">
            <span>
              {harness}
              {run.profile ? ` · ${run.profile}` : ""}
            </span>
          </span>
        ) : null}
        <WorkerAsk run={run} onParent={onParent} />
      </div>
      <AgentHeader
        title={run?.title || "Worker"}
        activityLabel={run ? spinoffStateLabel(run) : ""}
        activityKind={run ? stateKind(run) : "neutral"}
        activityAnimated={run?.state === "working"}
        controlLabel="Vain luku"
        workspaceLabel={workspaceLabel}
        workspaceHref={workspaceHref}
        detailsExpanded={details}
        onToggleDetails={() => setDetails(!details)}
        detailsFacts={
          run
            ? [
                { label: "Pääkeskustelu", value: parentTitle || "Ei tiedossa" },
                {
                  label: "Agentti",
                  value: `${harness}${run.profile ? ` · profiili ${run.profile}` : ""}`,
                },
                {
                  label: "Historia",
                  value: readable
                    ? "Luettavissa"
                    : transcript?.availability === "unsupported"
                      ? "Habitat ei lue tämän agentin historiaa"
                      : "Istuntoa ei ole vielä löytynyt",
                },
                { label: "Tila", value: spinoffStateLabel(run) },
                {
                  label: "Lähtöhaara",
                  value: run.source_branch || "Ei tiedossa",
                },
                {
                  label: "Tallessa oleva haara",
                  value: run.branch || "Ei tiedossa",
                  copy: !!run.branch,
                },
                {
                  label: "Työpuu",
                  value: run.worktree || "Ei tiedossa",
                  copy: !!run.worktree,
                },
                { label: "Run", value: run.run_id, copy: true },
              ]
            : undefined
        }
      />
      {stale ? (
        <InlineNotice
          data-testid="worker-stale"
          tone="warning"
          title="Workerin ajantasaista tilaa ei saada."
        />
      ) : null}
      {full && terminal ? (
        <section
          className="ah-worker-termview"
          data-testid="worker-terminal-full"
          aria-label="Workerin pääte"
        >
          <header>
            <Icon name="terminal" />
            <strong>Pääte</strong>
            <span className="ah-terminal-ro">vain luku</span>
            <span className="ah-worker-grow" />
            <Button
              data-testid="worker-terminal-close"
              size="row"
              variant="quiet"
              icon="cross"
              label="Takaisin keskusteluun"
              ariaLabel="Takaisin keskusteluun"
              onPress={() => setFull(false)}
            />
          </header>
          <div className="ah-worker-termview-body">{terminal}</div>
        </section>
      ) : (
        <ConversationStream
          label="Workerin keskustelu"
          streamRef={stream}
          onScroll={() => {
            const el = stream.current;
            if (el)
              follow.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          }}
        >
          <WorkerVoice>
            <ConversationTimeline
              state={
                loading
                  ? "loading"
                  : feed.length || run
                    ? "ready"
                    : stale
                      ? "error"
                      : "empty"
              }
              items={feed}
              historyMode="pagedAccessible"
              emptyLabel="Workerin tietoja ei ole vielä."
              onJumpToLatest={() => {}}
              problem={{
                title: "Workeria ei saada",
                description: "Taskfleet ei vastannut. Yritetään uudelleen.",
              }}
            />
          </WorkerVoice>
        </ConversationStream>
      )}
    </ConversationFrame>
  );
}

function WorkerBrief({ text }: { text: string }) {
  return (
    <WorkerVoice voice="brief">
      <UserMessage
        sourceText={text}
        onCopy={() => void navigator.clipboard?.writeText(text)}
      />
    </WorkerVoice>
  );
}

/** Messages below speak in a worker's conversation (Pääagentti, Worker). */
export function WorkerVoice({
  voice = "worker",
  children,
}: {
  voice?: "worker" | "brief";
  children: ReactNode;
}) {
  return (
    <ConversationVoice.Provider value={voice}>
      {children}
    </ConversationVoice.Provider>
  );
}

export function useOpenSpinoff() {
  const ctx = useContext(SpinoffContext);
  return (id: string) => {
    const run = ctx?.data?.runs.find((r) => r.run_id === id);
    if (!run) return false;
    ctx?.open(run);
    return true;
  };
}
