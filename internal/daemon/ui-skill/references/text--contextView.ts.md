# text/contextView.ts

Generated from web/src/text/contextView.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The context view (components/ContextView.tsx, experimental): every fact
// and button says in plain words what it is and what pressing it does.
// Numbers and clock times arrive already formatted for the language.

type Verb = "read" | "wrote" | "edited" | "ran" | "used";
/** A clock time, with the date when it is not today. */
export type Moment = { time: string; date?: string };
const fiAt = (m: Moment) =>
  m.date ? `${m.date} klo ${m.time}` : `klo ${m.time}`;
const enAt = (m: Moment) =>
  m.date ? `on ${m.date} at ${m.time}` : `at ${m.time}`;
const enPlain = (m: Moment) => (m.date ? `${m.date}, ${m.time}` : m.time);
/** The one date the moments share, "" for today, or undefined for several. */
const sameDay = (ms: Moment[]) => {
  const dates = new Set(ms.map((m) => m.date ?? ""));
  return dates.size === 1 ? [...dates][0] : undefined;
};
/** "10.02 ja 10.20", "10.02, 10.20 ja 10.31" */
const fiList = (xs: string[]) =>
  xs.length > 1 ? `${xs.slice(0, -1).join(", ")} ja ${xs.at(-1)}` : xs[0];
const enList = (xs: string[]) =>
  xs.length > 2
    ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`
    : xs.join(" and ");
const fiLines = (added?: number, removed?: number) =>
  removed !== undefined
    ? `+${added ?? 0} −${removed} riviä`
    : added !== undefined
      ? added === 1
        ? "1 rivi"
        : `${added} riviä`
      : "";
const enLines = (added?: number, removed?: number) =>
  removed !== undefined
    ? `+${added ?? 0} −${removed} lines`
    : added !== undefined
      ? added === 1
        ? "1 line"
        : `${added} lines`
      : "";

const fi = {
  label: "Mihin konteksti kuluu",
  lead: "Konteksti on kaikki, mitä agentti näkee joka kerta, kun se vastaa viestiisi.",
  percent: (n: string) => `${n} %`,
  ofWindow: (tokens: string, window: string) => `${tokens} / ${window} tokenia`,
  about: (tokens: string) => `noin ${tokens}`,
  tokensOnly: (tokens: string) => `${tokens} tokenia`,
  ofWindowShort: (window: string) => `/ ${window} tokenia`,
  tokenIs: "Token on noin neljä merkkiä tekstiä.",
  autoAbove: (threshold: string) =>
    ` Kun käyttö ylittää viivan (${threshold} tokenia), agentti tiivistää keskustelun itse.`,
  autoOff:
    " Automaattinen tiivistys on pois päältä, joten agentti tiivistää vain pyydettäessä.",
  estimated: " Luku on arvio, kunnes agentti vastaa seuraavan kerran.",
  compact: "Tiivistä nyt…",
  compactDoes:
    "Agentti kirjoittaa vanhimmista viesteistä yhteenvedon ja vapauttaa niiden tilan. Uusimmat viestit jäävät ennalleen.",
  compactWhenWaiting: "Tiivistää voi, kun agentti odottaa viestiä.",
  nothingYet: (keep?: string) =>
    `Keskustelussa ei ole vielä tiivistettävää: agentti jättää aina uusimmat${keep ? ` noin ${keep}` : ""} tokenia ennalleen.`,
  compacting: "Agentti tiivistää keskustelua…",
  compacted: (at: Moment) =>
    `Tiivistetty ${fiAt(at)}. Uuden tiivistyksen voi pyytää, kun keskustelu on jatkunut.`,
  outcome: {
    done: (after: string) =>
      `Tiivistetty. Konteksti on nyt noin ${after} tokenia, kunnes agentti vastaa seuraavan kerran.`,
    already_compacted:
      "Agentti ei tiivistänyt: keskustelu on juuri tiivistetty. Uuden tiivistyksen voi pyytää, kun keskustelu on jatkunut.",
    nothing_to_compact:
      "Agentti ei tiivistänyt: keskustelussa ei ole vielä tiivistettävää.",
    turn_running:
      "Agentti ei tiivistänyt, koska se työskentelee. Tiivistää voi, kun se odottaa viestiä.",
    compacting: "Agentti tiivistää jo keskustelua.",
    cancelled: "Tiivistys keskeytettiin. Keskustelu on ennallaan.",
    compaction_failed:
      "Tiivistys ei onnistunut. Keskustelu on ennallaan; voit yrittää uudelleen.",
    unavailable:
      "Agenttia ei saatu käyntiin tiivistystä varten. Keskustelu on ennallaan.",
    stopped:
      "Agenttia ei saatu käyntiin tiivistystä varten. Keskustelu on ennallaan.",
    uncertain:
      "Tiivistyksen tulosta ei saatu varmistettua. Sivu näyttää tilanteen, kun keskustelu luetaan uudelleen.",
  },
  where: "Mihin tila kuluu",
  show: "Näytä",
  all: "Kaikki",
  filesOnly: (n: number) => `Vain tiedostot ${n}`,
  filesNote:
    "Tiedostot, jotka agentti luki tai muutti tässä keskustelussa. Agentin skriptillä kirjoittama tiedosto ei näy muutettuna.",
  seen: "Agentti näkee kokonaan",
  tokens: "Tokenia",
  seenNote: "Nämä agentti näkee sanasta sanaan joka kerta, kun se vastaa.",
  summaryOnly: "Vain yhteenvedossa",
  summaryNote: (at: Moment) =>
    `Agentti luki nämä ennen ${fiAt(at)} tehtyä tiivistystä. Ne eivät enää vie tilaa, ja agentti tietää niistä vain sen, mitä yhteenvetoon kirjoitettiin.`,
  emptyFiles: "Ei tiedostoja tässä ryhmässä.",
  empty: "Ei mitään tässä ryhmässä.",
  sizesNote:
    "Rivien koot ovat arvioita, joten ne eivät laske yhteen tarkalleen kokonaislukuun.",
  omitted: (n: number) =>
    ` Listasta on jätetty pois ${n} pienintä tai vanhinta riviä.`,
  talk: "Viestit ja agentin ajattelu",
  talkMeta: (from?: Moment) =>
    from
      ? `Viestisi, agentin vastaukset ja ajattelu ${fiAt(from)} alkaen`
      : "Viestisi, agentin vastaukset ja ajattelu",
  system: "Agentin ohjeet ja työkalut",
  systemMeta: "AGENTS.md, skillit ja työkalujen kuvaukset; mukana aina",
  summary: "Yhteenveto aiemmista viesteistä",
  summaryMeta: (at: Moment, before?: Moment) =>
    `Kirjoitettu ${fiAt(at)}${before ? `; korvaa viestit ennen ${fiAt(before)}` : ""}`,
  attachments: "Kuvat",
  attachmentsMeta: "Viesteihin ja tulosteisiin liitetyt kuvat",
  workspace: "Työtila",
  commandOutput: "Komennon tuloste",
  toolOutput: "Työkalun tuloste",
  verbs: {
    read: "luki",
    wrote: "kirjoitti",
    edited: "muutti",
    ran: "ajoi",
    used: "käytti",
  } as Record<Verb, string>,
  did: (verb: string, moments: Moment[], lines: string[]) =>
    `${verb} ${(() => {
      const day = sameDay(moments);
      return day === undefined
        ? fiList(moments.map(fiAt))
        : `${day ? `${day} ` : ""}klo ${fiList(moments.map((m) => m.time))}`;
    })()}${lines.length ? ` (${lines.join(", ")})` : ""}`,
  lines: fiLines,
  more: (n: number) => ` ja ${n} muuta kertaa`,
  opensInEditor: (path: string) => `Avaa ${path} editoriin`,
  dialogTitle: "Tiivistä keskustelu nyt",
  summarizes: (from: Moment, through: Moment) =>
    `Agentti kirjoittaa viesteistä ${(() => {
      const day = sameDay([from, through]);
      return day === undefined
        ? `${fiAt(from)} – ${fiAt(through)}`
        : `${day ? `${day} ` : ""}klo ${from.time}–${through.time}`;
    })()} yhteenvedon, ja niiden sisältö lähtee sen näkyvistä.`,
  summarizesOld:
    "Agentti kirjoittaa vanhimmista viesteistä yhteenvedon, ja niiden sisältö lähtee sen näkyvistä.",
  keeps: (from: Moment | undefined, keep: string | undefined, any: boolean) =>
    `${from ? `Viestit ${fiAt(from)} alkaen` : "Uusimmat viestit"} jäävät ennalleen, koska agentti jättää aina uusimmat${keep ? ` noin ${keep}` : ""} tokenia.${any ? " Niissä on myös:" : ""}`,
  keptMore: (n: number) => `ja ${n} muuta`,
  instruction: "Mitä yhteenvedossa pitää säilyttää? (valinnainen)",
  instructionHint: "Esim. testien luvut tarkkoina",
  after: (tokens: string) =>
    `Tiivistyksen jälkeen konteksti on noin ${tokens} tokenia. Vanhat viestit jäävät keskusteluun luettaviksi.`,
  cancel: "Peruuta",
  confirm: "Tiivistä",
};

export const contextViewText = catalog(fi, {
  label: "What fills the context",
  lead: "The context is everything the agent sees each time it answers your message.",
  percent: (n) => `${n}%`,
  ofWindow: (tokens, window) => `${tokens} / ${window} tokens`,
  about: (tokens) => `about ${tokens}`,
  tokensOnly: (tokens) => `${tokens} tokens`,
  ofWindowShort: (window) => `/ ${window} tokens`,
  tokenIs: "A token is about four characters of text.",
  autoAbove: (threshold) =>
    ` When usage passes the line (${threshold} tokens), the agent compacts the conversation itself.`,
  autoOff:
    " Automatic compaction is off, so the agent compacts only when asked.",
  estimated: " The figure is an estimate until the agent answers next.",
  compact: "Compact now…",
  compactDoes:
    "The agent writes a summary of the oldest messages and frees their room. The newest messages stay as they are.",
  compactWhenWaiting: "You can compact while the agent waits for a message.",
  nothingYet: (keep) =>
    `There is nothing to compact yet: the agent always keeps the newest${keep ? ` ${keep} or so` : ""} tokens as they are.`,
  compacting: "The agent is compacting the conversation…",
  compacted: (at) =>
    `Compacted ${enAt(at)}. You can ask for another compaction once the conversation has continued.`,
  outcome: {
    done: (after) =>
      `Compacted. The context is now about ${after} tokens until the agent answers next.`,
    already_compacted:
      "The agent did not compact: the conversation was just compacted. You can ask again once the conversation has continued.",
    nothing_to_compact:
      "The agent did not compact: there is nothing to compact yet.",
    turn_running:
      "The agent did not compact because it is working. You can compact while it waits for a message.",
    compacting: "The agent is already compacting the conversation.",
    cancelled: "The compaction was stopped. The conversation is unchanged.",
    compaction_failed:
      "The compaction did not succeed. The conversation is unchanged; you can try again.",
    unavailable:
      "The agent could not be started for the compaction. The conversation is unchanged.",
    stopped:
      "The agent could not be started for the compaction. The conversation is unchanged.",
    uncertain:
      "The outcome of the compaction could not be confirmed. The page shows it when the conversation is read again.",
  },
  where: "Where the room goes",
  show: "Show",
  all: "All",
  filesOnly: (n) => `Files only ${n}`,
  filesNote:
    "Files the agent read or changed in this conversation. A file the agent wrote with a script does not show as changed.",
  seen: "The agent sees in full",
  tokens: "Tokens",
  seenNote: "The agent sees these word for word each time it answers.",
  summaryOnly: "Only in the summary",
  summaryNote: (at) =>
    `The agent read these before the compaction ${enAt(at)}. They take no room any more, and the agent knows of them only what was written into the summary.`,
  emptyFiles: "No files in this group.",
  empty: "Nothing in this group.",
  sizesNote:
    "The rows' sizes are estimates, so they do not add up exactly to the total.",
  omitted: (n) =>
    ` ${n} of the smallest or oldest rows are left out of the list.`,
  talk: "Messages and the agent's thinking",
  talkMeta: (from) =>
    from
      ? `Your messages, the agent's replies and thinking from ${enPlain(from)}`
      : "Your messages, the agent's replies and thinking",
  system: "The agent's instructions and tools",
  systemMeta: "AGENTS.md, skills and tool descriptions; always included",
  summary: "Summary of earlier messages",
  summaryMeta: (at, before) =>
    `Written ${enAt(at)}${before ? `; replaces the messages before ${enPlain(before)}` : ""}`,
  attachments: "Images",
  attachmentsMeta: "Images attached to messages and outputs",
  workspace: "Workspace",
  commandOutput: "Command output",
  toolOutput: "Tool output",
  verbs: {
    read: "read",
    wrote: "wrote",
    edited: "edited",
    ran: "ran",
    used: "used",
  },
  did: (verb, moments, lines) =>
    `${verb} ${(() => {
      const day = sameDay(moments);
      return day === undefined
        ? enList(moments.map(enAt))
        : `${day ? `on ${day} ` : ""}at ${enList(moments.map((m) => m.time))}`;
    })()}${lines.length ? ` (${lines.join(", ")})` : ""}`,
  lines: enLines,
  more: (n) => ` and ${n} more times`,
  opensInEditor: (path) => `Open ${path} in the editor`,
  dialogTitle: "Compact the conversation now",
  summarizes: (from, through) =>
    `The agent writes a summary of the messages from ${enPlain(from)} to ${enPlain(through)}, and their content leaves its view.`,
  summarizesOld:
    "The agent writes a summary of the oldest messages, and their content leaves its view.",
  keeps: (from, keep, any) =>
    `${from ? `The messages from ${enPlain(from)} on` : "The newest messages"} stay as they are, because the agent always keeps the newest${keep ? ` ${keep} or so` : ""} tokens.${any ? " They also hold:" : ""}`,
  keptMore: (n) => `and ${n} more`,
  instruction: "What must the summary keep? (optional)",
  instructionHint: "For example, the test figures exactly",
  after: (tokens) =>
    `After the compaction the context is about ${tokens} tokens. The old messages stay readable in the conversation.`,
  cancel: "Cancel",
  confirm: "Compact",
});

```
