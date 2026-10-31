import { catalog } from "../i18n";

// The context page (components/ContextPage.tsx): what fills the context,
// the next and earlier compactions, and every turn. Numbers arrive already
// formatted for the language.

/** Turns `from`–`to`, or one turn when `to` is not past `from`. */
const fiTurns = (from: number, to: number) =>
  to <= from ? `vuoro ${from}` : `vuorot ${from}–${to}`;
const enTurns = (from: number, to: number) =>
  to <= from ? `turn ${from}` : `turns ${from}–${to}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const fi = {
  sections: {
    preamble: "Pi:n perusohje",
    tools: "Työkalulista",
    rules: "Säännöt",
    docs: "Pi:n dokumentaatio",
    addendum: "Lisäohje",
    project_context: "AGENTS.md ja projektin ohjeet",
    skills: "Skillit",
    cwd: "Työhakemisto",
    open_habitat: "Habitatin ohje",
    prompt: "Kiinteä kehote",
  } as Record<string, string>,
  instructions: "Ohjeet ja järjestelmäkehote",
  replacedByClaude: "Claude Coden oma kehote korvaa",
  noPrompt: "Pi ei kirjannut kehotetta tähän sessioon.",
  toolDescriptions: "Työkalujen kuvaukset",
  summary: "Tiivistelmä",
  conversation: "Keskustelu",
  yourMessages: "Viestisi",
  replies: "Vastaukset",
  thinking: "Ajattelu",
  toolCalls: "Työkalukutsut",
  extensionMessages: "Laajennusten viestit",
  toolOutputs: "Työkalujen tulosteet",
  outputAtTurn: (name: string, turn: number) => `${name} · vuoro ${turn}`,
  largestOutputs: "Suurimmat tulosteet",
  attachments: "Liitteet",
  attachmentsNote: "Kuvat Pi:n kiinteällä kuva-arviolla",
  unitemized: "Erittelemätön",
  gapClaude:
    "Mitatun ja arvioidun ero: Claude Coden oma järjestelmäkehote, jota sessiotiedostoon ei kirjata, ja merkki-arvion virhe.",
  gapPi:
    "Mitatun ja arvioidun ero: merkkimäärästä arvioidut osat eivät vastaa mallin tokenointia tarkasti.",
  percent: (n: string) => `${n} %`,
  part: "Osa",
  tokens: "Tokenia",
  share: "Osuus",
  autoOff:
    "Automaattinen tiivistys on pois päältä; tiivistys tapahtuu vain pyynnöstä.",
  compactsAbove: (threshold: string) =>
    `Pi tiivistää, kun käyttö ylittää ${threshold} tokenia.`,
  noWhenWithoutWindow:
    "Tiivistyksen hetkeä ei voi laskea ilman mallin ikkunan kokoa.",
  alreadySummarized: "Jo tiivistelmässä",
  compactsNext: "Tiivistyy seuraavaksi",
  kept: "Säilyy",
  nextCompaction: (next: {
    from: number;
    through: number;
    tokens: string;
    updates: boolean;
    split?: number;
    keptFrom: number;
    last: number;
  }) =>
    `Silloin ${next.through >= next.from ? fiTurns(next.from, next.through) : "keskustelun alku"} (noin ${next.tokens} tokenia) korvautuu yhteenvedolla${next.updates ? ", joka päivittää edellisen tiivistelmän" : ""}. ${next.split !== undefined ? `Vuoro ${next.split} jakautuu: sen alku tiivistyy ja loppu säilyy.` : `${fiTurns(next.keptFrom, next.last)} säilyy sellaisenaan.`}`,
  nothingToCompact:
    "Tiivistettävää ei vielä ole: Pi säilyttäisi koko keskustelun sellaisenaan.",
  settingsUnread:
    "Pi:n tiivistysasetuksia ei voitu lukea, joten seuraavaa tiivistystä ei voi ennakoida.",
  cutRule: (keep?: string) =>
    `Pi:n oma leikkaussääntö${keep ? `: uusimmat noin ${keep} tokenia säilyvät vuoron alusta lähtien.` : "."} Tiivistetyt vuorot jäävät sessiotiedostoon ja keskusteluun, mutta malli ei enää näe niitä sellaisinaan.`,
  noCompactions: "Ei tiivistyksiä tässä keskustelussa.",
  compaction: (n: number) => `Tiivistys ${n}`,
  intoSummary: (through: number) =>
    through >= 1
      ? `${fiTurns(1, through)} tiivistelmään`
      : "ei kokonaisia vuoroja",
  afterNextReply: (tokens: string) => `${tokens} seuraavassa vastauksessa`,
  sizeFromNextReply: "koko seuraavasta vastauksesta",
  summarySize: (tokens: string) => `Yhteenveto noin ${tokens} tokenia`,
  summaryTruncated:
    "Tiivistelmä on katkaistu; koko teksti on sessiotiedostossa.",
  readFiles: (n: number) => `Luetut ${n}`,
  modifiedFiles: (n: number) => `Muutetut ${n}`,
  time: "Aika",
  request: "Pyyntö",
  context: "Konteksti",
  change: "Muutos",
  newInput: "Uusi syöte",
  fromCache: "Välimuistista",
  output: "Tuotos",
  cost: "Hinta",
  compactionRow: (c: {
    n: number;
    before: string;
    summary: string;
    keptFrom: number;
    after: number;
  }) =>
    `Tiivistys ${c.n}: ${c.before} tokenia → yhteenveto noin ${c.summary}${c.keptFrom <= c.after ? `; ${fiTurns(c.keptFrom, c.after)} ${c.after > c.keptFrom ? "säilyivät" : "säilyi"} sellaisenaan` : ""}`,
  turnsFine: (priced: boolean, omitted: number) =>
    `Konteksti on Pi:n mittaama vuoron viimeisestä vastauksesta. Syöte, välimuisti ja tuotos ovat vuoron kaikkien vastausten summia: jokainen työkalukutsun jälkeinen vastaus lukee koko kontekstin uudelleen.${priced ? " Hinta on Pi:n kirjaama." : " Pi kirjasi hinnaksi 0, mikä on tavallista tilauksen kautta käytetyille malleille."}${omitted ? ` ${omitted} vanhempaa vuoroa ei näytetä.` : ""}`,
  back: (title: string) => `Takaisin keskusteluun: ${title}`,
  title: "Konteksti",
  reading: "Luetaan Pi:n sessiota…",
  unreadable:
    "Kontekstin erittelyä ei voitu lukea. Keskustelu ja sen historia ovat ennallaan.",
  showingPrevious: "Uusinta erittelyä ei voitu lukea; näytetään edellinen.",
  estimateAbout: (tokens: string) => `arvio noin ${tokens} tokenia`,
  ofWindow: (measured: string, window: string) =>
    `${measured} / ${window} tokenia`,
  windowUnknown: "tokenia · ikkuna ei tiedossa",
  measuresNext:
    "Pi mittaa koon seuraavasta vastauksesta; siihen asti kokonaismääräkin on arvio.",
  roomBefore: (room: string, threshold: string) =>
    `${room} tokenia tilaa ennen tiivistystä (raja ${threshold}).`,
  overThreshold: (threshold: string) =>
    `Käyttö on tiivistysrajan (${threshold}) yli; Pi tiivistää seuraavan vuoron jälkeen.`,
  autoOffShort: "Automaattinen tiivistys on pois päältä.",
  noThresholdWithoutWindow:
    "Tiivistysrajaa ei voi laskea ilman mallin ikkunan kokoa.",
  trailing: (tokens: string) =>
    ` Viimeisen mittauksen jälkeen on tullut noin ${tokens} tokenia.`,
  modelUnknown: "Malli ei tiedossa",
  windowMeta: (window?: string) => `ikkuna ${window ?? "ei tiedossa"}`,
  settingsMeta: (reserve: string, keep: string) =>
    ` · vara ${reserve} · säilytettävä ${keep}`,
  claudeBridge:
    "Keskustelu kulkee Pi:n Claude-sillan kautta. Claude Code lähettää oman järjestelmäkehotteensa Pi:n perusohjeen tilalle, eikä sen kokoa kirjata sessiotiedostoon; Pi:stä välittyvät projektin ohjeet, skillit ja työkalut.",
  composedOf: "Mistä se koostuu",
  partsFine: (measured: boolean, over?: string) =>
    `${measured ? "Kokonaismäärä on Pi:n mittaama viimeisestä vastauksesta." : "Tiivistyksen jälkeen kokonaismääräkin on arvio, kunnes Pi mittaa sen seuraavasta vastauksesta."} Osat ovat Pi:n omaa arviota sessiotiedoston sisällöstä (merkit / 4).${over ? ` Arvio ylittää mitatun ${over} tokenilla.` : ""}`,
  nextHeading: "Seuraava tiivistys",
  compactions: "Tiivistykset",
  turns: "Vuorot",
};

export const contextPageText = catalog(fi, {
  sections: {
    preamble: "Pi's base prompt",
    tools: "Tool list",
    rules: "Rules",
    docs: "Pi's documentation",
    addendum: "Additional instructions",
    project_context: "AGENTS.md and project instructions",
    skills: "Skills",
    cwd: "Working directory",
    open_habitat: "Habitat's instructions",
    prompt: "Fixed prompt",
  },
  instructions: "Instructions and system prompt",
  replacedByClaude: "replaced by Claude Code's own prompt",
  noPrompt: "Pi recorded no prompt in this session.",
  toolDescriptions: "Tool descriptions",
  summary: "Summary",
  conversation: "Conversation",
  yourMessages: "Your messages",
  replies: "Replies",
  thinking: "Thinking",
  toolCalls: "Tool calls",
  extensionMessages: "Extension messages",
  toolOutputs: "Tool output",
  outputAtTurn: (name, turn) => `${name} · turn ${turn}`,
  largestOutputs: "Largest outputs",
  attachments: "Attachments",
  attachmentsNote: "Images at Pi's fixed image estimate",
  unitemized: "Not itemised",
  gapClaude:
    "The gap between measured and estimated: Claude Code's own system prompt, which is not recorded in the session file, and the error of the character estimate.",
  gapPi:
    "The gap between measured and estimated: parts estimated from character counts do not match the model's tokenisation exactly.",
  percent: (n) => `${n}%`,
  part: "Part",
  tokens: "Tokens",
  share: "Share",
  autoOff: "Automatic compaction is off; Pi compacts only when asked.",
  compactsAbove: (threshold) =>
    `Pi compacts when usage exceeds ${threshold} tokens.`,
  noWhenWithoutWindow:
    "When compaction happens cannot be worked out without the model's window size.",
  alreadySummarized: "Already summarised",
  compactsNext: "Compacted next",
  kept: "Kept",
  nextCompaction: (next) => {
    const kept = enTurns(next.keptFrom, next.last);
    return `Then ${next.through >= next.from ? enTurns(next.from, next.through) : "the start of the conversation"} (about ${next.tokens} tokens) will be replaced by a summary${next.updates ? " that updates the previous one" : ""}. ${next.split !== undefined ? `Turn ${next.split} is split: its beginning is compacted and the rest kept.` : `${capital(kept)} ${next.last > next.keptFrom ? "are" : "is"} kept as is.`}`;
  },
  nothingToCompact:
    "Nothing to compact yet: Pi would keep the whole conversation as is.",
  settingsUnread:
    "Pi's compaction settings could not be read, so the next compaction cannot be predicted.",
  cutRule: (keep) =>
    `Pi's own cut rule${keep ? `: the latest ${keep} tokens or so are kept, from the start of a turn.` : "."} Compacted turns stay in the session file and in the conversation, but the model no longer sees them as they were.`,
  noCompactions: "No compactions in this conversation.",
  compaction: (n) => `Compaction ${n}`,
  intoSummary: (through) =>
    through >= 1 ? `${enTurns(1, through)} into the summary` : "no whole turns",
  afterNextReply: (tokens) => `${tokens} at the next reply`,
  sizeFromNextReply: "size known from the next reply",
  summarySize: (tokens) => `Summary about ${tokens} tokens`,
  summaryTruncated:
    "The summary is cut short; the full text is in the session file.",
  readFiles: (n) => `Read ${n}`,
  modifiedFiles: (n) => `Modified ${n}`,
  time: "Time",
  request: "Request",
  context: "Context",
  change: "Change",
  newInput: "New input",
  fromCache: "From cache",
  output: "Output",
  cost: "Cost",
  compactionRow: (c) =>
    `Compaction ${c.n}: ${c.before} tokens → summary about ${c.summary}${c.keptFrom <= c.after ? `; ${enTurns(c.keptFrom, c.after)} kept as ${c.after > c.keptFrom ? "they were" : "it was"}` : ""}`,
  turnsFine: (priced, omitted) =>
    `Context is Pi's measurement from the turn's last reply. Input, cache and output add up all of the turn's replies: every reply after a tool call reads the whole context again.${priced ? " The cost is as Pi recorded it." : " Pi recorded a cost of 0, which is usual for models used through a subscription."}${omitted ? ` ${omitted} older ${omitted === 1 ? "turn is" : "turns are"} not shown.` : ""}`,
  back: (title) => `Back to the conversation: ${title}`,
  title: "Context",
  reading: "Reading Pi's session…",
  unreadable:
    "The context breakdown could not be read. The conversation and its history are unchanged.",
  showingPrevious:
    "The latest breakdown could not be read; showing the previous one.",
  estimateAbout: (tokens) => `estimated about ${tokens} tokens`,
  ofWindow: (measured, window) => `${measured} / ${window} tokens`,
  windowUnknown: "tokens · window unknown",
  measuresNext:
    "Pi measures the size from the next reply; until then the total is an estimate too.",
  roomBefore: (room, threshold) =>
    `${room} tokens of room before compaction (limit ${threshold}).`,
  overThreshold: (threshold) =>
    `Usage is over the compaction limit (${threshold}); Pi compacts after the next turn.`,
  autoOffShort: "Automatic compaction is off.",
  noThresholdWithoutWindow:
    "The compaction limit cannot be worked out without the model's window size.",
  trailing: (tokens) =>
    ` About ${tokens} tokens have been added since the last measurement.`,
  modelUnknown: "Model unknown",
  windowMeta: (window) => `window ${window ?? "unknown"}`,
  settingsMeta: (reserve, keep) => ` · reserve ${reserve} · kept ${keep}`,
  claudeBridge:
    "The conversation runs through Pi's Claude bridge. Claude Code sends its own system prompt in place of Pi's base prompt, and its size is not recorded in the session file; Pi passes on the project instructions, skills and tools.",
  composedOf: "What it is made of",
  partsFine: (measured, over) =>
    `${measured ? "The total is Pi's measurement from the last reply." : "After a compaction the total is an estimate too, until Pi measures it from the next reply."} The parts are Pi's own estimate of the session file's content (characters / 4).${over ? ` The estimate exceeds the measurement by ${over} tokens.` : ""}`,
  nextHeading: "Next compaction",
  compactions: "Compactions",
  turns: "Turns",
});
