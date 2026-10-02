import Ajv from "ajv/dist/2020.js";
import reposSchema from "../../../contracts/v1/github-repos.schema.json";
import cloneSchema from "../../../contracts/v1/github-clone.schema.json";
import checkoutSchema from "../../../contracts/v1/github-checkout.schema.json";
import cloneProgressSchema from "../../../contracts/v1/github-clone-progress.schema.json";

const ajv = new Ajv({ strict: false });
const reposValid = ajv.compile(reposSchema);
const cloneValid = ajv.compile(cloneSchema);
const checkoutValid = ajv.compile(checkoutSchema);
const cloneProgressValid = ajv.compile(cloneProgressSchema);
export type Repo = {
  full_name: string;
  private: boolean;
  description: string;
  html_url: string;
  pushed_at: string | null;
};
export type Page = {
  schema_version: 1;
  page: number;
  limit: number;
  has_more: boolean;
  repositories: Repo[];
};
export type Observation = {
  schema_version: 1;
  full_name: string;
  state: "absent" | "confirmed" | "conflict" | "unavailable";
};
export class GitHubError extends Error {
  constructor(
    public code: "login" | "auth" | "denied" | "conflict" | "unavailable",
  ) {
    super(code);
  }
}
async function bounded(response: Response, max: number): Promise<unknown> {
  if (
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new GitHubError("unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new GitHubError("unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new GitHubError("unavailable");
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
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    ) as unknown;
  } catch {
    throw new GitHubError("unavailable");
  }
}
async function response(r: Response, max: number): Promise<unknown> {
  if (r.status === 401) throw new GitHubError("login");
  if (r.status === 403) throw new GitHubError("denied");
  if (r.status === 409) {
    const failure = await bounded(r, 4096);
    const code =
      typeof failure === "object" &&
      failure !== null &&
      "error" in failure &&
      typeof failure.error === "object" &&
      failure.error !== null &&
      "code" in failure.error
        ? failure.error.code
        : undefined;
    throw new GitHubError(
      code === "github_auth_unavailable"
        ? "auth"
        : code === "checkout_exists"
          ? "conflict"
          : "unavailable",
    );
  }
  if (!r.ok) throw new GitHubError("unavailable");
  return bounded(r, max);
}
export async function catalog(
  page: number,
  signal?: AbortSignal,
): Promise<Page> {
  const data = await response(
    await fetch(`/api/v1/onboarding/github/repos?page=${page}&limit=50`, {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    }),
    60000,
  );
  if (
    !reposValid(data) ||
    (data as Page).page !== page ||
    (data as Page).limit !== 50
  )
    throw new GitHubError("unavailable");
  return data as Page;
}
export async function observe(
  name: string,
  signal?: AbortSignal,
): Promise<Observation> {
  const data = await response(
    await fetch(
      `/api/v1/onboarding/github/checkout?full_name=${encodeURIComponent(name)}`,
      { credentials: "same-origin", cache: "no-store", signal },
    ),
    4096,
  );
  if (!checkoutValid(data) || (data as Observation).full_name !== name)
    throw new GitHubError("unavailable");
  return data as Observation;
}
export async function clone(
  name: string,
  csrf: string,
  signal?: AbortSignal,
): Promise<void> {
  const data = await response(
    await fetch("/api/v1/onboarding/github/clone", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: {
        "Content-Type": "application/json",
        Origin: window.location.origin,
        "X-Agent-Host-CSRF": csrf,
      },
      body: JSON.stringify({ full_name: name }),
    }),
    4096,
  );
  if (!cloneValid(data) || (data as { full_name: string }).full_name !== name)
    throw new GitHubError("unavailable");
}

export type CloneProgress =
  | {
      schema_version: 1;
      sequence: number;
      kind: "progress";
      stage:
        | "reserving"
        | "connecting"
        | "receiving"
        | "checkout"
        | "verifying";
      percent?: number;
      received_bytes?: number;
      total_bytes?: number;
    }
  | {
      schema_version: 1;
      sequence: number;
      kind: "terminal";
      outcome: "confirmed" | "uncertain" | "rejected";
      reason?: string;
    };

// A POST stream is never resumed. Any missing terminal, invalid frame or lost
// connection is uncertain, even if native observation later finds a directory.
export async function cloneStream(
  name: string,
  csrf: string,
  onProgress: (frame: CloneProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  let r: Response;
  try {
    r = await fetch("/api/v1/onboarding/github/clone/stream", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: {
        "Content-Type": "application/json",
        Origin: window.location.origin,
        "X-Agent-Host-CSRF": csrf,
      },
      body: JSON.stringify({ full_name: name }),
    });
  } catch {
    throw new GitHubError("unavailable");
  }
  if (!r.ok) {
    await response(r, 4096);
    throw new GitHubError("unavailable");
  }
  if (
    r.headers.get("content-type") !== "text/event-stream; charset=utf-8" ||
    !r.body
  )
    throw new GitHubError("unavailable");
  const reader = r.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "",
    sequence = 0,
    terminal = false,
    bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 512 * 1024) throw new GitHubError("unavailable");
      pending += decoder.decode(value, { stream: true });
      for (;;) {
        const end = pending.indexOf("\n\n");
        if (end === -1) break;
        const text = pending.slice(0, end);
        pending = pending.slice(end + 2);
        if (text.length > 1024 || terminal || sequence === 4096)
          throw new GitHubError("unavailable");
        const match = /^event: (progress|terminal)\ndata: (\{[^\n]*\})$/.exec(
          text,
        );
        if (!match) throw new GitHubError("unavailable");
        let frame: unknown;
        try {
          frame = JSON.parse(match[2]);
        } catch {
          throw new GitHubError("unavailable");
        }
        if (
          !cloneProgressValid(frame) ||
          (frame as CloneProgress).kind !== match[1] ||
          (frame as CloneProgress).sequence !== ++sequence
        )
          throw new GitHubError("unavailable");
        const parsed = frame as CloneProgress;
        if (parsed.kind === "progress") onProgress(parsed);
        else {
          terminal = true;
          if (parsed.outcome !== "confirmed")
            throw new GitHubError("unavailable");
        }
      }
      if (pending.length > 8192) throw new GitHubError("unavailable");
    }
    if (decoder.decode() !== "" || pending !== "" || !terminal)
      throw new GitHubError("unavailable");
  } catch {
    throw new GitHubError("unavailable");
  } finally {
    if (!terminal || pending !== "") await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
