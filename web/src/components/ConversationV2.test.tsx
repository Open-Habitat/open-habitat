import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  AssistantMessage,
  Composer,
  ConversationTimeline,
  LiveToolRow,
  NativeQuestion,
  QueuePanel,
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
  it("keeps explicit working intents and Enter's last selected mode without a radio group", () => {
    const steer = vi.fn();
    const followUp = vi.fn();
    const mode = vi.fn();
    const view = mount(
      <Composer
        value="Ohje"
        activity="working"
        selectedWorkingMode="follow_up"
        onChange={noop}
        onSendNow={noop}
        onSteer={steer}
        onFollowUp={followUp}
        onModeChange={mode}
        onInterrupt={noop}
      />,
    );
    expect(view.queryByRole("radiogroup")).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Ohjaa" }));
    expect(mode).toHaveBeenCalledWith("steer");
    expect(steer).not.toHaveBeenCalled();
    fireEvent.click(view.getByRole("button", { name: "Lähetä" }));
    expect(followUp).toHaveBeenCalledTimes(1);
  });
  it("leaves an unknown or open queue reachable while a known empty queue stays quiet", () => {
    const props = {
      value: "",
      activity: "idle" as const,
      selectedWorkingMode: "follow_up" as const,
      queueSummary: "Jonossa 0",
      onChange: noop,
      onSendNow: noop,
      onSteer: noop,
      onFollowUp: noop,
      onModeChange: noop,
      onOpenQueue: noop,
    };
    const view = mount(<Composer {...props} queueKnown={false} />);
    expect(
      view.getByRole("button", { name: "Jonon tila ei tiedossa" }),
    ).toBeTruthy();
    view.rerender(
      <MemoryRouter>
        <Composer {...props} queueKnown queueOpen />
      </MemoryRouter>,
    );
    expect(
      view
        .getByRole("button", { name: "Jonossa 0" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    view.rerender(
      <MemoryRouter>
        <Composer {...props} queueKnown />
      </MemoryRouter>,
    );
    expect(view.queryByRole("button", { name: "Jonossa 0" })).toBeNull();
  });
  it("never presents an unknown queue as zero items", () => {
    const view = mount(
      <QueuePanel
        steeringTexts={[]}
        followUpTexts={[]}
        state="error"
        clearAvailability={{ state: "unknown", reason: "Odota havaintoa." }}
        onClearAll={noop}
      />,
    );
    expect(view.getByText("Jonon tila ei tiedossa")).toBeTruthy();
    expect(view.queryByText("0")).toBeNull();
  });
  it("names the selected Enter action while working", () => {
    const view = mount(
      <Composer
        value="Ohje"
        activity="working"
        selectedWorkingMode="steer"
        onChange={noop}
        onSendNow={noop}
        onSteer={noop}
        onFollowUp={noop}
        onModeChange={noop}
      />,
    );
    expect(
      view.getByRole("button", { name: "Ohjaa", pressed: true }),
    ).toBeTruthy();
    expect(view.getByRole("textbox", { name: "Viesti Pi:lle" })).toBeTruthy();
  });
  it("keeps an empty ready composer quiet and prevents an empty send", () => {
    const submit = vi.fn();
    const view = mount(
      <Composer
        value=""
        activity="idle"
        selectedWorkingMode="follow_up"
        onChange={noop}
        onSendNow={submit}
        onSteer={noop}
        onFollowUp={noop}
        onModeChange={noop}
      />,
    );
    expect(view.getByRole("button", { name: "Lähetä" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(
      view
        .getByRole("textbox", { name: "Viesti Pi:lle" })
        .getAttribute("placeholder"),
    ).toBe("Viesti Pi:lle");
    expect(submit).not.toHaveBeenCalled();
  });
  it("keeps an unavailable send disabled and a rejected draft visible", () => {
    const view = mount(
      <Composer
        value="Säilyy"
        activity="idle"
        selectedWorkingMode="follow_up"
        sendState="rejected"
        availability={{ state: "disabled", reason: "Yhteys katkesi." }}
        onChange={noop}
        onSendNow={noop}
        onSteer={noop}
        onFollowUp={noop}
        onModeChange={noop}
      />,
    );
    expect(
      view
        .getByRole("textbox", { name: "Viesti Pi:lle" })
        .getAttribute("value"),
    ).toBeNull();
    expect(view.getByRole("textbox", { name: "Viesti Pi:lle" })).toHaveProperty(
      "value",
      "Säilyy",
    );
    expect(view.getByText("Viesti hylättiin")).toBeTruthy();
    expect(view.getByRole("button", { name: "Lähetä" })).toHaveProperty(
      "disabled",
      true,
    );
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
});
