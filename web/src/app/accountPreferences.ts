import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import schema from "../../../contracts/v1/account-preferences.schema.json";
import common from "../../../contracts/v1/common.schema.json";
import { type LanguageChoice, setPersonalLanguage } from "../i18n";
import { LazyAjv } from "./lazyAjv";
import { jsonWrite } from "./mutations";

export type EditorEngine = "codemirror6" | "vscode";
/** The order of the rail's Hiljaiset section. */
export type QuietSort = "newest" | "workspace" | "name";

/** The experimental features the settings offer, in the section's order.
 * A feature reads its switch with `useExperimentalFeature(id)`. An id the
 * daemon returns that is not listed here is ignored. */
export const experimentalFeatureIds = [
  "rewind-conversation",
  "explain-mode",
  "agent-resources-view",
  "shares-page",
  "conversation-context-view",
  "named-workers",
  "remote-browser",
  "atlassian-connect",
  "trello-connect",
  "turn-changes",
  "terminal-copy-on-select",
  "terminal-open-urls",
] as const;
export type ExperimentalFeatureId = (typeof experimentalFeatureIds)[number];

type Reply = {
  schema_version: 1;
  web_identity_id: string;
  engine: EditorEngine;
  language: LanguageChoice;
  quiet_sort: QuietSort;
  quiet_workspace: string | null;
  experimental: Record<string, true>;
};
const ajv = new LazyAjv({ strict: false });
ajv.addSchema(common);
const validate = ajv.compile<Reply>({
  ...schema,
  $ref: `${schema.$id}#/$defs/result`,
});
const url = "/api/v1/account/preferences";

/** What the daemon last confirmed, and the one write in flight. `loaded`
 * says the first read has finished, either way. `busy` and `error` name what
 * they concern: "engine", "language", "quiet_sort", "quiet_workspace", a
 * feature id, or "read". */
export type Preferences = {
  engine: EditorEngine;
  language: LanguageChoice;
  quiet_sort: QuietSort;
  /** The one workspace Hiljaiset is narrowed to; null for every one. */
  quiet_workspace: string | null;
  experimental: Readonly<Record<string, true>>;
  loaded: boolean;
  busy?: string;
  error?: string;
};
const initial: Preferences = {
  engine: "codemirror6",
  language: "system",
  quiet_sort: "newest",
  quiet_workspace: null,
  experimental: {},
  loaded: false,
};
// Ephemeral observations, scoped to the validated identity AND session binding.
// A reply must also name that identity: an intervening login cannot seed another
// person's preferences. Nothing here is persisted in browser storage.
const states = new Map<string, Preferences>();
const generations = new Map<string, number>();
const reading = new Map<string, number>();
const events = new EventTarget();
const key = (identity: string, csrf: string) => `${identity}:${csrf}`;
function publish(k: string, value: Preferences) {
  states.set(k, value);
  events.dispatchEvent(new Event("change"));
}
function subscribe(callback: () => void) {
  events.addEventListener("change", callback);
  return () => events.removeEventListener("change", callback);
}
async function readReply(response: Response, identity: string) {
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("preferences unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("preferences unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new Error("preferences unavailable");
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
    throw new Error("preferences unavailable");
  return {
    engine: result.engine,
    language: result.language,
    quiet_sort: result.quiet_sort,
    quiet_workspace: result.quiet_workspace,
    experimental: result.experimental,
  };
}

export async function loadAccountPreferences(identity: string, csrf: string) {
  const k = key(identity, csrf);
  // Never let a background observation race an outstanding write, and let
  // the many readers of one focus event share one request.
  const current = generations.get(k) ?? 0;
  if (states.get(k)?.busy || reading.get(k) === current) return;
  const generation = current + 1;
  generations.set(k, generation);
  reading.set(k, generation);
  try {
    const confirmed = await readReply(
      await fetch(url, { credentials: "same-origin", cache: "no-store" }),
      identity,
    );
    if (generations.get(k) === generation)
      publish(k, { ...confirmed, loaded: true });
  } catch {
    if (generations.get(k) === generation)
      publish(k, {
        ...(states.get(k) ?? initial),
        loaded: true,
        error: "read",
      });
  } finally {
    if (reading.get(k) === generation) reading.delete(k);
  }
}

/** Write one change; the state follows only the daemon's confirmation. */
async function write(
  identity: string,
  csrf: string,
  what: string,
  body: object,
) {
  const k = key(identity, csrf);
  const previous = states.get(k) ?? initial;
  if (previous.busy) return;
  generations.set(k, (generations.get(k) ?? 0) + 1);
  publish(k, { ...previous, busy: what, error: undefined });
  try {
    const confirmed = await readReply(
      await jsonWrite("account.preferences", url, body, csrf, {
        method: "PUT",
      }),
      identity,
    );
    publish(k, { ...confirmed, loaded: true });
  } catch {
    // Lost replies are not retried. A fresh read on focus/reopen can reconcile.
    publish(k, { ...previous, busy: undefined, error: what });
  }
}

export function chooseEditor(
  identity: string,
  engine: EditorEngine,
  csrf: string,
) {
  return write(identity, csrf, "engine", { engine });
}

export function chooseQuietSort(
  identity: string,
  sort: QuietSort,
  csrf: string,
) {
  return write(identity, csrf, "quiet_sort", { quiet_sort: sort });
}

/** Narrows Hiljaiset to one workspace, or with null shows every one. */
export function chooseQuietWorkspace(
  identity: string,
  workspaceId: string | null,
  csrf: string,
) {
  return write(identity, csrf, "quiet_workspace", {
    quiet_workspace: workspaceId,
  });
}

export function chooseLanguage(
  identity: string,
  language: LanguageChoice,
  csrf: string,
) {
  return write(identity, csrf, "language", { language });
}

export function setExperimentalFeature(
  identity: string,
  id: ExperimentalFeatureId,
  enabled: boolean,
  csrf: string,
) {
  return write(identity, csrf, id, { experimental: { [id]: enabled } });
}

/** The confirmed preferences, read now and again whenever the window
 * regains focus, so a change made on another device shows up here. */
export function useAccountPreferences(
  identity?: string,
  csrf?: string,
): Preferences {
  const k = identity && csrf ? key(identity, csrf) : undefined;
  const state = useSyncExternalStore(subscribe, () =>
    k ? (states.get(k) ?? initial) : initial,
  );
  useEffect(() => {
    if (!identity || !csrf) return;
    const read = () => {
      void loadAccountPreferences(identity, csrf);
    };
    read();
    window.addEventListener("focus", read);
    return () => window.removeEventListener("focus", read);
  }, [identity, csrf]);
  return state;
}

/** The confirmed preferences as AccountPreferencesProvider keeps them, read
 * again only when it does (on focus), not when this component mounts. */
export function useConfirmedPreferences(
  identity?: string,
  csrf?: string,
): Preferences {
  const k = identity && csrf ? key(identity, csrf) : undefined;
  return useSyncExternalStore(subscribe, () =>
    k ? (states.get(k) ?? initial) : initial,
  );
}

export function useEditorChoice(identity?: string, csrf?: string) {
  const state = useAccountPreferences(identity, csrf);
  return {
    engine: state.engine,
    busy: !state.loaded || !!state.busy,
    error: state.error === "read" || state.error === "engine",
  };
}

const Session = createContext<{ identity?: string; csrf?: string }>({});

/** Names the session whose preferences `useExperimentalFeature` reads, and
 * keeps them read while the app is open. */
export function AccountPreferencesProvider({
  identity,
  csrf,
  children,
}: {
  identity?: string;
  csrf?: string;
  children?: ReactNode;
}) {
  const state = useAccountPreferences(identity, csrf);
  // The interface follows the person's confirmed choice. Until it is read,
  // the language of the last load stays. Without a session the app says
  // so itself (signed out: the server default and the browser decide).
  const confirmed = state.loaded && state.error !== "read";
  const language = confirmed ? state.language : "pending";
  useEffect(() => {
    if (identity) setPersonalLanguage(language);
  }, [identity, language]);
  const value = useMemo(() => ({ identity, csrf }), [identity, csrf]);
  return createElement(Session.Provider, { value }, children);
}

/** Whether the person turned the experimental feature on. Off until the
 * daemon has confirmed otherwise, and off without a signed-in session. A
 * caller above `AccountPreferencesProvider` names the session itself. */
export function useExperimentalFeature(
  id: ExperimentalFeatureId,
  session?: { identity?: string; csrf?: string },
): boolean {
  const named = useContext(Session);
  const { identity, csrf } = session ?? named;
  const k = identity && csrf ? key(identity, csrf) : undefined;
  return useSyncExternalStore(
    subscribe,
    () => !!(k && states.get(k)?.experimental[id]),
  );
}
