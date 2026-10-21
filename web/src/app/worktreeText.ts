import {
  type BlockerText,
  blockerText,
  piSessionText,
  refusalText,
} from "./trashText";
import type {
  Worktree,
  WorktreeBlocker,
  WorktreeRemoveResult,
} from "./workspaceWorktrees";

// Finnish text for worktree cleanup (ADR 0025). Host values (branch names,
// paths, process names) are only ever shown as code segments.

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export const stateLabel: Record<
  Worktree["state"],
  { text: string; tone: "ok" | "warn" | "plain" }
> = {
  merged: { text: "yhdistetty", tone: "ok" },
  unmerged: { text: "ei yhdistetty", tone: "plain" },
  dirty: { text: "muutoksia", tone: "warn" },
  missing: { text: "hakemisto puuttuu", tone: "plain" },
  locked: { text: "lukittu", tone: "plain" },
  unknown: { text: "tila ei tiedossa", tone: "warn" },
};

export function worktreeBlockerText(b: WorktreeBlocker): BlockerText {
  switch (b.kind) {
    case "file_operation":
      return {
        what: ["Tiedoston käsittely on kesken."],
        how: "Odota käsittelyn päättymistä.",
      };
    case "pi_session":
      return piSessionText(b.activity, "tämän worktreen");
    case "process":
      return {
        what: [
          "Prosessi ",
          ...(b.comm
            ? [{ code: b.comm }, ` (PID ${b.pid ?? "?"})`]
            : [`PID ${b.pid ?? "?"}`]),
          " on worktreen hakemistossa.",
        ],
        how: "Sulje se tai siirry siinä pois hakemistosta.",
      };
    case "taskfleet_run":
      return {
        what: [
          "Taskfleet-ajo ",
          { code: b.run_id ?? "" },
          " omistaa tämän worktreen.",
        ],
        how: "Ajo päättää itse, mitä worktreelle tapahtuu. Odota, että se päättyy, tai peru se:",
        command: `taskfleet run cancel ${b.run_id ?? ""}`,
      };
    case "contains_linked_worktree":
      return {
        what: [
          "Worktreen sisällä on toinen worktree ",
          { code: b.path ?? "" },
          ".",
        ],
        how: "Poista sisempi ensin.",
      };
    case "nested_repository":
      return {
        what: [
          "Worktreen sisällä on toinen Git-repo ",
          { code: b.path ?? "" },
          ".",
        ],
        how: "Sen historiaa tai muutoksia ei tallenneta haaraan. Siirrä tai poista se ensin.",
      };
    case "outside_home":
      return {
        what: [
          "Worktree on kotihakemiston ulkopuolella: ",
          { code: b.path ?? "" },
          ".",
        ],
        how: "Selain poistaa vain kotihakemistossa olevia worktreitä. Poista tämä komennolla git worktree remove.",
      };
    case "last_workspace":
      return blockerText({ kind: "last_workspace" });
    case "mount":
      return {
        what: ["Worktreen alla on liitos ", { code: b.path ?? "" }, "."],
        how: "Irrota se ensin.",
      };
    case "unknown":
      if (b.check === "worktrees")
        return {
          what: [
            "Worktreetä ei voitu lukea, tai hakemisto ei ole enää tämän worktreen.",
          ],
          how: "Tarkista tilanne komennolla git worktree list.",
        };
      return blockerText({ ...b, kind: "unknown" });
  }
}

export const plainBlocker = (b: WorktreeBlocker) =>
  worktreeBlockerText(b)
    .what.map((p) => (typeof p === "string" ? p : p.code))
    .join("");

export function worktreeFacts(w: Worktree): string[] {
  const out: string[] = [];
  if (w.changed)
    out.push(count(w.changed, "muutettu tiedosto", "muutettua tiedostoa"));
  if (w.untracked)
    out.push(count(w.untracked, "uusi tiedosto", "uutta tiedostoa"));
  if (w.state !== "dirty" && w.ahead)
    out.push(
      `${count(w.ahead, "commit", "committia")}, joita ei ole haarassa ${w.base ?? "?"}`,
    );
  if (w.unreachable_head)
    out.push("Irrallinen HEAD, jonka committeja mikään haara ei sisällä");
  return out;
}

const worktreeRefusals: Record<string, string> = {
  worktree_missing: "Tätä worktreetä ei enää löydy. Lista päivitettiin.",
  worktree_changed:
    "Worktree muuttui sen jälkeen, kun lista luettiin. Mitään ei poistettu; katso lista ja yritä uudelleen.",
  worktrees_changed:
    "Yhdistettyjen worktreiden joukko muuttui. Mitään ei poistettu; katso lista ja vahvista uudelleen.",
  commit_failed:
    "Muutoksia ei voitu tallentaa haaraan, joten mitään ei poistettu. Tarkista Gitin nimi ja sähköposti tai commitoi itse.",
};
export function worktreeRefusalText(code: string): string {
  return worktreeRefusals[code] ?? refusalText(code);
}

/** What happened, for the status line after a removal. */
export function removedText(w: Worktree, r: WorktreeRemoveResult): string {
  if (r.state === "pruned")
    return `${w.name}: vanhentunut merkintä poistettu Gitin luettelosta.`;
  if (r.state === "blocked")
    return `${w.name} ei poistettu: ${(r.blockers ?? []).map(plainBlocker).join(" ")}`;
  if (r.state === "partial")
    return `${w.name}: osa jäi poistamatta (${r.remaining ?? 1}). Se näkyy listassa, ja sen voi poistaa uudelleen.`;
  const saved = r.committed
    ? ` Muutokset tallennettiin haaraan commitiksi ${r.committed.slice(0, 7)}.`
    : "";
  const branch = !r.branch
    ? ""
    : r.branch_deleted
      ? ` Haara ${r.branch} poistettiin.`
      : r.branch_kept === "not_merged"
        ? ` Haara ${r.branch} säilyy.`
        : ` Haara ${r.branch} säilyi, koska ${r.branch_kept === "moved" ? "se oli muuttunut" : "se on käytössä toisessa checkoutissa"}.`;
  return `${w.name} poistettu.${saved}${branch}`;
}
