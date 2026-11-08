/** The named workers' round reports this browser has shown the person, as
 * the rounds each worker had reported when its view was last opened. Like
 * the seen replies it lives in the browser (proto-named-workers: an unseen
 * report is browser state per person, not a host fact), so a report is
 * marked once on each device. */
const key = "oh.helpers.seen";
const maxSeen = 200;

function storage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readHelpersSeen(): Map<string, number> {
  try {
    const raw = storage()?.getItem(key);
    const value: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(value)) return new Map();
    return new Map(
      value.filter(
        (pair): pair is [string, number] =>
          Array.isArray(pair) &&
          typeof pair[0] === "string" &&
          Number.isInteger(pair[1]),
      ),
    );
  } catch {
    return new Map();
  }
}

/** Records that the person has seen the run's rounds up to this one. */
export function writeHelperSeen(run: string, rounds: number) {
  const seen = readHelpersSeen();
  if ((seen.get(run) ?? 0) >= rounds) return seen;
  seen.delete(run);
  seen.set(run, rounds);
  try {
    storage()?.setItem(key, JSON.stringify([...seen].slice(-maxSeen)));
  } catch {
    // A full or blocked storage only shows the report as new again.
  }
  return seen;
}
