import { catalog } from "../i18n";

// A message's attachments as chips (components/AttachmentChips.tsx).
const fi = {
  attachment: "Liite",
  attachments: "Liitteet",
  open: (name: string) => `Avaa liite ${name}`,
  remove: (name: string) => `Poista liite ${name}`,
};

export const attachmentChipsText = catalog(fi, {
  attachment: "Attachment",
  attachments: "Attachments",
  open: (name) => `Open attachment ${name}`,
  remove: (name) => `Remove attachment ${name}`,
});
