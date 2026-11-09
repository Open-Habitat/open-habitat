import { catalog, formatNumber, plural } from "../i18n";

const fi = {
  size: (bytes: number) =>
    `${formatNumber(Math.ceil(bytes / 104857.6) / 10, { maximumFractionDigits: 1 })} Mt`,
  title: {
    large: (name: string) => `${name} on liian suuri`,
    empty: (name: string) => `${name} on tyhjä`,
    count: (name: string) => `${name} ei mahtunut viestiin`,
    total: (name: string) => `${name} ei mahtunut viestiin`,
    quota: (name: string) => `${name} jäi liittämättä`,
    disk: (name: string) => `${name} jäi liittämättä`,
    failed: (name: string) => `${name} ei tallentunut`,
  },
  many: (n: number) => `${formatNumber(n)} tiedostoa jäi liittämättä`,
  why: {
    large: (size: string) =>
      `Tiedosto on ${size}, ja liite voi olla enintään 20 Mt.`,
    empty: "Tiedostossa ei ole sisältöä.",
    count: "Viestiin voi liittää enintään 30 tiedostoa.",
    total: (used: string) =>
      `Viestin liitteet voivat olla yhteensä enintään 100 Mt, ja niitä on jo ${used}.`,
    quota: "Liitteillesi varattu tila, 1 Gt, on täynnä.",
    disk: "Palvelimen levy on täynnä.",
    failed: "Tallennus katkesi.",
  },
  todo: {
    large: "Pienennä tai pakkaa tiedosto, tai jaa se osiin.",
    empty: "Tarkista, että valitsit oikean tiedoston.",
    count: "Lähetä tämä viesti ja liitä loput seuraavaan.",
    total: "Lähetä tämä viesti ja liitä loput seuraavaan.",
    quota: "Pyydä agenttia poistamaan vanhat liitteet, joita et enää tarvitse.",
    disk: "Kerro palvelimen ylläpitäjälle.",
    failed: "Yritä uudelleen.",
  },
  short: {
    large: "yli 20 Mt",
    empty: "tyhjä",
    count: "yli 30 tiedostoa",
    total: "yli 100 Mt yhteensä",
    quota: "liitetila täynnä",
    disk: "levy täynnä",
    failed: "ei tallentunut",
  },
  progress: (sent: string, total: string, waiting: number) =>
    `${sent} / ${total} lähti. ${formatNumber(waiting)} ${plural("fi", waiting, { one: "tiedosto", other: "tiedostoa" })} odottaa. Viestiä ei lähetetty.`,
  retry: "Yritä uudelleen",
  dismiss: "Sulje",
};
export const attachmentRefusalText = catalog(fi, {
  size: (bytes) =>
    `${formatNumber(Math.ceil(bytes / 104857.6) / 10, { maximumFractionDigits: 1 })} MB`,
  title: {
    large: (name) => `${name} is too large`,
    empty: (name) => `${name} is empty`,
    count: (name) => `${name} did not fit in the message`,
    total: (name) => `${name} did not fit in the message`,
    quota: (name) => `${name} was not attached`,
    disk: (name) => `${name} was not attached`,
    failed: (name) => `${name} was not saved`,
  },
  many: (n) => `${formatNumber(n)} files were not attached`,
  why: {
    large: (size) =>
      `The file is ${size}, and an attachment can be at most 20 MB.`,
    empty: "The file has no content.",
    count: "A message can have at most 30 files.",
    total: (used) =>
      `A message's attachments can be at most 100 MB together, and it already has ${used}.`,
    quota: "The space for your attachments, 1 GB, is full.",
    disk: "The server's disk is full.",
    failed: "Saving was interrupted.",
  },
  todo: {
    large: "Make the file smaller, compress it or split it into parts.",
    empty: "Check that you chose the right file.",
    count: "Send this message and attach the rest to the next one.",
    total: "Send this message and attach the rest to the next one.",
    quota: "Ask the agent to delete old attachments you no longer need.",
    disk: "Tell the server's administrator.",
    failed: "Try again.",
  },
  short: {
    large: "over 20 MB",
    empty: "empty",
    count: "over 30 files",
    total: "over 100 MB in total",
    quota: "attachment space full",
    disk: "disk full",
    failed: "not saved",
  },
  progress: (sent: string, total: string, waiting: number) =>
    `${sent} / ${total} sent. ${formatNumber(waiting)} ${plural("en-US", waiting, { one: "file", other: "files" })} waiting. The message was not sent.`,
  retry: "Try again",
  dismiss: "Close",
});
