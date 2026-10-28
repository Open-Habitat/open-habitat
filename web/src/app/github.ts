import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import checkoutSchema from "../../../contracts/v1/github-checkout.schema.json";
import cloneSchema from "../../../contracts/v1/github-clone.schema.json";
import cloneProgressSchema from "../../../contracts/v1/github-clone-progress.schema.json";
import reposSchema from "../../../contracts/v1/github-repos.schema.json";
import repositorySchema from "../../../contracts/v1/github-repository.schema.json";
import integrationsSchema from "../../../contracts/v1/integrations.schema.json";
import { mutationFetch } from "./mutations";

const ajv = new Ajv({ strict: false });
addFormats(ajv);
// A Gitea or GitLab job names its connection with the integrations
// catalog's id.
ajv.addSchema(integrationsSchema);
ajv.addSchema(reposSchema);
ajv.addSchema(cloneSchema);
ajv.addSchema(cloneProgressSchema);
const reposValid = ajv.compile({
  $ref: "https://open-habitat.invalid/contracts/v1/github-repos.schema.json",
});
const repositoryValid = ajv.compile(repositorySchema);
const checkoutValid = ajv.compile(checkoutSchema);
const cloneListValid = ajv.compile({
  $ref: "https://open-habitat.invalid/contracts/v1/github-clone.schema.json#/$defs/list",
});
const cloneJobReplyValid = ajv.compile({
  $ref: "https://open-habitat.invalid/contracts/v1/github-clone.schema.json#/$defs/jobReply",
});
const cloneDismissedValid = ajv.compile({
  $ref: "https://open-habitat.invalid/contracts/v1/github-clone.schema.json#/$defs/dismissed",
});
const cloneRemovedValid = ajv.compile({
  $ref: "https://open-habitat.invalid/contracts/v1/github-clone.schema.json#/$defs/removed",
});
const cloneProgressValid = ajv.compile({
  $ref: "https://open-habitat.invalid/contracts/v1/github-clone-progress.schema.json",
});
export type Repo = {
  full_name: string;
  private: boolean;
  description: string;
  html_url: string;
  pushed_at: string | null;
  /** GitHub's own estimate, not the checkout's eventual disk use. */
  size_kib: number;
  default_branch: string | null;
  owner_type: "User" | "Organization";
  /** One of the site's defaults for this person (ADR 0030): preselected
   * starts selected; locked is already being fetched by the site. */
  default?: "preselected" | "locked";
};
export type Catalog = {
  schema_version: 1;
  /** The bound GitHub account's own login, when GitHub gave a valid one. */
  login?: string;
  /** False when the daemon's page bound was reached; exact names still resolve through lookup. */
  complete: boolean;
  /** Newest push first. */
  repositories: Repo[];
};
export type Lookup =
  | { schema_version: 1; full_name: string; state: "found"; repository: Repo }
  | { schema_version: 1; full_name: string; state: "not_found" }
  /** GitHub refused it because its organisation keeps the app out. */
  | {
      schema_version: 1;
      full_name: string;
      state: "restricted";
      restriction: "oauth_app" | "saml";
    };
export type Observation = {
  schema_version: 1;
  full_name: string;
  state:
    | "absent"
    | "confirmed"
    | "cloning"
    | "interrupted"
    | "conflict"
    | "unavailable";
  size_bytes?: number;
};
export type CloneMode = "full" | "blobless";
export type CloneJob = {
  job_id: string;
  full_name: string;
  /** Absent for GitHub; a Gitea or GitLab clone names its connection and
   * repository. */
  source?: ForgeCloneSource;
  mode: CloneMode;
  state: "running" | "confirmed" | "failed" | "cancelled";
  stage?: Extract<CloneProgress, { kind: "progress" }>["stage"];
  percent?: number;
  received_bytes?: number;
  reason?: string;
  leftover?: "removed" | "kept";
  started_at: string;
  finished_at?: string;
};
export type ForgeCloneSource = {
  provider: "gitea" | "gitlab";
  connection_id: string;
  repository_id: number;
};
/** A site default the daemon has not started yet; refused keeps its reason. */
export type PlannedClone = {
  full_name: string;
  state: "waiting" | "refused";
  reason?: string;
};
/** An interrupted clone; a Gitea or GitLab one names its connection while
 * exactly one matches what the directory records, and can be restarted only
 * then. A GitLab one's full_name is the whole project path. */
export type InterruptedClone = {
  full_name: string;
  size_bytes: number;
  source?: { provider: "gitea" | "gitlab"; connection_id?: string };
};
export type CloneJobs = {
  schema_version: 1;
  jobs: CloneJob[];
  planned?: PlannedClone[];
  interrupted: InterruptedClone[];
  interrupted_complete: boolean;
};
export class GitHubError extends Error {
  constructor(
    public code:
      | "login"
      | "auth"
      | "denied"
      | "conflict"
      | "storage"
      | "busy"
      | "empty"
      | "gitea"
      | "gitlab"
      | "rewritten"
      | "unavailable",
  ) {
    super(
      code === "storage"
        ? "Tallennustila on täynnä. Pyydä ylläpitäjää nostamaan tallennusrajaa."
        : code,
    );
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
      code === "quota_full"
        ? "storage"
        : code === "github_auth_unavailable"
          ? "auth"
          : code === "checkout_exists"
            ? "conflict"
            : code === "clone_running"
              ? "busy"
              : code === "repository_empty"
                ? "empty"
                : code === "remote_rewritten"
                  ? "rewritten"
                  : code === "gitea_connection_unavailable" ||
                      code === "gitea_git_unavailable" ||
                      code === "gitea_auth_unavailable" ||
                      code === "provider_unavailable"
                    ? "gitea"
                    : code === "gitlab_connection_unavailable" ||
                        code === "gitlab_git_unavailable" ||
                        code === "gitlab_auth_unavailable"
                      ? "gitlab"
                      : "unavailable",
    );
  }
  if (!r.ok) throw new GitHubError("unavailable");
  return bounded(r, max);
}
const json = { credentials: "same-origin", cache: "no-store" } as const;

/** The whole catalog in one read; the daemon pages GitHub itself. */
export async function catalog(signal?: AbortSignal): Promise<Catalog> {
  const data = await response(
    await fetch("/api/v1/onboarding/github/repos", { ...json, signal }),
    2 * 1024 * 1024,
  );
  if (!reposValid(data)) throw new GitHubError("unavailable");
  return data as Catalog;
}
/** One exact owner/repo on GitHub, whether or not it is in the catalog. */
export async function lookup(
  name: string,
  signal?: AbortSignal,
): Promise<Lookup> {
  const data = await response(
    await fetch(
      `/api/v1/onboarding/github/repository?full_name=${encodeURIComponent(name)}`,
      { ...json, signal },
    ),
    8192,
  );
  if (!repositoryValid(data) || (data as Lookup).full_name !== name)
    throw new GitHubError("unavailable");
  return data as Lookup;
}
export async function observe(
  name: string,
  signal?: AbortSignal,
): Promise<Observation> {
  const data = await response(
    await fetch(
      `/api/v1/onboarding/github/checkout?full_name=${encodeURIComponent(name)}`,
      { ...json, signal },
    ),
    4096,
  );
  if (!checkoutValid(data) || (data as Observation).full_name !== name)
    throw new GitHubError("unavailable");
  return data as Observation;
}
export async function cloneJobs(signal?: AbortSignal): Promise<CloneJobs> {
  const data = await response(
    await fetch("/api/v1/onboarding/github/clones", { ...json, signal }),
    65536,
  );
  if (!cloneListValid(data)) throw new GitHubError("unavailable");
  return data as CloneJobs;
}
/** Starts a clone job; restart first removes the interrupted clone of name. */
export async function startClone(
  name: string,
  mode: CloneMode,
  csrf: string,
  restart = false,
  signal?: AbortSignal,
): Promise<CloneJob> {
  let r: Response;
  try {
    r = await mutationFetch(
      "github.clone",
      "/api/v1/onboarding/github/clones",
      {
        method: "POST",
        ...json,
        signal,
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
          "X-Agent-Host-CSRF": csrf,
        },
        body: JSON.stringify({
          action: restart ? "restart" : "start",
          full_name: name,
          mode,
        }),
      },
    );
  } catch {
    throw new GitHubError("unavailable");
  }
  const data = await response(r, 4096);
  if (
    !cloneJobReplyValid(data) ||
    (data as { job: CloneJob }).job.full_name !== name
  )
    throw new GitHubError("unavailable");
  return (data as { job: CloneJob }).job;
}

/** Starts a clone of one repository of a Gitea or GitLab connection. The
 * daemon looks the repository up again by its id with that connection's
 * token; restart first removes the interrupted clone of that very address. */
export async function startForgeClone(
  source: ForgeCloneSource,
  csrf: string,
  restart = false,
): Promise<CloneJob> {
  let r: Response;
  try {
    r = await mutationFetch(
      "github.clone",
      "/api/v1/onboarding/github/clones",
      {
        method: "POST",
        ...json,
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
          "X-Agent-Host-CSRF": csrf,
        },
        body: JSON.stringify({
          action: restart ? "restart" : "start",
          source: source.provider,
          connection_id: source.connection_id,
          repository_id: source.repository_id,
          mode: "full",
        }),
      },
    );
  } catch {
    throw new GitHubError("unavailable");
  }
  const data = await response(r, 4096);
  const job = (data as { job?: CloneJob }).job;
  if (
    !cloneJobReplyValid(data) ||
    job?.source?.provider !== source.provider ||
    job.source.connection_id !== source.connection_id ||
    job.source.repository_id !== source.repository_id
  )
    throw new GitHubError("unavailable");
  return job;
}

async function clonePost(body: object, csrf: string): Promise<unknown> {
  let r: Response;
  try {
    r = await mutationFetch(
      "github.clone_action",
      "/api/v1/onboarding/github/clones",
      {
        method: "POST",
        ...json,
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
          "X-Agent-Host-CSRF": csrf,
        },
        body: JSON.stringify(body),
      },
    );
  } catch {
    throw new GitHubError("unavailable");
  }
  return response(r, 4096);
}
/** Stops a running job; the daemon removes the directory it created. */
export async function cancelClone(jobId: string, csrf: string) {
  const data = await clonePost({ action: "cancel", job_id: jobId }, csrf);
  if (
    !cloneJobReplyValid(data) ||
    (data as { job: CloneJob }).job.job_id !== jobId
  )
    throw new GitHubError("unavailable");
  return (data as { job: CloneJob }).job;
}
/** Forgets a finished job; nothing on disk changes. */
export async function dismissClone(jobId: string, csrf: string) {
  const data = await clonePost({ action: "dismiss", job_id: jobId }, csrf);
  if (!cloneDismissedValid(data)) throw new GitHubError("unavailable");
}
/** Removes the interrupted clone of name; partial leaves the rest to retry.
 * A Gitea or GitLab one is named by the path its own origin records. */
export async function removeInterrupted(
  name: string,
  csrf: string,
  provider?: "gitea" | "gitlab",
): Promise<"removed" | "partial"> {
  const data = await clonePost(
    provider
      ? { action: "remove", source: provider, full_name: name }
      : { action: "remove", full_name: name },
    csrf,
  );
  if (
    !cloneRemovedValid(data) ||
    (data as { full_name: string }).full_name !== name
  )
    throw new GitHubError("unavailable");
  return (data as { state: "removed" | "partial" }).state;
}

export type CloneProgress =
  | {
      schema_version: 1;
      sequence: number;
      job_id: string;
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
      job_id: string;
      kind: "terminal";
      outcome: "confirmed" | "failed" | "cancelled";
      reason?: string;
      leftover?: "removed" | "kept";
    };

/** Reads one subscription of a job. It resolves with the terminal frame, or
 * with undefined when the stream ended without one; that says nothing about
 * the job, which goes on in the daemon. */
export async function subscribeClone(
  jobId: string,
  onProgress: (frame: Extract<CloneProgress, { kind: "progress" }>) => void,
  signal?: AbortSignal,
): Promise<Extract<CloneProgress, { kind: "terminal" }> | undefined> {
  let r: Response;
  try {
    r = await fetch(
      `/api/v1/onboarding/github/clones/events?job_id=${encodeURIComponent(jobId)}`,
      { ...json, signal },
    );
  } catch {
    return undefined;
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
    bytes = 0;
  let terminal: Extract<CloneProgress, { kind: "terminal" }> | undefined;
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        return undefined; // a lost connection, not a result
      }
      const { value, done } = chunk;
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
          (frame as CloneProgress).job_id !== jobId ||
          (frame as CloneProgress).sequence !== ++sequence
        )
          throw new GitHubError("unavailable");
        const parsed = frame as CloneProgress;
        if (parsed.kind === "progress") onProgress(parsed);
        else terminal = parsed;
      }
      if (pending.length > 8192) throw new GitHubError("unavailable");
    }
    if (decoder.decode() !== "" || pending !== "")
      throw new GitHubError("unavailable");
    return terminal;
  } catch (e) {
    throw e instanceof GitHubError ? e : new GitHubError("unavailable");
  } finally {
    if (!terminal || pending !== "") await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// Starts a clone job (restart: after removing the interrupted clone of name)
// and follows it to its end, resubscribing when a stream ends without a result. Aborting stops following; the job goes on in the
// daemon. Anything but a confirmed terminal is an error.
export async function cloneStream(
  name: string,
  csrf: string,
  onProgress: (frame: CloneProgress) => void,
  signal?: AbortSignal,
  options: { mode?: CloneMode; restart?: boolean } = {},
): Promise<void> {
  const job = await startClone(
    name,
    options.mode ?? "full",
    csrf,
    options.restart ?? false,
    signal,
  );
  for (let attempt = 0; attempt < 60; attempt++) {
    if (signal?.aborted) throw new GitHubError("unavailable");
    const terminal = await subscribeClone(job.job_id, onProgress, signal);
    if (terminal) {
      if (terminal.outcome !== "confirmed")
        throw new GitHubError("unavailable");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new GitHubError("unavailable");
}
