import {
  type ReactNode,
  useCallback,
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
import { Button } from "../components";
import { PersonAvatar, SharedCard } from "../components/Multiplayer";
import { useProcessView } from "../components/ProcessTray";
import { useText } from "../i18n";
import { multiplayerText } from "../text/multiplayer";
import { NotAdmitted, respondQuestion, type Status } from "./conversations";
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
import { processLabel, processLive } from "./processes";

// The owner's side of a shared conversation (ADR 0038): the people row
// under the header and its panel, the invite picker, the confirmation that
// names what full rights lend, the card after taking them back (at once,
// with the run and the running processes offered for stopping), the card
// where the agent stopped on a participant's request, and the per-call
// approval. Everything shown is the owner's daemon's record and facts,
// reread after every change and while the conversation is open.

const pollMs = 4000;

export type TakeBack = {
  kind: "took" | "removed";
  subject: string;
  name: string;
  revocation?: Members["revocation"];
};

export function useSharedOwner(
  id: string | undefined,
  csrf: string | undefined,
  enabled: boolean,
  /** Changes when history moves, so facts are read again at once. */
  poke: unknown,
) {
  const [members, setMembers] = useState<Members>();
  const [facts, setFacts] = useState<OwnerShared>();
  const [takeBack, setTakeBack] = useState<TakeBack>();
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
    setTakeBack(undefined);
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
            setTakeBack({
              kind: action === "remove" ? "removed" : "took",
              subject: person.subject,
              name: person.display_name,
              revocation: next.revocation,
            });
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
    takeBack,
    dismissTakeBack: () => setTakeBack(undefined),
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
}: {
  owner: SharedOwner;
  agentId: string;
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

/** After taking full rights back or removing someone (Heti): the run in
 * progress continues as text only and can be stopped here; the running
 * processes are listed with a stop each. Nothing is stopped by itself. */
export function TakeBackCard({
  takeBack,
  running,
  turn,
  onStopRun,
  onClose,
}: {
  takeBack: TakeBack;
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
  const live = (processes?.inventory?.processes ?? []).filter(processLive);
  return (
    <SharedCard
      testId="take-back-card"
      tone="attention"
      title={
        takeBack.kind === "removed"
          ? t.removed(takeBack.name)
          : t.tookBack(takeBack.name)
      }
      subtitle={takeBack.kind === "removed" ? t.removedNote : undefined}
      actions={
        <Button
          data-testid="take-back-close"
          size="row"
          variant="quiet"
          label={t.close}
          onPress={onClose}
        />
      }
    >
      {/* Only a run this person started loses its tools (the companion's
          rule); the owner's own run goes on as it was. When the running Pi
          could not be told, nobody knows, so stopping is offered. */}
      {running &&
      (takeBack.revocation === "failed" ||
        ((turn?.by === "participant" || turn?.by === "revoked") &&
          turn.subject === takeBack.subject)) ? (
        <>
          <p>
            {takeBack.revocation === "failed"
              ? t.revocationFailed
              : t.runContinues}
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
      {live.length ? (
        <>
          <p className="ah-mp-card-sub">{t.processesNote}</p>
          <ul className="ah-mp-rows">
            {live.map((p) => (
              <li key={p.id} data-testid="take-back-process">
                <code>{p.command_preview || p.name}</code>
                <span>{processLabel(p)}</span>
                <Button
                  data-testid="take-back-process-stop"
                  size="row"
                  variant="danger-subtle"
                  label={stopping.has(p.id) ? t.stopping : t.stop}
                  availability={
                    !processes?.canControl || stopping.has(p.id)
                      ? { state: "disabled", reason: t.stopping }
                      : undefined
                  }
                  onPress={() => {
                    setStopping((s) => new Set(s).add(p.id));
                    void processes?.control(p);
                  }}
                />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="ah-mp-card-sub">{t.noProcesses}</p>
      )}
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
