import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { NextWaitingQueue, type QueueStep } from "./NextWaitingQueue";

const steps: QueueStep[] = [
  { agentId: "o", title: "Lähtö", state: "origin", ball: "work" },
  { agentId: "a", title: "A", state: "handled", ball: "done" },
  { agentId: "b", title: "B", state: "elsewhere", ball: "work" },
  { agentId: "c", title: "C", state: "waits", ball: "you" },
];
const queue = (pos: number, onNext = () => {}, onPrev = () => {}) => (
  <NextWaitingQueue
    steps={steps}
    pos={pos}
    onGo={() => {}}
    onPrev={onPrev}
    onNext={onNext}
    onEnd={() => {}}
  />
);

it("has no way back from the origin and leads home after the last one still ahead", () => {
  const onPrev = vi.fn();
  const { rerender } = render(queue(0, undefined, onPrev));
  expect(screen.getByTestId("next-queue-prev").hasAttribute("disabled")).toBe(
    true,
  );
  expect(screen.getByTestId("next-queue-next").dataset.last).toBeUndefined();
  // From A only B (handled elsewhere, skipped) and C remain: C is next.
  rerender(queue(1, undefined, onPrev));
  expect(screen.getByTestId("next-queue-next").dataset.last).toBeUndefined();
  fireEvent.click(screen.getByTestId("next-queue-prev"));
  expect(onPrev).toHaveBeenCalledOnce();
  rerender(queue(3));
  expect(screen.getByTestId("next-queue-next").dataset.last).toBe("true");
  expect(
    screen
      .getAllByTestId("next-queue-step")
      .map((s) => s.getAttribute("aria-current")),
  ).toEqual([null, null, null, "step"]);
});
