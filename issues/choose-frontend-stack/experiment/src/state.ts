import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type TimelineEvent = {
  id: string;
  cursor: number;
  kind: 'user' | 'assistant' | 'tool-start' | 'tool-update' | 'tool-end' | 'unknown';
  text: string;
  toolCallId?: string;
};

type Command = { id: string; state: 'pending' | 'accepted' | 'rejected' | 'uncertain' };
type NativeSnapshot = { cursor: number; events: TimelineEvent[] };
type AgentState = NativeSnapshot & {
  sync: 'current' | 'stale';
  commands: Record<string, Command>;
};

const initialState: AgentState = { cursor: 0, events: [], sync: 'current', commands: {} };

const agentSlice = createSlice({
  name: 'agent',
  initialState,
  reducers: {
    snapshotReceived(state, action: PayloadAction<NativeSnapshot>) {
      state.cursor = action.payload.cursor;
      state.events = action.payload.events;
      state.sync = 'current';
    },
    eventReceived(state, action: PayloadAction<TimelineEvent>) {
      const event = action.payload;
      if (event.cursor <= state.cursor || state.events.some((item) => item.id === event.id)) return;
      if (event.cursor !== state.cursor + 1) {
        state.sync = 'stale';
        return;
      }
      state.events.push(event);
      state.cursor = event.cursor;
    },
    commandPosted(state, action: PayloadAction<string>) {
      state.commands[action.payload] = { id: action.payload, state: 'pending' };
    },
    commandAcknowledged(
      state,
      action: PayloadAction<{ id: string; state: Command['state'] }>,
    ) {
      state.commands[action.payload.id] = action.payload;
    },
  },
});

export const actions = agentSlice.actions;
export const makeStore = (preloadedState?: { agent: AgentState }) =>
  configureStore({ reducer: { agent: agentSlice.reducer }, preloadedState });
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;

export const draftKey = (server: string, identity: string, agent: string) =>
  `native-agent-host:draft:${server}:${identity}:${agent}`;

export const draftRepository = {
  read(key: string) {
    return sessionStorage.getItem(key) ?? '';
  },
  write(key: string, value: string) {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  },
  clearIdentity(server: string, identity: string) {
    const prefix = `native-agent-host:draft:${server}:${identity}:`;
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  },
};
