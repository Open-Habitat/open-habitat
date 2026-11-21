import { describe, expect, it, vi } from "vitest";
import { readJSON } from "./readJSON";

const headers = { "content-type": "application/json; charset=utf-8" };
const encode = (text: string) => new TextEncoder().encode(text);
function chunks(parts: Uint8Array[], close = true) {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      if (close) controller.close();
    },
    cancel,
  });
  return { response: new Response(body, { headers }), body, cancel };
}

describe("bounded JSON response reader", () => {
  it("decodes UTF-8 split at every byte at the exact byte limit", async () => {
    const bytes = encode('{"text":"ä🦊中"}');
    const { response, body } = chunks(
      Array.from(bytes, (b) => Uint8Array.of(b)),
    );
    await expect(readJSON(response, bytes.length)).resolves.toEqual({
      text: "ä🦊中",
    });
    expect(body.locked).toBe(false);
  });

  it("caps bytes rather than UTF-16 string length and cancels an oversized stream", async () => {
    const text = '"ä🦊中"';
    const { response, body, cancel } = chunks([encode(text)], false);
    await expect(readJSON(response, text.length)).rejects.toThrow("invalid");
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });

  it("ignores misleading Content-Length", async () => {
    const { response, cancel } = chunks([encode("null ")], false);
    response.headers.set("content-length", "1");
    await expect(readJSON(response, 4)).rejects.toThrow("invalid");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each([
    Uint8Array.of(0x22, 0xff, 0x22),
    Uint8Array.of(0x22, 0xc3),
    encode("{private-body-marker"),
    encode("{} []"),
  ])("refuses malformed UTF-8 or JSON without exposing it", async (bytes) => {
    const { response, body } = chunks([bytes]);
    await expect(readJSON(response, 1024)).rejects.toThrow("invalid");
    expect(body.locked).toBe(false);
  });

  it("cancels malformed UTF-8 before an unending stream finishes", async () => {
    const { response, cancel } = chunks([Uint8Array.of(0xff)], false);
    await expect(readJSON(response, 1024)).rejects.toThrow("invalid");
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("releases a failed stream and keeps cancellation errors private", async () => {
    const body = new ReadableStream({
      pull(controller) {
        controller.error(new Error("private-body-marker"));
      },
    });
    await expect(
      readJSON(new Response(body, { headers }), 1024),
    ).rejects.toThrow("invalid");
    expect(body.locked).toBe(false);
  });

  it("refuses absent bodies and non-JSON without reading the latter", async () => {
    await expect(
      readJSON(new Response(null, { headers }), 100),
    ).rejects.toThrow("invalid");
    const response = new Response("private-body-marker");
    await expect(readJSON(response, 100)).rejects.toThrow("unavailable");
    expect(response.bodyUsed).toBe(false);
  });

  it("leaves HTTP status policy to the caller", async () => {
    await expect(
      readJSON(new Response('{"error":true}', { status: 409, headers }), 100),
    ).resolves.toEqual({ error: true });
  });
});
