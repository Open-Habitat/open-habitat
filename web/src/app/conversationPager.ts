import { type HistoryPage, readHistory } from "./history";

/** Messages per page: the person's prompts and the agent's visible replies.
 * Tool steps between them come along without counting, so even a tool-heavy
 * conversation opens with a long stretch of readable history. The daemon
 * still bounds a page by entries and bytes. */
export const historyPageMessages = 100;

/** Network-only pager. The consumer owns the contiguous window and scroll position. */
export class ConversationPager {
  private readonly pending = new Map<AbortController, string>();

  private async page(
    id: string,
    before: string | undefined,
    signal?: AbortSignal,
  ): Promise<HistoryPage> {
    const controller = new AbortController();
    this.pending.set(controller, id);
    const combined = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;
    try {
      const query = new URLSearchParams({
        messages: String(historyPageMessages),
      });
      if (before !== undefined) query.set("before", before);
      const response = await fetch(
        `/api/v1/agents/${encodeURIComponent(id).replace("%3A", ":")}/history?${query}`,
        {
          credentials: "same-origin",
          cache: "no-store",
          signal: combined,
        },
      );
      if (response.status === 404) throw new Error("history_missing");
      const value = await readHistory(response);
      if (
        !("entries" in value) ||
        value.agent_id !== id ||
        typeof value.older_complete !== "boolean" ||
        typeof value.boundary_found !== "boolean" ||
        (!value.boundary_found &&
          (value.entries.length !== 0 || before === undefined)) ||
        (value.boundary_found && !value.older_complete && !value.next_before) ||
        (before !== undefined &&
          value.boundary_found &&
          !value.entries.some((e) => e.entry_key === before))
      )
        throw new Error("invalid page");
      return value;
    } finally {
      this.pending.delete(controller);
    }
  }

  tail(id: string, signal?: AbortSignal): Promise<HistoryPage> {
    return this.page(id, undefined, signal);
  }

  /** A lost boundary never authorizes joining disjoint pages: reload the tail. */
  async older(
    id: string,
    cursor: string,
    signal?: AbortSignal,
  ): Promise<HistoryPage> {
    const page = await this.page(id, cursor, signal);
    return page.boundary_found ? page : this.tail(id, signal);
  }

  /** Pages are newest first. A shared key is only a witness, not a merge operation. */
  async reconnect(
    id: string,
    heldKeys: ReadonlySet<string>,
    maxPages: number,
    signal?: AbortSignal,
  ): Promise<{ pages: HistoryPage[]; met: boolean }> {
    if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 100)
      throw new Error("invalid page bound");
    const pages: HistoryPage[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < maxPages; i++) {
      const page = await this.page(id, cursor, signal);
      if (!page.boundary_found)
        return { pages: [await this.tail(id, signal)], met: false };
      pages.push(page);
      if (page.entries.some((e) => heldKeys.has(e.entry_key)))
        return { pages, met: true };
      if (
        page.older_complete ||
        !page.next_before ||
        page.next_before === cursor
      )
        break;
      cursor = page.next_before;
    }
    return { pages, met: false };
  }

  /** Aborts every read in flight except those for the conversations in `keep`. */
  cancelAll(keep?: ReadonlySet<string>): void {
    for (const [controller, id] of this.pending) {
      if (keep?.has(id)) continue;
      controller.abort();
      this.pending.delete(controller);
    }
  }
}

export const conversationPager = new ConversationPager();
