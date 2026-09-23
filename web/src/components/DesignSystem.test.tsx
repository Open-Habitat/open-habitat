import { fireEvent, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { Dialog, Menu } from "./Overlays";
import { Button, TextArea } from "./Primitives";
import { ConnectionBanner, StatusMark } from "./Status";
import { DiffView } from "./Conversation";

function routed(node: ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}
describe("production component semantics", () => {
  it("keeps disabled reason visible and prevents activation", () => {
    const press = vi.fn();
    const view = routed(
      <Button
        label="Lähetä"
        availability={{ state: "disabled", reason: "Yhteys puuttuu" }}
        onPress={press}
      />,
    );
    expect(view.getByText("Yhteys puuttuu")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Lähetä" }));
    expect(press).not.toHaveBeenCalled();
  });
  it("uses text in addition to the status mark", () => {
    const view = routed(<StatusMark label="Tila ei tiedossa" tone="warning" />);
    expect(view.getByText("Tila ei tiedossa")).toBeTruthy();
    expect(
      view
        .getByText("Tila ei tiedossa")
        .querySelector(".ah-status-dot")
        ?.getAttribute("aria-hidden"),
    ).toBe("true");
  });
  it("does not submit textarea during IME composition", () => {
    const commit = vi.fn();
    const view = routed(
      <TextArea
        label="Viesti"
        value="teksti"
        onChange={() => {}}
        onCommit={commit}
      />,
    );
    const field = view.getByRole("textbox", { name: "Viesti" });
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    expect(commit).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "Enter", isComposing: false });
    expect(commit).toHaveBeenCalledOnce();
  });
  it("opens a modal, traps focus and restores the trigger", async () => {
    const user = userEvent.setup();
    const view = routed(
      <>
        <Dialog triggerLabel="Avaa tiedot" title="Agentin tiedot">
          <button type="button">Sisäinen toiminto</button>
        </Dialog>
        <button type="button">Taustan toiminto</button>
      </>,
    );
    const trigger = view.getByRole("button", { name: "Avaa tiedot" });
    await user.click(trigger);
    const dialog = await view.findByRole("dialog", { name: "Agentin tiedot" });
    expect(
      within(dialog).getByRole("button", { name: "Sisäinen toiminto" }),
    ).toBeTruthy();
    await user.keyboard("{Escape}");
    await vi.waitFor(() => expect(view.queryByRole("dialog")).toBeNull());
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
  });
  it("supports menu keyboard navigation and escape return focus", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    const view = routed(
      <Menu
        label="Toiminnot"
        items={[
          { id: "one", label: "Ensimmäinen" },
          { id: "two", label: "Toinen" },
        ]}
        onAction={action}
      />,
    );
    const trigger = view.getByRole("button", { name: /Toiminnot/ });
    await user.click(trigger);
    await view.findByRole("menu");
    await user.keyboard("{End}");
    expect(document.activeElement?.textContent).toContain("Toinen");
    await user.keyboard("{Escape}");
    await vi.waitFor(() => expect(view.queryByRole("menu")).toBeNull());
    await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
  });
  it("keeps diff signs and screen-reader labels", () => {
    const view = routed(
      <DiffView
        pathLabel="file.ts"
        unifiedText={"-vanha\n+uusi"}
        parseState="ready"
        view="unifiedAccessible"
        onCopy={() => {}}
        onViewChange={() => {}}
      />,
    );
    expect(view.getByText(/Poistettu rivi:/)).toBeTruthy();
    expect(view.getByText(/Lisätty rivi:/)).toBeTruthy();
    expect(view.getByText(/-vanha/)).toBeTruthy();
  });
  it("separates healthy read-only state from stale state", () => {
    const view = routed(<ConnectionBanner state="host-read-only" />);
    expect(view.getByRole("status").textContent).toContain("Yhteys toimii");
    expect(view.getByRole("status").textContent).toContain("vain luku");
  });
});
