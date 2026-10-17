import { afterEach, expect, test, vi } from "vitest";
import { catalog, cloneStream, lookup, observe } from "./github";

const reply = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
const sse = (body: string, chunk = 0) => {
  const bytes = new TextEncoder().encode(body);
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        const step = chunk || bytes.length || 1;
        for (let i = 0; i < bytes.length; i += step)
          controller.enqueue(bytes.slice(i, i + step));
        controller.close();
      },
    }),
    { headers: { "content-type": "text/event-stream; charset=utf-8" } },
  );
};
const id = "0123456789abcdef0123456789abcdef";
const job = {
  schema_version: 1,
  job: {
    job_id: id,
    full_name: "fixture/x",
    mode: "full",
    state: "running",
    stage: "reserving",
    started_at: "2026-10-17T12:00:00Z",
  },
};
const repo = {
  full_name: "fixture/x",
  private: false,
  description: "ok",
  html_url: "https://github.com/fixture/x",
  pushed_at: null,
  size_kib: 1,
  default_branch: "main",
  owner_type: "Organization",
};
// Routes the clone start and each subscription to its own reply.
const cloneFetch = (...streams: (() => Response)[]) => {
  const calls: string[] = [];
  let n = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      if (url === "/api/v1/onboarding/github/clones") return reply(job);
      return streams[Math.min(n++, streams.length - 1)]();
    }),
  );
  return calls;
};
afterEach(() => vi.unstubAllGlobals());
test("GitHub adapter rejects contract drift, mismatched names and oversized replies", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      reply({
        schema_version: 1,
        complete: true,
        repositories: [{ ...repo, html_url: "https://evil.invalid/x" }],
      }),
    ),
  );
  await expect(catalog()).rejects.toThrow();
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        reply({ schema_version: 1, complete: true, repositories: [repo] }),
      ),
  );
  expect((await catalog()).repositories[0].owner_type).toBe("Organization");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      reply({
        schema_version: 1,
        full_name: "fixture/other",
        state: "confirmed",
      }),
    ),
  );
  await expect(observe("fixture/x")).rejects.toThrow();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      reply({
        schema_version: 1,
        full_name: "fixture/x",
        state: "interrupted",
      }),
    ),
  );
  await expect(observe("fixture/x")).rejects.toThrow();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(" ".repeat(2 * 1024 * 1024 + 1), {
        headers: { "content-type": "application/json" },
      }),
    ),
  );
  await expect(catalog()).rejects.toThrow();
});

test("an exact name outside the catalog is found or plainly not found", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      reply({
        schema_version: 1,
        full_name: "raine/workmux",
        state: "found",
        repository: {
          ...repo,
          full_name: "raine/workmux",
          html_url: "https://github.com/raine/workmux",
        },
      }),
    ),
  );
  expect((await lookup("raine/workmux")).state).toBe("found");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      reply({
        schema_version: 1,
        full_name: "raine/workmux",
        state: "not_found",
      }),
    ),
  );
  expect((await lookup("raine/workmux")).state).toBe("not_found");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      reply({
        schema_version: 1,
        full_name: "raine/other",
        state: "not_found",
      }),
    ),
  );
  await expect(lookup("raine/workmux")).rejects.toThrow();
});

test("full quota is explained before a clone job starts", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(reply({ error: { code: "quota_full" } }, 409)),
  );
  await expect(cloneStream("fixture/x", "csrf", () => {})).rejects.toThrow(
    "Tallennustila on täynnä",
  );
});

test("clone progress accepts chunked native stages and only a final confirmed terminal", async () => {
  cloneFetch(() =>
    sse(
      `event: progress\ndata: {"schema_version":1,"sequence":1,"job_id":"${id}","kind":"progress","stage":"receiving","percent":23,"received_bytes":1310720}\n\n` +
        `event: terminal\ndata: {"schema_version":1,"sequence":2,"job_id":"${id}","kind":"terminal","outcome":"confirmed"}\n\n`,
      7,
    ),
  );
  const stages: string[] = [];
  await cloneStream("fixture/x", "csrf", (frame) => {
    if (frame.kind === "progress") stages.push(frame.stage);
  });
  expect(stages).toEqual(["receiving"]);
});

// The job is the daemon's: a stream that ends without a result is followed by
// a new subscription, which starts again from sequence 1.
test("a lost stream is resubscribed, not taken as a result", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    const calls = cloneFetch(
      () =>
        sse(
          `event: progress\ndata: {"schema_version":1,"sequence":1,"job_id":"${id}","kind":"progress","stage":"receiving","percent":10}\n\n`,
        ),
      () =>
        sse(
          `event: progress\ndata: {"schema_version":1,"sequence":1,"job_id":"${id}","kind":"progress","stage":"receiving","percent":60}\n\n` +
            `event: terminal\ndata: {"schema_version":1,"sequence":2,"job_id":"${id}","kind":"terminal","outcome":"confirmed"}\n\n`,
        ),
    );
    const percents: number[] = [];
    const done = cloneStream("fixture/x", "csrf", (frame) => {
      if (frame.kind === "progress" && frame.percent !== undefined)
        percents.push(frame.percent);
    });
    await vi.advanceTimersByTimeAsync(1500);
    await done;
    expect(percents).toEqual([10, 60]);
    expect(calls.filter((url) => url.includes("/events?job_id=")).length).toBe(
      2,
    );
  } finally {
    vi.useRealTimers();
  }
});

test.each([
  [
    "failed job",
    `event: terminal\ndata: {"schema_version":1,"sequence":1,"job_id":"${id}","kind":"terminal","outcome":"failed","reason":"native_failure","leftover":"removed"}\n\n`,
  ],
  [
    "another job's frame",
    `event: terminal\ndata: {"schema_version":1,"sequence":1,"job_id":"fedcba9876543210fedcba9876543210","kind":"terminal","outcome":"confirmed"}\n\n`,
  ],
  [
    "duplicate sequence",
    `event: progress\ndata: {"schema_version":1,"sequence":1,"job_id":"${id}","kind":"progress","stage":"connecting"}\n\nevent: terminal\ndata: {"schema_version":1,"sequence":1,"job_id":"${id}","kind":"terminal","outcome":"confirmed"}\n\n`,
  ],
  [
    "extra native text",
    `event: terminal\ndata: {"schema_version":1,"sequence":1,"job_id":"${id}","kind":"terminal","outcome":"confirmed","message":"token"}\n\n`,
  ],
  [
    "unknown major",
    `event: terminal\ndata: {"schema_version":2,"sequence":1,"job_id":"${id}","kind":"terminal","outcome":"confirmed"}\n\n`,
  ],
  [
    "truncated",
    `event: terminal\ndata: {"schema_version":1,"sequence":1,"job_id":"${id}","kind":"terminal","outcome":"confirmed"}`,
  ],
])("clone progress rejects %s", async (_, body) => {
  cloneFetch(() => sse(body));
  await expect(cloneStream("fixture/x", "csrf", () => {})).rejects.toThrow();
});
