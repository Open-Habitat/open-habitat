import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Status } from "./conversations";
import { useNextWaitingWindow } from "./nextWaiting";

const idle = { state: "idle", run_active: false } as Status;
const running = { ...idle, state: "accepted", run_active: true } as Status;
const settled = {
  ...idle,
  turn_settled: { state: "settled", native_key: "reply", observed_at: "now" },
} as Status;
type Props = {
  id: string;
  status: Status;
  stale: boolean;
  archived?: boolean;
};
function setup() {
  const initialProps: Props = { id: "a", status: idle, stale: false };
  return renderHook(
    ({ id, status, stale, archived = false }: Props) =>
      useNextWaitingWindow(id, status, stale, archived),
    { initialProps },
  );
}
describe("accepted-send and arrival window", () => {
  it("opens on return to a working conversation after its first fresh status", () => {
    const { result, rerender } = setup();
    rerender({ id: "b", status: running, stale: true });
    expect(result.current.open).toBe(false);
    rerender({ id: "b", status: running, stale: false });
    expect(result.current.open).toBe(true);
    rerender({ id: "b", status: settled, stale: false });
    expect(result.current.open).toBe(false);
    rerender({ id: "b", status: running, stale: false });
    expect(result.current.open).toBe(false);
    rerender({ id: "a", status: running, stale: false });
    expect(result.current.open).toBe(true);
  });
  it("opens on acceptance before running, ends at a fast settled turn and never reopens from status alone", () => {
    const { result, rerender } = setup();
    act(() => result.current.outcome("pending"));
    expect(result.current.open).toBe(false);
    act(() => result.current.outcome("accepted"));
    expect(result.current.open).toBe(true);
    rerender({ id: "a", status: settled, stale: false });
    expect(result.current.open).toBe(false);
    rerender({ id: "a", status: running, stale: false });
    expect(result.current.open).toBe(false);
  });
  it("a late acknowledgement cannot reopen a finished turn", () => {
    const { result, rerender } = setup();
    act(() => result.current.outcome("pending"));
    rerender({ id: "a", status: settled, stale: false });
    act(() => result.current.outcome("accepted"));
    expect(result.current.open).toBe(false);
  });
  it("drops old-visit replies, even after returning to the same conversation", () => {
    const { result, rerender } = setup();
    const old = result.current.outcome;
    act(() => {
      old("pending");
      old("accepted");
    });
    rerender({ id: "b", status: idle, stale: false });
    expect(result.current.open).toBe(false);
    rerender({ id: "a", status: idle, stale: false });
    act(() => old("accepted"));
    expect(result.current.open).toBe(false);
  });
  it("does not mistake stale status for turn end, but closes on failure or confirmed idle", () => {
    const { result, rerender } = setup();
    rerender({ id: "a", status: running, stale: false });
    act(() => {
      result.current.outcome("pending");
      result.current.outcome("accepted");
    });
    rerender({ id: "a", status: idle, stale: true });
    expect(result.current.open).toBe(false);
    rerender({ id: "a", status: running, stale: false });
    expect(result.current.open).toBe(true);
    act(() => result.current.outcome("failed"));
    expect(result.current.open).toBe(false);
    act(() => {
      result.current.outcome("pending");
      result.current.outcome("accepted");
    });
    rerender({ id: "a", status: idle, stale: false });
    expect(result.current.open).toBe(false);
  });
  it("closes when the conversation is archived, even while its turn runs", () => {
    const { result, rerender } = setup();
    rerender({ id: "a", status: running, stale: false, archived: false });
    act(() => {
      result.current.outcome("pending");
      result.current.outcome("accepted");
    });
    expect(result.current.open).toBe(true);
    rerender({ id: "a", status: running, stale: false, archived: true });
    expect(result.current.open).toBe(false);
  });
});
