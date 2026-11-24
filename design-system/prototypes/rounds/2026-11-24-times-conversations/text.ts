// The round's own words in both languages: review chrome, the synthetic
// conversation and the pieces this round draws. Production components bring
// their own words through the app's i18n.

export type Lang = 'fi' | 'en';
export type Zone = 'Europe/Helsinki' | 'America/New_York';
export type Run = 'done' | 'running';

const fi = {
  lang: 'fi' as Lang,
  title: 'Ajat keskustelussa · kierros 1',
  theme: 'Teema', themes: {light: 'Päivä', dark: 'Yö', contrast: 'Korkea kontrasti'},
  language: 'Kieli',
  zone: 'Laitteen aikavyöhyke', zones: {'Europe/Helsinki': 'Helsinki', 'America/New_York': 'New York'} as Record<Zone, string>,
  run: 'Viimeinen vuoro', runs: {done: 'Valmis', running: 'Käynnissä'} as Record<Run, string>,
  reset: 'Alusta',
  hint: 'Valitsin (alhaalla) vaihtaa suuntaa. Keskustelu alkoi perjantaina, ”nyt” on tiistai 24.11. klo 10.12 Helsingin aikaa.',
  all: 'Näytä kaikki suunnat ja suositus', fewer: 'Näytä vain valittu',
  picker: ['Nyt', 'A Päivät', 'B Kello', 'C Tauot'],
  axis: 'Akseli: kuinka paljon aikaa näkyy oletusnäkymässä',
  lines: [
    'Nyt: viesteissä ei ole aikoja. Vain työrivi kertoo, kauanko vaihe kesti (”2 työkalua · 41 s”), käynnissä oleva vuoro näyttää kellon, ja sivupalkin rivi kertoo iän (”17 t”, ”1 pv”). Perjantain ja tämän aamun viestit näyttävät samanikäisiltä.',
    'A Päivät: päivän vaihtuessa keskustelussa on erotin (Pe 20.11., Eilen, Tänään). Kellonaika on jokaisessa viestissä, mutta näkyy vasta osoittimen alla, kohdistettuna tai napautettuna. Ruudunlukija lukee sen aina.',
    'B Kello: päiväerottimet ja hillitty kellonaika jokaisen viestin otsakkeessa, sinun ja agentin. Agentin vastauksessa aika on oikeassa reunassa, minne tuotannon tyyli sen jo asettaa.',
    'C Tauot: aika näkyy vain, kun viestien väliin jää yli tunnin tauko (”Eilen 9.15 · 2 päivän tauon jälkeen”). Yli kahden minuutin vuoron loppuun tulee rivi ”Valmis 17.03 · vuoro kesti 23 min”. Lyhyet vaihdot jäävät ilman aikoja.',
  ],
  recommend: 'Suositus B: aika on aina samassa paikassa ja näkyy ilman osoitinta myös puhelimella, ja päiväerotin kertoo jatketun keskustelun yhdellä silmäyksellä. Tuotannon viestikortit ottavat ajan jo vastaan, joten muutos on pieni. C on hiljaisin, mutta aika puuttuu juuri silloin, kun joku kysyy ”milloin tämä tehtiin?”. A piilottaa ajan puhelimelta.',
  // Day separators and gap markers.
  today: 'Tänään', yesterday: 'Eilen',
  gapDays: (n: number) => `${n} päivän tauon jälkeen`,
  gapHours: (n: number) => `${n} tunnin tauon jälkeen`,
  turnDone: (at: string, took: string) => `Valmis ${at} · vuoro kesti ${took}`,
  turnRunning: (at: string) => `Aloitettu ${at}`,
  minutes: (n: number) => `${n} min`,
  hours: (h: number, m: number) => (m ? `${h} t ${m} min` : `${h} t`),
  tapHint: 'Napauta viestiä nähdäksesi ajan.',
  railHead: 'Keskustelut',
  railNote: 'Sivupalkin rivin ikä (tuotanto): kulunut aika viimeisestä muutoksesta. ”Eilen” keskustelussa ja ”17 t” rivillä kertovat saman asian eri mittarilla.',
  // The synthetic conversation.
  convTitle: 'Vuosikertomus 2026', ws: 'vuosikertomus',
  activityIdle: 'Odottaa viestiä', activityWorking: 'Työskentelee',
  rail: ['Budjetti 2027', 'Kuvapankki', 'Kokousmuistiot'],
  working: 'Agentti päivittää kuvia',
  u: [
    'Tee vuosikertomukselle runko: luvut, otsikot ja kenen vastuulla mikin on. Pohjana `docs/2025.md`.',
    'Lisää talousosio luvuista `data/talous.csv` ja tee siitä kaksi kaaviota.',
    'Jatketaan. Talousosasto toimitti korjatut luvut tiedostoon `data/talous-v2.csv`. Tarkista erot ja päivitä kaaviot.',
    'Montako sivua nyt on?',
    'Aja koko taitto PDF:ksi ja tarkista, ettei mikään kuva ole alle 300 dpi.',
    'Sivun 4 kuvat ovat edelleen rakeisia. Hae alkuperäiset kuvapankista ja vaihda ne.',
  ],
  interim: 'Talousosio on luonnoksena. Teen seuraavaksi kaaviot, ja se vie hetken, koska data on kuukausitasolla.',
  a: [
    'Runko on tiedostossa `docs/2026.md`: seitsemän lukua, jokaiselle vastuuhenkilö ja määräpäivä. Luku 3 (talous) odottaa lukuja.',
    'Talousosio on valmis: `docs/2026.md` luku 3 ja kaaviot `charts/liikevaihto.svg` ja `charts/kulut.svg`.',
    'Korjatuissa luvuissa muuttui kaksi riviä: Q3:n kulut ja henkilöstömäärä. Päivitin luvun 3 ja kummankin kaavion.',
    'Taitossa on nyt 18 sivua.',
    'PDF on valmis: `out/vuosikertomus-2026.pdf`, 18 sivua. Sivun 4 kaksi kuvaa ovat 150 dpi, muut vähintään 300.',
    'Vaihdoin sivun 4 kaksi kuvaa alkuperäisiin (`kuvat/tehdas-01.tif`, `kuvat/tehdas-02.tif`) ja ajoin taiton uudelleen. Kaikki kuvat ovat nyt vähintään 300 dpi.',
  ],
  done: 'Valmis', running: 'Käynnissä',
};

export type Text = typeof fi;

const en: Text = {
  lang: 'en',
  title: 'Times in a conversation · round 1',
  theme: 'Theme', themes: {light: 'Day', dark: 'Night', contrast: 'High contrast'},
  language: 'Language',
  zone: 'Device time zone', zones: {'Europe/Helsinki': 'Helsinki', 'America/New_York': 'New York'},
  run: 'Last turn', runs: {done: 'Done', running: 'Running'},
  reset: 'Reset',
  hint: 'The picker (bottom) switches direction. The conversation began on Friday; “now” is Tuesday 24 Nov at 10:12 Helsinki time.',
  all: 'Show all directions and the recommendation', fewer: 'Show only the chosen one',
  picker: ['Now', 'A Days', 'B Clock', 'C Gaps'],
  axis: 'Axis: how much time the default view shows',
  lines: [
    'Now: messages carry no times. Only the work row says how long a stage took (“2 tools · 41 s”), a running turn shows a clock, and the rail row shows an age (“17 h”, “1 d”). Friday’s messages and this morning’s look the same age.',
    'A Days: a separator where the day changes (Fri 20 Nov, Yesterday, Today). Every message has its time, shown under the pointer, on focus or on tap. A screen reader always reads it.',
    'B Clock: day separators and a quiet time in every message header, yours and the agent’s. On the agent’s reply the time sits at the right edge, where the production style already puts it.',
    'C Gaps: a time only where more than an hour passes between messages (“Yesterday 9:15 · after a 2-day break”). A turn longer than two minutes ends with “Done 17:03 · the turn took 23 min”. Short exchanges stay without times.',
  ],
  recommend: 'Recommendation B: the time is always in the same place and visible without a pointer on a phone too, and a day separator tells at a glance that a conversation was resumed. The production message cards already accept a time, so the change is small. C is the quietest, but the time is missing exactly when someone asks “when was this done?”. A hides the time on a phone.',
  today: 'Today', yesterday: 'Yesterday',
  gapDays: (n) => `after a ${n}-day break`,
  gapHours: (n) => `after ${n} h`,
  turnDone: (at, took) => `Done ${at} · the turn took ${took}`,
  turnRunning: (at) => `Started ${at}`,
  minutes: (n) => `${n} min`,
  hours: (h, m) => (m ? `${h} h ${m} min` : `${h} h`),
  tapHint: 'Tap a message to see its time.',
  railHead: 'Conversations',
  railNote: 'The rail row’s age (production): time since the last change. “Yesterday” in the conversation and “17 h” on the row say the same thing on different scales.',
  convTitle: 'Annual report 2026', ws: 'vuosikertomus',
  activityIdle: 'Waiting for a message', activityWorking: 'Working',
  rail: ['Budget 2027', 'Image bank', 'Meeting notes'],
  working: 'The agent is updating images',
  u: [
    'Draft an outline for the annual report: chapters, headings and who owns what. Base it on `docs/2025.md`.',
    'Add the finance section from `data/talous.csv` and make two charts of it.',
    'Let’s continue. Finance sent corrected figures in `data/talous-v2.csv`. Check the differences and update the charts.',
    'How many pages is it now?',
    'Run the whole layout to PDF and check that no image is below 300 dpi.',
    'The images on page 4 are still grainy. Get the originals from the image bank and swap them in.',
  ],
  interim: 'The finance section is drafted. I’ll do the charts next; that takes a moment because the data is monthly.',
  a: [
    'The outline is in `docs/2026.md`: seven chapters, each with an owner and a due date. Chapter 3 (finance) waits for figures.',
    'The finance section is done: `docs/2026.md` chapter 3 and the charts `charts/liikevaihto.svg` and `charts/kulut.svg`.',
    'Two rows changed in the corrected figures: Q3 costs and headcount. I updated chapter 3 and both charts.',
    'The layout is now 18 pages.',
    'The PDF is ready: `out/vuosikertomus-2026.pdf`, 18 pages. Two images on page 4 are 150 dpi; the rest are at least 300.',
    'I replaced the two images on page 4 with the originals (`kuvat/tehdas-01.tif`, `kuvat/tehdas-02.tif`) and ran the layout again. Every image is now at least 300 dpi.',
  ],
  done: 'Done', running: 'Running',
};

export const TEXT: Record<Lang, Text> = {fi, en};
