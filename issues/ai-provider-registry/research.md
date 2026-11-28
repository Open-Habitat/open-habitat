# AI-palveluntarjoajat: Kiina, Google ja xAI (tutkimus 28.11.2026)

## Tiivistelmä Jarille

- **Pi kantaa jo lähes kaiken.** Kiinnitetty Pi 1.5.2 tuntee kaikki pyydetyt
  palvelut omina tarjoajinaan: GLM (Z.ai, maailma ja Kiina), Kimi (Moonshotin
  API maailma/Kiina sekä Kimi Code -tilaus), MiniMax (maailma/Kiina), Qwen
  Token Plan (tiimi ja henkilö, kumpikin Singapore/Peking), DeepSeek, Google
  Gemini ja xAI Grok. Uutta koodia tarvitaan Habitatin puolelle (rekisteri,
  sopimus, näkymät), ei Pi:hin.
- **Kaksi uutta tilauskirjautumista.** Pi:ssä on laitekoodikirjautuminen
  (sama malli kuin ChatGPT-tilauksessa) kahdelle uudelle tilaukselle: **Kimi
  Code** ja **SuperGrok / X Premium**. Ne ovat ainoat uudet "kirjaudu
  tilauksella" -polut. Muut kiinalaiset *coding planit* (GLM, MiniMax, Qwen)
  ovat tilauksia, mutta Pi:lle ne näkyvät **avaimena**: tilaus ostetaan
  palvelun sivulla ja sen avain liitetään Habitatiin.
- **Google ei tarjoa tilauspolkua kolmannelle osapuolelle.** Gemini CLI:n
  OAuth kolmannen osapuolen työkalussa rikkoo Googlen ehtoja ja on johtanut
  tilien sulkemisiin. Gemini on Habitatissa vain API-avaimena (AI Studio).
- **Kiinassa toimivat vain kiinalaiset.** Anthropic, OpenAI ja Gemini API
  eivät palvele Manner-Kiinaa, Hongkongia eikä Macaota. Kiinalainen kehittäjä
  tarvitsee GLM:n, Kimin, MiniMaxin, Qwenin tai DeepSeekin, ja kolmella
  ensimmäisellä sekä Qwenilla on erillinen kiinalainen päätepiste ja tili.
  Alue on siis osa valintaa, ei asetus jälkikäteen: maailman ja Kiinan tilit
  ja avaimet eivät käy ristiin.
- **Hinnat liikkuvat nopeasti.** Kaikkien kiinalaisten tilausten hinnat,
  nimet ja tasot ovat muuttuneet 2026 useasti (GLM hinnoitteli uudelleen
  heinäkuussa, MiniMax nimesi tilauksensa M Planiksi, Kimi uudisti tasot
  lokakuussa). Habitatin ei pidä näyttää hintoja, vain kuka laskuttaa ja
  linkki palvelun omalle sivulle.
- **Suositus rekisteriksi:** reitti = (palvelu, maksutapa, alue). Esimerkiksi
  `kimi-coding` (tilaus), `moonshotai` (avain, maailma) ja `moonshotai-cn`
  (avain, Kiina) ovat saman Kimi-palvelun kolme reittiä. Prototyyppikierros
  `2026-11-28-ai-palveluntarjoajat-1` näyttää kaksi tapaa ryhmitellä ne.

## Lähteet ja menetelmä

Pi:n tiedot on luettu kiinnitetyn version julkaistuista paketeista
`@earendil-works/pi-coding-agent@1.5.2` ja `@earendil-works/pi-ai@1.5.2`
(npm): `docs/providers.md`, `dist/providers/*.js` (tarjoajan nimi ja
kirjautumistavat), `dist/providers/data/*.json` (mallit, päätepisteet, Pi:n
hintatiedot) ja `dist/auth/oauth/*.js` (OAuth-virrat). Muut tiedot ovat
palveluiden omilta sivuilta tai, missä virallista lähdettä ei löytynyt,
nimetyistä toissijaisista lähteistä. Päivämäärä on luku- tai sivun päivä.

## Mitä Habitat tarjoaa nyt

| Reitti | Pi-tarjoaja | Tapa |
|---|---|---|
| ChatGPT-tilaus | `openai-codex` | Pi:n laitekoodikirjautuminen OpenAI:lle |
| Claude-tilaus | `claude-bridge` | Habitatin oma silta, kirjautuminen Clauden sivulla ja koodi takaisin |
| OpenAI API | `openai` | avain `sk-…` |
| Anthropic API | `anthropic` | avain `sk-ant-…` |
| DeepSeek API | `deepseek` | avain `sk-…` |

Joukko on kovakoodattu useaan paikkaan (issuen `item.md` luettelee ne).
Näkymissä se näkyy näin: Asetukset › Tekoäly -sivulla on otsikot *Tilaukset*
(kaksi riviä) ja *API-avaimet* (rivi per avain, lisäysikkuna jossa kolme
vaihtoehtoa); mallivalitsimessa palveluntarjoaja valitaan viisikohtaisella
`Segmented`-painikerivillä, josta Anthropic ja DeepSeek näkyvät vasta kun
niillä on malleja; käyttöönoton AI-vaiheessa on kaksi ryhmää (*Tilaus*,
*API-avain*); ylläpitäjän sivuston avain valitaan kolmikohtaisesta
`Segmented`-rivistä. Viisi reittiä mahtuu painikeriviin, kaksitoista ei.

## Palvelut

### GLM (Zhipu / Z.ai)

- **Mallit Pi 1.5.2:ssa:** `zai` (maailma) glm-4.7, glm-5-turbo, glm-5.2,
  glm-5.3, glm-5.3-flash ja *highspeed*-versiot; `zai-coding-cn` glm-5.3,
  glm-5.3-flash, glm-4.6v. Z.ai:n sivu mainitsee jo GLM-5.4:n, jota
  kiinnitetty Pi ei vielä tunne. ([docs.z.ai/devpack/overview](https://docs.z.ai/devpack/overview), luettu 28.11.2026)
- **Tilaus vs. avain:** GLM Coding Plan (Lite, Pro, Max) on tilaus, jonka
  kiintiö on krediittejä viiden tunnin ja viikon ikkunassa (Lite 2 000 /
  10 000, Pro 12 000 / 60 000, Max 28 000 / 140 000). Hinta "alkaen 18 USD/kk";
  toissijaiset lähteet antavat Pro- ja Max-hinnoiksi 72–80 ja 160–168 USD/kk
  ([Morph 15.10.2026](https://www.morphllm.com/coding-plan),
  [Usage Pricing 22.7.2026](https://usagepricing.com/blueprint/activity/zhipu-ai-2026-07-22-price-change)).
  Kiinassa 118 / 538 / 1078 CNY/kk elokuussa ([CSDN 24.8.2026](https://aicoding.csdn.net/6a8ce3ae10ee7a33f29e65cb.html)).
  Erillinen pay-as-you-go-API on olemassa, mutta Pi:n `zai`-tarjoaja osoittaa
  coding plan -päätepisteeseen.
- **Kirjautuminen:** avain (`ZAI_API_KEY`, Kiina `ZAI_CODING_CN_API_KEY`). Ei
  OAuthia.
- **Päätepisteet:** maailma `https://api.z.ai/api/coding/paas/v4`, Kiina
  `https://open.bigmodel.cn/api/coding/paas/v4`; OpenAI-yhteensopiva
  (Pi: `openai-completions`).
- **Kolmannen osapuolen työkalut:** Z.ai listaa tuetuiksi mm. Claude Code,
  Codex, OpenCode, OpenClaw, Cline ja "20+" muuta. Sivu ei sano, sallitaanko
  mikä tahansa yhteensopiva agentti; toissijainen arvio väittää, että vain
  listatut ([hyscaler](https://hyscaler.com/insights/glm-coding-plan-review)).
  Pi ei ole Z.ai:n listalla. **Tarkistettava ennen mainontaa.**

### Kimi (Moonshot AI)

- **Mallit:** `moonshotai` / `moonshotai-cn` kimi-k2.6, kimi-k2.7-code
  (+highspeed), kimi-k3, kimi-k3.1-pro (+highspeed); `kimi-coding` (tilaus)
  k3, k3-256k, k3.1-pro, kimi-for-coding (+highspeed).
- **Tilaus:** Kimi Code sisältyy Kimin jäsenyyteen tasolta Plus ylöspäin
  (Kiinan hinnat: Go 49, Plus 99, Pro 199, Max 699, Ultra 1 399 CNY/kk; Go ei
  sisällä Kimi Codea; uusissa tasoissa liukuva viiden tunnin raja, ei
  viikkorajaa) ([kimi.com membership pricing](https://www.kimi.com/en/help/membership/membership-pricing), kuva 19.10.2026).
  Kansainväliset USD-hinnat ovat toissijaisissa lähteissä ristiriitaisia
  (19–199 USD/kk).
- **Kirjautuminen:** **Pi:ssä laitekoodi-OAuth** "Kimi Code (subscription)"
  (`auth.kimi.com`, RFC 8628) tai avain `KIMI_API_KEY`. Moonshotin
  pay-as-you-go-API: avain `MOONSHOT_API_KEY` (sama muuttuja maailma ja
  Kiina, eri päätepiste).
- **Päätepisteet:** tilaus `https://api.kimi.com/coding/v1`; API maailma
  `https://api.moonshot.ai/v1`, Kiina `https://api.moonshot.cn/v1`;
  OpenAI-yhteensopiva.
- **Hinta API:lla (Pi:n tiedot):** kimi-k2.7-code 0,95 / 4 USD per M
  syöte/tuloste; kimi-k3 3 / 15.

### MiniMax

- **Mallit:** `minimax` / `minimax-cn` MiniMax-M2.7 (+highspeed), MiniMax-M3,
  MiniMax-M3.1-Flash.
- **Tilaus:** entinen Coding Plan → Token Plan → nyt **M Plan** (Go, Explore
  3×, Build 7,5× Go:n kiintiö; teksti M3.1 Flash kaikissa, video ja kuva
  ylemmissä). Sivu listaa tuetuiksi työkaluiksi **myös Pi:n** ja "muut
  työkalut M Plan -avaimella" ([platform.minimax.io token-plan](https://platform.minimax.io/docs/token-plan/intro.md), luettu 28.11.2026).
  Hintoja sivulla ei ole; vanhat kansainväliset tasot olivat 10 / 20 / 50
  USD/kk, Kiinan 49 / 119 / 469 CNY/kk ([codepick](https://codepick.dev/zh/guides/minimax-token-plan/)).
- **Kirjautuminen:** avain (`MINIMAX_API_KEY`, Kiina `MINIMAX_CN_API_KEY`).
- **Päätepisteet:** maailma `https://api.minimax.io/anthropic`, Kiina
  `https://api.minimaxi.com/anthropic`; **Anthropic-yhteensopiva**
  (Pi: `anthropic-messages`).
- **Hinta API:lla:** M3 0,30 / 1,20 USD per M; halvin kaikista tässä
  vertailussa DeepSeekin jälkeen.

### Qwen (Alibaba Cloud Model Studio / DashScope / Bailian)

- **Mallit Token Planissa:** qwen3.6–3.8 (flash, plus, max) ja lisäksi
  muiden tekemiä malleja samalla avaimella: deepseek-v4, glm-5.x, kimi-k2.x,
  MiniMax-M2.5. Henkilöversiossa suppeampi lista.
- **Tilaus:** Token Plan (Team ja Personal). Coding Plan Lite lopetettiin
  (uudet ostot 20.3., uusinnat 13.4.2026). Tiimiversio 200 USD/paikka/kk
  Alibaban sivun mukaan, henkilöversiosta vain toissijaisia lukuja
  ([Alibaba Cloud Token Plan](https://alibabacloud.com/help/en/model-studio/token-plan-overview), päivitetty 23.11.2026;
  [Coding Plan](https://www.alibabacloud.com/help/model-studio/coding-plan)).
  Kansainvälinen versio on ostettavissa vain Singaporen alueelta.
- **Kirjautuminen:** avain (`QWEN_TOKEN_PLAN_API_KEY`, Kiina
  `QWEN_TOKEN_PLAN_CN_API_KEY`). Tiimi- ja henkilöpaketti ovat Pi:ssä eri
  tarjoajat samalla muuttujalla.
- **Päätepisteet:** Singapore
  `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`,
  Peking `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`;
  OpenAI-yhteensopiva.
- **Pay-as-you-go:** DashScopen käyttöpohjainen API ei ole kiinnitetyssä
  Pi:ssä (avoin Pi-PR #11369, issuen `item.md`:n mukaan).

### DeepSeek

- **Mallit:** `deepseek-flash` (V4.1-Flash-1017, kuva) ja `deepseek-v4-pro`
  (V4-Pro-0813), 1M konteksti.
- **Vain avain**, ei tilausta. Hinnat USD per M, ruuhka-aikana kaksinkertaiset
  (ma–pe 01–04 ja 06–10 UTC): flash 0,15 / 0,60 (ruuhka 0,30 / 1,20), v4-pro
  0,66 / 1,98 (ruuhka 1,32 / 3,96)
  ([DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing), luettu 28.11.2026).
- **Päätepiste:** sama maailmalle ja Kiinalle `https://api.deepseek.com`
  (OpenAI) ja `/anthropic` (Anthropic-muoto). Ei aluevalintaa.
- Habitatissa jo nyt. Se on myös Qwen Token Planin mallien joukossa.

### Google Gemini

- **Mallit:** `google` gemini-2.5-*, gemini-3.x-flash(-lite), gemini-3.1-pro
  (preview), gemini-pro-latest, gemini-4-argon, gemma-4 jne.
- **Vain API-avain** (AI Studio, `GEMINI_API_KEY`) tai Vertex AI
  (`google-vertex`, pilvitunnukset). Google AI Pro/Ultra -tilausta ei voi
  käyttää kolmannen osapuolen agentissa: Gemini CLI:n ehdot kieltävät sen
  OAuthin käytön muualla, ja FAQ ohjaa kolmannet työkalut API-avaimeen
  ([Gemini CLI ToS](https://www.geminicli.com/docs/resources/tos-privacy),
  [FAQ](https://geminicli.com/docs/resources/faq/)). Kiellon rikkomisesta on
  raportoitu tilien sulkemisia ([Google AI forum](https://discuss.ai.google.dev/t/urgent-mass-403-tos-bans-on-gemini-api-antigravity-for-open-source-cli-users-paid-tier/124508)).
- **Alue:** Gemini API:n maaluettelossa ei ole Manner-Kiinaa, Hongkongia eikä
  Macaota; Taiwan on ([Available regions](https://aistudio.google.com/docs/available-regions.md.txt), luettu 28.11.2026).
- **Hinta (Pi):** gemini-3.5-flash 1,5 / 9; gemini-pro-latest 2 / 12 USD per M.

### xAI Grok

- **Mallit:** `xai` grok-4.3 (1M konteksti), grok-4.5, grok-4.6, grok-4.7.
- **Tilaus:** **Pi:ssä laitekoodi-OAuth** "xAI (Grok/X subscription)",
  painikkeena "Sign in with SuperGrok or X Premium" (`auth.x.ai`). xAI itse
  julkisti tilauskirjautumisen kolmansille agenteille toukokuussa 2026
  ([x.ai/news/grok-opencode](https://x.ai/news/grok-opencode),
  [x.ai/news/grok-kilocode](https://x.ai/news/grok-kilocode)). Tilauksen
  viikkokiintiö on yhteinen Grok-chatin ja agenttien kesken; Hermes-agentin
  ohje raportoi, että xAI on rajannut OAuth-API:n osaan tasoista (HTTP 403)
  ([Hermes](https://hermes-agent.nousresearch.com/docs/guides/xai-grok-oauth)).
  Warp ja Kilo eivät salli tilausta pilviagenteissaan, vain käyttäjän omalla
  koneella ([Warp](https://docs.warp.dev/agents/inference/grok-subscription/)).
  Habitatin agentti ajaa henkilön omana Unix-käyttäjänä hänen palvelimellaan,
  mikä on lähempänä paikallista kuin pilviagenttia, mutta xAI:n ehtoja tästä
  rajasta ei löytynyt. **Tarkistettava** samoin kuin ChatGPT-tilauksen kohdalla.
- **Avain:** `XAI_API_KEY`. Hinta (Pi): grok-4.7 2 / 6 USD per M.
- **Alue:** xAI ei palvele Kiinaa (ei omaa sivua luettu; kuten muutkin
  yhdysvaltalaiset).

### Muut Pi:n tarjoajat, joita ei pyydetty

Xiaomi MiMo (API ja Token Plan Kiina / Amsterdam / Singapore), OpenRouter
(OAuth tai avain, kaikki edellä yhden tilin takana), Mistral, Groq,
Cerebras, GitHub Copilot (OAuth-tilaus), Meta Muse (OAuth-tilaus), Radius ja
muut. Rekisteri voi myöhemmin ottaa minkä tahansa näistä samalla mallilla;
OpenRouter on varteenotettava, koska sillä yksi avain antaa pääsyn kaikkiin
edellä mainittuihin malleihin (mutta Kiinasta se ei ratkaise mitään).

## Yhteenveto

| Palvelu | Tilaus Habitatissa | Avain | Alue | API-muoto | Kiinasta |
|---|---|---|---|---|---|
| OpenAI | ChatGPT (laitekoodi) | `sk-` | – | OpenAI | ei |
| Anthropic | Claude (silta) | `sk-ant-` | – | Anthropic | ei |
| Google | ei (ehdot kieltävät) | AI Studio | – | Gemini | ei |
| xAI | SuperGrok / X Premium (laitekoodi) | `xai-` | – | OpenAI Responses | ei |
| DeepSeek | ei tilausta | `sk-` | yksi | OpenAI ja Anthropic | kyllä |
| GLM (Z.ai) | coding plan avaimena | kyllä | maailma / Kiina | OpenAI | kyllä (Kiinan tili) |
| Kimi | Kimi Code (laitekoodi) | kyllä (Code tai Moonshot) | maailma / Kiina | OpenAI | kyllä |
| MiniMax | M Plan avaimena | kyllä | maailma / Kiina | Anthropic | kyllä |
| Qwen | Token Plan avaimena (tiimi / henkilö) | kyllä | Singapore / Peking | OpenAI | kyllä |

Rajoitukset alueittain: Anthropic ([supported regions](https://www.anthropic.com/supported-countries)),
OpenAI ([supported countries](https://help.openai.com/zh-hans-cn/articles/5347006))
ja Gemini API eivät palvele Manner-Kiinaa, Hongkongia eikä Macaota.
Kiinalaisen palvelun maailman tili (z.ai, moonshot.ai, minimax.io,
Alibaba Singapore) ostetaan kansainvälisellä maksukortilla, Kiinan tili
(bigmodel.cn, moonshot.cn, minimaxi.com, Aliyun Peking) yleensä kiinalaisella
puhelinnumerolla ja maksutavalla; avaimet eivät käy toisen alueen
päätepisteeseen. Kiinan generatiivisen tekoälyn sääntely koskee julkisia
palveluita Kiinassa; yksittäisen kehittäjän oman agentin käyttöä
ulkomaiseen malliin se ei suoraan kiellä, mutta virallista lähdettä tästä ei
löytynyt ([White & Case](https://whitecase.com/insight-our-thinking/ai-watch-global-regulatory-tracker-china)).
Kiinassa toimivan Habitat-palvelimen ylläpitäjä ei voi luvata käyttäjilleen
yhdysvaltalaisia malleja.

## Mitä tämä tarkoittaa rekisterille

1. **Reitti on kolmikko** (palvelu, tapa, alue). Pi:n tarjoaja-id on jo tämä
   kolmikko (`moonshotai-cn`, `qwen-token-plan-individual`), joten rekisteri
   voi olla Pi:n tarjoajista johdettu taulukko, jossa Habitat lisää vain
   näyttönimen, ryhmän, maksutavan, alueen ja avaimen muodon.
2. **Kolme kirjautumistapaa riittää:** laitekoodi (ChatGPT, Kimi Code,
   SuperGrok), Clauden silta, ja avain. Avaimen muoto vaihtelee (`sk-`,
   `sk-ant-`, `xai-`, `sk-sp-` Qwen Token Planilla; Z.ai:n ja MiniMaxin
   muotoa ei tässä varmistettu), joten nykyinen `sk-`-tarkistus ei yleisty: rekisteri kertoo
   tunnistettavan etuliitteen, jos sellainen on, ja muuten pituuden.
3. **Coding plan on käyttäjälle tilaus vaikka Pi:lle avain.** Näkymän pitää
   kertoa tämä rehellisesti: "GLM Coding Plan – osta tilaus z.ai:ssa ja liitä
   sen avain". Prototyyppi näyttää tämän molemmissa suunnissa.
4. **Alue valitaan ennen avainta.** Kiinan avain ei toimi maailman
   päätepisteessä. Ylläpitäjä voi asettaa palvelimelle oletusalueen
   (Kiinassa toimiva palvelin), jolloin Kiinan reitit näkyvät ensin ja
   yhdysvaltalaiset palvelut piiloon tai merkitään "ei toimi alueellasi".
5. **Hintoja ei näytetä Habitatissa.** Ne vanhenevat viikoissa. Näytetään
   kuka laskuttaa ja linkki palvelun omaan hinnastoon.
6. **Ennen mainontaa:** tarkista GLM:n ja xAI:n tilausehdot Pi:n kaltaiselle
   palvelinagentille, ja aja issuen mainitsema laatuarvio (tiedostot, Git,
   integraatiot, workerit).
