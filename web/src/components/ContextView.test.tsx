import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContextPage } from "./ContextPage";
import { claudeAfterCompaction, piReading } from "./ContextPage.fixtures";
import type { ContextUsage } from "./ContextRing";
import { type CompactionControl, ContextView } from "./ContextView";
import { FileLinkContext } from "./fileRefs";

// Numbers come with the language's no-break spaces.
const text = (el: Element) => (el.textContent ?? "").replace(/\s/g, " ");

const usage: ContextUsage = {
  phase: "known",
  tokens: 204220,
  window: 272000,
  autoCompaction: true,
  reserve: 16384,
};
const ready = (over: Partial<CompactionControl> = {}): CompactionControl => ({
  offer: "ready",
  running: false,
  onCompact: vi.fn(),
  ...over,
});

describe("ContextView", () => {
  it("lists what the agent sees by size and what is only in the summary", () => {
    render(
      <ContextView detail={piReading} usage={usage} compaction={ready()} />,
    );
    expect(screen.getByTestId("context-view-total").textContent).toContain(
      "75 %",
    );
    const seen = within(screen.getByTestId("context-seen"))
      .getAllByTestId("context-item")
      .map((row) => row.textContent ?? "");
    // Largest first: the two test runs, then the conversation itself.
    const seen0 = () =>
      within(screen.getByTestId("context-seen")).getAllByTestId(
        "context-item",
      )[0];
    expect(seen[0]).toContain("npm test");
    expect(text(seen0())).toMatch(/ajoi 27\.10\. klo \d\d\.\d\d ja \d\d\.\d\d/);
    expect(seen[1]).toContain("Viestit ja agentin ajattelu");
    expect(seen.some((r) => r.includes("+12 −3 riviä"))).toBe(true);
    const gone = within(screen.getByTestId("context-summary-only"))
      .getAllByTestId("context-item")
      .map((row) => row.textContent ?? "");
    expect(gone).toHaveLength(3);
    expect(gone[0]).toContain("format.ts");
  });

  it("filters to files and opens a workspace file the way a conversation link does", () => {
    const open = vi.fn();
    render(
      <FileLinkContext.Provider value={{ open }}>
        <ContextView detail={piReading} usage={usage} compaction={ready()} />
      </FileLinkContext.Provider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Vain tiedostot 5/ }));
    expect(screen.getByTestId("context-files-note")).toBeTruthy();
    const seen = within(screen.getByTestId("context-seen")).getAllByTestId(
      "context-item",
    );
    expect(seen.map((r) => r.textContent).join()).not.toContain("npm test");
    fireEvent.click(screen.getAllByRole("link", { name: "status.ts" })[0]);
    expect(open).toHaveBeenCalledWith(
      { path: "src/status.ts" },
      "src/status.ts",
    );
  });

  it("names files as text where no editor is offered", () => {
    render(<ContextView detail={piReading} usage={usage} />);
    expect(screen.queryAllByTestId("context-item-open")).toHaveLength(0);
    // Without a way to compact, no button.
    expect(screen.queryByTestId("compact-open")).toBeNull();
  });

  it("confirms by clock time what Pi summarizes and keeps, then compacts with the instruction", () => {
    const onCompact = vi.fn();
    render(
      <ContextView
        detail={piReading}
        usage={usage}
        compaction={ready({ onCompact })}
      />,
    );
    fireEvent.click(screen.getByTestId("compact-open"));
    const dialog = screen.getByTestId("compact-dialog");
    expect(text(dialog)).toContain("noin 20 000 tokenia");
    expect(text(dialog)).toContain("61 800");
    expect(text(dialog)).toMatch(
      /viesteistä 27\.10\. klo \d\d\.\d\d–\d\d\.\d\d yhteenvedon/,
    );
    // Pi keeps the newest test run and the latest edits.
    expect(within(dialog).getByTestId("compact-kept").textContent).toContain(
      "npm test",
    );
    fireEvent.change(within(dialog).getByRole("textbox"), {
      target: { value: "Testien luvut tarkkoina" },
    });
    fireEvent.click(within(dialog).getByTestId("compact-confirm"));
    expect(onCompact).toHaveBeenCalledWith("Testien luvut tarkkoina");
  });

  it("waits for the agent, says what it is doing and shows Pi's refusals", () => {
    const { rerender } = render(
      <ContextView
        detail={piReading}
        usage={usage}
        compaction={ready({ offer: "busy" })}
      />,
    );
    expect(
      (screen.getByTestId("compact-open") as HTMLButtonElement).disabled,
    ).toBe(true);
    rerender(
      <ContextView
        detail={piReading}
        usage={usage}
        compaction={ready({ running: true })}
      />,
    );
    expect(screen.getByTestId("compacting").textContent).toContain("tiivistää");
    rerender(
      <ContextView
        detail={piReading}
        usage={usage}
        compaction={ready({ outcome: { kind: "already_compacted" } })}
      />,
    );
    expect(screen.getByTestId("compact-outcome").textContent).toContain(
      "juuri tiivistetty",
    );
    // Right after a compaction Pi refuses another: a status, not a button.
    rerender(
      <ContextView
        detail={claudeAfterCompaction}
        usage={{ ...usage, phase: "after" }}
        compaction={ready({ outcome: { kind: "done", after: 50000 } })}
      />,
    );
    expect(screen.queryByTestId("compact-open")).toBeNull();
    expect(screen.getByTestId("compacted").textContent).toContain(
      "Tiivistetty 27.10. klo",
    );
    expect(screen.queryByTestId("compact-outcome")).toBeNull();
    expect(text(screen.getByTestId("context-view-total"))).toContain(
      "noin 56 240",
    );
  });

  it("says when there is nothing to compact yet", () => {
    render(
      <ContextView
        detail={{ ...piReading, next_compaction: null }}
        usage={usage}
        compaction={ready()}
      />,
    );
    expect(
      (screen.getByTestId("compact-open") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByTestId("compact-row").textContent).toContain(
      "ei ole vielä tiivistettävää",
    );
  });

  it("replaces Pi's technical figures on the context page", () => {
    render(
      <ContextPage
        detail={{ state: "ready", detail: piReading }}
        usage={usage}
        title="Status"
        onClose={() => {}}
        view={(d) => <ContextView detail={d} usage={usage} />}
      />,
    );
    expect(screen.getByTestId("context-view")).toBeTruthy();
    expect(screen.queryByTestId("context-parts")).toBeNull();
    expect(screen.queryByTestId("context-turns")).toBeNull();
  });
});
