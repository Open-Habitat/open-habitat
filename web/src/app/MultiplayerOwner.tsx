import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { Button } from "../components";
import { PersonAvatar, SharedCard } from "../components/Multiplayer";
import { useProcessView } from "../components/ProcessTray";
import { formatDate, useText } from "../i18n";
import { multiplayerText } from "../text/multiplayer";
import { NotAdmitted, respondQuestion, type Status } from "./conversations";
import type { HistoryEntry } from "./history";
import {
  controlMember,
  type Member,
  type Members,
  type OwnerShared,
  type Person,
  readMembers,
  readOwnerShared,
  readPeople,
  releaseRequest,
  Unavailable,
  type WaitingRequest,
} from "./multiplayer";
import { type ProcessRecord, processLabel, processLive } from "./processes";
import {
  type Offer,
  type OfferRow,
  processKey,
  type TakeBack,
  takeBackOffers,
} from "./takeBack";

// The owner's side of a shared conversation (ADR 0038): the people row
// under the header and its panel, the invite picker, the confirmation that
// names what full rights lend, the card after taking them back (at once,
// with the run and the running processes offered for stopping), the card
// where the agent stopped on a participant's request, and the per-call
// approval. Everything shown is the owner's daemon's record and facts,
// reread after every change and while the conversation is open.

const pollMs = 4000;

export function useSharedOwner(
  id: string | undefined,
  csrf: string | undefined,
  enabled: boolean,
  /** Changes when history moves, so facts are read again at once. */
  poke: unknown,
) {
  const [members, setMembers] = useState<Members>();
  const [facts, setFacts] = useState<OwnerShared>();
  // Take-backs made in this tab, newest per person, until dismissed.
  const [takeBacks, setTakeBacks] = useState<TakeBack[]>([]);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const current = useRef({ id, epoch: 0 });
  const factsWanted = useRef(false);
  const t = useText(multiplayerText);

  const refresh = useCallback(async () => {
    const at = current.current;
    const epoch = at.epoch;
    if (!at.id || !enabled) return;
    const target = at.id;
    try {
      const record = await readMembers(target);
      if (current.current.epoch !== epoch) return;
      setMembers(record);
      // Full rights given again end this tab's take-back of that person, so
      // a later take-back (from any tab) is a new one.
      setTakeBacks((all) => {
        const kept = all.filter(
          (x) =>
            !record.members.some(
              (m) => m.subject === x.subject && m.role === "full_rights",
            ),
        );
        return kept.length === all.length ? all : kept;
      });
      if (record.members.length) factsWanted.current = true;
      if (factsWanted.current) {
        const read = await readOwnerShared(target);
        if (current.current.epoch !== epoch) return;
        setFacts(read);
        if (!record.members.length && !read.waiting_requests.length)
          factsWanted.current = false;
      }
    } catch (error) {
      if (current.current.epoch !== epoch) return;
      // The feature is off on the daemon, or the conversation is not one it
      // shares: the owner's view simply has nothing of this.
      if (error instanceof Unavailable && error.reason === "gone") {
        setMembers(undefined);
        setFacts(undefined);
      }
    }
  }, [enabled]);

  useEffect(() => {
    current.current = { id, epoch: current.current.epoch + 1 };
    // Read once at opening whatever the record holds now: a removed
    // person's request may still wait.
    factsWanted.current = true;
    setMembers(undefined);
    setFacts(undefined);
    setTakeBacks([]);
    setNotice("");
    if (!id || !enabled) return;
    void refresh();
    const timer = globalThis.setInterval(() => void refresh(), pollMs);
    return () => globalThis.clearInterval(timer);
  }, [id, enabled, refresh]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: poke is the trigger.
  useEffect(() => {
    void refresh();
  }, [poke, refresh]);

  const change = useCallback(
    async (
      action: "invite" | "full_rights" | "take_back" | "remove",
      person: { subject: string; display_name: string },
    ) => {
      if (!id || !csrf || busy) return false;
      setBusy(true);
      setNotice("");
      try {
        const { outcome, members: next } = await controlMember(
          id,
          action,
          person.subject,
          csrf,
        );
        if (next) {
          setMembers(next);
          if (next.members.length) factsWanted.current = true;
          if (action === "take_back" || action === "remove")
            setTakeBacks((all) => [
              ...all.filter((x) => x.subject !== person.subject),
              {
                kind: action === "remove" ? "removed" : "took",
                subject: person.subject,
                name: person.display_name,
                at: Date.now(),
                revocation: next.revocation,
              },
            ]);
          return true;
        }
        setNotice(
          outcome.kind === "refused" ? t.changeFailed : t.changeUncertain,
        );
        return false;
      } finally {
        setBusy(false);
        void refresh();
      }
    },
    [id, csrf, busy, refresh, t],
  );

  return {
    members,
    facts,
    takeBacks,
    dismissTakeBack: (subject: string) =>
      setTakeBacks((all) => all.filter((x) => x.subject !== subject)),
    notice,
    busy,
    refresh,
    change,
  };
}
export type SharedOwner = ReturnType<typeof useSharedOwner>;

function OwnerModal({
  open,
  onClose,
  title,
  testId,
  children,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  testId: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const t = useText(multiplayerText);
  return (
    <ModalOverlay
      className="ah-overlay"
      isDismissable
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal className="ah-modal">
        <AriaDialog
          className="ah-dialog"
          data-testid={testId}
          aria-label={title}
        >
          <Heading slot="title">{title}</Heading>
          {children}
          <div className="ah-dialog-actions">
            <Button
              data-testid={`${testId}-close`}
              size="page"
              variant="secondary"
              label={actions ? t.cancel : t.close}
              onPress={onClose}
            />
            {actions}
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

/** The people row under the header: who is in the conversation, who is
 * here, and Kutsu. It opens the panel. */
export function OwnerPeopleBand({
  owner,
  agentId,
  offers,
}: {
  owner: SharedOwner;
  agentId: string;
  offers?: TakeBackOffers;
}) {
  const t = useText(multiplayerText);
  const [panel, setPanel] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [confirming, setConfirming] = useState<Member>();
  if (!owner.members) return null;
  const members = owner.members.members;
  const present = new Map(
    (owner.facts?.present ?? []).map((p) => [p.subject, p]),
  );
  const here = members.filter((m) => present.has(m.subject)).length;
  return (
    <div className="ah-mp-band" data-testid="people-band">
      <button
        type="button"
        className="ah-mp-band-people"
        data-testid="people-band-open"
        aria-label={t.people}
        onClick={() => setPanel(true)}
      >
        {members.length ? (
          <span className="ah-mp-stack">
            {members.slice(0, 5).map((m) => (
              <PersonAvatar
                key={m.subject}
                subject={m.subject}
                name={m.display_name}
                avatarUrl={present.get(m.subject)?.avatar_url}
                presence={
                  m.state === "invited"
                    ? "invited"
                    : present.has(m.subject)
                      ? "here"
                      : "away"
                }
              />
            ))}
          </span>
        ) : null}
        <span>{members.length ? t.present(here) : t.nobody}</span>
        {members
          .filter((m) => m.role === "full_rights")
          .map((m) => (
            <span
              key={m.subject}
              className="ah-mp-role"
              data-role="full_rights"
            >
              {m.display_name} · {t.roles.full_rights}
            </span>
          ))}
      </button>
      <Button
        data-testid="people-invite"
        size="row"
        variant="quiet"
        label={t.invite}
        onPress={() => setInviting(true)}
      />
      {offers ? <TakeBackReminders offers={offers} /> : null}
      {owner.notice ? <span role="status">{owner.notice}</span> : null}
      <OwnerModal
        open={panel}
        onClose={() => setPanel(false)}
        title={t.people}
        testId="people-panel"
      >
        <p>{t.panelLead}</p>
        {members.length ? (
          <ul className="ah-mp-list">
            {members.map((m) => {
              const p = present.get(m.subject);
              return (
                <li
                  key={m.subject}
                  data-testid="people-member"
                  data-subject={m.subject}
                >
                  <PersonAvatar
                    subject={m.subject}
                    name={m.display_name}
                    avatarUrl={p?.avatar_url}
                    presence={
                      m.state === "invited" ? "invited" : p ? "here" : "away"
                    }
                  />
                  <span className="ah-mp-person">
                    <strong>{m.display_name}</strong>
                    <span>
                      {t.roles[m.role]} ·{" "}
                      {m.state === "invited"
                        ? t.states.invited
                        : p?.typing
                          ? t.states.typing
                          : p
                            ? t.states.here
                            : t.states.joined}
                    </span>
                  </span>
                  <span className="ah-mp-row-actions">
                    {m.state === "joined" && m.role === "participant" ? (
                      <Button
                        data-testid="people-full-rights"
                        size="row"
                        variant="secondary"
                        label={t.giveFull}
                        pending={owner.busy}
                        onPress={() => {
                          setPanel(false);
                          setConfirming(m);
                        }}
                      />
                    ) : null}
                    {m.role === "full_rights" ? (
                      <Button
                        data-testid="people-take-back"
                        size="row"
                        variant="danger-subtle"
                        label={t.takeBack}
                        pending={owner.busy}
                        onPress={() => {
                          void owner.change("take_back", m).then((done) => {
                            if (done) setPanel(false);
                          });
                        }}
                      />
                    ) : null}
                    <Button
                      data-testid="people-remove"
                      size="row"
                      variant="danger-subtle"
                      label={t.remove}
                      pending={owner.busy}
                      onPress={() => {
                        void owner.change("remove", m).then((done) => {
                          if (done) setPanel(false);
                        });
                      }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>{t.noMembers}</p>
        )}
        <Button
          data-testid="people-panel-invite"
          size="row"
          variant="secondary"
          label={t.invite}
          onPress={() => {
            setPanel(false);
            setInviting(true);
          }}
        />
      </OwnerModal>
      <OwnerModal
        open={!!confirming}
        onClose={() => setConfirming(undefined)}
        title={confirming ? t.confirmTitle(confirming.display_name) : ""}
        testId="full-rights-confirm"
        actions={
          <Button
            data-testid="full-rights-confirm-give"
            size="page"
            variant="danger"
            label={t.confirm}
            pending={owner.busy}
            onPress={() => {
              if (!confirming) return;
              void owner
                .change("full_rights", confirming)
                .then(() => setConfirming(undefined));
            }}
          />
        }
      >
        <p>{t.confirmLead}</p>
        <ul className="ah-mp-lent">
          {t.lent.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>{t.confirmAfter}</p>
      </OwnerModal>
      {inviting ? (
        <InviteDialog
          agentId={agentId}
          owner={owner}
          onClose={() => setInviting(false)}
        />
      ) : null}
    </div>
  );
}

function InviteDialog({
  agentId,
  owner,
  onClose,
}: {
  agentId: string;
  owner: SharedOwner;
  onClose: () => void;
}) {
  const t = useText(multiplayerText);
  const [people, setPeople] = useState<Person[] | "failed">();
  const read = useCallback(() => {
    const controller = new AbortController();
    void readPeople(agentId, controller.signal)
      .then((v) => setPeople(v.people))
      .catch(() => {
        if (!controller.signal.aborted) setPeople("failed");
      });
    return () => controller.abort();
  }, [agentId]);
  useEffect(read, [read]);
  return (
    <OwnerModal
      open
      onClose={onClose}
      title={t.inviteTitle}
      testId="invite-dialog"
    >
      <p>{t.inviteLead}</p>
      {people === undefined ? (
        <p role="status">{t.inviteLoading}</p>
      ) : people === "failed" ? (
        <p role="alert">{t.inviteFailed}</p>
      ) : people.length === 0 ? (
        <p>{t.inviteEmpty}</p>
      ) : (
        <ul className="ah-mp-list">
          {people.map((p) => (
            <li
              key={p.subject}
              data-testid="invite-person"
              data-subject={p.subject}
            >
              <PersonAvatar
                subject={p.subject}
                name={p.display_name}
                avatarUrl={p.avatar_url}
              />
              <span className="ah-mp-person">
                <strong>{p.display_name}</strong>
                {p.membership !== "none" ? (
                  <span>{t.membership[p.membership]}</span>
                ) : null}
              </span>
              {p.membership === "none" ? (
                <span className="ah-mp-row-actions">
                  <Button
                    data-testid="invite-person-add"
                    size="row"
                    variant="secondary"
                    label={t.inviteOne}
                    pending={owner.busy}
                    onPress={() => {
                      void owner.change("invite", p).then(() => read());
                    }}
                  />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </OwnerModal>
  );
}

// The take-back card (round 2, "Kortti"). Whether the owner left the
// processes running is remembered per tab and person, so the card folds
// into a line on reload too; the decision outlives no take-back after it.
const leftKey = (agentId: string, subject: string) =>
  `oh.take-back-left.${agentId}.${subject}`;
function leftAt(agentId: string, subject: string): number {
  try {
    return Number(sessionStorage.getItem(leftKey(agentId, subject))) || 0;
  } catch {
    return 0;
  }
}

/** The offers to show, with leave-running and reopening. */
export function useTakeBackOffers(
  owner: SharedOwner,
  agentId: string | undefined,
  entries: readonly HistoryEntry[],
) {
  const processes = useProcessView();
  const inventory = processes?.inventory;
  const [, setTick] = useState(0);
  // A failed or not yet read inventory says nothing about what runs: the
  // last one read stands. A Pi that is not running has no processes.
  const lastKnown = useRef<ProcessRecord[] | undefined>(undefined);
  if (inventory?.availability === "available")
    lastKnown.current = inventory.processes;
  else if (inventory?.unavailable_reason === "pi_not_running")
    lastKnown.current = [];
  const known = lastKnown.current;
  const offers = useMemo(
    () =>
      owner.members || owner.takeBacks.length
        ? takeBackOffers(entries, owner.takeBacks, known ?? [], owner.members)
        : [],
    [entries, owner.takeBacks, known, owner.members],
  );
  const isLeft = useCallback(
    (offer: Offer) =>
      !!agentId && leftAt(agentId, offer.take.subject) >= offer.take.at,
    [agentId],
  );
  const setLeft = useCallback(
    (subject: string, left: boolean) => {
      if (!agentId) return;
      try {
        if (left)
          sessionStorage.setItem(leftKey(agentId, subject), String(Date.now()));
        else sessionStorage.removeItem(leftKey(agentId, subject));
      } catch {
        /* Without storage the choice lasts until the view rerenders. */
      }
      setTick((n) => n + 1);
    },
    [agentId],
  );
  return { offers, isLeft, setLeft, known: known !== undefined };
}
export type TakeBackOffers = ReturnType<typeof useTakeBackOffers>;

/** The people row's reminder: a person's processes still run as the owner,
 * even after Jätä käyntiin. Pressing it opens the card and goes to it. */
export function TakeBackReminders({ offers }: { offers: TakeBackOffers }) {
  const t = useText(multiplayerText);
  return offers.offers
    .filter((o) => o.running > 0)
    .map((o) => (
      <button
        key={o.take.subject}
        type="button"
        className="ah-mp-reminder"
        data-testid="take-back-reminder"
        data-subject={o.take.subject}
        onClick={() => {
          offers.setLeft(o.take.subject, false);
          globalThis.requestAnimationFrame?.(() =>
            document
              .querySelector(
                `[data-testid="take-back-card"][data-subject="${CSS.escape(o.take.subject)}"]`,
              )
              ?.scrollIntoView?.({ block: "center", behavior: "smooth" }),
          );
        }}
      >
        <span className="ah-mp-dot" data-state="live" aria-hidden="true" />
        {t.reminder(o.take.name, o.running)}
      </button>
    ));
}

const time = (ms: number) =>
  formatDate(ms, { hour: "2-digit", minute: "2-digit" });
function span(t: (typeof multiplayerText)["fi"], ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return t.seconds(s);
  if (s < 3600) return t.minutes(Math.floor(s / 60));
  return t.hours(Math.floor(s / 3600));
}
/** Output newer than this reads as still printing. */
const printingMs = 30_000;

function showMessage(messageId: string) {
  const target = document.querySelector<HTMLElement>(
    `[data-message-id="${CSS.escape(messageId)}"]`,
  );
  if (!target) return;
  target.scrollIntoView?.({ block: "center", behavior: "smooth" });
  target.dataset.highlight = "true";
  globalThis.setTimeout(() => delete target.dataset.highlight, 2400);
}

function OfferProcess({
  row,
  now,
  stopping,
  canStop,
  onStop,
  onOpen,
}: {
  row: OfferRow;
  now: number;
  stopping: boolean;
  canStop: boolean;
  onStop: () => void;
  onOpen: () => void;
}) {
  const t = useText(multiplayerText);
  const p = row.process;
  const running = processLive(p);
  const state = running ? "live" : p.status === "killed" ? "stopped" : "exited";
  return (
    <li
      className="ah-mp-proc"
      data-testid="take-back-process"
      data-state={state}
      data-process={p.id}
    >
      <code className="ah-mp-proc-cmd">{p.command_preview || p.name}</code>
      {row.origin.by === "participant" ? (
        <div className="ah-mp-proc-origin">
          <span>
            {row.origin.at
              ? t.fromMessage(time(Date.parse(row.origin.at)))
              : t.fromMessage("–")}
          </span>
          {row.origin.text ? <q>{row.origin.text}</q> : null}
          {row.origin.message_id ? (
            <Button
              data-testid="take-back-show-message"
              size="row"
              variant="quiet"
              label={t.showMessage}
              onPress={() =>
                row.origin.by === "participant" &&
                showMessage(row.origin.message_id)
              }
            />
          ) : null}
        </div>
      ) : null}
      <p className="ah-mp-card-sub">
        {t.started(time(p.started_at), t.ago(span(t, now - p.started_at)))}
      </p>
      {running && p.last_output_at ? (
        <p
          className="ah-mp-card-sub"
          data-testid="take-back-output"
          data-printing={now - p.last_output_at < printingMs}
        >
          <span
            className="ah-mp-dot"
            data-state={now - p.last_output_at < printingMs ? "live" : "quiet"}
            aria-hidden="true"
          />
          {now - p.last_output_at < printingMs
            ? t.printing(t.ago(span(t, now - p.last_output_at)))
            : t.quiet(span(t, now - p.last_output_at))}
        </p>
      ) : null}
      <div className="ah-mp-proc-actions">
        {running ? (
          <Button
            data-testid="take-back-process-stop"
            size="row"
            variant="danger-subtle"
            label={stopping ? t.stopping : t.stop}
            availability={
              !canStop || stopping
                ? { state: "disabled", reason: t.stopping }
                : undefined
            }
            onPress={onStop}
          />
        ) : (
          <span data-testid="take-back-process-ended">
            {state === "stopped" ? t.stoppedRow : t.exitedRow(processLabel(p))}
          </span>
        )}
        <Button
          data-testid="take-back-process-output"
          size="row"
          variant="quiet"
          label={t.showOutput}
          onPress={onOpen}
        />
      </div>
    </li>
  );
}

/** After taking full rights back or removing someone: the run in progress
 * continues as text only and can be stopped here (only a run of this tab's
 * take-back), and each process the agent started on that person's turns is
 * listed with what identifies it and a stop. Nothing is stopped by itself.
 * The card stays until those processes end or the owner leaves them running;
 * a stop writes a Habitat line everyone in the conversation sees. */
export function TakeBackCard({
  offer,
  known,
  left,
  onLeave,
  onReopen,
  running,
  turn,
  onStopRun,
  onClose,
}: {
  offer: Offer;
  /** Whether the processes have been read at all. */
  known: boolean;
  left: boolean;
  onLeave: () => void;
  onReopen: () => void;
  running: boolean;
  /** The daemon's latest run decision: whose run is going. */
  turn?: OwnerShared["turn"];
  onStopRun?: () => void;
  onClose: () => void;
}) {
  const t = useText(multiplayerText);
  const processes = useProcessView();
  const [stopping, setStopping] = useState<Set<string>>(new Set());
  const [runStop, setRunStop] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = globalThis.setInterval(() => setNow(Date.now()), 5000);
    return () => globalThis.clearInterval(timer);
  }, []);
  const take = offer.take;
  const liveRows = offer.rows.filter((r) => processLive(r.process));
  const liveUnknown = offer.unknown.filter((r) => processLive(r.process));
  const stop = async (rows: OfferRow[]) => {
    const keys = rows.map((r) => processKey(r.process));
    setStopping((s) => new Set([...s, ...keys]));
    try {
      for (const r of rows)
        await processes?.control(
          r.process,
          false,
          r.origin.by === "participant" ? r.origin.subject : undefined,
        );
    } finally {
      setStopping((s) => {
        const next = new Set(s);
        for (const k of keys) next.delete(k);
        return next;
      });
    }
  };
  const open = (p: ProcessRecord) => processes?.select(p);
  // Only a run this person started loses its tools (the companion's rule);
  // the owner's own run goes on as it was. When the running Pi could not be
  // told, nobody knows, so stopping is offered.
  const runPart =
    offer.fromAction &&
    running &&
    (take.revocation === "failed" ||
      ((turn?.by === "participant" || turn?.by === "revoked") &&
        turn.subject === take.subject));
  const title =
    take.kind === "removed" ? t.removed(take.name) : t.tookBack(take.name);
  const unresolved = !known || liveRows.length + liveUnknown.length > 0;
  // One stop at a time goes to the process control.
  const busy = !processes?.canControl || !!processes?.pending;
  if (left && liveRows.length + liveUnknown.length > 0 && !runPart)
    return (
      <p
        className="ah-mp-line ah-mp-folded"
        data-testid="take-back-card"
        data-subject={take.subject}
        data-state="left"
      >
        <span className="ah-mp-line-mark" aria-hidden="true" />
        <span>
          {t.leftRunning(
            [...liveRows, ...liveUnknown]
              .map((r) => `”${r.process.command_preview || r.process.name}”`)
              .join(", "),
          )}
        </span>
        <Button
          data-testid="take-back-reopen"
          size="row"
          variant="quiet"
          label={t.show}
          onPress={onReopen}
        />
      </p>
    );
  return (
    <SharedCard
      testId="take-back-card"
      subject={take.subject}
      state={unresolved ? "open" : "resolved"}
      tone={unresolved ? "attention" : "neutral"}
      title={title}
      subtitle={take.kind === "removed" ? t.removedNote : undefined}
      actions={
        <>
          {liveRows.length > 1 ? (
            <Button
              data-testid="take-back-stop-all"
              size="row"
              variant="danger-subtle"
              label={t.stopAll(liveRows.length)}
              availability={
                busy ||
                liveRows.some((r) => stopping.has(processKey(r.process)))
                  ? { state: "disabled", reason: t.stopping }
                  : undefined
              }
              onPress={() => void stop(liveRows)}
            />
          ) : null}
          {liveRows.length + liveUnknown.length > 0 ? (
            <Button
              data-testid="take-back-leave"
              size="row"
              variant="quiet"
              label={t.leaveRunning}
              onPress={onLeave}
            />
          ) : offer.fromAction ? (
            <Button
              data-testid="take-back-close"
              size="row"
              variant="quiet"
              label={t.close}
              onPress={onClose}
            />
          ) : null}
        </>
      }
    >
      {runPart ? (
        <>
          <p>
            {take.revocation === "failed" ? t.revocationFailed : t.runContinues}
          </p>
          {onStopRun ? (
            <Button
              data-testid="take-back-stop-run"
              size="row"
              variant="secondary"
              label={runStop ? t.stopRunSent : t.stopRun}
              availability={
                runStop
                  ? { state: "disabled", reason: t.stopRunSent }
                  : undefined
              }
              onPress={() => {
                setRunStop(true);
                onStopRun();
              }}
            />
          ) : null}
        </>
      ) : null}
      <h4>{t.processes}</h4>
      {offer.rows.length ? (
        <>
          {liveRows.length ? (
            <p className="ah-mp-card-sub">{t.processesNote}</p>
          ) : (
            <p className="ah-mp-card-sub" data-testid="take-back-ended">
              {t.ended}
            </p>
          )}
          <ul className="ah-mp-procs">
            {offer.rows.map((row) => (
              <OfferProcess
                key={processKey(row.process)}
                row={row}
                now={now}
                stopping={stopping.has(processKey(row.process))}
                canStop={!busy}
                onStop={() => void stop([row])}
                onOpen={() => open(row.process)}
              />
            ))}
          </ul>
        </>
      ) : (
        <p
          className="ah-mp-card-sub"
          data-testid={known ? "take-back-none" : "take-back-unread"}
        >
          {known ? t.noProcesses : t.processesUnread}
        </p>
      )}
      {offer.unknown.length ? (
        <>
          <h4>{t.unknownTitle}</h4>
          <p className="ah-mp-card-sub">{t.unknownNote}</p>
          <ul className="ah-mp-procs">
            {offer.unknown.map((row) => (
              <OfferProcess
                key={processKey(row.process)}
                row={row}
                now={now}
                stopping={stopping.has(processKey(row.process))}
                canStop={!busy}
                onStop={() => void stop([row])}
                onOpen={() => open(row.process)}
              />
            ))}
          </ul>
        </>
      ) : null}
      {offer.others ? (
        <p className="ah-mp-card-sub" data-testid="take-back-others">
          {t.others(offer.others)}
        </p>
      ) : null}
    </SharedCard>
  );
}

/** The card where the agent stopped on a participant's request. */
export function WaitingCard({
  agentId,
  csrf,
  request,
  onDone,
}: {
  agentId: string;
  csrf?: string;
  request: WaitingRequest;
  onDone: () => void;
}) {
  const t = useText(multiplayerText);
  const [state, setState] = useState<"open" | "pending" | "sent" | "failed">(
    "open",
  );
  const answer = (action: "allow_all" | "approve_each" | "decline") => {
    if (!csrf || state === "pending" || state === "sent") return;
    setState("pending");
    void releaseRequest(agentId, request, action, csrf).then((outcome) => {
      setState(outcome.kind === "ok" ? "sent" : "failed");
      onDone();
    });
  };
  const disabled =
    !csrf || state === "pending" || state === "sent"
      ? { state: "disabled" as const, reason: t.busy }
      : undefined;
  return (
    <SharedCard
      testId="waiting-card"
      tone="attention"
      title={t.waitingTitle}
      subtitle={t.requester(request.display_name)}
      actions={
        state === "sent" ? (
          <p role="status">{t.released}</p>
        ) : (
          <>
            <Button
              data-testid="waiting-allow-all"
              size="row"
              label={t.allowAll}
              availability={disabled}
              onPress={() => answer("allow_all")}
            />
            <Button
              data-testid="waiting-approve-each"
              size="row"
              variant="secondary"
              label={t.approveEach}
              availability={disabled}
              onPress={() => answer("approve_each")}
            />
            <Button
              data-testid="waiting-decline"
              size="row"
              variant="quiet"
              label={t.decline}
              availability={disabled}
              onPress={() => answer("decline")}
            />
          </>
        )
      }
    >
      <p>{t.waitingLead}</p>
      {state === "failed" ? <p role="alert">{t.releaseFailed}</p> : null}
    </SharedCard>
  );
}

/** Puts each waiting request's card right after the agent's text-only
 * answer to it, where the agent stopped. */
export function withWaitingCards<
  T extends { id: string; kind: string; content: ReactNode },
>(
  items: T[],
  waiting: WaitingRequest[],
  card: (request: WaitingRequest) => ReactNode,
): (T | { id: string; kind: string; content: ReactNode })[] {
  if (!waiting.length) return items;
  const out: (T | { id: string; kind: string; content: ReactNode })[] = [];
  const pending = new Map(waiting.map((w) => [w.entry_key, w]));
  let open: WaitingRequest | undefined;
  for (const item of items) {
    const starts = item.kind === "participant" || item.kind === "user";
    if (open && starts) {
      out.push({
        id: `waiting:${open.request}`,
        kind: "question",
        content: card(open),
      });
      open = undefined;
    }
    out.push(item);
    const w = pending.get(item.id);
    if (w) {
      pending.delete(item.id);
      open = w;
    }
  }
  if (open)
    out.push({
      id: `waiting:${open.request}`,
      kind: "question",
      content: card(open),
    });
  // A request whose message is outside the loaded window still waits.
  for (const w of pending.values())
    out.push({
      id: `waiting:${w.request}`,
      kind: "question",
      content: card(w),
    });
  return out;
}

/** One call in a run the owner releases one call at a time: the tool and its
 * complete arguments, line breaks kept, with Salli, Älä salli and Salli
 * kaikki. The answer counts only for the request it was shown with. */
export function ApprovalCard({
  question,
  facts,
  agentId,
  identity,
  csrf,
  refresh,
  onLogin,
}: {
  question: NonNullable<Status["pending_question"]>;
  facts?: OwnerShared;
  agentId: string;
  identity: string;
  csrf?: string;
  refresh: () => Promise<void>;
  onLogin: () => void;
}) {
  const t = useText(multiplayerText);
  const key = `nah:${identity}:question:${agentId}:${question.request_id}`;
  const [state, setState] = useState<
    "open" | "pending" | "uncertain" | "stale"
  >(() => (sessionStorage.getItem(key) ? "uncertain" : "open"));
  const approval = question.approval;
  const respond = async (value: "allow" | "deny" | "allow_all") => {
    if (state !== "open" || !csrf) return;
    sessionStorage.setItem(key, "sent");
    setState("pending");
    try {
      await respondQuestion(
        agentId,
        question.request_id,
        "answer",
        csrf,
        value,
      );
      setState("uncertain");
    } catch (error) {
      if ((error as Error).message === "identity_lost") onLogin();
      setState(error instanceof NotAdmitted ? "stale" : "uncertain");
    } finally {
      void refresh();
    }
  };
  const release =
    facts?.release?.kind === "continue" &&
    (!approval?.request || facts.release.request === approval.request)
      ? facts.release
      : undefined;
  const disabled =
    state !== "open" || !csrf
      ? { state: "disabled" as const, reason: t.answerSent }
      : undefined;
  let args = approval?.arguments ?? "";
  try {
    // Show a JSON object's string values with their own line breaks; the
    // text is never interpreted, only laid out.
    const parsed = JSON.parse(args) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      args = Object.entries(parsed as Record<string, unknown>)
        .map(
          ([k, v]) =>
            `${k}: ${typeof v === "string" ? v : JSON.stringify(v, null, 2)}`,
        )
        .join("\n");
  } catch {
    /* Shown verbatim. */
  }
  return (
    <SharedCard
      testId="approval-card"
      tone="attention"
      title={t.approvalTitle}
      subtitle={release ? t.requester(release.display_name) : undefined}
      actions={
        state === "open" ? (
          <>
            <Button
              data-testid="approval-allow"
              size="row"
              label={t.allow}
              availability={disabled}
              onPress={() => void respond("allow")}
            />
            <Button
              data-testid="approval-deny"
              size="row"
              variant="secondary"
              label={t.deny}
              availability={disabled}
              onPress={() => void respond("deny")}
            />
            <Button
              data-testid="approval-allow-all"
              size="row"
              variant="quiet"
              label={t.allowAll}
              availability={disabled}
              onPress={() => void respond("allow_all")}
            />
          </>
        ) : (
          <p role="status">
            {state === "pending"
              ? t.busy
              : state === "stale"
                ? t.answerUncertain
                : t.answerSent}
          </p>
        )
      }
    >
      {approval ? (
        <>
          <p>{t.approvalTool(approval.tool)}</p>
          <pre className="ah-mp-args" data-testid="approval-arguments">
            {args}
          </pre>
        </>
      ) : null}
      {release?.approvals.length ? (
        <>
          <h4>{t.decisions}</h4>
          <ul className="ah-mp-rows">
            {release.approvals.map((a) => (
              <li key={a.call_id} data-answer={a.answer}>
                <code>{a.tool}</code>
                <span>{t.answers[a.answer]}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </SharedCard>
  );
}
