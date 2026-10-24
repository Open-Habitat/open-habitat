# AI-vaihe tarjoaa sivuston valinnan

Henkilön käyttöönoton AI-vaihe lukee sivuston tarjouksen
(`ai_account.offer`) henkilön omasta `GET /api/v1/onboarding/site`
-luvusta. *Henkilö valitsee* (`all`) näyttää viisi vaihtoehtoa kahtena
ryhmänä kuten ennen. Oletus näyttää vain sen vaihtoehdon avattuna,
merkittynä *Ehdotus*, ja johdannossa "Sivusto ehdottaa: …". Linkki
› Käytä muuta AI-palvelua tuo loput samoina ryhminä (kierros 4, "Ehdotus ja
lista").

- **Yksi lista kahdessa paikassa**: `web/src/components/AIOfferList.tsx`
  piirtää rivit, ryhmät, ehdotuksen ja linkin. `PiOnboarding` antaa sille
  oikeat kirjautumiset, ja Käyttöönotto-esikatselu antaa sijaiset
  (pois käytöstä olevat painikkeet). Esikatselun oma rivikopio ja sen CSS
  poistettiin. Ylläpitäjän oletusvalinnassa on edelleen omat
  ylläpitäjälle kirjoitetut kuvaukset.
- **Vaihtoehtojen tunnukset** ovat nyt samat kuin asetuksissa (`chatgpt`,
  `claude`, `openai_key`, `anthropic_key`, `deepseek_key`), myös
  `data-testid`:ssä.
- **Selainisäntä**: `/fixture/onboarding` ottaa `offer=<tarjous>`.

Sopimusta, yhdyskäytävää tai daemonia ei muutettu: henkilön luku kantoi
tarjouksen jo. Arvio: kohdennettu itsearvio (esitys olemassa olevan luvun
päällä, ei auktoriteetin siirtoa).

## Näyttö

| Tarkistus | Tulos |
| --- | --- |
| vitest `AIOfferList.test.tsx` (uusi): `all`, `site_key`, jokainen viidestä oletuksesta yksin auki ja muiden paljastus, vaihto toiseen ja paluu ehdotukseen listaa suljettaessa, pelkät tilaukset | Läpi |
| vitest `PiOnboarding.test.tsx`: tarjous luetaan vaiheen jälkeen, ehdotus aukeaa omalla kirjautumisellaan, vaihto Claudeen avaa oikean kirjautumisen | Läpi |
| vitest `OnboardingSettings.test.tsx`: esikatselu näyttää saman listan | Läpi |
| Storybook `Production/Onboarding AI offer`: `All`, viisi oletusta ja paljastetut muut (myös kapea) | Lisätty |
| Koko vitest (107 tiedostoa, 668 testiä), `typecheck`, `lint` | Läpi |
| Selain: `provider-login-layout.spec.ts` (uusi tapaus: oletus Anthropic-avain yksin, axe, muut paljastettuna, ChatGPT-koodi, lista kiinni ja auki, koodi säilyy), `site-onboarding.spec.ts`, `onboarding-route-map.spec.ts`, `shell-accessibility.spec.ts` | Läpi |
| Koko selainsarja (`test-focused.sh --area browser`) | 357 läpi, 3 ohitettu |

## Päätöksiä myöhempään tarkistukseen

- **Sivuston avain henkilön vaiheessa** (`site_key`) näyttää kaikki
  vaihtoehdot. Vaihe näkyy sivuston avaimesta huolimatta vain, jos henkilön
  Pi:llä ei ole käyttökelpoista tunnusta (`site-ai-key` päättää
  ohituksen), ja silloin ehdotettavaa sivuston vaihtoehtoa ei ole.
- **Lukematon tarjous**: kun sivuston lukua ei saada, kaikki vaihtoehdot
  näytetään. Lukemisen ajan vaihe näyttää "Haetaan vaihtoehtoja…", jotta
  lista ei vaihdu kesken silmäilyn. Asetuksista aloitettu kirjautuminen
  (`pi_sign_in`) ei lue tarjousta ja näyttää tilaukset kuten ennen.
- **Listan sulkeminen palauttaa ehdotukseen**: jos henkilö on valinnut
  muun palvelun ja sulkee › Käytä muuta AI-palvelua, ehdotettu rivi aukeaa
  eikä valittu rivi jää piiloon. Tilausten kirjautumiset pysyvät
  taustalla, joten aloitettu ChatGPT-koodi säilyy. Prototyyppi jätti
  valitun rivin piiloon.
- **Ehdotuksen rivillä on merkki Ehdotus valintapallon sijaan**, myös kun
  henkilö on vaihtanut toiseen palveluun (prototyypin mukaan).
- **Esikatselun kirjautumiset ovat sijaisia**: avattu rivi näyttää pois
  käytöstä olevan *Kirjaudu…*- tai *Tallenna avain* -painikkeen.
  Tuotannon kirjautumiskomponentit tekisivät pyyntöjä ylläpitäjän omaan
  Pi:hin.

## Ei todennettu

Kuvakaappauksia ei otettu: ulkoasu on `onboarding-ai-step-layout`in lista,
johon tulivat vain Ehdotus-merkki ja linkki. Oikea OpenAI/Anthropic-kirjautuminen
ja kahden UID:n asennus; selainisäntä on saman UID:n synteettinen näyttö.
