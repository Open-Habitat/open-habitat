import { catalog } from "../i18n";

// A workspace's start page and its goals (app/WorkspaceLanding.tsx,
// app/StartPageRead.tsx).
const fi = {
  cannotStart: "Uutta keskustelua ei voi aloittaa nyt.",
  emptyHint: "Tyhjän keskustelun saat yläpalkin Uusi keskustelu -painikkeesta.",
  goalSkillUnchecked:
    "Tavoitteen taitoa ei saatu tarkistettua. Valitse tavoite uudelleen.",
  skillUnchecked: "Taitoa ei saatu tarkistettua. Valitse tavoite uudelleen.",
};

export const workspaceLandingText = catalog(fi, {
  cannotStart: "A new conversation cannot be started now.",
  emptyHint:
    "For an empty conversation, use the New conversation button in the top bar.",
  goalSkillUnchecked:
    "The goal's skill could not be checked. Choose the goal again.",
  skillUnchecked: "The skill could not be checked. Choose the goal again.",
});
