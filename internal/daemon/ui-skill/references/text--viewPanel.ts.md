# text/viewPanel.ts

Generated from web/src/text/viewPanel.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// The view panel beside the conversation (components/ViewPanel.tsx): its
// frame, header, note and the divider between them.
const fi = {
  frame: (title: string) => `Agentin näkymä: ${title}`,
  restoreSplit: "Palauta rinnakkain",
  restoreSplitHint: "Palauta keskustelu näkymän viereen",
  expand: "Näkymä koko ikkunaan",
  close: "Sulje näkymä",
  panel: (title: string) => `Näkymä: ${title}`,
  failed: "Näkymää ei voitu avata. Se on ehkä poistettu, tai yhteys katkesi.",
  opening: "Avataan näkymää…",
  isolated: "Sisältö on erillään Habitatista eikä pääse verkkoon.",
  showConversation: "Näytä keskustelu",
  showConversationHint: "Näytä keskustelu näkymän vieressä",
  conversation: "Keskustelu",
  width: "Näkymän leveys",
  pixels: (n: number) => `${n} pikseliä`,
  dragHint: "Vedä leveyttä. Nuolet muuttavat, kaksoisnapsautus palauttaa.",
};

export const viewPanelText = catalog(fi, {
  frame: (title) => `Agent's view: ${title}`,
  restoreSplit: "Restore side by side",
  restoreSplitHint: "Put the conversation back beside the view",
  expand: "View in the full window",
  close: "Close view",
  panel: (title) => `View: ${title}`,
  failed:
    "The view could not be opened. It may have been removed, or the connection was lost.",
  opening: "Opening the view…",
  isolated:
    "The content is kept apart from Habitat and cannot reach the network.",
  showConversation: "Show conversation",
  showConversationHint: "Show the conversation beside the view",
  conversation: "Conversation",
  width: "View width",
  pixels: (n) => `${n} pixels`,
  dragHint: "Drag to resize. The arrow keys adjust, a double click resets.",
});

```
