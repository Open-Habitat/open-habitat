import { describe, expect, it } from "vitest";
import { readHistory } from "./history";

function response(body: string) {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
describe("native history boundary", () => {
  it("preserves the native key and text without interpreting markup", async () => {
    const value = await readHistory(
      response(
        JSON.stringify({
          schema_version: 1,
          agent_id: "pi:11111111-1111-4111-8111-111111111111",
          native_revision: "native",
          entries: [
            {
              entry_key: "a1",
              kind: "unknown",
              content: {
                media_type: "text/plain",
                text: "<script>alert(1)</script>",
                complete: true,
              },
            },
          ],
          complete: true,
        }),
      ),
    );
    expect("entries" in value && value.entries[0]?.content.text).toBe(
      "<script>alert(1)</script>",
    );
  });
  it("validates a bounded 1 MiB image chunk and rejects a larger one", async () => {
    const image = {
      schema_version: 1,
      agent_id: "pi:11111111-1111-4111-8111-111111111111",
      native_revision: "native",
      entry_key: "image",
      block_index: 0,
      offset: 0,
      chunk: {
        media_type: "image/png",
        data: "QUJD".repeat(262144),
        complete: true,
      },
    };
    const value = await readHistory(response(JSON.stringify(image)));
    expect("chunk" in value && value.chunk.data?.length).toBe(1048576);
    await expect(
      readHistory(
        response(
          JSON.stringify({
            ...image,
            chunk: { ...image.chunk, data: `${image.chunk.data}QUJD` },
          }),
        ),
      ),
    ).rejects.toThrow("invalid history");
  });
  it("rejects unknown host fields and oversized bodies", async () => {
    await expect(
      readHistory(
        response(
          JSON.stringify({
            schema_version: 1,
            agent_id: "pi:11111111-1111-4111-8111-111111111111",
            native_revision: "native",
            entries: [],
            complete: true,
            injected: true,
          }),
        ),
      ),
    ).rejects.toThrow();
    await expect(
      readHistory(response("x".repeat(2 * 1024 * 1024 + 1))),
    ).rejects.toThrow("oversize");
  });
});
