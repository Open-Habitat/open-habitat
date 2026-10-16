// Round of 2026-10-16 (proto-model-discovery): which models the account can actually use,
// and choosing among them. Pi's catalog lists models the ChatGPT route refuses (gpt-5.5,
// gpt-5.4, gpt-5.4-mini); the gpt-6 family answers. Shared by every direction: the choice
// appears in Asetukset (default for new conversations), the top-bar chip's popover (this
// conversation, from the next message), a new conversation's composer pill and inline in
// the unsupported-model notice; the thinking level sits next to the model; models are
// grouped by route (ChatGPT subscription, API key, Claude as its own agent).
// Common rule (Jari 16.10.2026): the choice offers the newest model of each family (luna,
// terra, sol, astra, e.g. gpt-6.1-sol over gpt-6-sol); older generations such as gpt-5.x sit
// behind "Vanhemmat mallit". The catalog is shaped like Pi 1.3.0's (issue upgrade-pi-1x).
// The axis is how certainty that a model works is obtained and shown.
// The page bar's "Tilanne" select is a prototype control, not product UI: it shows the
// failed, stale and new-model-family states of each direction.
// issues/proto-model-discovery/result.md lists the host facts each direction assumes.
export const title = 'Mallien tunnistus ja valinta';
export const app = true;
export const recap = false;
export const variants = [
  { name: 'Käytön merkit', axis: 'ei kokeilua: merkit tulevat omista keskusteluista (vastasi, torjuttiin); kokeilematon on "ei kokeiltu"', fn: 'v1' },
  { name: 'Kokeilu', axis: 'käytön merkkien lisäksi Kokeile: yksi malli kerrallaan, yksi lyhyt viesti pyynnöstä; tulos on havainto aikaleimalla', fn: 'v2' },
  { name: 'Tilin mallit', axis: 'vertailukohta: vain mallit, jotka OpenAI ilmoittaa tilillesi; Pi-reitillä tällaista luetteloa ei ole (research-model-discovery)', fn: 'v3' },
];
