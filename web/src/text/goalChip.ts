import { catalog } from "../i18n";

// A start-page goal shown as a chip above the composer
// (components/composer/GoalChip.tsx), and its request card.
const fi = {
  open: (title: string) => `Tavoite: ${title}. Näytä pyyntö`,
  openTip: "Näytä agentille annettava pyyntö",
  card: (title: string) => `Tavoite: ${title}`,
  eyebrow: (skill: string) => `TAVOITE · /skill:${skill}`,
  back: "← Takaisin keskusteluun",
  request: "Pyyntö agentille",
  note: "Agentti saa taidon ohjeen ja sen perään kentän tekstisi.",
  unwrap: "Muokkaa tekstinä",
  close: "Sulje",
  remove: (title: string) => `Poista tavoite ${title}`,
  removeTip: "Poista tavoite luonnoksesta",
};

export const goalChipText = catalog(fi, {
  open: (title) => `Goal: ${title}. Show the request`,
  openTip: "Show the request the agent gets",
  card: (title) => `Goal: ${title}`,
  eyebrow: (skill) => `GOAL · /skill:${skill}`,
  back: "← Back to the conversation",
  request: "Request to the agent",
  note: "The agent gets the skill's instructions followed by the text you write in the field.",
  unwrap: "Edit as text",
  close: "Close",
  remove: (title) => `Remove the goal ${title}`,
  removeTip: "Remove the goal from the draft",
});
