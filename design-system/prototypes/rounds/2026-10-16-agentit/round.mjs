// Round of 2026-10-16 (proto-agent-harnesses): Claude Code and Codex next to Pi.
// ADR 0016 (proposed) recommends separate native harnesses run by each person's daemon;
// the prototype shows that path and, as a fourth page, the Pi-extension alternative
// where the UI differs. Shared by every direction: sign-in per agent under Asetukset →
// Agentit, the agent and model in the conversation's top bar, turn head and details,
// and controls that an agent does not have shown as unavailable with their reason.
// The axis is where the agent of a new conversation is chosen.
// The page bar's "Tilauslupa" switch is a prototype control, not product UI: it shows
// the sign-in views before and after the providers' approval.
export const title = 'Claude ja Codex Pi:n rinnalla';
export const app = true;
export const recap = false;
export const variants = [
  { name: 'Kentän valitsin', axis: 'agentti valitaan uuden keskustelun kentästä ennen ensimmäistä viestiä; sen jälkeen se näkyy yläpalkissa', fn: 'v1' },
  { name: 'Plus-valikko', axis: 'uusi keskustelu syntyy agentin kanssa: + avaa agenttivalikon, ja sivupalkin rivit kertovat agentin', fn: 'v2' },
  { name: 'Aloituskortit', axis: 'tyhjä keskustelu näyttää agentit kortteina tiloineen ja puuttuvine ominaisuuksineen', fn: 'v3' },
  { name: 'Vaihtoehto: Pi-laajennus', axis: 'ei suositeltu polku: Claude on Pi:n malli, joten agenttia ei valita vaan malli, ja kaikki ohjaimet ovat Pi:n', fn: 'v4' },
];
