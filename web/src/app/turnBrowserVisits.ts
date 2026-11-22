import type { ToolStep } from "./turnChanges";

export type VisitPage = {
  origin: string;
  path: string;
  title: string;
};
type Timed = { callId: string; at?: number };
export type BrowserVisitSummary = {
  sites: string[];
  pageCount: number;
  downloadCount: number;
  actionCount: number;
  startedAt?: number;
  endedAt?: number;
};
export type BrowserVisitDetail = {
  pages: (VisitPage & Timed)[];
  downloads: (Timed & { fileName: string; targetFolder: string })[];
  actions: (Timed & {
    kind: "click" | "type" | "eval";
    page?: VisitPage;
    selector?: string;
  })[];
};
export type BrowserVisits = {
  summary: BrowserVisitSummary;
  /** No detail property at all for participants. This is a presentation API,
   * not authorization to fetch the owner's native history. */
  detail?: BrowserVisitDetail;
  coverage: "command-results-only";
};

const object = (v: unknown): Record<string, unknown> | undefined =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;

function page(url: unknown, title: unknown): VisitPage | undefined {
  if (typeof url !== "string" || typeof title !== "string") return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return;
    // URL.origin excludes userinfo as well as query and fragment.
    return { origin: parsed.origin, path: parsed.pathname, title };
  } catch {
    return;
  }
}

/** A bash call may print several pretty-printed CLI envelopes. Accept only
 * whole JSON documents, never braces extracted from logs, scripts or prose.
 * Truncated/mixed output cannot establish a completed command. */
function documents(text: string): unknown[] {
  const values: unknown[] = [];
  let start = 0;
  while (start < text.length) {
    while (/\s/.test(text[start] ?? "") && start < text.length) start++;
    if (start === text.length) break;
    if (text[start] !== "{") return [];
    let depth = 0;
    let quoted = false;
    let escaped = false;
    let end = start;
    for (; end < text.length; end++) {
      const char = text[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === "{") depth++;
      else if (char === "}" && --depth === 0) break;
    }
    if (depth !== 0 || quoted) return [];
    try {
      values.push(JSON.parse(text.slice(start, end + 1)));
    } catch {
      return [];
    }
    start = end + 1;
  }
  return values;
}

const withoutFragment = (url: unknown) =>
  typeof url === "string" ? url.replace(/#.*$/s, "") : url;

/** One turn, in native tool-call order, with full saved outputs (not history
 * previews). Like turnChanges this is a pure derivation of ToolSteps; it reads
 * no browser state and keeps no history store. Repeated goto calls count as
 * visits; clicks count when their before/after URLs differ beyond a fragment.
 * Query changes count; anchors and hash-only app routes remain actions only.
 * Other commands supply context but do not manufacture page visits. */
export function turnBrowserVisits(
  steps: readonly ToolStep[],
  audience: "owner" | "participant",
): BrowserVisits | undefined {
  const detail: BrowserVisitDetail = { pages: [], downloads: [], actions: [] };
  const sites = new Set<string>();
  const times: number[] = [];
  const seen = new Set<string>();
  let observed = false;
  for (const step of steps) {
    if (
      step.tool !== "bash" ||
      step.failed ||
      !step.output ||
      seen.has(step.callId)
    )
      continue;
    seen.add(step.callId);
    for (const doc of documents(step.output)) {
      const envelope = object(doc);
      const data = object(envelope?.data);
      const result = object(data?.result);
      if (
        envelope?.schema_version !== 1 ||
        typeof data?.cli_version !== "string" ||
        !result ||
        typeof result.tab !== "string"
      )
        continue;
      const kind = result.browser_action;
      if (
        typeof kind !== "string" ||
        ![
          "goto",
          "click",
          "type",
          "eval",
          "download",
          "text",
          "links",
          "screenshot",
          "close",
        ].includes(kind)
      )
        continue;
      observed = true;
      const at =
        typeof step.at === "number" && Number.isFinite(step.at)
          ? step.at
          : undefined;
      if (at !== undefined) times.push(at);
      const timed = { callId: step.callId, at };
      const after = page(result.url, result.title);
      const before = page(result.source_url, result.source_title);
      if (after) sites.add(after.origin);
      if (before) sites.add(before.origin);
      if (
        after &&
        (kind === "goto" ||
          (kind === "click" &&
            before &&
            withoutFragment(result.source_url) !== withoutFragment(result.url)))
      ) {
        detail.pages.push({ ...timed, ...after });
      }
      if (
        kind === "download" &&
        typeof result.file_name === "string" &&
        typeof result.target_folder === "string"
      ) {
        detail.downloads.push({
          ...timed,
          fileName: result.file_name,
          targetFolder: result.target_folder,
        });
      }
      if (kind === "click" || kind === "type" || kind === "eval") {
        detail.actions.push({
          ...timed,
          kind,
          page: before ?? after,
          ...(kind !== "eval" && typeof result.selector === "string"
            ? { selector: result.selector }
            : {}),
        });
      }
    }
  }
  if (!observed) return;
  return {
    summary: {
      sites: [...sites],
      pageCount: detail.pages.length,
      downloadCount: detail.downloads.length,
      actionCount: detail.actions.length,
      startedAt: times.length ? Math.min(...times) : undefined,
      endedAt: times.length ? Math.max(...times) : undefined,
    },
    ...(audience === "owner" ? { detail } : {}),
    coverage: "command-results-only",
  };
}
