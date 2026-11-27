# text/dictation.tsx

Generated from web/src/text/dictation.tsx; do not edit.

```tsx
import type { ReactNode } from "react";
import { catalog } from "../i18n";

// Speech input in the composer (components/composer/Dictation.tsx): the mic,
// the recording bar and pill, the ceiling warning and the notices about why
// a dictation ended or could not start.
const fi = {
  /** "Enter, Esc tai ⌘§": a list of keys the way a hint reads it. */
  or: (first: string, last: string) => `${first} tai ${last}`,
  ceilingTitle: "Kaksi tuntia täynnä · Teksti on tallessa",
  ceilingText: "Mikrofoni on kiinni. Voit jatkaa sanelua tekstin perään.",
  minuteWarning:
    "Sanelu päättyy minuutin kuluttua. Kaikki sanottu jää kenttään.",
  secondsWarning: "Sanelu päättyy kymmenen sekunnin kuluttua.",
  limitWarning:
    "Kaksi tuntia täynnä. Mikrofoni on kiinni. Teksti jää kenttään.",
  remaining: (time: string) => `${time} jäljellä`,
  droppedKey: "Sanelu katkesi: Soniox ei enää hyväksy avainta",
  droppedLimit: "Sanelu katkesi: Soniox-avaimen käyttöraja täyttyi",
  droppedCredit: "Sanelu katkesi: Soniox-tililtä loppui saldo",
  droppedConnection: "Sanelu katkesi: yhteys Sonioxiin ei palannut",
  droppedText: (time: string) =>
    `Teksti ${time} asti on kentässä. Viimeiset sanat voivat olla epätarkkoja.`,
  keyMissing: "Sanelu tarvitsee Soniox-avaimen",
  micDenied: "Selain ei antanut mikrofonia",
  micDeniedText:
    "Salli mikrofoni osoiterivin lukkokuvakkeesta ja yritä uudelleen.",
  keyRejected: "Soniox ei hyväksy avainta",
  keyRejectedText:
    "Avain on väärä tai peruttu. Tallenna uusi avain asetuksissa.",
  limitReached: "Soniox-avaimen käyttöraja on täynnä",
  limitReachedText:
    "Yritä hetken päästä uudelleen tai lisää oma avain asetuksissa.",
  outOfCredit: "Soniox-tililtä on loppunut saldo",
  outOfCreditText:
    "Lisää tilille saldoa tai nosta sen kuukausibudjettia Soniox-konsolissa ja yritä uudelleen.",
  unsupported: "Tämä selain ei pysty saneluun",
  unsupportedText: "Kokeile toista selainta.",
  unavailable: "Soniox ei vastaa",
  unavailableText:
    "Sanelu ei alkanut. Yritä hetken päästä uudelleen ja tarkista Soniox-konsolista, että tilillä on saldoa.",
  dictate: "Sanele",
  micTip: (keys: ReactNode) => (
    <>{keys} · napauta aloittaaksesi, pidä pohjassa puhuaksesi</>
  ),
  opening: "avataan mikrofonia…",
  openingShort: "avataan…",
  listening: "kuuntelee",
  reconnecting: "Yhdistetään uudelleen…",
  finishing: "Viimeistellään…",
  letGo: "päästä irti, niin sanelu loppuu",
  pause: (time: string) => `tauko ${time}`,
  stopAt: (time: string) => `Lopeta sanelu, ${time}`,
  stopTip: (keys: string) =>
    `Lopeta sanelu (${keys}). Teksti jää kenttään; Esc peruu.`,
  done: "Valmis",
  doneKey: "valmis",
  dictationAt: (time: string) => `Sanelu, ${time}`,
  cancel: "Peru sanelu: kenttä palaa ennalleen",
  cancelTip: "Peru sanelu (Esc): kenttä palaa ennalleen",
  finish: "Valmis: lopeta sanelu, teksti jää kenttään",
  finishTip: (keys: string) => `Valmis: teksti jää kenttään (${keys})`,
  dictation: "Sanelu",
  speak: "Puhu, teksti tulee tähän…",
  endsIn: (time: string) => `Sanelu päättyy ${time} kuluttua`,
  allStays: "Kaikki sanottu jää kenttään.",
  actions: {
    settings: "Avaa asetukset",
    retry: "Yritä uudelleen",
    resume: "Jatka sanelua",
    console: "Avaa Soniox-konsoli",
  },
  closeNotice: "Sulje ilmoitus",
};

export const dictationText = catalog(fi, {
  or: (first, last) => `${first} or ${last}`,
  ceilingTitle: "Two hours reached · Your text is kept",
  ceilingText:
    "The microphone is off. You can continue dictating after the text.",
  minuteWarning:
    "Dictation ends in one minute. Everything you said stays in the field.",
  secondsWarning: "Dictation ends in ten seconds.",
  limitWarning:
    "Two hours reached. The microphone is off. Your text stays in the field.",
  remaining: (time) => `${time} left`,
  droppedKey: "Dictation cut off: Soniox no longer accepts the key",
  droppedLimit: "Dictation cut off: the Soniox key reached its usage limit",
  droppedCredit: "Dictation cut off: the Soniox account ran out of credit",
  droppedConnection:
    "Dictation cut off: the connection to Soniox did not return",
  droppedText: (time) =>
    `The text up to ${time} is in the field. The last words may be inaccurate.`,
  keyMissing: "Dictation needs a Soniox key",
  micDenied: "The browser did not allow the microphone",
  micDeniedText:
    "Allow the microphone from the lock icon in the address bar and try again.",
  keyRejected: "Soniox does not accept the key",
  keyRejectedText:
    "The key is wrong or has been revoked. Save a new key in Settings.",
  limitReached: "The Soniox key has reached its usage limit",
  limitReachedText: "Try again in a moment, or add your own key in Settings.",
  outOfCredit: "The Soniox account is out of credit",
  outOfCreditText:
    "Add credit to the account or raise its monthly budget in the Soniox console, then try again.",
  unsupported: "This browser cannot dictate",
  unsupportedText: "Try another browser.",
  unavailable: "Soniox is not responding",
  unavailableText:
    "Dictation did not start. Try again in a moment, and check in the Soniox console that the account has credit.",
  dictate: "Dictate",
  micTip: (keys) => <>{keys} · tap to start, hold to talk</>,
  opening: "opening the microphone…",
  openingShort: "opening…",
  listening: "listening",
  reconnecting: "Reconnecting…",
  finishing: "Finishing…",
  letGo: "let go to finish",
  pause: (time) => `pause ${time}`,
  stopAt: (time) => `Finish dictating, ${time}`,
  stopTip: (keys) =>
    `Finish dictating (${keys}). The text stays in the field; Esc cancels.`,
  done: "Done",
  doneKey: "done",
  dictationAt: (time) => `Dictation, ${time}`,
  cancel: "Cancel dictation: the field goes back to how it was",
  cancelTip: "Cancel dictation (Esc): the field goes back to how it was",
  finish: "Done: finish dictating, the text stays in the field",
  finishTip: (keys) => `Done: the text stays in the field (${keys})`,
  dictation: "Dictation",
  speak: "Speak, and the text appears here…",
  endsIn: (time) => `Dictation ends in ${time}`,
  allStays: "Everything you said stays in the field.",
  actions: {
    settings: "Open Settings",
    retry: "Try again",
    resume: "Continue dictating",
    console: "Open Soniox console",
  },
  closeNotice: "Close notice",
});

```
