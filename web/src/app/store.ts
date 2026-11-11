import {
  configureStore,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { Snapshot, TurnMark, Workspace } from "./snapshot";

/** A fact a mutation reply or a journal event carried. `cursor` is its
 * journal position: a snapshot whose own cursor has passed it already
 * contains it; an older snapshot still on its way gets it re-applied. */
export type HostChange = { cursor?: string } & (
  | {
      kind: "workspace";
      change: {
        workspace_id: string;
        previous_workspace_id?: string;
        observation_token: string;
        name: string;
        display_name: string;
        visibility: "visible" | "hidden";
      };
    }
  | { kind: "archive"; agent_id: string; archive: "active" | "archived" }
  | { kind: "closed"; agent_id: string }
  | { kind: "name"; agent_id: string; name: string }
  | { kind: "turn"; agent_id: string; turn_mark: TurnMark }
  /** An icon the person chose, in the config's flat format. */
  | { kind: "icon"; workspace_id: string; icon: string }
);
const cursorParts = (cursor?: string) => {
  const m = cursor ? /^ev1:([0-9a-fA-F-]{36}):(\d+)$/.exec(cursor) : null;
  return m ? { instance: m[1], sequence: Number(m[2]) } : undefined;
};
const target = (c: HostChange) =>
  c.kind === "workspace"
    ? `ws:${c.change.previous_workspace_id ?? c.change.workspace_id}`
    : c.kind === "icon"
      ? `icon:${c.workspace_id}`
      : `${c.kind}:${c.agent_id}`;
/** True when the snapshot's journal position has passed the change. */
function covers(snapshot: Snapshot, change: HostChange) {
  const at = cursorParts(change.cursor);
  const s = cursorParts(snapshot.event_cursor);
  return !!at && !!s && at.instance === s.instance && s.sequence >= at.sequence;
}
/** The workspace as the daemon will read it once the config's `icon` says
 * `value` (the daemon's parseIconValue): the chain's config link, or with
 * `auto` its logo. An image other than the logo has no version known here,
 * so it waits for the snapshot. */
function withIcon(w: Workspace, value: string) {
  const logo = w.icon_logo;
  if (value === "auto") {
    w.icon_auto = true;
    w.icon = logo ? { kind: "image", source: "logo", ...logo } : undefined;
    return;
  }
  if (/\.(svg|png|webp|jpe?g)$/i.test(value)) {
    if (logo?.path !== value) return;
    w.icon = { kind: "image", source: "config", ...logo };
  } else if (/^[A-Za-z0-9ÅÄÖåäö]{1,3}$/.test(value))
    w.icon = { kind: "letters", source: "config", value: value.toUpperCase() };
  else w.icon = { kind: "emoji", source: "config", value };
  delete w.icon_auto;
}
function apply(snapshot: Snapshot, c: HostChange) {
  if (c.kind === "closed") {
    snapshot.agents = snapshot.agents.filter((a) => a.agent_id !== c.agent_id);
    return;
  }
  if (c.kind === "name") {
    const agent = snapshot.agents.find((a) => a.agent_id === c.agent_id);
    if (agent) agent.title = { display: c.name, source: "native_session" };
    return;
  }
  if (c.kind === "turn") {
    const agent = snapshot.agents.find((a) => a.agent_id === c.agent_id);
    if (agent) agent.turn_mark = c.turn_mark;
    return;
  }
  if (c.kind === "archive") {
    const agent = snapshot.agents.find((a) => a.agent_id === c.agent_id);
    if (agent) agent.archive = c.archive;
    return;
  }
  if (c.kind === "icon") {
    const ws = snapshot.workspaces.find(
      (x) => x.workspace_id === c.workspace_id,
    );
    if (ws) withIcon(ws, c.icon);
    return;
  }
  const w =
    snapshot.workspaces.find(
      (x) => x.workspace_id === c.change.previous_workspace_id,
    ) ??
    snapshot.workspaces.find((x) => x.workspace_id === c.change.workspace_id);
  if (!w) return;
  const from = w.workspace_id;
  w.workspace_id = c.change.workspace_id;
  w.observation_token = c.change.observation_token;
  w.name = c.change.name;
  w.display_name = c.change.display_name;
  w.visibility = c.change.visibility;
  if (from !== c.change.workspace_id)
    for (const a of snapshot.agents)
      if (a.workspace_id === from) a.workspace_id = c.change.workspace_id;
}

type State = {
  phase:
    | "loading"
    | "authenticated"
    | "stale"
    | "authentication_required"
    | "pi_required"
    | "daemon_unavailable";
  snapshot?: Snapshot;
  lastIdentity?: string;
  filter: string;
  generation: number;
  /** Applied changes newer than the snapshot's cursor; a patch log, not a store. */
  changes: HostChange[];
};
const initialState: State = {
  phase: "loading",
  filter: "",
  generation: 0,
  changes: [],
};
const connection = createSlice({
  name: "connection",
  initialState,
  reducers: {
    loading(state) {
      state.phase = "loading";
      state.snapshot = undefined;
      state.changes = [];
    },
    authenticated(state, action: PayloadAction<Snapshot>) {
      if (
        state.lastIdentity &&
        state.lastIdentity !== action.payload.identity.web_identity_id
      ) {
        state.filter = "";
        state.generation++;
        state.changes = [];
      }
      const next = action.payload;
      // An older snapshot may arrive after a newer change: keep re-applying
      // a change until a snapshot's cursor has passed it.
      // A change from another daemon instance is unordered against this
      // snapshot: the restarted daemon's snapshot is the truth.
      const at = cursorParts(next.event_cursor);
      state.changes = state.changes.filter((c) => {
        const own = cursorParts(c.cursor);
        return (
          !!own && !!at && own.instance === at.instance && !covers(next, c)
        );
      });
      for (const c of state.changes) apply(next, c);
      state.snapshot = next;
      state.lastIdentity = action.payload.identity.web_identity_id;
      state.phase = "authenticated";
    },
    piRequired(state) {
      state.phase = "pi_required";
      state.snapshot = undefined;
      state.filter = "";
      state.lastIdentity = undefined;
      state.generation++;
      state.changes = [];
    },
    authenticationRequired(state) {
      state.phase = "authentication_required";
      state.snapshot = undefined;
      state.filter = "";
      state.lastIdentity = undefined;
      state.generation++;
      state.changes = [];
    },
    unavailable(state) {
      state.phase = "daemon_unavailable";
      state.snapshot = undefined;
      state.lastIdentity = undefined;
      state.filter = "";
      state.generation++;
      state.changes = [];
    },
    stale(state) {
      if (state.phase === "authenticated" && state.snapshot)
        state.phase = "stale";
    },
    /** An open event stream proves the host reachable again. */
    streamOpen(state) {
      if (state.phase === "stale" && state.snapshot)
        state.phase = "authenticated";
    },
    hostChanged(state, action: PayloadAction<HostChange>) {
      const c = action.payload;
      if (!state.snapshot || covers(state.snapshot as Snapshot, c)) return;
      const at = cursorParts(c.cursor);
      const key = target(c);
      const later = state.changes.find((old) => {
        const o = cursorParts(old.cursor);
        return (
          target(old) === key &&
          o &&
          at &&
          o.instance === at.instance &&
          o.sequence >= at.sequence
        );
      });
      if (later) return; // an event already carried a newer fact
      apply(state.snapshot as Snapshot, c);
      if (!at) return; // no journal position: the next snapshot decides
      state.changes = state.changes.filter((old) => target(old) !== key);
      state.changes.push(c);
    },
    filterChanged(state, action: PayloadAction<string>) {
      state.filter = action.payload;
    },
    clearIdentity(state) {
      state.lastIdentity = undefined;
      state.snapshot = undefined;
      state.filter = "";
      state.phase = "authentication_required";
      state.generation++;
      state.changes = [];
    },
  },
});
export const {
  loading,
  authenticated,
  authenticationRequired,
  piRequired,
  unavailable,
  stale,
  streamOpen,
  filterChanged,
  clearIdentity,
  hostChanged,
} = connection.actions;
export const store = configureStore({
  reducer: { connection: connection.reducer },
});
export type RootState = ReturnType<typeof store.getState>;
