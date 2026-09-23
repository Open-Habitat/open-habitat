import {
  configureStore,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import type { Bootstrap } from "./bootstrap";
type State = { phase: "loading" | Bootstrap["state"]; bootstrap?: Bootstrap };
const initialState: State = { phase: "loading" };
const connection = createSlice({
  name: "connection",
  initialState,
  reducers: {
    loaded(state, action: PayloadAction<Bootstrap>) {
      state.phase = action.payload.state;
      state.bootstrap = action.payload;
    },
  },
});
export const { loaded } = connection.actions;
export const store = configureStore({
  reducer: { connection: connection.reducer },
});
export type RootState = ReturnType<typeof store.getState>;
