# text/attachmentChips.ts

Generated from web/src/text/attachmentChips.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// A message's attachments as chips (components/AttachmentChips.tsx).
const fi = {
  attachment: "Liite",
  overLimit: "Ei mahdu viestiin",
  waiting: "Odottaa tallennusta",
  attachments: "Liitteet",
  open: (name: string) => `Avaa liite ${name}`,
  remove: (name: string) => `Poista liite ${name}`,
};

export const attachmentChipsText = catalog(fi, {
  attachment: "Attachment",
  overLimit: "Does not fit this message",
  waiting: "Waiting to save",
  attachments: "Attachments",
  open: (name) => `Open attachment ${name}`,
  remove: (name) => `Remove attachment ${name}`,
});

```
