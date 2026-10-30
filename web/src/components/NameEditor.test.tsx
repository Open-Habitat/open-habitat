import { act, fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { conversationName } from "../app/conversationName";
import { AgentHeader, AgentNavItem } from "./Navigation";

function header(onSave: (name: string) => Promise<void>, title = "Vanha") {
  return (
    <MemoryRouter>
      <AgentHeader
        title={title}
        activityLabel="Valmis"
        controlLabel="Selainohjaus"
        workspaceLabel="Työtila"
        workspaceHref="/workspaces/ws_example00"
        detailsExpanded={false}
        onToggleDetails={() => {}}
        rename={{ onSave }}
      />
    </MemoryRouter>
  );
}
const field = (root: HTMLElement) =>
  root.querySelector<HTMLInputElement>(
    '[data-testid="conversation-name-field"]',
  );

describe("naming a conversation by hand", () => {
  it("saves on Enter and shows the name before the host's title follows", async () => {
    const saved: string[] = [];
    const view = render(
      header(async (name) => {
        saved.push(name);
      }),
    );
    fireEvent.click(view.getByTestId("conversation-rename"));
    const input = field(view.container);
    expect(document.activeElement).toBe(input);
    fireEvent.change(input as HTMLInputElement, {
      target: { value: "  Uusi\tnimi " },
    });
    await act(async () => {
      fireEvent.keyDown(input as HTMLInputElement, { key: "Enter" });
    });
    expect(saved).toEqual(["Uusi nimi"]);
    expect(field(view.container)).toBeNull();
    expect(view.getByTestId("workspace-title").textContent).toBe("Uusi nimi");
    // The host's next title wins over the remembered one, also when it
    // later returns to the name before the rename.
    view.rerender(header(async () => {}, "Uusi nimi"));
    view.rerender(header(async () => {}, "Vanha"));
    expect(view.getByTestId("workspace-title").textContent).toBe("Vanha");
  });

  it("keeps the old name on Escape and on an unchanged or empty name", async () => {
    const saved: string[] = [];
    const view = render(
      header(async (name) => {
        saved.push(name);
      }),
    );
    for (const [value, key] of [
      ["Ei tallennu", "Escape"],
      ["Vanha", "Enter"],
      ["   ", "Enter"],
    ]) {
      fireEvent.click(view.getByTestId("conversation-rename"));
      const input = field(view.container) as HTMLInputElement;
      fireEvent.change(input, { target: { value } });
      await act(async () => {
        fireEvent.keyDown(input, { key });
      });
      expect(field(view.container)).toBeNull();
    }
    expect(saved).toEqual([]);
    expect(view.getByTestId("workspace-title").textContent).toBe("Vanha");
  });

  it("keeps the typed name open when the save fails", async () => {
    let attempts = 0;
    const view = render(
      header(async () => {
        attempts++;
        throw new Error("uncertain");
      }),
    );
    fireEvent.click(view.getByTestId("conversation-rename"));
    const input = field(view.container) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Tärkeä" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(attempts).toBe(1);
    expect(field(view.container)?.value).toBe("Tärkeä");
    expect(view.getByTestId("conversation-name-problem")).toBeTruthy();
    // Leaving a failed field does not try again behind the person's back.
    await act(async () => {
      fireEvent.blur(field(view.container) as HTMLInputElement);
    });
    expect(attempts).toBe(1);
  });

  it("renames a rail row in place without following its link", async () => {
    const saved: [string, string][] = [];
    const view = render(
      <MemoryRouter>
        <ul>
          <AgentNavItem
            agentId="pi:a"
            href="/workspaces/ws_example00?conversation=pi:a"
            title="Rivin nimi"
            activity="waiting"
            activityLabel="Valmis"
            controlLabel=""
            rename={{
              reason: () => "",
              save: async (id, name) => {
                saved.push([id, name]);
              },
            }}
          />
        </ul>
      </MemoryRouter>,
    );
    fireEvent.click(view.getByTestId("rail-rename-conversation"));
    const input = field(view.container) as HTMLInputElement;
    expect(input.closest("a")).toBeNull();
    fireEvent.change(input, { target: { value: "Rivin uusi nimi" } });
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(saved).toEqual([["pi:a", "Rivin uusi nimi"]]);
    expect(view.container.querySelector("a")?.textContent).toContain(
      "Rivin uusi nimi",
    );
  });

  it("bounds a name as the daemon does", () => {
    expect(conversationName("\tKaksi  sanaa\r\n")).toBe("Kaksi sanaa");
    const long = conversationName("ä".repeat(100));
    expect(new TextEncoder().encode(long).length).toBeLessThanOrEqual(160);
    expect(long).toBe("ä".repeat(80));
  });
});
