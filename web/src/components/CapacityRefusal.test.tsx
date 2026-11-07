import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { type CapacityHolder, CapacityRefusal } from "./CapacityRefusal";

// jsdom lays nothing out.
Element.prototype.scrollIntoView = vi.fn();

const holders: CapacityHolder[] = [
  {
    agentId: "pi:a",
    title: "Lomake",
    workspaceName: "kotisivu",
    activity: "turn",
  },
  {
    agentId: "pi:b",
    title: "Kehityspalvelin",
    workspaceName: "kotisivu",
    activity: "processes",
  },
  {
    agentId: "pi:c",
    title: "Käännökset",
    workspaceName: "aurinkokello",
    activity: "question",
  },
];

const card = (props: Partial<Parameters<typeof CapacityRefusal>[0]> = {}) => {
  const calls = {
    retry: vi.fn(),
    stop: vi.fn(),
    open: vi.fn(),
    admin: vi.fn(),
  };
  render(
    <CapacityRefusal
      limit={3}
      source="installation"
      here="kotisivu"
      holders={holders}
      room={false}
      tries={0}
      onRetry={calls.retry}
      onStop={calls.stop}
      onOpen={calls.open}
      onAdmin={calls.admin}
      {...props}
    />,
  );
  return calls;
};

it("tells the administrator's limit, lists workspaces and lets an administrator change it", () => {
  const calls = card({ admin: true });
  const notice = screen.getByTestId("creation-problem");
  expect(notice.dataset.state).toBe("refused");
  expect(notice.getAttribute("role")).toBe("alert");
  expect(notice.dataset.tone).toBe("danger");
  expect(notice.textContent).toContain(
    "Ylläpitäjän asettama raja on 3 yhtä aikaa työskentelevää keskustelua, ja 3 työskentelee jo.",
  );
  // This workspace first; no edit action at the limit.
  const chips = screen.getAllByTestId("capacity-workspace");
  expect(chips.map((c) => c.dataset.workspace)).toEqual([
    "kotisivu",
    "aurinkokello",
  ]);
  expect(screen.queryByText("Muokkaa")).toBeNull();
  fireEvent.click(screen.getByTestId("capacity-admin"));
  expect(calls.admin).toHaveBeenCalled();
  expect(screen.getByTestId("capacity-admin").textContent).toBe(
    "Muuta rajaa (ylläpitäjä)",
  );
  fireEvent.click(screen.getByTestId("retry"));
  expect(calls.retry).toHaveBeenCalled();
});

it("greys Change the limit out for anyone else, pointing at the sentence", () => {
  card({ admin: false, source: "own", tries: 1 });
  const button = screen.getByTestId("capacity-admin");
  expect(button.textContent).toBe("Muuta rajaa");
  expect(button.hasAttribute("disabled")).toBe(true);
  const sentence = document.getElementById(
    button.getAttribute("aria-describedby") ?? "",
  );
  expect(sentence?.textContent).toContain(
    "Ylläpitäjä on antanut sinulle rajan 3",
  );
  expect(sentence?.textContent).toContain("Yritit uudelleen: yhä täynnä.");
});

it("opens the window by workspace with a stop fitting each kind", () => {
  const calls = card({ admin: false });
  fireEvent.click(screen.getAllByTestId("capacity-workspace")[1]);
  const window = screen.getByTestId("capacity-window");
  expect(
    window
      .querySelector('[data-group="aurinkokello"]')
      ?.hasAttribute("data-target"),
  ).toBe(true);
  const rows = within(window).getAllByTestId("capacity-holder");
  expect(rows.map((r) => r.dataset.state)).toEqual([
    "turn",
    "processes",
    "question",
  ]);
  const stops = within(window).getAllByTestId("capacity-stop");
  expect(stops.map((s) => s.textContent)).toEqual([
    "Pysäytä vuoro",
    "Pysäytä prosessi",
    "Pysäytä vuoro",
  ]);
  fireEvent.click(stops[1]);
  expect(calls.stop).toHaveBeenCalledWith("pi:b");
});

it("says there is room once a stop freed a place", () => {
  const calls = card({
    room: true,
    holders: holders.map((h, i) => (i === 1 ? { ...h, stopped: true } : h)),
  });
  const notice = screen.getByTestId("creation-problem");
  expect(notice.dataset.state).toBe("room");
  expect(notice.getAttribute("role")).toBe("status");
  expect(notice.dataset.tone).toBe("success");
  expect(notice.textContent).toContain("Tilaa on nyt");
  expect(notice.textContent).toContain(
    "2 keskustelua työskentelee; rajasi on 3.",
  );
  fireEvent.click(screen.getByTestId("retry"));
  expect(calls.retry).toHaveBeenCalled();
});
