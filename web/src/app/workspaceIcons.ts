import type { WorkspaceIconModel } from "../components/WorkspaceIcon";
import type { Workspace } from "./snapshot";

// The rail's workspace icons (workspace-icons, experimental), the chain of
// proto-workspace-icons' Lähdeketju: the icon the repository's committed
// .open-habitat.yaml names, else its logo, both as the daemon found them,
// else letters and a hue derived here from the name. The derivation is the
// browser's because it depends on every listed workspace: a tile that
// would repeat another's letters and hue moves to the next free hue.

const hues = 8;
const generic = new Set(["monorepo", "repo", "cli", "app", "web", "test"]);

/** FNV-1a of the lower-cased name: the same hue on every device. */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (const ch of s.toLocaleLowerCase("fi")) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Two letters: the first and last word's, skipping generic words such as
 * `monorepo` (northwind-monorepo → 3D, open-habitat → OH). */
export function glyphLetters(name: string) {
  let parts = name.split(/[-_.\s]+/).filter(Boolean);
  if (parts.length > 1)
    parts = parts.filter((p) => !generic.has(p.toLocaleLowerCase("fi")));
  const first = [...(parts[0] ?? name)];
  const letters =
    parts.length > 1
      ? first[0] + [...parts[parts.length - 1]][0]
      : first.slice(0, 2).join("");
  return letters.toLocaleUpperCase("fi");
}

export function iconSrc(workspaceId: string, version: string) {
  return `/api/v1/workspaces/icon?${new URLSearchParams({ workspace_id: workspaceId, v: version })}`;
}

/** Every workspace's icon by workspace_id, in the order the chain gives. */
export function workspaceIcons(
  workspaces: readonly Workspace[],
): Map<string, WorkspaceIconModel> {
  const icons = new Map<string, WorkspaceIconModel>();
  const taken = new Set<string>();
  const byName = [...workspaces].sort((a, b) =>
    (a.display_name ?? a.name).localeCompare(b.display_name ?? b.name, "fi"),
  );
  for (const w of byName) {
    const name = w.display_name ?? w.name;
    const letters = glyphLetters(name);
    let hue = hash(name) % hues;
    for (let n = 0; n < hues && taken.has(`${letters}${hue}`); n++)
      hue = (hue + 1) % hues;
    taken.add(`${letters}${hue}`);
    const glyph = { letters, hue };
    const icon = w.icon;
    icons.set(
      w.workspace_id,
      icon?.kind === "emoji"
        ? {
            name,
            glyph,
            show: { kind: "emoji", value: icon.value },
            source: "Repon asetus",
            where: ".open-habitat.yaml",
          }
        : icon?.kind === "image"
          ? {
              name,
              glyph,
              show: {
                kind: "image",
                src: iconSrc(w.workspace_id, icon.version),
              },
              source: icon.source === "config" ? "Repon asetus" : "Repon logo",
              where:
                icon.source === "config"
                  ? `.open-habitat.yaml · ${icon.path}`
                  : icon.path,
            }
          : {
              name,
              glyph,
              show: { kind: "glyph" },
              source: "Kirjaintunnus · johdettu nimestä",
            },
    );
  }
  return icons;
}
