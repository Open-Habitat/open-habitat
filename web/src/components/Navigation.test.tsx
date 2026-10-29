import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { agentPresentation } from "./agentPresentation";
import {
  AgentHeader,
  AgentNavItem,
  type AgentNavModel,
  ballOf,
  changeAge,
  NowSections,
} from "./Navigation";

const longTitle =
  "Keskustelu pitkästä aiheesta ja sen eri vaiheista sekä kaikista tähän liittyvistä muutoksista";
function header(title: string) {
  return (
    <MemoryRouter>
      <AgentHeader
        title={title}
        activityLabel="Valmis"
        controlLabel="Luettavissa"
        workspaceLabel="Työtila"
        workspaceHref="/workspaces/ws_example00"
        detailsExpanded={false}
        onToggleDetails={() => {}}
      />
    </MemoryRouter>
  );
}
describe("conversation title", () => {
  it("shows the title action beside the title only when enabled", () => {
    let presses = 0;
    const view = render(
      <MemoryRouter>
        <AgentHeader
          title="Native title"
          activityLabel="Valmis"
          controlLabel="Selainohjaus"
          workspaceLabel="Työtila"
          workspaceHref="/workspaces/ws_example00"
          detailsExpanded={false}
          onToggleDetails={() => {}}
          titleAction={{
            label: "Luo uusi otsikko",
            availability: { state: "enabled" },
            onPress: () => {
              presses++;
            },
          }}
        />
      </MemoryRouter>,
    );
    fireEvent.click(view.getByTestId("conversation-retitle"));
    expect(presses).toBe(1);
    view.rerender(
      <MemoryRouter>
        <AgentHeader
          title="Native title"
          activityLabel="Valmis"
          controlLabel="Vain luku"
          workspaceLabel="Työtila"
          workspaceHref="/workspaces/ws_example00"
          detailsExpanded={false}
          onToggleDetails={() => {}}
          titleAction={{
            label: "Luo uusi otsikko",
            availability: { state: "disabled", reason: "Vain luku" },
            onPress: () => {},
          }}
        />
      </MemoryRouter>,
    );
    expect(view.getByTestId("conversation-retitle")).toBeTruthy();
    expect(
      view.getByTestId("conversation-retitle").hasAttribute("disabled"),
    ).toBe(true);
  });

  it("keeps the native title while pending and clears busy on completion or failure", () => {
    const draw = (pending: boolean, title: string) => (
      <MemoryRouter>
        <AgentHeader
          title={title}
          titlePending={pending}
          activityLabel="Valmis"
          controlLabel="Selainohjaus"
          workspaceLabel="Työtila"
          workspaceHref="/workspaces/ws_example00"
          detailsExpanded={false}
          onToggleDetails={() => {}}
          titleAction={{
            label: "Luo otsikko",
            availability: { state: "enabled" },
            onPress: () => {},
          }}
        />
      </MemoryRouter>
    );
    const view = render(draw(true, longTitle));
    expect(
      view.getByTestId("conversation-title").getAttribute("aria-busy"),
    ).toBe("true");
    expect(view.getByTestId("workspace-title").textContent).toBe(longTitle);
    expect(
      view.getByTestId("conversation-retitle").hasAttribute("disabled"),
    ).toBe(true);
    view.rerender(draw(false, "Native replacement"));
    expect(
      view.getByTestId("conversation-title").getAttribute("aria-busy"),
    ).toBe("false");
    expect(view.getByTestId("workspace-title").textContent).toBe(
      "Native replacement",
    );
    view.rerender(draw(true, "Native replacement"));
    view.rerender(draw(false, "Native replacement"));
    expect(
      view.getByTestId("conversation-title").getAttribute("aria-busy"),
    ).toBe("false");
    expect(view.getByTestId("workspace-title").textContent).toBe(
      "Native replacement",
    );
    expect(
      view.getByTestId("conversation-retitle").hasAttribute("disabled"),
    ).toBe(false);
  });

  it("keeps a long title accessible without adding a disclosure control", () => {
    const view = render(header(longTitle));
    const heading = view.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe(longTitle);
    // The activity dot (its tooltip's trigger), Tiedot, and the menu that
    // CSS shows in its place on a phone or a short row.
    expect(
      view.getAllByRole("button").map((b) => b.getAttribute("data-testid")),
    ).toEqual(["header-activity", "workspace-details", "conversation-menu"]);
  });
});

// proto-conversation-header round 2: the activity is a dot whose state is
// its name and, on hover, focus or a tap, its tooltip; the model chip names
// only the model and keeps the thinking level in its tooltip and name.
it("names the activity dot with its state and the model chip with its level", () => {
  const view = render(
    <MemoryRouter>
      <AgentHeader
        title="Otsikko"
        activityLabel="Työskentelee"
        activityDetail="Ajattelee · 2 min 14 s"
        activityKind="working"
        controlLabel="Selainohjaus"
        workspaceLabel="Repo"
        workspaceHref="/workspaces/ws_example00"
        detailsExpanded={false}
        onToggleDetails={() => {}}
        settings={{ model: "Opus 5.5", thinking: "medium" }}
      />
    </MemoryRouter>,
  );
  const dot = view.getByRole("button", {
    name: "Työskentelee · Ajattelee · 2 min 14 s",
  });
  expect(dot.querySelector(".ah-header-tip")?.textContent).toBe(
    "Työskentelee · Ajattelee · 2 min 14 s",
  );
  fireEvent.click(dot);
  expect(dot.hasAttribute("data-open")).toBe(true);
  fireEvent.keyDown(dot, { key: "Escape" });
  expect(dot.hasAttribute("data-open")).toBe(false);
  const chip = view.getByTestId("conversation-details");
  expect(chip.textContent).toBe("Opus 5.5");
  expect(chip.getAttribute("title")).toBe("Opus 5.5 · ajattelutaso medium");
  expect(chip.getAttribute("aria-label")).toContain("ajattelutaso medium");
});

it("shows native settings in a chip and aligned facts without loose disabled reasons", () => {
  const view = render(
    <MemoryRouter>
      <AgentHeader
        title="Otsikko"
        activityLabel="Odottaa sinua"
        controlLabel="Vain luku"
        workspaceLabel="Repo"
        workspaceHref="/workspaces/ws_example00"
        detailsExpanded
        onToggleDetails={() => {}}
        settings={{ model: "provider/model", thinking: "high" }}
        archiveReason="Estetty"
        titleAction={{
          label: "Luo uusi otsikko",
          availability: { state: "disabled", reason: "Ei nimettävää" },
          onPress: () => {},
        }}
      />
    </MemoryRouter>,
  );
  expect(view.getAllByTestId("workspace-details")).toBeTruthy();
  expect(view.getByRole("region").textContent).toContain("provider/model");

  expect(
    view.getByTestId("conversation-retitle").getAttribute("aria-describedby"),
  ).toBeTruthy();
});
// rail-mark-pulse: a live turn showed the grey ◌ glyph instead of the
// draft's pulsing accent dot, and the whole spinoff mark blinked.
describe("rail activity marks", () => {
  const row = (
    facts: Parameters<typeof agentPresentation>[0],
    spin = false,
  ) => {
    const presentation = agentPresentation(facts);
    return render(
      <MemoryRouter>
        <ul>
          <AgentNavItem
            agentId="pi:a"
            href="/agents/pi:a"
            title="Keskustelu"
            activity={presentation.activity}
            activityLabel={presentation.activityLabel}
            controlLabel={presentation.controlLabel}
            spinoffWorking={spin}
          />
        </ul>
      </MemoryRouter>,
    );
  };
  const ball = (view: ReturnType<typeof row>) =>
    view.container.querySelector(".ah-ball")?.className ?? "";
  it("maps a working turn to the working ball", () => {
    const view = row({ process: "daemon_managed_live", runActive: true });
    expect(ball(view)).toContain("ah-ball-work");
    expect(view.container.querySelector(".ah-ball")?.textContent).toBe("");

    const link = view.getByRole("link");
    expect(
      document.getElementById(link.getAttribute("aria-describedby") ?? ""),
    ).toBeTruthy();
  });
  it("shows a turn that ended, waiting for a message, as done", () => {
    const view = row({ process: "daemon_managed_live", runActive: false });
    expect(ball(view)).toContain("ah-ball-done");
  });
  it("counts a background wait as working", () => {
    const view = row({
      process: "daemon_managed_live",
      command: "idle",
      waitingOn: [
        { process_id: "p", name: "testit", kind: "process", run_ids: [] },
      ],
    });
    expect(ball(view)).toContain("ah-ball-work");
    expect(view.container.querySelector('[data-waiting="true"]')).toBeTruthy();
  });
  it("pulses only the branch of a working spinoff's mark", () => {
    const view = row(
      { process: "daemon_managed_live", runActive: false },
      true,
    );
    const mark = view.container.querySelector("svg.ah-nav-spinoff");
    expect(mark).not.toBeNull();
    const branch = mark?.querySelector(".ah-nav-spinoff-branch");
    expect(branch?.querySelectorAll("path, circle")).toHaveLength(2);
    // The trunk (top dot and stem) stays outside the pulsing group.
    expect(
      mark?.querySelectorAll(":scope > path, :scope > circle"),
    ).toHaveLength(2);
  });
});

// sidebar-group-row-time: one line per conversation, the state ball and the
// time since its last change; Käynnissä grouped by workspace.
describe("Ryhmät rows", () => {
  const now = Date.parse("2026-10-29T12:00:00Z");
  const agent = (
    id: string,
    over: Partial<AgentNavModel> = {},
  ): AgentNavModel => ({
    agentId: id,
    href: `/agents/${id}`,
    title: `Keskustelu ${id}`,
    activity: "waiting",
    activityLabel: "Odottaa viestiä",
    controlLabel: "",
    workspaceId: "ws_kasvimaa0",
    workspaceName: "kasvimaa",
    detail: "kasvimaa · Odottaa viestiä",
    ...over,
  });
  const at = (minutes: number) => now - minutes * 60000;
  it("says the age briefly on the row", () => {
    expect(changeAge(at(0.5), now)).toBe("nyt");
    expect(changeAge(at(4), now)).toBe("4 min");
    expect(changeAge(at(130), now)).toBe("2 t");
    expect(changeAge(at(3000), now)).toBe("2 pv");
  });
  it("gives each state its ball", () => {
    expect(ballOf(agent("a", { attentionLabel: "Uusi" }))).toBe("you");
    expect(ballOf(agent("a", { question: true }))).toBe("you");
    expect(ballOf(agent("a", { activity: "working" }))).toBe("work");
    expect(ballOf(agent("a", { activity: "waiting_background" }))).toBe("work");
    expect(ballOf(agent("a", { spinoffWorking: true }))).toBe("work");
    expect(ballOf(agent("a"))).toBe("done");
    expect(ballOf(agent("a", { failed: true }))).toBe("fail");
    expect(ballOf(agent("a", { activity: "unknown" }))).toBe("unknown");
  });
  it("keeps the row to one line and says the rest", () => {
    const view = render(
      <MemoryRouter>
        <ul>
          <AgentNavItem {...agent("a", { changedAt: at(130) })} now={now} />
        </ul>
      </MemoryRouter>,
    );
    const link = view.getByRole("link");
    expect(link.querySelector("time")?.textContent).toBe("2 t");
    expect(link.querySelector(".ah-nav-text")).toBeNull();
    expect(link.closest("li")?.getAttribute("title")).toBe(
      "Keskustelu a · kasvimaa · Odottaa viestiä · 2 t sitten",
    );
    expect(
      document.getElementById(link.getAttribute("aria-describedby") ?? "")
        ?.textContent,
    ).toBe("kasvimaa · Odottaa viestiä · 2 t sitten");
  });
  it("offers each row's archive, says why one waits, and keeps focus in the rail", () => {
    const archived: string[] = [];
    const view = render(
      <MemoryRouter>
        <NowSections
          yours={[agent("y1", { attentionLabel: "Uusi vastaus" })]}
          running={[
            agent("w1", { activity: "working", changedAt: Date.now() }),
            agent("w2", { changedAt: Date.now() }),
          ]}
          archive={{
            reason: (id) =>
              id === "w1" ? "Odota agentin vuoron päättymistä." : "",
            run: (id) => archived.push(id),
          }}
        />
      </MemoryRouter>,
    );
    const button = (id: string) =>
      view
        .getByTestId(`agent-item-${id}`)
        .querySelector<HTMLButtonElement>(
          '[data-testid="rail-archive-conversation"]',
        );
    // The button is a sibling of the row's link, never inside it.
    expect(button("w2")?.closest("a")).toBeNull();
    expect(button("w2")?.getAttribute("aria-label")).toBe(
      "Arkistoi Keskustelu w2",
    );
    expect(button("w1")?.disabled).toBe(true);
    expect(
      document.getElementById(
        button("w1")?.getAttribute("aria-describedby") ?? "",
      )?.textContent,
    ).toBe("Odota agentin vuoron päättymistä.");
    button("w1")?.click();
    expect(archived).toEqual([]);
    button("w2")?.focus();
    fireEvent.click(button("w2") as HTMLButtonElement);
    expect(archived).toEqual(["w2"]);
    // The last row hands focus to the one before it.
    expect(document.activeElement).toBe(
      view.getByTestId("agent-item-w1").querySelector("a"),
    );
  });
  it("groups Käynnissä, folds quiet rows, and sinks an all-quiet workspace", () => {
    const view = render(
      <MemoryRouter>
        <NowSections
          yours={[]}
          running={[
            agent("w1", { activity: "working", changedAt: Date.now() }),
            agent("w2", { changedAt: Date.now() - 3 * 3600000 }),
            agent("w3", {
              changedAt: Date.now() - 3 * 3600000,
              selected: true,
            }),
            agent("w4", {
              changedAt: Date.now() - 2 * 3600000,
              failed: true,
            }),
            agent("k1", {
              workspaceId: "ws_kotisivu0",
              workspaceName: "kotisivu",
              changedAt: Date.now() - 25 * 3600000,
            }),
          ]}
        />
      </MemoryRouter>,
    );
    const group = view.getByTestId("rail-group-kasvimaa");
    expect(group.querySelector("h3")?.textContent).toBe("kasvimaa4");
    // The open conversation and the failed one never fold away.
    for (const id of ["w1", "w3", "w4"])
      expect(view.queryByTestId(`agent-item-${id}`)).not.toBeNull();
    expect(view.queryByTestId("agent-item-w2")).toBeNull();
    const fold = view.getByTestId("rail-fold-quiet-kasvimaa");
    expect(fold.textContent).toBe("1 hiljainen");
    fireEvent.click(fold);
    expect(view.queryByTestId("agent-item-w2")).not.toBeNull();
    expect(view.queryByTestId("rail-group-kotisivu")).toBeNull();
    expect(view.getByTestId("rail-quiet-rule").textContent).toBe(
      "Hiljaiset · yli tunnin",
    );
    expect(view.queryByTestId("agent-item-k1")).toBeNull();
    fireEvent.click(view.getByTestId("rail-fold-dormant-kotisivu"));
    expect(
      view.getByTestId("agent-item-k1").querySelector("time")?.textContent,
    ).toBe("1 pv");
  });
});
