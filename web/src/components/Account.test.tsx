import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getThemeChoice, setThemeChoice } from "../theme";
import {
  AccountLogoutDialog,
  AccountSettings,
  AccountShelf,
  accountLabel,
} from "./Account";

describe("account presentation", () => {
  it("shares name, email and image across compact rail, opened menu and settings, with image fallback", async () => {
    const profile = {
      name: "Alice Example",
      email: "alice@example.invalid",
      avatar_url: "https://avatars.githubusercontent.com/u/42",
    };
    render(
      <>
        <AccountShelf
          profile={profile}
          onSettings={() => {}}
          onLogout={() => {}}
        />
        <AccountSettings profile={profile} onBack={() => {}} />
      </>,
    );
    expect(screen.getByTestId("menu-trigger")).toBeTruthy();
    expect(screen.getByText("alice@example.invalid")).toBeTruthy();
    fireEvent.click(screen.getByTestId("menu-trigger"));
    expect(await screen.findAllByText("alice@example.invalid")).toHaveLength(2);
    const images = document.querySelectorAll<HTMLImageElement>(
      ".ah-account-avatar img",
    );
    expect(images.length).toBeGreaterThan(0);
    fireEvent.error(images[0]);
    expect(
      document.querySelector(".ah-account-trigger .ah-account-avatar")
        ?.textContent,
    ).toBe("A");
  });
  it("keeps the settings radio in sync with a theme change made elsewhere", () => {
    setThemeChoice("light");
    try {
      render(<AccountSettings name="Oma tili" onBack={() => {}} />);
      fireEvent.click(screen.getByTestId("settings-section-ulkoasu"));
      expect(
        screen.getByTestId("segment-light").getAttribute("aria-pressed"),
      ).toBe("true");
      act(() => setThemeChoice("dark"));
      expect(
        screen.getByTestId("segment-dark").getAttribute("aria-pressed"),
      ).toBe("true");
    } finally {
      act(() => setThemeChoice("system"));
    }
  });
  it("remembers the applied choice when browser storage is blocked", () => {
    const get = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("disabled");
      });
    const put = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("disabled");
      });
    try {
      act(() => setThemeChoice("dark"));
      expect(getThemeChoice()).toBe("dark");
      render(<AccountSettings name="Oma tili" onBack={() => {}} />);
      fireEvent.click(screen.getByTestId("settings-section-ulkoasu"));
      expect(
        screen.getByTestId("segment-dark").getAttribute("aria-pressed"),
      ).toBe("true");
    } finally {
      get.mockRestore();
      put.mockRestore();
      act(() => setThemeChoice("system"));
    }
  });
  it("shows only the chosen section and prefixes theme choices with shared icons", () => {
    render(
      <AccountSettings name="Oma tili" onBack={() => {}} onLogout={() => {}} />,
    );
    expect(screen.getByTestId("account-logout")).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();
    fireEvent.click(screen.getByTestId("settings-section-ulkoasu"));
    expect(screen.getByRole("group").querySelectorAll("svg")).toHaveLength(3);
    expect(screen.queryByTestId("account-logout")).toBeNull();
  });
  it("keeps the account popover actions and selected theme", async () => {
    setThemeChoice("dark");
    try {
      render(
        <AccountShelf
          name="Oma tili"
          onSettings={() => {}}
          onLogout={() => {}}
        />,
      );
      fireEvent.click(screen.getByTestId("menu-trigger"));
      const option = await screen.findByTestId("segment-dark");
      expect(option.getAttribute("aria-pressed")).toBe("true");

      expect(screen.getByTestId("menu-item-settings")).toBeTruthy();
      expect(screen.getByTestId("menu-item-logout")).toBeTruthy();
    } finally {
      act(() => setThemeChoice("system"));
    }
  });
  it("only presents administration from the host-granted callback and returns focus on Escape", async () => {
    const onAdministration = vi.fn();
    const { rerender } = render(
      <AccountShelf
        name="Alice Example"
        onSettings={() => {}}
        onLogout={() => {}}
      />,
    );
    const trigger = screen.getByTestId("menu-trigger");
    fireEvent.click(trigger);
    expect(screen.queryByTestId("menu-item-administration")).toBeNull();
    fireEvent.keyDown(screen.getAllByRole("menu")[0], { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    rerender(
      <AccountShelf
        name="Alice Example"
        onSettings={() => {}}
        onAdministration={onAdministration}
        onLogout={() => {}}
      />,
    );
    fireEvent.click(trigger);
    const admin = await screen.findByTestId("menu-item-administration");
    fireEvent.click(admin);
    expect(onAdministration).toHaveBeenCalledOnce();
  });
  it("supports logout cancellation without confirmation", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <AccountLogoutDialog open onClose={onClose} onConfirm={onConfirm} />,
    );

    fireEvent.click(screen.getByTestId("logout-cancel"));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("allows explicit Pi sign-in across native credential states", () => {
    const signIn = vi.fn();
    const { rerender } = render(
      <AccountSettings
        piState="usable"
        onPiSignIn={signIn}
        onBack={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId("settings-section-yhteydet"));

    fireEvent.click(screen.getByTestId("pi-sign-in"));
    expect(signIn).toHaveBeenCalledOnce();
    rerender(
      <AccountSettings
        piState="missing"
        onPiSignIn={signIn}
        onBack={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId("pi-sign-in"));
    expect(signIn).toHaveBeenCalledTimes(2);
    for (const piState of ["unknown", "unavailable", "checking"] as const) {
      rerender(
        <AccountSettings
          piState={piState}
          onPiSignIn={signIn}
          onBack={() => {}}
        />,
      );
      expect(screen.getByTestId("pi-sign-in")).toBeTruthy();
    }
  });
  it("never presents a provider subject number as a name", () => {
    expect(accountLabel("GitHub user 42")).not.toMatch(/GitHub user|42/);
    expect(accountLabel(" 123 ")).not.toContain("123");
    expect(accountLabel("Alice Example")).toBe("Alice Example");
  });
  it("offers credential removal only for a confirmed native connection", () => {
    const show = (nativeState?: "connected" | "disconnected" | "partial") => (
      <AccountSettings
        csrf="synthetic-csrf"
        nativeState={nativeState}
        onBack={() => {}}
      />
    );
    const { rerender } = render(show());
    fireEvent.click(screen.getByTestId("settings-section-yhteydet"));
    expect(screen.queryByTestId("native-disconnect")).toBeNull();
    for (const state of ["disconnected", "partial"] as const) {
      rerender(show(state));
      expect(screen.queryByTestId("native-disconnect")).toBeNull();
    }
    rerender(show("connected"));
    expect(screen.getByTestId("native-disconnect")).toBeTruthy();
  });
});
