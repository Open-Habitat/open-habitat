import { useSyncExternalStore } from "react";

// This tab's view state only; the mode never outlives the page.
let current = { on: false, stateShown: false };
const listeners = new Set<() => void>();
function set(next: Partial<typeof current>) {
  current = { ...current, ...next };
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const start = () => set({ on: true, stateShown: true });
export const stop = () => set({ on: false });
export const toggle = () => (current.on ? stop() : start());
export const showState = () => set({ stateShown: true });
export const hideState = () => set({ stateShown: false });
export const useExplainState = () =>
  useSyncExternalStore(subscribe, () => current);
