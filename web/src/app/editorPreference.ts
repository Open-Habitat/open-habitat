import { useSyncExternalStore } from "react";

export type EditorEngine = "codemirror6" | "monaco" | "vscode";
const choices = new Map<string, EditorEngine>();
const events = new EventTarget();
const key = (identity: string) => `nah:editor:v1:${identity}`;
const valid = (s: unknown): s is EditorEngine =>
  s === "codemirror6" || s === "monaco" || s === "vscode";
export function editorPreference(identity?: string): EditorEngine {
  if (!identity) return "codemirror6";
  if (choices.has(identity)) return choices.get(identity) ?? "codemirror6";
  try {
    const value = localStorage.getItem(key(identity));
    if (valid(value)) return value;
  } catch {
    /* Device storage is optional, never an editor prerequisite. */
  }
  return "codemirror6";
}
export function chooseEditor(identity: string, engine: EditorEngine) {
  choices.set(identity, engine);
  try {
    localStorage.setItem(key(identity), engine);
  } catch {
    /* In-memory choice. */
  }
  events.dispatchEvent(new Event("change"));
}
function subscribe(callback: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key?.startsWith("nah:editor:v1:")) {
      choices.delete(event.key.slice("nah:editor:v1:".length));
      callback();
    }
  };
  events.addEventListener("change", callback);
  window.addEventListener("storage", storage);
  return () => {
    events.removeEventListener("change", callback);
    window.removeEventListener("storage", storage);
  };
}
export function useEditorPreference(identity?: string) {
  return useSyncExternalStore(subscribe, () => editorPreference(identity));
}
