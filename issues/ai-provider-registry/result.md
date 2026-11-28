# Tulokset

## Kierros 1 (28.11.2026)

Tutkimus: [research.md](research.md). Prototyyppi:
`design-system/prototypes/rounds/2026-11-28-ai-palveluntarjoajat-1/`
(rakennus ja tarkistus kierroksen `NOTES.md`:ssä).

**Akseli:** miten kolmetoista reittiä ryhmitellään luettaviksi.

- **Maksutavan mukaan.** Asetukset › Tekoäly säilyttää otsikot Tilaukset ja
  API-avaimet; coding plan (GLM, MiniMax, Qwen) on tilaus, jonka rivillä on
  merkki "Tilaus avaimella". Lisäysikkuna on haettava lista kolmessa
  ryhmässä (kirjaudu tilauksella / coding plan / käyttöpohjainen avain).
  Mallivalitsimessa nykyinen viisikohtainen painikerivi korvautuu
  Reitti-pudotusvalikolla, jossa on vain kytketyt reitit ryhmiteltyinä.
- **Palvelun mukaan.** Asetuksissa yksi rivi palvelua kohden ja sen alla sen
  kytkennät. Lisäysikkuna näyttää yhdeksän palvelua kahdessa ryhmässä
  (kansainväliset, kiinalaiset); palvelun sisällä valitaan tapa ja alue.
  Mallivalitsin näyttää kaikkien kytkettyjen palveluiden mallit otsikoittain
  ilman reitin valintaa.

**Molemmissa samat:** alue (Maailma / Manner-Kiina, Qwenilla Singapore /
Peking) valitaan ennen avainta ja näyttää Pi:n tarjoaja-id:n; Qwenin
henkilö- ja tiimipaketti on oma valinta; Habitat ei näytä hintoja, vain kuka
laskuttaa ja linkin palvelun sivulle; Google on vain avaimena ja syy
kerrotaan; Kimi Code ja SuperGrok kirjautuvat laitekoodilla kuten ChatGPT;
ylläpitäjä asettaa palvelimen alueen, ja Kiina-palvelimella käyttöönotto
nostaa alueella toimivat palvelut ensin, ehdottaa GLM:ää ja taittaa
yhdysvaltalaiset ryhmään "Ei saatavilla Manner-Kiinassa"; palvelimen avain
voi olla mikä tahansa avainreitti alueineen.

**Mitä näkymä olettaa hostilta:** rekisterin (reitti, palvelu, tapa, alue,
Pi:n tarjoaja-id, avaimen etuliite) joko johdettuna Pi:n tarjoajista tai
tarkistettuna niitä vasten; Pi:n tunnistetiedot (`auth.json`) jokaiselle
reitille, ei vain kolmelle; laitekoodivirran Kimi Codelle ja xAI:lle
samalla tavalla kuin `openai-codex`:lle; palvelimen alueen ylläpitäjän
asetuksena ja sivuston avaimen minkä tahansa avainreitin kanssa. Viimeiset
kaksi muuttavat `contracts/v1`:tä.

**Kysymykset Jarille:**

1. Kumpi ryhmittely: maksutapa vai palvelu? Suositus: **palvelun mukaan**,
   koska yhdeksän palvelua pysyy luettavana mutta kolmetoista reittiä ei, ja
   kiinalainen kehittäjä etsii "Kimi" eikä "coding plan".
2. Saako Kiina-palvelimella yhdysvaltalaiset palvelut piilottaa kokonaan
   (ylläpitäjän valinta), vai riittääkö taitettu ryhmä?
3. Tarjotaanko Kimi Code- ja SuperGrok-tilauksia ennen kuin niiden ehdot
   palvelinagentille on luettu? Molemmat kirjautumiset ovat Pi:ssä valmiina,
   mutta tutkimus ei löytänyt kummankaan ehtoja tästä rajasta (xAI:n
   kumppanit rajaavat tilauksen paikalliseen käyttöön).
