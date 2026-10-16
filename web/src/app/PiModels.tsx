import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import schema from "../../../contracts/v1/pi-models.schema.json";
import type { ModelChoice } from "../components/ModelPicker";

const validator = new Ajv({ strict: false });
addFormats(validator);
const valid = validator.compile(schema);
export type Models = {
  schema_version: 1;
  default_provider: "openai-codex" | "openai" | "claude-bridge" | null;
  default_model: string | null;
  default_thinking?: string;
  catalog_status?: "native_cached" | "unavailable";
  models: ModelChoice[];
};
export async function readModels(response: Response): Promise<Models> {
  if (
    !response.ok ||
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw Error("unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw Error("unavailable");
  let text = "";
  let size = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw Error("oversize");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  const value: unknown = JSON.parse(text);
  if (!valid(value)) throw Error("invalid model response");
  return value as Models;
}

/** Fresh authoritative read for workspace direct-start admission; not a cache. */
export async function loadPiModels(signal: AbortSignal): Promise<Models> {
  return readModels(
    await fetch("/api/v1/pi/models", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    }),
  );
}

const Context = createContext<{
  data?: Models;
  error: boolean;
  refresh: () => void;
  update: (value: Models) => void;
}>({ error: false, refresh: () => {}, update: () => {} });
/** One disposable catalog per authenticated identity/tab. No browser or host storage. */
export function PiModelsProvider({
  children,
  enabled,
}: {
  children: ReactNode;
  enabled: boolean;
}) {
  const [data, setData] = useState<Models>();
  const [error, setError] = useState(false);
  const active = useRef(true);
  const pending = useRef<AbortController | undefined>(undefined);
  const version = useRef(0);
  const update = useCallback((value: Models) => {
    ++version.current;
    setData(value);
    setError(false);
  }, []);
  const refresh = useCallback(() => {
    if (!enabled || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const epoch = version.current;
    void loadPiModels(controller.signal)
      .then((value) => {
        if (
          active.current &&
          !controller.signal.aborted &&
          epoch === version.current
        ) {
          setData(value);
          setError(false);
        }
      })
      .catch(() => {
        if (active.current && !controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (pending.current === controller) pending.current = undefined;
      });
  }, [enabled]);
  useEffect(() => {
    active.current = true;
    if (!enabled) return;
    refresh();
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => {
      active.current = false;
      pending.current?.abort();
      pending.current = undefined;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh, enabled]);
  return (
    <Context.Provider value={{ data, error, refresh, update }}>
      {children}
    </Context.Provider>
  );
}
export const usePiModels = () => useContext(Context);
/** Native ids stay in details; the header and pill consistently use the model id. */
export const shortModel = (model?: string) => model?.replace(/^[^/]+\//, "");
