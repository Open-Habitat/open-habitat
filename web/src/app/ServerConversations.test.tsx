import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ServerConversations } from "./ServerConversations";

const GiB = 1024 ** 3;
const users = [
  { id: "42", username: "alice", administrator: true },
  { id: "43", username: "bob", administrator: false },
];

function host(
  start: {
    default_limit: number | null;
    people: { id: string; limit: number }[];
  },
  status = 200,
) {
  let state = { ...start };
  const writes: unknown[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/administration"))
      return new Response(
        JSON.stringify({
          schema_version: 1,
          name: "Example",
          default_language: "system",
          default_limit_bytes: GiB,
          users,
        }),
      );
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      writes.push(body);
      if (status !== 200) return new Response(null, { status });
      if (body.subject === undefined)
        state = { ...state, default_limit: body.limit };
      else
        state = {
          ...state,
          people: [
            ...state.people.filter((p) => p.id !== body.subject),
            ...(body.limit === null
              ? []
              : [{ id: body.subject, limit: body.limit }]),
          ],
        };
    }
    return new Response(
      JSON.stringify({
        schema_version: 1,
        host_default: 32,
        max_limit: 128,
        child_bytes: 210 * 1024 ** 2,
        memory: { total_bytes: 16 * GiB, available_bytes: 10 * GiB },
        ...state,
      }),
    );
  });
  return writes;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("shows memory first and estimates from the limits alone", async () => {
  host({ default_limit: 12, people: [{ id: "43", limit: 60 }] });
  render(<ServerConversations csrf="csrf" />);
  await screen.findByTestId("live-limits");
  // alice 12 + bob 60 = 72 conversations of 210 MiB, about 14.77 GiB.
  expect(screen.getByTestId("live-worst").textContent).toContain(
    "72 keskustelua",
  );
  expect(screen.queryByTestId("live-over")).toBeNull();
  expect(screen.getByTestId("live-person-bob").hasAttribute("data-own")).toBe(
    true,
  );
  expect(screen.getByTestId("live-person-alice").hasAttribute("data-own")).toBe(
    false,
  );
  // The reset is an icon that names the default it restores to.
  expect(
    screen.getByTestId("live-person-bob-reset").getAttribute("aria-label"),
  ).toBe("Palauta oletukseen (12 keskustelua): bob");
  expect(screen.queryByTestId("live-person-alice-reset")).toBeNull();
  // Nothing in the view says how many conversations someone has working.
  expect(document.body.textContent).not.toMatch(/työssä nyt/i);
});

it("moves the estimate at once and writes once after the last press", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const writes = host({ default_limit: null, people: [] });
  render(<ServerConversations csrf="csrf" />);
  await screen.findByTestId("live-limits");
  expect(screen.getByTestId("live-worst").textContent).toContain(
    "64 keskustelua",
  );
  for (let i = 0; i < 8; i++)
    fireEvent.click(screen.getByTestId("live-default-more"));
  // 40 each: over the host default, and the estimate follows at once.
  expect(screen.getByTestId("live-worst").textContent).toContain(
    "80 keskustelua",
  );
  expect(document.body.textContent).toContain(
    "Yli palvelimen oman oletuksen 32",
  );
  expect(screen.getByTestId("live-over")).toBeTruthy();
  expect(writes).toEqual([]);
  await act(async () => {
    vi.advanceTimersByTime(600);
  });
  await screen.findByText("Raja henkilöä kohden");
  expect(writes).toEqual([{ limit: 40 }]);
  // A person's own limit, and back to the default.
  fireEvent.click(screen.getByTestId("live-person-bob-limit-less"));
  await act(async () => {
    vi.advanceTimersByTime(600);
  });
  expect(writes.at(-1)).toEqual({ subject: "43", limit: 39 });
  fireEvent.click(await screen.findByTestId("live-person-bob-reset"));
  await act(async () => {
    vi.advanceTimersByTime(600);
  });
  expect(writes.at(-1)).toEqual({ subject: "43", limit: null });
});

it("says an unconfirmed change is uncertain", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  host({ default_limit: 12, people: [] }, 503);
  render(<ServerConversations csrf="csrf" />);
  await screen.findByTestId("live-limits");
  fireEvent.click(screen.getByTestId("live-default-more"));
  await act(async () => {
    vi.advanceTimersByTime(600);
  });
  expect((await screen.findByTestId("live-status")).textContent).toContain(
    "Muutosta ei voitu vahvistaa",
  );
});

it("sends one change at a time, so a slow reply cannot undo a newer one", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  let release: () => void = () => {};
  const sent: unknown[] = [];
  let state: number | null = null;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (String(input).endsWith("/administration"))
      return new Response(
        JSON.stringify({
          schema_version: 1,
          name: "Example",
          default_language: "system",
          default_limit_bytes: GiB,
          users,
        }),
      );
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      sent.push(body);
      if (sent.length === 1) await new Promise<void>((r) => (release = r));
      state = body.limit;
    }
    return new Response(
      JSON.stringify({
        schema_version: 1,
        default_limit: state,
        host_default: 32,
        max_limit: 128,
        child_bytes: 210 * 1024 ** 2,
        memory: null,
        people: [],
      }),
    );
  });
  render(<ServerConversations csrf="csrf" />);
  await screen.findByTestId("live-limits");
  fireEvent.click(screen.getByTestId("live-default-more"));
  await act(async () => {
    vi.advanceTimersByTime(600);
  });
  fireEvent.click(screen.getByTestId("live-default-more"));
  await act(async () => {
    vi.advanceTimersByTime(600);
  });
  // The second change waits for the first reply.
  expect(sent).toEqual([{ limit: 33 }]);
  expect(screen.getByTestId("live-default-input")).toHaveProperty(
    "value",
    "34",
  );
  await act(async () => release());
  await act(async () => {
    vi.advanceTimersByTime(50);
  });
  expect(sent).toEqual([{ limit: 33 }, { limit: 34 }]);
  expect(screen.getByTestId("live-default-input")).toHaveProperty(
    "value",
    "34",
  );
});
