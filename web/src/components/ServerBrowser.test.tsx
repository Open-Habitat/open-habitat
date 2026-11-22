import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { BrowserVisits } from "../app/turnBrowserVisits";
import { AgentNavItem } from "./Navigation";
import {
  BrowserGaveBackLine,
  BrowserRailRow,
  BrowserRowMarks,
  BrowserTurnCard,
} from "./ServerBrowser";

const at = (h: number, m: number) => new Date(2026, 10, 22, h, m).getTime();
const owner: BrowserVisits = {
  summary: {
    sites: ["https://energia.example", "https://tunnistus.example"],
    pageCount: 2,
    downloadCount: 1,
    actionCount: 1,
    startedAt: at(9, 12),
    endedAt: at(9, 31),
  },
  detail: {
    pages: [
      {
        callId: "1",
        at: at(9, 12),
        origin: "https://energia.example",
        path: "/laskut",
        title: "Omat laskut",
      },
      {
        callId: "2",
        at: at(9, 13),
        origin: "https://tunnistus.example",
        path: "/vahvista",
        title: "Vahvista kirjautuminen",
      },
    ],
    downloads: [
      {
        callId: "3",
        at: at(9, 30),
        fileName: "lasku-2026-10.pdf",
        targetFolder: "~/Downloads",
      },
    ],
    actions: [
      { callId: "4", at: at(9, 13), kind: "click", selector: "a.kirjaudu" },
    ],
  },
  windows: [],
  coverage: "command-results-only",
};
const participant: BrowserVisits = {
  summary: owner.summary,
  coverage: "command-results-only",
};

describe("the Selain card", () => {
  it("is the visit record when done, and opens to pages, downloads, actions and the person's span", () => {
    render(
      <BrowserTurnCard
        state="done"
        visits={owner}
        tabsClosed
        you={{ from: at(9, 16), to: at(9, 18) }}
      />,
    );
    const card = screen.getByTestId("browser-card");
    expect(card.getAttribute("data-state")).toBe("done");
    const meta = within(card).getByTestId("browser-card-meta");
    expect(meta.textContent).toContain("energia.example");
    expect(meta.textContent).toContain("2 sivua · 1 lataus · 1 toiminto");
    expect(meta.textContent).toContain("9.12–9.31");
    expect(
      within(card).queryByRole("button", { name: /Ota ohjaus/ }),
    ).toBeNull();
    fireEvent.click(within(card).getByTestId("browser-card-toggle"));
    const detail = within(card).getByTestId("browser-card-detail");
    expect(detail.textContent).toContain("Vahvista kirjautuminen");
    expect(detail.textContent).toContain("/vahvista");
    expect(detail.textContent).toContain("lasku-2026-10.pdf");
    expect(detail.textContent).toContain("a.kirjaudu");
    expect(detail.textContent).toContain("Agentin välilehdet suljettu");
    expect(within(card).getByTestId("browser-card-you").textContent).toContain(
      "Ohjasit selainta 9.16–9.18 agentin pyynnöstä.",
    );
  });

  it("works, asks, and is controlled in place, each with its own buttons", () => {
    const look = vi.fn();
    const take = vi.fn();
    const giveBack = vi.fn();
    const props = {
      visits: owner,
      onLook: look,
      onTake: take,
      onGiveBack: giveBack,
    };
    const view = render(<BrowserTurnCard state="working" {...props} />);
    const card = () => screen.getByTestId("browser-card");
    expect(card().textContent).toContain("Selain nyt");
    expect(card().textContent).toContain("tähän mennessä");
    fireEvent.click(screen.getByTestId("browser-card-look"));
    expect(look).toHaveBeenCalled();

    view.rerender(
      <BrowserTurnCard
        state="ask"
        request="Vahvista <b>kirjautuminen</b>"
        {...props}
      />,
    );
    expect(card().getAttribute("data-state")).toBe("ask");
    // The agent's words are text, never markup.
    expect(screen.getByTestId("browser-card-request").textContent).toBe(
      "Vahvista <b>kirjautuminen</b>",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ota ohjaus ja hoida" }),
    );
    expect(take).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Katso ensin" })).toBeTruthy();

    view.rerender(<BrowserTurnCard state="control" {...props} />);
    expect(card().textContent).toContain("Sinä ohjaat selainta");
    fireEvent.click(screen.getByRole("button", { name: "Anna takaisin" }));
    expect(giveBack).toHaveBeenCalled();
  });

  it("shows a participant the summary only: nothing opens and nothing acts on the owner's browser", () => {
    render(<BrowserTurnCard state="done" visits={participant} />);
    const card = screen.getByTestId("browser-card");
    expect(card.textContent).toContain("2 sivua");
    expect(within(card).queryByRole("button")).toBeNull();
    expect(within(card).queryByTestId("browser-card-detail")).toBeNull();
  });

  it("says when the browser was given back", () => {
    render(<BrowserGaveBackLine at={at(9, 18)} />);
    expect(screen.getByTestId("browser-gave-back").textContent).toContain(
      "Annoit selaimen takaisin 9.18",
    );
  });
});

describe("the rail's Oma selain row", () => {
  const row = (props: Partial<Parameters<typeof BrowserRailRow>[0]>) =>
    render(
      <BrowserRailRow
        summary={{ kind: "idle" }}
        windows={1}
        onOpen={() => {}}
        {...props}
      />,
    );
  it("is a plain row with the window icon and its short state at the end", () => {
    const view = row({});
    const button = screen.getByTestId("browser-rail-row");
    expect(button.tagName).toBe("BUTTON");
    expect(button.querySelector("svg")).toBeTruthy();
    expect(screen.getByTestId("browser-rail-state").textContent).toContain(
      "1 ikkuna",
    );
    view.rerender(
      <BrowserRailRow
        summary={{ kind: "agent" }}
        windows={2}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByTestId("browser-rail-state").textContent).toContain(
      "agentti · 2 ikkunaa",
    );
    view.rerender(
      <BrowserRailRow
        summary={{ kind: "ask", text: "x" }}
        windows={2}
        conversation="Sähkölaskut 2026"
        onOpen={() => {}}
      />,
    );
    expect(screen.getByTestId("browser-rail-state").textContent).toContain(
      "odottaa sinua",
    );
    expect(
      screen.getByTestId("browser-rail-row").getAttribute("aria-label"),
    ).toBe("Oma selain odottaa sinua, keskustelu Sähkölaskut 2026");
    view.rerender(
      <BrowserRailRow
        summary={{ kind: "person" }}
        windows={2}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByTestId("browser-rail-state").textContent).toContain(
      "sinä ohjaat",
    );
    view.rerender(
      <BrowserRailRow
        summary={{ kind: "stopped" }}
        windows={0}
        onOpen={() => {}}
      />,
    );
    expect(screen.getByTestId("browser-rail-state").textContent).toContain(
      "ei auki",
    );
  });
  it("does not share Tuotokset's globe", () => {
    row({});
    expect(
      screen.getByTestId("browser-rail-row").querySelector("circle"),
    ).toBeNull();
  });
});

describe("the conversation row's browser mark", () => {
  const item = (marks: Map<string, "working" | "ask" | "control">) =>
    render(
      <MemoryRouter>
        <BrowserRowMarks.Provider value={marks}>
          <ul>
            <AgentNavItem
              agentId="pi:a"
              href="/agents/pi:a"
              title="Sähkölaskut 2026"
              activity="waiting"
              activityLabel="Odottaa viestiä"
              controlLabel=""
              changedAt={Date.now() - 60000}
            />
          </ul>
        </BrowserRowMarks.Provider>
      </MemoryRouter>,
    );
  it("takes the time's place while the conversation waits in the browser, and says so", () => {
    const view = item(new Map([["pi:a", "ask"]]));
    const mark = view.getByTestId("row-browser");
    expect(mark.getAttribute("data-state")).toBe("ask");
    expect(mark.textContent).toContain("selain");
    const row = view.getByTestId("agent-item-pi:a");
    expect(row.querySelector("time")).toBeNull();
    expect(row.getAttribute("title")).toContain("Odottaa sinua selaimessa");
  });
  it("is a quiet icon while the agent works there, and gone otherwise", () => {
    const view = item(new Map([["pi:a", "working"]]));
    expect(view.getByTestId("row-browser").textContent).toBe("");
    view.unmount();
    const plain = item(new Map());
    expect(plain.queryByTestId("row-browser")).toBeNull();
    expect(
      plain.getByTestId("agent-item-pi:a").querySelector("time"),
    ).toBeTruthy();
  });
});
