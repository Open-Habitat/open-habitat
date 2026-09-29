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
  UnknownEvent,
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
  identity,
  place,
}: {
  workspace: Workspace;
  id?: string;
  identity: string;
  place: RefObject<ConversationPlace | undefined>;
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
  const [details, setDetails] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  const generation = useRef(0);
  const feed = useRef<HTMLElement>(null);
  const section = useRef<HTMLElement>(null);
  const restored = useRef(false);
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
    alive.current = true;
    const controller = new AbortController();
    setCSRF(undefined);
    setCurrent(undefined);
    setEntries([]);
    setEvents([]);
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
  }, [id, workspace.workspace_id, identity, place]);
  useEffect(() => {
    setDraft(draftKey ? (sessionStorage.getItem(draftKey) ?? "") : "");
  }, [draftKey]);
  const changeDraft = (value: string) => {
    setDraft(value);
    if (draftKey) sessionStorage.setItem(draftKey, value);
  };
  const refresh = useCallback(async () => {
    if (
      !id ||
      !csrf ||
      pending.current ||
      document.visibilityState !== "visible" ||
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
      setCurrent(nextStatus);
      if (nextStatus.command_id && nextStatus.ack === "rejected")
        setReceipt(
          "Viesti hylättiin. Luonnosta ei lähetetä automaattisesti uudelleen.",
        );
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
        nextStatus.ack === "accepted" &&
        nextStatus.state === "idle" &&
        nextStatus.native_history === "readable"
      ) {
        sessionStorage.removeItem(`nah:ambiguous:${identity}:${csrf}:${id}`);
        setReceipt("Viesti hyväksyttiin ja natiivi historia on luettavissa.");
      }
      setEvents(nextStatus.events); // bounded tail, never concatenate snapshots
      setProblem("");
      if (nextStatus.native_history === "readable") {
        const page = await readHistoryFetch(id);
        if (!alive.current || version !== generation.current) return;
        const old = latest.current.entries;
        if (page.entries.length > old.length) {
          const scroller = feed.current;
          if (
            scroller &&
            scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight >
              60
          )
            setUnseen((n) => n + page.entries.length - old.length);
        }
        // Keep loaded pages and their cursor when the refreshed first page
        // still shares its native keys. A new event tail must not reset pagination.
        if (
          !(
            old.length > page.entries.length &&
            page.entries.every((e, i) => old[i]?.entry_key === e.entry_key)
          )
        ) {
          setEntries(page.entries);
          setNext(page.next_after);
        }
        setHistoryError(false);
      } else {
        setHistoryError(nextStatus.native_history === "unavailable");
        setEntries([]);
        setNext(undefined);
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
  }, [id, csrf, sessions, workspace.workspace_id, identity]);
  useEffect(() => {
    if (!id || !csrf) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [id, csrf, refresh]);
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
    if (busy || !csrf || ambiguous) return;
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
      busy ||
      !current ||
      current.state !== "idle" ||
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
      sessionStorage.setItem(ambiguousKey, command);
      setReceipt("Viesti odottaa kuittausta");
      await send(current.agent_id, text, command, token);
      if (!alive.current) return;
      setReceipt("Viesti odottaa natiivia hyväksyntää");
      changeDraft("");
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
    if (busy || !current || !csrf) return;
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
      if (alive.current) setBusy(false);
    }
  };
  const controlled =
    !!current &&
    !problem &&
    sessions.some(
      (s) => s.agent_id === id && s.workspace_id === workspace.workspace_id,
    );
  const canSend = controlled && !busy && !ambiguous && current.state === "idle";
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
  const selected = sessions.filter(
    (s) => s.workspace_id === workspace.workspace_id,
  );
  return (
    <section ref={section}>
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
                !csrf
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
                · {s.state}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <AgentHeader
            title="Pi-keskustelu"
            activityLabel={current?.state ?? "Tila ei tiedossa"}
            controlLabel={
              controlled ? "Selainohjaus" : "Ohjaus ei ole käytettävissä"
            }
            workspaceLabel={workspace.display_name ?? workspace.name}
            workspaceHref={`/workspaces/${workspace.workspace_id}`}
            detailsExpanded={details}
            onToggleDetails={() => setDetails(!details)}
          />
          {details ? <p>Natiivi tunniste: {id}</p> : null}
          <section ref={feed} style={{ maxHeight: "60vh", overflow: "auto" }}>
            <ConversationTimeline
              state={
                historyError ? "error" : entries.length ? "ready" : "empty"
              }
              items={entries.map((e) => ({
                id: e.entry_key,
                content: <Entry key={e.entry_key} entry={e} />,
              }))}
              historyMode="pagedAccessible"
              newContentCount={unseen}
              onJumpToLatest={() => {
                feed.current?.scrollTo({ top: feed.current.scrollHeight });
                setUnseen(0);
              }}
            />
          </section>
          {next ? (
            <Button
              label="Lataa seuraava historiasivu"
              onPress={() =>
                void readHistoryFetch(id, next)
                  .then((p) => {
                    setEntries((old) => [
                      ...old,
                      ...p.entries.filter(
                        (e) => !old.some((o) => o.entry_key === e.entry_key),
                      ),
                    ]);
                    setNext(p.next_after);
                  })
                  .catch(() => setHistoryError(true))
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
          {events.length ? (
            <details>
              <summary>Viimeisimmät live-tapahtumat ({events.length})</summary>
              {events.map((e, index) => (
                <UnknownEvent
                  key={
                    current
                      ? current.event_cursor - events.length + index + 1
                      : JSON.stringify(e)
                  }
                  kindLabel="Pi-tapahtuma"
                  safeSummary="Raaka tapahtuma (rajattu)"
                  safePayloadText={JSON.stringify(e)}
                  onCopy={() =>
                    void navigator.clipboard?.writeText(JSON.stringify(e))
                  }
                />
              ))}
            </details>
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
          {controlled ? (
            <Button
              label="Pyydä pysäytystä"
              variant="secondary"
              availability={
                busy
                  ? { state: "unknown", reason: "Pyyntö kesken" }
                  : { state: "enabled" }
              }
              onPress={() => void stopNow()}
            />
          ) : null}
          <Button
            label="Tarkista tila ja historia"
            onPress={() => void refresh()}
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
