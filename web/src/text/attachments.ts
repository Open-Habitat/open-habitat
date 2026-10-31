import { catalog } from "../i18n";

// Uploading and reading attachments (app/attachments.ts): the errors the
// composer and the attachment preview show, and an unnamed file's name.
const fi = {
  size: "Valitse 1 tavun – 20 MiB:n tiedosto.",
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
  size: "Choose a file between 1 byte and 20 MiB.",
  refused: "The attachment was not saved. Check its size and the free space.",
  uncertain:
    "Saving the attachment could not be confirmed. Do not send the message before you have checked.",
  badReply: "The reply to the attachment is not valid.",
  unnamed: "Attachment",
  invalid: "The attachment is not valid.",
  unread: "The attachment could not be loaded.",
  tooLarge: "The attachment is too large.",
});
