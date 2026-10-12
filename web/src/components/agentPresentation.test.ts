import { describe, expect, it } from "vitest";
import { agentPresentation } from "./agentPresentation";

describe("agent presentation", () => {
  it("distinguishes an open idle controller from an unexplained exit", () => {
    expect(
      agentPresentation({ process: "confirmed_exited", command: "idle" })
        .activity,
    ).toBe("unknown");
    expect(
      agentPresentation({ process: "daemon_managed_live", command: "idle" })
        .activity,
    ).toBe("waiting");
    expect(agentPresentation({ process: "daemon_managed_live" }).activity).toBe(
      "unknown",
    );
    expect(
      agentPresentation({ process: "stale", command: "accepted" }).activity,
    ).toBe("unknown");
  });
  it("keeps operation, attention, capability and activity separate", () => {
    const view = agentPresentation({
      process: "daemon_managed_live",
      command: "rejected",
      control: "read_only",
      attention: "new",
    });
    expect(view.activity).toBe("unknown");
    expect(view.controlLabel).toBe("Vain luku");
    expect(view.operationLabel).toBe("Viesti hylättiin");
    expect(view.attentionLabel).toBe("Uusi");
    expect(
      agentPresentation({
        process: "daemon_managed_live",
        command: "idle",
        attention: "seen",
      }).activity,
    ).toBe("waiting");
    expect(
      agentPresentation({
        process: "terminal_observed_live",
        command: "accepted",
      }).activity,
    ).toBe("working");
  });
});

describe("question and closure distinctions", () => {
  it("treats a live pending question as a wait without turning a seen question into work", () => {
    const view = agentPresentation({
      process: "daemon_managed_live",
      command: "accepted",
      pendingQuestion: true,
      attention: "seen",
    });
    expect(view.activity).toBe("waiting");
    expect(view.attentionLabel).toBeUndefined();
  });
  it("never calls an unexplained exit deliberate closure", () => {
    expect(
      agentPresentation({ process: "confirmed_exited" }).activityLabel,
    ).not.toBe("Valmis");
    expect(
      agentPresentation({
        process: "confirmed_exited",
        intentionallyClosed: true,
      }).activityLabel,
    ).toBe("Valmis");
  });
});
