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
    expect(
      screen.getByRole("button", { name: /Alice, Tilivalikko/ }),
    ).toBeTruthy();
    expect(screen.getByText("alice@example.invalid")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Alice, Tilivalikko/ }));
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
      expect(
        (screen.getByRole("radio", { name: "Vaalea" }) as HTMLInputElement)
          .checked,
      ).toBe(true);
      act(() => setThemeChoice("dark"));
      expect(
        (screen.getByRole("radio", { name: "Tumma" }) as HTMLInputElement)
          .checked,
      ).toBe(true);
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
      expect(
        (screen.getByRole("radio", { name: "Tumma" }) as HTMLInputElement)
          .checked,
      ).toBe(true);
    } finally {
      get.mockRestore();
      put.mockRestore();
      act(() => setThemeChoice("system"));
    }
  });
  it("keeps the theme radiogroup while presenting it as a compact row", () => {
    render(
      <AccountSettings name="Oma tili" onBack={() => {}} onLogout={() => {}} />,
    );
    const group = screen.getByRole("radiogroup", { name: "Teema" });
    expect(group.closest(".ah-account-theme-row")).toBeTruthy();
    expect(group.querySelectorAll('input[type="radio"]')).toHaveLength(3);
    expect(screen.getByText("Kirjaudu ulos tästä selaimesta")).toBeTruthy();
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
      fireEvent.click(
        screen.getByRole("button", { name: /Oma tili, Tilivalikko/ }),
      );
      const option = await screen.findByRole("button", { name: "Tumma" });
      expect(option.getAttribute("aria-pressed")).toBe("true");
      expect(option.getAttribute("title")).toBe("Tumma");
      for (const name of ["Järjestelmä", "Vaalea", "Tumma"])
        expect(screen.getByRole("button", { name }).getAttribute("title")).toBe(
          name,
        );
      expect(screen.getByRole("menuitem", { name: "Asetukset" })).toBeTruthy();
      expect(
        screen.getByRole("menuitem", { name: "Kirjaudu ulos…" }),
      ).toBeTruthy();
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
    const trigger = screen.getByRole("button", { name: /Alice, Tilivalikko/ });
    fireEvent.click(trigger);
    expect(
      screen.queryByRole("menuitem", { name: "Palvelimen ylläpito" }),
    ).toBeNull();
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
    const admin = await screen.findByRole("menuitem", {
      name: "Palvelimen ylläpito",
    });
    fireEvent.click(admin);
    expect(onAdministration).toHaveBeenCalledOnce();
  });
  it("explains what logout removes and supports cancellation", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <AccountLogoutDialog open onClose={onClose} onConfirm={onConfirm} />,
    );
    expect(screen.getByRole("dialog").textContent).toContain("Luonnokset");
    expect(screen.getByRole("dialog").textContent).toContain(
      "Agenttien käynnissä oleva työ",
    );
    fireEvent.click(screen.getByRole("button", { name: "Peruuta" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("distinguishes native Pi credential evidence from OpenAI identity and allows re-login", () => {
    const signIn = vi.fn();
    const { rerender } = render(
      <AccountSettings
        piState="usable"
        onPiSignIn={signIn}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText("Pi-tunnukset käytettävissä")).toBeTruthy();
    expect(screen.getByText(/Tämä ei vahvista OpenAI-tiliä/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Kirjaudu Pi:hin uudelleen" }),
    );
    expect(signIn).toHaveBeenCalledOnce();
    rerender(
      <AccountSettings
        piState="missing"
        onPiSignIn={signIn}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText("Pi-kirjautuminen puuttuu")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Kirjaudu Pi:hin" }));
    expect(signIn).toHaveBeenCalledTimes(2);
    for (const piState of ["unknown", "unavailable", "checking"] as const) {
      rerender(
        <AccountSettings
          piState={piState}
          onPiSignIn={signIn}
          onBack={() => {}}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Kirjaudu Pi:hin uudelleen" }),
      ).toBeTruthy();
      expect(screen.queryByText("Pi-tunnukset käytettävissä")).toBeNull();
    }
    expect(screen.getByText("Tarkistetaan Pi-tilaa")).toBeTruthy();
  });
  it("never presents a provider subject number as a name", () => {
    expect(accountLabel("GitHub user 42")).toBe("Oma tili");
    expect(accountLabel(" 123 ")).toBe("Oma tili");
    expect(accountLabel("Alice Example")).toBe("Alice Example");
  });
  it("does not infer a connection from missing or partial native evidence", () => {
    const { rerender } = render(
      <AccountSettings name="Oma tili" onBack={() => {}} />,
    );
    expect(screen.getByText("Tilaa ei tiedetä")).toBeTruthy();
    rerender(
      <AccountSettings
        name="Oma tili"
        nativeState="disconnected"
        onBack={() => {}}
      />,
    );
    expect(screen.getByText("Ei yhdistetty")).toBeTruthy();
    rerender(
      <AccountSettings
        name="Oma tili"
        nativeState="partial"
        onBack={() => {}}
      />,
    );
    expect(screen.getByText("Osittainen yhteys")).toBeTruthy();
    expect(
      screen.getByText(
        /Selaimesta uloskirjautuminen ei poista GitHub-valtuutusta/,
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Katkaise/ })).toBeNull();
  });
});
