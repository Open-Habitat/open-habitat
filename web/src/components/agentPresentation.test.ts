import { describe, expect, it } from "vitest";
import { agentPresentation } from "./agentPresentation";

describe("agent presentation", () => {
  it("does not infer deliberate closure or a wait from process exit or idle", () => {
    expect(
      agentPresentation({ process: "confirmed_exited", command: "idle" })
        .activity,
    ).toBe("unknown");
    expect(
      agentPresentation({ process: "daemon_managed_live", command: "idle" })
        .activity,
    ).toBe("unknown");
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
