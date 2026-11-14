import { altKey } from "../components/altKey";
import { catalog } from "../i18n";

// Settings › Kokeelliset ominaisuudet (components/ExperimentalFeatures.tsx):
// each feature's card by its id, the pictures' sample texts and the frame.
const fi = {
  features: {
    "shares-page": {
      name: "Jaetut",
      desc: "Näkymien ja tiedostojen osoitteet omalla sivulla keskusteluittain.",
      where:
        "Sivupalkissa Etusivun alla. Osoitteet siirtyvät pois Tili-sivulta.",
      shows:
        "Keskustelut uusimman toiminnan mukaan, niiden jaot ja valitun jaon sisältö. Voit kopioida osoitteen, vaihtaa julkisuuden kestoa tai poistaa osoitteen.",
      needs: "Ei muuta. Nykyiset jaot säilyvät.",
      caption: "Jaetut",
    },
    "atlassian-connect": {
      name: "Jira ja Confluence",
      desc: "Yhdistä oma Atlassian-tilisi agenttien käyttöön. Valitse pyydettävät luku- tai muokkausoikeudet ja tarkista myönnetty lupa kirjautumisen jälkeen.",
      where: "Asetukset › Integraatiot.",
      shows: "Jira ja Confluence sekä Pi:n tallentamat myönnetyt oikeudet.",
      needs:
        "Atlassian-tili ja tarvittaessa organisaation ylläpitäjän hyväksyntä. Habitat ei lähetä hyväksyntäpyyntöä.",
      caption: "Atlassian",
    },
    "trello-connect": {
      name: "Trello",
      desc: "Yhdistä Trello agenttien käyttöön Trellon omalla MCP-palvelimella. Voit lisätä useita yhteyksiä, esimerkiksi yhden Workspacea kohden. Kortti näyttää myönnetyn luvan.",
      where: "Asetukset › Integraatiot.",
      shows: "Trello-yhteydet ja Pi:n tallentamat myönnetyt oikeudet kustakin.",
      needs:
        "Atlassian-tili, jolla pääset Trelloon, ja tarvittaessa organisaation ylläpitäjän hyväksyntä. Habitat ei lähetä hyväksyntäpyyntöä.",
      caption: "Trello",
    },
    "agent-resources-view": {
      name: "Agentin käytössä",
      desc: "Yksi näkymä kaikesta, mitä agenttisi käyttävät: tiedostot, posti, kalenteri, yhteystiedot, koodi ja koneet. Jokainen lähde kertoo, mikä on mukana ja mikä ei ja mitä agentti saa tehdä.",
      where:
        "Sivupalkissa Etusivun alla. Lähteestä pääset sen asetuksiin, ja yhdistämättömät palvelut voi yhdistää listasta.",
      shows:
        "Lajeittain kaikkien tiliesi lähteet tasoineen. Synkronoituja kansioita voit selata, joten myös agentin luomat tiedostot näkyvät. Postia, kalenteria ja yhteystietoja ei avata täällä.",
      needs: "Ei muuta. Näkymä lukee vain sen, mikä on jo yhdistetty.",
      caption: "Agentin käytössä",
    },
    "explain-mode": {
      name: "Selitystila",
      desc: "Himmentää näytön ja selittää kohdan, jonka päällä osoitin on: mitä se tekee ja mitä siitä kannattaa tietää. Keskustelussa tila kertoo ensin keskustelun tilanteen ja sen, mitä voit nyt tehdä.",
      where:
        "Keskustelun yläpalkin ?-painikkeesta, Tilivalikon Selitä tämä näkymä -riviltä ja uuden keskustelun aloitussivun nauhasta. Puhelimella myös ⋯-valikosta.",
      shows:
        "Kortin osoittimen vieressä; puhelimella ensimmäinen napautus selittää ja toinen tekee. Painallukset toimivat kuten aina, mutta arkistointi, poisto, lähettäminen ja pysäyttäminen odottavat, kunnes lopetat tilan Esc:llä tai Lopeta-painikkeella.",
      needs: "Ei muuta.",
      caption: "Selitystila",
    },
    "rewind-conversation": {
      name: "Palaa tähän",
      desc: "Palaa aiempaan viestiisi samassa keskustelussa. Voit palauttaa myös tiedostot, joita agentti muutti sen jälkeen, tai pelkät tiedostot.",
      where:
        "Oman viestisi ⋯-valikossa. Vahvistus avautuu kirjoituskentän yläpuolelle, ja viestisi palaa kenttään muutettavaksi.",
      shows:
        "Mitä jää sivuun ja mitkä tiedostot palautuvat. Korvattu jatko jää keskusteluun riviksi, josta voit avata sen tai jatkaa siitä tiedostoineen.",
      needs:
        "Tiedostot palautuvat viesteistä, jotka lähetit ominaisuuden ollessa päällä. Agentin muokkaamien tiedostojen kaikki myöhemmät muutokset korvataan, myös omasi. Nykyinen sisältö tallennetaan ensin, jotta voit perua palautuksen. Vain komennoilla muutetut tiedostot jäävät ennalleen. Kopiot tiedostoista jäävät omalle tilillesi.",
      caption: "Oman viestin valikko",
    },
    "remote-browser": {
      name: "Oma palvelinselain",
      desc: "Oma Chrome-selain palvelimella. Kirjaudut sillä palveluun, ja agentti käyttää samaa kirjautunutta selainta. Näet livenä, mitä agentti tekee, ja otat ohjauksen, kun ikkuna tarvitsee sinua.",
      where:
        "Keskustelun kirjoituskentän yllä Selain-sirussa, josta aukeaa palkki ikkunoiden kuvineen, ja sivupalkin ylimpänä rivinä.",
      shows:
        "Ikkunat pieninä kuvina, agentin osoittimen ja klikkaukset. Ikkuna, joka tarvitsee sinua, nousee isoksi pyyntönsä viereen. Katselu ei vie ohjausta agentilta.",
      needs:
        "Palvelimen, jolle selain on asennettu. Agentti toimii selaimessa sinun tunnuksillasi: se saa käyttää kaikkea, mihin selain on kirjautunut. Selain sulkeutuu vuorokauden käyttämättömyyden jälkeen, ja kirjautumiset säilyvät.",
      caption: "Selain kentän yllä",
    },
    "conversation-context-view": {
      name: "Kontekstinäkymä ja tiivistys",
      desc: "Konteksti-sivu näyttää, mihin keskustelun konteksti kuluu: tiedostot, komennot ja tulosteet, jotka agentti näkee nyt, ja ne, jotka ovat enää vain yhteenvedossa. Keskustelun voi tiivistää heti omalla ohjeella.",
      where:
        "Keskustelun kontekstirenkaasta avautuvalla Konteksti-sivulla. Tiedoston nimestä tiedosto avautuu editoriin keskustelun viereen.",
      shows:
        "Kuinka täynnä konteksti on, listan suurimmasta pienimpään ja suodattimen Vain tiedostot. Tiivistyksen vahvistus kertoo kellonajoin, mitkä viestit tiivistyvät ja mitkä jäävät.",
      needs:
        "Tiivistää voi, kun agentti odottaa viestiä. Pi:n tekniset luvut (osat, tiivistykset ja vuorot) jäävät pois sivulta, kun ominaisuus on päällä.",
      caption: "Konteksti-sivu",
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
    "named-workers": {
      name: "Avustajat",
      desc: "Avustaja on nimetty worker, joka tekee työnsä kierroksina: se raportoi kierroksen, jää odottamaan ja jatkaa samasta keskustelusta, kun pääagentti lähettää sille seuraavan viestin.",
      where:
        "Kirjoituskentän yläpuolella Workerit-pallon vieressä Avustajat-sirussa. Siru avaa avustajien listan, ja rivistä aukeaa avustajan oma keskustelu.",
      shows:
        "Jokaisen avustajan kierrokset ja tilan: tekee kierrosta, odottaa pääagenttia, lepää tai uusi raportti, jota et ole vielä avannut. Avustajan raportti herättää pysähtyneen pääkeskustelun. Arkistoitaessa avustajat arkistoituvat keskustelun mukana.",
      needs:
        "Taskfleet, jossa on nimetyt workerit (run create --resident). Pyydä agenttia tekemään avustaja; se saa ohjeen, kun keskustelu seuraavan kerran käynnistyy. Avustajalle et kirjoita itse: viestit, kierrosten yhdistäminen ja lopetus kulkevat pääagentin kautta. Keskustelu näkee vain omat avustajansa.",
      caption: "Avustajat",
    },
    "turn-changes": {
      name: "Vuoron muutokset",
      desc: "Valmiin vuoron vastauksen alla yksi rivi: mitä tiedostoja agentti muutti ja montako riviä. Rivi avaa listan samaan kohtaan, ja tiedosto avaa koko muutoksensa.",
      where:
        "Keskustelussa jokaisen valmiin vuoron vastauksen alla, jos vuoro muutti tiedostoja. Aikajana-painike näyttää samat muutokset vuoron kellolla.",
      shows:
        "Muutetut tiedostot vuoron järjestyksessä, rivimäärät ja merkinnät kirjoitettu, poistettu ja komennolla. Avaa editorissa vie ensimmäiseen muuttuneeseen riviin, kun se tiedetään.",
      needs:
        "Ei muuta. Tieto tulee agentin työkalukutsuista: komennon muuttama tiedosto näkyy vain, jos komento nimeää sen, ja muokkauksen rivi tiedetään vain, jos agentti luki tiedoston ensin.",
      caption: "Muutokset",
    },
    "terminal-copy-on-select": {
      name: "Päätteen kopiointi valitsemalla",
      desc: "Päätteessä valittu teksti menee leikepöydälle heti, kun päästät hiiren irti, kuten monessa päätteessä.",
      where:
        "Päätepaneelissa. Valinnan Kopioi-painike muuttuu Kopioiduksi, kun teksti on leikepöydällä.",
      shows:
        "Shift pohjassa vedetty valinta ja tmuxin oma hiirivalinta kopioituvat. Ctrl+Shift+C ja valinnan Kopioi-painike kopioivat myös silloin, kun tämä on pois päältä.",
      needs:
        "Selaimen luvan kirjoittaa leikepöydälle. Jos selain kieltää sen, valinta jää näkyviin ja Kopioi-painike toimii.",
      caption: "Pääte",
    },
    "terminal-open-urls": {
      name: "Päätteen osoitteet selaimeen",
      desc: "Kun päätteen ohjelma yrittää avata verkko-osoitteen selaimessa, esimerkiksi gh auth login, Habitat näyttää osoitteen ja avaa sen uuteen välilehteen, kun painat.",
      where:
        "Päätepaneelin alareunassa kortissa, jossa näkyy, mihin osoite vie, ja painikkeet Avaa uuteen välilehteen ja Ohita.",
      shows:
        "Vain http- ja https-osoitteet. Mitään ei avata ilman painallustasi, ja osoite tulostuu myös päätteeseen.",
      needs:
        "Päätteen, jonka Habitat on avannut tämän päivityksen jälkeen. Ohjelman täytyy käyttää selaimen avaamiseen BROWSER-muuttujaa tai xdg-openia.",
      caption: "Pääte",
    },
    "storage-breakdown": {
      name: "Tallennustilan erittely",
      desc: "Tallennustila kertoo arkikielellä, mikä tilasi täyttää ja mitä voi vapauttaa: työkalujen välimuistit, valmiiden töiden käännöstiedostot ja omien projektien käännöstiedostot. Valitse siivottavat, ja agentti siivoaa ne pyynnöstäsi.",
      where:
        "Asetukset › Tallennustila, käyttöpalkin paikalla. Yli 85 %:n varoitus johtaa sinne.",
      shows:
        "Palkin, joka näyttää valinnan vaikutuksen rajaan ja 85 %:n varoitusrajaan, ryhmät kokoineen ja Näytä tarkemmin -kohdan takana kansiot polkuineen. Agentin käynnissä olevien töiden tiedostoja ei voi valita. Painike avaa uuden keskustelun, jonka kentässä on valinnasta koottu siivouspyyntö; se lähtee vasta, kun lähetät sen.",
      needs:
        "Ei muuta. Ensimmäinen mittaus voi kestää minuutin, ja tulos mitataan uudelleen, kun se on yli 15 minuuttia vanha.",
      caption: "Tallennustila",
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
    browser: "Selain",
    browserWaits: "Netvisor odottaa sinua",
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
    "shares-page": {
      name: "Shares",
      desc: "View and file addresses on their own page, grouped by conversation.",
      where:
        "In the sidebar below Home. Addresses move out of the Account page.",
      shows:
        "Conversations by latest activity, their shares and the selected item's content. Copy an address, change its publication duration or delete its address.",
      needs: "Nothing else. Existing shares stay as they are.",
      caption: "Shares",
    },
    "atlassian-connect": {
      name: "Jira and Confluence",
      desc: "Connect your Atlassian account for agents. Choose requested read or write permissions and check the actual grant after sign-in.",
      where: "Settings › Integrations.",
      shows: "Jira and Confluence and the granted scopes stored by Pi.",
      needs:
        "An Atlassian account and, where required, administrator approval. Habitat sends no approval request.",
      caption: "Atlassian",
    },
    "trello-connect": {
      name: "Trello",
      desc: "Connect Trello for agents through Trello's own MCP server. You can add several connections, for example one per Workspace. The card shows the actual grant.",
      where: "Settings › Integrations.",
      shows:
        "Your Trello connections and the granted scopes Pi stored for each.",
      needs:
        "An Atlassian account with Trello access and, where required, administrator approval. Habitat sends no approval request.",
      caption: "Trello",
    },
    "agent-resources-view": {
      name: "Agent resources",
      desc: "One view of everything your agents use: files, mail, calendar, contacts, code and machines. Each source tells what is included, what is not and what the agent may do.",
      where:
        "In the sidebar under Home. A source leads to its settings, and services not yet connected can be connected from the list.",
      shows:
        "Every account's sources by kind, with their levels. You can browse the synced folders, so files the agent creates show too. Mail, calendars and contacts are not opened here.",
      needs: "Nothing else. The view reads only what is already connected.",
      caption: "Agent resources",
    },
    "explain-mode": {
      name: "Explain mode",
      desc: "Dims the screen and explains the part under the pointer: what it does and what is worth knowing about it. In a conversation the mode first tells where the conversation stands and what you can do now.",
      where:
        "From the ? in the conversation's top bar, the account menu's Explain this view and the strip on a new conversation's start page. On a phone also from ⋯.",
      shows:
        "A card beside the pointer; on a phone the first tap explains and a second one does it. Presses work as always, but archiving, deleting, sending and stopping wait until you end the mode with Esc or Stop.",
      needs: "Nothing else.",
      caption: "Explain mode",
    },
    "rewind-conversation": {
      name: "Go back here",
      desc: "Go back to an earlier message of yours in the same conversation. You can also restore the files the agent changed after it, or the files alone.",
      where:
        "In your own message's ⋯ menu. The confirmation opens above the message field, and your message goes back into the field to edit.",
      shows:
        "What is set aside and which files are restored. The replaced continuation stays in the conversation as a row you can open or continue from, with its files.",
      needs:
        "Files are restored for messages you sent while the feature was on. All later changes to files the agent edited are replaced, including your own. The current contents are saved first so you can undo the restore. Files changed only by commands stay as they are. Copies of the files stay in your own account.",
      caption: "Your message's menu",
    },
    "remote-browser": {
      name: "Your own server browser",
      desc: "Your own Chrome on the server. You sign in to a service with it, and the agent uses the same signed-in browser. You see live what the agent does and take control when a window needs you.",
      where:
        "Above the conversation's message field in the Browser chip, which opens a strip with pictures of the windows, and as the top row of the sidebar.",
      shows:
        "The windows as small pictures, the agent's pointer and clicks. A window that needs you grows large beside its request. Watching never takes control from the agent.",
      needs:
        "A server with the browser installed. The agent may use everything the browser is signed in to, in your name. The browser closes after a day unused, and sign-ins are kept.",
      caption: "Browser above the field",
    },
    "conversation-context-view": {
      name: "Context view and compaction",
      desc: "The Context page shows what fills the conversation's context: the files, commands and outputs the agent sees now, and those that are only in a summary. You can compact the conversation right away with your own instruction.",
      where:
        "On the Context page that opens from the conversation's context ring. A file's name opens it in the editor beside the conversation.",
      shows:
        "How full the context is, a list from the largest to the smallest and a Files only filter. The compaction confirmation tells by clock time which messages are summarized and which stay.",
      needs:
        "You can compact while the agent waits for a message. Pi's technical figures (parts, compactions and turns) are left off the page while the feature is on.",
      caption: "Context page",
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
    "named-workers": {
      name: "Helpers",
      desc: "A helper is a named worker that works in rounds: it reports a round, waits, and continues the same conversation when the main agent sends it the next message.",
      where:
        "Above the message field, in the Helpers chip beside the Workers pill. The chip opens the list of helpers, and a row opens the helper's own conversation.",
      shows:
        "Each helper's rounds and state: working on a round, waiting for the main agent, resting, or a new report you have not opened yet. A helper's report wakes a stopped main conversation. Archiving a conversation archives its helpers with it.",
      needs:
        "A Taskfleet with named workers (run create --resident). Ask the agent to make a helper; it learns how the next time the conversation starts. You do not write to a helper yourself: messages, landing rounds and stopping go through the main agent. A conversation sees only its own helpers.",
      caption: "Helpers",
    },
    "turn-changes": {
      name: "Turn changes",
      desc: "One line under a finished turn's reply: which files the agent changed and by how many lines. The line opens the list in place, and a file opens its whole change.",
      where:
        "In the conversation under each finished turn's reply, when the turn changed files. The Timeline button shows the same changes on the turn's clock.",
      shows:
        "The changed files in the turn's order, line counts and the tags written, deleted and by command. Open in editor goes to the first changed line when it is known.",
      needs:
        "Nothing else. It comes from the agent's tool calls: a file a command changed shows only when the command names it, and an edit's line is known only when the agent read the file first.",
      caption: "Changes",
    },
    "terminal-copy-on-select": {
      name: "Copy on select in the terminal",
      desc: "Text you select in the terminal goes to the clipboard as soon as you let go of the mouse, as in many terminals.",
      where:
        "In the terminal panel. The selection's Copy button turns into Copied once the text is on the clipboard.",
      shows:
        "A selection dragged with Shift held and tmux's own mouse selection are copied. Ctrl+Shift+C and the selection's Copy button copy even when this is off.",
      needs:
        "The browser's permission to write to the clipboard. If the browser refuses, the selection stays and the Copy button works.",
      caption: "Terminal",
    },
    "terminal-open-urls": {
      name: "Terminal addresses in the browser",
      desc: "When a program in the terminal tries to open a web address in a browser, gh auth login for example, Habitat shows the address and opens it in a new tab when you press.",
      where:
        "At the bottom of the terminal panel, in a card that shows where the address leads, with the buttons Open in a new tab and Dismiss.",
      shows:
        "Only http and https addresses. Nothing opens without your press, and the address is also printed in the terminal.",
      needs:
        "A terminal Habitat opened after this update. The program has to open the browser through the BROWSER variable or xdg-open.",
      caption: "Terminal",
    },
    "storage-breakdown": {
      name: "Storage breakdown",
      desc: "Storage says in plain language what fills your space and what can be freed: tools' caches, build files from finished work and build files in your projects. Choose what to clean up, and an agent does it at your request.",
      where:
        "Settings › Storage, in place of the usage bar. The warning from 85 % leads there.",
      shows:
        "A bar showing what the selection does against the limit and the 85 % warning line, the groups with their sizes and, behind Show details, the folders with their paths. Files of the agent's work in progress cannot be selected. The button opens a new conversation with a clean-up request built from the selection in its field; it goes only when you send it.",
      needs:
        "Nothing else. The first measurement can take a minute, and the result is measured again when it is over 15 minutes old.",
      caption: "Storage",
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
    browser: "Browser",
    browserWaits: "Netvisor is waiting for you",
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
