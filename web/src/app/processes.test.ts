import { describe, expect, it } from "vitest";
import inventory from "../../../contracts/v1/examples/process-inventory.json";
import output from "../../../contracts/v1/examples/process-output.json";
import {
  agentPresentation,
  waitsOnWorker,
} from "../components/agentPresentation";
import { parseInventory, parseOutput, processPath } from "./processes";

describe("native process boundary", () => {
  it("keeps missing inventory distinct from an authoritative empty list", () => {
    expect(parseInventory({ ...inventory, processes: [] }).availability).toBe(
      "available",
    );
    expect(() =>
      parseInventory({ ...inventory, availability: "unavailable" }),
    ).toThrow();
    expect(() =>
      parseInventory({ ...inventory, owner_generation: null }),
    ).toThrow();
    expect(() =>
      parseInventory({
        ...inventory,
        processes: [{ ...inventory.processes[0], pid: 123 }],
      }),
    ).toThrow();
    expect(() =>
      parseInventory({
        ...inventory,
        processes: Array(201).fill(inventory.processes[0]),
      }),
    ).toThrow();
    expect(() =>
      parseInventory({
        ...inventory,
        processes: [{ ...inventory.processes[0], started_at: 1e30 }],
      }),
    ).toThrow();
  });
  it("caps total UTF-8 output rather than trusting character count or per-line limits", () => {
    expect(parseOutput(output).omitted_before).toBe(12);
    expect(() =>
      parseOutput({
        ...output,
        lines: [{ stream: "stdout", text: "ä".repeat(65537) }],
      }),
    ).toThrow();
    expect(() =>
      parseOutput({
        ...output,
        lines: Array(2001).fill({ stream: "stdout", text: "" }),
      }),
    ).toThrow();
    expect(() => processPath("../../other-user")).toThrow();
  });
  it("uses run facts, pending questions, then one host-derived background wait", () => {
    const facts = {
      process: "daemon_managed_live",
      command: "idle",
      waitingOn: [
        {
          process_id: "proc_example",
          name: "testit",
          kind: "process" as const,
          run_ids: [],
        },
      ],
    };
    // A process and a Taskfleet worker are the same state for the person.
    const worker = {
      ...facts,
      waitingOn: [{ ...facts.waitingOn[0], kind: "taskfleet_wait" as const }],
    };
    expect(agentPresentation(facts).activity).toBe("waiting_background");
    expect(agentPresentation(worker).activity).toBe("waiting_background");
    expect(agentPresentation(worker).activityLabel).toBe(
      agentPresentation(facts).activityLabel,
    );
    expect(waitsOnWorker(worker.waitingOn)).toBe(true);
    expect(waitsOnWorker(facts.waitingOn)).toBe(false);
    expect(
      agentPresentation({ ...facts, pendingQuestion: true }).activity,
    ).toBe("waiting");
    expect(agentPresentation({ ...facts, runActive: true }).activity).toBe(
      "working",
    );
    expect(
      agentPresentation({ ...facts, runActive: true, pendingQuestion: true })
        .activity,
    ).toBe("waiting");
    expect(agentPresentation({ ...facts, process: "stale" }).activity).toBe(
      "unknown",
    );
    expect(
      agentPresentation({ ...facts, connectionLost: true }).activity,
    ).not.toBe("waiting_background");
    expect(
      agentPresentation({
        process: "daemon_managed_live",
        command: "accepted",
        runActive: false,
      }).activity,
    ).toBe("waiting");
  });
});
