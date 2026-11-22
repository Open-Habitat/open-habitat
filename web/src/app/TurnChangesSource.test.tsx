import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { HistoryEntry } from "./history";
import { TurnChangesRoot, TurnChangesSource } from "./TurnChangesSource";

type Read = (
  agentId: string,
  revision: string,
  entryKey: string,
  index: number,
) => Promise<string>;
// A plain stand-in: with a vi.fn whose promise rejected, Vitest failed the
// test although the component handled the rejection.
const reads = vi.hoisted(() => {
  const state = {
    calls: [] as string[][],
    read: (async () => "") as Read,
    fullTextBlock: ((...args) => {
      state.calls.push(args.map(String));
      return state.read(...args);
    }) as Read,
  };
  return state;
});
vi.mock("./history", async (original) => ({
  ...(await original<typeof import("./history")>()),
  fullTextBlock: reads.fullTextBlock,
}));

const agent = "pi:11111111-1111-4111-8111-111111111111";
let turn = 0;
// Each test has its own entry keys: the block cache outlives a render.
function editingTurn(tool = "write", ownRevision?: string) {
  turn++;
  const call: HistoryEntry = {
    entry_key: `call-${turn}`,
    kind: "assistant",
    content: { text: "" },
    native_revision: ownRevision,
    blocks: [
      {
        type: "toolCall",
        tool_call_id: `tool-${turn}`,
        tool_name: tool,
        readable: true,
      },
    ],
  } as HistoryEntry;
  const result = {
    entry_key: `result-${turn}`,
    kind: "tool",
    content: { text: "ok" },
    blocks: [{ type: "text", text: "ok" }],
  } as HistoryEntry;
  const reply = {
    entry_key: `reply-${turn}`,
    kind: "assistant",
    content: { text: "Valmis." },
    blocks: [{ type: "text", text: "Valmis." }],
  } as HistoryEntry;
  return {
    entries: [call, reply],
    results: new Map([[`tool-${turn}`, result]]),
    args:
      tool === "bash"
        ? JSON.stringify({ command: "ls" })
        : JSON.stringify({ path: `src/t${turn}.ts`, content: "a\nb\n" }),
  };
}

beforeEach(() => {
  reads.calls = [];
  reads.read = async () => "";
});
afterEach(() => vi.unstubAllGlobals());

it("reads a stream-delivered entry at the conversation's revision once its own is gone", async () => {
  const t = editingTurn("write", "saved-then");
  reads.read = async (_a, revision) => {
    if (revision !== "now") throw new Error("history unavailable");
    return t.args;
  };
  render(
    <TurnChangesSource
      entries={t.entries}
      results={t.results}
      agentId={agent}
      revision="now"
    />,
  );
  expect(await screen.findByTestId("turn-changes")).toBeTruthy();
  expect(reads.calls.map((c) => c[1])).toEqual(["saved-then", "now"]);
});

it("says briefly that an editing turn's changes could not be read, and reads again on request", async () => {
  const t = editingTurn("write");
  reads.read = async () => {
    throw new Error("history unavailable");
  };
  render(
    <TurnChangesSource
      entries={t.entries}
      results={t.results}
      agentId={agent}
      revision="now"
    />,
  );
  expect((await screen.findByTestId("turn-changes-unread")).textContent).toBe(
    "Vuoron muutoksia ei voitu lukea.Yritä uudelleen",
  );
  reads.read = async () => t.args;
  fireEvent.click(screen.getByTestId("turn-changes-retry"));
  expect(await screen.findByTestId("turn-changes")).toBeTruthy();
  expect(screen.queryByTestId("turn-changes-unread")).toBeNull();
});

it("a turn of commands only shows nothing when its calls cannot be read", async () => {
  const t = editingTurn("bash");
  reads.read = async () => {
    throw new Error("history unavailable");
  };
  const { container } = render(
    <TurnChangesSource
      entries={t.entries}
      results={t.results}
      agentId={agent}
      revision="now"
    />,
  );
  await waitFor(() => expect(reads.calls.length).toBeGreaterThan(0));
  await new Promise((r) => setTimeout(r, 20));
  expect(container.textContent).toBe("");
});

it("shows a native batch edit beside shell scripts, but does not invent changes from a script-only turn", async () => {
  const t = editingTurn("edit");
  const script = editingTurn("bash");
  const command =
    "cd /workspace/demo && python3 - <<'PY'\n" +
    "p='notes.md'; s=open(p).read(); open(p,'w').write(s.replace('old','new'))\nPY";
  // Native Claude-bridge/Pi shape: thinking precedes an edits[] call,
  // with a shell command in the same assistant entry and a text-only result.
  t.entries[0].blocks = [
    { type: "thinking", text: "Inspect the file." },
    ...(t.entries[0].blocks ?? []),
    ...(script.entries[0].blocks ?? []),
  ];
  const results = new Map([...t.results, ...script.results]);
  reads.read = async (_a, _r, entry, index) =>
    entry === t.entries[0].entry_key && index === 1
      ? JSON.stringify({
          path: "/workspace/demo/notes.md",
          edits: [{ oldText: "old", newText: "new" }],
        })
      : JSON.stringify({ command });
  const { rerender } = render(
    <TurnChangesRoot.Provider value="/workspace/demo">
      <TurnChangesSource
        entries={t.entries}
        results={results}
        agentId={agent}
        revision="now"
      />
    </TurnChangesRoot.Provider>,
  );
  expect(await screen.findByTestId("turn-changes")).toBeTruthy();
  fireEvent.click(screen.getByTestId("turn-changes-toggle"));
  expect(screen.getAllByTestId("turn-changes-file")).toHaveLength(1);
  expect(screen.getByTestId("turn-changes-file").textContent).toContain(
    "notes.md",
  );
  rerender(
    <TurnChangesRoot.Provider value="/workspace/demo">
      <TurnChangesSource
        key="script-only"
        entries={script.entries}
        results={script.results}
        agentId={agent}
        revision="now"
      />
    </TurnChangesRoot.Provider>,
  );
  await act(async () => {});
  expect(reads.calls.some((c) => c[2] === script.entries[0].entry_key)).toBe(
    true,
  );
  expect(screen.queryByTestId("turn-changes")).toBeNull();
  expect(screen.queryByTestId("turn-changes-unread")).toBeNull();
});

it("measures nearness from the conversation's scroll area, not the page", async () => {
  const seen: { root?: Element | Document | null; margin?: string }[] = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(_: unknown, options: IntersectionObserverInit) {
        seen.push({ root: options.root, margin: options.rootMargin });
      }
      observe() {}
      disconnect() {}
    },
  );
  const t = editingTurn("write");
  render(
    <div data-testid="stream" style={{ overflowY: "auto" }}>
      <section>
        <TurnChangesSource
          entries={t.entries}
          results={t.results}
          agentId={agent}
          revision="now"
        />
      </section>
    </div>,
  );
  await act(async () => {});
  expect(seen).toEqual([
    { root: screen.getByTestId("stream"), margin: "800px 0px" },
  ]);
  expect(reads.calls).toEqual([]);
});
