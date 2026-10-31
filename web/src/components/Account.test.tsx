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
        <AccountSettings profile={profile} onClose={() => {}} />
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
      render(<AccountSettings name="Oma tili" onClose={() => {}} />);
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
      render(<AccountSettings name="Oma tili" onClose={() => {}} />);
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
      <AccountSettings
        name="Oma tili"
        onClose={() => {}}
        onLogout={() => {}}
      />,
    );
    expect(screen.getByTestId("logout-open")).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();
    fireEvent.click(screen.getByTestId("settings-ulkoasu"));
    expect(
      screen.getByRole("group", { name: "Teema" }).querySelectorAll("svg"),
    ).toHaveLength(3);
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
        routeSection="tekoaly"
        onNavigate={() => {}}
        onPiSignIn={signIn}
        onClose={() => {}}
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
        onClose={() => {}}
      />
    );
    const { rerender } = render(show());
    fireEvent.click(screen.getByTestId("settings-koodipalvelut"));
    expect(screen.queryByTestId("github-disconnect-inspect")).toBeNull();
    for (const state of ["disconnected", "partial"] as const) {
      rerender(show(state));
      expect(screen.queryByTestId("github-disconnect-inspect")).toBeNull();
    }
    rerender(show("connected"));
    expect(screen.getByTestId("github-disconnect-inspect")).toBeTruthy();
  });
  it("offers a one-step reconnect for an expired, missing or working connection", () => {
    const onReconnect = vi.fn();
    const show = (
      nativeState: "connected" | "disconnected" | "expired" | "partial",
    ) => (
      <AccountSettings
        csrf="synthetic-csrf"
        nativeState={nativeState}
        onReconnect={onReconnect}
        onClose={() => {}}
      />
    );
    const { rerender } = render(show("expired"));
    fireEvent.click(screen.getByTestId("settings-koodipalvelut"));
    const row = screen.getByTestId("github-native-state");
    expect(row.dataset.state).toBe("expired");
    expect(row.textContent).toContain("Vanhentunut");
    expect(row.textContent).not.toContain("Yhdistetty");
    expect(screen.queryByTestId("github-disconnect-inspect")).toBeNull();
    fireEvent.click(screen.getByTestId("github-reconnect"));
    expect(onReconnect).toHaveBeenCalledOnce();
    rerender(show("disconnected"));
    fireEvent.click(screen.getByTestId("github-reconnect"));
    expect(onReconnect).toHaveBeenCalledTimes(2);
    // A working login is replaced only on request, e.g. by a lasting token.
    rerender(show("connected"));
    fireEvent.click(screen.getByTestId("github-reconnect"));
    expect(onReconnect).toHaveBeenCalledTimes(3);
    rerender(show("partial"));
    expect(screen.queryByTestId("github-reconnect")).toBeNull();
  });
  it("says why the GitHub state is unknown", () => {
    const show = (
      nativeReason?: "checking" | "timeout" | "github_error" | "unrecognized",
    ) => (
      <AccountSettings
        nativeState="unknown"
        nativeReason={nativeReason}
        onClose={() => {}}
      />
    );
    const { rerender } = render(show("checking"));
    fireEvent.click(screen.getByTestId("settings-koodipalvelut"));
    const row = () => screen.getByTestId("github-native-state");
    const card = () =>
      screen.getByTestId("github-native-state").closest("[data-settings-row]")
        ?.textContent ?? "";
    expect(row().dataset.reason).toBe("checking");
    expect(row().textContent).toContain("Tarkistetaan");
    expect(card()).toContain("kysyy parhaillaan GitHubilta");
    rerender(show("timeout"));
    expect(card()).toContain("ei vastannut ajoissa");
    rerender(show("github_error"));
    expect(card()).toContain("GitHub vastasi tarkistukseen virheellä");
    rerender(show("unrecognized"));
    expect(card()).toContain("gh auth status");
    // An older host without a reason keeps the plain wording.
    rerender(show());
    expect(row().dataset.reason).toBeUndefined();
    expect(card()).toContain("ei juuri nyt voitu vahvistaa");
  });
});
