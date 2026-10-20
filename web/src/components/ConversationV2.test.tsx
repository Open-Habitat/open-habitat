import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  AssistantMessage,
  ConversationTimeline,
  LiveToolRow,
  NativeQuestion,
  ToolRow,
  UserMessage,
} from "./Conversation";
import { ConversationFrame } from "./ConversationFrame";

function mount(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}
const noop = () => {};
describe("conversation v2 presentation", () => {
  it("presents input, select, confirm and unknown dialog actions without inventing an answer", () => {
    const respond = vi.fn();
    const common = {
      prompt: "Jatketaanko?",
      choices: ["Yksi", "Kaksi"],
      value: "Yksi",
      state: "open" as const,
      onChange: noop,
      onRespond: respond,
    };
    const view = mount(<NativeQuestion {...common} kind="input" />);
    fireEvent.click(view.getByRole("button", { name: "Vastaa" }));
    expect(respond).toHaveBeenLastCalledWith("answer", "Yksi");
    view.rerender(
      <MemoryRouter>
        <NativeQuestion {...common} kind="select" />
      </MemoryRouter>,
    );
    expect(view.getAllByRole("radio")).toHaveLength(2);
    fireEvent.click(view.getByRole("button", { name: "Vastaa" }));
    expect(respond).toHaveBeenLastCalledWith("answer", "Yksi");
    view.rerender(
      <MemoryRouter>
        <NativeQuestion {...common} kind="confirm" />
      </MemoryRouter>,
    );
    fireEvent.click(view.getByRole("button", { name: "Ei" }));
    expect(respond).toHaveBeenLastCalledWith("answer", false);
    view.rerender(
      <MemoryRouter>
        <NativeQuestion {...common} kind="unknown" />
      </MemoryRouter>,
    );
    expect(view.getAllByRole("button")).toHaveLength(1);
    fireEvent.click(view.getByRole("button", { name: "Peruuta kysymys" }));
    expect(respond).toHaveBeenLastCalledWith("cancel");
    view.rerender(
      <MemoryRouter>
        <NativeQuestion {...common} kind="input" state="uncertain" />
      </MemoryRouter>,
    );
    expect(view.queryByRole("button")).toBeNull();
    expect(view.getByRole("status").textContent).toMatch(/Ei tiedossa/);
  });

  it("shows only observed live-tool facts and a textual running status", () => {
    const view = mount(<LiveToolRow name="bash" state="running" />);
    const row = view.getByRole("status", { name: /bash.*ajossa/ });
    expect(row.textContent).toBe("bashajossa");
    expect(row.querySelector("code")).toBeNull();
    expect(row.textContent).not.toMatch(/\d+ s/);
  });
  it("keeps the whole tool name and only the first command line in the header", () => {
    const view = mount(
      <ToolRow
        name="bash"
        targetText={"echo first line\necho second line"}
        statusLabel="valmis"
        state="succeeded"
        expanded={false}
        onToggle={noop}
      />,
    );
    const names = view.container.querySelector(".ah-tool-names");
    expect(names?.querySelector(".ah-tool-name")?.textContent).toBe("bash");
    expect(names?.querySelector(".ah-tool-target")?.textContent).toBe(
      "echo first line",
    );
    expect(
      view.getByRole("button", { name: /bash.*echo first line/ }),
    ).toBeTruthy();
  });
  it("keeps copy accessible and marks completion only with explicit stream state", () => {
    const view = mount(
      <>
        <UserMessage sourceText="Kysymys" onCopy={noop} />
        <AssistantMessage streamState="complete" time="13.53" onCopy={noop}>
          Vastaus
        </AssistantMessage>
        <AssistantMessage onCopy={noop}>Välivaihe</AssistantMessage>
      </>,
    );
    expect(
      view.getByRole("button", { name: "Kopioi viesti: Sinä" }),
    ).toBeTruthy();
    expect(view.getByText(/Vastaus valmis/)).toBeTruthy();
    expect(view.getAllByText(/Vastaus valmis/)).toHaveLength(1);
  });
  it("offers a return to latest even without new content when the reader scrolled away", () => {
    const jump = vi.fn();
    const view = mount(
      <ConversationFrame>
        <ConversationTimeline
          state="ready"
          items={[]}
          historyMode="pagedAccessible"
          showJumpToLatest
          onJumpToLatest={jump}
        />
      </ConversationFrame>,
    );
    fireEvent.click(view.getByRole("button", { name: "Viimeisimpään" }));
    expect(jump).toHaveBeenCalledTimes(1);
  });
  it("keeps the latest pill stable as working changes to two unseen replies", () => {
    const jump = vi.fn();
    const node = (working: boolean, count: number) => (
      <MemoryRouter>
        <ConversationFrame>
          <ConversationTimeline
            state="ready"
            items={[]}
            historyMode="pagedAccessible"
            showJumpToLatest
            latestWorking={working}
            latestDuration="0:42"
            newContentCount={count}
            onJumpToLatest={jump}
          />
        </ConversationFrame>
      </MemoryRouter>
    );
    const view = render(node(true, 0));
    const button = view.getByRole("button", {
      name: "Viimeisimpään, Pi työskentelee",
    });
    expect(button.textContent).toContain("Pi työskentelee 0:42");
    view.rerender(node(true, 2));
    expect(button.textContent).toContain("Pi työskentelee 0:42 (2)");
    expect(button.getAttribute("aria-label")).toContain("2 uutta viestiä");
    view.rerender(node(false, 2));
    expect(
      view.getByRole("button", { name: "Viimeisimpään, uusi vastaus (2)" }),
    ).toBe(button);
    expect(button.textContent).toContain("● Uusi vastaus (2)");
    fireEvent.click(button);
    expect(jump).toHaveBeenCalledOnce();
  });
});
