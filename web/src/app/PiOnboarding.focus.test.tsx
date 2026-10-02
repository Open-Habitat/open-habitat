import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PiOnboarding } from "./PiOnboarding";
import { piAttempt, piStatus, sessionCSRF } from "./pi";

vi.mock("./pi", () => ({
  piAttempt: vi.fn(),
  piStatus: vi.fn(),
  sessionCSRF: vi.fn(),
}));
afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

it("invalidates an in-flight periodic reply before verifying a changed session on focus", async () => {
  const code = {
    state: "device_code" as const,
    pi_state: "missing" as const,
    verification_uri: "https://auth.openai.com/codex/device",
    user_code: "OLD-CODE",
  };
  let release!: (value: typeof code) => void;
  vi.mocked(sessionCSRF).mockResolvedValue("a".repeat(43));
  vi.mocked(piStatus).mockResolvedValue("missing");
  vi.mocked(piAttempt)
    .mockResolvedValueOnce("absent")
    .mockResolvedValueOnce(code)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
  vi.useFakeTimers();
  const onUsable = vi.fn();
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <PiOnboarding onLogin={vi.fn()} onUsable={onUsable} onLogout={vi.fn()} />,
    );
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Aloita kirjautuminen" }),
    );
  });
  expect(screen.getByText("OLD-CODE")).toBeTruthy();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  vi.mocked(sessionCSRF).mockResolvedValue("b".repeat(43));
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(onUsable).toHaveBeenCalledOnce();
  expect(screen.queryByText("OLD-CODE")).toBeNull();
  await act(async () => {
    release(code);
  });
  expect(screen.queryByText("OLD-CODE")).toBeNull();
  view.unmount();
});
