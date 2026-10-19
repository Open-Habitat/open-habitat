import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MutationLayer,
  mutationClasses,
  refusalReason,
  slowConfirmationMs,
  writeOutcome,
} from "./mutations";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// ADR 0023: every write goes through the layer. A `fetch(` whose options name
// a method anywhere else is a write that skipped it (fetch defaults to GET).
describe("the mutation layer guard", () => {
  const root = join(__dirname, "..");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory())
        return name === "test" || name === "contracts" ? [] : files(path);
      return /\.(ts|tsx)$/.test(name) &&
        !/\.(test|stories)\.tsx?$/.test(name) &&
        !path.endsWith(join("app", "mutations.ts"))
        ? [path]
        : [];
    });
  it("finds no write sent directly with fetch", () => {
    const offenders: string[] = [];
    for (const path of files(root)) {
      const text = readFileSync(path, "utf8");
      for (
        let at = text.indexOf("fetch(");
        at >= 0;
        at = text.indexOf("fetch(", at + 1)
      ) {
        if (/[A-Za-z]$/.test(text.slice(at - 1, at))) continue; // reconnectFetch, mutationFetch
        let depth = 0;
        let end = at + 5;
        for (; end < text.length; end++) {
          if (text[end] === "(") depth++;
          else if (text[end] === ")" && --depth === 0) break;
        }
        if (/\bmethod\b/.test(text.slice(at, end)))
          offenders.push(
            `${path.slice(root.length + 1)}:${text.slice(0, at).split("\n").length}`,
          );
      }
    }
    expect(offenders).toEqual([]);
  });
  it("classifies every command", () => {
    for (const value of Object.values(mutationClasses))
      expect(["optimistic", "pending", "confirmed"]).toContain(value);
  });
});

describe("writeOutcome", () => {
  it("reads a typed 4xx as a definite refusal, not uncertainty", async () => {
    await expect(
      writeOutcome(
        json(429, {
          schema_version: 1,
          error: { code: "capacity_exceeded", message: "x" },
        }),
      ),
    ).resolves.toEqual({
      kind: "refused",
      status: 429,
      code: "capacity_exceeded",
    });
    expect(refusalReason("capacity_exceeded")).toContain(
      "Neljä keskustelua työskentelee jo",
    );
  });
  it("keeps transport loss, 5xx and partial writes uncertain", async () => {
    expect((await writeOutcome(undefined)).kind).toBe("uncertain");
    expect((await writeOutcome(json(503, {}))).kind).toBe("uncertain");
    expect(
      (
        await writeOutcome(
          json(409, {
            schema_version: 1,
            error: { code: "workspace_partial" },
          }),
        )
      ).kind,
    ).toBe("uncertain");
    expect((await writeOutcome(json(401, {}))).kind).toBe("login");
    // An unreadable 4xx is not proof that nothing was written.
    expect(
      (await writeOutcome(new Response("<html>", { status: 409 }))).kind,
    ).toBe("uncertain");
  });
});

describe("MutationLayer", () => {
  afterEach(() => vi.useRealTimers());
  const spec = (
    layer: MutationLayer,
    value: string,
    send: () => Promise<Response>,
  ) =>
    layer.run({
      command: "workspace.visibility",
      key: "workspace:ws_a:visibility",
      value,
      send,
      read: async (r) => (await r.json()) as unknown,
      refused: (reason) => `ei: ${reason}`,
    });
  it("shows the value until confirmed, then drops it", async () => {
    const layer = new MutationLayer();
    let answer!: (r: Response) => void;
    const done = spec(
      layer,
      "hidden",
      () =>
        new Promise((r) => {
          answer = r;
        }),
    );
    expect(layer.get("workspace:ws_a:visibility")?.value).toBe("hidden");
    answer(json(200, { ok: true }));
    await expect(done).resolves.toMatchObject({ outcome: "confirmed" });
    expect(layer.get("workspace:ws_a:visibility")).toBeUndefined();
  });
  it("says confirmation is slow after two seconds", async () => {
    vi.useFakeTimers();
    const layer = new MutationLayer();
    void spec(layer, "hidden", () => new Promise(() => {}));
    expect(layer.get("workspace:ws_a:visibility")?.phase).toBe("pending");
    vi.advanceTimersByTime(slowConfirmationMs);
    expect(layer.get("workspace:ws_a:visibility")?.phase).toBe("slow");
  });
  it("reverts a refusal with its reason", async () => {
    const layer = new MutationLayer();
    const done = await spec(layer, "hidden", async () =>
      json(409, { schema_version: 1, error: { code: "writer_conflict" } }),
    );
    expect(done).toMatchObject({ outcome: "refused", code: "writer_conflict" });
    expect(layer.get("workspace:ws_a:visibility")).toBeUndefined();
    expect(layer.problem("workspace:ws_a:visibility")).toContain(
      "ei: Pi kirjoittaa",
    );
  });
  it("keeps an uncertain command presented until a later read decides", async () => {
    const layer = new MutationLayer();
    const before = layer.mark();
    const done = await spec(layer, "hidden", async () => {
      throw new TypeError("network");
    });
    expect(done.outcome).toBe("uncertain");
    expect(layer.get("workspace:ws_a:visibility")?.phase).toBe("uncertain");
    // A read that started before the loss is not its receipt.
    layer.reconcile(before, () => "reverted");
    expect(layer.get("workspace:ws_a:visibility")?.phase).toBe("uncertain");
    layer.reconcile(layer.mark(), () => "reverted");
    expect(layer.get("workspace:ws_a:visibility")).toBeUndefined();
    expect(layer.problem("workspace:ws_a:visibility")).toBeTruthy();
  });
  it("queues a second command on the same target and shows the latest", async () => {
    const layer = new MutationLayer();
    const sent: string[] = [];
    let answer!: (r: Response) => void;
    const first = spec(layer, "hidden", () => {
      sent.push("hidden");
      return new Promise((r) => {
        answer = r;
      });
    });
    const second = spec(layer, "visible", async () => {
      sent.push("visible");
      return json(200, {});
    });
    expect(layer.get("workspace:ws_a:visibility")?.value).toBe("visible");
    expect(sent).toEqual(["hidden"]);
    answer(json(200, {}));
    await expect(first).resolves.toEqual({ outcome: "superseded" });
    await expect(second).resolves.toMatchObject({ outcome: "confirmed" });
    expect(sent).toEqual(["hidden", "visible"]);
  });
  it("sends each command with its own id and drops everything on dispose", async () => {
    const layer = new MutationLayer();
    const ids: string[] = [];
    const pending = layer.run({
      command: "conversation.archive",
      key: "conversation:pi:x:archive",
      value: "archived",
      send: (id) => {
        ids.push(id);
        return new Promise(() => {});
      },
      read: async () => undefined,
      refused: () => "",
    });
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/);
    layer.dispose();
    await expect(pending).resolves.toEqual({ outcome: "abandoned" });
    expect(layer.get("conversation:pi:x:archive")).toBeUndefined();
  });
});
