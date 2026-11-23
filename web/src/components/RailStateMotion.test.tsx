import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import type { AgentNavModel } from "./Navigation";
import {
  type MotionRows,
  motionChanges,
  RailStateMotion,
} from "./RailStateMotion";

const agent = (
  agentId: string,
  rest: Partial<AgentNavModel> = {},
): AgentNavModel => ({
  agentId,
  title: agentId,
  href: "/",
  activity: "waiting",
  activityLabel: "",
  controlLabel: "",
  ...rest,
});
const rows = (rest: Partial<MotionRows>): MotionRows => ({
  yours: [],
  running: [],
  quiet: [],
  ...rest,
});
describe("rail motion events", () => {
  it("ignores initial listings, title edits, reordering and disappeared rows", () => {
    expect(motionChanges(rows({}), rows({ yours: [agent("a")] }))).toEqual([]);
    expect(
      motionChanges(
        rows({ quiet: [agent("a"), agent("b")] }),
        rows({ quiet: [agent("b", { title: "edited" }), agent("a")] }),
      ),
    ).toEqual([]);
    expect(motionChanges(rows({ yours: [agent("a")] }), rows({}))).toEqual([]);
  });
  it("keeps simultaneous changes together and notices new replies and failures in place", () => {
    const before = rows({
      running: [agent("a"), agent("b")],
      yours: [agent("c", { readyKey: "reply:1" })],
    });
    const after = rows({
      running: [agent("b", { failed: true })],
      yours: [agent("a"), agent("c", { readyKey: "reply:2" })],
    });
    expect(
      motionChanges(before, after)
        .map((r) => r.agent.agentId)
        .sort(),
    ).toEqual(["a", "b", "c"]);
    expect(motionChanges(after, after)).toEqual([]);
  });
  it("suppresses reconnect, identity changes and enabling the experiment", () => {
    const root = createRef<HTMLElement>();
    const first = rows({ running: [agent("a")] });
    const second = rows({ yours: [agent("a")] });
    const view = (
      enabled: boolean,
      baseline: string | undefined,
      model: MotionRows,
    ) => (
      <RailStateMotion root={root} state={{ enabled, baseline, rows: model }}>
        <nav ref={root}>
          <li data-testid="agent-item-a">
            <a className="ah-now-row" href="/">
              a
            </a>
          </li>
        </nav>
      </RailStateMotion>
    );
    const rendered = render(view(false, "one", first));
    rendered.rerender(view(true, "one", second));
    expect(rendered.container.querySelector("[data-rail-glow]")).toBeNull();
    rendered.rerender(view(true, undefined, first));
    rendered.rerender(view(true, "one", second));
    expect(rendered.container.querySelector("[data-rail-glow]")).toBeNull();
    rendered.rerender(view(true, "two", first));
    expect(rendered.container.querySelector("[data-rail-glow]")).toBeNull();
    rendered.rerender(view(true, "two", second));
    expect(rendered.container.querySelector("[data-rail-glow]")).not.toBeNull();
    rendered.rerender(view(false, "two", second));
    expect(rendered.container.querySelector("[data-rail-glow]")).toBeNull();
  });
});
