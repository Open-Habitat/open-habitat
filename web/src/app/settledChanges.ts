import { useEffect, useRef, useState } from "react";

// A stepper's change is written a moment after its last press, so stepping
// from 12 to 20 is one write, and the view shows the stepped value until the
// host has answered. Writes go one at a time, so replies arrive in the order
// the changes were made; a reply clears a control's draft only if no newer
// press of that control came after it. Leaving the view sends what was
// stepped rather than dropping it.

const settleMs = 500;

export function useSettledChanges<V>(
  /** Writes one change and applies the host's reply; never rejects. */
  send: (key: string, value: V) => Promise<void>,
) {
  const [draft, setDraft] = useState<Record<string, V>>({});
  const [writing, setWriting] = useState(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pending = useRef(new Map<string, () => void>());
  const revisions = useRef(new Map<string, number>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef(send);
  latest.current = send;
  useEffect(() => {
    const waiting = timers.current;
    const writes = pending.current;
    return () => {
      for (const timer of waiting.values()) clearTimeout(timer);
      for (const write of writes.values()) write();
    };
  }, []);
  const write = (key: string, value: V, revision: number) => {
    pending.current.delete(key);
    setWriting((n) => n + 1);
    queue.current = queue.current
      .then(() => latest.current(key, value))
      .catch(() => {})
      .then(() =>
        setDraft((old) => {
          if (revisions.current.get(key) !== revision || !(key in old))
            return old;
          const { [key]: _, ...rest } = old;
          return rest;
        }),
      )
      .finally(() => setWriting((n) => n - 1));
  };
  const change = (key: string, value: V) => {
    const revision = (revisions.current.get(key) ?? 0) + 1;
    revisions.current.set(key, revision);
    setDraft((old) => ({ ...old, [key]: value }));
    const waiting = timers.current.get(key);
    if (waiting) clearTimeout(waiting);
    pending.current.set(key, () => write(key, value, revision));
    timers.current.set(
      key,
      setTimeout(() => {
        timers.current.delete(key);
        write(key, value, revision);
      }, settleMs),
    );
  };
  return { draft, change, writing: writing > 0 };
}
