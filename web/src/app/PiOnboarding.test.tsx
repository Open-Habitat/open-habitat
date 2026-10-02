import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PiOnboarding } from "./PiOnboarding";
import { piAttempt, piStatus, sessionCSRF } from "./pi";

vi.mock("./pi", () => ({
  piAttempt: vi.fn(),
  piStatus: vi.fn(),
  sessionCSRF: vi.fn(),
}));
const csrf = "a".repeat(43);
const code = {
  state: "device_code" as const,
  pi_state: "missing" as const,
  verification_uri: "https://auth.openai.com/codex/device",
  user_code: "TEST-1234",
};

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

it("polls an active code every 2 seconds without session reads, stops at 401 or on close", async () => {
  vi.mocked(sessionCSRF).mockResolvedValue(csrf);
  vi.mocked(piStatus).mockResolvedValue("missing");
  vi.mocked(piAttempt).mockResolvedValueOnce("absent").mockResolvedValue(code);
  const onLogin = vi.fn();
  vi.useFakeTimers();
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <PiOnboarding onLogin={onLogin} onUsable={vi.fn()} onLogout={vi.fn()} />,
    );
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Aloita kirjautuminen" }),
    );
  });
  expect(screen.getByText("TEST-1234")).toBeTruthy();
  const sessionsAtStart = vi.mocked(sessionCSRF).mock.calls.length;
  const readsAtStart = vi
    .mocked(piAttempt)
    .mock.calls.filter(([method]) => method === "GET").length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1999);
  });
  expect(
    vi.mocked(piAttempt).mock.calls.filter(([method]) => method === "GET"),
  ).toHaveLength(readsAtStart);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(
    vi.mocked(piAttempt).mock.calls.filter(([method]) => method === "GET"),
  ).toHaveLength(readsAtStart + 1);
  expect(sessionCSRF).toHaveBeenCalledTimes(sessionsAtStart);
  vi.mocked(piAttempt).mockResolvedValueOnce("login");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(onLogin).toHaveBeenCalledOnce();
  expect(sessionCSRF).toHaveBeenCalledTimes(sessionsAtStart);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  view.unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  expect(
    vi.mocked(piAttempt).mock.calls.filter(([method]) => method === "GET"),
  ).toHaveLength(readsAtStart + 2);
});
