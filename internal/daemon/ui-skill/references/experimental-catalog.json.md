# Experimental feature catalog

Generated from internal/experimental/catalog.json; do not edit.

```json
{
  "features": [
    { "id": "rewind-conversation", "landed": true },
    { "id": "remote-browser", "landed": true },
    { "id": "multiplayer", "landed": true }
  ],
  "fi": {
    "features": {
      "rewind-conversation": {
        "name": "Palaa tähän",
        "desc": "Palaa aiempaan viestiisi samassa keskustelussa. Voit palauttaa myös tiedostot, joita agentti muutti sen jälkeen, tai pelkät tiedostot.",
        "where": "Oman viestisi ⋯-valikossa. Vahvistus avautuu kirjoituskentän yläpuolelle, ja viestisi palaa kenttään muutettavaksi.",
        "shows": "Mitä jää sivuun ja mitkä tiedostot palautuvat. Korvattu jatko jää keskusteluun riviksi, josta voit avata sen tai jatkaa siitä tiedostoineen.",
        "needs": "Tiedostot palautuvat viesteistä, jotka lähetit ominaisuuden ollessa päällä. Agentin muokkaamien tiedostojen kaikki myöhemmät muutokset korvataan, myös omasi. Nykyinen sisältö tallennetaan ensin, jotta voit perua palautuksen. Vain komennoilla muutetut tiedostot jäävät ennalleen. Kopiot tiedostoista jäävät omalle tilillesi.",
        "caption": "Oman viestin valikko"
      },
      "remote-browser": {
        "name": "Oma palvelinselain",
        "desc": "Oma Chrome-selain palvelimella. Kirjaudut sillä palveluun, ja agentti käyttää samaa kirjautunutta selainta. Näet livenä, mitä agentti tekee, ja otat ohjauksen, kun ikkuna tarvitsee sinua.",
        "where": "Keskustelun kirjoituskentän yllä Selain-sirussa, josta aukeaa palkki ikkunoiden kuvineen, ja sivupalkin ylimpänä rivinä.",
        "shows": "Ikkunat pieninä kuvina, agentin osoittimen ja klikkaukset. Ikkuna, joka tarvitsee sinua, nousee isoksi pyyntönsä viereen. Katselu ei vie ohjausta agentilta.",
        "needs": "Palvelimen, jolle selain on asennettu. Agentti toimii selaimessa sinun tunnuksillasi: se saa käyttää kaikkea, mihin selain on kirjautunut. Selain sulkeutuu vuorokauden käyttämättömyyden jälkeen, ja kirjautumiset säilyvät.",
        "caption": "Selain kentän yllä"
      },
      "multiplayer": {
        "name": "Muut ihmiset keskustelussa",
        "desc": "Kutsu toinen tämän palvelimen käyttäjä mukaan keskusteluusi agentin kanssa. Agentti on sinun: sinun mallisi, kiintiösi ja yhteytesi.",
        "where": "Keskustelun ihmisrivillä Kutsu, ja kutsutulla Jaettu kanssasi -osiossa.",
        "shows": "Osallistujan viestit tulevat keskusteluun hänen nimellään. Hänen viesteihinsä agentti vastaa ilman työkaluja, kunnes päästät sen jatkamaan tai annat hänelle Täydet oikeudet.",
        "needs": "Kutsuttavan pitää olla kirjautunut tälle palvelimelle.",
        "caption": "Muut mukana"
      }
    },
    "picture": {
      "waiting": "3 odottaa sinua",
      "waitingWhy": "Kuvien pakkaus, …",
      "goThrough": "Avaa seuraava",
      "composer": "Kirjoita agentille…",
      "iconRows": "Ikoniprototyypin suunnat",
      "railIcons": "Rail-ikonit",
      "pilot": "pilot.16 testipalvelimelle",
      "now": "nyt",
      "browser": "Selain",
      "browserWaits": "Netvisor odottaa sinua"
    },
    "reload": "Lue tallennettu valinta",
    "intro": "Keskeneräisiä ominaisuuksia, joita voit kokeilla jo nyt. Ne voivat vielä muuttua tai poistua. Valinnat tallentuvat tilillesi ja koskevat kaikkia laitteitasi.",
    "readError": "Valintoja ei voitu lukea. Lue tallennettu valinta uudelleen.",
    "off": "Pois",
    "on": "Päällä",
    "writeError": "Valintaa ei voitu tallentaa. Lue tallennettu valinta ennen uutta yritystä.",
    "where": "Missä",
    "shows": "Mitä näkyy",
    "needs": "Edellyttää",
    "coming": "Tulossa. Tämä versio ei vielä näytä ominaisuutta; valintasi tulee voimaan, kun se on valmis.",
    "unavailable": "Tällä palvelimella ei ole selainympäristöä (TigerVNC ja Google Chrome), joten selain ei käynnisty. Asia kuuluu ylläpitäjälle: Open Habitatin päivitys asentaa ympäristön."
  },
  "en": {
    "features": {
      "rewind-conversation": {
        "name": "Go back here",
        "desc": "Go back to an earlier message of yours in the same conversation. You can also restore the files the agent changed after it, or the files alone.",
        "where": "In your own message's ⋯ menu. The confirmation opens above the message field, and your message goes back into the field to edit.",
        "shows": "What is set aside and which files are restored. The replaced continuation stays in the conversation as a row you can open or continue from, with its files.",
        "needs": "Files are restored for messages you sent while the feature was on. All later changes to files the agent edited are replaced, including your own. The current contents are saved first so you can undo the restore. Files changed only by commands stay as they are. Copies of the files stay in your own account.",
        "caption": "Your message's menu"
      },
      "remote-browser": {
        "name": "Your own server browser",
        "desc": "Your own Chrome on the server. You sign in to a service with it, and the agent uses the same signed-in browser. You see live what the agent does and take control when a window needs you.",
        "where": "Above the conversation's message field in the Browser chip, which opens a strip with pictures of the windows, and as the top row of the sidebar.",
        "shows": "The windows as small pictures, the agent's pointer and clicks. A window that needs you grows large beside its request. Watching never takes control from the agent.",
        "needs": "A server with the browser installed. The agent may use everything the browser is signed in to, in your name. The browser closes after a day unused, and sign-ins are kept.",
        "caption": "Browser above the field"
      },
      "multiplayer": {
        "name": "Other people in a conversation",
        "desc": "Invite another person on this server into your conversation with the agent. The agent stays yours: your model, quota and connections.",
        "where": "Invite on the conversation's people row, and Shared with you for the invited person.",
        "shows": "A participant's messages appear under their name. The agent answers them without tools until you let it continue or give them full rights.",
        "needs": "The invited person must have signed in to this server.",
        "caption": "Others in"
      }
    },
    "picture": {
      "waiting": "3 waiting for you",
      "waitingWhy": "Image compression, …",
      "goThrough": "Open next",
      "composer": "Write to the agent…",
      "iconRows": "Directions for the icon prototype",
      "railIcons": "Rail icons",
      "pilot": "pilot.16 to the test server",
      "now": "now",
      "browser": "Browser",
      "browserWaits": "Netvisor is waiting for you"
    },
    "reload": "Read the saved choice",
    "intro": "Unfinished features you can already try. They may still change or go away. The choices are saved to your account and apply to all your devices.",
    "readError": "The choices could not be read. Read the saved choice again.",
    "off": "Off",
    "on": "On",
    "writeError": "The choice could not be saved. Read the saved choice before trying again.",
    "where": "Where",
    "shows": "What shows",
    "needs": "Needs",
    "coming": "Coming. This version does not show the feature yet; your choice takes effect when it is ready.",
    "unavailable": "This server has no browser environment (TigerVNC and Google Chrome), so the browser cannot start. This is for the administrator: upgrading Open Habitat installs it."
  }
}
```
