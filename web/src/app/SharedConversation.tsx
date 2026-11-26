import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components";
import type { TurnStep } from "../components/AgentTurn";
import { Composer } from "../components/composer/Composer";
import { PersonAvatar, SharedViewer } from "../components/Multiplayer";
import { PageNotice } from "../components/PageNotice";
import { useText } from "../i18n";
import { multiplayerText } from "../text/multiplayer";
import { useExperimentalFeature } from "./accountPreferences";
import { parseConversationEvent } from "./conversationEvents";
import { type LiveTurnInput, TurnText, timelineItems } from "./HistoryView";
import type { HistoryEntry } from "./history";
import {
  abortGuest,
  cancelGuest,
  type GuestState,
  guestEventsURL,
  type Invite,
  joinShare,
  presenceGuest,
  readGuestHistory,
  readGuestState,
  readInvite,
  readShares,
  type Share,
  sendGuest,
  Unavailable,
} from "./multiplayer";

// A participant's view of another person's conversation (ADR 0038 section
// 6): the invitation under Jaettu kanssasi, and once joined, the
// conversation read through the share with the strip above the composer.
// The owner's daemon decides everything shown: the turn's mode, waiting
// requests, held messages and who is here. Nothing of the owner's workspace
// is reachable from here; the workspace is a name, not a link.

export const sharedPath = (share: string) => `/shared/${share}`;
export const sharedRoute = /^\/shared\/(s[a-z2-7]{26})$/;

const sharesPoll = 20000;

/** Jaettu kanssasi in the rail: the conversations other people invited this
 * person to. Nothing shows while there are none. */
export function SharedWithYouRail({
  pathname,
  identity,
}: {
  pathname: string;
  identity?: string;
}) {
  const t = useText(multiplayerText);
  const on = useExperimentalFeature("multiplayer");
  const [shares, setShares] = useState<Share[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a move to another page reads the list again.
  useEffect(() => {
    setShares([]);
    if (!on || !identity) return;
    let controller = new AbortController();
    const read = () => {
      controller.abort();
      controller = new AbortController();
      const signal = controller.signal;
      void readShares(signal)
        .then((v) => {
          if (!signal.aborted) setShares(v.shares);
        })
        .catch(() => {
          /* The list stays as it was; the next read tries again. */
        });
    };
    read();
    const timer = globalThis.setInterval(read, sharesPoll);
    return () => {
      globalThis.clearInterval(timer);
      controller.abort();
    };
  }, [on, identity, pathname]);
  if (!on || !shares.length) return null;
  return (
    <nav
      className="ah-mp-rail"
      data-testid="shared-with-you"
      aria-label={t.sharedWithYou}
    >
      <h2>{t.sharedWithYou}</h2>
      {shares.map((s) => (
        <Link
          key={s.share_id}
          to={sharedPath(s.share_id)}
          data-testid="shared-with-you-item"
          data-state={s.state}
          aria-current={
            pathname === sharedPath(s.share_id) ? "page" : undefined
          }
        >
          <PersonAvatar
            subject={`share:${s.share_id}`}
            name={s.owner.display_name}
            avatarUrl={s.owner.avatar_url}
          />
          <span>{s.owner.display_name}</span>
          {s.state === "invited" ? (
            <span className="ah-mp-badge">{t.inviteBadge}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}

/** /shared/<share_id>: the invitation before joining, the conversation
 * after. */
export function SharedPage({
  share,
  csrf,
  onLogin,
}: {
  share: string;
  csrf?: string;
  onLogin: () => void;
}) {
  const t = useText(multiplayerText);
  const [entry, setEntry] = useState<Share | null>();
  const [invite, setInvite] = useState<Invite | "gone" | "host">();
  const [generation, setGeneration] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: generation reads again after joining.
  useEffect(() => {
    const controller = new AbortController();
    setEntry(undefined);
    setInvite(undefined);
    void readShares(controller.signal)
      .then(async (v) => {
        const found = v.shares.find((s) => s.share_id === share) ?? null;
        setEntry(found);
        if (!found) return;
        const read = await readInvite(share, controller.signal);
        setInvite(read);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof Unavailable && error.reason === "login") onLogin();
        setInvite(
          error instanceof Unavailable && error.reason === "gone"
            ? "gone"
            : "host",
        );
      });
    return () => controller.abort();
    // generation: read again after joining.
  }, [share, generation, onLogin]);
  if (entry === undefined && invite === undefined)
    return (
      <p role="status" className="ah-mp-invite">
        {t.loading}
      </p>
    );
  if (entry === null || invite === "gone") return <SharedUnavailable />;
  if (invite === "host")
    return (
      <div className="ah-mp-invite">
        <PageNotice
          title={t.hostProblem}
          tone="neutral"
          actions={[
            { label: t.retry, onPress: () => setGeneration((g) => g + 1) },
          ]}
        />
      </div>
    );
  if (!entry || !invite)
    return (
      <p role="status" className="ah-mp-invite">
        {t.loading}
      </p>
    );
  if (invite.state === "invited")
    return (
      <InviteCard
        share={share}
        owner={entry.owner.display_name}
        title={invite.title}
        csrf={csrf}
        onJoined={() => setGeneration((g) => g + 1)}
      />
    );
  return (
    <SharedConversationView
      key={share}
      share={share}
      owner={entry.owner.display_name}
      csrf={csrf}
      onLogin={onLogin}
    />
  );
}

function SharedUnavailable() {
  const t = useText(multiplayerText);
  return (
    <div className="ah-mp-invite" data-testid="shared-unavailable">
      <h1>{t.unavailable}</h1>
      <p>{t.unavailableDetail}</p>
      <Link to="/workspaces">{t.toAll}</Link>
    </div>
  );
}

function InviteCard({
  share,
  owner,
  title,
  csrf,
  onJoined,
}: {
  share: string;
  owner: string;
  title: string;
  csrf?: string;
  onJoined: () => void;
}) {
  const t = useText(multiplayerText);
  const navigate = useNavigate();
  const [state, setState] = useState<"open" | "pending" | "failed">("open");
  return (
    <section className="ah-mp-invite" data-testid="shared-invite">
      <h1>{t.invitedBy(owner)}</h1>
      <p>
        <strong>{title || t.untitled}</strong>
      </p>
      <p>{t.inviteWhose}</p>
      <p>{t.inviteNothing}</p>
      {state === "failed" ? <p role="alert">{t.joinFailed}</p> : null}
      <div className="ah-mp-card-actions">
        <Button
          data-testid="shared-join"
          size="page"
          label={t.join}
          pending={state === "pending"}
          availability={
            !csrf ? { state: "disabled", reason: t.busy } : undefined
          }
          onPress={() => {
            if (!csrf || state === "pending") return;
            setState("pending");
            void joinShare(share, csrf).then((outcome) => {
              if (outcome.kind === "ok") onJoined();
              else setState("failed");
            });
          }}
        />
        <Button
          data-testid="shared-not-now"
          size="page"
          variant="secondary"
          label={t.notNow}
          onPress={() => navigate("/workspaces")}
        />
      </div>
    </section>
  );
}

type Live = { text: string; tool?: string };

function SharedConversationView({
  share,
  owner,
  csrf,
  onLogin,
}: {
  share: string;
  owner: string;
  csrf?: string;
  onLogin: () => void;
}) {
  const t = useText(multiplayerText);
  const timesOn = useExperimentalFeature("conversation-times");
  const [state, setState] = useState<GuestState>();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [revision, setRevision] = useState("");
  // Pages before the latest one, read on request and kept across rereads of
  // the latest page; before is where the next older page ends.
  const [older, setOlder] = useState<{
    entries: HistoryEntry[];
    before?: string;
    pending: boolean;
  }>({ entries: [], pending: false });
  const [problem, setProblem] = useState<"gone" | "host">();
  const [live, setLive] = useState<Live>({ text: "" });
  const [draft, setDraft] = useState("");
  const [sendState, setSendState] = useState<"idle" | "pending" | "rejected">(
    "idle",
  );
  const [stopSent, setStopSent] = useState(false);
  const alive = useRef(true);
  const reading = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const feed = useRef<HTMLDivElement>(null);
  const atEnd = useRef(true);

  const read = useCallback(async (): Promise<GuestState | undefined> => {
    try {
      const [next, page] = await Promise.all([
        readGuestState(share),
        readGuestHistory(share),
      ]);
      if (!alive.current) return;
      setProblem(undefined);
      setState(next);
      setEntries(page.entries);
      setRevision(page.native_revision);
      setOlder((o) =>
        o.entries.length
          ? o
          : {
              ...o,
              before: page.older_complete ? undefined : page.next_before,
            },
      );
      if (next.run.state !== "running") setLive({ text: "" });
      // Stop is pressable again once a read is back; while a stop is on its
      // way the daemon says so (aborting).
      setStopSent(false);
      return next;
    } catch (error) {
      if (!alive.current) return;
      if (error instanceof Unavailable) {
        if (error.reason === "login") onLogin();
        setProblem(error.reason === "gone" ? "gone" : "host");
      }
    }
  }, [share, onLogin]);
  // One read at a time; a change during a read reads once more after it.
  const reread = useCallback(() => {
    if (reading.current) {
      again.current = true;
      return;
    }
    reading.current = read().then(() => {
      reading.current = null;
      if (again.current) {
        again.current = false;
        reread();
      }
    });
  }, [read]);

  useEffect(() => {
    alive.current = true;
    let source: EventSource | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(reread, 250);
    };
    // A slow read beside the stream catches what a stream cannot carry, and
    // is the only follow-up when the daemon has no journal.
    const poll = globalThis.setInterval(reread, 15000);
    void read().then((first) => {
      if (!alive.current || !first) return;
      // The running answer so far, taken with the cursor the stream starts
      // after, so it continues where this text ends.
      const tail = first.live_tail
        .map((f) => f as { kind?: string; payload?: { text?: unknown } })
        .filter((f) => f.kind === "assistant.delta")
        .map((f) => String(f.payload?.text ?? ""))
        .join("");
      if (tail && first.run.state === "running") setLive({ text: tail });
      if (!first.journal_cursor) return;
      source = new EventSource(guestEventsURL(share, first.journal_cursor));
      source.onmessage = (message) => {
        let frame: ReturnType<typeof parseConversationEvent>;
        try {
          frame = parseConversationEvent(message.data);
        } catch {
          soon();
          return;
        }
        if (frame.kind === "assistant.delta") {
          setLive((l) => ({
            ...l,
            text: l.text + String(frame.payload.text ?? ""),
          }));
          return;
        }
        if (
          frame.kind === "assistant.thinking.delta" ||
          frame.kind === "assistant.toolcall.delta"
        )
          return;
        if (frame.kind.startsWith("tool."))
          setLive((l) => ({
            ...l,
            tool: String(frame.payload.tool_name ?? ""),
          }));
        if (frame.kind === "presence.changed") {
          const present = (frame.payload as { present?: GuestState["present"] })
            .present;
          if (present) setState((s) => (s ? { ...s, present } : s));
          return;
        }
        if (
          frame.kind === "history.entry" &&
          frame.payload.entry_kind === "assistant"
        )
          setLive({ text: "" });
        soon();
      };
      // The browser reconnects by itself with the last cursor; a refusal
      // (removed, archived) shows when the state is read again.
      source.onerror = () => soon();
    });
    return () => {
      alive.current = false;
      globalThis.clearInterval(poll);
      clearTimeout(timer);
      source?.close();
    };
  }, [share, read, reread]);

  // Being here: said while the view is open, and left when it closes.
  useEffect(() => {
    if (!csrf) return;
    void presenceGuest(share, "present", csrf);
    const timer = globalThis.setInterval(
      () => void presenceGuest(share, "present", csrf),
      30000,
    );
    return () => {
      globalThis.clearInterval(timer);
      void presenceGuest(share, "left", csrf);
    };
  }, [share, csrf]);
  const typed = useRef(0);

  // Follow the end of the conversation while the reader is there.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll after each change of what is shown.
  useEffect(() => {
    const el = feed.current;
    if (el && atEnd.current) el.scrollTop = el.scrollHeight;
  }, [entries, live, state?.held.length]);

  if (problem === "gone") return <SharedUnavailable />;
  if (!state)
    return problem === "host" ? (
      <div className="ah-mp-invite">
        <PageNotice
          title={t.hostProblem}
          tone="neutral"
          actions={[{ label: t.retry, onPress: reread }]}
        />
      </div>
    ) : (
      <p role="status" className="ah-mp-invite">
        {t.loading}
      </p>
    );

  const running = state.run.state === "running";
  // The owner's views and file offers are theirs (ADR 0038 section 6): the
  // agent's notice text shows, never an open or download action, which here
  // would act on the participant's own account.
  const latest = new Set(entries.map((e) => e.entry_key));
  const all = [
    ...older.entries.filter((e) => !latest.has(e.entry_key)),
    ...entries,
  ];
  const loadOlder = () => {
    const before = older.before;
    if (!before || older.pending) return;
    setOlder((o) => ({ ...o, pending: true }));
    void readGuestHistory(share, undefined, before)
      .then((page) => {
        if (!alive.current) return;
        setOlder((o) => {
          const known = new Set(o.entries.map((e) => e.entry_key));
          return {
            entries: [
              ...page.entries.filter((e) => !known.has(e.entry_key)),
              ...o.entries,
            ],
            before: page.older_complete ? undefined : page.next_before,
            pending: false,
          };
        });
      })
      .catch(() => {
        if (alive.current) setOlder((o) => ({ ...o, pending: false }));
      });
  };
  const shownEntries = all.map((e) =>
    e.notice && (e.notice.view || e.notice.file_offer)
      ? {
          ...e,
          notice: { ...e.notice, view: undefined, file_offer: undefined },
        }
      : e,
  );
  const liveInput: LiveTurnInput | undefined =
    running || live.text
      ? {
          working: running,
          activity: live.tool || t.stripRunning,
          steps: live.text
            ? [
                {
                  kind: "text",
                  key: "shared-live",
                  text: live.text,
                  node: (
                    <TurnText
                      block={{ type: "text", text: live.text }}
                      index={0}
                      entryKey="shared-live"
                    />
                  ),
                } satisfies TurnStep,
              ]
            : [],
        }
      : undefined;
  const items = timelineItems(
    shownEntries,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    liveInput,
    undefined,
    undefined,
    undefined,
    timesOn,
  );
  const mine = state.waiting_requests.filter(
    (w) => w.subject === state.you.subject,
  );
  const send = (text = draft) => {
    const body = text.trim();
    if (!csrf || !body || sendState === "pending") return;
    setSendState("pending");
    void sendGuest(share, body, csrf).then((outcome) => {
      if (outcome.kind === "ok") {
        // Text typed while it was on its way stays.
        setDraft((d) => (d.trim() === body ? "" : d));
        setSendState("idle");
        reread();
      } else {
        if (outcome.kind === "login") onLogin();
        setSendState("rejected");
      }
    });
  };
  const strip = (
    <div
      className="ah-mp-strip"
      data-testid="shared-strip"
      data-mode={state.you.role === "full_rights" ? "tools" : "text_only"}
      role="status"
    >
      <div className="ah-mp-strip-row">
        <span>
          {state.you.role === "full_rights" ? t.stripFull : t.stripTextOnly}
        </span>
      </div>
      {mine.length ? (
        <div className="ah-mp-strip-row" data-testid="shared-strip-waiting">
          {t.stripWaiting(mine.length)}
        </div>
      ) : null}
      {state.pending_question?.question_kind === "approval" ? (
        <div className="ah-mp-strip-row" data-testid="shared-strip-asked">
          {t.stripAsked}
        </div>
      ) : null}
      {running ? (
        <div className="ah-mp-strip-row">
          <span>{t.stripRunning}</span>
          <Button
            data-testid="shared-stop"
            size="row"
            variant="secondary"
            label={stopSent || state.run.aborting ? t.stopSent : t.stripStop}
            availability={
              !csrf || stopSent || state.run.aborting
                ? { state: "disabled", reason: t.stopSent }
                : undefined
            }
            onPress={() => {
              if (!csrf) return;
              setStopSent(true);
              void abortGuest(share, csrf).then((outcome) => {
                // A refused or lost stop leaves Stop pressable again.
                if (outcome.kind !== "ok") setStopSent(false);
                reread();
              });
            }}
          />
        </div>
      ) : null}
      {state.held.map((h) => (
        <div
          className="ah-mp-held"
          key={h.message_id}
          data-testid="shared-held"
        >
          <p>
            <strong>
              {h.state === "delivering" ? t.delivering : t.heldTitle}
            </strong>
            {": "}
            {h.text}
          </p>
          {h.state === "held" ? (
            <Button
              data-testid="shared-held-cancel"
              size="row"
              variant="quiet"
              label={t.cancelHeld}
              availability={
                !csrf ? { state: "disabled", reason: t.busy } : undefined
              }
              onPress={() => {
                if (!csrf) return;
                void cancelGuest(share, h.message_id, csrf).then((outcome) => {
                  if (outcome.kind === "ok")
                    setDraft((d) => (d.trim() ? d : h.text));
                  reread();
                });
              }}
            />
          ) : null}
        </div>
      ))}
      {sendState === "rejected" ? <p role="alert">{t.sendFailed}</p> : null}
    </div>
  );
  return (
    <SharedViewer.Provider
      value={{
        subject: state.you.subject,
        owner,
        share,
        agentId: state.agent_id,
        revision,
      }}
    >
      <section
        className="ah-conversation-frame"
        data-testid="shared-conversation"
      >
        <header className="ah-mp-shared-head">
          <h1>{state.title || t.untitled}</h1>
          <p>
            {t.ownerLine(owner)}
            {state.workspace_name
              ? ` · ${t.workspaceLine(state.workspace_name)}`
              : ""}
          </p>
          {state.members.length || state.present.length ? (
            <p className="ah-mp-stack" data-testid="shared-people">
              {state.members.map((m) => (
                <PersonAvatar
                  key={m.subject}
                  subject={m.subject}
                  name={m.display_name}
                  avatarUrl={
                    state.present.find((p) => p.subject === m.subject)
                      ?.avatar_url
                  }
                  presence={
                    state.present.some((p) => p.subject === m.subject)
                      ? "here"
                      : "away"
                  }
                />
              ))}
            </p>
          ) : null}
        </header>
        <div
          className="ah-conversation-stream"
          ref={feed}
          tabIndex={-1}
          onScroll={() => {
            const el = feed.current;
            if (el)
              atEnd.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
        >
          {older.before ? (
            <div className="ah-history-pager">
              <Button
                data-testid="older-history"
                size="row"
                label={t.loadOlder}
                pending={older.pending}
                onPress={loadOlder}
              />
            </div>
          ) : null}
          <ol className="ah-feed" data-testid="shared-feed">
            {items.map((item) => (
              <li key={item.id}>{item.content}</li>
            ))}
          </ol>
        </div>
        <Composer
          value={draft}
          onChange={(value) => {
            setDraft(value);
            if (sendState === "rejected") setSendState("idle");
            const now = Date.now();
            if (csrf && value && now - typed.current > 5000) {
              typed.current = now;
              void presenceGuest(share, "typing", csrf);
            }
          }}
          // No csrf: a participant sends text only, so the field offers no
          // attachments, pasted pictures or dictation into their own account.
          activity={running ? "working" : "idle"}
          selectedWorkingMode="follow_up"
          sendState={sendState}
          availability={
            !csrf ? { state: "disabled", reason: t.busy } : undefined
          }
          editorAvailability={{ state: "enabled" }}
          idlePlaceholder={t.placeholder}
          beforeField={strip}
          onSendNow={send}
          onSteer={send}
          onFollowUp={send}
          onModeChange={() => {}}
        />
      </section>
    </SharedViewer.Provider>
  );
}
