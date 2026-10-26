import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import inventory from "../../../contracts/v1/examples/process-inventory.json";
import output from "../../../contracts/v1/examples/process-output.json";
import type { ProcessEvent } from "../app/processes";
import { BackgroundStrip } from "./BackgroundStrip";
import {
  ProcessAwareToolUse,
  ProcessCompletion,
  ProcessProvider,
  ProcessStartCard,
} from "./ProcessTray";

const id = "pi:11111111-1111-4111-8111-111111111111";
const login = vi.fn();
let listener: (
  id: string,
  kind: string,
  payload?: Record<string, unknown>,
) => void;
const subscribe = (next: typeof listener) => {
  listener = next;
  return () => {};
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function view(children?: React.ReactNode) {
  return render(
    <ProcessProvider
      id={id}
      csrf="synthetic-csrf"
      onLogin={login}
      onStatusEvent={subscribe}
    >
      <BackgroundStrip />
      {children}
    </ProcessProvider>,
  );
}
it("fetches output only while the process window is open; pause freezes the tail and resume refetches, fenced by lifetime", async () => {
  // This case drives output events explicitly. Real inventory polling must not
  // race its request-count assertions on a loaded gate worker.
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  let tail = "ensimmäinen";
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      return reply(
        url.includes("/output?")
          ? { ...output, lines: [{ stream: "stdout", text: tail }] }
          : inventory,
      );
    }),
  );
  const ui = view();
  fireEvent.click(await screen.findByTestId("background-processes"));
  expect(calls.filter((url) => url.includes("/output?"))).toHaveLength(0);
  fireEvent.click(screen.getByTestId("process-open"));
  expect(await screen.findByText("ensimmäinen")).toBeTruthy();
  expect(calls.filter((url) => url.includes("/output?")).at(-1)).toContain(
    "owner_generation=og_example&process_token=pt_example&tail_lines=200",
  );
  fireEvent.click(screen.getByTestId("process-follow"));
  tail = "toinen";
  await act(async () => listener(id, "process.output"));
  expect(screen.queryByText("toinen")).toBeNull();
  expect(calls.filter((url) => url.includes("/output?"))).toHaveLength(1);
  fireEvent.click(screen.getByTestId("process-follow"));
  expect(await screen.findByText("toinen")).toBeTruthy();
  fireEvent.click(screen.getByTestId("process-close"));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await act(async () => listener(id, "process.output"));
  expect(calls.filter((url) => url.includes("/output?"))).toHaveLength(2);
  ui.unmount();
});
it("never retries a stale stop and discards the old owner's paused output on inventory change", async () => {
  let next = inventory;
  const writes: RequestInit[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (init.method === "POST") {
        writes.push(init);
        return reply({}, 409);
      }
      return reply(url.includes("/output?") ? output : next);
    }),
  );
  const ui = view();
  fireEvent.click(await screen.findByTestId("background-processes"));
  fireEvent.click(screen.getByTestId("process-open"));
  expect(await screen.findByText("Synthetic output")).toBeTruthy();
  fireEvent.click(screen.getByTestId("process-follow"));
  next = {
    ...inventory,
    owner_generation: "og_new",
    processes: [{ ...inventory.processes[0], process_token: "pt_new" }],
  };
  fireEvent.click(screen.getByTestId("process-stop"));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(JSON.parse(writes[0].body as string)).toEqual({
    owner_generation: "og_example",
    process_token: "pt_example",
    force: false,
  });
  expect(
    (writes[0].headers as Record<string, string>)["X-Agent-Host-CSRF"],
  ).toBe("synthetic-csrf");
  await waitFor(() =>
    expect(screen.queryByText("Synthetic output")).toBeNull(),
  );

  ui.unmount();
});
it("shows typed completions without raw command previews and does not join recycled IDs", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => reply(inventory)),
  );
  const event: ProcessEvent = {
    kind: "success",
    process_id: "proc_example",
    process_name: "testit",
    command_preview: "must-not-be-rendered",
    exit_code: 0,
    signal: null,
    end_reason: null,
    delivery: "wake",
    run_ids: [],
  };
  const ui = view(
    <>
      <ProcessCompletion event={event} />
      <ProcessStartCard
        argumentsText={'{"action":"start","name":"testit"}'}
        result={'{"id":"proc_example","process_token":"old-token"}'}
      />
    </>,
  );
  fireEvent.click(screen.getByRole("button"));
  await screen.findByTestId("background-processes");
  expect(screen.queryByText("must-not-be-rendered")).toBeNull();
  expect(screen.queryByTestId("process-receipt-open")).toBeNull();
  fireEvent.click(screen.getByTestId("process-inventory"));
  expect(
    within(screen.getByRole("tabpanel")).getByTestId("process-open"),
  ).toBeTruthy();
  ui.unmount();
});

it("reads an exit code as an ended process, not a crash; a failed start stays red", () => {
  const event: ProcessEvent = {
    kind: "crash",
    process_id: "proc_example",
    process_name: "odota",
    command_preview: "",
    exit_code: 4,
    signal: null,
    end_reason: null,
    delivery: null,
    run_ids: ["01m531x6y92ggdqcmb1exzmnya"],
  };
  const ui = view(
    <>
      <ProcessCompletion event={event} />
      <ProcessCompletion
        event={{ ...event, process_name: "muu", exit_code: 3, run_ids: [] }}
      />
      <ProcessCompletion
        event={{ ...event, process_name: "rikki", end_reason: "spawn_error" }}
      />
    </>,
  );
  const [wait, other, broken] = screen.getAllByTestId("process-completion");
  expect(wait.dataset.tone).toBe("neutral");
  expect(other.dataset.tone).toBe("neutral");
  expect(broken.dataset.tone).toBe("err");
  ui.unmount();
});

it("a fenced start receipt follows the running process rather than presenting start success as completion", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => reply(inventory)),
  );
  const ui = view(
    <ProcessAwareToolUse
      name="process"
      state="succeeded"
      argumentsText={'{"action":"start","name":"testit"}'}
      result={JSON.stringify({
        id: "proc_example",
        startTime: inventory.processes[0].started_at,
      })}
    >
      <p>native call details</p>
    </ProcessAwareToolUse>,
  );
  await waitFor(() =>
    expect(
      ui.container.querySelector(".ah-tool-row")?.getAttribute("data-state"),
    ).toBe("running"),
  );
  ui.unmount();
});

it("keeps observed live delivery across a history refresh without inventing historical labels", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => reply(inventory)),
  );
  const event: ProcessEvent = {
    kind: "success",
    process_id: "proc_example",
    process_name: "live-test",
    command_preview: "",
    exit_code: 0,
    signal: null,
    end_reason: null,
    delivery: null,
    run_ids: [],
    notification_key: "proc_example:123:success",
  };
  const ui = view(
    <>
      <ProcessCompletion event={event} />
      <ProcessCompletion
        event={{
          ...event,
          process_name: "old-test",
          notification_key: "proc_example:122:success",
        }}
      />
    </>,
  );
  await screen.findByTestId("background-processes");
  expect(
    screen
      .getAllByTestId("process-completion")
      .every((row) => !row.hasAttribute("data-delivery")),
  ).toBe(true);
  await act(async () =>
    listener(id, "process.notification", { ...event, delivery: "wake" }),
  );
  expect(
    screen
      .getAllByTestId("process-completion")[0]
      .getAttribute("data-delivery"),
  ).toBe("wake");
  expect(
    screen
      .getAllByTestId("process-completion")[1]
      .getAttribute("data-delivery"),
  ).toBeNull();
  ui.unmount();
});

it.each(["token", "owner"])(
  "does not transfer a selected output to a replacement %s lifetime",
  async (replacement) => {
    let next = structuredClone(inventory);
    const outputs: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/output?")) {
          outputs.push(url);
          return reply({
            ...output,
            owner_generation: next.owner_generation,
            process_token: next.processes[0].process_token,
            lines: [
              {
                stream: "stdout",
                text:
                  outputs.length === 1
                    ? "original output"
                    : "replacement output",
              },
            ],
          });
        }
        return reply(next);
      }),
    );
    const ui = view();
    fireEvent.click(await screen.findByTestId("background-processes"));
    fireEvent.click(screen.getByTestId("process-open"));
    await screen.findByText("original output");
    if (replacement === "owner")
      next = { ...next, owner_generation: "og_replacement" };
    else
      next = {
        ...next,
        processes: [{ ...next.processes[0], process_token: "pt_replacement" }],
      };
    await act(async () => listener(id, "process.changed"));
    await screen.findByTestId("process-output-unavailable");
    expect(outputs.some((url) => url.includes("replacement"))).toBe(false);
    expect(screen.queryByText("original output")).toBeNull();
    fireEvent.click(screen.getByTestId("process-close"));
    fireEvent.click(screen.getByTestId("process-open"));
    await screen.findByText("replacement output");
    expect(outputs.at(-1)).toContain("replacement");
    ui.unmount();
  },
);
it("shows what a restart cut off while Pi is stopped, without controls, and leaves a cut-off wait to its spinoff", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      reply({
        schema_version: 1,
        owner_generation: null,
        availability: "unavailable",
        unavailable_reason: "pi_not_running",
        processes: [],
        interrupted: [
          ...inventory.interrupted,
          {
            ...inventory.interrupted[0],
            id: "proc_0001",
            name: "spinoff-odotus",
            run_ids: ["01m531x6y92ggdqcmb1exzmnya"],
          },
        ],
      }),
    ),
  );
  const ui = view();
  fireEvent.click(await screen.findByTestId("background-processes"));
  expect(screen.getByText("kehityspalvelin")).toBeTruthy();

  expect(screen.queryByText("spinoff-odotus")).toBeNull();
  expect(screen.queryByTestId("process-stop")).toBeNull();

  ui.unmount();
});
