# Handoff: selainpolku v2

Toimeksianto koodaavalle agentille. Luettavissa ilman aiempaa keskustelua.

## Yleiskuva

Omega Habitatin selainkäyttöliittymän visuaalinen uudistus: kirjautuminen, repovalinta, OpenAI-kirjautuminen, paluunäkymä, keskustelu (uusi, työskentelee, valmis, hylätty, katkos, vain luku), asetukset, tumma teema ja 390 px puhelin. Tavoite on palauttaa toteutus aiempien suunnittelijavedosten ilmeeseen (`issues/receive-designer-v1/design/vedokset/Ilme-maaritys.dc.html`, `Keskustelu paapolku.dc.html`, `workspaces/Agenttilista vasemmalla.dc.html`): rauhallinen työkalu, jossa näkyvät vain poikkeamat.

Toiminta, rajapinnat ja tilakoneet pysyvät ennallaan, ellei alla toisin sanota. Tämä on **ulkoasun ja vuorovaikutuksen** uudistus.

## Vedostiedostot

Kansion `vedokset/` HTML-tiedostot ovat **suunnitteluviitteitä**: klikattavia prototyyppejä, jotka näyttävät tavoitellun ulkoasun ja käytöksen. Ne eivät ole tuotantokoodia: tyylit ovat inline, data on simuloitua ja tila on yksinkertaistettu. **Toteuta ne uudelleen nykyisillä `web/src/components/`-komponenteilla, `components.css`:llä ja `design-system/tokens/`-tokeneilla.** Älä kopioi vedosten logiikkaa tai tyylirakennetta.

Avaa tiedostot selaimessa (`support.js` pitää olla samassa kansiossa). Jokaisen vedoksen yläosassa on tilavalitsin; tilat viitataan alla nimellä.

| Tiedosto | Sisältö |
|---|---|
| `Selainpolku v2.dc.html` | Pääsnäkymä 1440 × 900: sivupalkki (auki/suljettu), paluu, keskustelun tilat, asetukset, tilivalikko. Yläosassa katselmus nykytilan poikkeamista. |
| `Onboarding v2.dc.html` | Vaiheet 1 Kirjautuminen, 2 Repot, 3 OpenAI; kukin 1440 ja 390 px. Tilat merkitty *kuvattu / sovittu / ehdotus*. |
| `Puhelin v2.dc.html` | Pääsnäkymä 390 × 844: etusivu, valikkolaatikko, valmis, työskentelee, vain luku, katkos. |
| `Tummat näkymät.dc.html` | Koonti kaikista tiloista tummana (upottaa yllä olevat). |

## Tarkkuus

**High-fidelity.** Värit, typografia, välit ja tilat ovat tarkoitettuja lopullisiksi. Kaikki värit ovat nykyisiä `--ah-*`-tokeneita; uusia värejä ei ole. Jos jokin arvo puuttuu tokeneista, ehdota tokenia — älä kovakoodaa.

## Ensimmäinen tehtävä: komponenttikartta katselmoitavaksi

Ennen toteutusta tee ja palauta katselmoitavaksi `design/handoff-v2-komponenttikartta.md`:

1. **Kartta vedoksista komponentteihin.** Jokaiselle vedoksen elementille: mikä nykyinen komponentti (`Navigation`, `Conversation`, `AgentInteractionControls`, `Account`, `LoginCard`, `GitHubRepoChooser`, `PiDeviceSignIn`, `Status`, `Primitives`, `Overlays`, `WorkingProgress`, `Markdown` …) sen hoitaa, mitä siihen muuttuu ja mitkä ovat **uusia**. Todennäköisiä uusia tai eriytettäviä: vaiheilmaisin (`OnboardingSteps`), onboarding-kehys (`OnboardingFrame`), repolistan rivi, kirjautumiskoodin näyttö, keskustelulistan rivi, *Viimeisimpään ↓*, suljettu sivupalkki, tilipainike + avatar, mobiilin valikkolaatikko.
2. **Jokaiselle muuttuvalle tai uudelle komponentille:** vastuu ja mitä se ei tee, props (näyttömalli), tilat, tapahtumat, näppäimistö ja ruudunlukija, käytetyt tokenit.
3. **Tilojen vastaavuus.** Taulukko vedoksen tilanimi → nykyinen tila koodissa (esim. `GitHubCheckoutView.phase`, `PiDeviceSignInView.phase`, lähetyksen kuittaus). Merkitse tilat, jotka poistuvat tai syntyvät.
4. **Poikkeamat.** Kohdat, joissa vedos on ristiriidassa sopimusten (`docs/ui.md`, `docs/interfaces.md`, `design-system/production-v1.md`) tai nykyisen tilakoneen kanssa. Älä ratkaise niitä hiljaa.

Toteuta vasta kartan hyväksynnän jälkeen. Säilytä nykyinen tilanhallinta, pollaus, istunnon sidonta ja kilpatilanteiden käsittely — ne ovat huolellisia eikä vedos ota niihin kantaa.

## Ilmeen säännöt

- **Vain poikkeama näkyy.** Oletustiloja ei kirjoiteta auki: pois *Valmis*, *Selainohjaus*, *Jonossa 0*, *Tarkista keskustelun tila* aina näkyvinä. Työskentelee, vain luku, katkos, hylätty ja tila ei tiedossa näytetään aina.
- **Tila = merkki + sana + väri.** ✓ valmis, ✕ virhe, ? ei tiedossa, sykkivä piste vain oikeasti käynnissä olevalle (pois `prefers-reduced-motion`-asetuksella). Vain luku = ontto rengas / katkoviivareuna.
- **Yksi ensisijainen painike kerrallaan.** Toissijaiset toiminnot (takaisin, peruuta, tyhjennä) hiljaisina tekstipainikkeina.
- **Ei selaimen oletuskontrolleja** (napit, valintaruudut, radiot, `<details>`-nuolet) eikä alleviivattuja linkkejä navigaationa.
- **Kopioi** on hiljainen ⧉ puhujatunnisteen perässä, ei korostustekstiä joka viestissä. Koodilohkossa *Kopioi koodi* otsakerivillä.
- **Näppäinohjeita ei näytetä painikkeissa** toistaiseksi (ei `⏎`, `⌘⏎`, `Esc Esc`). Pikanäppäimet toimivat; ne kerrotaan ohjetekstissä (esim. ”2× Esc keskeyttää”).
- **Estetty painike ei haalistu läpikuultavaksi.** Tausta `--ah-line`, teksti `--ah-muted`, syy tekstinä vieressä. (Nykyinen tumma teema: estetyt *Päivitä* ja *Tilivalikko* ovat lukukelvottomia.)
- **Reunat, ei varjoja.** Varjo vain kelluvilla elementeillä (valikot, *Viimeisimpään*, laatikko).
- **Konekielinen teksti monospacea** (polut, komennot, repot, työtilojen nimet, koodit); ihmisen teksti ei koskaan.

## Tehdyt linjaukset (Jari hyväksynyt vedoksissa)

**Pääsnäkymä**
- Sivupalkin yläosassa **⌂ Etusivu** -rivi (käynnissä olevien määrä), joka vie paluunäkymään *Jatka siitä, mihin jäit*.
- Sivupalkin **‹** sulkee sen 52 px:n kaistaksi: ›, yhteyspiste, ⌂, käynnissä-luku, +, avatar. Suljetun kaistan **+** avaa työtilavalitsimen, jos työtiloja on useita.
- **Tilipainike**: avatar (nimikirjaimet tai GitHub-kuva) + etunimi + ▾. Valikon ylimpänä koko nimi ja sähköposti, sitten Asetukset, Teema (Järjestelmä / Vaalea / Tumma -valitsin), Kirjaudu ulos. Erillinen *Tili*-painike poistuu. *(Edellyttää varmennettua näyttönimeä — ks. avoimet.)*
- Keskustelun otsikko rivitetään/katkaistaan; ei *Näytä koko otsikko* -nappia. Tekninen tieto (hakemisto, tunniste, ohjattavuus) hiljaisen **Tiedot ▾** -painikkeen alle.
- **Keskustelu avautuu vieritettynä viimeisimpään.** Kun käyttäjä vierittää ylös, keskustelun alalaitaan kelluu **Viimeisimpään ↓** (työn aikana *Uutta sisältöä ↓*).
- Työn aikana painikkeet: **Keskeytä** · **Ohjaa** · **Lähetä** (ensisijainen). Ohjaa = ohje Pi:lle ensimmäisessä välissä kesken työn; Lähetä = jonoon, toimitetaan valmistumisen jälkeen. Ero kerrotaan placeholderissa ja kentän alla. Radionappiryhmä poistuu. Jonot näkyvät erillisinä; vain koko jonon tyhjennys (ei yksittäistä perumista).
- Valmis vuoro päättyy riviin **✓ Vuoro valmis 13.53 · odottaa viestiäsi**.
- Tuntematon sisältö: teksti ensin, *Alkuperäinen sisältö ▸* avattavana, ei vastaustoimintoa.
- Katkos: ohut banneri koko sovelluksen yläreunassa, painike **Yhdistä**. Epävarma lähetys merkitään viestin alle (katkoviivakupla + ”? Ei tiedossa, vastaanottiko Pi viestin… Kopioi teksti”); ei automaattista uudelleenlähetystä.
- Hylätty lähetys: ilmoitus kirjoituskentän yläpuolella, teksti säilyy kentässä.
- Vain luku: kirjoituskentän tilalla selitys + *Uusi keskustelu*.
- **Asetukset**: Tili · Yhteydet tällä palvelimella (GitHub, OpenAI) · Ulkoasu (teema) · Istunto (Kirjaudu ulos).

**Onboarding**
- Yhteinen kehys: tuotenimi + palvelimen osoite kortin yläpuolella, vaiheilmaisin **1 GitHub → 2 Repot → 3 OpenAI** kortin yläosassa, seuraava askel kortin alla.
- Kirjautumisen kuvaus: ”Kirjaudu GitHub-tililläsi. Pääset omiin työtiloihisi ja voit työskennellä niissä agenttien kanssa.” Agentin nimeä (Pi) ei korosteta onboardingissa.
- GitHubista palattaessa näytetään **Viimeistellään kirjautumista** -tila (ei tyhjää istunnon varmistusta), joka siirtyy automaattisesti Repot-vaiheeseen.
- **Keskeytä käyttöönotto ja kirjaudu ulos** on hiljainen linkki kortin alla (vaiheet 2–3). Painallus avaa **vahvistuksen**, jossa seuraukset kerrotaan ja punainen *Keskeytä ja kirjaudu ulos*. Irrallinen punainen nappi poistuu.
- Repot: tiivis lista, koko rivi valintakohde. Painike ilman valintaa *Jatka ilman repoja*, valinnan jälkeen *Hae N repoa ja jatka*. Suodatin **Näytä vain viimeisen [kuukauden ▾] aikana päivitetyt** (viikon / kuukauden / kolmen kuukauden / vuoden), oletuksena päällä; piilotettujen määrä näkyy. Repoja, joiden päivitysaikaa ei tiedetä, eikä valittuja repoja piiloteta.
- **Repohaun *osittainen* ja *epäselvä* tila poistuvat käyttäjältä.** Tulos on onnistunut tai virhe. Kadonneen vastauksen jälkeen palvelimelta tarkistetaan ennen näyttämistä, tuliko repo työtilaksi. Virhetila: puuttuva repo listassa ✕, toiminnot *Hae uudelleen* ja *Jatka ilman sitä*. Uudelleenhaku vain käyttäjän painalluksesta. **Tämä muuttaa `GitHubRepoChooser`/`GitHubOnboarding`-tiloja — kuvaa muutos kartassa.**
- OpenAI: koodi isona (JetBrains Mono 24 px), kaksi numeroitua vaihetta (*Kopioi koodi*, *Syötä koodi OpenAI:n sivulla* → painike *Avaa OpenAI:n sivu ↗*), rivi ”Odotetaan vahvistusta… Sivu päivittyy itsestään.” Yksi pääpainike kerrallaan; *Takaisin repojen valintaan* ja *Peruuta yritys* hiljaisina. *Tilaa ei saatu* näytetään virheenä + *Tarkista tila*. Yhdistetty siirtyy automaattisesti paluunäkymään.
- Virhetekstit ovat esimerkkejä rakenteesta (otsikko: mitä tapahtui; teksti: mitä voi tehdä). Mukauta todellisiin virheisiin; älä näytä virhekoodia tai kirjautumislinkkiä.
- Paluun vaihelista (*GitHub-tili vahvistettu*, *Avataan istuntoa palvelimella*) on esimerkki: näytä vain vaiheet, joita palvelin oikeasti seuraa.

**Puhelin (390 px)**
- Sivupalkki on ☰-laatikko (316 px, tausta scrim). ☰:ssä piste, kun jokin on käynnissä. Keskustelussa ⌂ heti ☰:n vieressä (36 × 44 px, ikonit 22–24 px).
- Kosketusalueet vähintään 44 px korkeita. Kirjoituskentän fontti 16 px (iOS ei zoomaa).
- Nykyinen tapa pinota koko sivupalkki keskustelun yläpuolelle poistuu.

## Toiminnalliset viat, joita ulkoasu ei korjaa

Pilot.12-palaute. Korjaa toiminnallisesti; vedos ei peitä niitä.
- Repon valinta vaati toisen painalluksen (näkymä vaihtuu ikkunan fokuksen palatessa). Ensimmäisen painalluksen pitää aina osua.
- Pi-kirjautumisen ensimmäinen painallus näytti virheen ennen koodia. *Koodia valmistellaan* ei saa näyttää virhettä, vaikka koodi viipyisi.
- Paluu OpenAI-vahvistuksesta oli hidas.
- Ikkunan vaihto näytti tyhjän istunnon varmistusnäkymän.

## Avoimet asiat — Jarin päätös

- **Varmennettu näyttönimi** (`issues/decide-account-display/item.md`): vedos olettaa, että nimi, sähköposti ja avatar saadaan. Toteuta vain, jos sopimus hyväksytään; muuten *Oma tili* + nimikirjaimeton avatar.
- **Tuotteen nimi**: vedokset käyttävät *Omega Habitat* (nykyinen koodi); aiemmat vedokset ja toimeksianto *Native Agent Host*.
- **OpenAI-rivi asetuksissa** on ehdotus; nykyiset asetukset näyttävät vain GitHubin.
- **Työtilanäkymä** (työtilan nimen klikkaus) ja **asetukset/onboarding puhelimessa** puuttuvat vedoksista — älä keksi, kysy.
- Rakenteinen `edit`-diff odottaa todistettua natiivia tietoa; vedos näyttää ”ei diff-tietoa — työkalun oma tulos”.

## Mitoitus ja typografia

Fontit: Instrument Sans (UI), JetBrains Mono (konekielinen) — `design-system/fonts/`.

| Käyttö | Arvo |
|---|---|
| Sivun otsikko | 600 · 21–22 px · −.015em |
| Keskustelun otsikko | 600 · 15.5 px, yksi rivi, katkaisu |
| Leipäteksti / viesti | 400 · 14.5 px / 1.6, max 70ch (puhelin 15 px) |
| Työkalurivi, painike | 500 · 13.5 px |
| Metateksti | 400 · 12–12.5 px, `--ah-muted` / `--ah-faint` |
| Puhujatunniste, osion otsikko | 500 · 11 px · .07em · UPPERCASE |
| Mono | 11.5–12.5 px; kirjautumiskoodi 500 · 24 px · .12em |

| Elementti | Arvo |
|---|---|
| Pyöristys | 5 merkinnät · 8 painikkeet/kentät · 9 sivupalkin rivit · 10 kortit/viestit · 12 kehys ja onboarding-kortti · 999 tilapillerit |
| Sivupalkki | 296 px auki, 52 px suljettu, tausta `--ah-rail` |
| Keskustelun yläpalkki | pad 13 × 24, tausta `--ah-surface`, alareuna `--ah-line` |
| Keskustelu- ja kirjoitussarake | max 780 px, pad 22/24 |
| Työkalurivi | pad 9 × 12, 1 px reuna, virhe `--ah-err-soft` + `--ah-err-line` |
| Paluunäkymä | max 760 px, yläväli 56 |
| Asetukset | max 680 px, osioiden väli 28 |
| Onboarding-kortti | max 440 (kirjautuminen) / 560 (repot) / 480 (OpenAI), pad 26 (puhelin 20) |
| Repolista | max-korkeus 330 px, rivi pad 10 × 12, valittu `--ah-accent-soft` |
| Fokus | 2 px `--ah-accent`, offset 2 px |

Liike: vain sykkivä piste (2.4 s työ / 1.4 s odotus, opacity 1 → .3) ja 150 ms kytkimet. Kaikki pois `prefers-reduced-motion`-asetuksella.

## Tokenit

Käytössä vain nykyiset `design-system/tokens/colors.css` -tokenit molemmissa teemoissa (vedoksissa lyhyillä nimillä: `--acc` = `--ah-accent`, `--acc-ink` = `--ah-accent-ink` jne.). Uusia tokeneita ei ehdoteta. Ensisijaisen painikkeen teksti tummassa teemassa `--ah-on-accent` (#0f1417).

## Saavutettavuus

- Sivupalkin rivit ja repolistan rivit ovat painikkeita (`role="checkbox"` + `aria-checked` repoille). Teemavalitsin `radiogroup`. Aikavälivalikko `listbox`. Keskeytyksen vahvistus `alertdialog`. Valikot `aria-expanded`.
- Tilamuutokset `role="status"` / `aria-live="polite"`; virheet `role="alert"`. Ruudunlukijalle mielekkäät muutokset, ei jokaista tekstipalaa.
- Fokus ei katoa päivityksissä; laatikon ja valikon sulkeminen palauttaa fokuksen avaajaan.
- Pitkä suomi ja 200 % zoom: otsikot katkaistaan `title`-attribuutilla, rivit rivittyvät.

## Assetit

Ei kuvia eikä ikonikirjastoa. Ikonit ovat tekstimerkkejä (☰ ⌂ ‹ › ▾ ▸ ⧉ ✓ ✕ ? ↓ ↗). Jos koodissa on ikonijärjestelmä, käytä sitä vastaavilla ikoneilla. Avatar: GitHub-kuva, jos saatavilla, muuten nimikirjaimet `--ah-accent-soft`-pohjalla.
