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
    // The title itself must not become a second disclosure trigger.
    expect(heading.querySelector("button")).toBeNull();
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
  const mark = (view: ReturnType<typeof row>) =>
    view.container
      .querySelector('[data-testid="rail-mark"]')
      ?.getAttribute("data-state");
  it("maps a working turn to the working mark", () => {
    const view = row({ process: "daemon_managed_live", runActive: true });
    expect(mark(view)).toBe("working");
    // The mark is decorative: the row says its state in words.
    expect(
      view.container
        .querySelector('[data-testid="rail-mark"]')
        ?.getAttribute("aria-hidden"),
    ).toBe("true");

    const link = view.getByRole("link");
    expect(
      document.getElementById(link.getAttribute("aria-describedby") ?? ""),
    ).toBeTruthy();
  });
  it("shows a turn that ended, waiting for a message, as done", () => {
    const view = row({ process: "daemon_managed_live", runActive: false });
    expect(mark(view)).toBe("done");
  });
  it("shows a background wait as its own mark", () => {
    const view = row({
      process: "daemon_managed_live",
      command: "idle",
      waitingOn: [
        { process_id: "p", name: "testit", kind: "process", run_ids: [] },
      ],
    });
    expect(mark(view)).toBe("background");
    expect(view.container.querySelector('[data-waiting="true"]')).toBeTruthy();
  });
  it("draws sub-agents in the mark and no branch mark at the row's end", () => {
    const view = row(
      { process: "daemon_managed_live", runActive: false },
      true,
    );
    expect(mark(view)).toBe("working");
    expect(view.container.querySelector(".ah-worker-branch")).toBeNull();
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
    expect(ballOf(agent("a", { spinoffIdle: true }))).toBe("you");
    expect(ballOf(agent("a"))).toBe("done");
    expect(ballOf(agent("a", { failed: true }))).toBe("fail");
    expect(ballOf(agent("a", { activity: "unknown" }))).toBe("unknown");
  });
  it("raises a quiet row and lowers a raised one or says Ei nyt to a reply from the rail", () => {
    const pressed: [string, string][] = [];
    const turn = {
      run: (id: string, action: "raise" | "lower" | "not_now") => {
        pressed.push([id, action]);
      },
    };
    const view = render(
      <MemoryRouter>
        <ul>
          <AgentNavItem {...agent("q", { turnAction: "raise" })} turn={turn} />
          <AgentNavItem
            {...agent("r", { turnMark: "raised", turnAction: "lower" })}
            turn={turn}
          />
          <AgentNavItem
            {...agent("n", { turnMark: "read", turnAction: "not_now" })}
            turn={turn}
          />
        </ul>
      </MemoryRouter>,
    );
    const row = (id: string) => view.getByTestId(`agent-item-${id}`);
    const press = (id: string, testId: string) => {
      const button = row(id).querySelector<HTMLButtonElement>(
        `[data-testid="${testId}"]`,
      );
      expect(button).not.toBeNull();
      button?.click();
    };
    press("q", "rail-raise-conversation");
    press("r", "rail-lower-conversation");
    press("n", "rail-not-now-conversation");
    expect(pressed).toEqual([
      ["q", "raise"],
      ["r", "lower"],
      ["n", "not_now"],
    ]);
    expect(
      row("n")
        .querySelector('[data-testid="rail-not-now-conversation"]')
        ?.getAttribute("aria-label"),
    ).toBe("Ei nyt: siirrä Keskustelu n Hiljaisiin");
    // A read reply keeps its ring; a raised row's mark is its agent's state.
    expect(row("n").getAttribute("data-ball")).toBe("you");
    const mark = (id: string) =>
      row(id)
        .querySelector('[data-testid="rail-mark"]')
        ?.getAttribute("data-state");
    expect(mark("n")).toBe("read");
    expect(row("r").getAttribute("data-ball")).toBe("done");
    expect(mark("r")).toBe("done");
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
  it("keeps old running rows visible in their workspace groups", () => {
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
    for (const id of ["w1", "w2", "w3", "w4", "k1"])
      expect(view.queryByTestId(`agent-item-${id}`)).not.toBeNull();
    expect(view.queryByTestId(/^rail-fold-/)).toBeNull();
    expect(
      view.getByTestId("agent-item-k1").querySelector("time")?.textContent,
    ).toBe("1 pv");
  });
  // workspace-icons (Lähdeketju): each row leads with its workspace's icon
  // button, Käynnissä drops its repeated heading, and the card names the
  // workspace and where its icon came from.
  it("leads rows with the workspace icon and drops the group heading", () => {
    const icon = {
      name: "kasvimaa",
      glyph: { letters: "KA", hue: 3 },
      show: { kind: "emoji" as const, value: "🥕" },
      source: "Repon asetus",
      where: ".open-habitat.yaml",
    };
    const started: string[] = [];
    const view = render(
      <MemoryRouter>
        <NowSections
          yours={[]}
          running={[
            agent("w1", { workspaceIcon: icon, changedAt: Date.now() }),
            agent("w2", { workspaceIcon: icon, changedAt: Date.now() }),
          ]}
          card={{ onNew: (id) => started.push(id) }}
        />
      </MemoryRouter>,
    );
    expect(view.queryByTestId("rail-group-kasvimaa")).toBeNull();
    const buttons = view.getAllByTestId("workspace-icon-button");
    expect(buttons).toHaveLength(2);
    // The icon is its own button beside the row's link, never inside it.
    expect(buttons[0].closest("a")).toBeNull();
    expect(buttons[0].getAttribute("aria-label")).toBe("Työtila kasvimaa");
    expect(buttons[0].textContent).toBe("🥕");
    fireEvent.click(buttons[0]);
    const card = view.getByTestId("workspace-card");
    expect(card.textContent).toContain("kasvimaa");
    expect(view.getByTestId("workspace-card-source").textContent).toBe(
      "Repon asetus · .open-habitat.yaml",
    );
    fireEvent.click(view.getByTestId("workspace-card-new"));
    expect(started).toEqual(["ws_kasvimaa0"]);
  });
  it("keeps iconed rows flat regardless of their age", () => {
    const icon = (name: string) => ({
      name,
      glyph: { letters: name.slice(0, 2).toUpperCase(), hue: 3 },
      show: { kind: "glyph" as const },
      source: "Kirjaintunnus · johdettu nimestä",
    });
    const view = render(
      <MemoryRouter>
        <NowSections
          yours={[]}
          running={[
            agent("w1", {
              activity: "working",
              changedAt: Date.now(),
              workspaceIcon: icon("kasvimaa"),
            }),
            agent("w2", {
              changedAt: Date.now() - 3 * 3600000,
              workspaceIcon: icon("kasvimaa"),
            }),
            agent("k1", {
              workspaceId: "ws_kotisivu0",
              workspaceName: "kotisivu",
              workspaceIcon: icon("kotisivu"),
              changedAt: Date.now() - 25 * 3600000,
            }),
          ]}
        />
      </MemoryRouter>,
    );
    expect(view.queryByTestId(/^rail-fold-/)).toBeNull();
    expect(view.queryByTestId("rail-group-kotisivu")).toBeNull();
    expect(view.queryByTestId("rail-group-kasvimaa")).toBeNull();
    const quiet = view.getByTestId("rail-running");
    expect(
      [...quiet.querySelectorAll('[data-testid^="agent-item-"]')].map((li) =>
        li.getAttribute("data-testid"),
      ),
    ).toEqual(["agent-item-w1", "agent-item-w2", "agent-item-k1"]);
    expect(
      quiet.querySelectorAll('[data-testid="workspace-icon-button"]'),
    ).toHaveLength(3);
  });
  it("shows the derived glyph when an image does not load", () => {
    const view = render(
      <MemoryRouter>
        <NowSections
          yours={[]}
          collapsed
          running={[
            agent("w1", {
              workspaceIcon: {
                name: "kasvimaa",
                glyph: { letters: "KA", hue: 3 },
                show: { kind: "image", src: "/api/v1/workspaces/icon?x" },
                source: "Repon logo",
                where: "logo.svg",
              },
            }),
          ]}
        />
      </MemoryRouter>,
    );
    const icon = view.getByTestId("workspace-icon");
    expect(icon.getAttribute("data-size")).toBe("m");
    fireEvent.error(icon.querySelector("img") as HTMLImageElement);
    expect(icon.getAttribute("data-kind")).toBe("glyph");
    expect(icon.textContent).toBe("KA");
  });
});
