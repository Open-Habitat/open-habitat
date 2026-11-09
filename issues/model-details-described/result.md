# Tulos

Yläpalkin mallisirun ponnahdus on suunnan B mukainen tieto
(`web/src/components/ConversationModelDetails.tsx`): määrittelylista
Malli (nimi, tunniste ja kuvaus), Ajattelutaso (taso ja selitys) ja
Kirjautuminen, sen alla hiljaisena tekstinä saman kirjautumisen muut mallit
kuvauksineen kyvykkyysjärjestyksessä, mallin tukemat tasot ja huomautus,
että selaimessa malli valitaan ennen ensimmäistä viestiä. Reunuksia ja
korostettuja rivejä ei ole.

Kuvaukset ovat kerran, luettelossa `web/src/text/models.tsx`
(`families`, `thinkingAbout`, `thinkingShort`), ja niitä haetaan
mallin perheen mukaan (`modelFamily`, `modelDescription` tiedostossa
`modelPresentation.ts`). Sama `ModelPicker` näyttää kuvaukset
viestikentän mallivalitsimessa, Asetukset › Tekoäly › Oletusmallissa ja
tilannekatsauksen mallivalinnassa. Tuntematon malli ei saa kuvausta.
Explain-kortit Y06 (siru), P11 (ponnahdus) ja L07 (mallirivi) eivät enää
väitä, että ponnahduksesta voi vaihtaa mallin.

Kuvat: `evidence/{fi,en}-{tiedot,valitsin,asetus}-{1440,390}-{light,dark}.avif`
(`web/lab/capture-model-details.mjs`, laite-skaala 2, synteettinen lab).

## Päätökset myöhempään tarkasteluun

- **OpenAI-perheiden järjestys Astra > Sol > Terra > Luna.** Perheet eivät
  kerro järjestystään; järjestys on Pi-luettelon ilmoitetuista hinnoista
  (Astra 10/50, Sol 2–4/10–20, Terra 2/12, Luna 0,1/0,5 $/Mtok). Aiemmin
  OpenAI-mallit olivat palvelun antamassa järjestyksessä. Nova (vain
  testeissä) ei ole tunnettu perhe eikä saa kuvausta.
- **Kuvaukset ovat suhteellisia ja yhden rivin mittaisia** ("Yleismalli
  arkeen; Opusta nopeampi ja edullisempi"). "Kallis/edullinen" tarkoittaa
  tilauksella käyttörajaa ja API-avaimella laskua; sanaa "käyttöraja" ei
  mahdu riville. Vaihtoehto oli kahden rivin kuvaus, mutta silloin
  valitsin ei mahtunut 768 px:n kannettavaan vierittämättä.
- **Valitsimessa ajattelutason selitys on lyhyt muoto** (`thinkingShort`:
  "Korkeampi: perusteellisempi, hitaampi ja kalliimpi."), ponnahduksessa
  koko selitys. Samasta syystä: mahtuminen.
- **Viestikentän valitsin saa nousta korkeammaksi** (`max-height`
  70vh → min(80vh, 100dvh − 120px)), jotta kuvaukset mahtuvat
  vierittämättä myös englanniksi.
- **Ponnahdus näyttää mallin tunnisteen** (`claude-opus-5-5`) kuten
  prototyypin B; se on natiivi fakta SSH-käyttäjälle. Voi poistaa, jos se
  häiritsee.

## Tarkistukset

- `./scripts/test-focused.sh --area web` vihreä.
- Selain: lab-model-menu, lab-picker-declutter, lab-sidebar-default,
  title-regeneration, settings-model-picker, recap-settings,
  new-conversation-placeholder sekä browser-conversationin ja
  account-settingsin mallitapaukset vihreinä (`OH_PORT_BASE=16000`).
- Katselmointi: kohdennettu itsekatselmointi (vain esitys ja teksti; ei
  daemonia, sopimusta, istuntotilaa eikä valtuuspolkua).
- Explain-kortteja ei katsottu selitystilassa labissa; kortit muuttuivat
  vain tekstiltään, niiden kohteet eivät.
