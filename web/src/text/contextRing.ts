import { catalog } from "../i18n";

// How full the model's context window is (components/ContextRing.tsx): the
// ring's value and the one sentence that names, labels and explains it.
const fi = {
  percent: (p: string) => `${p} %`,
  compacting:
    "Pi tiivistää vanhempaa historiaa yhteenvedoksi. Keskustelu jatkuu, kun tiivistys valmistuu.",
  edited:
    "Pi muokkasi keskustelun kontekstia. Uusi luku tulee Pi:n seuraavasta vastauksesta.",
  after:
    "Historia tiivistettiin. Uusi luku tulee Pi:n seuraavasta vastauksesta.",
  noWindow: (tokens: string) =>
    `${tokens} tokenia käytössä. Mallin kontekstin kokoa ei tiedetä, joten osuutta ei voi laskea.`,
  compactsAt: (percent: string) =>
    `Pi tiivistää vanhemman historian, kun noin ${percent} täyttyy.`,
  autoOff: "Automaattinen tiivistys on pois päältä.",
  usage: (percent: string, tokens: string, window: string) =>
    `Konteksti ${percent}: ${tokens} / ${window} tokenia.`,
  compactingValue: "Tiivistää",
  back: "Palaa keskusteluun.",
  open: "Avaa kontekstin erittely.",
};

export const contextRingText = catalog(fi, {
  percent: (p) => `${p}%`,
  compacting:
    "Pi is summarising older history. The conversation continues when the summary is done.",
  edited:
    "Pi edited the conversation's context. The new figure comes with Pi's next reply.",
  after:
    "The history was summarised. The new figure comes with Pi's next reply.",
  noWindow: (tokens) =>
    `${tokens} tokens in use. The model's context size is not known, so the share cannot be calculated.`,
  compactsAt: (percent) =>
    `Pi summarises older history when about ${percent} is full.`,
  autoOff: "Automatic summarising is off.",
  usage: (percent, tokens, window) =>
    `Context ${percent}: ${tokens} / ${window} tokens.`,
  compactingValue: "Summarising",
  back: "Back to the conversation.",
  open: "Open the context breakdown.",
});
