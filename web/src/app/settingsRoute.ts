import paths from "../../../internal/uiroutes/settings.json";

const settingsPaths: Record<string, string> = paths;

export function isSettingsRoute(path: string) {
  return path === "/settings" || path.startsWith("/settings/");
}

/** A row the settings page scrolls to and marks when a link names it. The
 * fragment never reaches the server, so the gateway's exact allowlist of
 * settings paths is unchanged. */
export type SettingsRow =
  | "default-model"
  | "chatgpt"
  | "claude"
  | "api-keys"
  | "github"
  | "gitea"
  | "workspaces";

export function settingsHref(section: string, row?: SettingsRow) {
  return `/settings/${settingsPaths[section]}${row ? `#${row}` : ""}`;
}

/** null is the settings index; undefined is an unknown section. */
export function settingsSection(path: string): string | null | undefined {
  if (path === "/settings") return null;
  return Object.keys(settingsPaths).find((id) => settingsHref(id) === path);
}
