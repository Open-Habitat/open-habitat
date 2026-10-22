import Ajv from "ajv/dist/2020.js";
import { useEffect, useSyncExternalStore } from "react";
import schema from "../../../contracts/v1/editor-preference.schema.json";
import { jsonWrite } from "./mutations";

export type EditorEngine = "codemirror6" | "vscode";
const validate = new Ajv({ strict: false }).compile<{
  schema_version: 1;
  web_identity_id: string;
  engine: EditorEngine;
}>({
  ...schema,
  $ref: `${schema.$id}#/$defs/result`,
});
const url = "/api/v1/account/editor-preference";
type Choice = { engine: EditorEngine; busy: boolean; error: boolean };
const initial: Choice = { engine: "codemirror6", busy: true, error: false };
// Ephemeral observations, scoped to the validated identity AND session binding.
// A reply must also name that identity: an intervening login cannot seed another
// person's preference. Nothing here is persisted in browser storage.
const choices = new Map<string, Choice>();
const generations = new Map<string, number>();
const events = new EventTarget();
const key = (identity: string, csrf: string) => `${identity}:${csrf}`;
function publish(k: string, value: Choice) {
  choices.set(k, value);
  events.dispatchEvent(new Event("change"));
}
function subscribe(callback: () => void) {
  events.addEventListener("change", callback);
  return () => events.removeEventListener("change", callback);
}
async function readReply(
  response: Response,
  identity: string,
): Promise<EditorEngine> {
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("preference unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("preference unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new Error("preference unavailable");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const result = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  );
  if (!validate(result) || result.web_identity_id !== identity)
    throw new Error("preference unavailable");
  return result.engine;
}
export async function loadEditorPreference(identity: string, csrf: string) {
  const k = key(identity, csrf);
  // Never let a background observation race an outstanding write.
  if (choices.get(k)?.busy) return;
  const generation = (generations.get(k) ?? 0) + 1;
  generations.set(k, generation);
  try {
    const engine = await readReply(
      await fetch(url, { credentials: "same-origin", cache: "no-store" }),
      identity,
    );
    if (generations.get(k) === generation)
      publish(k, { engine, busy: false, error: false });
  } catch {
    if (generations.get(k) === generation)
      publish(k, {
        engine: choices.get(k)?.engine ?? "codemirror6",
        busy: false,
        error: true,
      });
  }
}
export async function chooseEditor(
  identity: string,
  engine: EditorEngine,
  csrf: string,
) {
  const k = key(identity, csrf);
  if (choices.get(k)?.busy) return;
  generations.set(k, (generations.get(k) ?? 0) + 1);
  const previous = choices.get(k)?.engine ?? "codemirror6";
  publish(k, { engine: previous, busy: true, error: false });
  try {
    const confirmed = await readReply(
      await jsonWrite("editor.preference", url, { engine }, csrf, {
        method: "PUT",
      }),
      identity,
    );
    publish(k, { engine: confirmed, busy: false, error: false });
  } catch {
    // Lost replies are not retried. A fresh read on focus/reopen can reconcile.
    publish(k, { engine: previous, busy: false, error: true });
  }
}
export function useEditorChoice(identity?: string, csrf?: string): Choice {
  const k = identity && csrf ? key(identity, csrf) : undefined;
  const choice = useSyncExternalStore(subscribe, () =>
    k ? (choices.get(k) ?? initial) : initial,
  );
  useEffect(() => {
    if (!identity || !csrf) return;
    const read = () => {
      void loadEditorPreference(identity, csrf);
    };
    read();
    window.addEventListener("focus", read);
    return () => window.removeEventListener("focus", read);
  }, [identity, csrf]);
  return choice;
}
export function useEditorPreference(identity?: string, csrf?: string) {
  return useEditorChoice(identity, csrf).engine;
}
