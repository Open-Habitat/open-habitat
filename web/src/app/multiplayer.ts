// Other people in a person's conversation (ADR 0038), the browser's half.
// The owner reads their membership record, the invite picker and the
// conversation's shared facts from their own daemon; a participant reads
// one share through the gateway's /api/v1/shared/<share_id>/ routes, which
// reach the owner's guest socket. The browser decides nothing here: who may
// do what, a turn's mode, waiting requests and presence are the daemon's
// facts, validated against contracts/v1 before anything is shown.

import agentSection from "../../../contracts/v1/agent-section.schema.json";
import agentWake from "../../../contracts/v1/agent-wake.schema.json";
import annotations from "../../../contracts/v1/annotations.schema.json";
import command from "../../../contracts/v1/command.schema.json";
import common from "../../../contracts/v1/common.schema.json";
import guestSchema from "../../../contracts/v1/conversation-guest.schema.json";
import membersSchema from "../../../contracts/v1/conversation-members.schema.json";
import sharesSchema from "../../../contracts/v1/conversation-shares.schema.json";
import editorSchema from "../../../contracts/v1/editor.schema.json";
import eventSchema from "../../../contracts/v1/event.schema.json";
import fileOfferSchema from "../../../contracts/v1/file-offer.schema.json";
import historySchema from "../../../contracts/v1/history.schema.json";
import noticeSchema from "../../../contracts/v1/notice.schema.json";
import operation from "../../../contracts/v1/operation.schema.json";
import processEventSchema from "../../../contracts/v1/process-event.schema.json";
import snapshotSchema from "../../../contracts/v1/snapshot.schema.json";
import turnMark from "../../../contracts/v1/turn-mark.schema.json";
import viewSchema from "../../../contracts/v1/view.schema.json";
import workspaceChangeSchema from "../../../contracts/v1/workspace-change.schema.json";
import { LazyAjv } from "./lazyAjv";
import {
  jsonWrite,
  type MutationCommand,
  mutationFetch,
  type WriteOutcome,
  writeOutcome,
} from "./mutations";
import { readJSON } from "./readJSON";

const ajv = new LazyAjv({ strict: false, addFormats: true });
for (const schema of [
  common,
  annotations,
  command,
  operation,
  snapshotSchema,
  turnMark,
  agentSection,
  agentWake,
  workspaceChangeSchema,
  processEventSchema,
  noticeSchema,
  viewSchema,
  fileOfferSchema,
  editorSchema,
  historySchema,
  sharesSchema,
  membersSchema,
  eventSchema,
  guestSchema,
])
  ajv.addSchema(schema);
const check = (ref: string) => ajv.getSchema(ref);
const validMembers = check(membersSchema.$id);
const validPeople = check(`${membersSchema.$id}#/$defs/people`);
const validOwnerShared = check(`${guestSchema.$id}#/$defs/ownerShared`);
const validShares = check(sharesSchema.$id);
const validInvite = check(`${guestSchema.$id}#/$defs/invite`);
const validState = check(guestSchema.$id);
const validHistory = check(`${historySchema.$id}#/$defs/historyPage`);

export type Role = "participant" | "full_rights";
export type Member = {
  subject: string;
  display_name: string;
  role: Role;
  state: "invited" | "joined";
  generation: number;
  invited_at: string;
  updated_at: string;
};
export type Members = {
  agent_id: string;
  generation: number;
  members: Member[];
  revocation?: "delivered" | "not_running" | "failed";
};
export type Person = {
  subject: string;
  display_name: string;
  avatar_url: string;
  membership: "none" | "invited" | "joined";
};
export type Present = {
  subject: string;
  display_name: string;
  avatar_url: string;
  typing: boolean;
};
export type Turn = {
  mode: "tools" | "text_only" | "approve_each";
  by:
    | "owner"
    | "participant"
    | "continue"
    | "kept"
    | "revoked"
    | "approved_all";
  subject?: string;
  display_name?: string;
  request?: string;
};
export type WaitingRequest = {
  request: string;
  subject: string;
  display_name: string;
  entry_key: string;
};
export type Release = {
  request: string;
  subject: string;
  display_name: string;
  kind: "continue" | "declined";
  mode?: "tools" | "approve_each";
  approvals: {
    call_id: string;
    tool: string;
    answer: "allowed" | "denied" | "allow_all" | "cancelled";
  }[];
};
export type OwnerShared = {
  agent_id: string;
  turn: Turn | null;
  waiting_requests: WaitingRequest[];
  release: Release | null;
  present: Present[];
};
export type Share = {
  share_id: string;
  owner: { display_name: string; avatar_url: string };
  state: "invited" | "joined";
  invited_at: string;
};
export type Invite = {
  title: string;
  role: Role;
  state: "invited" | "joined";
};
export type GuestState = {
  agent_id: string;
  title: string;
  workspace_name: string;
  you: { subject: string; role: Role };
  run: {
    state: "running" | "idle" | "starting" | "stopping" | "stopped";
    aborting: boolean;
  };
  turn: Turn | null;
  waiting_requests: WaitingRequest[];
  release: Release | null;
  pending_question: { question_kind: string } | null;
  held: {
    message_id: string;
    text: string;
    at: string;
    state: "held" | "delivering";
  }[];
  members: { subject: string; display_name: string; role: Role }[];
  present: Present[];
  journal_cursor: string;
  live_tail: unknown[];
};

/** A read the person cannot act on: the share or the conversation is not
 * there for them (removed, archived, owner withdrawn), or the host is not. */
export class Unavailable extends Error {
  constructor(readonly reason: "gone" | "host" | "login") {
    super(reason);
  }
}

async function read<T>(
  url: string,
  valid: ((v: unknown) => boolean) | undefined,
  limit = 1 << 20,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Unavailable("host");
  }
  if (response.status === 401) throw new Unavailable("login");
  if (response.status === 404) throw new Unavailable("gone");
  if (!response.ok) throw new Unavailable("host");
  const value = await readJSON(response, limit).catch(() => {
    throw new Unavailable("host");
  });
  if (!valid?.(value)) throw new Unavailable("host");
  return value as T;
}

/** The owner's routes take the conversation's bare session ID. */
const own = (id: string) =>
  `/api/v1/conversations/${encodeURIComponent(id.replace(/^pi:/, ""))}`;
const shared = (share: string) => `/api/v1/shared/${encodeURIComponent(share)}`;

// The owner's reads, on their own session.
export const readMembers = (id: string, signal?: AbortSignal) =>
  read<Members>(`${own(id)}/members`, validMembers, 64 << 10, signal);
export const readPeople = (id: string, signal?: AbortSignal) =>
  read<{ people: Person[] }>(
    `${own(id)}/people`,
    validPeople,
    512 << 10,
    signal,
  );
export const readOwnerShared = (id: string, signal?: AbortSignal) =>
  read<OwnerShared>(`${own(id)}/shared`, validOwnerShared, 4 << 20, signal);

/** The owner's change to the record. The gateway rebuilds the body; for an
 * invitation it adds the person's name itself. */
export async function controlMember(
  id: string,
  action: "invite" | "full_rights" | "take_back" | "remove",
  subject: string,
  csrf: string,
): Promise<{ outcome: WriteOutcome; members?: Members }> {
  const outcome = await writeOutcome(
    await jsonWrite(
      "conversation.members",
      `${own(id)}/members`,
      { action, subject },
      csrf,
    ).catch(() => undefined),
  );
  if (outcome.kind !== "ok") return { outcome };
  const value = await readJSON(outcome.response, 64 << 10).catch(() => null);
  return validMembers(value)
    ? { outcome, members: value as Members }
    : { outcome: { kind: "uncertain" } };
}

/** The owner's answer on a waiting request's card. */
export async function releaseRequest(
  id: string,
  request: WaitingRequest,
  action: "allow_all" | "approve_each" | "decline",
  csrf: string,
): Promise<WriteOutcome> {
  return writeOutcome(
    await jsonWrite(
      "conversation.release",
      `${own(id)}/requests`,
      { request: request.request, subject: request.subject, action },
      csrf,
    ).catch(() => undefined),
  );
}

// The participant's reads and writes, through one share.
export const readShares = (signal?: AbortSignal) =>
  read<{ shares: Share[] }>("/api/v1/shared", validShares, 4 << 20, signal);
export const readInvite = (share: string, signal?: AbortSignal) =>
  read<Invite>(`${shared(share)}/invite`, validInvite, 64 << 10, signal);
export const readGuestState = (share: string, signal?: AbortSignal) =>
  read<GuestState>(`${shared(share)}/state`, validState, 4 << 20, signal);
export const readGuestHistory = (
  share: string,
  signal?: AbortSignal,
  before?: string,
) =>
  read<import("./history").HistoryPage>(
    `${shared(share)}/history?${new URLSearchParams({ messages: "100", ...(before ? { before } : {}) })}`,
    validHistory,
    4 << 20,
    signal,
  );
export const guestEventsURL = (share: string, after: string) =>
  `${shared(share)}/events?${new URLSearchParams({ after })}`;

/** A write without a body: the gateway refuses one on join and abort. */
const bare = async (command: MutationCommand, url: string, csrf: string) =>
  writeOutcome(
    await mutationFetch(command, url, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "X-Agent-Host-CSRF": csrf, Origin: window.location.origin },
    }).catch(() => undefined),
  );
export const joinShare = (share: string, csrf: string) =>
  bare("shared.join", `${shared(share)}/join`, csrf);
export const sendGuest = async (share: string, text: string, csrf: string) =>
  writeOutcome(
    await jsonWrite(
      "shared.send",
      `${shared(share)}/send`,
      { text },
      csrf,
    ).catch(() => undefined),
  );
export const cancelGuest = async (
  share: string,
  messageId: string,
  csrf: string,
) =>
  writeOutcome(
    await jsonWrite(
      "shared.cancel",
      `${shared(share)}/cancel`,
      { message_id: messageId },
      csrf,
    ).catch(() => undefined),
  );
export const abortGuest = (share: string, csrf: string) =>
  bare("shared.abort", `${shared(share)}/abort`, csrf);
export const presenceGuest = async (
  share: string,
  state: "present" | "typing" | "left",
  csrf: string,
) =>
  writeOutcome(
    await jsonWrite(
      "shared.presence",
      `${shared(share)}/presence`,
      { state },
      csrf,
      // A tab that closes still says it left.
      state === "left" ? { keepalive: true } : {},
    ).catch(() => undefined),
  );

/** One colour of the per-person family (--ah-glyph-1…7) for a subject, the
 * same in every view and theme: a ring and an edge, never a fill, so text
 * keeps its contrast. */
export function personHue(subject: string): string {
  let h = 0;
  for (const c of subject) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `var(--ah-glyph-${(h % 7) + 1})`;
}

/** The two letters an avatar shows when it has no picture. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? "?") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
}
