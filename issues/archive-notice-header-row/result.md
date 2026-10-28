# Tulos: ilmoitukset hiljaisena rivinä yläpalkissa

Toteuttaa Otsakerivin (proto-archive-notice-placement, kierros 2, vaiheet 1–3).

- **Yksi ilmoitusalue** (`web/src/components/NoticeArea.tsx`). `AppShell` pitää sen,
  joten kaikki sovelluksen ilmoitukset kulkevat saman alueen kautta: keskustelun
  arkistointi ja tilanvaihto (App.tsx), roskakori (`TrashNotice`) sekä työtilan
  arkistointi (`WorkspacePage`). Jokainen ilmoitus pysyy omistajansa luona ja
  ilmoittautuu alueelle, ja sen rivi siirretään aktiiviseen paikkaan. Siksi
  omistajan tila säilyy, kun reitti ja sen mukana yläpalkki vaihtuvat.
  Saman lajin uusi ilmoitus sulkee vanhan omistajansa kautta.
- **Paikka yläpalkissa** (`NoticeSlot`): keskustelun otsakkeessa (`AgentHeader`)
  rivi on pääriviltä alaspäin otsakkeen sisällä, ja otsakkeen lyhentäminen
  mittaa edelleen vain pääriviä. Muilla sivuilla rivi on sisällön yläreunassa,
  ja puhelimessa se on heti valikkorivin alla. Rivi pysyy näkyvissä, kun sivua
  vieritetään. Se työntää sisältöä alas eikä peitä mitään.
- **`ArchiveNotice` on rivi**, jossa on kuvake, teksti, toiminnot ja ×. Uusin rivi
  näkyy, ja *+N* avaa muut. Taitettujen kello on pysähdyksissä. Elinaika on
  20 s, ja osoitin tai fokus missä tahansa alueella pysäyttää kaikki kellot.
  Kesken oleva (`busy`) tai epäonnistunut (`problem`) ilmoitus pysyy auki ja
  rivittyy. Esc sulkee ilmoituksen vain sen sisältä. Jos suljettu ilmoitus
  piti fokusta, fokus palaa kenttään tai sivulle. Ilmoitus ei koskaan ota
  fokusta itse.
- Päätteen `ToastRegion` on ennallaan (vaihe 4, myöhemmin).

## Todisteet

- Kuvat ovat hakemistossa `evidence/` laitteen skaalauksella 2: työpöytä
  1440 px ja puhelin 390 px, vaalea ja tumma. `*-tyotilasivu` on arkistoinnin
  jälkeen, `*-pino` näyttää kaksi ilmoitusta ja *+1*, `*-pino-auki` avatun
  pinon ja `*-seuraava` seuraavan keskustelun, jonka otsakkeessa rivi on.
  Kuvat on otettu skriptillä `web/lab/capture-archive-notice-header-row.mjs`
  synteettisessä labrassa. Kesken jäänyttä poistoa ei kuvattu, koska labra ei
  tuota osittaista poistoa helposti. Sen käytös (pysyy auki ja rivittyy) on
  yksikkötestien ja CSS:n varassa.
- `NoticeArea.test.tsx` testaa korvaamisen lajin mukaan, kumoamisen järjestyksen
  edessä, *+N*:n, taitetun ilmoituksen pysähtyneen kellon, koko alueen tauon
  sekä sen, että Esc toimii vain sisältä ja fokus palaa.
- Selaintestit: `browser-conversation` (arkistotestit; 20 s elinaika, rivi
  seuraavan keskustelun otsakkeessa ja kentän Esc ei sulje),
  `lab-workspace-page` (pino, *+N*, Esc sisältä ja fokus sivulle),
  `single-workspace-mode`, `workspace-archive`, `mutation-layer`,
  `lab-workspace-trash` ja `lab-idle-pi-slots`. Kaikki kohdennetut ajot
  menivät läpi. Koko selainsarjaa ei ajettu (kapellimestari ajaa sen mainissa).

## Päätökset myöhempää tarkistusta varten

- **Työpöydän sivut, joilla ei ole omaa yläpalkkia** (työtilasivu, etusivu,
  asetukset), saavat rivin sisältösarakkeen yläreunaan sivun otsakkeen yläpuolelle.
  Rivi pysyy näkyvissä vierittäessä. Vaihtoehto oli lisätä jokaiselle
  työpöytäsivulle oikea yläpalkki, kuten vedoksessa. Se olisi iso muutos
  sivujen asetteluun tämän issuen ulkopuolelle. Puhelimessa rivi jatkaa
  valikkoriviä, joten siellä se on aidosti yläpalkissa.
- **Kumottava ilmoitus on aina ennen pelkkää tiedotetta.** Muuten järjestys on
  uusin ensin. Kun toiseksi viimeinen työtila arkistoidaan, syntyy samalla
  tilanvaihdon tiedote, ja tiukassa uusin ensin -järjestyksessä se olisi
  taittanut juuri tehdyn toiminnon *Kumoa*-painikkeen piiloon. Vaihtoehtoja
  olivat tiukka uusin ensin (kuten vedos) tai tiedotteen yhdistäminen
  arkistoinnin ilmoitukseen samaan tapaan kuin roskakorissa. Valitsin
  järjestyssäännön, koska se koskee kaikkia samanlaisia tilanteita. Tiedotteen
  kello odottaa taitettuna, joten se näkyy kumoamisen jälkeen kokonaan.
- **Keskustelun arkistointi ja työtilan arkistointi ovat eri lajeja**, joten
  ne pinoutuvat eivätkä korvaa toisiaan. Molemmilla on oma kumoamisensa.
- **Toimintopainikkeilla on sävytetty pinta**, kuten tuotannon muillakin
  tekstipainikkeilla (design-järjestelmän sääntö "buttons-no-surface").
  Vedoksessa ne olivat pelkkää korostusväristä tekstiä.
- **Työtilan arkistoinnin ilmoitus kuuluu edelleen työtilasivulle**, ja se
  katoaa, kun sivulta lähtee, kuten ennenkin. Vaihtoehto on nostaa se
  App.tsx:ään, jolloin se seuraisi navigointia samoin kuin keskustelun
  arkistointi.
- **Esc sulkee vain sisältä.** Tämä on vedoksen ja tuloksen mukainen. Jari ei
  ole vielä vastannut kierroksen 1 kysymykseen 3.
- **Kuvakkeet**: arkistointi on arkistolaatikko, roskakori roskakori,
  tilanvaihto info-kuvake ja työtilan arkistointi yliviivattu silmä
  (työtilasivun oma arkistointipainike). Virheessä kuvake on varoituskuvake.
- **Fokuksen paluu**: kun fokusta pitänyt ilmoitus suljetaan, fokus menee
  sivun viestikenttään, tai jos kenttää ei ole, sivun sisältöön (`#main`).
