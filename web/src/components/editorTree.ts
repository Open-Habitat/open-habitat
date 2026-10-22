export type FileEntry = {
  name: string;
  kind: "file" | "directory" | "unsupported";
};
export interface TreeDirectory {
  entries?: FileEntry[];
  truncated?: boolean;
  loading?: boolean;
  error?: boolean;
}
export type TreeDirectories = Record<string, TreeDirectory>;
export interface TreeRow {
  key: string;
  path: string;
  label: string;
  kind: FileEntry["kind"];
  depth: number;
  position: number;
  size: number;
  parent?: string;
}
const join = (parent: string, name: string) =>
  parent ? `${parent}/${name}` : name;

/** Only a complete observed listing can prove that a folder is a chain. */
export function treeRows(
  directories: TreeDirectories,
  expanded: Set<string>,
  filter: string,
): TreeRow[] {
  if (filter.trim()) {
    const query = filter.trim().toLocaleLowerCase();
    return Object.entries(directories)
      .flatMap(([parent, directory]) =>
        (directory.entries ?? [])
          .filter((entry) => entry.kind !== "directory")
          .map((entry) => {
            const path = join(parent, entry.name);
            return { key: path, path, label: path, kind: entry.kind, depth: 0 };
          }),
      )
      .filter((row) => row.path.toLocaleLowerCase().includes(query))
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((row, index, all) => ({
        ...row,
        position: index + 1,
        size: all.length,
      }));
  }
  const rows: TreeRow[] = [];
  function visit(directory: string, depth: number, parent?: string) {
    const entries = directories[directory]?.entries ?? [];
    for (const [index, entry] of entries.entries()) {
      const key = join(directory, entry.name);
      let path = key;
      let label = entry.name;
      if (entry.kind === "directory") {
        let listing = directories[path];
        while (
          listing?.entries?.length === 1 &&
          !listing.truncated &&
          !listing.error &&
          !listing.loading &&
          listing.entries[0].kind === "directory"
        ) {
          const child = listing.entries[0].name;
          path = join(path, child);
          label += `/${child}`;
          listing = directories[path];
        }
      }
      rows.push({
        key,
        path,
        label,
        kind: entry.kind,
        depth,
        parent,
        position: index + 1,
        size: entries.length,
      });
      if (entry.kind === "directory" && expanded.has(path))
        visit(path, depth + 1, key);
    }
  }
  visit("", 0);
  return rows;
}
