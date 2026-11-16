// The round's own words, Finnish and English. Production pieces (section
// headings, Hiljaiset, the background-service hint) keep their own catalogs
// and follow the same language choice. Titles, workspaces and commands are
// synthetic.

const fi = {
  title: "Taustatyö Open Habitat -merkissä",
  theme: "Teema",
  themes: { light: "Päivä", dark: "Yö", contrast: "Kontrasti" },
  language: "Kieli",
  motion: "Liike",
  motions: { on: "päällä", off: "vähennetty" },
  lines: [
    "Nyt: merkki näyttää vain keskustelun tilan. Rivin lopun pieni piste kertoo jätetystä palvelusta, kun vastaus on annettu; herättämätön prosessi ei näy missään.",
    "1 Lamppu: merkin oikeassa alakulmassa palaa pieni lamppu aina, kun keskustelulla on prosessi käynnissä, tilasta riippumatta. Lamppu ei liiku, ja rivin lopun piste jää pois.",
    "2 Vaeltava ovi: merkin ovi kiertää hitaasti kuten Odottaa taustatyötä -tilassa, ja väri ja asukas kertovat tilan. Valmiin keskustelun ovi on raollaan eikä kiinni. Piste jää tarkaksi vihjeeksi.",
    "3 Takahuone: merkin taakse piirtyy toinen huone, joka kertoo, että habitaatissa on käynnissä muutakin kuin agentti. Piste jää tarkaksi vihjeeksi.",
  ],
  recommend:
    "Suositus: 1 Lamppu. Se näkyy samana jokaisessa tilassa, myös ilman liikettä, Kontrasti-teemassa ja Hiljaisissa, eikä muuta merkin muotoa, joka jo kertoo tilan. Piste jää pois, koska rivillä olisi muuten kaksi merkkiä samalle asialle.",
  conv: {
    release: "Kevään julkaisu",
    tiles: "Karttatasojen välimuisti",
    bench: "Reittihaun suorituskyky",
    preview: "Etusivun uusi ulkoasu",
    form: "Yhteydenottolomake",
    a11y: "Saavutettavuuskatselmointi",
    report: "Kuukausiraportin ajastus",
    receipts: "Kuittien nimeäminen",
  },
  waitsFor: (name: string) => `Odottaa: ${name}`,
  // The story beside the rail.
  storyHead: "Mitä keskustelujen taustalla on käynnissä",
  storyLead:
    "Agentti voi jättää prosessin käyntiin ja päättää vuoronsa. Jos prosessi herättää agentin päättyessään eikä agentti ole ehtinyt vastata, keskustelu odottaa sitä ja on Käynnissä. Muuten prosessi pyörii, mutta keskustelun paikka sivupalkissa määräytyy vuorosta.",
  procWakes: "herättää agentin päättyessään",
  procQuiet: "ei herätä agenttia (notify: ignore)",
  procDuring: "käynnistetty tämän vuoron aikana",
  waited: "Keskustelu odottaa tätä",
  leftRunning: "Jätetty käyntiin, keskustelu ei odota",
  hostNow: {
    shown: "Host kertoo tämän tänään",
    during: "Host ei kerro tätä vuoron aikana",
    hidden: "Host ei kerro tätä tänään lainkaan",
  },
  events: "Tapahtumat",
  ev: {
    read: "Avaat etusivun vastauksen",
    stop: "Raportin sleep päättyy",
    reset: "Alkutila",
  },
  phoneHead: "Puhelimessa",
  phone: [
    "Puhelimessa ei ole hoveria, joten merkin selitys ei voi olla vain title-tekstissä.",
    "Lampun merkitys opitaan keskustelusta: kirjoituskentän yllä oleva taustatyön merkki käyttää samaa lamppua ja nimeää prosessin. Rivin kuvaus kertoo sen myös ruudunlukijalle.",
    "Vaeltava ovi ei erotu puhelimen pienellä merkillä ilman liikettä; piste tarvitaan, ja sen merkitys opitaan samasta paikasta.",
    "Takahuone on suurin merkki ja erottuu puhelimessa parhaiten, mutta sen merkitys on yhtä lailla opittava keskustelusta.",
  ],
  menuHint: "Puhelimessa sivupalkki aukeaa valikosta.",
};

export type Text = typeof fi;

const en: Text = {
  title: "Background work in the Open Habitat mark",
  theme: "Theme",
  themes: { light: "Day", dark: "Night", contrast: "Contrast" },
  language: "Language",
  motion: "Motion",
  motions: { on: "on", off: "reduced" },
  lines: [
    "Now: the mark shows only the conversation's state. A small dot at the row's end tells of a service left running after the reply; a process that does not wake the agent shows nowhere.",
    "1 Lamp: a small lamp burns at the mark's lower right whenever a process of the conversation runs, whatever the state. The lamp does not move, and the dot at the row's end goes.",
    "2 Wandering door: the mark's door travels slowly, as in Waiting for background work, and colour and resident tell the state. A done conversation's door stands ajar instead of shut. The dot stays as the precise hint.",
    "3 Back room: a second room is drawn behind the mark, saying that more than the agent is running in the habitat. The dot stays as the precise hint.",
  ],
  recommend:
    "Recommendation: 1 Lamp. It looks the same in every state, with reduced motion, in the Contrast theme and in Quiet, and it leaves the mark's shape, which already tells the state, alone. The dot goes, since the row would otherwise carry two signs for one fact.",
  conv: {
    release: "Spring release",
    tiles: "Map tile cache",
    bench: "Route search performance",
    preview: "New front page layout",
    form: "Contact form",
    a11y: "Accessibility review",
    report: "Monthly report schedule",
    receipts: "Receipt naming",
  },
  waitsFor: (name: string) => `Waiting for: ${name}`,
  storyHead: "What runs behind the conversations",
  storyLead:
    "An agent can leave a process running and end its turn. If the process wakes the agent when it ends and the agent has not answered since, the conversation waits for it and is in Running. Otherwise the process runs on, but the conversation's place in the rail follows the turn.",
  procWakes: "wakes the agent when it ends",
  procQuiet: "does not wake the agent (notify: ignore)",
  procDuring: "started during this turn",
  waited: "The conversation waits for this",
  leftRunning: "Left running; the conversation does not wait",
  hostNow: {
    shown: "The host reports this today",
    during: "The host does not report this during a turn",
    hidden: "The host does not report this today at all",
  },
  events: "Events",
  ev: {
    read: "You open the front page reply",
    stop: "The report's sleep ends",
    reset: "Start over",
  },
  phoneHead: "On a phone",
  phone: [
    "A phone has no hover, so the mark cannot be explained by a title alone.",
    "The lamp is learned in the conversation: the background-work mark above the composer uses the same lamp and names the process. The row's description says it to a screen reader too.",
    "Without motion the wandering door does not stand out on a phone's small mark; the dot is needed, and is learned in the same place.",
    "The back room is the largest sign and shows best on a phone, but its meaning still has to be learned in the conversation.",
  ],
  menuHint: "On a phone the rail opens from the menu.",
};

export const TEXT = { fi, en };
