# text/codeMirrorEditor.ts

Generated from web/src/text/codeMirrorEditor.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// CodeMirror's own words for fold markers, which screen readers and tooltips
// use (components/CodeMirrorEditor.tsx). The keys are CodeMirror's phrases.
const fi = {
  phrases: {
    "Fold line": "Kokoa",
    "Unfold line": "Avaa",
    "folded code": "koottu osa",
    unfold: "avaa",
    "Folded lines": "Koottu rivit",
    "Unfolded lines": "Avattu rivit",
    to: "–",
  },
  documentLabel: "Tiedoston teksti",
  // A line that waits for the person's choice between two changes.
  pendingLine: "odottaa",
};

export const codeMirrorEditorText = catalog(fi, {
  phrases: {
    "Fold line": "Fold line",
    "Unfold line": "Unfold line",
    "folded code": "folded code",
    unfold: "unfold",
    "Folded lines": "Folded lines",
    "Unfolded lines": "Unfolded lines",
    to: "to",
  },
  documentLabel: "File text",
  pendingLine: "waiting",
});

```
