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
    expect(screen.getByTestId("account-menu-trigger")).toBeTruthy();
    expect(screen.getByText("alice@example.invalid")).toBeTruthy();
    fireEvent.click(screen.getByTestId("account-menu-trigger"));
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
      fireEvent.click(screen.getByTestId("settings-ulkoasu"));
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
      fireEvent.click(screen.getByTestId("settings-ulkoasu"));
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
    expect(screen.getByTestId("logout-open")).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();
    fireEvent.click(screen.getByTestId("settings-ulkoasu"));
    expect(screen.getByRole("group").querySelectorAll("svg")).toHaveLength(3);
    expect(screen.queryByTestId("logout-open")).toBeNull();
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
      fireEvent.click(screen.getByTestId("account-menu-trigger"));
      const option = await screen.findByTestId("segment-dark");
      expect(option.getAttribute("aria-pressed")).toBe("true");

      expect(screen.getByTestId("menu-settings")).toBeTruthy();
      expect(screen.getByTestId("menu-logout")).toBeTruthy();
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
    const trigger = screen.getByTestId("account-menu-trigger");
    fireEvent.click(trigger);
    expect(screen.queryByTestId("menu-administration")).toBeNull();
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
    const admin = await screen.findByTestId("menu-administration");
    fireEvent.click(admin);
    expect(onAdministration).toHaveBeenCalledOnce();
  });
  it("supports logout cancellation without confirmation", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <AccountLogoutDialog open onClose={onClose} onConfirm={onConfirm} />,
    );

    fireEvent.click(screen.getByTestId("cancel"));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("shows OpenAI's own sign-in, not another provider's, and always offers it", async () => {
    const native = (openai: boolean, subscription: boolean) => ({
      schema_version: 1,
      openai: { present: openai, suffix: null },
      // Claude-only: Anthropic's key and Claude subscription, nothing of OpenAI's.
      anthropic: { present: true, suffix: null },
      deepseek: { present: false, suffix: null },
      subscription: { present: subscription },
    });
    let credentials: object | undefined = native(false, false);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), {
          headers: { "Content-Type": "application/json" },
        });
      if (url === "/api/v1/pi/claude-login")
        return json({ schema_version: 1, state: "completed" });
      if (url === "/api/v1/pi/credentials" && credentials)
        return json(credentials);
      return new Response("", { status: 503 });
    });
    const signIn = vi.fn();
    const show = () => (
      <AccountSettings
        routeSection="yhteydet"
        onNavigate={() => {}}
        onPiSignIn={signIn}
        onBack={() => {}}
      />
    );
    const { unmount } = render(show());
    const state = () => screen.getByTestId("openai-credential-state");
    await waitFor(() => expect(state().dataset.state).toBe("missing"));
    fireEvent.click(screen.getByTestId("pi-sign-in"));
    expect(signIn).toHaveBeenCalledOnce();
    unmount();
    for (const [next, expected] of [
      [native(true, false), "api_key"],
      [native(false, true), "signed_in"],
      [undefined, "unknown"],
    ] as const) {
      credentials = next;
      const view = render(show());
      await waitFor(() => expect(state().dataset.state).toBe(expected));
      expect(screen.getByTestId("pi-sign-in")).toBeTruthy();
      view.unmount();
    }
    vi.restoreAllMocks();
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
    fireEvent.click(screen.getByTestId("settings-yhteydet"));
    expect(screen.queryByTestId("github-disconnect-inspect")).toBeNull();
    for (const state of ["disconnected", "partial"] as const) {
      rerender(show(state));
      expect(screen.queryByTestId("github-disconnect-inspect")).toBeNull();
    }
    rerender(show("connected"));
    expect(screen.getByTestId("github-disconnect-inspect")).toBeTruthy();
  });
});
