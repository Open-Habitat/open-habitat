import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Entry } from "../app/HistoryView";
import { type RestReport, restHasNews } from "../app/rest";
import { type RestartNotice, RestCard } from "./RestartNotice";

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
  it("becomes the rest's marker when Habitat named the stop, with Taskfleet's own words", () => {
    const summary = "Vienti valmis.\n\n<b>yhdistäminen</b> törmäsi";
    const view = render(
      <Entry
        entry={{
          entry_key: "r",
          kind: "unknown",
          timestamp: "2026-10-27T05:21:00Z",
          content: { media_type: "text/plain", text: "", complete: true },
          restart: {
            stopped: { cause: "idle", at: "2026-10-26T18:20:00Z" },
            processes: [],
            runs: [
              {
                run_id: "01m531x6y92ggdqcmb1exzmn00",
                title: "CSV-vienti",
                state: "not_merged",
                summary,
                branch: "wt/csv",
              },
            ],
            still_running: [],
          },
        }}
      />,
    );
    const marker = view.getByTestId("rest-marker");
    expect(view.queryByTestId("restart-notice")).toBeNull();
    // Native content is shown unchanged and never as markup.
    expect(marker.querySelector(".ah-rest-summary")?.textContent).toBe(summary);
    expect(marker.querySelector("b")).toBeNull();
    expect(marker.querySelector(".ah-rest-branch")?.textContent).toBe("wt/csv");
  });
});

describe("rest marker after Habitat's own wake", () => {
  it("says Habitat woke the agent and why", () => {
    const marker = (woke: RestartNotice["woke"]) => {
      const view = render(
        <RestCard
          stop={{ cause: "crash", at: "2026-10-28T19:26:55Z" }}
          wokeAt="2026-10-28T19:55:00Z"
          notice={{ woke, processes: [], runs: [], still_running: [] }}
        />,
      );
      const text = view.getByTestId("rest-marker").textContent ?? "";
      view.unmount();
      return text;
    };
    expect(marker("settled")).toContain("Habitat herätti agentin");
    expect(marker("settled")).toContain("ajot, joita se odotti, päättyivät");
    expect(marker("cut_off")).toContain("taustatyö, jota se odotti, katkesi");
    expect(marker(undefined)).toContain("Viestisi herätti agentin");
  });
});

describe("rest card", () => {
  it("says Habitat wrote it and where the wake stands", () => {
    const view = render(
      <RestCard
        stop={{ cause: "restart", at: "2026-10-26T18:20:00Z" }}
        wake="waking"
        unavailable
      />,
    );
    const card = view.getByTestId("rest-card");
    expect(card.getAttribute("data-wake")).toBe("waking");
    // An unread inventory is said, never shown as an empty one.
    expect(view.getByTestId("rest-unavailable")).toBeTruthy();
  });
  it("says why a refused wake would be refused on send too", () => {
    const view = render(
      <RestCard
        stop={{ cause: "idle", at: "2026-10-29T21:29:00Z" }}
        wake="refused"
        refusal="Tallennustilasi on täynnä."
      />,
    );
    const text = view.getByTestId("rest-card").textContent ?? "";
    expect(text).toContain("Agenttia ei voitu käynnistää. Tallennustilasi");
    expect(text).not.toContain("kun lähetät viestin");
  });
});

describe("a rest with nothing to tell", () => {
  const report = (
    over: Partial<RestReport["report"]> = {},
    availability: RestReport["availability"] = "available",
  ): RestReport => ({
    schema_version: 1,
    agent_id: "pi:11111111-1111-4111-8111-111111111111",
    availability,
    report: {
      stopped: { cause: "restart", at: "2026-10-28T06:10:00Z" },
      processes: [],
      runs: [],
      still_running: [],
      ...over,
    },
  });
  it("shows no card when nothing was cut off or settled (Jari 28.10.2026)", () => {
    expect(restHasNews(report())).toBe(false);
    // A run still working on its own was neither cut off nor finished.
    expect(
      restHasNews(
        report({
          still_running: [{ run_id: "01m531x6y92ggdqcmb1exzmn00", title: "t" }],
        }),
      ),
    ).toBe(false);
  });
  it("keeps the card when work was cut off, settled, or could not be read", () => {
    expect(restHasNews(report({ interrupted_turn: true }))).toBe(true);
    expect(
      restHasNews(
        report({ processes: [{ process_id: "proc_aaaa", name: "dev" }] }),
      ),
    ).toBe(true);
    expect(
      restHasNews(
        report({
          runs: [
            {
              run_id: "01m531x6y92ggdqcmb1exzmn00",
              title: "t",
              state: "merged",
            },
          ],
        }),
      ),
    ).toBe(true);
    expect(restHasNews(report({}, "partial"))).toBe(true);
  });
  it("names a cut turn instead of saying nothing was cut off", () => {
    const view = render(
      <RestCard
        stop={{ cause: "restart", at: "2026-10-28T06:10:00Z" }}
        notice={report({ interrupted_turn: true }).report}
        wake="asleep"
      />,
    );
    const text = view.getByTestId("rest-card").textContent ?? "";
    expect(text).toContain("Agentin kesken ollut työ katkesi.");
    expect(text).not.toContain("Mikään työ ei katkennut");
  });
});
