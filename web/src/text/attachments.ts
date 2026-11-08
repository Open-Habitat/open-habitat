import { catalog } from "../i18n";

// Uploading and reading attachments (app/attachments.ts): the errors the
// composer and the attachment preview show, and an unnamed file's name.
const fi = {
  empty: (name: string) => `${name} on tyhjä, joten sitä ei liitetty.`,
  overLimit: (name: string, size: string) =>
    `${name} on ${size}, ja yksi liite voi olla enintään 20 Mt. Sitä ei liitetty.`,
  quota:
    "Liitettä ei tallennettu: liitteillesi varattu 1 Gt on täynnä. Pyydä agenttia poistamaan vanhoja liitteitä, joita et enää tarvitse.",
  refused: "Liitettä ei tallennettu. Tarkista koko ja vapaa tila.",
  uncertain:
    "Liitteen tallennusta ei voitu vahvistaa. Älä lähetä viestiä ennen tarkistusta.",
  badReply: "Liitteen vastaus ei kelpaa.",
  unnamed: "Liite",
  invalid: "Liite ei kelpaa.",
  unread: "Liitettä ei saatu.",
  tooLarge: "Liite on liian suuri.",
};

export const attachmentsText = catalog(fi, {
  empty: (name) => `${name} is empty, so it was not attached.`,
  overLimit: (name, size) =>
    `${name} is ${size}, and one attachment can be at most 20 MB. It was not attached.`,
  quota:
    "The attachment was not saved: the 1 GB set aside for your attachments is full. Ask the agent to remove old attachments you no longer need.",
  refused: "The attachment was not saved. Check its size and the free space.",
  uncertain:
    "Saving the attachment could not be confirmed. Do not send the message before you have checked.",
  badReply: "The reply to the attachment is not valid.",
  unnamed: "Attachment",
  invalid: "The attachment is not valid.",
  unread: "The attachment could not be loaded.",
  tooLarge: "The attachment is too large.",
});
