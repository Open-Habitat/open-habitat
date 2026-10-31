import { catalog } from "../i18n";

// The conversation's file shelf toggle (app/ViewHost.tsx).
const fi = {
  files: (count: number) => `Tiedostot: ${count}`,
  conversationFiles: "Keskustelun tiedostot",
};

export const viewHostText = catalog(fi, {
  files: (count) => `Files: ${count}`,
  conversationFiles: "The conversation's files",
});
