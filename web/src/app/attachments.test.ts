import { afterEach, expect, it, vi } from "vitest";
import { uploadAttachment } from "./attachments";

const id = "11111111-1111-4111-8111-111111111111";
const file = new File(["hello"], "<notes>.png", { type: "image/png" });
const reply = {
  schema_version: 1,
  id,
  path: `/synthetic/attachments/${id}`,
  content_type: "text/plain; charset=utf-8",
  size: 5,
};
afterEach(() => vi.unstubAllGlobals());

it("uses sniffed type instead of the claimed type, preserves the path for non-composer callers", async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(reply), {
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const uploaded = await uploadAttachment(
    file,
    "csrf",
    new AbortController().signal,
  );
  expect(uploaded.path).toBe(reply.path);
  expect(uploaded.reference).toBe(`[<notes>.png](/api/v1/attachments/${id})`);
  expect(fetch.mock.calls[0][1].headers["X-Agent-Host-CSRF"]).toBe("csrf");
});

it("rejects unknown contract fields and oversized streaming replies without Content-Length", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...reply, owner: "spoof" }), {
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response("x".repeat(4097), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
  );
  await expect(
    uploadAttachment(file, "csrf", new AbortController().signal),
  ).rejects.toThrow("Liitteen vastaus ei kelpaa.");
  await expect(
    uploadAttachment(file, "csrf", new AbortController().signal),
  ).rejects.toThrow("Liitteen vastaus ei kelpaa.");
});
