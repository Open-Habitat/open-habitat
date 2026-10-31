# Miten Orca kasvoi, ja miten Open Habitat julkaistaan avoimena lähdekoodina

Tutkimusajo `01m68h4weg0w5csbnnaps7hats`, 31.10.2026. Taustana
[Orca-vertailu](../benchmark-orca/report.md) ja
[HumanLayer-vertailu](../benchmark-humanlayer/report.md).

Merkinnät: **(lähde)** = lukee lähteessä tai mittasin sen itse.
**(lähde, välillinen)** = löytyi hakutyökalun kautta, enkä avannut sivua
itse (X:n postaukset tarkistin X:n julkisesta embed-rajapinnasta, Reddit ja
Product Hunt estivät suoran haun). **(päättely)** = oma tulkintani.

**Menetelmä.** GitHubin tähtilistaus on Orcalta piilotettu
(`canOpenStargazersAndWatchers: false`), eikä GitHubin API anna
tähtiaikaleimoja, joten star-history-tyyppistä käyrää ei voinut laskea
suoraan. Käyrä on koottu Wayback Machinen 44 tilannekuvasta repon
etusivusta. Samoin luin GitHub Trending -listojen (päivä ja viikko)
arkistoidut kuvat kesäkuusta lokakuuhun, Orcan 994 julkaisua latausmäärineen
API:sta, README:n 180 commitin historian, onorca.dev-sivuston arkistoidut
versiot, Hacker Newsin Algolia-haun sekä YouTube-videoiden sivut. X-,
Reddit-, YouTube- ja lehdistöhaut tein Clauden WebSearch-työkalulla.
Tavallinen hakukone (DuckDuckGo, Mojeek) ja Reddit estivät suoran haun.

## Tiivistelmä

Orcan 111 000 tähteä eivät tulleet julkistuksesta. Show HN 27.3.2026 sai
21 pistettä ja Product Hunt 8.4. sijan 45. Kolmen ensimmäisen kuukauden
aikana kertyi vain noin 6 000 tähteä (noin 70 päivässä). Käänne tuli
kesäkuun lopussa. Tiimi teki README:stä 9.–12.6. konversiota varten
uuden version (tähti- ja latausmerkit, yksi iso Download-painike,
mobiilisovellus ensimmäisenä), ja 24.–25.6. Orca nousi GitHubin päivä- ja
viikkotrendeihin. Sen jälkeen kasvu pysyi neljä kuukautta tasaisena
700–1 000 tähdessä päivässä ilman yhtä virusmaista piikkiä. Kasvua ylläpiti
silmukka. Trendilista nosti Orcan YouTuben "GitHub trending" -kanaville ja
erityisesti japanin-, korean- ja kiinankielisille tekijöille. Videot
toivat uusia tähtiä, ja ne pitivät Orcan listalla. Lähes päivittäiset
julkaisut, README kahdeksalla kielellä, WeChat-ryhmä ja tuki kaikille
suosituille agenteille (Claude Code, Codex, Pi, Hermes, OpenClaw, Grok…)
syöttivät silmukkaa. Maksettua mainontaa en löytänyt, ja lehdistö ei
kirjoittanut Orcasta. Verkostoa käytettiin: perustajan oma X-postaus
2.4. ("stop using Cursor / Conductor / Cmux") on edelleen tilin
suosituimpia, ja Orcan kehittäjä mainosti sitä Redditissä aina
kertomatta sidonnaisuuttaan. Kritiikki koskee muistinkulutusta, bugeja,
oletuksena ohitettuja lupia, oletuksena päällä olevaa telemetriaa sekä
sitä, että agentit pääsevät Orcan CLI:n kautta käyttäjän kaikkiin
shelleihin. Viimeksi mainittu on Open Habitatille arvokkain havainto,
koska se on juuri se aukko, jonka Unix-tunnuksin erotettu palvelin
täyttää. Open Habitatin ei kannata yrittää toistaa 25 hengen tiimin
päivittäisiä julkaisuja. Sen kannattaa julkaista kapeammalle yleisölle:
Pi:n käyttäjille, itse ylläpitäville (homelab, r/selfhosted) ja pienille
tiimeille ja kouluille, joilla on yksi yhteinen palvelin. Ennen
julkistusta tarvitaan lisenssi, englanninkielinen README, 90 sekunnin
demovideo kahdesta ihmisestä samalla palvelimella, kymmenen minuutin
asennuspolku tavalliselle VPS:lle ja tietoturvan kuvaus.

## 1. Aikajana

### Tapahtumat

| Päivä | Tapahtuma | Lähde |
|---|---|---|
| 17.3.2026 | Repo `stablyai/orca` luodaan. Stably AI on YC W22 -yhtiö, joka teki aiemmin tekoälytestausta. | GitHub API **(lähde)** |
| 21.–22.3. | Ensimmäiset julkaisut v1.0.12–v1.0.16, joita ladataan noin 40 kertaa kutakin. | Releases API **(lähde)** |
| 27.3. | Neil Parker (nwparker) julkaisee **Show HN: Open Source 'Conductor + Ghostty'**: 21 pistettä ja 10 kommenttia. Kommenteissa huomautetaan, ettei LICENSE-tiedostoa ole. Lisäksi kiitetään "not having a super long ai-generated readme". | [HN 47549197][shn] **(lähde)** |
| 29.3. | README:hen tulee osio "Shipping daily": nopea julkaisutahti on alusta asti osa viestiä. | README-historia **(lähde)** |
| 2.4. | Toimitusjohtaja Jinjing Liang postaa X:ssä: "Seriously—stop using Cursor / Conductor / Cmux. Orca does it all … Free. Open source. MIT licensed." Postaus on kiinnitetty ja saanut 703 tykkäystä. | [X][jl-0402] **(lähde)** |
| 3.4. | @orca_build: Notion-tyylinen markdown-editori ("Like Notion and Obsidian had a baby"), 812 tykkäystä. | [X][ob-0403] **(lähde, välillinen)** |
| 8.4. | Product Hunt: "Your control center for parallel AI agents", 86 ääntä ja päivän sija 45. | [PH][ph] **(lähde, välillinen)** |
| 11.4. | README:hen "No login required" sekä Discord-merkki. Kiinalainen kehittäjä @Yonah_x vaihtaa cmuxista Orcaan (28 400 näyttökertaa). | README-historia **(lähde)**, [X][yonah] **(lähde, välillinen)** |
| 14.4. | README:n kiinan- ja japaninkieliset käännökset. Espanja seuraa 25.4., korea 15.5., portugali 5.7., ranska 20.7., turkki ja venäjä lokakuussa. | README-historia **(lähde)** |
| 1.5. | Homebrew-cask. | README-historia **(lähde)** |
| 3.–5.5. | Telemetria (PostHog) tulee käyttöön. | README-historia **(lähde)** |
| 4.5. | Mobiilisovelluksen ensimmäinen julkaisu (mobile-v0.0.1). | Releases API **(lähde)** |
| 14.5. | README:hen Linear- ja mobiilinäytökset. | README-historia **(lähde)** |
| 6.6. | Yhteisölle oma subreddit r/OrcaADE. Tähtiä 4 256. | [Reddit][r-orcaade] **(lähde, välillinen)**, Wayback **(lähde)** |
| 9.–12.6. | README uusitaan: tähtimerkki, latausmerkki, uusi demo ja PR #5244 "Redesign README for clarity and conversion": yksi näkyvä **Download Orca** -painike, staattinen hero-kuva, jossa mobiili näkyy työpöydän päällä, ja ominaisuustaulukko. | [PR #5244][pr5244] **(lähde)** |
| 11.6. | onorca.dev vaihtaa otsikon "The Worktree IDE for Claude Code, Ghostty…" muotoon "The most powerful Agent Development Environment (ADE)", ja sivulle lisätään "New features shipped every day". | Wayback **(lähde)** |
| 23.6. | @EXM7777 kertoo ajavansa Claude Codea, Codexia ja omp:tä Orcassa "(not sponsored)", 155 tykkäystä. | [X][exm-0623] **(lähde, välillinen)** |
| 24.–25.6. | **Orca nousee GitHub Trendingiin**: päivälistalla sija 9 (25.6.), viikkolistalla 13 → 9 seuraavan viikon ajan. Ensimmäiset YouTube-arviot ja japaninkielinen esittely (23 000 näyttökertaa) julkaistaan 25.–27.6. | Wayback, github.com/trending **(lähde)**, [YouTube-luettelo](#youtube) |
| 25.6. | README:hen X-merkki, TestFlight- ja WeChat-linkit. | README-historia **(lähde)** |
| 26.6. | Ensimmäinen uutisjuttu (AI Insiders, "Stably ships Orca…"). Siinä huomautetaan, ettei README:ssä ole käyttödataa eikä vertailuja. | [AI Insiders][aiins] **(lähde, välillinen)** |
| 5.7. | README:hen star-history-kaavio. | README-historia **(lähde)** |
| 10.7. | Matt Van Horn listaa Orcan "kuukauden 10 isoimman trendaavan GitHub-repon" joukkoon (+10 400 tähteä kuukaudessa), 205 tykkäystä. | [X][mvh] **(lähde)** |
| 12.7. | Jason Zhou (SuperDesign): "I tried almost every parallel ADE. So far loving @orca_build the most", 224 tykkäystä. Lainaus päätyy onorca.dev-sivulle. | [X][jz] **(lähde, välillinen)** |
| 20.–22.7. | **Ensimmäiset isot videot**: Christian Lempa "My NEW AI Terminal and Code Editor // Orca Review" 21.7. (125 000 näyttökertaa), AI超元域 (kiina, 34 700) ja Eric Tech (22 000). | [YouTube][lempa] **(lähde)** |
| 22.7. | Tietoturvaissue #9963: agenttien hookit asennetaan muiden ohjelmien asetuksiin kertomatta, Codexin OAuth-tunnukset kopioidaan, daemon kuuntelee osoitteessa 0.0.0.0, ja telemetria ja YOLO-luvat ovat oletuksena päällä. Issue suljettiin 3.8. | [#9963][i9963] **(lähde)** |
| 31.7. | Tähtiä 34 552. Kasvu on nopeimmillaan, noin 1 050 päivässä. | Wayback **(lähde)** |
| 1.8. | Conductorin oma subreddit: Orca "seems to be getting the most traction". | [Reddit][r-cond] **(lähde, välillinen)** |
| 10.8.–21.8. | Uusi videoaalto: AICodeKing (33 000), AI Stack Engineer (18 500) ja Joe Maddalone (24 500). | [YouTube-luettelo](#youtube) |
| 12.–13.8. | Päivätrendien sijat 10 ja 4. Star Historyn mukaan paras sija on 1 (11.8.). | Wayback **(lähde)**, [Star History][sh] **(lähde, välillinen)** |
| 23.8. | r/ClaudeCode: "Orca ADE is incredible", noin 60 kommenttia. | [Reddit][r-cc] **(lähde, välillinen)** |
| syyskuu | Japanilaiset videot (セイト先生 84 500, 27.9.) ja Tonbi's AI Garage (62 000, 14.9.). Viikkotrendeissä sija 8–9 (22.–29.9.). CodeRabbitin mukaan Orca oli syyskuussa sen katselmoiduin avoin repo (5 600 katselmointia). | YouTube **(lähde)**, Wayback **(lähde)**, [HN 50007033][cr] **(lähde, välillinen)** |
| 15.9. | Ainoa löytämäni perustajahaastattelu (Yuzheng Sunin Substack). Siinä puhutaan rinnakkaisista agenteista, ei kasvusta. | [Substack][yz] **(lähde, välillinen)** |
| 30.9. | Martin Tapia, "I tried Orca … I went back to tmux": Orcan CLI antaa agentin ajaa komentoja mihin tahansa käyttäjän avaamaan shelliin, kaikissa projekteissa ja koneissa. CTO vahvisti, että tämä on tarkoitus. | [Tapia][tapia] **(lähde)** |
| 1.10. | Pi 1.0 Hacker Newsissa (1 689 pistettä). Kommenteissa mainitaan Orca Pi:n käyttöliittymänä. | [HN 49926069][pi1] **(lähde)** |
| 15.10. | @orca_build: "Use DeepSeek-v4.1-flash for free in Orca", 517 tykkäystä, tilin otannan suosituin postaus. | [X][ob-1015] **(lähde, välillinen)** |
| 18.–22.10. | Päivätrendien sija 1 (HIMIAO 19.10.). Tähdet ylittävät 100 000:n (julkaisu v1.4.237), ja kasvu kiihtyy noin 1 500:aan päivässä. | [HIMIAO][himiao] **(lähde, välillinen)**, Wayback **(lähde)** |
| 23.10. | Better Stack "The Best Agent IDE I've ever used (Orca)", 130 800 näyttökertaa. | [YouTube][bs] **(lähde)** |
| 31.10. | 111 327 tähteä, 7 043 forkkia, 152 seuraajaa, noin 6 600 Discord-jäsentä. | GitHub API **(lähde)**, Discord **(lähde, välillinen)** |

### Tähtikäyrä

Tähdet Wayback Machinen tilannekuvista ja keskimääräinen kasvu
edellisestä mittauksesta **(lähde: oma mittaus)**:

| Päivä | Tähtiä | Kasvu / vrk |
|---|---:|---:|
| 27.3. | 9 | |
| 2.4. | 131 | 20 |
| 15.4. | 1 064 | 72 |
| 6.6. | 4 256 | 61 |
| 22.6. | 5 915 | 104 |
| 27.6. | 8 285 | 474 |
| 10.7. | 15 545 | 558 |
| 23.7. | 26 102 | 812 |
| 31.7. | 34 552 | 1 056 |
| 11.8. | 42 200 | 695 |
| 31.8. | 57 914 | 786 |
| 15.9. | 69 015 | 740 |
| 1.10. | 82 486 | 842 |
| 18.10. | 95 920 | 790 |
| 22.10. | 102 069 | 1 537 |
| 31.10. | 111 327 | 1 029 |

Julkaisujen keskimääräiset lataukset kuukausittain (työpöytäversiot)
**(lähde: Releases API)**:

| Kuukausi | Julkaisuja | Latauksia / julkaisu |
|---|---:|---:|
| huhtikuu | 208 | 212 |
| toukokuu | 229 | 831 |
| kesäkuu | 181 | 15 600 |
| heinäkuu | 183 | 53 300 |
| elokuu | 49 | 509 000 |
| syyskuu | 22 | 2 527 000 |
| lokakuu | 21 | 2 194 000 |

Elokuusta alkaen latausluvut kertovat lähinnä auto-updaterin toiminnasta,
kun julkaisuja on vähemmän ja kukin ladataan kaikille asennuksille.
Hyppy kesäkuusta heinäkuuhun samalla julkaisutahdilla osoittaa silti,
että käyttäjiä tuli oikeasti lisää samaan aikaan kuin tähtiä
**(päättely)**.

## 2. Mikä kasvua ajoi

### Mitä lähteet osoittavat

1. **Julkistus ei ollut syy.** Show HN (21 pistettä) ja Product Hunt (sija
   45) eivät näy käyrässä. Kolmessa kuukaudessa kertyi noin 6 000 tähteä
   **(lähde)**.
2. **Käänne osui yhteen README-uudistuksen ja trendilistan kanssa.**
   Konversiota varten tehty README valmistui 12.6., sivusto vaihtoi
   ADE-kategorian nimeen 11.6., ja kahden viikon kuluttua Orca oli
   päivä- ja viikkotrendeissä. Viikkolistalla se pysyi lähes yhtäjaksoisesti
   25.6.–26.7. **(lähde)**. Kesäkuun 22. ja 27. päivän välillä kasvu
   viisinkertaistui.
3. **YouTube seurasi trendilistaa, ei edeltänyt sitä.** Ennen 24.6. löytyi
   yksi 14 000 näyttökerran Short (3.4.). Kesäkuun lopusta lokakuuhun
   videoita on noin 40, ja niistä yli puolet on muulla kuin englannin
   kielellä (japani, korea, kiina, portugali, espanja, venäjä). Monen
   kanavan nimi on suoraan "Github Trending Repos" tai vastaava
   **(lähde)**. Kaksi suurinta englanninkielistä tekijää (Christian Lempa
   21.7., Better Stack 23.10.) tulivat vasta, kun Orcalla oli jo 20 000 ja
   100 000 tähteä.
4. **Kasvu oli tasaista, ei piikkimäistä.** 700–1 000 tähteä päivässä
   neljän kuukauden ajan, ja suurin piikki (1 500/vrk) osui
   lokakuun päivätrendin ykkössijaan **(lähde)**.
5. **Monikielisyys ja Aasia.** README käännettiin kiinaksi ja japaniksi jo
   14.4. ja lopulta kahdeksalle kielelle. README:ssä on WeChat-ryhmän
   QR-koodit. Suurimmat X-keskustelut tavallisilta käyttäjiltä ovat
   kiinankielisiä (@Yonah_x, @hylarucoder 36 000 näyttökertaa)
   **(lähde)**.
6. **Agenttien kirjo.** Orca tukee yli 35:tä CLI-agenttia, ja repon
   aiheina (topics) ovat `claude-code`, `codex`, `pi`, `hermes-agent`,
   `openclaw`, `grok-bot`… Jokaisen agentin oma yhteisö on siis jakelukanava.
   Uusi agentti lisättiin README:hen tukilistalle lähes viikoittain
   toukokuussa ja kesäkuussa **(lähde)**. Lokakuun suosituin @orca_build-postaus
   koski ilmaista DeepSeek-mallia, ei Orcan omaa ominaisuutta.
7. **Julkaisutahti viestinä.** "Shipping daily" on ollut README:ssä 29.3.
   lähtien ja sivustolla kesäkuusta lähtien ("New features shipped every
   day"). Maalis–heinäkuussa julkaisuja tehtiin noin 200 kuukaudessa
   **(lähde)**. Myös arvioissa toistuu julkaisutahti, sekä hyvänä että
   huonona puolena.
8. **Ilmaisuus ja oma tilaus.** MIT, ilmainen, "No login required",
   käyttäjän oma Claude- tai ChatGPT-tilaus. Arviot mainitsevat nämä
   syiksi **(lähde, välillinen)**.
9. **Puhelin.** Mobiilisovellus on uuden README:n ensimmäinen rivi, ja
   käyttäjien kehuissa toistuvat "steerable from your phone" ja "Mac mini
   at home, over Tailscale" **(lähde)**.

### Mitä päättelen

- **Kasvu oli silmukka, ei kampanja.** Trendilista → videot ja listaukset
  ("10 biggest trending repos") → uudet tähdet → lisää aikaa trendilistalla.
  GitHubin trendilista suosii tuoreen aktiivisuuden määrää, joten
  päivittäiset julkaisut ja tuhannet PR:t ovat todennäköisesti pitäneet
  Orcan listalla pidempään kuin pelkkä kiinnostus olisi pitänyt.
  Monikieliset tekijät muuttivat englanninkielisen trendin moneksi
  paikalliseksi trendiksi.
- **README oli tuotteen tärkein mainos.** Tiimi kohteli sitä kuin
  laskeutumissivua (PR-otsikko "conversion"), ja käänne tuli kaksi viikkoa
  sen jälkeen. En voi todistaa syy-yhteyttä. Muuta selitystä kesäkuun
  lopun käänteelle en kuitenkaan löytänyt: ei lehdistöä, ei suurta
  vaikuttajaa ennen 23.6. eikä yksittäistä tuotejulkaisua.
- **Kategorian nimeäminen auttoi.** "ADE" (Agent Development Environment)
  antoi kirjoittajille otsikon ("Orca and the Rise of the ADE", "IDE
  다음은 ADE입니다"), ja vertailut cmuxiin, Conductoriin ja Cursoriin
  antoivat katsojalle valmiin kehyksen.
- **Tiimin koko oli edellytys.** 25 hengen YC-yhtiö, 18 300 committia
  seitsemässä kuukaudessa, jokaiselle agentille oma tuki ja kahdeksan
  käännöstä. Tämä on tuotantokapasiteettia, ei markkinointikikka, eikä
  sitä voi kopioida pienellä tiimillä.

### Orgaaninen, verkosto, maksettu

- **Orgaaninen** (suurin osa): trendilista, kolmansien osapuolten videot ja
  blogit, käyttäjien X-kehut ja Reddit-suositukset. Mikään löytämäni video
  ei ole merkitty sponsoroiduksi, ja yksi kehuja kirjoitti erikseen "(not
  sponsored)" **(lähde)**.
- **Verkosto**: perustajan oma X-tili (suosituin yksittäinen postaus),
  YC-tausta (`yc-backed` aiheena), yhtiön oma X-tili, joka repostasi
  lokakuun lopussa kahdessa päivässä noin 15 käyttäjäkehua, ja onorca.dev,
  jolla lainataan valikoituja X-postauksia **(lähde, välillinen)**.
- **Rajatapaus**: Orcan kehittäjäksi itsensä joissain kommenteissa
  esittelevä Reddit-tili suositteli Orcaa monessa subredditissä, osin
  kertomatta sidonnaisuuttaan ("Just use stablyai/orca. Open source >
  Closed") **(lähde, välillinen)**.
- **Maksettu**: en löytänyt mainontaa, sponsoroituja videoita,
  affiliate-ohjelmaa enkä rahoitusuutisia. Ainoa sponsori on SignPathin
  ilmainen Windows-allekirjoitus **(lähde, välillinen)**. Tähtien
  ostamisesta ei löytynyt syytöksiä eikä riippumatonta tarkistusta.
  Tähtien ja seuraajien suhde (noin 730:1) on samaa luokkaa kuin cmuxilla
  (715:1), mutta korkeampi kuin Claude Codella (170:1), Codexilla (200:1)
  tai Pi:llä (350:1) **(lähde: GitHub API 31.10.)**. Latausmäärien kasvu
  tukee sitä, että käyttäjiä on oikeasti paljon, joten pidän suhdetta
  heikkona signaalina enkä näyttönä mistään **(päättely)**.

## 3. Mitä kriitikot sanoivat

- **Turvallisuus ja oletukset.** Issue #9963 (22.7.) kokosi viisi kohtaa:
  hookit asennettiin muiden agenttien asetuksiin kertomatta, Codexin
  OAuth-tunnukset kopioitiin Orcan dataan, daemon kuunteli osoitteessa
  `0.0.0.0:6768`, telemetria oli päällä ja agentit käynnistettiin
  `--dangerously-skip-permissions`/`--yolo`-lipuilla. Ylläpitäjä vastasi,
  että lupien ohitus on "by design for agent UX" **(lähde)**. Martin Tapia
  (30.9.) poisti Orcan, koska sen CLI antaa minkä tahansa agentin ajaa
  komentoja mihin tahansa käyttäjän avaamaan shelliin, myös etäkoneilla.
  Paluu oli tmuxiin ja eristettyihin hiekkalaatikoihin **(lähde)**.
- **Resurssit.** Arvioiden mukaan joutokäytössä kuluu 400–800 Mt muistia,
  ja asennuspaketti on noin 250 Mt. Issueissa kerrotaan vanhoista
  daemoneista, jotka söivät 25 Gt swapia (#9138), ja 70 roikkuvasta
  PTY:stä, jotka veivät 44,9 Gt muistia (#21556) **(lähde, välillinen)**.
- **Laatu ja tahti.** "far too buggy for me to use every day", "Chat UI
  breaks constantly", `/orchestrate` "clunky" (Reddit elo–syyskuu). Editori
  on liian hidas, eikä vim-näppäimiä ole (HN 29.7.). Asennus ei onnistunut
  otsattomalle palvelimelle (HN 8.9.) **(lähde, välillinen)**.
- **Kustannus.** N agenttia on N kertaa tokenit (r/WebAfterAI, AgentBoards)
  **(lähde, välillinen)**.
- **Kategoria.** AI Insiders ja AgentConn kysyivät, imevätkö isot IDE:t
  ominaisuuden itseensä. Kesällä VS Codeen tuli oma Agents-ikkuna
  **(lähde, välillinen)**.

## 4. Mitä tästä seuraa Open Habitatille

### Mitä kannattaa ottaa

- **README on laskeutumissivu.** Ensimmäinen ruutu kertoo yhdellä
  lauseella, kenelle tuote on. Sen alla on kuva tai GIF ja yksi selvä
  asennuspolku. Ominaisuudet esitetään taulukkona ja niistä linkitetään
  dokumentaatioon.
- **Selkeä kategoria ja vertailukehys.** Lukija tarvitsee lauseen "X, mutta
  Y". Orcalla se oli "Conductor + Ghostty" ja myöhemmin "ADE".
- **Julkinen, säännöllinen muutosloki.** Päivittäinen tahti ei ole
  mahdollinen, mutta näkyvä viikkotahti on, ja se viestii elävästä
  projektista.
- **Integraatio isäntäyhteisöön.** Orca levisi agenttien yhteisöjen kautta.
  Open Habitatin luonteva isäntäyhteisö on Pi.
- **Puhelin on myyntiargumentti.** "Ohjaa agenttia puhelimesta, kun kone
  on palvelimella" toistui Orcan kehuissa. Open Habitatissa sama toimii
  selaimessa ilman sovelluskauppaa.

### Mitä ei kannata ottaa

- **Ilmoittamaton mainostus omilla tileillä.** Sidonnaisuus kerrotaan aina.
- **YOLO-oletukset ja telemetria oletuksena päällä.** Ne olivat Orcan
  kritiikin ydin.
- **Kahdeksan käännöstä ja 35 agenttia ennen kuin perusasia on vakaa.**
  Pienellä tiimillä jokainen käännös ja integraatio on pysyvä
  ylläpitokulu.

## 5. Julkaisusuunnitelma Open Habitatille

### Lähtötilanne (31.10.2026)

- Repo on yksityinen (`Open-Habitat/open-habitat`), eikä sillä ole
  lisenssiä eikä README:tä. `licenses/DEPENDENCIES.md` sanoo itse, ettei
  julkista lisenssiä ole valittu.
- Englanninkielinen käyttöliittymä valmistui 31.10. (issue
  `ui-english-coverage`). `docs/product.md` kuvaa vielä suomenkielistä
  tuotetta.
- Julkaisut ovat jo allekirjoitettuja ja muuttumattomia GitHub-julkaisuja
  (pilot.16). Itsenäinen asennus Ubuntu 24.04:lle on työn alla
  (`customer-install`-kaista). Kaksi asiakaspilottia (Northwind ja Contoso)
  ovat todellisia monen ihmisen asennuksia.
- Tuote tukee yhtä harnessia (Pi) ja yhtä palvelinta.

### Kenelle viesti kohdistetaan

Orcan yleisö on yksittäinen kehittäjä, joka ajaa kymmeniä agentteja omalla
koneellaan. Open Habitatin kannattaa olla avoimesti eri asia **(päättely)**:

1. **Pi:n käyttäjät**, jotka haluavat Pi:n selaimeen ja puhelimeen ilman
   työpöytäsovellusta. Pi 1.0 sai HN:ssä 1 689 pistettä 1.10.2026, ja
   Pi:llä on 119 000 tähteä. Yleisö on suuri, eikä sillä ole vielä
   selainpohjaista monen käyttäjän isäntää.
2. **Itse ylläpitävät ja homelab-väki** (r/selfhosted, Proxmox-käyttäjät,
   awesome-selfhosted), joille "agentti pyörii omalla palvelimellani,
   ja selain on vain ikkuna" on itsessään arvo. Christian Lempan
   homelab-kanava oli Orcan ensimmäinen suuri video.
3. **Pienet tiimit, koulut ja perheet, joilla on yksi palvelin.** Tähän
   kukaan vertailluista ei vastaa: Orcassa palvelimen jakaminen tarkoittaa
   tunnuksen jakamista, ja HumanLayer on maksullinen pilvi.

### Ydinviesti

Ehdotus englanninkieliseksi otsikoksi ja alaotsikoksi:

> **Open Habitat — your team's agents on one Linux server, each person as
> their own Unix user.**
> Sign in from a browser or phone, talk to Pi, close the tab, and the
> agent keeps working. It's the same session you'd reach over SSH and tmux.
> No second history, no cloud, no shared keys.

Kolme todistettavaa erottajaa, joista kukin näytetään eikä vain väitetä:

- **Ihmiset erotetaan Unix-tunnuksilla.** Jokaisella on oma koti, omat
  tunnukset ja oma daemon. Gateway, daemon ja tilien luonnin broker ovat
  erillisiä valtuuksia. Vertaa: Orcan pariutettu asiakas saa
  `accounts-admin`- ja `host-admin`-oikeudet, ja Orcan CLI antaa agentin
  ajaa komentoja käyttäjän kaikissa shelleissä.
- **Selain ensin, natiivi totuus.** Pi:n oma historia, tmux ja tiedostot
  pysyvät sellaisinaan, ja SSH toimii rinnalla. Orca pitää lisäksi omaa
  SQLite-journaalia, PTY-daemonia ja scrollback-tallennetta.
- **Ei kolmatta osapuolta reitillä.** Ei relayta, ei tiliä toimittajalla
  eikä pakollista telemetriaa. HumanLayer synkronoi kaiken omaan
  Postgresiinsa.

Rehellisyys kuuluu viestiin, koska Orcan kritiikki osui juuri liioiteltuihin
väitteisiin. Unix-tunnus erottaa **ihmiset toisistaan**. Se ei erota
agenttia sen omistajan tunnuksista. Agentti toimii omistajansa tilillä
tämän oikeuksin. Tämä on sanottava README:ssä suoraan, jottei väite
"turvallinen" kaadu ensimmäiseen HN-kommenttiin **(päättely)**.

### Mitä pitää olla valmiina ennen julkistusta

Tärkeysjärjestyksessä:

1. **Lisenssi.** Suositus: **Apache-2.0**. Se on yhtä salliva kuin Orcan
   MIT, mutta sisältää patenttilausekkeen, jota yritysten juristit
   kysyvät. Samaa käyttää HumanLayer. AGPL estäisi kilpailevan hostatun
   palvelun, mutta karkottaisi juuri koulut ja yritykset, joille
   itse ylläpidetty palvelin on tarkoitettu. Projekti ei myöskään aio
   myydä hostattua versiota. Lisenssin valinta on Jarin päätös. Se
   kirjataan issueen ja `LICENSE`-tiedostoon. Orcan Show HN:ssä
   ensimmäinen asiakommentti koski puuttuvaa LICENSE-tiedostoa.
2. **README** (englanniksi, lyhyt eikä tekoälyn venyttämä). Sisältö:
   otsikko ja alaotsikko, 20–30 sekunnin GIF, jossa kaksi ihmistä
   kirjautuu samalle palvelimelle, kumpikin näkee vain omansa, selain
   suljetaan, agentti jatkaa ja sama istunto avataan SSH:lla tmuxissa,
   sitten asennus, "How it compares" -taulukko (Orca, HumanLayer, pelkkä
   SSH + tmux), rehellinen "What it is not" (yksi palvelin, yksi harness,
   ei sandbox agentin ja omistajan välillä), tietoturvamalli ja lisenssi.
   Vertailutaulukko kirjoitetaan reilusti, ja Orcan vahvuudet sanotaan
   siinä ääneen.
3. **Kymmenen minuutin asennuspolku** tavalliselle Ubuntu 24.04
   -VPS:lle, jota ulkopuolinen voi kokeilla ilman Fleetrepoa. Tämä on jo
   `customer-install`-kaistan tavoite, ja julkistus kannattaa ajoittaa
   sen valmistumisen mukaan. Vaikein vaihe on GitHub OAuth -sovelluksen
   rekisteröinti, joten se ohjeistetaan kuvin. Orcan julkistus toimi,
   koska latauksen jälkeen kokeilu alkoi heti. Open Habitatissa vastaava
   kitka on palvelimen pystytys, eikä sitä voi poistaa, mutta sen voi
   lyhentää.
4. **Demovideo** (90 s, englanniksi, ääni ja tekstitys). Sama tarina kuin
   GIF:ssä sekä puhelin. Video on samalla Show HN:n ja Redditin
   pääsisältö.
5. **`SECURITY.md` ja lyhyt uhkamallisivu.** Monen käyttäjän turvaväite
   houkuttelee tarkastelua. Haavoittuvuusraporteille annetaan yksityinen
   kanava (GitHub Private Vulnerability Reporting), ja sivulla kerrotaan,
   mitä raja suojaa ja mitä ei. Ennen julkistusta kannattaa ajaa yksi
   ulkopuolinen tai riippumattoman mallin katselmointi juuri
   rajapinnoista (gateway → daemon → broker).
6. **Telemetria pois.** Jos telemetriaa ei ole, se sanotaan README:ssä.
7. **Issue-pohjat ja `CONTRIBUTING.md`.** Ne kertovat, miten GitHubin
   julkiset issuet suhtautuvat sisäiseen issuectl-seurantaan. Shipshape-
   perheessä on tähän valmiit työkalut.
8. **Muutosloki ja julkaisutahti.** Julkinen `CHANGELOG.md` ja
   GitHub-julkaisut, joissa on ihmiselle kirjoitetut muistiinpanot.
9. **Ohjeiden siivous julkista silmää varten.** Repossa on suomenkielisiä
   työmuistioita, asiakasnimiä (Northwind, Contoso, Birch) ja
   infrastruktuuriviitteitä (Alder, Fleetrepo). Ennen kuin repo avataan, ne
   käydään läpi. Myös git-historia tarkistetaan salaisuuksien ja
   yksityisten tietojen varalta. Tämä on peruuttamaton askel, joten se
   tehdään huolella, ja Jari hyväksyy näkyvyyden vaihdon erikseen.

### Kanavat ja järjestys

Orcan opetus on, että julkistus on vasta alku ja kasvu tulee siitä, mitä
tapahtuu sen jälkeen. Siksi järjestys alkaa pienestä ja ystävällisestä
yleisöstä, joka antaa palautetta ennen isoa näyttämöä **(päättely)**.

1. **Viikot −2…0: hiljainen avaus.** Repo julkiseksi, mutta ei
   ilmoitusta. Kaksi tai kolme ulkopuolista Pi-käyttäjää asentaa ohjeen
   mukaan, ja kitka korjataan. Pilottien (Northwind, Contoso) luvalla
   README:hen tulee yksi lause todellisesta käytöstä.
2. **Viikko 1: Pi-yhteisö.** Pi:n omat yhteisökanavat sekä
   r/PiCodingAgent. Viesti: "Pi in the browser, for everyone on your
   server". Pi:n tekijä (Mario Zechner / earendil) kannattaa kertoa ensin
   suoraan: Pi on tuotteen ainoa harness, ja hänen huomionsa on
   tuotteen tärkein yksittäinen verkostokanava. Pyyntö olla mainittuna
   Pi:n dokumentaation tai README:n käyttöliittymälistassa on luonteva.
3. **Viikko 2: Show HN.** Otsikko kertoo erottajan, ei kategoriaa:
   esimerkiksi "Show HN: Open Habitat – Pi agents for a whole team on one
   Linux server, isolated by Unix users". Ensimmäinen kommentti kirjoitetaan
   itse: miksi Unix-tunnukset, mitä raja suojaa ja mitä ei, ja miten tämä
   eroaa Orcasta ja tmuxista. Julkaisu tiistaista torstaihin aamulla
   Yhdysvaltain itärannikon aikaa, ja kommentteihin vastataan koko
   päivän. HN on kuitenkin vain yksi päivä: Orcan 21 pistettä eivät
   estäneet kasvua, eikä hyvä tulos takaa sitä.
4. **Viikot 2–3: r/selfhosted ja homelab.** Erillinen postaus, jossa
   asennus on pääosassa. Lisäksi ehdotus awesome-selfhosted-listaan ja
   lyhyt viesti kahdelle tai kolmelle homelab-YouTubettajalle (esim.
   Christian Lempa), joille tarjotaan valmis testipalvelin tai
   asennusapu. Ei maksua, eikä sisältöön vaikuteta.
5. **Viikot 3–4: suomalainen ja eurooppalainen kanava.** Suomenkielinen
   kirjoitus (esim. oma blogi tai LinkedIn), kouluille ja
   koulutusorganisaatioille suunnattu viesti Northwindin kokemuksella sekä
   mahdollinen esitys suomalaisessa kehittäjätapahtumassa. Tämä on
   kanava, jossa Open Habitatilla on etumatkaa Orcaan: suomenkielinen
   käyttöliittymä, eurooppalainen itse ylläpidetty palvelin ja
   tietosuoja.
6. **Jatkuvasti: X/Bluesky/Mastodon** lyhyillä videoleikkeillä yhdestä
   asiasta kerrallaan (puhelinohjaus, "suljin selaimen, agentti jatkoi",
   kahden ihmisen erottelu). Orcan suosituimmat postaukset olivat juuri
   yhden ominaisuuden demoja.
7. **Ei:** Product Hunt kannattaa vasta, jos sille on erillinen syy. Orcan
   tulos siellä oli vaatimaton, ja yleisö on väärä itse ylläpidettävälle
   palvelinohjelmistolle. Maksettua mainontaa ei kannata käyttää.

### Mitä pieni tiimi jaksaa

Realistinen rytmi, kun koodaustyön tekevät suurelta osin agentit
**(päättely)**:

- **Julkaisu viikoittain** ihmiselle kirjoitetulla muutoslokilla. Ei
  päivittäin. Orcan tahti vaati 25 hengen tiimin.
- **Julkistusviikolla** issueihin ja kommentteihin vastataan
  vuorokauden sisällä. Sen jälkeen kahdesti viikossa sovittuna aikana.
  Agentti voi esitriagata GitHubin issuet issuectl-intakeen, mutta ihminen
  vastaa ihmiselle.
- **Yksi lyhyt demo tai kirjoitus kuukaudessa**, aina yhdestä uudesta
  asiasta.
- **Yksi kieli** (englanti) README:ssä ja dokumentaatiossa sekä suomi
  käyttöliittymässä. Muut käännökset vasta, kun joku yhteisöstä tarjoutuu
  ylläpitämään niitä.
- **Yksi yhteisökanava** (GitHub Discussions riittää alkuun). Discord vasta,
  kun keskustelua on niin paljon, että sille on tarve. Orcalla oli Discord,
  subreddit, X ja WeChat, ja jokaista piti hoitaa.

### Miten tiedetään, toimiiko

Tähdet ovat Orcan pääsuure, mutta Open Habitatille ne ovat sivuseikka.
Seurattavat asiat **(päättely)**:

- ulkopuolisten **onnistuneet asennukset** (kuinka moni pääsee
  kirjautumaan omalle palvelimelleen, ja missä kohtaa muut putoavat),
- asennuksissa olevien **toisten ihmisten** määrä, koska tuotteen idea on
  monta käyttäjää,
- ulkopuoliset issuet ja PR:t sekä vastausaika niihin.

Kohtuullinen odotus on satoja tai muutamia tuhansia tähtiä ensimmäisinä
kuukausina, ei Orcan lukuja. Yleisö on kapeampi, kun asennus vaatii
palvelimen, ja tiimi on pienempi. Kapea yleisö, joka asentaa ja jää, on
arvokkaampi kuin leveä, joka tähdittää ja lähtee.

## Avoimet päätökset Jarille

1. **Lisenssi**: suositus Apache-2.0 (perustelut yllä).
2. **Julkistuksen ajankohta**: suositus on julkaista, kun itsenäinen asennus
   (`customer-install`-kaista) toimii vieraalla VPS:llä. Sitä ennen ei
   kannata, koska Show HN -kävijä, joka ei saa tuotetta pystyyn, ei palaa.
3. **Saako pilotit mainita** (Northwind, Contoso) README:ssä tai
   julkistuksessa.
4. **Kuka puhuu**: Jarin nimissä vai projektin nimissä (oma tili X:ssä tai
   Blueskyssa). Orcassa henkilökohtainen perustajatili toimi paremmin kuin
   yhtiön tili.

## Lähteet

<a id="youtube"></a>**YouTube** (näyttökerrat 31.10.2026; ne, joiden sivun
avasin itse, on merkitty *):
Christian Lempa 21.7. 125 050* <https://www.youtube.com/watch?v=tzDDNWU21uQ>;
Better Stack 23.10. 130 771* <https://www.youtube.com/watch?v=8QgBcI40VC8>;
Eric Tech 22.7. 21 970* <https://www.youtube.com/watch?v=ArIlSal-jFI>;
セイト先生 27.9. 84 487* <https://www.youtube.com/watch?v=vpvW7I968RQ>;
Tonbi's AI Garage 14.9. 62 071 <https://www.youtube.com/watch?v=Tg-6_3iFYPs>;
飯塚浩也 15.10. 42 210 <https://www.youtube.com/watch?v=cY29z3k-zHQ>;
AI超元域 20.7. 34 655 <https://www.youtube.com/watch?v=Ide6kgz6Eyk>;
AICodeKing 10.8. 33 296 <https://www.youtube.com/watch?v=nM6tvi48nMs>;
Joe Maddalone 21.8. 24 524 <https://www.youtube.com/watch?v=vZUUHMCBoQg>;
まさおAIじっくり解説ch 25.6. 23 494 <https://www.youtube.com/watch?v=iq5po7h8nYc>;
クロノITチャンネル 30.8. 23 103 <https://www.youtube.com/watch?v=ptVL2I7z-Eg>;
AI Stack Engineer 20.8. 18 542 <https://www.youtube.com/watch?v=i2hw-Rjnqpo>;
WEBdoze (Short) 3.4. 14 244 <https://www.youtube.com/shorts/b7wHvppJrlU>;
배움의 달인 14.7. 14 059 <https://www.youtube.com/watch?v=8i0HYZq98VI>.
Haku löysi lisäksi noin 25 pienempää videota kesäkuun 24. päivästä alkaen.
Ennen sitä löytyi vain yllä mainittu Short.

**GitHub ja omat mittaukset**

- Repo ja API: <https://github.com/stablyai/orca> (tähdet, forkit ja
  seuraajat 31.10.; vertailurepot `anthropics/claude-code`, `openai/codex`,
  `earendil-works/pi`, `anomalyco/opencode`, `manaflow-ai/cmux`,
  `ghostty-org/ghostty`)
- Julkaisut: <https://github.com/stablyai/orca/releases> (994 julkaisua,
  latausmäärät API:sta)
- README-historia: `gh api repos/stablyai/orca/commits?path=README.md`
- PR #5244 "Redesign README for clarity and conversion" (12.6.): <https://github.com/stablyai/orca/pull/5244>
- Issue #9963 (22.7.): <https://github.com/stablyai/orca/issues/9963>
- Issuet #9138 ja #21556: <https://github.com/stablyai/orca/issues/9138>, <https://github.com/stablyai/orca/issues/21556>
- Wayback, repon etusivu (44 kuvaa 27.3.–24.10.): <https://web.archive.org/web/2026*/github.com/stablyai/orca>
- Wayback, GitHub Trending (päivä 1.6.–15.8., viikko 1.6.–22.10.): <https://web.archive.org/web/2026*/github.com/trending*>
- Wayback, onorca.dev (3.4., 11.6., 1.8., 1.10.): <https://web.archive.org/web/2026*/onorca.dev>

**Hacker News**

- Show HN 27.3.: <https://news.ycombinator.com/item?id=47549197>
- Pi 1.0 (1.10., 1 689 pistettä): <https://news.ycombinator.com/item?id=49926069>
- Kommentit 29.7., 8.9. ja 1.10.: <https://news.ycombinator.com/item?id=49103047>, <https://news.ycombinator.com/item?id=49606598>, <https://news.ycombinator.com/item?id=49926533>
- CodeRabbit 8.10.: <https://news.ycombinator.com/item?id=50007033>

**X** (tykkäykset X:n embed-rajapinnasta 31.10.)

- Jinjing Liang 2.4.: <https://x.com/JinjingLiang/status/2039775250133709047>
- @orca_build 3.4.: <https://x.com/orca_build/status/2040147412002697617>
- @Yonah_x 11.4.: <https://x.com/Yonah_x/status/2042797318064497066>
- @EXM7777 23.6.: <https://x.com/EXM7777/status/2069416164565103076>
- Matt Van Horn 10.7.: <https://x.com/mvanhorn/status/2075675490082590913>
- Jason Zhou 12.7.: <https://x.com/jasonzhou1993/status/2076256816934392155>
- @orca_build 15.10.: <https://x.com/orca_build/status/2110804889928692105>

**Muut**

- Product Hunt: <https://www.producthunt.com/products/orca-5>
- AI Insiders 26.6.: <https://aiinsiders.net/article/stably-ships-orca-an-open-source-ide-built-for-fleets-of>
- Martin Tapia 30.9.: <https://martintapia.com/blog/2026/i-tried-orca-and-vscode-agents-window-i-went-back-to-tmux-shortly-after>
- Yuzheng Sun 15.9.: <https://yuzheng.substack.com/p/when-twenty-ai-agents-need-one-human>
- HIMIAO 19.10.: <https://himiao.ai/en/news/2026-10-19-stablyai-orca-trending>
- Star History: <https://www.star-history.com/stablyai/orca/>
- Trendshift (1.9.–31.10.): <https://trendshift.io/repositories/26256>
- AgentConn 24.8.: <https://agentconn.com/blog/orca-ade-agent-fleet-parallel-coding-agents-2026/>

**Reddit** (sivuja ei voinut avata suoraan, joten tiedot ovat
PullPush-arkistosta hakutyökalun kautta)

- r/OrcaADE 6.6.: <https://www.reddit.com/r/OrcaADE/comments/1tyuv32/>
- r/conductorbuild 1.8.: <https://www.reddit.com/r/conductorbuild/comments/1vcckih/>
- r/ClaudeCode 23.8.: <https://www.reddit.com/r/ClaudeCode/comments/1vwjgyv/>
- Ilmoittamaton suositus: <https://www.reddit.com/r/ClaudeCode/comments/1sljk0t/claude_code_just_got_a_full_desktop_redesign/og9q44x/>

[shn]: https://news.ycombinator.com/item?id=47549197
[jl-0402]: https://x.com/JinjingLiang/status/2039775250133709047
[ob-0403]: https://x.com/orca_build/status/2040147412002697617
[ph]: https://www.producthunt.com/products/orca-5
[yonah]: https://x.com/Yonah_x/status/2042797318064497066
[r-orcaade]: https://www.reddit.com/r/OrcaADE/comments/1tyuv32/
[pr5244]: https://github.com/stablyai/orca/pull/5244
[exm-0623]: https://x.com/EXM7777/status/2069416164565103076
[aiins]: https://aiinsiders.net/article/stably-ships-orca-an-open-source-ide-built-for-fleets-of
[mvh]: https://x.com/mvanhorn/status/2075675490082590913
[jz]: https://x.com/jasonzhou1993/status/2076256816934392155
[lempa]: https://www.youtube.com/watch?v=tzDDNWU21uQ
[i9963]: https://github.com/stablyai/orca/issues/9963
[r-cond]: https://www.reddit.com/r/conductorbuild/comments/1vcckih/
[sh]: https://www.star-history.com/stablyai/orca/
[r-cc]: https://www.reddit.com/r/ClaudeCode/comments/1vwjgyv/
[cr]: https://news.ycombinator.com/item?id=50007033
[yz]: https://yuzheng.substack.com/p/when-twenty-ai-agents-need-one-human
[tapia]: https://martintapia.com/blog/2026/i-tried-orca-and-vscode-agents-window-i-went-back-to-tmux-shortly-after
[pi1]: https://news.ycombinator.com/item?id=49926069
[ob-1015]: https://x.com/orca_build/status/2110804889928692105
[himiao]: https://himiao.ai/en/news/2026-10-19-stablyai-orca-trending
[bs]: https://www.youtube.com/watch?v=8QgBcI40VC8
