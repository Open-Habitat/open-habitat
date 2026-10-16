import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import inventory from "../../../contracts/v1/examples/process-inventory.json";
import output from "../../../contracts/v1/examples/process-output.json";
import type { ProcessEvent } from "../app/processes";
import {
  ProcessAwareToolUse,
  ProcessCompletion,
  ProcessProvider,
  ProcessStartCard,
  ProcessTraySlot,
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
      <ProcessTraySlot />
      {children}
    </ProcessProvider>,
  );
}
it("fetches only expanded output; pause freezes the tail and resume refetches, fenced by lifetime", async () => {
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
  fireEvent.click(await screen.findByRole("button", { name: /Prosessit ·/ }));
  expect(calls.filter((url) => url.includes("/output?"))).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "testit" }));
  expect(await screen.findByText("ensimmäinen")).toBeTruthy();
  expect(calls.at(-1)).toContain(
    "owner_generation=og_example&process_token=pt_example&tail_lines=200",
  );
  fireEvent.click(screen.getByRole("button", { name: "Pysäytä seuraaminen" }));
  tail = "toinen";
  await act(async () => listener(id, "process.output"));
  expect(screen.queryByText("toinen")).toBeNull();
  expect(calls.filter((url) => url.includes("/output?"))).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Seuraa loppua" }));
  expect(await screen.findByText("toinen")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "testit" }));
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
  fireEvent.click(await screen.findByRole("button", { name: /Prosessit ·/ }));
  fireEvent.click(screen.getByRole("button", { name: "testit" }));
  expect(await screen.findByText("Synthetic output")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Pysäytä seuraaminen" }));
  next = {
    ...inventory,
    owner_generation: "og_new",
    processes: [{ ...inventory.processes[0], process_token: "pt_new" }],
  };
  fireEvent.click(screen.getByRole("button", { name: /^Pysäytä$/ }));
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
  expect(screen.getByText(/toimintoa ei toistettu/)).toBeTruthy();
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
  fireEvent.click(screen.getByRole("button", { name: /herätti agentin/ }));
  await screen.findByRole("button", { name: /Prosessit ·/ });
  expect(screen.queryByText("must-not-be-rendered")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Näytä prosessi ja tuloste" }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Avaa nykyiset prosessit" }),
  );
  expect(screen.getByRole("button", { name: "testit" })).toBeTruthy();
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
      screen.getByRole("button", {
        name: /process.*start · testit.*Käynnissä/,
      }),
    ).toBeTruthy(),
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
  await screen.findByRole("button", { name: /Prosessit ·/ });
  expect(screen.queryByRole("button", { name: /herätti agentin/ })).toBeNull();
  await act(async () =>
    listener(id, "process.notification", { ...event, delivery: "wake" }),
  );
  expect(
    screen.getByRole("button", { name: /live-test.*herätti agentin/ }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: /old-test/ }).textContent,
  ).not.toContain("herätti");
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
    fireEvent.click(await screen.findByRole("button", { name: /Prosessit ·/ }));
    fireEvent.click(screen.getByRole("button", { name: "testit" }));
    await screen.findByText("original output");
    if (replacement === "owner")
      next = { ...next, owner_generation: "og_replacement" };
    else
      next = {
        ...next,
        processes: [{ ...next.processes[0], process_token: "pt_replacement" }],
      };
    await act(async () => listener(id, "process.changed"));
    await screen.findByText(/Tulostetta ei ole enää saatavilla/);
    expect(outputs.some((url) => url.includes("replacement"))).toBe(false);
    expect(screen.queryByText("original output")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "testit" }));
    await screen.findByText("replacement output");
    expect(outputs.at(-1)).toContain("replacement");
    ui.unmount();
  },
);
