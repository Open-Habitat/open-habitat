import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Entry } from "../app/HistoryView";

const content = {
  media_type: "text/plain" as const,
  text: "",
  complete: true,
};

describe("unwaited-worker reminder", () => {
  it("is a quiet Finnish marker, not an extension message card", () => {
    const view = render(
      <Entry
        entry={{
          entry_key: "w",
          kind: "unknown",
          content,
          wait_reminder: {
            runs: [
              { run_id: "01m531x6y92ggdqcmb1exzmn00", title: "CSV-vienti" },
              { run_id: "01m531x6y92ggdqcmb1exzmn01", title: "" },
            ],
            more: 1,
          },
        }}
      />,
    );
    const note = view.getByTestId("wait-reminder");
    expect(note.textContent).toContain(
      "Habitat muistutti agenttia: kukaan ei odota 3 workeria",
    );
    expect(note.textContent).toContain("CSV-vienti");
    expect(note.textContent).toContain("01m531x6y92ggdqcmb1exzmn01");
    expect(note.textContent).toContain("ja 1 muuta");
    expect(view.queryByText("Laajennuksen viesti")).toBeNull();
  });
  it("names one worker in the singular", () => {
    const view = render(
      <Entry
        entry={{
          entry_key: "w",
          kind: "unknown",
          content,
          wait_reminder: {
            runs: [{ run_id: "01m531x6y92ggdqcmb1exzmn00", title: "x" }],
          },
        }}
      />,
    );
    expect(view.getByTestId("wait-reminder").textContent).toContain(
      "kukaan ei odota workeria",
    );
  });
});
