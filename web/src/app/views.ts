// Agent HTML views (ADR 0032): the app reads the person's views and mints the
// one-time URL that opens one view on its own host. The content itself never
// runs on this origin; the app only frames or links to the view host.
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import common from "../../../contracts/v1/common.schema.json";
import viewSchema from "../../../contracts/v1/view.schema.json";
import type { ViewSummary } from "../components/ViewOffer";
import { mutationFetch } from "./mutations";

const ajv = new Ajv({ strict: false });
addFormats(ajv);
ajv.addSchema(common);
ajv.addSchema(viewSchema);
const validList = ajv.getSchema(`${viewSchema.$id}#/$defs/list`);
const validHandoff = ajv.getSchema(`${viewSchema.$id}#/$defs/handoff`);

export const viewIdPattern = /^v[a-z2-7]{26}$/;
const limit = 256 << 10;

async function boundedJSON(response: Response, max: number): Promise<unknown> {
  if (
    response.headers.get("content-type")?.split(";")[0] !== "application/json"
  )
    throw new Error("unexpected view reply");
  const text = await response.text();
  if (text.length > max) throw new Error("unexpected view reply");
  return JSON.parse(text);
}

/** The person's views, newest first; null when the installation has no view
 * origin (an empty 204), which means views are not offered at all. */
export async function listViews(
  signal?: AbortSignal,
): Promise<ViewSummary[] | null> {
  const response = await fetch("/api/v1/views", {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (response.status === 204) return null;
  if (!response.ok) throw new Error("views unavailable");
  const value = await boundedJSON(response, limit);
  if (!validList?.(value)) throw new Error("unexpected view reply");
  return (value as { views: ViewSummary[] }).views;
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
  if (!validHandoff?.(value)) throw new Error("unexpected view reply");
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
