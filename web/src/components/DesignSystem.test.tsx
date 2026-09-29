import { fireEvent, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { Composer, DiffView, ToolGroup } from "./Conversation";
import { OperationProgress } from "./Operations";
import { Dialog, Menu, Tabs } from "./Overlays";
import { Button, TextArea } from "./Primitives";
import { ConnectionBanner, StatusMark } from "./Status";

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
  it("associates read-only reason and hint as one field description", () => {
    const view = routed(
      <TextArea
        label="Luonnos"
        value="säilyy"
        hint="Enter lähettää."
        availability={{ state: "read_only", reason: "Yhteys on vanhentunut." }}
        onChange={() => {}}
      />,
    );
    const field = view.getByRole("textbox", {
      name: "Luonnos",
    }) as HTMLTextAreaElement;
    expect(field.readOnly).toBe(true);
    expect(field.disabled).toBe(false);
    const descriptionId = field.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    expect(document.querySelectorAll(`#${descriptionId}`).length).toBe(1);
    expect(
      document.getElementById(descriptionId as string)?.textContent,
    ).toContain("Enter lähettää.");
    expect(
      document.getElementById(descriptionId as string)?.textContent,
    ).toContain("Yhteys on vanhentunut.");
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
    expect(document.activeElement).toBe(
      within(dialog).getByRole("heading", { name: "Agentin tiedot" }),
    );
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
  it("keeps a blocked dialog open on Escape", async () => {
    const user = userEvent.setup();
    const view = routed(
      <Dialog
        triggerLabel="Avaa"
        title="Estetty"
        closeAvailability={{ state: "disabled", reason: "Hyväksyntä odottaa" }}
      >
        <p>Sisältö</p>
      </Dialog>,
    );
    await user.click(view.getByRole("button", { name: "Avaa" }));
    await user.keyboard("{Escape}");
    expect(view.getByRole("dialog", { name: "Estetty" })).toBeTruthy();
  });
  it("moves between tabs with arrow keys", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    const view = routed(
      <Tabs
        label="Tapa"
        selected="one"
        tabs={[
          { id: "one", label: "Ensimmäinen", panel: <p>Yksi</p> },
          { id: "two", label: "Toinen", panel: <p>Kaksi</p> },
        ]}
        onChange={change}
      />,
    );
    await user.click(view.getByRole("tab", { name: "Ensimmäinen" }));
    await user.keyboard("{ArrowRight}");
    expect(change).toHaveBeenCalledWith("two");
  });
  it("blocks Enter while a send is pending", () => {
    const send = vi.fn();
    const view = routed(
      <Composer
        value="teksti"
        activity="idle"
        selectedWorkingMode="follow_up"
        sendState="pending"
        onChange={() => {}}
        onSendNow={send}
        onSteer={() => {}}
        onFollowUp={() => {}}
        onModeChange={() => {}}
      />,
    );
    fireEvent.keyDown(view.getByRole("textbox", { name: "Viesti Pi:lle" }), {
      key: "Enter",
    });
    expect(send).not.toHaveBeenCalled();
  });
  it("names every operation stage state without relying on colour", () => {
    const view = routed(
      <OperationProgress
        operationId="op-1"
        kindLabel="Poisto"
        state="partial"
        stages={[
          { id: "ok", label: "Tarkistus", state: "succeeded" },
          { id: "unknown", label: "Poisto", state: "unknown" },
        ]}
        onClose={() => {}}
      />,
    );
    expect(view.getByText("Tarkistus: Onnistui")).toBeTruthy();
    expect(view.getByText("Poisto: Ei tiedossa")).toBeTruthy();
  });
  it("shows a tool-group error while collapsed", () => {
    const view = routed(
      <ToolGroup
        title="Työkalut"
        summary="1 valmis"
        expanded={false}
        containsException
        onToggle={() => {}}
      >
        <p>Piilotettu sisältö</p>
      </ToolGroup>,
    );
    expect(view.getByText(/Sisältää virheen/)).toBeTruthy();
    expect(view.queryByText("Piilotettu sisältö")).toBeNull();
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
    const headers = routed(
      <DiffView
        pathLabel="file.ts"
        unifiedText={"--- a/file.ts\n+++ b/file.ts"}
        parseState="ready"
        view="unifiedAccessible"
        onCopy={() => {}}
        onViewChange={() => {}}
      />,
    );
    expect(within(headers.container).queryByText(/Poistettu rivi:/)).toBeNull();
    expect(within(headers.container).queryByText(/Lisätty rivi:/)).toBeNull();
  });
  it("separates healthy read-only state from stale state", () => {
    const view = routed(<ConnectionBanner state="host-read-only" />);
    expect(view.getByRole("status").textContent).toContain("Yhteys toimii");
    expect(view.getByRole("status").textContent).toContain(
      "Työtiloja ei voi nyt muuttaa",
    );
  });
});
