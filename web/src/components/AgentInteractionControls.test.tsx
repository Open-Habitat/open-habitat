import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  AgentInteractionControls,
  type SendResult,
} from "./AgentInteractionControls";
import { ConversationTimeline } from "./Conversation";
import type { Availability } from "./types";

const enabled: Availability = { state: "enabled" };
function Harness({
  state = "ready",
  availability = enabled,
  onSend = vi.fn(),
  onInterrupt = vi.fn(),
}: {
  state?: SendResult;
  availability?: Availability;
  onSend?: () => void;
  onInterrupt?: () => void;
}) {
  const [draft, setDraft] = useState("Aloita");
  return (
    <AgentInteractionControls
      draft={draft}
      onDraftChange={setDraft}
      sendAvailability={availability}
      sendResult={state}
      interruptAvailability={availability}
      onSend={onSend}
      onInterrupt={onInterrupt}
    />
  );
}

describe("agent interaction preparation", () => {
  it("supports keyboard send, newline, interrupt and blocks blank sends", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    const interrupt = vi.fn();
    const view = render(<Harness onSend={send} onInterrupt={interrupt} />);
    const field = view.getByRole("textbox", { name: "Viesti agentille" });
    await user.click(field);
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(send).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(send).toHaveBeenCalledOnce();
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    expect(send).toHaveBeenCalledOnce();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(send).toHaveBeenCalledTimes(2);
    await user.click(view.getByRole("button", { name: "Keskeytä vuoro" }));
    expect(interrupt).toHaveBeenCalledOnce();
    await user.clear(field);
    await user.type(field, "  ");
    expect(
      (view.getByRole("button", { name: "Lähetä" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.keyDown(field, { key: "Enter" });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it.each(["pending", "uncertain"] as const)(
    "never resends a %s message on Enter or click",
    (state) => {
      const send = vi.fn();
      const view = render(<Harness state={state} onSend={send} />);
      const button = view.getByRole("button", {
        name: /Lähetä/,
      }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
      fireEvent.keyDown(
        view.getByRole("textbox", { name: "Viesti agentille" }),
        {
          key: "Enter",
        },
      );
      expect(send).not.toHaveBeenCalled();
      expect(view.getByRole("status").textContent).toMatch(
        state === "uncertain" ? /epävarma/ : /odottaa kuittausta/,
      );
    },
  );

  it("blocks a pending or uncertain interruption independently of send", () => {
    const interrupt = vi.fn();
    const props = {
      draft: "Teksti",
      onDraftChange: () => {},
      sendAvailability: enabled,
      sendResult: "ready" as const,
      interruptAvailability: enabled,
      onSend: () => {},
      onInterrupt: interrupt,
    };
    const view = render(
      <AgentInteractionControls {...props} interruptResult="pending" />,
    );
    expect(
      (
        view.getByRole("button", {
          name: /Keskeytä vuoro/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    view.rerender(
      <AgentInteractionControls {...props} interruptResult="uncertain" />,
    );
    fireEvent.click(view.getByRole("button", { name: "Keskeytä vuoro" }));
    expect(interrupt).not.toHaveBeenCalled();
    expect(view.getByRole("status").textContent).toContain(
      "Keskeytyksen tulos on epävarma",
    );
  });

  it("shows rejection and acknowledgement without claiming execution or erasing the draft", () => {
    const view = render(<Harness state="rejected" />);
    expect(view.getByText("Viesti hylättiin")).toBeTruthy();
    expect((view.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "Aloita",
    );
    view.rerender(<Harness state="acknowledged" />);
    expect(view.getByRole("status").textContent).toContain(
      "ei vahvista sen suorittamista",
    );
    expect((view.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "Aloita",
    );
  });

  it("retains editable draft, focus and reading position across synthetic timeline replacement", async () => {
    const user = userEvent.setup();
    function Page({ update }: { update: number }) {
      const [draft, setDraft] = useState("Luonnos");
      return (
        <>
          <ConversationTimeline
            state="ready"
            items={[{ id: "stable", content: <p>{`Päivitys ${update}`}</p> }]}
            historyMode="pagedAccessible"
            onJumpToLatest={() => {}}
          />
          <AgentInteractionControls
            draft={draft}
            onDraftChange={setDraft}
            sendAvailability={enabled}
            sendResult="ready"
            interruptAvailability={enabled}
            onSend={() => {}}
          />
        </>
      );
    }
    const view = render(<Page update={1} />);
    const field = view.getByRole("textbox", { name: "Viesti agentille" });
    const timeline = view.getByRole("region", { name: "Keskusteluhistoria" });
    Object.defineProperty(timeline, "scrollTop", {
      value: 140,
      writable: true,
    });
    await user.click(field);
    await user.type(field, " jatkuu");
    view.rerender(<Page update={2} />);
    expect(view.getByRole("textbox", { name: "Viesti agentille" })).toBe(field);
    expect((field as HTMLTextAreaElement).value).toBe("Luonnos jatkuu");
    expect(document.activeElement).toBe(field);
    expect(view.getByRole("region", { name: "Keskusteluhistoria" })).toBe(
      timeline,
    );
    expect(timeline.scrollTop).toBe(140);
    expect(view.getByText("Päivitys 2")).toBeTruthy();
  });

  it("shows unavailability reason while retaining an editable draft; missing handlers cannot activate", () => {
    const send = vi.fn();
    const view = render(
      <Harness
        availability={{ state: "read_only", reason: "Ei ohjausoikeutta." }}
        onSend={send}
      />,
    );
    expect(view.getAllByText("Ei ohjausoikeutta.")).toHaveLength(2);
    expect(
      (view.getByRole("button", { name: "Lähetä" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        view.getByRole("button", {
          name: "Keskeytä vuoro",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect((view.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(
      false,
    );
    view.rerender(
      <AgentInteractionControls
        draft="Teksti"
        onDraftChange={() => {}}
        sendAvailability={enabled}
        sendResult="ready"
        interruptAvailability={enabled}
      />,
    );
    expect(
      view.getAllByText("Ohjausta ei ole kytketty agenttiin."),
    ).toHaveLength(2);
    expect(
      (view.getByRole("button", { name: "Lähetä" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
