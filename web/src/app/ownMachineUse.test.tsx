import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import example from "../../../contracts/v1/examples/own-machines.json";
import {
  OwnMachineUseProvider,
  useOpenMachines,
  useOwnMachineHosts,
} from "./ownMachineUse";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** The daemon's reply with alice-macbook's connection open or not. */
function serve(open: () => boolean) {
  const fetch = vi.fn(async () =>
    Response.json({
      ...example,
      machines: example.machines.map((m) => ({
        ...m,
        connection_open: open(),
      })),
    }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <OwnMachineUseProvider>{children}</OwnMachineUseProvider>
);

async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(400);
  });
  await act(async () => {});
}

describe("own machines in a conversation", () => {
  it("reads nothing until a command runs ssh", async () => {
    vi.useFakeTimers();
    const fetch = serve(() => false);
    renderHook(() => useOwnMachineHosts([{ command: "ls -la", done: true }]), {
      wrapper,
    });
    await settle();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows a connection the ssh command opened after it started", async () => {
    vi.useFakeTimers();
    let open = false;
    const fetch = serve(() => open);
    const { result, rerender } = renderHook(
      ({ done }) => {
        useOwnMachineHosts([{ command: "ssh alice-macbook -- sw_vers", done }]);
        return useOpenMachines();
      },
      { wrapper, initialProps: { done: false } },
    );
    await settle();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual([]);
    // The connection exists once ssh has connected; the command finishing
    // reads again although the host is the same.
    open = true;
    rerender({ done: true });
    await settle();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual(["alice-macbook"]);
  });

  it("does not show another machine's open connection", async () => {
    vi.useFakeTimers();
    serve(() => true);
    const { result } = renderHook(
      () => {
        useOwnMachineHosts([{ command: "ssh workstation ls", done: true }]);
        return useOpenMachines();
      },
      { wrapper },
    );
    await settle();
    expect(result.current).toEqual([]);
  });
});
