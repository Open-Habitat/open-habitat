// How the clone page arranges a GitHub catalog: the latest pushes, the
// person's own repositories, each organisation, and search. Pure functions so
// the arrangement is tested without a browser.

export type CatalogRepo = {
  full_name: string;
  private: boolean;
  description: string;
  pushed_at: string | null;
  /** GitHub's estimate of the packed history, in KiB. */
  size_kib: number;
  default_branch: string | null;
  owner_type: "User" | "Organization";
};

/** From this size GitHub's estimate earns a warning and the light clone. */
export const largeKiB = 500 * 1024;
/** Each section shows this many before "Näytä kaikki N". */
export const sectionLimit = 5;
export const sinceChoices = [
  { id: "0", label: "Kaikki" },
  { id: "30", label: "30 pv" },
  { id: "90", label: "3 kk" },
  { id: "365", label: "Vuosi" },
] as const;
export type Since = (typeof sinceChoices)[number]["id"];

const day = 86400000;
const pushed = (r: CatalogRepo) =>
  r.pushed_at ? Date.parse(r.pushed_at) : Number.NEGATIVE_INFINITY;
const newestFirst = (a: CatalogRepo, b: CatalogRepo) => pushed(b) - pushed(a);
const owner = (r: CatalogRepo) => r.full_name.split("/")[0];

export type Section<R extends CatalogRepo> = {
  owner: string;
  kind: "Omat" | "Organisaatio" | "Yhteistyö";
  total: number;
  /** Repositories within the chosen time, newest first. */
  fresh: R[];
  /** Repositories the time filter hides. */
  hidden: number;
};
export type Arrangement<R extends CatalogRepo> =
  | { kind: "browse"; recent: R[]; sections: Section<R>[] }
  | { kind: "search"; hits: R[]; hidden: number };

/**
 * `taken` says which repositories are workspaces already: "Viimeksi
 * päivitetyt" leaves them out (Jari 17.10.2026), the sections keep them.
 */
export function arrange<R extends CatalogRepo>(
  repos: readonly R[],
  {
    login,
    query,
    since,
    now,
    taken,
  }: {
    login?: string;
    query: string;
    since: Since;
    now: number;
    taken: (repo: R) => boolean;
  },
): Arrangement<R> {
  const days = Number(since);
  const fresh = (r: R) => !days || pushed(r) >= now - days * day;
  const sorted = [...repos].sort(newestFirst);
  const q = query.trim().toLocaleLowerCase();
  if (q) {
    const hits = sorted.filter((r) =>
      `${r.full_name} ${r.description}`.toLocaleLowerCase().includes(q),
    );
    const shown = hits.filter(fresh);
    return { kind: "search", hits: shown, hidden: hits.length - shown.length };
  }
  const recent = sorted
    .filter((r) => pushed(r) >= now - 3 * day && !taken(r))
    .slice(0, 4);
  const owners = new Map<string, R[]>();
  for (const r of sorted) {
    const o = owner(r);
    owners.set(o, [...(owners.get(o) ?? []), r]);
  }
  const kindOf = (o: string, rs: R[]): Section<R>["kind"] =>
    login && o.toLocaleLowerCase() === login.toLocaleLowerCase()
      ? "Omat"
      : rs[0].owner_type === "Organization"
        ? "Organisaatio"
        : "Yhteistyö";
  const order = { Omat: 0, Organisaatio: 1, Yhteistyö: 2 };
  const sections = [...owners.entries()]
    .map(([o, rs]) => {
      const visible = rs.filter(fresh);
      return {
        owner: o,
        kind: kindOf(o, rs),
        total: rs.length,
        fresh: visible,
        hidden: rs.length - visible.length,
      };
    })
    .sort(
      (a, b) =>
        order[a.kind] - order[b.kind] ||
        a.owner.localeCompare(b.owner, "fi", { sensitivity: "base" }),
    );
  return { kind: "browse", recent, sections };
}

/** An exact owner/repo as GitHub names them; such a query is looked up. */
export function exactName(query: string): string | undefined {
  const q = query
    .trim()
    .replace(/^https:\/\/github\.com\//, "")
    .replace(/\.git$/, "");
  return /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(q) &&
    !/^[^/]+\/\.\.?$/.test(q)
    ? q
    : undefined;
}

const fi = (n: number, digits: number) =>
  n.toLocaleString("fi-FI", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
/** Bytes as MiB or GiB, the way the clone page and its cards say them. */
export function size(bytes: number): string {
  const mib = bytes / 1048576;
  if (mib >= 1024) return `${fi(mib / 1024, 1)} GiB`;
  if (mib >= 10) return `${fi(Math.round(mib), 0)} MiB`;
  return `${fi(Math.max(mib, 0.1), 1)} MiB`;
}

/** A push time relative to now, in the person's local time. */
export function when(iso: string | null, now: number): string {
  if (!iso) return "ei pushia";
  const t = new Date(iso);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const start = today.getTime();
  if (t.getTime() >= start)
    return `tänään klo ${t.getHours()}.${String(t.getMinutes()).padStart(2, "0")}`;
  if (t.getTime() >= start - day) return "eilen";
  const days = Math.round((start - t.getTime()) / day);
  if (days < 30) return `${days} pv sitten`;
  return `${t.getDate()}.${t.getMonth() + 1}.${t.getFullYear()}`;
}
