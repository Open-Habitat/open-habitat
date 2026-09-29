import Ajv from "ajv/dist/2020.js";
import reposSchema from "../../../contracts/v1/github-repos.schema.json";
import cloneSchema from "../../../contracts/v1/github-clone.schema.json";
import checkoutSchema from "../../../contracts/v1/github-checkout.schema.json";

const ajv = new Ajv({ strict: false });
const reposValid = ajv.compile(reposSchema);
const cloneValid = ajv.compile(cloneSchema);
const checkoutValid = ajv.compile(checkoutSchema);
export type Repo = {
  full_name: string;
  private: boolean;
  description: string;
  html_url: string;
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
  if (r.status === 409) throw new GitHubError("auth");
  if (!r.ok) throw new GitHubError("unavailable");
  return bounded(r, max);
}
export async function catalog(
  page: number,
  signal?: AbortSignal,
): Promise<Page> {
  const data = await response(
    await fetch(`/api/v1/onboarding/github/repos?page=${page}&limit=2`, {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    }),
    60000,
  );
  if (
    !reposValid(data) ||
    (data as Page).page !== page ||
    (data as Page).limit !== 2
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
