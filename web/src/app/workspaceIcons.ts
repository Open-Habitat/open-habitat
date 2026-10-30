import type { WorkspaceIconModel } from "../components/WorkspaceIcon";
import type { WorkspaceIconPickerModel } from "../components/WorkspaceIconPicker";
import type { Workspace } from "./snapshot";

// The rail's workspace icons (workspace-icons, experimental), the chain of
// proto-workspace-icons' Lähdeketju: the icon the repository's committed
// .open-habitat.yaml names (an emoji, letters or an image), else its logo,
// both as the daemon found them, else letters and a hue derived here from the
// name. The derivation is the
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

export function iconSrc(workspaceId: string, version: string, logo = false) {
  return `/api/v1/workspaces/icon?${new URLSearchParams({ workspace_id: workspaceId, v: version, ...(logo ? { logo: "1" } : {}) })}`;
}

/** What the config's `icon` says now, in its flat format (the value the
 * picker marks as chosen), or undefined when it says nothing usable. */
export function iconSetting(w: Workspace): string | undefined {
  if (w.icon_auto) return "auto";
  if (w.icon?.source !== "config") return undefined;
  return w.icon.kind === "image" ? w.icon.path : w.icon.value;
}

/** Shows a flat `icon` value the way the chain would, before the snapshot
 * says so: a choice is on the page at once. `auto` shows the logo, else the
 * glyph. */
export function previewIcon(
  icon: WorkspaceIconModel,
  w: Workspace,
  value: string,
): WorkspaceIconModel {
  const logo = w.icon_logo
    ? {
        kind: "image" as const,
        src: iconSrc(w.workspace_id, w.icon_logo.version, true),
      }
    : undefined;
  if (value === "auto")
    return {
      ...icon,
      glyph: { ...icon.glyph, letters: glyphLetters(icon.name) },
      show: logo ?? { kind: "glyph" },
    };
  if (logo && value === w.icon_logo?.path) return { ...icon, show: logo };
  if (/^[A-Z0-9ÅÄÖ]{1,3}$/.test(value))
    return {
      ...icon,
      glyph: { ...icon.glyph, letters: value },
      show: { kind: "glyph" },
    };
  return { ...icon, show: { kind: "emoji", value } };
}

/** The page picker's model; `pending` is a choice the snapshot does not
 * carry yet, shown as if it did. */
export function iconPicker(
  icon: WorkspaceIconModel,
  w: Workspace,
  pending?: string,
): WorkspaceIconPickerModel {
  return {
    icon: pending ? previewIcon(icon, w, pending) : icon,
    setting: pending ?? iconSetting(w),
    auto: previewIcon(icon, w, "auto"),
    logo: w.icon_logo
      ? { path: w.icon_logo.path, icon: previewIcon(icon, w, w.icon_logo.path) }
      : undefined,
    letters: glyphLetters(icon.name),
  };
}

/** Where the icon comes from, as the line under the page's heading says. */
export function iconSourceLine(w: Workspace) {
  const icon = w.icon;
  if (icon?.source === "config")
    return { source: "Repon asetus", where: ".open-habitat.yaml" };
  if (icon?.kind === "image")
    return {
      source: w.icon_auto ? "Automaattinen · repon logo" : "Repon logo",
      where: icon.path,
    };
  return {
    source: w.icon_auto
      ? "Automaattinen · nimestä johdettu tunnus"
      : "Nimestä johdettu tunnus",
  };
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
    const icon = w.icon;
    const letters = icon?.kind === "letters" ? icon.value : glyphLetters(name);
    let hue = hash(name) % hues;
    for (let n = 0; n < hues && taken.has(`${letters}${hue}`); n++)
      hue = (hue + 1) % hues;
    taken.add(`${letters}${hue}`);
    const glyph = { letters, hue };
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
        : icon?.kind === "letters"
          ? {
              name,
              glyph,
              show: { kind: "glyph" },
              source: "Repon asetus · kirjaimet",
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
                source:
                  icon.source === "config" ? "Repon asetus" : "Repon logo",
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
