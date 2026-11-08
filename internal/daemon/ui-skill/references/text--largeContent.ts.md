# text/largeContent.ts

Generated from web/src/text/largeContent.ts; do not edit.

```tsx
import { catalog, formatNumber } from "../i18n";

// Sizes at the point something stops (app/largeContent.ts): what the
// composer, the host's refusals and the history say when a message, its
// attachments or a conversation is too large. A size is shown only in such a
// message, never as a standing meter. Sizes are binary megabytes, rounded to
// whole ones from ten up, so the limits read as 20 Mt and 100 Mt.
const megabytes = (bytes: number) => {
  const n = bytes / 1024 / 1024;
  return formatNumber(n, { maximumFractionDigits: n < 10 ? 1 : 0 });
};

const fi = {
  size: (bytes: number) =>
    bytes < 1024 * 1024
      ? `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} kt`
      : `${megabytes(bytes)} Mt`,
  notSent: "Viestiä ei lähetetty",
  /** The pre-send check: the attachments of one message do not fit. */
  overCount: (count: number) =>
    `Liitteitä on ${count}, ja yhteen viestiin mahtuu 30 tiedostoa ja yhteensä 100 Mt. Luonnos ja liitteet ovat tallessa: poista osa tai lähetä ne kahdessa viestissä.`,
  overBytes: (count: number, size: string) =>
    `${count} liitettä ovat yhteensä ${size}, ja yhteen viestiin mahtuu 100 Mt. Luonnos ja liitteet ovat tallessa: poista osa tai lähetä ne kahdessa viestissä.`,
  /** The host's refusals of a message, by its code. */
  hostTooMany:
    "Viestiä ei lähetetty: liitteitä on yli 30. Myös jonossa odottavien viestien liitteet lasketaan, koska agentti saa ne yhdessä. Luonnos ja liitteet ovat tallessa: poista osa tai lähetä ne myöhemmin.",
  hostTooLarge:
    "Viestiä ei lähetetty: liitteet ovat yhteensä yli 100 Mt. Myös jonossa odottavien viestien liitteet lasketaan, koska agentti saa ne yhdessä. Luonnos ja liitteet ovat tallessa: poista osa tai lähetä ne myöhemmin.",
  hostMissing:
    "Viestiä ei lähetetty: jokin liitteistä ei ole enää tallessa. Poista se ja liitä tiedosto uudelleen.",
  hostTooLong:
    "Viestiä ei lähetetty: se on jonossa odottavien viestien kanssa liian pitkä. Lyhennä sitä tai odota, että agentti ottaa jonon vastaan.",
};

export const largeContentText = catalog(fi, {
  size: (bytes) =>
    bytes < 1024 * 1024
      ? `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} KB`
      : `${megabytes(bytes)} MB`,
  notSent: "The message was not sent",
  overCount: (count) =>
    `There are ${count} attachments, and one message holds 30 files and 100 MB in total. Your draft and attachments are kept: remove some or send them in two messages.`,
  overBytes: (count, size) =>
    `${count} attachments come to ${size}, and one message holds 100 MB. Your draft and attachments are kept: remove some or send them in two messages.`,
  hostTooMany:
    "The message was not sent: there are more than 30 attachments. Attachments of queued messages count too, because the agent gets them together. Your draft and attachments are kept: remove some or send them later.",
  hostTooLarge:
    "The message was not sent: the attachments come to more than 100 MB. Attachments of queued messages count too, because the agent gets them together. Your draft and attachments are kept: remove some or send them later.",
  hostMissing:
    "The message was not sent: one of its attachments is no longer stored. Remove it and attach the file again.",
  hostTooLong:
    "The message was not sent: together with the queued messages it is too long. Shorten it or wait until the agent takes the queue.",
});

```
