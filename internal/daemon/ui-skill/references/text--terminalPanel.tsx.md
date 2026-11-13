# text/terminalPanel.tsx

Generated from web/src/text/terminalPanel.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog, plural } from "../i18n";

// The workspace's terminal dock (components/TerminalPanel.tsx). Shell names,
// commands and tmux sessions come in as arguments.
const fi = {
  keys: { left: "Vasen", up: "Ylös", down: "Alas", right: "Oikea" },
  toggle: (n: number) => (n ? `Pääte (${n})` : "Pääte"),
  toggleTitle: "Pääte (Ctrl+Alt+T / ⌃⌥T)",
  running: (command?: string) => `Ajossa: ${command ?? "ohjelma"}`,
  taskfleetTip: (session: string) => `Taskfleet ${session} · vain luku`,
  atPrompt: "Kehotteessa",
  panel: "Päätepaneeli",
  height: "Paneelin korkeus",
  back: "Takaisin keskusteluun",
  conversation: "Keskustelu",
  tabs: (workspace: string) => `Päätteet: ${workspace}`,
  readOnly: "vain luku",
  detach: (name: string) => `Irrota ${name}`,
  end: (name: string) => `Lopeta ${name}`,
  detachTitle: "Irrota: Taskfleetin ikkuna jatkaa",
  endTitle: "Lopeta pääte",
  newIn: (workspace: string) => `Uusi pääte työtilaan ${workspace}`,
  new: "Uusi pääte",
  windows: "Taskfleetin tmux-ikkunat",
  attach: (n: number) => `Liity Taskfleetin ikkunaan (${n})`,
  windowsHeading: "Taskfleetin ikkunat (vain luku)",
  runs: (command: string) => ` · ajaa ${command}`,
  restore: "Palauta koko",
  maximize: "Suurenna",
  hide: "Piilota paneeli (päätteet jatkavat)",
  empty: (workspace: ReactNode) => <>Työtilassa {workspace} ei ole päätettä.</>,
  emptySub: (volatile: boolean) =>
    `Pääte on tavallinen bash työtilan hakemistossa. Se jatkaa palvelimella, kun suljet selaimen${volatile ? ", mutta päättyy, jos palvelin käynnistetään uudelleen." : "."}`,
  open: "Avaa pääte",
  offline: "Vain luku, kunnes yhteys palaa",
  copy: "Kopioi",
  copied: "Kopioitu",
  urlOffer: "Osoite päätteestä",
  urlQuestion: (host: string) => `Avataanko ${host}?`,
  urlWhy: "Päätteen ohjelma pyysi avaamaan osoitteen selaimessa.",
  urlOpen: "Avaa uuteen välilehteen",
  urlDismiss: "Ohita",
  toConversation: "Vie keskusteluun",
  paste: "Monirivinen liitos",
  pasteQuestion: (n: number) => `Liitetäänkö ${n} riviä?`,
  pasteWhy:
    "Pääte saa ne kuin kirjoitettuina, ja komentotulkki voi ajaa ne heti.",
  pasteMore: (n: number) => `… ja ${n} riviä lisää`,
  cancel: "Peruuta",
  pasteConfirm: "Liitä",
  keyRow: "Päätteen näppäimet",
  pasteClipboard: "Liitä leikepöydältä",
  hint: (volatile: boolean) => (
    <>
      <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd> vie fokuksen välilehtiin ja
      takaisin · <kbd>Tab</kbd> ja <kbd>Esc</kbd> kuuluvat päätteelle · valitse{" "}
      <kbd>Shift</kbd>+vetämällä · <kbd>Ctrl</kbd>+<kbd>C</kbd> kopioi,{" "}
      <kbd>Ctrl</kbd>+<kbd>V</kbd> liittää
      {volatile
        ? " · päätteet päättyvät, jos palvelin käynnistetään uudelleen"
        : ""}
    </>
  ),
};

export const terminalPanelText = catalog(fi, {
  keys: { left: "Left", up: "Up", down: "Down", right: "Right" },
  toggle: (n) => (n ? `Terminal (${n})` : "Terminal"),
  toggleTitle: "Terminal (Ctrl+Alt+T / ⌃⌥T)",
  running: (command) => `Running: ${command ?? "a program"}`,
  taskfleetTip: (session) => `Taskfleet ${session} · read only`,
  atPrompt: "At the prompt",
  panel: "Terminal panel",
  height: "Panel height",
  back: "Back to the conversation",
  conversation: "Conversation",
  tabs: (workspace) => `Terminals: ${workspace}`,
  readOnly: "read only",
  detach: (name) => `Detach ${name}`,
  end: (name) => `End ${name}`,
  detachTitle: "Detach: the Taskfleet window keeps running",
  endTitle: "End the terminal",
  newIn: (workspace) => `New terminal in ${workspace}`,
  new: "New terminal",
  windows: "Taskfleet's tmux windows",
  attach: (n) => `Attach to a Taskfleet window (${n})`,
  windowsHeading: "Taskfleet's windows (read only)",
  runs: (command) => ` · running ${command}`,
  restore: "Restore size",
  maximize: "Maximize",
  hide: "Hide the panel (terminals keep running)",
  empty: (workspace) => <>The workspace {workspace} has no terminal.</>,
  emptySub: (volatile) =>
    `A terminal is an ordinary bash in the workspace's folder. It keeps running on the server when you close the browser${volatile ? ", but ends if the server is restarted." : "."}`,
  open: "Open a terminal",
  offline: "Read only until the connection returns",
  copy: "Copy",
  copied: "Copied",
  urlOffer: "Address from the terminal",
  urlQuestion: (host) => `Open ${host}?`,
  urlWhy: "A program in the terminal asked to open the address in a browser.",
  urlOpen: "Open in a new tab",
  urlDismiss: "Dismiss",
  toConversation: "Send to the conversation",
  paste: "Multi-line paste",
  pasteQuestion: (n) =>
    `Paste ${n} ${plural("en", n, { one: "line", other: "lines" })}?`,
  pasteWhy:
    "The terminal gets them as if typed, and the shell may run them at once.",
  pasteMore: (n) =>
    `… and ${n} more ${plural("en", n, { one: "line", other: "lines" })}`,
  cancel: "Cancel",
  pasteConfirm: "Paste",
  keyRow: "Terminal keys",
  pasteClipboard: "Paste from the clipboard",
  hint: (volatile) => (
    <>
      <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>T</kbd> moves focus to the tabs and
      back · <kbd>Tab</kbd> and <kbd>Esc</kbd> go to the terminal · select with{" "}
      <kbd>Shift</kbd>+drag · <kbd>Ctrl</kbd>+<kbd>C</kbd> copies,{" "}
      <kbd>Ctrl</kbd>+<kbd>V</kbd> pastes
      {volatile ? " · terminals end if the server is restarted" : ""}
    </>
  ),
});

```
