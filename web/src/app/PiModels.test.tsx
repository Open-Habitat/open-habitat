import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
