import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  AgentHeader,
  Button,
  Composer,
  ConversationTimeline,
  InlineNotice,
  UnknownEvent,
} from "../components";
import { Entry, readHistoryFetch } from "./HistoryView";
import type { HistoryEntry } from "./history";
import {
  create,
  list,
  send,
  status,
  stop,
  type Session,
  type Status,
} from "./conversations";
import { piStatus, sessionCSRF } from "./pi";
import type { Workspace } from "./snapshot";

// Kept only for this browser login. An ambiguous create/send is never retried.
export function BrowserConversation({
  workspace,
  id,
  identity,
}: {
  workspace: Workspace;
  id?: string;
  identity: string;
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
  }, [id, workspace.workspace_id]);
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
        setEntries((old) => {
          if (page.entries.length > old.length) {
            const scroller = feed.current;
            if (
              scroller &&
              scroller.scrollHeight -
                scroller.scrollTop -
                scroller.clientHeight >
                60
            )
              setUnseen((n) => n + page.entries.length - old.length);
          }
          // Keep previously loaded pages while the first page still shares its native keys.
          return old.length > page.entries.length &&
            page.entries.every((e, i) => old[i]?.entry_key === e.entry_key)
            ? old
            : page.entries;
        });
        setNext(page.next_after);
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
        "Lista tarkistettu. Jos luonti ei näy, sen tulos on edelleen epävarma.",
      );
    } catch {
      setProblem("Ohjauslistaa ei voitu tarkistaa.");
    }
  };
  const start = async () => {
    if (busy || !csrf || ambiguous) return;
    setBusy(true);
    setReceipt("Luodaan · tulos odottaa");
    sessionStorage.setItem(ambiguousKey, "create");
    try {
      const token = await verify();
      if (!alive.current) return;
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
          "Luonnin tulos epävarma. Älä luo uudelleen tässä istunnossa. Tarkista lista ja natiivi historia.",
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
    setReceipt("Viesti odottaa kuittausta");
    sessionStorage.setItem(ambiguousKey, command);
    try {
      const token = await verify();
      if (!alive.current) return;
      await send(current.agent_id, text, command, token);
      if (!alive.current) return;
      setReceipt("Viesti odottaa natiivia hyväksyntää");
      changeDraft("");
      await refresh();
    } catch {
      if (alive.current)
        setReceipt(
          "Lähetyksen tulos epävarma. Viestiä ei lähetetä automaattisesti uudelleen. Tarkista tila ja natiivi historia.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const stopNow = async () => {
    if (busy || !current || !csrf) return;
    setBusy(true);
    setReceipt("Pysäytystä pyydetään");
    try {
      const token = await verify();
      if (!alive.current) return;
      await stop(current.agent_id, token);
      if (alive.current)
        setReceipt(
          "Pysäytystä pyydettiin. Työkalujen päättymistä ei ole vahvistettu.",
        );
    } catch {
      if (alive.current)
        setReceipt(
          "Pysäytyksen tulos epävarma. Työkaluja voi yhä olla käynnissä.",
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
  const selected = sessions.filter(
    (s) => s.workspace_id === workspace.workspace_id,
  );
  return (
    <section>
      {!id ? (
        <>
          <h2>Pi-keskustelut</h2>
          <Button
            label="Aloita uusi Pi-keskustelu"
            availability={
              csrf && !ambiguous && !busy
                ? { state: "enabled" }
                : {
                    state: "unknown",
                    reason: "Istunto tai edellinen luonti on epävarma.",
                  }
            }
            onPress={() => void start()}
          />
          <Button
            label="Tarkista keskustelulista"
            onPress={() => void recheckList()}
          />
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
