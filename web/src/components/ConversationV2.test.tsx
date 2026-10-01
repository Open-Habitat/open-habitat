import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  AssistantMessage,
  Composer,
  ConversationTimeline,
  LiveToolRow,
  QueuePanel,
  UserMessage,
} from "./Conversation";

function mount(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>);
}
const noop = () => {};
describe("conversation v2 presentation", () => {
  it("shows only observed live-tool facts and a textual running status", () => {
    const view = mount(<LiveToolRow name="bash" state="running" />);
    const row = view.getByRole("status", { name: /bash.*ajossa/ });
    expect(row.textContent).toBe("bashajossa");
    expect(row.querySelector("code")).toBeNull();
    expect(row.textContent).not.toMatch(/\d+ s/);
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
    expect(steer).toHaveBeenCalledTimes(1);
    fireEvent.click(view.getByRole("button", { name: "Lähetä" }));
    expect(mode).toHaveBeenCalledWith("follow_up");
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
    expect(view.getByText(/Enter: Ohjaa/)).toBeTruthy();
    const editor = view.getByRole("textbox", { name: "Viesti Pi:lle" });
    expect(editor.getAttribute("aria-describedby")).toBeTruthy();
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
    expect(
      view.getByText(/Vuoro valmis 13.53 · odottaa viestiäsi/),
    ).toBeTruthy();
    expect(view.getAllByText(/Vuoro valmis/)).toHaveLength(1);
  });
  it("offers a return to latest even without new content when the reader scrolled away", () => {
    const jump = vi.fn();
    const view = mount(
      <ConversationTimeline
        state="ready"
        items={[]}
        historyMode="pagedAccessible"
        showJumpToLatest
        onJumpToLatest={jump}
      />,
    );
    fireEvent.click(view.getByRole("button", { name: "Viimeisimpään" }));
    expect(jump).toHaveBeenCalledTimes(1);
  });
});
