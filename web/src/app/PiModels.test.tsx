import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { PiModelsProvider, usePiModels } from "./PiModels";

const catalog = (model: string) => ({
  schema_version: 1 as const,
  default_provider: "openai-codex" as const,
  default_model: model,
  models: [],
});
const response = (model: string) =>
  new Response(JSON.stringify(catalog(model)), {
    headers: { "Content-Type": "application/json" },
  });
function Probe() {
  const { data, refresh, update } = usePiModels();
  return (
    <>
      <output>{data?.default_model ?? "unloaded"}</output>
      <button type="button" onClick={refresh}>
        refresh
      </button>
      <button type="button" onClick={() => update(catalog("saved"))}>
        save
      </button>
    </>
  );
}
afterEach(() => vi.restoreAllMocks());
it("preloads once, retains rows during refresh and does not undo a confirmed default with an older read", async () => {
  let resolve!: (r: Response) => void;
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(response("initial"))
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
  render(
    <PiModelsProvider enabled>
      <Probe />
    </PiModelsProvider>,
  );
  await screen.findByText("initial");
  fireEvent.click(screen.getByText("refresh"));
  fireEvent.click(screen.getByText("refresh"));
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(screen.getByText("initial")).toBeTruthy();
  fireEvent.click(screen.getByText("save"));
  await act(async () => resolve(response("stale")));
  expect(screen.getByText("saved")).toBeTruthy();
});
it("discards the previous identity's catalog and ignores its delayed reply", async () => {
  let resolve!: (r: Response) => void;
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    )
    .mockResolvedValueOnce(response("Bob"));
  const { rerender } = render(
    <PiModelsProvider key="Alice" enabled>
      <Probe />
    </PiModelsProvider>,
  );
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  rerender(
    <PiModelsProvider key="Bob" enabled>
      <Probe />
    </PiModelsProvider>,
  );
  await screen.findByText("Bob");
  await act(async () => resolve(response("Alice")));
  expect(screen.queryByText("Alice")).toBeNull();
  expect(screen.getByText("Bob")).toBeTruthy();
  expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
});
function Chooser() {
  const { data, chooseDefault, defaultPending, defaultRefusal } = usePiModels();
  const [outcome, setOutcome] = useState("");
  return (
    <>
      <output aria-label="default">{data?.default_model ?? "unloaded"}</output>
      <output aria-label="pending">{String(defaultPending)}</output>
      <output aria-label="outcome">{outcome}</output>
      <output aria-label="refusal">{defaultRefusal}</output>
      {["first", "second"].map((model) => (
        <button
          key={model}
          type="button"
          onClick={() =>
            void chooseDefault(
              { provider: "openai-codex", model },
              "csrf",
            ).then((o) => setOutcome((v) => `${v}${model}:${o} `))
          }
        >
          {model}
        </button>
      ))}
    </>
  );
}
const field = (name: string) => screen.getByRole("status", { name });
it("shows a default choice at once, sends only the latest, and reverts a typed refusal without a receipt read", async () => {
  const posts: unknown[] = [];
  let answer: (r: Response) => void = () => {};
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (_url, init) => {
      if (init?.method !== "POST") return response("old");
      posts.push(JSON.parse(String(init.body)));
      return new Promise<Response>((resolve) => {
        answer = resolve;
      });
    });
  render(
    <PiModelsProvider enabled>
      <Chooser />
    </PiModelsProvider>,
  );
  await waitFor(() => expect(field("default").textContent).toBe("old"));
  fireEvent.click(screen.getByRole("button", { name: "first" }));
  fireEvent.click(screen.getByRole("button", { name: "second" }));
  expect(field("default").textContent).toBe("second");
  expect(field("pending").textContent).toBe("true");
  await waitFor(() => expect(posts).toHaveLength(1));
  await act(async () => answer(response("first")));
  await waitFor(() => expect(posts).toHaveLength(2));
  expect(posts[1]).toEqual({ provider: "openai-codex", model: "second" });
  const reads = fetcher.mock.calls.length;
  await act(async () => answer(new Response("{}", { status: 409 })));
  await waitFor(() => expect(field("pending").textContent).toBe("false"));
  // Reverted to what Pi last confirmed, with the refusal's own reason.
  expect(field("default").textContent).toBe("first");
  expect(field("refusal").textContent).toMatch(/varattuina/);
  expect(field("outcome").textContent).toBe("first:superseded second:refused ");
  expect(fetcher.mock.calls.length).toBe(reads);
});
it("never takes a catalog read begun before an uncertain write as its receipt", async () => {
  const reads: ((r: Response) => void)[] = [];
  let failReads = false;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    if (init?.method === "POST")
      return new Response("unavailable", { status: 503 });
    if (failReads) throw new TypeError("offline");
    return new Promise<Response>((resolve) => reads.push(resolve));
  });
  render(
    <PiModelsProvider enabled>
      <Chooser />
    </PiModelsProvider>,
  );
  await waitFor(() => expect(reads).toHaveLength(1));
  await act(async () => reads[0](response("old")));
  // A focus refresh is in flight when the person chooses.
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(reads).toHaveLength(2);
  failReads = true;
  fireEvent.click(screen.getByRole("button", { name: "second" }));
  await waitFor(() => expect(field("pending").textContent).toBe("true"));
  // The POST was a 503 and its receipt read failed: still uncertain.
  await act(async () => reads[1](response("old")));
  expect(field("pending").textContent).toBe("true");
  expect(field("default").textContent).toBe("second");
  expect(field("refusal").textContent).toBe("");
  // A read after the write settles it.
  failReads = false;
  await act(async () => window.dispatchEvent(new Event("focus")));
  await act(async () => reads[2](response("second")));
  await waitFor(() => expect(field("pending").textContent).toBe("false"));
  expect(field("outcome").textContent).toBe("second:confirmed ");
});
