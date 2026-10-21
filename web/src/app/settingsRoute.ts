const settingsPaths: Record<string, string> = {
  tili: "tili",
  laitteet: "laitteet",
  agentti: "agentit",
  yhteydet: "yhteydet",
  integraatiot: "integraatiot",
  ulkoasu: "ulkoasu",
  editori: "editori",
  tila: "tallennustila",
  palvelin: "palvelin",
  kayttajat: "kayttajat",
  levy: "levytila",
};

export function isSettingsRoute(path: string) {
  return path === "/settings" || path.startsWith("/settings/");
}

export function settingsHref(section: string) {
  return `/settings/${settingsPaths[section]}`;
}

/** null is the settings index; undefined is an unknown section. */
export function settingsSection(path: string): string | null | undefined {
  if (path === "/settings") return null;
  return Object.keys(settingsPaths).find((id) => settingsHref(id) === path);
}
