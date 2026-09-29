import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import {
  AgentHeader,
  Button,
  Composer,
  ConversationTimeline,
  InlineNotice,
  WorkingProgress,
} from "../components";
import {
  create,
  list,
  type Session,
  type Status,
  send,
  status,
  stop,
} from "./conversations";
import { Entry, readHistoryFetch } from "./HistoryView";
import type { HistoryEntry } from "./history";
import { piStatus, sessionCSRF } from "./pi";
import type { Workspace } from "./snapshot";

// Only ephemeral presentation state, never authority to control a session.
export type ConversationPlace = {
  identity: string;
  csrf: string;
  workspaceId: string;
  id: string;
  entries: HistoryEntry[];
  next?: string;
  unseen: number;
  scrollTop: number;
  focus?: {
    start: number;
    end: number;
    direction: "forward" | "backward" | "none";
  };
};

// Kept only for this browser login. An ambiguous create/send is never retried.
export function BrowserConversation({
  workspace,
  id,
  title,
  identity,
  place,
  onSessionCreated,
  stale = false,
  onRefreshStale,
}: {
  stale?: boolean;
  onRefreshStale?: () => void;
  workspace: Workspace;
  id?: string;
  title?: string;
  identity: string;
  place: RefObject<ConversationPlace | undefined>;
  onSessionCreated: (session: Session) => void;
}) {
  const navigate = useNavigate();
  const [csrf, setCSRF] = useState<string>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [current, setCurrent] = useState<Status>();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [next, setNext] = useState<string>();
  const [draft, setDraft] = useState("");
  const [receipt, setReceipt] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [events, setEvents] = useState<unknown[]>([]);
  const [startedAt, setStartedAt] = useState<number>();
  const [elapsed, setElapsed] = useState(0);
  const [confirmStop, setConfirmStop] = useState(false);
  const [finishedInBackground, setFinishedInBackground] = useState(false);
  const wasWorking = useRef(false);
  const wasAtBottom = useRef(true);
  const [details, setDetails] = useState(false);
  const pending = useRef(false);
  const staleRef = useRef(stale);
  staleRef.current = stale;
  const submittedKey =
    csrf && id ? `nah:submitted:${identity}:${csrf}:${id}` : "";
  const alive = useRef(true);
  const generation = useRef(0);
  const feed = useRef<HTMLElement>(null);
  const section = useRef<HTMLElement>(null);
  const restored = useRef(false);
  const focusedOnOpen = useRef(false);
  const latest = useRef({ entries, next, unseen, csrf });
  latest.current = { entries, next, unseen, csrf };
  // Capture before React removes the DOM, including the actual textarea selection.
  useLayoutEffect(() => {
    return () => {
      const {
        csrf: token,
        entries: pages,
        next: cursor,
        unseen: count,
      } = latest.current;
      if (!id || !token) return;
      const editor = section.current?.querySelector("textarea");
      const focused = editor && document.activeElement === editor;
      place.current = {
        identity,
        csrf: token,
        workspaceId: workspace.workspace_id,
        id,
        entries: pages,
        next: cursor,
        unseen: count,
        scrollTop: feed.current?.scrollTop ?? 0,
        focus: focused
          ? {
              start: editor.selectionStart,
              end: editor.selectionEnd,
              direction: editor.selectionDirection as
                | "forward"
                | "backward"
                | "none",
            }
          : undefined,
      };
    };
  }, [id, identity, workspace.workspace_id, place]);
  const draftKey = csrf && id ? `nah:draft:${identity}:${csrf}:${id}` : "";
  const ambiguousKey = csrf
    ? `nah:ambiguous:${identity}:${csrf}:${id ?? workspace.workspace_id}`
    : "";
  const ambiguous = ambiguousKey ? sessionStorage.getItem(ambiguousKey) : null;
  useEffect(() => {
    if (stale) return;
    alive.current = true;
    const controller = new AbortController();
    setCSRF(undefined);
    setCurrent(undefined);
    setEntries([]);
    setEvents([]);
    setStartedAt(undefined);
    setElapsed(0);
    setConfirmStop(false);
    setFinishedInBackground(false);
    wasWorking.current = false;
    wasAtBottom.current = true;
    setSessions([]);
    setProblem("");
    setReceipt("");
    setUnseen(0);
    void (async () => {
      try {
        const token = await sessionCSRF(controller.signal);
        if (token === "login") throw new Error("identity_lost");
        const found = await list(controller.signal);
        if (controller.signal.aborted) return;
        const saved = place.current;
        if (
          saved &&
          saved.identity === identity &&
          saved.csrf === token &&
          saved.workspaceId === workspace.workspace_id &&
          saved.id === id &&
          found.some(
            (s) =>
              s.agent_id === id && s.workspace_id === workspace.workspace_id,
          )
        ) {
          setEntries(saved.entries);
          setNext(saved.next);
          setUnseen(saved.unseen);
          restored.current = true;
        } else place.current = undefined;
        setCSRF(token);
        setSessions(found);
        if (
          id &&
          !found.some(
            (s) =>
              s.agent_id === id && s.workspace_id === workspace.workspace_id,
          )
        )
          setProblem(
            "Ohjausoikeutta ei löytynyt tästä selainistunnosta. Vanha historia on vain luettavissa.",
          );
      } catch {
        if (!controller.signal.aborted)
          setProblem(
            "Istuntoa tai ohjauslistaa ei voitu vahvistaa. Ohjaus on estetty.",
          );
      }
    })();
    return () => {
      alive.current = false;
      ++generation.current;
      controller.abort();
    };
  }, [id, workspace.workspace_id, identity, place, stale]);
  useEffect(() => {
    setDraft(draftKey ? (sessionStorage.getItem(draftKey) ?? "") : "");
  }, [draftKey]);
  const changeDraft = (value: string) => {
    setDraft(value);
    if (draftKey) sessionStorage.setItem(draftKey, value);
  };
  const refresh = useCallback(async () => {
    if (
      stale ||
      !id ||
      !csrf ||
      pending.current ||
      !sessions.some(
        (s) => s.agent_id === id && s.workspace_id === workspace.workspace_id,
      )
    )
      return;
    pending.current = true;
    const version = generation.current;
    try {
      const token = await sessionCSRF();
      if (token !== csrf || (await piStatus()) !== "usable")
        throw new Error("identity_lost");
      const nextStatus = await status(id);
      if (!alive.current || version !== generation.current) return;
      if (nextStatus.workspace_id !== workspace.workspace_id)
        throw new Error("invalid workspace");
      const working = ["pending", "accepted", "stopping"].includes(
        nextStatus.state,
      );
      if (working && !wasWorking.current) setStartedAt(Date.now());
      if (
        !working &&
        wasWorking.current &&
        document.visibilityState === "hidden"
      )
        setFinishedInBackground(true);
      wasWorking.current = working;
      setCurrent(nextStatus);
      if (nextStatus.command_id && nextStatus.ack === "rejected") {
        const unresolvedKey = `nah:ambiguous:${identity}:${csrf}:${id}`;
        if (sessionStorage.getItem(unresolvedKey) === nextStatus.command_id) {
          const rejectedText = sessionStorage.getItem(submittedKey);
          if (rejectedText !== null) {
            // Do not overwrite edits made while the acknowledgement was pending.
            if (
              !sessionStorage.getItem(`nah:draft:${identity}:${csrf}:${id}`)
            ) {
              setDraft(rejectedText);
              sessionStorage.setItem(
                `nah:draft:${identity}:${csrf}:${id}`,
                rejectedText,
              );
            }
          }
          sessionStorage.removeItem(submittedKey);
          sessionStorage.removeItem(unresolvedKey);
        }
        setReceipt(
          "Viesti hylättiin. Teksti säilytettiin; voit lähettää sen uudelleen tarkoituksella.",
        );
      }
      if (nextStatus.command_id && nextStatus.ack === "uncertain")
        setReceipt(
          "Viestin hyväksyntä jäi epävarmaksi. Tarkista natiivi historia, älä lähetä automaattisesti uudelleen.",
        );
      const unresolved = sessionStorage.getItem(
        `nah:ambiguous:${identity}:${csrf}:${id}`,
      );
      if (
        unresolved &&
        unresolved === nextStatus.command_id &&
        nextStatus.ack === "accepted"
      ) {
        const sentText = sessionStorage.getItem(submittedKey);
        const key = `nah:draft:${identity}:${csrf}:${id}`;
        if (sentText !== null && sessionStorage.getItem(key) === sentText) {
          setDraft("");
          sessionStorage.setItem(key, "");
        }
        sessionStorage.removeItem(submittedKey);
        sessionStorage.removeItem(`nah:ambiguous:${identity}:${csrf}:${id}`);
        setReceipt("Viesti hyväksyttiin.");
      }
      setEvents(nextStatus.events); // bounded tail, never concatenate snapshots
      setProblem("");
      if (nextStatus.native_history === "readable") {
        try {
          const page = await readHistoryFetch(id);
          if (!alive.current || version !== generation.current) return;
          const old = latest.current.entries;
          // The native history is oldest-first. The first page is NOT a live
          // tail: after 25 entries a fresh reply is only reachable via `after`.
          // Walk forward from the last known key, keeping the reading position.
          // Bound each poll so very large histories cannot monopolize the tab.
          const prefixMatches =
            old.length > 0 &&
            page.entries.every((e, i) => old[i]?.entry_key === e.entry_key);
          let merged = prefixMatches ? [...old] : [...page.entries];
          let cursor = prefixMatches
            ? (old.at(-1)?.entry_key ?? page.next_after)
            : page.next_after;
          if (
            prefixMatches &&
            !page.next_after &&
            old.length === page.entries.length
          )
            cursor = undefined;
          for (let n = 0; cursor && n < 16; n++) {
            const additional = await readHistoryFetch(id, cursor);
            if (!alive.current || version !== generation.current) return;
            // Native history can change while walking: retry at the next poll
            // rather than claiming a discontinuous feed is up to date.
            if (!additional.entries.length && additional.complete) {
              cursor = undefined;
              break;
            }
            if (
              !additional.entries.length ||
              additional.entries.some((e) =>
                merged.some((m) => m.entry_key === e.entry_key),
              )
            ) {
              setHistoryError(true);
              return;
            }
            merged = [...merged, ...additional.entries];
            cursor = additional.next_after;
          }
          if (merged.length > old.length && !wasAtBottom.current)
            setUnseen((n) => n + merged.length - old.length);
          if (
            merged.length !== old.length ||
            merged.some(
              (e, i) =>
                e.entry_key !== old[i]?.entry_key ||
                e.content.text !== old[i]?.content.text ||
                e.content.complete !== old[i]?.content.complete,
            )
          )
            setEntries(merged);
          setNext(cursor);
          setHistoryError(false);
        } catch {
          if (alive.current && version === generation.current)
            setHistoryError(true);
        }
      } else {
        // A temporary native read failure must not erase already-read messages.
        setHistoryError(nextStatus.native_history === "unavailable");
      }
    } catch {
      if (alive.current && version === generation.current) {
        setProblem(
          "Yhteys katkesi tai istunto muuttui. Ohjaus on estetty kunnes tila varmistuu.",
        );
        setCurrent(undefined);
      }
    } finally {
      pending.current = false;
    }
  }, [
    id,
    csrf,
    sessions,
    workspace.workspace_id,
    identity,
    submittedKey,
    stale,
  ]);
  useEffect(() => {
    if (!id || !csrf || stale) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    const focus = () => {
      if (document.visibilityState === "visible")
        setFinishedInBackground(false);
      void refresh();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [id, csrf, refresh, stale]);
  useEffect(() => {
    if (
      !startedAt ||
      !["pending", "accepted", "stopping"].includes(current?.state ?? "")
    )
      return;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, current?.state]);
  useLayoutEffect(() => {
    if (wasAtBottom.current && feed.current) {
      feed.current.scrollTop = feed.current.scrollHeight;
      setUnseen(0);
    }
  });
  useEffect(() => {
    if (!finishedInBackground) return;
    const old = document.title;
    document.title = `Pi tarvitsee huomiota · ${old}`;
    return () => {
      document.title = old;
    };
  }, [finishedInBackground]);
  const verify = async () => {
    const token = await sessionCSRF();
    if (!csrf || token !== csrf || (await piStatus()) !== "usable")
      throw new Error("identity_lost");
    return token;
  };
  const recheckList = async () => {
    try {
      if (!csrf || (await sessionCSRF()) !== csrf)
        throw new Error("identity_lost");
      setSessions(await list());
      setProblem("");
      setReceipt(
        ambiguous
          ? "Lista tarkistettu. Jos luonti ei näy, sen tulos on edelleen epävarma."
          : "Keskustelulista tarkistettu.",
      );
    } catch {
      setProblem("Ohjauslistaa ei voitu tarkistaa.");
    }
  };
  const start = async () => {
    if (stale || busy || !csrf || ambiguous) return;
    setBusy(true);
    setReceipt("Varmistetaan istuntoa.");
    try {
      const token = await verify();
      if (!alive.current) return;
      sessionStorage.setItem(ambiguousKey, "create");
      setReceipt("Luodaan · tulos odottaa");
      const result = await create(workspace.workspace_id, token);
      sessionStorage.removeItem(ambiguousKey);
      if (!alive.current) return;
      setSessions((old) => [...old, result]);
      onSessionCreated(result);
      navigate(
        `/workspaces/${workspace.workspace_id}?conversation=${result.agent_id}`,
      );
    } catch {
      if (alive.current) {
        setReceipt(
          sessionStorage.getItem(ambiguousKey)
            ? "Luonnin tulos epävarma. Älä luo uudelleen tässä istunnossa. Tarkista lista ja natiivi historia."
            : "Istuntoa ei voitu vahvistaa. Luontia ei lähetetty.",
        );
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const submit = async () => {
    if (
      stale ||
      busy ||
      !current ||
      (current.state !== "idle" && current.state !== "rejected") ||
      !draft.trim() ||
      ambiguous ||
      !csrf
    )
      return;
    const text = draft;
    const command = crypto.randomUUID();
    setBusy(true);
    setReceipt("Varmistetaan istuntoa.");
    try {
      const token = await verify();
      if (!alive.current) return;
      sessionStorage.setItem(submittedKey, text);
      sessionStorage.setItem(ambiguousKey, command);
      setReceipt("Viesti odottaa kuittausta");
      await send(current.agent_id, text, command, token);
      if (!alive.current) return;
      setReceipt("Viesti odottaa natiivia hyväksyntää");
      await refresh();
    } catch {
      if (alive.current)
        setReceipt(
          sessionStorage.getItem(ambiguousKey)
            ? "Lähetyksen tulos epävarma. Viestiä ei lähetetä automaattisesti uudelleen. Tarkista tila ja natiivi historia."
            : "Istuntoa ei voitu vahvistaa. Viestiä ei lähetetty.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const stopNow = async () => {
    if (stale || busy || !current || !csrf) return;
    setBusy(true);
    setReceipt("Varmistetaan istuntoa.");
    let sent = false;
    try {
      const token = await verify();
      if (!alive.current) return;
      sent = true;
      setReceipt("Pysäytystä pyydetään");
      await stop(current.agent_id, token);
      if (alive.current)
        setReceipt(
          "Pysäytystä pyydettiin. Työkalujen päättymistä ei ole vahvistettu.",
        );
    } catch {
      if (alive.current)
        setReceipt(
          sent
            ? "Pysäytyksen tulos epävarma. Työkaluja voi yhä olla käynnissä."
            : "Istuntoa ei voitu vahvistaa. Pysäytystä ei pyydetty.",
        );
    } finally {
      if (alive.current) {
        setBusy(false);
        setConfirmStop(false);
        void refresh();
      }
    }
  };
  const controlled =
    !!current &&
    !problem &&
    sessions.some(
      (s) => s.agent_id === id && s.workspace_id === workspace.workspace_id,
    );
  const canSend =
    controlled &&
    !stale &&
    !busy &&
    !ambiguous &&
    (current.state === "idle" || current.state === "rejected");
  useLayoutEffect(() => {
    if (!restored.current) return;
    const saved = place.current;
    if (
      !saved ||
      saved.id !== id ||
      saved.identity !== identity ||
      saved.csrf !== csrf
    )
      return;
    if (feed.current) feed.current.scrollTop = saved.scrollTop;
    if (saved.focus && !controlled) return;
    restored.current = false;
    if (saved.focus) {
      const editor = section.current?.querySelector("textarea");
      if (editor && !editor.disabled) {
        editor.focus({ preventScroll: true });
        editor.setSelectionRange(
          saved.focus.start,
          saved.focus.end,
          saved.focus.direction,
        );
      }
    }
    place.current = undefined;
  }, [csrf, id, identity, controlled, place]);
  useEffect(() => {
    if (!id || !controlled || focusedOnOpen.current) return;
    focusedOnOpen.current = true;
    if (document.activeElement === document.body)
      section.current
        ?.querySelector("textarea")
        ?.focus({ preventScroll: true });
  }, [id, controlled]);
  const selected = sessions.filter(
    (s) => s.workspace_id === workspace.workspace_id,
  );
  return (
    <section ref={section} className="ah-reading-view">
      {!id ? (
        <>
          <h2>Pi-keskustelut</h2>
          <fieldset className="ah-actions ah-conversation-actions">
            <legend className="ah-visually-hidden">
              Pi-keskustelun toiminnot
            </legend>
            <Button
              label="Aloita uusi Pi-keskustelu"
              availability={
                stale
                  ? { state: "unknown", reason: "Yhteys on katkennut." }
                  : !csrf
                    ? {
                        state: "unknown",
                        reason: problem
                          ? "Istuntoa ei voitu vahvistaa."
                          : "Varmistetaan istuntoa.",
                      }
                    : ambiguous
                      ? {
                          state: "unknown",
                          reason: "Edellisen luonnin tulos on epävarma.",
                        }
                      : busy
                        ? { state: "unknown", reason: "Luonti on käynnissä." }
                        : { state: "enabled" }
              }
              onPress={() => void start()}
            />
            <Button
              label="Tarkista keskustelulista"
              variant={ambiguous ? "secondary" : "quiet"}
              availability={
                stale
                  ? { state: "unknown", reason: "Yhteys on katkennut." }
                  : { state: "enabled" }
              }
              onPress={() => void recheckList()}
            />
          </fieldset>
          <ul>
            {selected.map((s) => (
              <li key={s.agent_id}>
                <a
                  href={`/workspaces/${workspace.workspace_id}?conversation=${s.agent_id}`}
                >
                  {s.agent_id}
                </a>{" "}
                ·{" "}
                {(
                  {
                    idle: "Valmis",
                    pending: "Odottaa kuittausta",
                    accepted: "Pi työskentelee",
                    rejected: "Viesti hylättiin",
                    uncertain: "Tila epävarma",
                    stopping: "Pysäytetään",
                  } as Record<string, string>
                )[s.state] ?? "Tila ei tiedossa"}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <AgentHeader
            title={title ?? "Uusi keskustelu"}
            activityLabel={
              stale
                ? "Tila ei tiedossa"
                : current
                  ? ({
                      idle: "Valmis",
                      pending: "Odottaa kuittausta",
                      accepted: "Pi työskentelee",
                      rejected: "Viesti hylättiin",
                      uncertain: "Tila epävarma",
                      stopping: "Pysäytetään",
                    }[current.state] ?? "Tila ei tiedossa")
                  : "Tila ei tiedossa"
            }
            controlLabel={
              controlled ? "Selainohjaus" : "Ohjaus ei ole käytettävissä"
            }
            workspaceLabel={workspace.display_name ?? workspace.name}
            workspaceHref={`/workspaces/${workspace.workspace_id}`}
            detailsExpanded={details}
            onToggleDetails={() => setDetails(!details)}
          />
          {details ? <p>Natiivi tunniste: {id}</p> : null}
          <WorkingProgress
            state={stale ? undefined : current?.state}
            events={events}
            elapsed={elapsed}
          />
          {controlled &&
          !stale &&
          ["pending", "accepted", "stopping"].includes(current?.state ?? "") ? (
            <Button
              label="Keskeytä Pi:n vuoro"
              variant="secondary"
              availability={
                busy
                  ? { state: "unknown", reason: "Pyyntö kesken" }
                  : { state: "enabled" }
              }
              onPress={() => setConfirmStop(true)}
            />
          ) : null}
          {confirmStop &&
          !stale &&
          ["pending", "accepted", "stopping"].includes(current?.state ?? "") ? (
            <fieldset aria-label="Vahvista keskeytys">
              <p>
                Keskeytetäänkö Pi:n vuoro? Jo käynnistyneiden työkalujen
                päättymistä ei voida vahvistaa.
              </p>
              <Button
                label="Kyllä, keskeytä vuoro"
                onPress={() => void stopNow()}
                availability={
                  busy
                    ? { state: "unknown", reason: "Pyyntö kesken" }
                    : { state: "enabled" }
                }
              />
              <Button
                label="Jatka työskentelyä"
                variant="quiet"
                onPress={() => setConfirmStop(false)}
              />
            </fieldset>
          ) : null}
          <section
            ref={feed}
            onScroll={() => {
              const el = feed.current;
              if (!el) return;
              wasAtBottom.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 60;
              if (wasAtBottom.current) setUnseen(0);
            }}
            style={{
              maxHeight: "60vh",
              overflow: "auto",
              overflowAnchor: "none",
            }}
          >
            <ConversationTimeline
              state={
                historyError
                  ? entries.length
                    ? "stale"
                    : "error"
                  : entries.length
                    ? "ready"
                    : "empty"
              }
              items={entries.map((e) => ({
                id: e.entry_key,
                kind: e.kind,
                content: <Entry key={e.entry_key} entry={e} stale={stale} />,
              }))}
              historyMode="pagedAccessible"
              newContentCount={unseen}
              onJumpToLatest={() => {
                wasAtBottom.current = true;
                feed.current?.scrollTo({ top: feed.current.scrollHeight });
                setUnseen(0);
              }}
            />
          </section>
          {next && !stale ? (
            <Button
              label="Lataa seuraava historiasivu"
              onPress={() =>
                void readHistoryFetch(id, next)
                  .then((p) => {
                    if (staleRef.current) return;
                    setEntries((old) => [
                      ...old,
                      ...p.entries.filter(
                        (e) => !old.some((o) => o.entry_key === e.entry_key),
                      ),
                    ]);
                    setNext(p.next_after);
                  })
                  .catch(() => {
                    if (!staleRef.current) setHistoryError(true);
                  })
              }
            />
          ) : null}
          {current?.event_loss ? (
            <InlineNotice
              title="Tapahtumia jäi väliin"
              description="Live-tapahtumien häntä ei ole täydellinen. Tarkista natiivi historia."
              tone="warning"
            />
          ) : null}
          {events.length && current?.native_history !== "readable" ? (
            <p role="status">
              Pi:n tapahtumia vastaanotettu; historiaa odotetaan.
            </p>
          ) : null}
          {controlled ? (
            <Composer
              value={draft}
              onChange={changeDraft}
              activity="idle"
              selectedWorkingMode="follow_up"
              sendState={busy ? "pending" : ambiguous ? "uncertain" : "idle"}
              availability={
                canSend
                  ? { state: "enabled" }
                  : {
                      state: "unknown",
                      reason:
                        "Odota vahvistettua joutotilaa; epävarmaa viestiä ei lähetetä uudelleen.",
                    }
              }
              onSendNow={() => void submit()}
              onSteer={() => {}}
              onFollowUp={() => {}}
              onModeChange={() => {}}
            />
          ) : null}
          <Button
            label="Tarkista keskustelun tila"
            variant={
              stale ||
              ambiguous ||
              current?.state === "uncertain" ||
              historyError
                ? "primary"
                : "quiet"
            }
            onPress={() => (stale ? onRefreshStale?.() : void refresh())}
          />
        </>
      )}
      {receipt ? <InlineNotice title={receipt} tone="warning" /> : null}
      {problem ? <InlineNotice title={problem} tone="danger" /> : null}
      {ambiguous ? (
        <InlineNotice
          title="Aiemman pyynnön tulos epävarma"
          description="Tarkista lista, tila ja natiivi historia. Automaattista uudelleenlähetystä ei tehdä; aloita tarvittaessa uusi selainistunto vasta selvitettyäsi tilanteen."
          tone="warning"
        />
      ) : null}
    </section>
  );
}
