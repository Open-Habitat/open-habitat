import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Entry } from "../app/HistoryView";
import type { RestartNotice } from "./RestartNotice";

const restart: RestartNotice = {
  processes: [{ process_id: "proc_8ffc", name: "wait-gate-evidence" }],
  runs: [
    {
      run_id: "01m531x6y92ggdqcmb1exzmn00",
      title: "gate-lab-evidence-rewrite",
      state: "merged",
    },
    { run_id: "01m531x6y92ggdqcmb1exzmn01", title: "", state: "stalled" },
  ],
  still_running: [{ run_id: "01m531x6y92ggdqcmb1exzmn02", title: "release" }],
};

describe("restart catch-up", () => {
  it("is a quiet Finnish marker, not an extension message card", () => {
    const view = render(
      <Entry
        entry={{
          entry_key: "r",
          kind: "unknown",
          content: { media_type: "text/plain", text: "", complete: true },
          restart,
        }}
      />,
    );
    const note = view.getByTestId("restart-notice");
    expect(note.textContent).toContain("Agentti käynnistettiin uudelleen");
    expect(note.textContent).toContain(
      "Katkenneet taustatyöt: wait-gate-evidence",
    );
    expect(note.textContent).toContain(
      "gate-lab-evidence-rewrite: valmis ja yhdistetty",
    );
    // A stall is Taskfleet's verdict; an untitled run shows its id.
    expect(note.textContent).toContain(
      "01m531x6y92ggdqcmb1exzmn01: Taskfleetin mukaan pysähtynyt",
    );
    expect(note.textContent).toContain(
      "Yhä käynnissä, odotus katkesi: release",
    );
    expect(view.queryByText("Laajennuksen viesti")).toBeNull();
  });
  it("is only the marker when nothing is listed", () => {
    const view = render(
      <Entry
        entry={{
          entry_key: "r",
          kind: "unknown",
          content: { media_type: "text/plain", text: "", complete: true },
          restart: { processes: [], runs: [], still_running: [] },
        }}
      />,
    );
    expect(view.getByTestId("restart-notice").querySelector("ul")).toBeNull();
  });
});
