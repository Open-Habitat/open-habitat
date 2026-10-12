import { afterEach, expect, test, vi } from "vitest";
import { catalog, clone, cloneStream, observe } from "./github";
const reply = (value: unknown) =>
  new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
afterEach(() => vi.unstubAllGlobals());
test("GitHub adapter rejects contract drift, mismatched names and oversized streaming replies", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      reply({
        schema_version: 1,
        page: 1,
        limit: 2,
        has_more: false,
        repositories: [
          {
            full_name: "fixture/x",
            private: false,
            description: "ok",
            html_url: "https://evil.invalid/x",
          },
        ],
      }),
    ),
  );
  await expect(catalog(1)).rejects.toThrow();
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
        full_name: "fixture/other",
        state: "cloned",
      }),
    ),
  );
  await expect(clone("fixture/x", "test-csrf")).rejects.toThrow();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(" ".repeat(60001), {
        headers: { "content-type": "application/json" },
      }),
    ),
  );
  await expect(catalog(1)).rejects.toThrow();
});

test("full quota is explained before a clone stream starts", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "quota_full" } }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
  await expect(cloneStream("fixture/x", "csrf", () => {})).rejects.toThrow(
    "Tallennustila on täynnä",
  );
});

test("clone progress accepts chunked native stages and only a final confirmed terminal", async () => {
  const frames = [
    'event: progress\ndata: {"schema_version":1,"sequence":1,"kind":"progress","stage":"receiving","percent":23,"received_bytes":1310720}\n\n',
    'event: terminal\ndata: {"schema_version":1,"sequence":2,"kind":"terminal","outcome":"confirmed"}\n\n',
  ];
  const bytes = new TextEncoder().encode(frames.join(""));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 7)
        controller.enqueue(bytes.slice(i, i + 7));
      controller.close();
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(stream, {
        headers: { "content-type": "text/event-stream; charset=utf-8" },
      }),
    ),
  );
  const stages: string[] = [];
  await cloneStream("fixture/x", "csrf", (frame) => {
    if (frame.kind === "progress") stages.push(frame.stage);
  });
  expect(stages).toEqual(["receiving"]);
});

test.each([
  [
    "missing terminal",
    'event: progress\ndata: {"schema_version":1,"sequence":1,"kind":"progress","stage":"connecting"}\n\n',
  ],
  [
    "duplicate sequence",
    'event: progress\ndata: {"schema_version":1,"sequence":1,"kind":"progress","stage":"connecting"}\n\nevent: terminal\ndata: {"schema_version":1,"sequence":1,"kind":"terminal","outcome":"confirmed"}\n\n',
  ],
  [
    "extra native text",
    'event: terminal\ndata: {"schema_version":1,"sequence":1,"kind":"terminal","outcome":"confirmed","message":"token"}\n\n',
  ],
  [
    "unknown major",
    'event: terminal\ndata: {"schema_version":2,"sequence":1,"kind":"terminal","outcome":"confirmed"}\n\n',
  ],
  [
    "truncated",
    'event: terminal\ndata: {"schema_version":1,"sequence":1,"kind":"terminal","outcome":"confirmed"}',
  ],
])("clone progress rejects %s", async (_, body) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(body, {
        headers: { "content-type": "text/event-stream; charset=utf-8" },
      }),
    ),
  );
  await expect(cloneStream("fixture/x", "csrf", () => {})).rejects.toThrow();
});
