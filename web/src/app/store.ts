import {
  configureStore,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { Snapshot } from "./snapshot";
type State = {
  phase:
    | "loading"
    | "authenticated"
    | "authentication_required"
    | "daemon_unavailable";
  snapshot?: Snapshot;
  lastIdentity?: string;
  filter: string;
  generation: number;
};
const initialState: State = { phase: "loading", filter: "", generation: 0 };
const connection = createSlice({
  name: "connection",
  initialState,
  reducers: {
    loading(state) {
      state.phase = "loading";
      state.snapshot = undefined;
    },
    authenticated(state, action: PayloadAction<Snapshot>) {
      if (
        state.lastIdentity &&
        state.lastIdentity !== action.payload.identity.web_identity_id
      ) {
        state.filter = "";
        state.generation++;
      }
      state.snapshot = action.payload;
      state.lastIdentity = action.payload.identity.web_identity_id;
      state.phase = "authenticated";
    },
    authenticationRequired(state) {
      state.phase = "authentication_required";
      state.snapshot = undefined;
      state.filter = "";
      state.lastIdentity = undefined;
      state.generation++;
    },
    unavailable(state) {
      state.phase = "daemon_unavailable";
      state.snapshot = undefined;
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
    },
  },
});
export const {
  loading,
  authenticated,
  authenticationRequired,
  unavailable,
  filterChanged,
  clearIdentity,
} = connection.actions;
export const store = configureStore({
  reducer: { connection: connection.reducer },
});
export type RootState = ReturnType<typeof store.getState>;
