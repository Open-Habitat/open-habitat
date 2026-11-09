// Agent HTML views (ADR 0032): the app reads the person's views and mints the
// one-time URL that opens one view on its own host. The content itself never
// runs on this origin; the app only frames or links to the view host.

import common from "../../../contracts/v1/common.schema.json";
import viewSchema from "../../../contracts/v1/view.schema.json";
import type { ViewSummary } from "../components/ViewOffer";
import { LazyAjv } from "./lazyAjv";
import { mutationFetch } from "./mutations";

const ajv = new LazyAjv({ strict: false, addFormats: true });
ajv.addSchema(common);
ajv.addSchema(viewSchema);
const validList = ajv.getSchema(`${viewSchema.$id}#/$defs/list`);
const validHandoff = ajv.getSchema(`${viewSchema.$id}#/$defs/handoff`);

export const viewIdPattern = /^v[a-z2-7]{26}$/;
// A page holds at most 100 views, each with its title, entry and source.
const limit = 1 << 20;

async function boundedJSON(response: Response, max: number): Promise<unknown> {
  if (
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("unexpected view reply");
  const text = await response.text();
  if (text.length > max) throw new Error("unexpected view reply");
  return JSON.parse(text);
}

export type ViewPage = { views: ViewSummary[]; next?: string };

/** One page of the person's views, or of one conversation's, newest first;
 * null when the installation has no view origin (an empty 204), which means
 * views are not offered at all. */
export async function listViews(
  signal?: AbortSignal,
  query: { conversationId?: string; cursor?: string } = {},
): Promise<ViewPage | null> {
  const params = new URLSearchParams();
  if (query.conversationId) params.set("conversation_id", query.conversationId);
  if (query.cursor) params.set("cursor", query.cursor);
  const search = params.toString() ? `?${params}` : "";
  const response = await fetch(`/api/v1/views${search}`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error("views unavailable");
  const value = await boundedJSON(response, limit);
  if (!validList(value)) throw new Error("unexpected view reply");
  const page = value as { views: ViewSummary[]; next_cursor?: string };
  return { views: page.views, next: page.next_cursor };
}

// A read follows the pages to the end. A cursor seen before would start
// the same pages again, so it ends the read instead of looping.
function fresh(seen: Set<string>, cursor: string | undefined) {
  if (!cursor || seen.has(cursor)) return false;
  seen.add(cursor);
  return true;
}

/** Every view of one conversation, newest first, read page by page; null
 * where the installation offers no views. */
export async function conversationViews(
  conversationId: string,
  signal?: AbortSignal,
): Promise<ViewSummary[] | null> {
  const views: ViewSummary[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await listViews(signal, { conversationId, cursor });
    if (!page) return null;
    views.push(...page.views);
    cursor = page.next;
  } while (fresh(seen, cursor));
  return views;
}

/** One of the person's views, looked up page by page. */
export async function findView(
  viewId: string,
  signal?: AbortSignal,
): Promise<ViewSummary | undefined> {
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await listViews(signal, { cursor });
    const found = page?.views.find((v) => v.view_id === viewId);
    if (found || !page) return found;
    cursor = page.next;
  } while (fresh(seen, cursor));
  return undefined;
}

/** A one-minute, single-use URL that opens the view on its own host. */
export async function mintViewURL(
  csrf: string,
  viewId: string,
): Promise<string> {
  if (!viewIdPattern.test(viewId)) throw new Error("invalid view");
  const response = await mutationFetch("view.handoff", "/auth/view", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "X-Agent-Host-CSRF": csrf },
    body: JSON.stringify({ view_id: viewId }),
  });
  if (!response.ok) throw new Error("view hand-off refused");
  const value = await boundedJSON(response, 4096);
  if (!validHandoff(value)) throw new Error("unexpected view reply");
  const url = new URL((value as { url: string }).url);
  // A view never opens on the app's own host.
  if (url.protocol !== "https:" || url.host === window.location.host)
    throw new Error("unexpected view reply");
  return url.href;
}

/** The app page that opens one view in a tab of its own (`/view?id=…`). It is
 * opened with noopener from the card, then mints and replaces itself. */
export function viewTabPath(viewId: string): string {
  return `/view?id=${encodeURIComponent(viewId)}`;
}

/** The view's frozen files as one zip, for the person's own session. */
export function viewZipURL(viewId: string): string {
  return `/api/v1/views/${encodeURIComponent(viewId)}/zip`;
}
