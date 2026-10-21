import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
      within(screen.getByTestId("device-actions")).getByRole("button"),
    );
  });
  expect(screen.getByTestId("device-code").textContent).toBe("TEST-1234");
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
  const newOnLogin = vi.fn();
  view.rerender(
    <PiOnboarding
      onLogin={newOnLogin}
      onUsable={() => {}}
      onLogout={vi.fn()}
    />,
  );
  expect(sessionCSRF).toHaveBeenCalledTimes(sessionsAtStart);
  vi.mocked(piAttempt).mockResolvedValueOnce("login");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(onLogin).not.toHaveBeenCalled();
  expect(newOnLogin).toHaveBeenCalledOnce();
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

it("shows preparation throughout a slow start, then the code; a rejected start still shows a failure", async () => {
  vi.mocked(sessionCSRF).mockResolvedValue(csrf);
  vi.mocked(piStatus).mockResolvedValue("missing");
  let resolveStart!: (value: typeof code) => void;
  vi.mocked(piAttempt)
    .mockResolvedValueOnce("absent")
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStart = resolve;
        }),
    );
  await act(async () => {
    render(
      <PiOnboarding onLogin={vi.fn()} onUsable={vi.fn()} onLogout={vi.fn()} />,
    );
  });
  fireEvent.click(
    within(screen.getByTestId("device-actions")).getByRole("button"),
  );
  expect(screen.getByTestId("device-sign-in").getAttribute("data-phase")).toBe(
    "waiting",
  );
  expect(
    screen.getByTestId("device-sign-in").getAttribute("data-phase"),
  ).not.toBe("interrupted");
  await waitFor(() => expect(resolveStart).toBeTypeOf("function"));
  await act(async () => {
    resolveStart(code);
  });
  expect(screen.getByTestId("device-code").textContent).toBe("TEST-1234");
  expect(screen.getByTestId("device-sign-in").getAttribute("data-phase")).toBe(
    "pending",
  );

  vi.mocked(piAttempt).mockRejectedValueOnce(new Error("start failed"));
  await act(async () => {
    fireEvent.click(
      within(screen.getByTestId("device-actions")).getByRole("button"),
    );
  });
  expect(screen.getByTestId("device-sign-in").getAttribute("data-phase")).toBe(
    "interrupted",
  );
});

it("keeps cancellation neutral until its outcome is known", async () => {
  vi.mocked(sessionCSRF).mockResolvedValue(csrf);
  vi.mocked(piStatus).mockResolvedValue("missing");
  let rejectCancel!: (error: Error) => void;
  vi.mocked(piAttempt)
    .mockResolvedValueOnce("absent")
    .mockResolvedValueOnce(code)
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectCancel = reject;
        }),
    );
  await act(async () => {
    render(
      <PiOnboarding onLogin={vi.fn()} onUsable={vi.fn()} onLogout={vi.fn()} />,
    );
  });
  await act(async () => {
    fireEvent.click(
      within(screen.getByTestId("device-actions")).getByRole("button"),
    );
  });
  fireEvent.click(
    within(screen.getByTestId("device-actions")).getByRole("button"),
  );
  expect(screen.getByTestId("device-sign-in").getAttribute("data-phase")).toBe(
    "cancelling",
  );
  expect(
    screen.getByTestId("device-sign-in").getAttribute("data-phase"),
  ).not.toBe("interrupted");
  await waitFor(() => expect(rejectCancel).toBeTypeOf("function"));
  await act(async () => {
    rejectCancel(new Error("cancel failed"));
  });
  expect(screen.getByTestId("device-sign-in").getAttribute("data-phase")).toBe(
    "interrupted",
  );
});

it("stops an active poll when its view closes", async () => {
  vi.mocked(sessionCSRF).mockResolvedValue(csrf);
  vi.mocked(piStatus).mockResolvedValue("missing");
  vi.mocked(piAttempt).mockResolvedValueOnce("absent").mockResolvedValue(code);
  vi.useFakeTimers();
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <PiOnboarding onLogin={vi.fn()} onUsable={vi.fn()} onLogout={vi.fn()} />,
    );
  });
  await act(async () => {
    fireEvent.click(
      within(screen.getByTestId("device-actions")).getByRole("button"),
    );
  });
  expect(screen.getByTestId("device-code").textContent).toBe("TEST-1234");
  const reads = vi.mocked(piAttempt).mock.calls.length;
  view.unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(6000);
  });
  expect(piAttempt).toHaveBeenCalledTimes(reads);
});
