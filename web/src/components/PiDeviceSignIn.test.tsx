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
    const link = view.getByRole("link", {
      name: /Avaa OpenAI:n vahvistussivu/,
    });
    expect(link.getAttribute("href")).toBe(instructions.verificationUri);
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(view.getByText(instructions.userCode)).toBeTruthy();
    expect(window.location.href).not.toContain(instructions.userCode);
    view.rerender(<PiDeviceSignIn view={{ phase: "connected" }} />);
    expect(view.queryByText(instructions.userCode)).toBeNull();
    expect(view.queryByRole("link")).toBeNull();
    expect(view.getByText("Pi-yhteys vahvistettu")).toBeTruthy();
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
      expect(view.getByRole("alert").textContent).toMatch(
        /ei voi näyttää turvallisesti/,
      );
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
      await user.click(view.getByRole("button", { name: "Kopioi koodi" }));
      await waitFor(() =>
        expect(view.getByText("Koodi kopioitu leikepöydälle.")).toBeTruthy(),
      );
      expect(writeText).toHaveBeenCalledWith(instructions.userCode);
      expect(window.location.href).not.toContain(instructions.userCode);
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      writeText.mockRejectedValueOnce(new Error("private clipboard error"));
      await user.click(view.getByRole("button", { name: "Kopioi koodi" }));
      await waitFor(() =>
        expect(view.getByText(/Kopiointi ei onnistunut/)).toBeTruthy(),
      );
      expect(view.container.textContent).not.toContain(
        "private clipboard error",
      );
      view.rerender(
        <PiDeviceSignIn view={{ ...instructions, userCode: "OTHER-TEST" }} />,
      );
      expect(view.queryByText(/Kopiointi ei onnistunut/)).toBeNull();
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
    expect(view.getByText("Kirjautumisyritys päättyi")).toBeTruthy();
    expect(view.getByText(/Vahvistuksen tulosta ei tiedetä/)).toBeTruthy();
    expect(view.queryByText("Tarkistetaan tilaa")).toBeNull();
    expect(view.queryByText("Pi-kirjautuminen tarvitaan")).toBeNull();
    view.rerender(
      <PiDeviceSignIn view={{ phase: "expired" }} onRetry={retry} />,
    );
    expect(view.getByText("Kirjautumisyritys päättyi")).toBeTruthy();
    expect(retry).not.toHaveBeenCalled();
    await user.click(view.getByRole("button", { name: "Aloita uusi yritys" }));
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
    expect(
      view.queryByRole("button", { name: "Aloita uusi yritys" }),
    ).toBeNull();
    await user.click(
      view.getByRole("button", { name: "Peruuta kirjautumisyritys" }),
    );
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
    view.getByRole("button", { name: "Peruuta kirjautumisyritys" }).focus();
    await user.keyboard("{Enter}");
    expect(cancel).toHaveBeenCalledOnce();
    expect(view.getByText("Odotetaan vahvistusta")).toBeTruthy();
    for (const phase of ["expired", "failed"] as const) {
      view.rerender(
        <PiDeviceSignIn
          view={{ phase } satisfies PiDeviceSignInView}
          onRetry={retry}
        />,
      );
      const button = view.getByRole("button", {
        name: "Aloita uusi yritys",
      });
      button.focus();
      await user.keyboard(" ");
    }
    expect(retry).toHaveBeenCalledTimes(2);
    const refresh = vi.fn();
    for (const phase of ["interrupted", "unavailable"] as const) {
      view.rerender(<PiDeviceSignIn view={{ phase }} onRefresh={refresh} />);
      expect(
        view.getByRole("heading", { name: "Kirjautuminen keskeytyi" }),
      ).toBeTruthy();
      expect(
        view.getByText("Tilaa ei voitu vahvistaa").closest("aside")?.className,
      ).toContain("danger");
      expect(
        view.queryByRole("button", { name: "Aloita uusi yritys" }),
      ).toBeNull();
      await user.click(view.getByRole("button", { name: "Tarkista tila" }));
    }
    expect(refresh).toHaveBeenCalledTimes(2);
    view.rerender(
      <PiDeviceSignIn view={{ phase: "connected" }} onRetry={retry} />,
    );
    expect(view.queryByRole("button")).toBeNull();
  });
});
