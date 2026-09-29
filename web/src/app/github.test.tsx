import { afterEach, expect, test, vi } from "vitest";
import { catalog, clone, observe } from "./github";
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
