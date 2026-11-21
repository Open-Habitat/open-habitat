# text/scheduledWake.ts

Generated from web/src/text/scheduledWake.ts; do not edit.

```tsx
import { catalog, plural } from "../i18n";

// Scheduled wake (experimental): the rail row's wake time, the pending
// wake's bar in the conversation, Habitat's line when the agent was woken or
// told of a cancellation, and the archive window's wake rows
// (components/ScheduledWake.tsx, app/wakeTime.ts).
const fi = {
  weekdays: ["su", "ma", "ti", "ke", "to", "pe", "la"],
  /** "to 19.11. klo 9.00" */
  full: (weekday: string, date: string, time: string) =>
    `${weekday} ${date} klo ${time}`,
  // The rail row.
  waitsWake: (at: string) => `Odottaa herätystä ${at}`,
  wokeAt: (at: string) => `Herätetty ${at}`,
  // The bar at the conversation's foot.
  bar: (at: string) => `Herätys ${at}`,
  setByAgent: "agentti asetti",
  more: (n: number) =>
    n === 1 ? "ja 1 herätys myöhemmin" : `ja ${n} herätystä myöhemmin`,
  change: "Muuta aikaa…",
  cancel: "Peru herätys",
  newTime: "Uusi herätysaika",
  save: "Tallenna",
  keep: "Älä muuta",
  pastTime: "Valitse aika, joka on tulevaisuudessa.",
  changeFailed: "Herätystä ei voitu muuttaa. Lue tilanne uudelleen.",
  // Habitat's line in the conversation.
  habitat: "Open Habitat",
  fired: (at: string, set: string) =>
    `Ajastettu herätys ${at}. Agentti asetti sen ${set}.`,
  firedLate: (at: string, woke: string) =>
    `Ajastettu herätys ${at} myöhästyi: agentti herätettiin vasta ${woke}, koska palvelin tai Habitat ei ollut käynnissä.`,
  moved: (from: string, to: string) => `Siirsit herätyksen ${from} → ${to}.`,
  cancelled: (n: number) =>
    n === 1
      ? "Agentille kerrottiin viestisi mukana, että herätys peruttiin:"
      : `Agentille kerrottiin viestisi mukana, että ${n} herätystä peruttiin:`,
  cancelReason: {
    person: (at: string) => `${at}, peruit sen`,
    archived: (at: string) => `${at}, peruttiin arkistoitaessa`,
  },
  // The archive window.
  archiveLead: (n: number) =>
    n === 1
      ? "Arkistointi perii odottavan herätyksen:"
      : `Arkistointi perii ${n} odottavaa herätystä:`,
  archiveRule:
    "Agentti ei herää arkistoituun keskusteluun. Jos palautat keskustelun myöhemmin, herätykset eivät palaa; pyydä agenttia asettamaan uusi.",
  archiveAccept: (n: number): string =>
    n === 1 ? "Arkistoi ja peru herätys" : "Arkistoi ja peru herätykset",
  // The archive notice.
  noticeDetail: (at: string, n: number) =>
    n === 1 ? `herätys ${at} peruttu` : `${n} herätystä peruttu`,
};

export const scheduledWakeText = catalog(
  fi,
  {
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    full: (weekday, date, time) => `${weekday} ${date} at ${time}`,
    waitsWake: (at) => `Waiting for a wake ${at}`,
    wokeAt: (at) => `Woken ${at}`,
    bar: (at) => `Wake ${at}`,
    setByAgent: "set by the agent",
    more: (n) =>
      `and ${n} later ${plural("en", n, { one: "wake", other: "wakes" })}`,
    change: "Change time…",
    cancel: "Cancel wake",
    newTime: "New wake time",
    save: "Save",
    keep: "Keep",
    pastTime: "Choose a time in the future.",
    changeFailed: "The wake could not be changed. Read the situation again.",
    habitat: "Open Habitat",
    fired: (at, set) => `Scheduled wake ${at}. The agent set it ${set}.`,
    firedLate: (at, woke) =>
      `Scheduled wake ${at} was late: the agent was woken only ${woke} because the server or Habitat was not running.`,
    moved: (from, to) => `You moved the wake ${from} → ${to}.`,
    cancelled: (n) =>
      n === 1
        ? "The agent was told with your message that a wake was canceled:"
        : `The agent was told with your message that ${n} wakes were canceled:`,
    cancelReason: {
      person: (at) => `${at}, you canceled it`,
      archived: (at) => `${at}, canceled when archived`,
    },
    archiveLead: (n) =>
      n === 1
        ? "Archiving cancels the pending wake:"
        : `Archiving cancels ${n} pending wakes:`,
    archiveRule:
      "The agent does not wake in an archived conversation. If you restore the conversation later, the wakes do not come back; ask the agent to set a new one.",
    archiveAccept: (n) =>
      n === 1 ? "Archive and cancel wake" : "Archive and cancel wakes",
    noticeDetail: (at, n) =>
      n === 1 ? `wake ${at} canceled` : `${n} wakes canceled`,
  },
  {
    cancelled: (n) =>
      n === 1
        ? "The agent was told with your message that a wake was cancelled:"
        : `The agent was told with your message that ${n} wakes were cancelled:`,
    cancelReason: {
      person: (at) => `${at}, you cancelled it`,
      archived: (at) => `${at}, cancelled when archived`,
    },
    noticeDetail: (at, n) =>
      n === 1 ? `wake ${at} cancelled` : `${n} wakes cancelled`,
  },
);

```
