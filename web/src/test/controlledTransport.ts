// Requests and events share a stepped queue; the test chooses delivery order.
// No sleeps or fake network: await deliver() to drain the promise consumers.
export function controlledTransport() {
  const pending = new Map<string, () => void>();
  function enqueue(key: string, deliver: () => void) {
    if (pending.has(key)) throw new Error(`Duplicate delivery: ${key}`);
    pending.set(key, deliver);
  }
  return {
    reply<T>(key: string, value: T): Promise<T> {
      return new Promise((resolve) => enqueue(key, () => resolve(value)));
    },
    event: enqueue,
    async deliver(key: string) {
      const step = pending.get(key);
      if (!step) throw new Error(`Unknown delivery: ${key}`);
      pending.delete(key);
      step();
      await Promise.resolve();
    },
    assertDrained() {
      if (pending.size) throw new Error(`Undelivered: ${[...pending.keys()]}`);
    },
  };
}
