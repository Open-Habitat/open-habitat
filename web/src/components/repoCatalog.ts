// How the clone page arranges the repository catalog: the latest pushes, the
// person's own repositories, each organisation, and search, over GitHub and
// each connected Gitea and GitLab in one list (workspace-import round 3,
// "Yhteinen lista"). A GitLab project's section is its whole namespace,
// group/subgroup/... (proto-gitlab-connect, Koko polku). Pure functions so
// the arrangement is tested without a browser.

import { formatDate, formatNumber, liveText } from "../i18n";
import { repoCatalogText } from "../text/repoCatalog";

const txt = liveText(repoCatalogText);

/** A Gitea or GitLab connection a repository comes from; absent for GitHub.
 * Two accounts on one server are two sources, and the same path on two
 * servers are two repositories. */
export type RepoSource = {
  provider: "gitea" | "gitlab";
  /** The daemon's connection id. */
  id: string;
  /** What the row says: the server as the person typed it. */
  label: string;
  /** The connection's own login on that server. */
  login: string;
};

export type CatalogRepo = {
  full_name: string;
  private: boolean;
  description: string;
  pushed_at: string | null;
  /** GitHub's estimate of the packed history, in KiB; null when the source
   * does not tell (GitLab, below Reporter access). */
  size_kib: number | null;
  default_branch: string | null;
  owner_type: "User" | "Organization";
  source?: RepoSource;
  /** The source says the repository has no commits yet. */
  empty?: boolean;
  /** Gitea: the connected account owns it ("Omat"). Gitea does not say
   * whether another owner is an organisation, so the rest are "Yhteistyö".
   * GitLab: the namespace is the connected user's own. */
  owned?: boolean;
  archived?: boolean;
  /** GitLab: the namespace is a group (shown as Ryhmä or Aliryhmä). */
  group?: boolean;
  /** GitLab's visibility; internal is every signed-in user of that server. */
  visibility?: "private" | "internal" | "public";
};

/** One repository's identity across sources. */
export const repoKey = (r: Pick<CatalogRepo, "full_name" | "source">) =>
  r.source ? `${r.source.id}/${r.full_name}` : r.full_name;

/** From this size GitHub's estimate earns a warning and the light clone. */
export const largeKiB = 500 * 1024;
/** Each section shows this many before "Näytä kaikki N". */
export const sectionLimit = 5;
const sinceIds = ["0", "30", "90", "365"] as const;
export type Since = (typeof sinceIds)[number];
export const sinceChoices = sinceIds.map((id) => ({
  id,
  get label() {
    return txt.since[id];
  },
}));

const day = 86400000;
const pushed = (r: CatalogRepo) =>
  r.pushed_at ? Date.parse(r.pushed_at) : Number.NEGATIVE_INFINITY;
const newestFirst = (a: CatalogRepo, b: CatalogRepo) => pushed(b) - pushed(a);
/** The section a repository is listed under: its owner, or a GitLab
 * project's whole namespace. */
const owner = (r: CatalogRepo) =>
  r.full_name.slice(0, r.full_name.lastIndexOf("/"));
/** The directory a clone makes in ~/src: the last path segment. */
export const repoName = (fullName: string) =>
  fullName.slice(fullName.lastIndexOf("/") + 1);

export type Section<R extends CatalogRepo> = {
  /** Unique across sources. */
  key: string;
  owner: string;
  /** The Gitea or GitLab the section's repositories come from; absent for
   * GitHub. */
  source?: RepoSource;
  kind: "Omat" | "Organisaatio" | "Ryhmä" | "Aliryhmä" | "Yhteistyö";
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
      `${r.full_name} ${r.description} ${r.source?.label ?? ""}`
        .toLocaleLowerCase()
        .includes(q),
    );
    const shown = hits.filter(fresh);
    return { kind: "search", hits: shown, hidden: hits.length - shown.length };
  }
  const recent = sorted
    .filter((r) => pushed(r) >= now - 3 * day && !taken(r))
    .slice(0, 4);
  // An owner is a section per source: the same name on GitHub and on a
  // Gitea, or on two Gitea accounts, is not the same owner. A GitLab
  // namespace is one section however deep it is.
  const owners = new Map<string, R[]>();
  for (const r of sorted) {
    const k = `${r.source?.id ?? ""}\u0000${owner(r)}`;
    owners.set(k, [...(owners.get(k) ?? []), r]);
  }
  const kindOf = (o: string, rs: R[]): Section<R>["kind"] => {
    if (rs[0].source?.provider === "gitlab")
      return rs[0].owned
        ? "Omat"
        : rs[0].group
          ? o.includes("/")
            ? "Aliryhmä"
            : "Ryhmä"
          : "Yhteistyö";
    if (rs[0].source) return rs[0].owned ? "Omat" : "Yhteistyö";
    return login && o.toLocaleLowerCase() === login.toLocaleLowerCase()
      ? "Omat"
      : rs[0].owner_type === "Organization"
        ? "Organisaatio"
        : "Yhteistyö";
  };
  const order = {
    Omat: 0,
    Organisaatio: 1,
    Ryhmä: 1,
    Aliryhmä: 1,
    Yhteistyö: 2,
  };
  const sections = [...owners.entries()]
    .map(([k, rs]) => {
      const visible = rs.filter(fresh);
      const o = owner(rs[0]);
      return {
        key: k,
        owner: o,
        source: rs[0].source,
        kind: kindOf(o, rs),
        total: rs.length,
        fresh: visible,
        hidden: rs.length - visible.length,
      };
    })
    .sort(
      (a, b) =>
        order[a.kind] - order[b.kind] ||
        a.owner.localeCompare(b.owner, "fi", { sensitivity: "base" }) ||
        (a.source?.label ?? "").localeCompare(b.source?.label ?? "", "fi"),
    );
  return { kind: "browse", recent, sections };
}

/** An exact owner/repo as GitHub names them; such a query is looked up. */
export function exactName(query: string): string | undefined {
  const input = query.trim();
  // Match the literal GitHub authority, not a lookalike host or a URL with
  // credentials. A copied file/branch/issue URL still names its repository.
  const address =
    /^(?:https:\/\/github\.com\/|git@github\.com:)([^/?#]+\/[^/?#]+)(?:[/?#].*)?$/i.exec(
      input,
    );
  const q = (address?.[1] ?? input).replace(/\.git$/, "");
  return /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(q) &&
    !/^[^/]+\/\.\.?$/.test(q)
    ? q
    : undefined;
}

/** Normalize pasted addresses visibly, leaving ordinary search typing alone. */
export function repositoryQuery(value: string): string {
  return /^(?:https:\/\/github\.com\/|git@github\.com:)/i.test(value.trim())
    ? (exactName(value) ?? value)
    : value;
}

const fixed = (n: number, digits: number) =>
  formatNumber(n, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
/** Bytes as MiB or GiB, the way the clone page and its cards say them. */
export function size(bytes: number): string {
  const mib = bytes / 1048576;
  if (mib >= 1024) return `${fixed(mib / 1024, 1)} GiB`;
  if (mib >= 10) return `${fixed(Math.round(mib), 0)} MiB`;
  return `${fixed(Math.max(mib, 0.1), 1)} MiB`;
}

/** A push time relative to now, in the person's local time. */
export function when(iso: string | null, now: number): string {
  if (!iso) return txt.noPush;
  const t = new Date(iso);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const start = today.getTime();
  if (t.getTime() >= start)
    return txt.today(formatDate(t, { hour: "numeric", minute: "2-digit" }));
  if (t.getTime() >= start - day) return txt.yesterday;
  const days = Math.round((start - t.getTime()) / day);
  if (days < 30) return txt.daysAgo(days);
  return formatDate(t, { day: "numeric", month: "numeric", year: "numeric" });
}
