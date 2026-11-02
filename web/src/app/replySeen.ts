/** The finished replies this browser has shown the person, by conversation,
 * per web identity. A turn's live event reaches only the tabs that are
 * connected when it settles; the snapshot's last_reply tells every tab,
 * including one opened or reconnected later, and this record says which of
 * those replies the person has already seen here. Like the account keys'
 * seen marks it lives in the browser: the host keeps no read state, and a
 * reply is marked once on each device. */
const prefix = "oh.replies.seen.";
const maxSeen = 2000;

export interface RepliesSeen {
  /** Replies at or before this host time (Unix ms) were there before this
   * browser first looked, and count as seen. */
  horizon: number;
  /** The newest seen reply's native entry ID, by conversation. */
  seen: Map<string, string>;
}

function storageOf(storage?: Storage) {
  try {
    return storage ?? window.localStorage;
  } catch {
    return undefined;
  }
}

export function readRepliesSeen(
  identity: string,
  storage?: Storage,
): RepliesSeen | undefined {
  try {
    const raw = storageOf(storage)?.getItem(prefix + identity);
    if (raw === null || raw === undefined) return undefined;
    const value = JSON.parse(raw) as { horizon?: unknown; seen?: unknown };
    if (typeof value.horizon !== "number" || !Array.isArray(value.seen))
      return undefined;
    return {
      horizon: value.horizon,
      seen: new Map(
        value.seen.filter(
          (pair): pair is [string, string] =>
            Array.isArray(pair) &&
            typeof pair[0] === "string" &&
            typeof pair[1] === "string",
        ),
      ),
    };
  } catch {
    return undefined;
  }
}

export function writeRepliesSeen(
  identity: string,
  value: RepliesSeen,
  storage?: Storage,
) {
  try {
    storageOf(storage)?.setItem(
      prefix + identity,
      JSON.stringify({
        horizon: value.horizon,
        seen: [...value.seen].slice(-maxSeen),
      }),
    );
  } catch {
    // Storage may be full or refused; the reply then asks again after a reload.
  }
}

/** The key of a storage event that changes this identity's record. */
export function repliesSeenKey(identity: string) {
  return prefix + identity;
}
