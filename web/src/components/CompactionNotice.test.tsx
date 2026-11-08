import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompactionNotice } from "./CompactionNotice";
import { SessionSettingsRow } from "./SessionSettingsRow";

describe("compaction in the conversation", () => {
  it("says the agent compacts, and why it did not", () => {
    const { rerender } = render(
      <CompactionNotice notice={{ kind: "running" }} />,
    );
    expect(screen.getByRole("status").textContent).toBe(
      "Agentti tiivistää keskustelua…",
    );
    rerender(
      <CompactionNotice
        notice={{ kind: "failed", reason: "compaction_failed" }}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe(
      "Tiivistys ei onnistunut. Keskustelu on ennallaan; voit yrittää uudelleen.",
    );
  });
  it("marks a compaction by its time and folds the summary away", () => {
    const at = new Date();
    at.setHours(9, 5);
    render(
      <SessionSettingsRow
        marker={{
          key: "c",
          compact: "## Tavoite\nKorjaa",
          at: at.toISOString(),
        }}
      />,
    );
    const mark = screen.getByTestId("compaction-marker");
    expect(mark.textContent).toContain("Keskustelu tiivistettiin klo 9.05");
    const details = mark.querySelector("details");
    expect(details?.open).toBe(false);
    expect(details?.textContent).toContain("Korjaa");
    fireEvent.click(screen.getByText("Yhteenveto"));
    expect(details?.open).toBe(true);
  });
});
