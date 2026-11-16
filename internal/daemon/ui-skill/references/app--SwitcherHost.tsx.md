# app/SwitcherHost.tsx

Generated from web/src/app/SwitcherHost.tsx; do not edit.

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import type { MarkState } from "../components/HabitatMark";
import { Switcher, type SwitcherItem } from "../components/Switcher";
import { useText } from "../i18n";
import { switcherText } from "../text/switcher";
import { agentTitle } from "./agentTitle";
import type { RailNow } from "./railNow";
import { type SearchReply, searchConversations } from "./search";
import { clearSearchJump, searchJumpNow, setSearchJump } from "./searchJump";
import { browserOwned, type Snapshot } from "./snapshot";
import {
  daysAgo,
  rankGroups,
  recentConversations,
  type SwitcherConversation,
  type SwitcherRow,
  stemsOf,
  switcherRows,
} from "./switcherModel";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

/** ⌘K on a Mac and Ctrl+K elsewhere, matched by key position so it works on
 * a Finnish keyboard. Mac's Ctrl+K stays the text fields' kill-line. */
export function switcherKeyEvent(e: KeyboardEvent, mac = isMac): boolean {
  return (
    e.code === "KeyK" &&
    !e.altKey &&
    !e.shiftKey &&
    (mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey)
  );
}

const editable = (el: Element | null) =>
  !!el &&
  (el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el as HTMLElement).isContentEditable);

// The door in the rail opens the switcher through this, without a prop chain.
const doors = new EventTarget();
export function openSwitcher() {
  doors.dispatchEvent(new Event("open"));
}

/** This tab's openings, newest first: the switcher's recent list, and the
 * previous conversation that ⌘K Enter returns to. Kept in memory only. */
let opened: string[] = [];
/** The query that last led to a hit, offered as "Continue search". */
let lastQuery = "";

/** Whose openings and query these are: a new person in the same tab starts
 * with neither (the app resets per-person state on a new identity). */
let owner: string | undefined;

function resetFor(identity: string | undefined) {
  owner = identity;
  opened = [];
  lastQuery = "";
  clearSearchJump();
}

export function resetSwitcherForTests() {
  resetFor(undefined);
}

const debounce = 120;
const buildingPoll = 1500;

/** The ⌘K / Ctrl+K switcher (prototype round 3, 1 Keskustelut): search
 * across the person's conversations, names from the snapshot at once and
 * message hits from their daemon's index. */
export function SwitcherHost({
  snapshot,
  daemonSessions,
  now,
  current,
  onLogin,
}: {
  snapshot?: Snapshot;
  daemonSessions: { agent_id: string; workspace_id: string }[];
  now: RailNow;
  /** The open conversation's agent id. */
  current?: string;
  onLogin: () => void;
}) {
  const t = useText(switcherText);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [reply, setReply] = useState<{ q: string; value: SearchReply }>();
  const [failed, setFailed] = useState(false);
  const [poll, setPoll] = useState(0);
  const returnTo = useRef<HTMLElement | null>(null);

  // Remember openings in this tab; the one before the current is previous.
  const identity = snapshot?.identity.web_identity_id;
  useEffect(() => {
    if (identity && identity !== owner) {
      resetFor(identity);
      setOpen(false);
    }
  }, [identity]);
  // A jump belongs to the conversation it opened: leaving it ends the band.
  useEffect(() => {
    if (!current) return;
    const jump = searchJumpNow();
    if (jump && jump.agentId !== current) clearSearchJump();
    opened = [current, ...opened.filter((id) => id !== current)].slice(0, 20);
  }, [current]);

  const conversations = useMemo<SwitcherConversation[]>(() => {
    if (!snapshot) return [];
    const workspaces = new Map(
      snapshot.workspaces
        .filter((w) => w.presence === "present")
        .map((w) => [w.workspace_id, w]),
    );
    return snapshot.agents.flatMap((a) => {
      const w = workspaces.get(a.workspace_id);
      if (!w) return [];
      const changed = a.changed_at ? Date.parse(a.changed_at) : Number.NaN;
      return [
        {
          agentId: a.agent_id,
          href: browserOwned(a, daemonSessions)
            ? `/workspaces/${w.workspace_id}?conversation=${a.agent_id}`
            : `/agents/${a.agent_id}`,
          title: agentTitle(a.title),
          workspaceName: w.display_name ?? w.name,
          archived: a.archive === "archived",
          changedAt: Number.isFinite(changed) ? changed : undefined,
        },
      ];
    });
  }, [snapshot, daemonSessions]);

  const marks = useMemo(() => {
    const m = new Map<string, MarkState>();
    for (const r of now.running) m.set(r.agentId, "working");
    for (const r of now.yours) m.set(r.agentId, "waiting");
    return m;
  }, [now]);

  const show = (q = "") => {
    returnTo.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setQuery(q);
    setSelected(0);
    setExpanded(new Set());
    setOpen(true);
  };
  // Focus goes back where it was, or after a choice to the opened
  // conversation's field (once the dialog has let go of it).
  const close = (to: "back" | "field" = "back") => {
    setOpen(false);
    const back = returnTo.current;
    requestAnimationFrame(() => {
      const field = document.querySelector<HTMLElement>(
        ".ah-composer textarea:not(:disabled)",
      );
      const target =
        to === "back" && back?.isConnected && back !== document.body
          ? back
          : field;
      target?.focus({ preventScroll: true });
    });
  };

  const state = useRef({ open });
  state.current = { open };
  // biome-ignore lint/correctness/useExhaustiveDependencies: show/close read refs; bound once.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const target = e.target instanceof Element ? e.target : null;
      // The terminal keeps Ctrl+K (readline's kill-line).
      if (target?.closest(".ah-terminal-surface")) return;
      const key = switcherKeyEvent(e);
      const slash =
        e.key === "/" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !editable(document.activeElement) &&
        // A page with its own search (Settings) keeps "/" for it; ⌘K and
        // Ctrl+K still open the switcher there.
        !document.querySelector("[data-owns-slash]");
      if (!key && !slash) return;
      if (state.current.open) {
        if (!key) return;
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      // Another window owns the keys while it is open.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]'))
        return;
      e.preventDefault();
      e.stopPropagation();
      show();
    };
    const onDoor = () => {
      show();
      // The phone's rail is a drawer over the page; the sheet covers it.
    };
    window.addEventListener("keydown", onKey, true);
    doors.addEventListener("open", onDoor);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      doors.removeEventListener("open", onDoor);
    };
  }, []);

  const q = query.trim();
  // Message search: debounced, the previous request cancelled, and asked
  // again while the index still builds.
  useEffect(() => {
    void poll;
    if (!open || !stemsOf(q).length) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchConversations(q, controller.signal)
        .then((value) => {
          if (controller.signal.aborted) return;
          setReply({ q, value });
          setFailed(false);
        })
        .catch((error: Error) => {
          if (controller.signal.aborted) return;
          if (error.message === "identity_lost") onLogin();
          else setFailed(true);
        });
    }, debounce);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, q, poll, onLogin]);
  const building = reply?.q === q && reply.value.index.state === "building";
  // biome-ignore lint/correctness/useExhaustiveDependencies: each reply while building schedules the next ask.
  useEffect(() => {
    if (!open || !building) return;
    const timer = setTimeout(() => setPoll((n) => n + 1), buildingPoll);
    return () => clearTimeout(timer);
  }, [open, building, reply]);

  const current_reply = reply?.q === q ? reply.value : undefined;
  const groups = useMemo(
    () => rankGroups(conversations, q, current_reply),
    [conversations, q, current_reply],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: openings change with the route; the list reads them when it opens.
  const recent = useMemo(
    () => recentConversations(conversations, opened),
    [conversations, open],
  );
  const previous = opened.find((id) => id !== current);
  const rows: SwitcherRow[] = switcherRows({
    q,
    groups,
    recent,
    previous,
    current,
    lastQuery,
    expanded,
  });
  const terms = current_reply?.terms ?? stemsOf(q);
  const titleTerms = stemsOf(q);
  const nowMs = Date.now();
  const items: SwitcherItem[] = rows.map((r) => {
    if (r.kind === "continue")
      return { kind: "continue", key: r.key, label: t.continueSearch(r.query) };
    if (r.kind === "hit")
      return {
        kind: "hit",
        key: r.key,
        who: t.who[r.hit.role],
        text: r.hit.snippet,
        terms,
        ago: t.ago(daysAgo(Date.parse(r.hit.at), nowMs)),
      };
    const best = r.group?.hits[0];
    const at = best ? Date.parse(best.at) : r.conversation.changedAt;
    const more = r.group ? r.group.hitCount - 1 : 0;
    return {
      kind: "conversation",
      key: r.key,
      title: r.conversation.title,
      titleTerms: r.group?.title ? titleTerms : [],
      workspace: r.conversation.workspaceName,
      mark: r.conversation.archived
        ? "idle"
        : (marks.get(r.conversation.agentId) ?? "done"),
      previous: r.previous,
      archived: r.conversation.archived,
      ago: at !== undefined ? t.ago(daysAgo(at, nowMs)) : undefined,
      line: best
        ? { who: t.who[best.role], text: best.snippet, terms }
        : undefined,
      more:
        more > 0 && (r.group?.hits.length ?? 0) > 1
          ? { count: more, open: !!r.open }
          : undefined,
    };
  });

  const choose = (index: number) => {
    const r = rows[index];
    if (!r) return;
    if (r.kind === "continue") {
      setQuery(r.query);
      setSelected(0);
      setExpanded(new Set());
      return;
    }
    const hit = r.kind === "hit" ? r.hit : r.group?.hits[0];
    if (q) lastQuery = q;
    if (hit && current_reply)
      setSearchJump({
        agentId: r.conversation.agentId,
        entryKey: hit.entry_key,
        query: q,
        terms: current_reply.terms,
        role: hit.role,
        at: hit.at,
      });
    else clearSearchJump();
    close("field");
    void navigate(r.conversation.href);
  };
  const expand = (index: number, on: boolean) => {
    const r = rows[index];
    if (r?.kind !== "conversation") return;
    const id = r.conversation.agentId;
    setExpanded((x) => {
      const next = new Set(x);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    setSelected(on ? index + 1 : index);
  };

  if (!open) return null;
  const status = failed
    ? t.unavailable
    : building && current_reply
      ? t.building(current_reply.index.indexed, current_reply.index.total)
      : undefined;
  return (
    <Switcher
      open
      query={query}
      items={items}
      heading={q ? undefined : t.recent}
      status={q ? status : undefined}
      empty={
        q && (current_reply || failed || !stemsOf(q).length)
          ? t.empty(q)
          : undefined
      }
      foot={t.foot(isMac ? "↵" : "Enter")}
      words={t}
      selected={selected}
      onQuery={(v) => {
        setQuery(v);
        setSelected(0);
        setExpanded(new Set());
      }}
      onSelect={setSelected}
      onChoose={choose}
      onExpand={expand}
      onClose={() => close()}
    />
  );
}

```
