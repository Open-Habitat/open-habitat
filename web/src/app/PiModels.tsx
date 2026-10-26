import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import schema from "../../../contracts/v1/pi-models.schema.json";
import type { ModelChoice, PiProvider } from "../components/ModelPicker";
import {
  refusalReason as hostRefusal,
  mutationFetch,
  slowConfirmationMs,
  writeOutcome,
} from "./mutations";

const validator = new Ajv({ strict: false });
addFormats(validator);
const valid = validator.compile(schema);
export type Models = {
  schema_version: 1;
  default_provider: PiProvider | null;
  default_model: string | null;
  default_thinking?: string;
  catalog_status?: "native_cached" | "unavailable";
  auto_compaction?: boolean;
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

export type DefaultChoice = {
  provider: NonNullable<Models["default_provider"]>;
  model: string;
  thinking?: string;
};
/** How one default-model command ended. A later choice supersedes an earlier one. */
export type DefaultOutcome = "confirmed" | "refused" | "superseded";
type DefaultCommand = {
  id: string;
  choice: DefaultChoice;
  csrf: string;
  settle: (outcome: DefaultOutcome) => void;
};
const confirms = (value: Models, choice: DefaultChoice) =>
  value.default_provider === choice.provider &&
  value.default_model === choice.model &&
  (!choice.thinking || value.default_thinking === choice.thinking);
// The layer's reading of a refusal (ADR 0023), with this command's wording.
const refusalReason = (status: number, code: string) =>
  status === 401 || status === 403
    ? "Istunto ei sallinut tallennusta. Kirjaudu uudelleen."
    : status === 409 || status === 429
      ? "Agentin asetukset olivat varattuina. Yritä hetken päästä uudelleen."
      : hostRefusal(code, status);

const Context = createContext<{
  data?: Models;
  error: boolean;
  refresh: () => void;
  update: (value: Models) => void;
  chooseDefault: (
    choice: DefaultChoice,
    csrf: string,
  ) => Promise<DefaultOutcome>;
  defaultPending: boolean;
  defaultSlow: boolean;
  defaultRefusal: string;
}>({
  error: false,
  refresh: () => {},
  update: () => {},
  chooseDefault: async () => "refused",
  defaultPending: false,
  defaultSlow: false,
  defaultRefusal: "",
});
/** One disposable catalog per authenticated identity/tab. No browser or host storage.
 *
 * Pi's default model is in the optimistic class of `browser-mutation-layer`:
 * the choice shows at once as an in-memory overlay on the catalog, keyed by a
 * client command id. Pi's own settings stay the only record. The overlay is
 * dropped when Pi confirms or refuses, and with the provider on an identity
 * change. Only the latest choice is sent; an uncertain reply rereads Pi's
 * default as its receipt instead of guessing. */
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
  const [overlay, setOverlay] = useState<{
    id: string;
    choice: DefaultChoice;
  }>();
  const [slow, setSlow] = useState(false);
  const [refusal, setRefusal] = useState("");
  const latest = useRef<DefaultCommand | undefined>(undefined);
  // An uncertain command whose receipt could not be read yet.
  const unsettled = useRef<DefaultCommand | undefined>(undefined);
  const sending = useRef(false);
  const writes = useRef<AbortController | undefined>(undefined);
  const reread = useRef<() => void>(() => {});
  const update = useCallback((value: Models) => {
    ++version.current;
    setData(value);
    setError(false);
  }, []);
  const settle = useCallback(
    (
      command: DefaultCommand,
      outcome: "confirmed" | "refused",
      reason = "",
    ) => {
      if (latest.current === command) latest.current = undefined;
      if (unsettled.current === command) unsettled.current = undefined;
      setOverlay((o) => (o?.id === command.id ? undefined : o));
      if (outcome === "refused") setRefusal(reason);
      command.settle(outcome);
    },
    [],
  );
  const drain = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    try {
      for (;;) {
        const command = latest.current;
        if (!command || !active.current) return;
        const controller = new AbortController();
        writes.current = controller;
        let value: Models | undefined;
        let refused = "";
        try {
          const response = await mutationFetch(
            "pi.default_model",
            "/api/v1/pi/models",
            {
              method: "POST",
              credentials: "same-origin",
              headers: {
                "Content-Type": "application/json",
                "X-Agent-Host-CSRF": command.csrf,
              },
              body: JSON.stringify(command.choice),
              signal: controller.signal,
            },
          );
          // A typed 4xx is a definite refusal; a 5xx or lost reply is not.
          const outcome = await writeOutcome(response);
          if (outcome.kind === "refused")
            refused = refusalReason(outcome.status, outcome.code);
          else if (outcome.kind === "login") refused = refusalReason(401, "");
          else if (outcome.kind === "ok")
            value = await readModels(outcome.response);
        } catch {
          if (controller.signal.aborted) return;
        }
        if (!refused && !value)
          try {
            value = await loadPiModels(controller.signal);
          } catch {
            if (controller.signal.aborted) return;
          }
        if (!active.current) return;
        if (value) update(value);
        if (latest.current !== command) {
          // A newer choice arrived meanwhile; only its outcome is shown.
          command.settle("superseded");
          continue;
        }
        if (refused) settle(command, "refused", refused);
        else if (!value) {
          // Still uncertain: keep the choice pending. Only a catalog read
          // begun after this write can be its receipt, so drop one in flight.
          latest.current = undefined;
          unsettled.current = command;
          pending.current?.abort();
          pending.current = undefined;
          reread.current();
        } else if (confirms(value, command.choice))
          settle(command, "confirmed");
        else
          settle(
            command,
            "refused",
            "Agentti ei tallentanut valintaa oletukseksi.",
          );
      }
    } finally {
      sending.current = false;
    }
  }, [settle, update]);
  const chooseDefault = useCallback(
    (choice: DefaultChoice, csrf: string) =>
      new Promise<DefaultOutcome>((resolve) => {
        const id = crypto.randomUUID();
        latest.current?.settle("superseded");
        unsettled.current?.settle("superseded");
        unsettled.current = undefined;
        latest.current = { id, choice, csrf, settle: resolve };
        setOverlay({ id, choice });
        setRefusal("");
        void drain();
      }),
    [drain],
  );
  useEffect(() => {
    setSlow(false);
    if (!overlay) return;
    const timer = window.setTimeout(() => setSlow(true), slowConfirmationMs);
    return () => window.clearTimeout(timer);
  }, [overlay]);
  const refresh = useCallback(() => {
    if (!enabled || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const epoch = version.current;
    void loadPiModels(controller.signal)
      .then((value) => {
        if (!active.current || controller.signal.aborted) return;
        const command = unsettled.current;
        if (command) {
          update(value);
          if (confirms(value, command.choice)) settle(command, "confirmed");
          else
            settle(
              command,
              "refused",
              "Agentti ei tallentanut valintaa oletukseksi.",
            );
        } else if (epoch === version.current) {
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
  }, [enabled, settle, update]);
  reread.current = refresh;
  useEffect(() => {
    active.current = true;
    if (!enabled) return;
    refresh();
    // Opening a picker and returning to the tab already reread native state.
    // An idle tab must not keep spawning catalog helpers every minute.
    window.addEventListener("focus", refresh);
    return () => {
      active.current = false;
      pending.current?.abort();
      pending.current = undefined;
      writes.current?.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [refresh, enabled]);
  const shown = useMemo(
    () =>
      data && overlay
        ? {
            ...data,
            default_provider: overlay.choice.provider,
            default_model: overlay.choice.model,
            default_thinking: overlay.choice.thinking ?? data.default_thinking,
          }
        : data,
    [data, overlay],
  );
  return (
    <Context.Provider
      value={{
        data: shown,
        error,
        refresh,
        update,
        chooseDefault,
        defaultPending: !!overlay,
        defaultSlow: slow,
        defaultRefusal: refusal,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const usePiModels = () => useContext(Context);
/** Strip the provider prefix without interpreting the native model id. */
export const shortModel = (model?: string) => model?.replace(/^[^/]+\//, "");

export {
  modelDisplayName,
  thinkingDisplayName,
} from "../components/modelPresentation";
