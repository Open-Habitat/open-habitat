# text/editorContentPreview.ts

Generated from web/src/text/editorContentPreview.ts; do not edit.

```tsx
import { catalog } from "../i18n";

const fi = {
  startPage: "Aloitussivu",
  plain: "Näytä tavallisena asiakirjana",
  special: "Näytä aloitussivuna",
  checking: "Tarkistetaan aloitussivua…",
  unavailable:
    "Aloitussivua ei voitu tarkistaa. Näytetään tavallinen esikatselu.",
  declined: "Tätä aloitussivua ei voi näyttää sivuna. Korjaa seuraava kohta:",
  valid: "Sisältö on kelvollinen aloitussivu",
  guides: "Tavoitteiden ohjeet",
  goalHint: "Valitse tavoite nähdäksesi sen ohjeen alla.",
  when: "Milloin",
  what: "Mitä tehdään",
  steps: "Vaiheet",
  prompt: "Aloituspyyntö",
  skill: "Taito",
  name: "Keskustelun nimi",
  immediate: "Pyyntö lähetetään heti",
  problems: {
    too_large: "Aloitussivu ylittää 32 KiB:n kokorajan.",
    invalid_utf8: "Sisällön merkistössä on virhe.",
    missing_frontmatter:
      "Sivun alusta puuttuvat tiedot rajaava --- ja sivun tiedot.",
    missing_frontmatter_end: "Sivun tietojen lopusta puuttuu ---.",
    invalid_frontmatter:
      "Sivun tiedoissa on tuntematon kenttä tai virheellinen rakenne tai arvo.",
    invalid_page_fields:
      "Sivun tieto puuttuu tai ylittää sallitun pituuden tai määrän.",
    invalid_goal_fields:
      "Tavoitteen tieto puuttuu tai sen arvo, pituus tai määrä ei ole sallittu.",
    invalid_step: "Vaihe on tyhjä tai yli 1024 tavua pitkä.",
    invalid_skill: "Taidon nimi ei ole sallittu.",
  },
};
export const editorContentPreviewText = catalog(fi, {
  startPage: "Start page",
  plain: "Show as a plain document",
  special: "Show as a start page",
  checking: "Checking the start page…",
  unavailable:
    "The start page could not be checked. Showing the plain preview.",
  declined: "This start page cannot be shown as a page. Correct this field:",
  valid: "Content is valid as a start page",
  guides: "Goal guides",
  goalHint: "Choose a goal to see its guide below.",
  when: "When",
  what: "What happens",
  steps: "Steps",
  prompt: "Starting request",
  skill: "Skill",
  name: "Conversation name",
  immediate: "The request is sent immediately",
  problems: {
    too_large: "The start page exceeds the 32 KiB size limit.",
    invalid_utf8: "The content has an encoding error.",
    missing_frontmatter:
      "The page is missing its opening --- and page details.",
    missing_frontmatter_end: "The page details are missing their closing ---.",
    invalid_frontmatter:
      "The page details contain an unknown field or an invalid structure or value.",
    invalid_page_fields:
      "A page field is missing or exceeds its length or count limit.",
    invalid_goal_fields:
      "A goal field is missing or its value, length or count is not allowed.",
    invalid_step: "The step is empty or longer than 1024 bytes.",
    invalid_skill: "The skill name is not allowed.",
  },
});

```
