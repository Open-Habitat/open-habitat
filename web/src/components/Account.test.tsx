import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getThemeChoice, setThemeChoice } from "../theme";
import {
  AccountLogoutDialog,
  AccountSettings,
  AccountShelf,
  accountLabel,
} from "./Account";

describe("account presentation", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });
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
  it("shows only the chosen section", () => {
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
    expect(screen.getByTestId("theme-choice")).toBeTruthy();
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
  it("moves the search preview with every arrow press while the route has not drawn the last one", () => {
    // As the router: the URL moves at once, but the section is drawn in a
    // transition that a loaded page holds back over several presses, so the
    // route props here never move.
    const onNavigate = vi.fn((path: string) =>
      window.history.replaceState(null, "", path),
    );
    // A desktop: results and the previewed section side by side.
    // jsdom lays nothing out.
    Element.prototype.scrollIntoView = () => {};
    window.history.replaceState(null, "", "/settings/recap#recap-model");
    try {
      render(
        <AccountSettings
          routeSection="tilannekatsaus"
          routeRow="recap-model"
          onNavigate={onNavigate}
          onClose={() => {}}
        />,
      );
      const field = screen.getByTestId("settings-search");
      fireEvent.change(field, { target: { value: "malli" } });
      const ids = [...document.querySelectorAll("[role='option']")].map(
        (o) => o.id,
      );
      expect(ids.slice(0, 2)).toEqual([
        "settings-search-results-row-recap-model",
        "settings-search-results-row-default-model",
      ]);
      // The first result is the place already shown: nothing to navigate.
      expect(onNavigate).not.toHaveBeenCalled();
      fireEvent.keyDown(field, { key: "ArrowDown" });
      fireEvent.keyDown(field, { key: "ArrowUp" });
      expect(field.getAttribute("aria-activedescendant")).toBe(ids[0]);
      expect(window.location.hash).toBe("#recap-model");
      expect(onNavigate).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
      delete (Element.prototype as Partial<Element>).scrollIntoView;
      window.history.replaceState(null, "", "/");
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
  describe("GitHub workflow permission", () => {
    const reply = (identity: string, workflow: boolean) =>
      new Response(
        JSON.stringify({
          schema_version: 1,
          web_identity_id: identity,
          engine: "codemirror6",
          language: "system",
          quiet_sort: "newest",
          quiet_workspace: null,
          github_workflow: workflow,
          experimental: {},
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    const base = ["gist", "read:org", "repo"];
    const show = (
      identity: string,
      onReconnect: (workflow?: boolean) => void,
      nativeScopes: string[] | null | undefined,
      nativeState: "connected" | "expired" = "connected",
    ) => (
      <AccountSettings
        editorIdentity={identity}
        csrf="synthetic-csrf"
        nativeState={nativeState}
        nativeLogin="example-a"
        nativeScopes={nativeScopes}
        onReconnect={onReconnect}
        onClose={() => {}}
      />
    );
    const row = () => screen.getByTestId("github-workflow");
    it("is off by default and allowing signs in again with the workflow scope", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => reply("wid_wf-off", false)),
      );
      const onReconnect = vi.fn();
      render(show("wid_wf-off", onReconnect, base));
      fireEvent.click(screen.getByTestId("settings-koodipalvelut"));
      await waitFor(() =>
        expect(
          screen
            .getByTestId("github-workflow-allow")
            .hasAttribute("data-disabled"),
        ).toBe(false),
      );
      expect(row().dataset.wf).toBe("off");
      expect(row().textContent).toContain("Ei sallittu");
      expect(row().textContent).toContain("salaisuudet");
      const chips = screen.getByTestId("github-scopes");
      expect(
        [...chips.querySelectorAll("li")].map((li) => li.dataset.scope),
      ).toEqual(base);
      fireEvent.click(screen.getByTestId("github-workflow-allow"));
      expect(onReconnect).toHaveBeenCalledWith(true);
      expect(row().dataset.wf).toBe("pending");
      fireEvent.click(screen.getByTestId("github-workflow-cancel"));
      expect(row().dataset.wf).toBe("off");
      // The card's own Reconnect leaves the choice to the app.
      fireEvent.click(screen.getByTestId("github-reconnect"));
      expect(onReconnect).toHaveBeenLastCalledWith();
      vi.unstubAllGlobals();
    });
    it("shows an allowed token and removing it signs in again without the scope", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => reply("wid_wf-on", true)),
      );
      const onReconnect = vi.fn();
      render(show("wid_wf-on", onReconnect, [...base, "workflow"]));
      fireEvent.click(screen.getByTestId("settings-koodipalvelut"));
      await waitFor(() =>
        expect(
          screen
            .getByTestId("github-workflow-remove")
            .hasAttribute("data-disabled"),
        ).toBe(false),
      );
      expect(row().dataset.wf).toBe("on");
      fireEvent.click(screen.getByTestId("github-workflow-remove"));
      expect(onReconnect).toHaveBeenCalledWith(false);
      vi.unstubAllGlobals();
    });
    it("says a remembered permission is missing, and Don't allow forgets it on the daemon's confirmation", async () => {
      const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
        reply("wid_wf-missing", init?.method !== "PUT"),
      );
      vi.stubGlobal("fetch", fetch);
      render(show("wid_wf-missing", vi.fn(), base));
      fireEvent.click(screen.getByTestId("settings-koodipalvelut"));
      await waitFor(() => expect(row().dataset.wf).toBe("missing"));
      expect(row().textContent).toContain("Lupa puuttuu");
      expect(screen.getByTestId("github-workflow-allow").textContent).toBe(
        "Salli uudelleen",
      );
      fireEvent.click(screen.getByTestId("github-workflow-keep-off"));
      await waitFor(() => expect(row().dataset.wf).toBe("off"));
      const put = fetch.mock.calls.find(([, init]) => init?.method === "PUT");
      expect(put?.[1]?.body).toBe('{"github_workflow":false}');
      expect(new Headers(put?.[1]?.headers).get("X-Agent-Host-CSRF")).toBe(
        "synthetic-csrf",
      );
      expect(
        (await screen.findByTestId("github-workflow-said")).textContent,
      ).toContain("enää huomauteta");
      vi.unstubAllGlobals();
    });
    it("says unread scopes are not known, and has no row without a working login", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => reply("wid_wf-unknown", false)),
      );
      const { rerender } = render(show("wid_wf-unknown", vi.fn(), null));
      fireEvent.click(screen.getByTestId("settings-koodipalvelut"));
      expect(row().dataset.wf).toBe("unknown");
      expect(screen.getByTestId("github-scopes").textContent).toContain(
        "Oikeuksia ei voitu lukea",
      );
      rerender(show("wid_wf-unknown", vi.fn(), undefined, "expired"));
      expect(screen.queryByTestId("github-workflow")).toBeNull();
      expect(screen.queryByTestId("github-scopes")).toBeNull();
      vi.unstubAllGlobals();
    });
  });
});
