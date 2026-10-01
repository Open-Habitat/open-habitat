import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getThemeChoice, setThemeChoice } from "../theme";
import { AccountSettings, AccountShelf, accountLabel } from "./Account";

describe("account presentation", () => {
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
      const option = await screen.findByRole("menuitem", {
        name: /Teema: Tumma/,
      });
      expect(option.getAttribute("data-group-selected")).toBe("true");
      expect(screen.getByRole("menuitem", { name: "Asetukset" })).toBeTruthy();
      expect(
        screen.getByRole("menuitem", { name: "Kirjaudu ulos" }),
      ).toBeTruthy();
    } finally {
      act(() => setThemeChoice("system"));
    }
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
      screen.getByText("Yhteyttä ei voi vielä katkaista täällä"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Katkaise/ })).toBeNull();
  });
});
