import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Entry } from "../app/HistoryView";
import { PendingWakeBar } from "./ScheduledWake";
import { wakeShort } from "./wakeTime";

const content = { media_type: "text/plain" as const, text: "", complete: true };

describe("wake time on the row", () => {
  // Local times: the row speaks the browser's zone.
  const now = new Date(2026, 10, 17, 15, 20).getTime(); // Tue
  it.each([
    ["later today", new Date(2026, 10, 17, 18, 0), /^18[.:]00$/],
    ["within the week", new Date(2026, 10, 19, 9, 0), /^to 9[.:]00$/],
    ["beyond a week", new Date(2026, 11, 1, 10, 0), /^1\.12\. 10[.:]00$/],
    ["another year", new Date(2027, 0, 4, 9, 0), /2027/],
  ])("%s", (_name, at, shape) => {
    expect(wakeShort(at.getTime(), now)).toMatch(shape);
  });
});

describe("pending wake bar", () => {
  const wakes = [
    {
      id: "wk_0123456789abcdef",
      at: Date.now() + 86_400_000,
      note: "muistuta poistamaan backup-2024",
    },
    {
      id: "wk_fedcba9876543210",
      at: Date.now() + 2 * 86_400_000,
      note: "toinen",
    },
  ];
  it("moves the next wake only to a future time and cancels it by id", () => {
    const onMove = vi.fn();
    const onCancel = vi.fn();
    render(
      <PendingWakeBar wakes={wakes} onMove={onMove} onCancel={onCancel} />,
    );
    // The agent's note is shown unchanged: it is the agent's own content.
    expect(screen.getByTestId("wake-bar-note").textContent).toBe(
      "muistuta poistamaan backup-2024",
    );
    fireEvent.click(screen.getByTestId("wake-change"));
    fireEvent.change(screen.getByTestId("wake-input"), {
      target: { value: "2001-01-01T09:00" },
    });
    fireEvent.click(screen.getByTestId("wake-save"));
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.change(screen.getByTestId("wake-input"), {
      target: { value: "2099-01-02T09:30" },
    });
    fireEvent.click(screen.getByTestId("wake-save"));
    expect(onMove).toHaveBeenCalledWith(
      "wk_0123456789abcdef",
      new Date(2099, 0, 2, 9, 30),
    );
    fireEvent.click(screen.getByTestId("wake-cancel"));
    expect(onCancel).toHaveBeenCalledWith("wk_0123456789abcdef");
  });
  it("shows nothing without a pending wake", () => {
    const view = render(
      <PendingWakeBar wakes={[]} onMove={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(view.container.textContent).toBe("");
  });
});

describe("Habitat's wake line", () => {
  it("is Habitat's line with the note, marked late when it was", () => {
    render(
      <Entry
        entry={{
          entry_key: "w",
          kind: "unknown",
          content,
          scheduled_wake: {
            kind: "fired",
            wakes: [
              {
                at: "2026-11-19T07:00:00Z",
                set_at: "2026-11-17T13:12:00Z",
                fired_at: "2026-11-19T10:36:00Z",
                late_seconds: 12960,
                note: "muistuta poistamaan backup-2024",
              },
            ],
          },
        }}
      />,
    );
    const line = screen.getByTestId("wake-line");
    expect(line.dataset.kind).toBe("fired");
    expect(line.dataset.late).toBe("");
    expect(line.textContent).toContain("muistuta poistamaan backup-2024");
  });
});
