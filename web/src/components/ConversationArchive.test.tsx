import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { Spinoff } from "../app/spinoffs";
import { conversationArchiveText } from "../text/conversationArchive";
import {
  type ArchiveRow,
  archiveGroup,
  archiveTraces,
  archiveWhen,
  ConversationArchiveList,
} from "./ConversationArchive";

// Jari's archive on su 8.11.2026 at 19.30 (proto-conversation-archive):
// a few of the thirteen, one per group, and one archived before the
// daemon recorded when.
const now = new Date(2026, 10, 8, 19, 30).getTime();
const at = (month: number, day: number, h: number, m: number) =>
  new Date(2026, month, day, h, m).toISOString();
const row = (id: string, title: string, archivedAt?: string): ArchiveRow => ({
  id,
  title,
  href: `/agents/${id}`,
  archivedAt,
  traces: [],
});
const rows = [
  row("salutation", "Salutation en français", at(9, 28, 21, 15)),
  row("pieni", "Pieni testiagentin testi", at(10, 8, 18, 40)),
  row("undated", "Ilman päivää"),
  row("pullongelma", "Git pull ongelmien selvitys", at(10, 6, 11, 52)),
  row("lapikaynti", "Testikoneen muutosten läpikäynti", at(10, 7, 21, 40)),
];
const fi = conversationArchiveText.fi;

const run = (over: Partial<Spinoff>): Spinoff => ({
  run_id: "01m6xq1testaaja00000000000",
  title: "Testaaja",
  created_at: at(10, 8, 12, 0),
  state: "merged",
  preserved: false,
  branch: "wt/x",
  worktree: "/w",
  source_branch: "main",
  summary: "",
  ...over,
});

describe("ConversationArchiveList", () => {
  it("groups newest archived first and dates each row", () => {
    render(
      <MemoryRouter>
        <ConversationArchiveList
          rows={rows}
          count={5}
          now={now}
          onRestore={() => {}}
        />
      </MemoryRouter>,
    );
    const groups = screen.getAllByTestId("archive-group");
    expect(
      groups.map((g) => within(g).getByRole("heading").textContent),
    ).toEqual(["Tänään", "Eilen", "Aiemmin tällä viikolla", "Vanhemmat"]);
    expect(
      screen.getAllByTestId("archive-row-open").map((a) => a.textContent),
    ).toEqual([
      "Pieni testiagentin testi",
      "Testikoneen muutosten läpikäynti",
      "Git pull ongelmien selvitys",
      "Salutation en français",
      "Ilman päivää",
    ]);
    expect(screen.getAllByTestId("archive-row")[0].textContent).toContain(
      "klo 18.40",
    );
  });

  it("filters by title and says when nothing matches", () => {
    render(
      <MemoryRouter>
        <ConversationArchiveList
          rows={rows}
          count={5}
          now={now}
          onRestore={() => {}}
        />
      </MemoryRouter>,
    );
    const filter = screen.getByTestId("archive-filter");
    fireEvent.change(filter, { target: { value: "GIT" } });
    expect(screen.getAllByTestId("archive-row")).toHaveLength(1);
    fireEvent.change(filter, { target: { value: "kissa" } });
    expect(screen.queryAllByTestId("archive-row")).toHaveLength(0);
    expect(screen.getByTestId("archive-no-match").textContent).toContain(
      "kissa",
    );
  });

  it("restores quietly from the row, unless a reason holds it", () => {
    const restore = vi.fn();
    render(
      <MemoryRouter>
        <ConversationArchiveList
          rows={[
            row("a", "Avattava", at(10, 8, 10, 0)),
            { ...row("b", "Lukukelvoton"), restoreReason: "Ei voi" },
          ]}
          count={2}
          now={now}
          onRestore={restore}
        />
      </MemoryRouter>,
    );
    const [enabled, held] = screen.getAllByTestId("restore-conversation");
    expect(enabled.getAttribute("aria-label")).toBe("Palauta Avattava");
    fireEvent.click(enabled);
    expect(restore).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
    expect((held as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("archive dates", () => {
  it("names today, yesterday, this week and older", () => {
    expect(archiveGroup(at(10, 8, 0, 5), now)).toBe("today");
    expect(archiveGroup(at(10, 7, 23, 59), now)).toBe("yesterday");
    expect(archiveGroup(at(10, 2, 9, 0), now)).toBe("week");
    expect(archiveGroup(at(10, 1, 9, 0), now)).toBe("older");
    expect(archiveGroup(undefined, now)).toBe("older");
    expect(archiveWhen(at(10, 7, 21, 40), now, fi)).toBe("eilen 21.40");
    expect(archiveWhen(at(10, 6, 11, 52), now, fi)).toBe("pe 6.11.");
    expect(archiveWhen(at(9, 28, 21, 15), now, fi)).toBe("28.10.");
    expect(archiveWhen("2025-10-28T10:00:00Z", now, fi)).toBe("28.10.2025");
  });
});

describe("archiveTraces", () => {
  it("marks helpers by name and counts workers by how they ended", () => {
    const helper = run({
      state: "waiting_parent",
      resident: {
        name: "testaaja",
        round_state: "waiting",
        rounds: 2,
        landed_round: 1,
      },
    });
    const runs = [
      helper,
      run({ run_id: "m1", state: "merged" }),
      run({ run_id: "m2", state: "merged" }),
      run({ run_id: "u1", state: "unmerged", title: "Päivitä lista" }),
    ];
    const traces = archiveTraces(runs, true, fi);
    expect(traces.map((x) => [x.short, x.attention])).toEqual([
      ["avustaja testaaja", true],
      ["työ haarassa", true],
      ["2 työtä yhdistetty", false],
    ]);
    expect(traces[1].detail).toBe("Päivitä lista");
    // A helper on its next round is working, not "all merged"; an ended
    // helper's run counts with the workers.
    const later = archiveTraces(
      [
        run({
          run_id: "w1",
          state: "working",
          resident: {
            name: "testaaja",
            round_state: "working",
            rounds: 1,
            landed_round: 1,
          },
        }),
        run({
          run_id: "f1",
          state: "failed",
          resident: {
            name: "vanha",
            round_state: "waiting",
            rounds: 1,
            landed_round: 1,
          },
        }),
      ],
      true,
      fi,
    );
    expect(later.map((x) => [x.mark, x.short, x.detail])).toEqual([
      ["working", "avustaja testaaja", "Avustaja testaaja tekee kierrosta"],
      ["failed", "työ epäonnistui", "Testaaja"],
    ]);
    // Without named helpers only the workers show.
    expect(archiveTraces(runs, false, fi).map((x) => x.short)).toEqual([
      "työ haarassa",
      "2 työtä yhdistetty",
    ]);
  });
});
