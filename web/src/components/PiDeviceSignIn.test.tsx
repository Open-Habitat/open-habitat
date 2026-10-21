import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PiDeviceSignIn, type PiDeviceSignInView } from "./PiDeviceSignIn";

const instructions = {
  phase: "ready",
  verificationUri: "https://auth.openai.com/codex/device",
  userCode: "TEST-ONLY-42",
} as const;

describe("Pi device sign-in presentation", () => {
  it("shows supplied code only while active, with a clean external provider link", () => {
    const view = render(<PiDeviceSignIn view={instructions} />);
    const link = view.getByRole("link");
    expect(link.getAttribute("href")).toBe(instructions.verificationUri);
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(view.getByText(instructions.userCode)).toBeTruthy();
    expect(window.location.href).not.toContain(instructions.userCode);
    view.rerender(<PiDeviceSignIn view={{ phase: "connected" }} />);
    expect(view.queryByText(instructions.userCode)).toBeNull();
    expect(view.queryByRole("link")).toBeNull();
  });

  it.each([
    "http://auth.openai.com/codex/device",
    "https://auth.openai.com.evil.example/device",
    "https://auth.openai.com@evil.example/device",
    "https://evil.example/device",
    "javascript:alert(1)",
    "https://auth.openai.com/device?code=SECRET",
    "https://auth.openai.com/device#SECRET",
    "https://user:pass@auth.openai.com/device",
    "https://auth.openai.com:444/device",
    "not a url",
  ])(
    "refuses unsafe provider URI %s without leaking code to navigation",
    (uri) => {
      const view = render(
        <PiDeviceSignIn
          view={{ ...instructions, verificationUri: uri }}
          onRetry={() => {}}
        />,
      );
      expect(view.queryByRole("link")).toBeNull();
      expect(view.queryByText(instructions.userCode)).toBeNull();
      expect(view.getByRole("alert")).toBeTruthy();
      expect(window.location.href).not.toContain(instructions.userCode);
    },
  );

  it("copies only the code, announces success or failure without logging or navigating", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const log = vi.spyOn(console, "log");
    const error = vi.spyOn(console, "error");
    const original = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    try {
      const view = render(<PiDeviceSignIn view={instructions} />);
      await user.click(view.getByTestId("pi-code-copy"));
      await waitFor(() =>
        expect(view.getByTestId("pi-code-copy-result")).toBeTruthy(),
      );
      expect(writeText).toHaveBeenCalledWith(instructions.userCode);
      expect(window.location.href).not.toContain(instructions.userCode);
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      writeText.mockRejectedValueOnce(new Error("private clipboard error"));
      await user.click(view.getByTestId("pi-code-copy"));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
      expect(view.container.textContent).not.toContain(
        "private clipboard error",
      );
      view.rerender(
        <PiDeviceSignIn view={{ ...instructions, userCode: "OTHER-TEST" }} />,
      );
      expect(view.queryByTestId("pi-code-copy-result")).toBeNull();
    } finally {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: original,
      });
      log.mockRestore();
      error.mockRestore();
    }
  });

  it("keeps a settled missing-attempt outcome while checking and offers only an explicit retry", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    const view = render(
      <PiDeviceSignIn view={{ phase: "expired" }} checking onRetry={retry} />,
    );

    view.rerender(
      <PiDeviceSignIn view={{ phase: "expired" }} onRetry={retry} />,
    );

    expect(retry).not.toHaveBeenCalled();
    await user.click(view.getByTestId("pi-signin-start"));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("permits cancellation while the native helper prepares a code, without offering a duplicate start", async () => {
    const user = userEvent.setup();
    const cancel = vi.fn();
    const view = render(
      <PiDeviceSignIn
        view={{ phase: "waiting" }}
        onCancel={cancel}
        onRetry={() => {}}
      />,
    );
    expect(view.queryByTestId("pi-signin-start")).toBeNull();
    await user.click(view.getByTestId("pi-signin-cancel"));
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("supports keyboard cancel and retry without changing server-owned state", async () => {
    const user = userEvent.setup();
    const cancel = vi.fn();
    const retry = vi.fn();
    const view = render(
      <PiDeviceSignIn
        view={{ ...instructions, phase: "pending" }}
        onCancel={cancel}
        onRetry={retry}
      />,
    );
    view.getByTestId("pi-signin-cancel").focus();
    await user.keyboard("{Enter}");
    expect(cancel).toHaveBeenCalledOnce();

    for (const phase of ["expired", "failed"] as const) {
      view.rerender(
        <PiDeviceSignIn
          view={{ phase } satisfies PiDeviceSignInView}
          onRetry={retry}
        />,
      );
      const button = view.getByTestId("pi-signin-start");
      button.focus();
      await user.keyboard(" ");
    }
    expect(retry).toHaveBeenCalledTimes(2);
    const refresh = vi.fn();
    for (const phase of ["interrupted", "unavailable"] as const) {
      view.rerender(<PiDeviceSignIn view={{ phase }} onRefresh={refresh} />);
      expect(view.getAllByRole("heading")).toBeTruthy();
      expect(view.container.querySelector("aside")?.className).toContain(
        "danger",
      );
      expect(view.queryByTestId("pi-signin-start")).toBeNull();
      await user.click(view.getByRole("button"));
    }
    expect(refresh).toHaveBeenCalledTimes(2);
    view.rerender(
      <PiDeviceSignIn view={{ phase: "connected" }} onRetry={retry} />,
    );
    expect(view.queryByRole("button")).toBeNull();
  });
});
