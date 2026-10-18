import type {
  DeletionBlocker,
  DeletionGit,
  refusalCodes,
} from "./workspaceTrash";

// Finnish text for workspace deletion and the Trash (ADR 0019). Host values
// (process names, paths, run IDs) are only ever shown as code segments.
export type Segment = string | { code: string };
export type BlockerText = {
  what: Segment[];
  how: string;
  command?: string;
};

const unknownChecks: Record<NonNullable<DeletionBlocker["check"]>, string> = {
  processes: "Prosesseja ei voitu tarkistaa.",
  taskfleet: "Taskfleetin ajoja ei voitu lukea.",
  worktrees: "Gitin worktree-luetteloa ei voitu lukea.",
  mounts: "Liitoksia ei voitu lukea.",
  trash: "Roskakoria ei voitu tarkistaa.",
};
const unknownHow =
  "Tuntematon estää poiston varmuuden vuoksi. Tarkista uudelleen hetken päästä.";

const process = (b: DeletionBlocker): Segment[] =>
  b.comm
    ? [{ code: b.comm }, ` (PID ${b.pid ?? "?"})`]
    : [`PID ${b.pid ?? "?"}`];

export function blockerText(b: DeletionBlocker): BlockerText {
  const path = b.path ?? "";
  switch (b.kind) {
    case "pi_session":
      return {
        what: ["Pi työskentelee tämän työtilan keskustelussa."],
        how: "Odota, että vuoro päättyy, tai pysäytä se keskustelusta.",
      };
    case "process":
      return {
        what: ["Prosessi ", ...process(b), " on työtilan hakemistossa."],
        how: "Sulje se tai siirry siinä pois hakemistosta.",
      };
    case "taskfleet_run":
      return {
        what: ["Taskfleet-ajo ", { code: b.run_id ?? "" }, " käyttää repoa."],
        how: "Odota, että ajo päättyy, tai peru se:",
        command: `taskfleet run cancel ${b.run_id ?? ""}`,
      };
    case "linked_worktree":
      return {
        what: ["Repolla on linkitetty worktree ", { code: path }, "."],
        how: "Poista se ensin työtilan Worktreet-listasta tai komennolla, muuten se jäisi orvoksi:",
        command: `git worktree remove ${shellWord(path)}`,
      };
    case "locked_worktree":
      return {
        what: ["Repolla on lukittu worktree ", { code: path }, "."],
        how: "Avaa lukko ja poista se ensin:",
        command: `git worktree unlock ${shellWord(path)} && git worktree remove ${shellWord(path)}`,
      };
    case "is_linked_worktree":
      return {
        what: ["Tämä työtila on toisen repon linkitetty worktree."],
        how: "Poista se komennolla git worktree remove tai työkalulla, joka sen loi.",
      };
    case "contains_linked_worktree":
      return {
        what: ["Hakemistossa on toisen repon worktree ", { code: path }, "."],
        how: "Poista se ensin pääkloonista komennolla git worktree remove.",
      };
    case "mount":
      return {
        what: ["Hakemiston alla on liitos ", { code: path }, "."],
        how: "Irrota se ensin.",
      };
    case "different_filesystem":
      return {
        what: ["Roskakori on eri levyllä kuin ~/src."],
        how: "Työtilaa ei kopioida levyltä toiselle. Asennus pitää korjata.",
      };
    case "unknown":
      if (b.check === "processes" && b.pid)
        return {
          what: ["Prosessia ", ...process(b), " ei voitu tarkistaa."],
          how: unknownHow,
        };
      return {
        what: [
          b.check ? unknownChecks[b.check] : "Tarkistusta ei voitu tehdä.",
        ],
        how: unknownHow,
      };
  }
}

// Only what a shell would split or expand needs quoting in a copied command.
export function shellWord(s: string): string {
  return /^[\w@%+=:,./~-]+$/.test(s) ? s : `'${s.replaceAll("'", `'\\''`)}'`;
}

type Refusal = (typeof refusalCodes)[number];
const refusals: Record<
  Refusal | "identity_lost" | "invalid_reply" | "unavailable",
  string
> = {
  workspace_busy: "Toinen työtilamuutos on kesken. Yritä hetken päästä.",
  workspace_changed:
    "Työtila muuttui tarkistuksen jälkeen. Tarkista uudelleen.",
  workspace_missing: "Työtilaa ei enää löydy.",
  workspace_uncertain:
    "Työtilan tilaa ei voitu vahvistaa. Mitään ei siirretty.",
  workspace_not_clean:
    "Työtila ei ole enää puhdas, joten sitä ei poistettu. Tarkista uudelleen.",
  workspace_exists:
    "Nimi on jo käytössä ~/src:ssä. Nimeä tai poista se ensin; palautus ei nimeä mitään uudelleen.",
  workspace_partial:
    "Siirto jäi kesken. Työtila on joko paikallaan tai roskakorissa; katso tilanne uudelleen.",
  trash_unavailable: "Roskakoria ei voitu käyttää. Mitään ei siirretty.",
  trash_entry_missing: "Tätä kohdetta ei ole enää roskakorissa.",
  confirmation_mismatch: "Nimi ei täsmää.",
  trash_changed:
    "Roskakori muuttui sillä välin. Mitään ei poistettu; katso lista ja vahvista uudelleen.",
  identity_lost: "Istunto päättyi. Kirjaudu uudelleen.",
  invalid_reply: "Palvelimen vastausta ei voitu vahvistaa.",
  unavailable: "Palvelin ei vastannut. Yritä hetken päästä.",
};
export function refusalText(code: string): string {
  return refusals[code as keyof typeof refusals] ?? refusals.unavailable;
}

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

// What exists only on this server: the facts the confirmation and the Trash
// repeat, because a permanent deletion loses exactly these.
export function onlyHere(git: DeletionGit | undefined): string[] {
  if (!git) return [];
  const out: string[] = [];
  if (git.state !== "observed")
    out.push("Gitin tilaa ei voitu lukea kokonaan.");
  if (!git.remote_refs)
    out.push("Ei haettua etärepoa: koko Git-historia on vain täällä.");
  if (git.changed)
    out.push(
      `${count(git.changed, "muutettu tiedosto", "muutettua tiedostoa")}, ei commitoitu`,
    );
  if (git.untracked)
    out.push(
      `${count(git.untracked, "uusi tiedosto", "uutta tiedostoa")}, ei Gitissä`,
    );
  if (git.remote_refs && git.unpushed)
    out.push(
      `${count(git.unpushed, "commit", "committia")}, joita ei ole etärepossa`,
    );
  if (git.stash)
    out.push(count(git.stash, "stash-merkintä", "stash-merkintää"));
  if (git.nested_repositories)
    out.push(
      `${count(git.nested_repositories, "sisäkkäinen repo", "sisäkkäistä repoa")}, joiden etärepoa ei tarkistettu`,
    );
  return out;
}

// Short labels for a Trash row.
export function gitChips(git: DeletionGit | undefined): {
  text: string;
  tone: "warn" | "ok";
}[] {
  if (!git) return [];
  const chips: { text: string; tone: "warn" | "ok" }[] = [];
  if (!git.remote_refs) chips.push({ text: "ei etärepoa", tone: "warn" });
  if (git.remote_refs && git.unpushed)
    chips.push({
      text: `${count(git.unpushed, "commit", "committia")} vain täällä`,
      tone: "warn",
    });
  if (git.changed + git.untracked)
    chips.push({
      text: count(git.changed + git.untracked, "muutos", "muutosta"),
      tone: "warn",
    });
  if (git.stash) chips.push({ text: "stash", tone: "warn" });
  if (git.state !== "observed")
    chips.push({ text: "Git-tila ei tiedossa", tone: "warn" });
  return chips.length ? chips : [{ text: "kaikki etärepossa", tone: "ok" }];
}

export const conversationsKept = (n: number) =>
  `${count(n, "keskustelu säilyy", "keskustelua säilyy")} Pi:n historiassa.`;

export function bytes(n: number): string {
  if (n < 1024 ** 2)
    return `${Math.max(1, Math.round(n / 1024)).toLocaleString("fi-FI")} KiB`;
  if (n < 1024 ** 3)
    return `${(n / 1024 ** 2).toLocaleString("fi-FI", { maximumFractionDigits: n < 10 * 1024 ** 2 ? 1 : 0 })} MiB`;
  return `${(n / 1024 ** 3).toLocaleString("fi-FI", { maximumFractionDigits: 1 })} GiB`;
}

export function deletedAt(iso: string | undefined, now = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("fi-FI", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (d.toDateString() === now.toDateString()) return `tänään klo ${time}`;
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear() === now.getFullYear() ? "" : d.getFullYear()} klo ${time}`;
}
