import { fireEvent, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { Composer, DiffView, ToolGroup } from "./Conversation";
import { Dialog, Menu, Tabs } from "./Overlays";
import { Button, TextArea } from "./Primitives";
import { StatusMark } from "./Status";

function routed(node: ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}
describe("production component semantics", () => {
  it("prevents disabled activation", () => {
    const press = vi.fn();
    const view = routed(
      <Button
        size="row"
        label="Lähetä"
        availability={{ state: "disabled", reason: "Yhteys puuttuu" }}
        onPress={press}
      />,
    );

    fireEvent.click(view.getByRole("button"));
    expect(press).not.toHaveBeenCalled();
  });
  it("keeps the decorative status dot hidden from assistive technology", () => {
    const view = routed(<StatusMark label="Tila ei tiedossa" tone="warning" />);

    expect(
      view.container
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
    const field = view.getByRole("textbox") as HTMLTextAreaElement;
    expect(field.readOnly).toBe(true);
    expect(field.disabled).toBe(false);
    const descriptionId = field.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    expect(document.querySelectorAll(`#${descriptionId}`).length).toBe(1);
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
    const field = view.getByRole("textbox");
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    expect(commit).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "Enter", isComposing: false });
    expect(commit).toHaveBeenCalledOnce();
  });
  it("opens a modal, traps focus and restores the trigger", async () => {
    const user = userEvent.setup();
    const view = routed(
      <>
        <div data-testid="dialog-trigger-area">
          <Dialog triggerLabel="Avaa tiedot" title="Agentin tiedot">
            <button data-testid="dialog-action" type="button">
              Sisäinen toiminto
            </button>
          </Dialog>
        </div>
        <button data-testid="background-action" type="button">
          Taustan toiminto
        </button>
      </>,
    );
    const trigger = within(view.getByTestId("dialog-trigger-area")).getByRole(
      "button",
    );
    await user.click(trigger);
    const dialog = await view.findByRole("dialog");
    expect(document.activeElement).toBe(within(dialog).getByRole("heading"));
    expect(within(dialog).getByTestId("dialog-action")).toBeTruthy();
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
    const trigger = view.getByRole("button");
    await user.click(trigger);
    await view.findByRole("menu");
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(view.getAllByRole("menuitem")[1]);
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
    await user.click(view.getByRole("button"));
    await user.keyboard("{Escape}");
    expect(view.getByRole("dialog")).toBeTruthy();
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
    await user.click(view.getByRole("tab", { selected: true }));
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
    fireEvent.keyDown(view.getByRole("textbox"), {
      key: "Enter",
    });
    expect(send).not.toHaveBeenCalled();
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

    expect(
      view.container
        .querySelector(".ah-tool-group")
        ?.classList.contains("ah-has-error"),
    ).toBe(true);
    expect(view.queryByText("Piilotettu sisältö")).toBeNull();
  });
  it("keeps diff signs and native file headers", () => {
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

    expect(view.getByText(/-vanha/)).toBeTruthy();
    expect(view.getByText(/\+uusi/)).toBeTruthy();
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
    expect(headers.container.textContent).toContain("--- a/file.ts");
    expect(headers.container.textContent).toContain("+++ b/file.ts");
  });
});
