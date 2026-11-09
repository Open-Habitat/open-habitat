import { catalog } from "../i18n";

// A message's attachments as chips (components/AttachmentChips.tsx).
const fi = {
  attachment: "Liite",
  overLimit: "Ei mahdu viestiin",
  waiting: "Odottaa tallennusta",
  saving: "Tallennetaan",
  failed: "Tallennus katkesi",
  cancel: (name: string) => `Peru tiedoston ${name} liittäminen`,
  attachments: "Liitteet",
  open: (name: string) => `Avaa liite ${name}`,
  remove: (name: string) => `Poista liite ${name}`,
};

export const attachmentChipsText = catalog(fi, {
  attachment: "Attachment",
  overLimit: "Does not fit this message",
  waiting: "Waiting to save",
  saving: "Saving",
  failed: "Upload interrupted",
  cancel: (name: string) => `Cancel attaching ${name}`,
  attachments: "Attachments",
  open: (name) => `Open attachment ${name}`,
  remove: (name) => `Remove attachment ${name}`,
});
