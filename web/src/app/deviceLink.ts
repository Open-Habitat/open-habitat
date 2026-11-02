import session from "../../../contracts/v1/account-session.schema.json";
import schema from "../../../contracts/v1/device-link.schema.json";
import { liveText } from "../i18n";
import { devicesText } from "../text/devices";
import { LazyAjv } from "./lazyAjv";
import type { AccountProfile } from "./pi";

const txt = liveText(devicesText);

// Phone sign-in by QR and the session list (ADR 0018). The gateway owns the
// code's life; the browser only shows what it reports.
const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(session);
ajv.addSchema(schema);
const part = (name: string) => ajv.getSchema(`${schema.$id}#/$defs/${name}`);
const validMint = part("mintReply");
const validStatus = part("statusReply");
const validDescribe = part("describeReply");
const validList = part("sessionList");

export type BrowserSession = {
  id: string;
  method: "github" | "link";
  device: string;
  device_kind: "phone" | "computer";
  created_at: string;
  current: boolean;
};
export type LinkStatus = {
  state: "none" | "pending" | "used" | "expired" | "failed";
  expires_in_seconds?: number;
  session?: BrowserSession;
};

async function read<T>(
  r: Response,
  valid: (data: unknown) => boolean,
): Promise<T> {
  if (!r.ok) throw new Error(String(r.status));
  const data: unknown = await r.json();
  if (!valid(data)) throw new Error("contract");
  return data as T;
}
const write = (csrf: string, body?: unknown): RequestInit => ({
  method: "POST",
  credentials: "same-origin",
  cache: "no-store",
  headers: {
    "X-Agent-Host-CSRF": csrf,
    ...(body ? { "Content-Type": "application/json" } : {}),
  },
  body: body ? JSON.stringify(body) : undefined,
});

export async function mintLink(
  csrf: string,
): Promise<{ token: string; expires_in_seconds: number }> {
  return read(await fetch("/auth/link", write(csrf)), validMint);
}
export async function cancelLink(csrf: string): Promise<void> {
  await fetch("/auth/link/cancel", write(csrf));
}
export async function linkStatus(signal?: AbortSignal): Promise<LinkStatus> {
  return read(
    await fetch("/auth/link", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    }),
    validStatus,
  );
}
export async function listSessions(
  signal?: AbortSignal,
): Promise<BrowserSession[]> {
  const data = await read<{ sessions: BrowserSession[] }>(
    await fetch("/auth/sessions", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    }),
    validList,
  );
  return data.sessions;
}
export async function endSession(csrf: string, id: string): Promise<void> {
  const r = await fetch("/auth/sessions/end", write(csrf, { id }));
  // Already gone counts as done.
  if (!r.ok && r.status !== 404) throw new Error(String(r.status));
}

// The phone has no session and so no CSRF secret; the gateway checks Origin.
const anonymous = (token: string): RequestInit => ({
  method: "POST",
  credentials: "same-origin",
  cache: "no-store",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token }),
});
export async function describeLink(token: string): Promise<AccountProfile> {
  const data = await read<{ profile: AccountProfile }>(
    await fetch("/auth/link/describe", anonymous(token)),
    validDescribe,
  );
  return data.profile;
}
export async function redeemLink(token: string): Promise<void> {
  const r = await fetch("/auth/link/redeem", anonymous(token));
  if (r.status !== 204) throw new Error(String(r.status));
}

/** The QR carries the token in the fragment, which browsers never send. */
export const linkURL = (token: string) =>
  `${window.location.origin}/link#${token}`;

export const countdown = (seconds: number) =>
  `${Math.floor(seconds / 60)}.${String(seconds % 60).padStart(2, "0")}`;

export function signedInAt(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const time = txt.at(at.getHours(), String(at.getMinutes()).padStart(2, "0"));
  if (at.toDateString() === now.toDateString()) return txt.today(time);
  const year =
    at.getFullYear() === now.getFullYear() ? "" : String(at.getFullYear());
  return `${at.getDate()}.${at.getMonth() + 1}.${year} ${time}`;
}
export const deviceName = (s: Pick<BrowserSession, "device">) =>
  s.device || txt.unknownBrowser;
