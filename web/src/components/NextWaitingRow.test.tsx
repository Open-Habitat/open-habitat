import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { AgentNavModel } from "./Navigation";
import { NextWaitingRow } from "./NextWaitingRow";

const row = (agentId: string, edit: Partial<AgentNavModel> = {}) => ({
  agentId,
  href: `/agents/${agentId}`,
  title: `Keskustelu ${agentId}`,
  activityLabel: "Uusi vastaus",
  controlLabel: "",
  workspaceId: "ws_home",
  workspaceName: "kotipalvelin",
  ...edit,
});

it("says why the offer waits, its age and another workspace's name", () => {
  const now = Date.parse("2026-10-29T12:00:00Z");
  const { rerender } = render(
    <NextWaitingRow
      offer={row("a", { question: true, changedAt: now - 12 * 60000 })}
      more={2}
      workspaceId="ws_home"
      waits={() => true}
      now={now}
      onOpen={() => {}}
    />,
  );
  const open = screen.getByTestId("next-open");
  expect(open.textContent).toContain("Keskustelu a");
  expect(open.textContent).toContain("kysyy · 12 min");
  expect(open.textContent).toContain("+2");
  expect(open.textContent).not.toContain("kotipalvelin");
  rerender(
    <NextWaitingRow
      offer={row("a")}
      more={0}
      workspaceId="ws_other"
      waits={() => true}
      now={now}
      onOpen={() => {}}
    />,
  );
  expect(open.textContent).toContain("kotipalvelin · uusi vastaus");
  expect(open.textContent).not.toMatch(/\+\d/);
});

it("says once that the offered one was handled elsewhere, but not when the order only moved", () => {
  vi.useFakeTimers();
  try {
    let waiting = ["a", "b"];
    const view = (offer?: AgentNavModel) => (
      <NextWaitingRow
        offer={offer}
        more={0}
        waits={(id) => waiting.includes(id)}
        onOpen={() => {}}
      />
    );
    const { rerender, container } = render(view(row("a")));
    // A came before b in the rail and still waits: no note.
    rerender(view(row("b")));
    expect(screen.queryByTestId("next-note")).toBeNull();
    waiting = [];
    rerender(view(undefined));
    expect(screen.getByTestId("next-note").textContent).toBe(
      "Keskustelu b hoidettiin toisaalla.",
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(container.textContent).toBe("");
  } finally {
    vi.useRealTimers();
  }
});
