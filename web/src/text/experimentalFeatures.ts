import { altKey } from "../components/altKey";
import { catalog } from "../i18n";

// Settings › Kokeelliset ominaisuudet (components/ExperimentalFeatures.tsx):
// each feature's card by its id, the pictures' sample texts and the frame.
const fi = {
  features: {
    "next-waiting-row": {
      name: "Seuraava odottava keskustelu",
      desc: "Kun olet vastannut ja agentti on aloittanut, voit käydä sinua odottavat keskustelut läpi yhtenä kierroksena.",
      where:
        "Keskustelun alareunassa, kirjoituskentän yläpuolella. Kierroksen ajan jono näkyy jokaisessa keskustelussa.",
      shows: `Montako odottaa ja Käy läpi (${altKey("↓")}). Kierroksella koko jonon: Seuraava (${altKey("↓")}), Edellinen (${altKey("↑")}) ja ✕ (Esc).`,
      needs: "Ei muuta. Järjestys seuraa toistaiseksi sivupalkkia.",
      caption: "Keskustelun alareuna",
    },
    "worker-row-sentence": {
      name: "Workerin työ rivillä",
      desc: "Workerin rivi kertoo sanoin, onko se jo tehnyt jotain: commitit, muutokset ja pull requestin tarkistukset.",
      where:
        "Workerit-paneelin riveillä ja workerin näkymässä. Sivupalkin worktree-keskustelut kertovat commitit ja muutokset ilman PR:ää.",
      shows:
        "”2 committia · 3 muutosta”, ”PR #412 luonnos, tarkistukset käynnissä” tai ”ei vielä muutoksia”.",
      needs: "PR-tiedot näkyvät, kun gh on kirjautunut (Koodipalvelut).",
      caption: "Workerit-paneeli",
    },
    "workspace-icons": {
      name: "Työtilan kuvake",
      desc: "Sivupalkin keskustelujen edessä on niiden työtilan kuvake, joten Käynnissä ei enää toista työtilan nimeä otsikkona. Kuvake vaihdetaan työtilan sivun otsikosta, ja mallisi ehdottaa kuvaketta työtilalle, jolla sitä ei vielä ole.",
      where:
        "Sivupalkin Sinun vuorosi-, Käynnissä- ja Työtilat-riveillä sekä kapeassa kaistaleessa editorin vieressä. Kuvakkeesta aukeaa kortti: koko nimi, kuvakkeen lähde, työtilasivu ja uusi keskustelu. Työtilan sivulla otsikon kuvake avaa valitsimen.",
      shows:
        "Repon .open-habitat.yaml-tiedoston icon-kentän hymiön, kirjaimet tai kuvan, muuten repon logon (esimerkiksi favicon.svg), muuten nimestä johdetun kirjaintunnuksen.",
      needs:
        "Valinta kirjoitetaan repon juuren .open-habitat.yaml-tiedostoon ja commitoidaan saman tien, vain se tiedosto eikä pushia. Commit tarvitsee Git-identiteetin. Ehdotukset tekee oma mallisi (API-avain tai tilaus, myös pelkkä Claude-tilaus), ja se näkee vain nimen, README:n alun, aloitussivun, kielet ja logon polun; icon: auto lopettaa ehdotukset.",
      caption: "Sivupalkki",
    },
  },
  picture: {
    waiting: "3 odottaa sinua",
    waitingWhy: "Kuvien pakkaus, …",
    goThrough: "Käy läpi",
    composer: "Kirjoita agentille…",
    iconRows: "Ikoniprototyypin suunnat",
    railIcons: "Rail-ikonit",
    pilot: "pilot.16 testipalvelimelle",
    now: "nyt",
    minutes: (n: number) => `${n} min`,
    weather: "Sääaseman CSV-vienti",
    agentWaits: "agentti odottaa",
    commits: "2 committia · 3 muutosta",
    oldApi: "Vanhan rajapinnan poisto",
    agentNotWaiting: "agentti ei odota",
    noChanges: "ei vielä muutoksia",
  },
  reload: "Lue tallennettu valinta",
  intro:
    "Keskeneräisiä ominaisuuksia, joita voit kokeilla jo nyt. Ne voivat vielä muuttua tai poistua. Valinnat tallentuvat tilillesi ja koskevat kaikkia laitteitasi.",
  readError: "Valintoja ei voitu lukea. Lue tallennettu valinta uudelleen.",
  off: "Pois",
  on: "Päällä",
  writeError:
    "Valintaa ei voitu tallentaa. Lue tallennettu valinta ennen uutta yritystä.",
  where: "Missä",
  shows: "Mitä näkyy",
  needs: "Edellyttää",
  coming:
    "Tulossa. Tämä versio ei vielä näytä ominaisuutta; valintasi tulee voimaan, kun se on valmis.",
};

export const experimentalFeaturesText = catalog(fi, {
  features: {
    "next-waiting-row": {
      name: "Next waiting conversation",
      desc: "Once you have replied and the agent has started, you can go through the conversations waiting for you in one round.",
      where:
        "At the bottom of the conversation, above the message field. During the round the queue shows in every conversation.",
      shows: `How many are waiting and Go through (${altKey("↓")}). During the round, the whole queue: Next (${altKey("↓")}), Previous (${altKey("↑")}) and ✕ (Esc).`,
      needs: "Nothing else. For now the order follows the sidebar.",
      caption: "Bottom of the conversation",
    },
    "worker-row-sentence": {
      name: "Worker's work on its row",
      desc: "A worker's row says in words whether it has already done something: commits, changes and pull request checks.",
      where:
        "On the rows of the Workers panel and in the worker's view. Worktree conversations in the sidebar tell commits and changes without a PR.",
      shows:
        "“2 commits · 3 changes”, “PR #412 draft, checks running” or “no changes yet”.",
      needs: "PR details show when gh is signed in (Code hosts).",
      caption: "Workers panel",
    },
    "workspace-icons": {
      name: "Workspace icon",
      desc: "Conversations in the sidebar carry their workspace's icon, so Running no longer repeats the workspace's name as a heading. The icon is changed from the workspace page's title, and your model suggests an icon for a workspace that has none yet.",
      where:
        "On the sidebar's Your turn, Running and Workspaces rows and in the narrow strip beside the editor. The icon opens a card: the full name, the icon's source, the workspace page and a new conversation. On the workspace page the title's icon opens the picker.",
      shows:
        "The emoji, letters or image of the icon field in the repository's .open-habitat.yaml, else the repository's logo (for example favicon.svg), else a letter mark made from the name.",
      needs:
        "The choice is written to .open-habitat.yaml at the repository's root and committed at once, only that file and no push. The commit needs a Git identity. Suggestions come from your own model (an API key or a subscription, a Claude subscription alone too), and it sees only the name, the beginning of the README, the start page, the languages and the logo's path; icon: auto stops the suggestions.",
      caption: "Sidebar",
    },
  },
  picture: {
    waiting: "3 waiting for you",
    waitingWhy: "Image compression, …",
    goThrough: "Go through",
    composer: "Write to the agent…",
    iconRows: "Directions for the icon prototype",
    railIcons: "Rail icons",
    pilot: "pilot.16 to the test server",
    now: "now",
    minutes: (n) => `${n} min`,
    weather: "Weather station CSV export",
    agentWaits: "agent waiting",
    commits: "2 commits · 3 changes",
    oldApi: "Removing the old interface",
    agentNotWaiting: "agent not waiting",
    noChanges: "no changes yet",
  },
  reload: "Read the saved choice",
  intro:
    "Unfinished features you can already try. They may still change or go away. The choices are saved to your account and apply to all your devices.",
  readError: "The choices could not be read. Read the saved choice again.",
  off: "Off",
  on: "On",
  writeError:
    "The choice could not be saved. Read the saved choice before trying again.",
  where: "Where",
  shows: "What shows",
  needs: "Needs",
  coming:
    "Coming. This version does not show the feature yet; your choice takes effect when it is ready.",
});
