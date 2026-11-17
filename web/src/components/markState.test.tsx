import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HabitatMark } from "./HabitatMark";
import {
  activityMark,
  agentMark,
  markDrifts,
  subMarks,
  workerMark,
} from "./markState";

// The product-state to mark-state table of brand-themes-and-state-mark.
describe("mark state mapping", () => {
  it("maps a conversation's state as the rail knows it", () => {
    expect(agentMark({ activity: "working" })).toBe("working");
    expect(agentMark({ activity: "waiting_background" })).toBe("background");
    expect(agentMark({ activity: "waiting" })).toBe("done");
    expect(agentMark({ activity: "closed" })).toBe("done");
    expect(agentMark({ activity: "unknown" })).toBe("unknown");
    expect(agentMark({ question: true })).toBe("waiting");
    expect(agentMark({ attentionLabel: "Uusi vastaus" })).toBe("waiting");
    expect(agentMark({ turnMark: "read" })).toBe("read");
    // A question outranks a read reply: it asks something new.
    expect(agentMark({ question: true, turnMark: "read" })).toBe("waiting");
    // A raise is the person's act; the mark says what the agent does.
    expect(agentMark({ turnMark: "raised", activity: "waiting" })).toBe("done");
    expect(agentMark({ failed: true, activity: "working" })).toBe("error");
    expect(agentMark({ spinoffIdle: true, activity: "waiting" })).toBe(
      "waiting",
    );
  });
  it("maps a worker's state", () => {
    expect(workerMark("working")).toBe("working");
    expect(workerMark("checking")).toBe("working");
    expect(workerMark("working", true)).toBe("awaited");
    expect(workerMark("idle")).toBe("waiting");
    expect(workerMark("answer")).toBe("waiting");
    expect(workerMark("merged")).toBe("done");
    expect(workerMark("reported")).toBe("done");
    expect(workerMark("failed")).toBe("error");
    expect(workerMark("unfinished")).toBe("error");
    expect(workerMark("unknown")).toBe("unknown");
    expect(workerMark("unmerged")).toBe("unknown");
    expect(workerMark("waiting_parent")).toBe("idle");
  });
  it("maps a bare activity", () => {
    expect(activityMark(undefined)).toBe("unknown");
    expect(activityMark("waiting_background")).toBe("background");
  });
  it("lists the sub-agents waiting for the person first", () => {
    expect(subMarks({ working: 2, idle: 1 })).toEqual([
      "waiting",
      "working",
      "working",
    ]);
    expect(subMarks()).toEqual([]);
  });
});

// mark-hides-background-work, direction 2 Vaeltava ovi: a running process
// adds a drifting door to the state without replacing it.
describe("background process on the mark", () => {
  it("keeps the state and drifts the door where the ring does not move", () => {
    const cases: [Parameters<typeof agentMark>[0], string, boolean][] = [
      [{ turnMark: "read", activity: "waiting" }, "read", true],
      [{ turnMark: "read", activity: "waiting_background" }, "read", true],
      [
        { attentionLabel: "Uusi vastaus", activity: "waiting" },
        "waiting",
        true,
      ],
      [{ question: true }, "waiting", true],
      [{ activity: "waiting" }, "done", true],
      [{ turnMark: "raised", activity: "waiting" }, "done", true],
      [{ failed: true, activity: "waiting" }, "error", true],
      [{ spinoffIdle: true, activity: "waiting" }, "waiting", true],
      // Its ring already moves: working turns it, background drifts it.
      [{ activity: "working" }, "working", false],
      [{ activity: "waiting_background" }, "background", false],
      [{ spinoffWorking: true, activity: "waiting" }, "working", false],
      // The dashed ring is the unknown state itself.
      [{ activity: "unknown" }, "unknown", false],
    ];
    for (const [agent, state, drifts] of cases) {
      const mark = agentMark(agent);
      expect(mark, JSON.stringify(agent)).toBe(state);
      expect(markDrifts(mark, true), JSON.stringify(agent)).toBe(drifts);
      expect(markDrifts(mark, false)).toBe(false);
      expect(markDrifts(mark, undefined)).toBe(false);
    }
  });
  it("draws the drift on the mark only, never on the ring variant", () => {
    const { container } = render(
      <>
        <HabitatMark state="done" drifting data-testid="mark" />
        <HabitatMark state="done" data-testid="still" />
        <HabitatMark state="read" variant="ring" drifting />
      </>,
    );
    const marks = container.querySelectorAll("svg.oh-mark");
    expect(marks[0].hasAttribute("data-drift")).toBe(true);
    expect(marks[0].getAttribute("data-state")).toBe("done");
    expect(marks[1].hasAttribute("data-drift")).toBe(false);
    expect(marks[2].hasAttribute("data-drift")).toBe(false);
  });
});

describe("HabitatMark sub-agents", () => {
  const draw = (size: number, count: number) =>
    render(
      <HabitatMark
        size={size}
        state="working"
        subs={Array(count).fill("working")}
      />,
    ).container;
  it("orbits up to three dots from 20 px", () => {
    const view = draw(20, 3);
    expect(view.querySelectorAll(".oh-sub")).toHaveLength(3);
    expect(view.querySelector(".oh-mark-count")).toBeNull();
  });
  it("says more than three as a figure", () => {
    const view = draw(20, 4);
    expect(view.querySelectorAll(".oh-sub")).toHaveLength(0);
    expect(view.querySelector(".oh-mark-count")?.textContent).toBe("4");
  });
  it("says any number as a figure below 20 px", () => {
    const view = draw(16, 1);
    expect(view.querySelectorAll(".oh-sub")).toHaveLength(0);
    expect(view.querySelector(".oh-mark-count")?.textContent).toBe("1");
  });
});
