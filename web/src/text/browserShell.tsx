import type { ReactNode } from "react";
import { catalog } from "../i18n";

// The workspace's terminals around the panel (app/BrowserShell.tsx): what
// happened to a terminal, the clipboard and the close confirmation.
const fi = {
  taskfleetWindowClosed: "Taskfleetin ikkuna sulkeutui.",
  shellEnded: "Pääte päättyi. Sen tmux-istunto suljettiin.",
  lostBeforeOpen:
    "Yhteys katkesi ennen kuin pääte avautui. Se saattoi silti avautua; avaa paneeli uudelleen tarkistaaksesi.",
  ended: "Pääte on päättynyt.",
  detachedNamed: (name: string) =>
    `Irrotettiin ${name}. Ikkuna jatkaa Taskfleetissä; liity uudelleen tmux-valikosta.`,
  stopped: (name: string) => `${name} lopetettiin.`,
  stopUncertain:
    "Lopetuksen tulos jäi epävarmaksi. Päätteet luetaan uudelleen.",
  listFailed: "Päätteitä ei voitu lukea. Yritä uudelleen.",
  opening: "Avataan päätettä…",
  connecting: "Yhdistetään päätteeseen…",
  detachedElsewhere: "Pääte irrotettiin muualta. Se jatkaa tmuxissa.",
  rejoin: "Liity uudelleen",
  noClipboard:
    "Selain ei antanut leikepöytää. Liitä Ctrl+V:llä tai pitkällä painalluksella.",
  copied: "Valinta kopioitiin leikepöydälle.",
  copyRefused: "Selain ei antanut kopioida.",
  sentToComposer:
    "Valinta lisättiin keskustelun kenttään. Lähetä, kun olet valmis.",
  terminalLabel: (name: string, readOnly: boolean) =>
    `Pääte ${name}${readOnly ? " (vain luku)" : ""}`,
  stopQuestion: (name: string) => `Lopetetaanko ${name}?`,
  program: "ohjelma",
  running: (command: ReactNode) => (
    <>
      Siinä on käynnissä {command}. Lopetus päättää sen ja sulkee päätteen
      tmux-istunnon.
    </>
  ),
  hideInstead:
    "Jos haluat vain pois näkyvistä, piilota paneeli: päätteet jatkavat.",
  dismissNotice: "Sulje ilmoitus",
  cancel: "Peruuta",
  stop: "Lopeta pääte",
};

export const browserShellText = catalog(fi, {
  taskfleetWindowClosed: "The Taskfleet window closed.",
  shellEnded: "The terminal ended. Its tmux session was closed.",
  lostBeforeOpen:
    "The connection dropped before the terminal opened. It may have opened anyway; open the panel again to check.",
  ended: "The terminal has ended.",
  detachedNamed: (name) =>
    `Detached ${name}. The window carries on in Taskfleet; rejoin it from the tmux menu.`,
  stopped: (name) => `${name} was stopped.`,
  stopUncertain:
    "Whether the terminal stopped is uncertain. The terminals are read again.",
  listFailed: "The terminals could not be read. Try again.",
  opening: "Opening a terminal…",
  connecting: "Connecting to the terminal…",
  detachedElsewhere:
    "The terminal was detached elsewhere. It carries on in tmux.",
  rejoin: "Rejoin",
  noClipboard:
    "The browser did not allow the clipboard. Paste with Ctrl+V or a long press.",
  copied: "Selection copied to the clipboard.",
  copyRefused: "The browser did not allow copying.",
  sentToComposer:
    "The selection was added to the message field. Send it when you are ready.",
  terminalLabel: (name, readOnly) =>
    `Terminal ${name}${readOnly ? " (read-only)" : ""}`,
  stopQuestion: (name) => `Stop ${name}?`,
  program: "a program",
  running: (command) => (
    <>
      It is running {command}. Stopping ends it and closes the terminal's tmux
      session.
    </>
  ),
  hideInstead:
    "If you only want it out of sight, hide the panel: the terminals keep running.",
  dismissNotice: "Dismiss notice",
  cancel: "Cancel",
  stop: "Stop terminal",
});
