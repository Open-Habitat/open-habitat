import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ServerStorage } from "./ServerStorage";

const GiB = 2 ** 30;
afterEach(() => vi.restoreAllMocks());

type Quota = {
  id: string;
  username: string;
  administrator: boolean;
  unavailable: boolean;
  usage_bytes: number;
  limit_bytes: number;
};
function host({
  users,
  defaultLimit = 8 * GiB,
  limits,
  capacity = 4 * GiB,
  free = GiB,
  overcommitted = false as boolean | null,
  writes = [] as { url: string; body: unknown }[],
}: {
  users: Quota[];
  defaultLimit?: number;
  limits?: "not_in_use";
  capacity?: number;
  free?: number;
  overcommitted?: boolean | null;
  writes?: { url: string; body: unknown }[];
}) {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      writes.push({ url, body });
      if (url.endsWith("/storage"))
        for (const u of users)
          if (u.id === body.subject) u.limit_bytes = body.limit_bytes;
      if (url.endsWith("/administration"))
        defaultLimit = body.default_limit_bytes;
      return new Response(null, { status: 204 });
    }
    return new Response(
      JSON.stringify(
        url.endsWith("/storage")
          ? {
              schema_version: 1,
              ...(limits ? { limits } : {}),
              users: limits ? [] : users,
              filesystem: { capacity_bytes: capacity, free_bytes: free },
              overcommitted: limits ? null : overcommitted,
            }
          : {
              schema_version: 1,
              default_language: "system",
              default_limit_bytes: defaultLimit,
              name: "Example",
              users: users.map(({ id, username, administrator }) => ({
                id,
                username,
                administrator,
              })),
            },
      ),
      { status: 200 },
    );
  });
  return writes;
}
const alice = (limit = 8 * GiB): Quota => ({
  id: "42",
  username: "alice",
  administrator: true,
  unavailable: false,
  usage_bytes: GiB,
  limit_bytes: limit,
});

it("shows the disk as a meter and each person's use beside their limit", async () => {
  host({ users: [alice()], overcommitted: true });
  render(<ServerStorage csrf="csrf" />);
  const input = (await screen.findByTestId(
    "storage-limit-alice-input",
  )) as HTMLInputElement;
  expect(input.value).toBe("8");
  const meter = screen.getByTestId("server-storage");
  expect(meter.querySelector(".ah-meter-now")?.getAttribute("style")).toContain(
    "75%",
  );
  // The limits together exceed the disk: the meter says so.
  expect(meter.querySelector(".ah-meter-over")).toBeTruthy();
  expect(
    screen
      .getByTestId("storage-use-alice")
      .querySelector(".s-bar > span")
      ?.getAttribute("style"),
  ).toContain("12.5%");
  // A limit equal to the default is the default: nothing to return.
  expect(screen.queryByTestId("storage-limit-alice-reset")).toBeNull();
});

it("writes a stepped limit once it settles, and Oletukseen sets the current default", async () => {
  const writes = host({ users: [alice()], capacity: 400 * GiB });
  render(<ServerStorage csrf="csrf" />);
  await screen.findByTestId("storage-limit-alice-input");
  fireEvent.click(screen.getByTestId("storage-limit-alice-more"));
  fireEvent.click(screen.getByTestId("storage-limit-alice-more"));
  // The stepped value shows at once and its use is measured against it.
  expect(
    (screen.getByTestId("storage-limit-alice-input") as HTMLInputElement).value,
  ).toBe("18");
  await waitFor(() =>
    expect(writes).toEqual([
      {
        url: "/api/v1/server/storage",
        body: { subject: "42", limit_bytes: 18 * GiB },
      },
    ]),
  );
  const reset = await screen.findByTestId("storage-limit-alice-reset");
  expect(
    screen.getByTestId("administration-user-alice").dataset.own,
  ).toBeDefined();
  fireEvent.click(reset);
  await waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[1].body).toEqual({ subject: "42", limit_bytes: 8 * GiB });
  await waitFor(() =>
    expect(screen.queryByTestId("storage-limit-alice-reset")).toBeNull(),
  );
  fireEvent.click(screen.getByTestId("default-limit-more"));
  await waitFor(() => expect(writes).toHaveLength(3));
  expect(writes[2]).toEqual({
    url: "/api/v1/server/administration",
    body: { default_limit_bytes: 13 * GiB },
  });
});

it("shows healthy storage beside an unavailable account without claiming capacity is safe", async () => {
  host({
    users: [
      alice(),
      {
        id: "43",
        username: "bob",
        administrator: false,
        unavailable: true,
        usage_bytes: 0,
        limit_bytes: 0,
      },
    ],
    capacity: 40 * GiB,
    free: 32 * GiB,
    overcommitted: null,
  });
  render(<ServerStorage csrf="csrf" />);
  expect(await screen.findByText("1 GiB / 8 GiB")).toBeTruthy();
  expect(
    screen.getByTestId("administration-user-bob").dataset.storageState,
  ).toBe("unknown");
  expect(screen.queryByTestId("storage-limit-bob")).toBeNull();
  const meter = screen.getByTestId("server-storage");
  expect(meter.dataset.overcommitted).toBe("unknown");
  // Without every limit the worst case is not drawn.
  expect(meter.querySelector(".ah-meter-worst")).toBeNull();
});

it("says limits are not in use and offers no limit editing without quotas", async () => {
  host({ users: [alice()], limits: "not_in_use", defaultLimit: 0 });
  render(<ServerStorage csrf="csrf" />);
  const disk = await screen.findByTestId("server-storage");
  expect(disk.dataset.limits).toBe("not_in_use");
  expect(screen.getByTestId("administration-user-alice").textContent).toContain(
    "Ei rajaa",
  );
  expect(screen.queryByTestId("storage-limit-alice")).toBeNull();
  expect(screen.queryByTestId("default-limit")).toBeNull();
});
