// The round's own words in both languages: review chrome, the synthetic
// conversation and the pieces this round draws. Production components bring
// their own words through the app's i18n.

export type Lang = 'fi' | 'en';
export type Zone = 'Europe/Helsinki' | 'America/New_York';
export type Run = 'done' | 'running';

const fi = {
  lang: 'fi' as Lang,
  title: 'Ajat keskustelussa · kierros 2',
  theme: 'Teema', themes: {light: 'Päivä', dark: 'Yö', contrast: 'Korkea kontrasti'},
  language: 'Kieli',
  zone: 'Laitteen aikavyöhyke', zones: {'Europe/Helsinki': 'Helsinki', 'America/New_York': 'New York'} as Record<Zone, string>,
  run: 'Viimeinen vuoro', runs: {done: 'Valmis', running: 'Käynnissä'} as Record<Run, string>,
  reset: 'Alusta',
  hint: 'Valitsin (alhaalla) vaihtaa suuntaa. Keskustelu alkoi perjantaina, ”nyt” on tiistai 24.11. klo 10.12 Helsingin aikaa.',
  all: 'Näytä kaikki suunnat ja suositus', fewer: 'Näytä vain valittu',
  picker: ['Nyt (B)', 'A Otsake', 'B Kuplan alla', 'C Marginaali'],
  axis: 'Kierros 2, B:n ja päiväerottimien päällä: missä aika on viestissä ja miten pitkä vuoro päättyy',
  lines: [
    'Nyt (kierroksen 1 B): aika jokaisen viestin otsakkeessa, sinun viestissäsi kopioi-painikkeen jälkeen ja agentin vastauksessa oikeassa reunassa. Loppuriviä ei ole: pitkän vuoron kesto on työrivillä (”3 työkalua · 23 min 05 s”) ja valmistumisaika vastauksen ajassa.',
    'A Otsake: aika heti nimen perässä kaikissa viesteissä (”Sinä 16.40”, ”✓ Vastaus valmis 17.03”). Yli 5 minuutin vuoron viimeinen vastaus jatkaa samaa riviä: ”✓ Vastaus valmis 17.03 · vuoro kesti 23 min”. Uutta riviä ei tule, ja vastauksen aika on vuoron loppu.',
    'B Kuplan alla: otsakkeessa ei ole aikaa. Aika on pienenä kuplan alla sen omalla puolella, sinun oikealla ja agentin vasemmalla. Yli 2 minuutin vuoron viimeisen vastauksen alla rivi kuuluu ”Valmis 17.03 · vuoro kesti 23 min”, joten loppurivi on vastauksen oma aikarivi.',
    'C Marginaali: aika on keskustelun reunassa viestin otsakkeen korkeudella, agentin viesteissä vasemmalla ja sinun oikealla, ja sarakkeen voi lukea alas kuin lokia. Yli 10 minuutin vuorossa vastauksen ajan alla on kesto (”23 min”). Reunat vievät puhelimella leveyttä.',
  ],
  recommend: 'Suositus A: aika on samassa kohdassa kummankin viesteissä, nimen vieressä, ja pitkän vuoron loppu on vastauksen otsakkeessa ilman uutta riviä. ”Vastaus valmis 17.03” on tuotannon otsake ja aika peräkkäin, joten valmistumisaika ei toistu. B lisää rivin jokaisen kuplan alle, ja C:n reunat syövät puhelimen leveyttä.',
  // Day separators and the long turn's end.
  today: 'Tänään', yesterday: 'Eilen',
  turnDone: (at: string, took: string) => `Valmis ${at} · vuoro kesti ${took}`,
  turnTook: (took: string) => `vuoro kesti ${took}`,
  minutes: (n: number) => `${n} min`,
  hours: (h: number, m: number) => (m ? `${h} t ${m} min` : `${h} t`),
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
  title: 'Times in a conversation · round 2',
  theme: 'Theme', themes: {light: 'Day', dark: 'Night', contrast: 'High contrast'},
  language: 'Language',
  zone: 'Device time zone', zones: {'Europe/Helsinki': 'Helsinki', 'America/New_York': 'New York'},
  run: 'Last turn', runs: {done: 'Done', running: 'Running'},
  reset: 'Reset',
  hint: 'The picker (bottom) switches direction. The conversation began on Friday; “now” is Tuesday 24 Nov at 10:12 Helsinki time.',
  all: 'Show all directions and the recommendation', fewer: 'Show only the chosen one',
  picker: ['Now (B)', 'A Header', 'B Under', 'C Margin'],
  axis: 'Round 2, on top of B and the day separators: where the time sits on a message and how a long turn ends',
  lines: [
    'Now (round 1 B): a time in every message header, after the copy button on yours and at the right edge of the agent’s reply. No closing line: a long turn’s duration is on the work row (“3 tools · 23 min 05 s”) and its end time is the reply’s time.',
    'A Header: the time right after the name on every message (“You 16:40”, “✓ Reply done 17:03”). The last reply of a turn longer than 5 minutes continues the same line: “✓ Reply done 17:03 · the turn took 23 min”. No new line; the reply’s time is the end of the turn.',
    'B Under: no time in the header. A small time under each bubble on its own side, yours on the right and the agent’s on the left. Under the last reply of a turn longer than 2 minutes the line reads “Done 17:03 · the turn took 23 min”, so the closing line is the reply’s own time line.',
    'C Margin: the time sits at the edge of the conversation level with the message header, the agent’s on the left and yours on the right, and the column reads down like a log. On a turn longer than 10 minutes the duration (“23 min”) is under the reply’s time. The margins cost width on a phone.',
  ],
  recommend: 'Recommendation A: the time is in the same spot on both sides’ messages, next to the name, and a long turn’s end is in the reply header without a new line. “Reply done 17:03” is production’s header followed by the time, so the end time is not repeated. B adds a line under every bubble, and C’s margins eat a phone’s width.',
  today: 'Today', yesterday: 'Yesterday',
  turnDone: (at, took) => `Done ${at} · the turn took ${took}`,
  turnTook: (took) => `the turn took ${took}`,
  minutes: (n) => `${n} min`,
  hours: (h, m) => (m ? `${h} h ${m} min` : `${h} h`),
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
