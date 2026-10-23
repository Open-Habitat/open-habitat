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

it("keeps reported interrupted candidates when the process scan is incomplete", async () => {
  const interrupted = [{ full_name: "owner/repo", size_bytes: 42 }];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      json({
        schema_version: 1,
        jobs: [],
        interrupted,
        interrupted_complete: false,
      }),
    ),
  );
  const store = new CloneJobs();
  await store.refresh();
  expect(store.get().interrupted).toEqual(interrupted);
  expect(store.get().interruptedComplete).toBe(false);
  expect(store.get().failed).toBe(false);
  store.dispose();
});

// A synthetic daemon for the queue: one clone at a time, a job that ends when
// the test says so, and per-name answers for the checkout observation.
function daemon(
  options: {
    present?: string[];
    refuse?: Record<string, string>;
    loseReply?: string;
  } = {},
) {
  const jobs: Record<string, unknown>[] = [];
  const posts: string[] = [];
  let finish: (() => void) | undefined;
  let n = 0;
  const fetch = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (url.includes("/checkout?")) {
        const name = decodeURIComponent(url.split("full_name=")[1]);
        return json({
          schema_version: 1,
          full_name: name,
          state: options.present?.includes(name) ? "confirmed" : "absent",
        });
      }
      if (url.includes("/clones/events")) {
        const jobId = new URL(url, "https://x.invalid").searchParams.get(
          "job_id",
        );
        await new Promise<void>((resolve) => {
          finish = resolve;
        });
        const job = jobs.find((j) => j.job_id === jobId);
        if (job) {
          job.state = "confirmed";
          job.finished_at = "2026-10-23T12:01:00Z";
        }
        return new Response(
          `event: terminal\ndata: {"schema_version":1,"sequence":1,"job_id":"${jobId}","kind":"terminal","outcome":"confirmed"}\n\n`,
          {
            status: 200,
            headers: { "content-type": "text/event-stream; charset=utf-8" },
          },
        );
      }
      if (init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        if (body.action !== "start") return new Response("", { status: 500 });
        posts.push(body.full_name);
        if (options.refuse?.[body.full_name])
          return new Response(
            JSON.stringify({ error: { code: options.refuse[body.full_name] } }),
            { status: 409, headers: { "content-type": "application/json" } },
          );
        if (jobs.some((j) => j.state === "running"))
          return new Response(
            JSON.stringify({ error: { code: "clone_running" } }),
            { status: 409, headers: { "content-type": "application/json" } },
          );
        const job = {
          job_id: (++n).toString(16).padStart(32, "0"),
          full_name: body.full_name,
          mode: body.mode,
          state: "running",
          stage: "receiving",
          started_at: "2026-10-23T12:00:00Z",
        };
        jobs.unshift(job);
        if (options.loseReply === body.full_name) throw new TypeError("lost");
        return json({ schema_version: 1, job });
      }
      return list(jobs.map((j) => ({ ...j })));
    },
  );
  vi.stubGlobal("fetch", fetch);
  return {
    posts,
    jobs,
    /** Ends the running clone. */
    finish: async () => {
      await vi.waitFor(() => expect(finish).toBeDefined());
      const f = finish;
      finish = undefined;
      f?.();
    },
  };
}

it("starts queued clones one at a time and skips a checkout already there", async () => {
  const fake = daemon({ present: ["owner/there"] });
  const confirmed = vi.fn();
  const store = new CloneJobs(confirmed);
  store.enqueue(["owner/a", "owner/there", "owner/b"], "full", "csrf");
  await vi.waitFor(() => expect(fake.posts).toEqual(["owner/a"]));
  await vi.waitFor(() =>
    expect(store.get().queue.map((q) => [q.full_name, q.state])).toEqual([
      ["owner/there", "waiting"],
      ["owner/b", "waiting"],
    ]),
  );
  // Asking again for a name that is running or waiting changes nothing.
  store.enqueue(["owner/a", "owner/b"], "full", "csrf");
  expect(store.get().queue).toHaveLength(2);
  await fake.finish();
  await vi.waitFor(() => expect(fake.posts).toEqual(["owner/a", "owner/b"]));
  await fake.finish();
  await vi.waitFor(() =>
    expect(store.get().jobs.map((j) => j.state)).toEqual([
      "confirmed",
      "confirmed",
    ]),
  );
  expect(store.get().queue).toEqual([
    { full_name: "owner/there", mode: "full", state: "present" },
  ]);
  expect(confirmed).toHaveBeenCalledTimes(2);
  store.dispose();
});

it("reads the list after a lost start reply and never asks a second time", async () => {
  const fake = daemon({ loseReply: "owner/a" });
  const store = new CloneJobs();
  store.enqueue(["owner/a"], "full", "csrf");
  await vi.waitFor(() =>
    expect(store.get().jobs.map((j) => j.full_name)).toEqual(["owner/a"]),
  );
  await vi.waitFor(() => expect(store.get().queue).toEqual([]));
  expect(fake.posts).toEqual(["owner/a"]);
  store.dispose();
});

it("reports a refused start, goes on with the rest and retries on request", async () => {
  const refuse: Record<string, string> = { "owner/full": "quota_full" };
  const fake = daemon({ refuse });
  const store = new CloneJobs();
  store.enqueue(["owner/full", "owner/b"], "full", "csrf");
  await vi.waitFor(() => expect(fake.posts).toEqual(["owner/full", "owner/b"]));
  expect(store.get().queue).toEqual([
    {
      full_name: "owner/full",
      mode: "full",
      state: "refused",
      problem: "storage",
    },
  ]);
  delete refuse["owner/full"];
  store.retryClone("owner/full", "csrf");
  // The retry waits for the running clone instead of being refused as busy.
  await fake.finish();
  await vi.waitFor(() =>
    expect(fake.posts).toEqual(["owner/full", "owner/b", "owner/full"]),
  );
  await vi.waitFor(() => expect(store.get().queue).toEqual([]));
  store.dispose();
});

it("lets a later list clear a refusal whose start did happen after all", async () => {
  const running = {
    job_id: id,
    full_name: "owner/a",
    mode: "full",
    state: "running",
    stage: "receiving",
    started_at: "2026-10-23T12:00:00Z",
  };
  let listOk = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/checkout?"))
        return json({
          schema_version: 1,
          full_name: "owner/a",
          state: "absent",
        });
      if (url.includes("/clones/events"))
        return new Promise<Response>(() => {});
      if (init?.method === "POST") throw new TypeError("lost");
      return listOk ? list([running]) : new Response("", { status: 503 });
    }),
  );
  const store = new CloneJobs();
  store.enqueue(["owner/a"], "full", "csrf");
  await vi.waitFor(() => expect(store.get().queue[0]?.state).toBe("refused"));
  listOk = true;
  await store.refresh();
  expect(store.get().queue).toEqual([]);
  expect(store.get().jobs.map((j) => j.state)).toEqual(["running"]);
  store.dispose();
});
