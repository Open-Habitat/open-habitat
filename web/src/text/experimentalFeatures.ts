import { altKey } from "../components/altKey";
import { catalog } from "../i18n";

// Settings › Kokeelliset ominaisuudet (components/ExperimentalFeatures.tsx):
// each feature's card by its id, the pictures' sample texts and the frame.
const fi = {
  features: {
    "composer-lists-in-field": {
      name: "Listat kirjoituskentän sisällä",
      desc: "Tiedosto, Komennot ja kirjoitettu @ avautuvat kentän sisään. Tiedostoja selataan kansiopuuna, muutetut näkyvät paikallaan, ja useamman voi merkitä kerralla.",
      where:
        "Keskustelun kirjoituskentässä Tiedosto- ja Komennot-napeista, kirjoitetusta @- ja /-merkistä sekä Ctrl/⌘+P:llä.",
      shows:
        "Kansiopuun, jossa muutoksia sisältävät kansiot ovat auki, haun nimi ensin ja kansio perässä sekä tietokoneella valitun rivin esikatselun listan vieressä.",
      needs: "Ei muuta.",
      caption: "Kirjoituskenttä",
    },
    "empty-conversation-start-page": {
      name: "Aloitussivupainike keskustelussa",
      desc: "Tyhjän keskustelun painike valmistelee aloitussivupyynnön viestikenttään. Lähetät sen itse.",
      where: "Uudessa keskustelussa, kun työtilalla ei ole aloitussivua.",
      shows: "Lyhyt esittely ja Luo aloitussivu -painike.",
      needs: "Ei muuta. Voit lisätä omat ohjeesi ennen lähettämistä.",
      caption: "Luo aloitussivu",
    },
    "server-settings-own-area": {
      name: "Palvelimen asetukset omana alueena",
      desc: "Palvelimen ylläpidossa näkyvät vain palvelimen osiot. Omiin asetuksiin pääsee paluulinkistä.",
      where: "Asetuksissa ja tilivalikon Palvelimen ylläpito -kohdassa.",
      shows:
        "Lyhyt osiolista tietokoneella, vieritettävä välilehtirivi puhelimessa.",
      needs: "Ylläpito-oikeus. Omat asetukset eivät muutu.",
      caption: "Palvelimen ylläpito",
    },
    "next-waiting-row": {
      name: "Seuraava odottava keskustelu",
      desc: "Kun viestisi on otettu vastaan, voit avata seuraavan sinua odottavan keskustelun agentin vuoron ajaksi.",
      where:
        "Keskustelun alareunassa, kirjoituskentän yläpuolella. Rivi katoaa, kun agentti valmistuu tai kysyy tai poistut keskustelusta.",
      shows: `Montako odottaa ja Avaa seuraava (${altKey("↓")}). Lista seuraa sivupalkkia. Seuraavassa keskustelussa rivi tulee vasta omasta lähetyksestäsi.`,
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
    "raise-to-your-turn": {
      name: "Nosta ja Ei nyt",
      desc: "Keskustelu pysyy Sinun vuorosissa, kunnes vastaat tai painat Ei nyt; pelkkä avaaminen ei enää siirrä sitä Hiljaisiin. Hiljaisen keskustelun voit nostaa takaisin Sinun vuoroosi.",
      where:
        "Kirjoituskentän rivillä Sanele-painikkeen vasemmalla puolella, kun agentti ei työskentele, sekä sivupalkin Hiljaiset-rivillä.",
      shows:
        "Nosta, Ei nyt tai nostetussa oranssi Sinun vuorossasi ✕. Luettu vastaus näkyy renkaana ja nostettu nuolena.",
      needs:
        "Ei muuta. Nosto ja Ei nyt tallentuvat tilillesi ja näkyvät kaikilla laitteillasi.",
      caption: "Kirjoituskentän rivi",
    },
  },
  picture: {
    waiting: "3 odottaa sinua",
    waitingWhy: "Kuvien pakkaus, …",
    goThrough: "Avaa seuraava",
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
    raise: "Nosta",
    notNow: "Ei nyt",
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
    "composer-lists-in-field": {
      name: "Lists inside the message field",
      desc: "File, Commands and a typed @ open inside the field. Files are browsed as a folder tree, changed files show in place, and several can be marked at once.",
      where:
        "In a conversation's message field, from the File and Commands buttons, a typed @ or / and Ctrl/⌘+P.",
      shows:
        "A folder tree with the folders that hold changes open, a search with the name first and its folder after, and on a computer the selected row's preview beside the list.",
      needs: "Nothing else.",
      caption: "Message field",
    },
    "empty-conversation-start-page": {
      name: "Start-page button in conversations",
      desc: "A button in an empty conversation prepares a start-page request in the message field. You send it yourself.",
      where: "In a new conversation when the workspace has no start page.",
      shows: "A short introduction and a Create start page button.",
      needs: "Nothing else. You can add instructions before sending.",
      caption: "Create start page",
    },
    "server-settings-own-area": {
      name: "Server settings in their own area",
      desc: "Server administration shows only server sections. A back link takes you to your own settings.",
      where: "In Settings and the account menu's Server administration entry.",
      shows:
        "A short section list on desktop and a scrollable tab row on phones.",
      needs: "Administrator access. Personal settings stay unchanged.",
      caption: "Server administration",
    },
    "next-waiting-row": {
      name: "Next waiting conversation",
      desc: "Once your message is accepted, you can open the next conversation waiting for you during the agent's turn.",
      where:
        "At the bottom of the conversation, above the message field. The row disappears when the agent finishes or asks, or you leave the conversation.",
      shows: `How many are waiting and Open next (${altKey("↓")}). The list follows the sidebar. In the next conversation the row appears only after you send there.`,
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
    "raise-to-your-turn": {
      name: "Raise and Not now",
      desc: "A conversation stays in Your turn until you reply or press Not now; opening it no longer moves it to Quiet. You can raise a quiet conversation back to Your turn.",
      where:
        "On the message field's row, left of Dictate, while the agent is not working, and on the rail's Quiet rows.",
      shows:
        "Raise, Not now or, once raised, an orange Your turn ✕. A read reply shows as a ring and a raised conversation as an arrow.",
      needs:
        "Nothing else. Raise and Not now are saved to your account and show on all your devices.",
      caption: "Message field row",
    },
  },
  picture: {
    waiting: "3 waiting for you",
    waitingWhy: "Image compression, …",
    goThrough: "Open next",
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
    raise: "Raise",
    notNow: "Not now",
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
