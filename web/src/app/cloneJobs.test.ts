import { afterEach, expect, it, vi } from "vitest";
import { CloneJobs } from "./cloneJobs";

afterEach(() => {
  vi.unstubAllGlobals();
});
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
const id = "0123456789abcdef0123456789abcdef";
const failed = {
  job_id: id,
  full_name: "owner/repo",
  mode: "full",
  state: "failed",
  reason: "native_failure",
  leftover: "removed",
  started_at: "2026-10-17T12:00:00Z",
  finished_at: "2026-10-17T12:01:00Z",
};
const list = (jobs: unknown[]) =>
  json({
    schema_version: 1,
    jobs,
    interrupted: [],
    interrupted_complete: true,
  });

// A dismiss that lands while an older list read is still on its way must not
// be undone by that read: the store reads once more after it.
it("reads the list again when a write finishes during a read", async () => {
  let releaseFirst!: () => void;
  const firstHeld = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let reads = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST")
        return json({ schema_version: 1, state: "dismissed", job_id: id });
      reads++;
      if (reads === 1) {
        await firstHeld;
        return list([failed]); // read before the dismiss reached the daemon
      }
      return list([]);
    }),
  );
  const store = new CloneJobs();
  const first = store.refresh();
  const dismissed = store.dismiss(id, "csrf");
  releaseFirst();
  await first;
  await dismissed;
  await vi.waitFor(() => expect(reads).toBe(2));
  await vi.waitFor(() => expect(store.get().jobs).toEqual([]));
  store.dispose();
});

it("follows a running job and reports its confirmation once", async () => {
  const running = {
    job_id: id,
    full_name: "owner/repo",
    mode: "full",
    state: "running",
    stage: "receiving",
    started_at: "2026-10-17T12:00:00Z",
  };
  let reads = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/clones/events"))
        return new Response(
          `event: progress\ndata: {"schema_version":1,"sequence":1,"job_id":"${id}","kind":"progress","stage":"receiving","percent":40}\n\nevent: terminal\ndata: {"schema_version":1,"sequence":2,"job_id":"${id}","kind":"terminal","outcome":"confirmed"}\n\n`,
          {
            status: 200,
            headers: { "content-type": "text/event-stream; charset=utf-8" },
          },
        );
      reads++;
      return list(
        reads === 1
          ? [running]
          : [
              {
                ...running,
                state: "confirmed",
                stage: undefined,
                finished_at: "2026-10-17T12:02:00Z",
              },
            ],
      );
    }),
  );
  const confirmed = vi.fn();
  const store = new CloneJobs(confirmed);
  await store.refresh();
  await vi.waitFor(() => expect(store.get().jobs[0]?.state).toBe("confirmed"));
  expect(confirmed).toHaveBeenCalledTimes(1);
  store.dispose();
});

it("keeps a dismissal when the read after it fails", async () => {
  let releaseFirst!: () => void;
  const firstHeld = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let reads = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST")
        return json({ schema_version: 1, state: "dismissed", job_id: id });
      reads++;
      if (reads === 1) {
        await firstHeld;
        return list([failed]);
      }
      return new Response("", { status: 503 });
    }),
  );
  const store = new CloneJobs();
  const first = store.refresh();
  await store.dismiss(id, "csrf");
  releaseFirst();
  await first;
  await vi.waitFor(() => expect(reads).toBe(2));
  await vi.waitFor(() => expect(store.get().failed).toBe(true));
  expect(store.get().jobs).toEqual([]);
  store.dispose();
});
