import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import serverSchema from "../../../contracts/v1/server-speech-key.schema.json";
import schema from "../../../contracts/v1/speech.schema.json";
import { hostRequest, jsonWrite, mutationFetch } from "./mutations";

/** Soniox's data-residency regions; a key belongs to one. */
export type SpeechRegion = "us" | "eu";

export type SpeechKeyState = {
  schema_version: 1;
  present: boolean;
  suffix: string | null;
  region: SpeechRegion | null;
  /** own: the person saved it; site: a copy of the site's key. */
  source: "own" | "site" | null;
};

/** One dictation's temporary Soniox key, from the person's own daemon. */
export type SpeechSession = {
  schema_version: 1;
  api_key: string;
  expires_at: string;
  websocket_url: string;
  max_session_seconds: 600;
};

export type SiteSpeechKey = {
  schema_version: 1;
  site_key?: { region: SpeechRegion; suffix: string; set_at: string };
  given?: Partial<
    Record<
      | "seeded"
      | "replaced"
      | "already_current"
      | "kept"
      | "not_reached"
      | "unknown",
      number
    >
  >;
};

const ajv = new Ajv({ strict: false });
addFormats(ajv);
ajv.addSchema(schema);
ajv.addSchema(serverSchema);
const validKeyState = ajv.compile<SpeechKeyState>({
  $ref: `${schema.$id}#/$defs/key_state`,
});
const validSession = ajv.compile<SpeechSession>({
  $ref: `${schema.$id}#/$defs/session`,
});
const validSiteKey = ajv.compile<SiteSpeechKey>({
  $ref: `${serverSchema.$id}#/$defs/read`,
});

/** The daemon's literal-key rule. */
export const sonioxKeyShape = /^[A-Za-z0-9_-]{16,256}$/;

/** Why a dictation could not start or go on. The first four are the
 * contract's codes; the rest are the browser's own. */
export type SpeechFailure =
  | "speech_key_missing"
  | "speech_key_rejected"
  | "speech_limit_reached"
  | "speech_unavailable"
  | "microphone_denied"
  | "unsupported"
  | "login";

const contractCodes: SpeechFailure[] = [
  "speech_key_missing",
  "speech_key_rejected",
  "speech_limit_reached",
  "speech_unavailable",
];

export class SpeechError extends Error {
  constructor(readonly code: SpeechFailure) {
    super(code);
  }
}

async function boundedJSON(response: Response, limit = 4096) {
  const reader = response.body?.getReader();
  if (!reader) throw Error("unavailable");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw Error("oversize");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(text) as unknown;
}

async function errorCode(response: Response): Promise<string> {
  try {
    const body = (await boundedJSON(response)) as {
      error?: { code?: unknown };
    };
    return typeof body.error?.code === "string" ? body.error.code : "";
  } catch {
    return "";
  }
}

/** Asks the person's daemon for one dictation's temporary key. */
export async function mintSpeechSession(
  csrf: string,
  signal?: AbortSignal,
): Promise<SpeechSession> {
  let response: Response;
  try {
    response = await mutationFetch("speech.session", "/api/v1/speech/session", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: { "X-Agent-Host-CSRF": csrf, Origin: window.location.origin },
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new SpeechError("speech_unavailable");
  }
  if (response.status === 401) throw new SpeechError("login");
  if (!response.ok) {
    const code = await errorCode(response);
    throw new SpeechError(
      contractCodes.find((c) => c === code) ?? "speech_unavailable",
    );
  }
  const data = await boundedJSON(response).catch(() => null);
  if (!validSession(data)) throw new SpeechError("speech_unavailable");
  return data;
}

async function keyReply(response: Response): Promise<SpeechKeyState> {
  if (!response.ok) throw Error("unavailable");
  const data = await boundedJSON(response);
  if (!validKeyState(data)) throw Error("contract");
  return data;
}

export async function readSpeechKey(signal?: AbortSignal) {
  return keyReply(
    await hostRequest("speech.key", "/api/v1/speech/key", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    }),
  );
}

export async function saveSpeechKey(
  csrf: string,
  key: string,
  region: SpeechRegion,
) {
  return keyReply(
    await jsonWrite("speech.key", "/api/v1/speech/key", { key, region }, csrf),
  );
}

export async function removeSpeechKey(csrf: string) {
  return keyReply(
    await mutationFetch("speech.key", "/api/v1/speech/key", {
      method: "DELETE",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "X-Agent-Host-CSRF": csrf, Origin: window.location.origin },
    }),
  );
}

async function siteReply(response: Response): Promise<SiteSpeechKey> {
  if (!response.ok) throw Error((await errorCode(response)) || "unavailable");
  const data = await boundedJSON(response);
  if (!validSiteKey(data)) throw Error("contract");
  return data;
}

export async function readSiteSpeechKey(signal?: AbortSignal) {
  return siteReply(
    await fetch("/api/v1/server/speech-key", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    }),
  );
}

export async function setSiteSpeechKey(
  csrf: string,
  key: string,
  region: SpeechRegion,
) {
  return siteReply(
    await jsonWrite(
      "server.speech_key",
      "/api/v1/server/speech-key/set",
      { key, region },
      csrf,
    ),
  );
}

export async function deleteSiteSpeechKey(csrf: string) {
  return siteReply(
    await jsonWrite(
      "server.speech_key",
      "/api/v1/server/speech-key/delete",
      {},
      csrf,
    ),
  );
}
