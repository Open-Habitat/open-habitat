// What each server section is built from today (read from the production
// code and its rendering in this round) and which shared parts it uses
// under each norm. The panel under every section shows the list.
type Part = 'lead' | 'row' | 'meter' | 'amount' | 'subhead' | 'people' | 'own';
const PART: Record<Part, {a: string; b: string; c: string}> = {
  lead: {a: 'Johdanto kortin yllä (s-intro)', b: 'Ei johdantoa: selitys ensimmäisen rivin selitteessä', c: 'Johdanto kortin yllä (s-intro)'},
  row: {a: 'Kortti ja rivit: nimi, selite, arvo oikealla (s-card, s-row)', b: 'Kortti ja rivit: nimi, selite, arvo oikealla (s-card, s-row)', c: 'Kortti ja rivit: nimi, selite, arvo oikealla (s-card, s-row)'},
  meter: {a: 'Mittari: paksu kaksivärinen palkki, selite värineliöin ja luvut oikealla', b: 'Mittari: luvut tekstinä oikealla ja ohut palkki niiden alla (s-bar)', c: 'Mittari: luvut otsikon oikealla puolella, paksu palkki ja selite'},
  amount: {a: 'Luku: stepper (− 4 +) yksikön kanssa', b: 'Luku: tekstikenttä yksikön kanssa, tallentuu kentästä poistuttaessa', c: 'Luku: stepper (− 4 +) yksikön kanssa'},
  subhead: {a: 'Väliotsikko kortin ulkopuolella (s-h3), sen alla oma kortti', b: 'Ei väliotsikkoa: taulukon otsikkorivi samassa kortissa', c: 'Väliotsikko kortin ulkopuolella (s-h3), sen alla oma kortti'},
  people: {
    a: 'Henkilölista: nimi ja selite (tila tekstinä), rivin oma säädin; oma raja ja Oletukseen',
    b: 'Taulukko: sarakkeet, solussa luku + ohut palkki, Muuta… avaa kentän ja Tallenna/Peruuta',
    c: 'Henkilölista sarakeotsikoin: nimi, lukema-sarake (luku + ohut palkki tai tilamerkki), stepper, Oletukseen',
  },
  own: {a: 'Oma editori (reitti ja vaiheen asetukset) ennallaan', b: 'Oma editori (reitti ja vaiheen asetukset) ennallaan', c: 'Oma editori (reitti ja vaiheen asetukset) ennallaan'},
};
const USES: Record<string, Part[]> = {
  keskustelut: ['lead', 'row', 'meter', 'amount', 'subhead', 'people'],
  levy: ['lead', 'row', 'meter', 'amount', 'subhead', 'people'],
  palvelin: ['lead', 'row'],
  kayttajat: ['lead', 'row', 'subhead', 'people'],
  aiavain: ['lead', 'row', 'subhead', 'people'],
  saneluavain: ['lead', 'row'],
  palvelinintegraatiot: ['lead', 'people'],
  kayttoonotto: ['own'],
};
const NOW: Record<string, string[]> = {
  keskustelut: [
    'Johdanto kortin yllä (s-intro)',
    'Kortti ja rivit (s-card, s-row)',
    'Mittari 12 px, kaksi väriä: käytössä nyt ja pahin tapaus; selite värineliöin, luvut oikealla; ylitysvaroitus',
    'NumberStepper yksiköllä (Raja henkilöä kohden)',
    'Väliotsikko HENKILÖT kortin ulkopuolella (s-h3)',
    'Henkilölista omana korttinaan: nimi + oletus/oma raja, stepper, Oletukseen',
    'Tilarivi (Tallennetaan…); muutos tallentuu hetken päästä',
  ],
  levy: [
    'Ei johdantoa',
    'Yksi kortti; Levy-rivi: luvut tekstinä oikealla + ohut 6 px palkki (s-bar)',
    'Oletusraja tekstikenttänä (InlineTextSetting, GiB), vain kun rajat ovat käytössä',
    'Taulukko kortin sisällä (s-table): Käyttäjä, Tallennustila, Toiminnot',
    'Solussa 14,2 GiB / 40 GiB + ohut palkki; oma raja ja oletus eivät erotu',
    'Raja…-painike avaa kentän, Tallenna raja ja Peruuta',
    'Rajojen summaa (ylivaraus) ei mittarissa, vain selitteen lauseena',
  ],
  palvelin: [
    'Ei johdantoa',
    'Kortti: nimi tekstikenttänä (InlineTextSetting), oletuskieli valintana, versio monospacella',
  ],
  kayttajat: [
    'Ei johdantoa',
    'Kortti: tekstialue + Tarkista (salli tunnus)',
    'Henkilöt 6 -otsikko kortin sisällä ja suodatinvälilehdet',
    'Henkilörivi: @tunnus + tilamerkki, Unix-rivi, painikkeet oikealla',
    'Jaetut linkit -rivi samassa kortissa',
  ],
  aiavain: [
    'Johdanto kortin sisällä',
    'Avainrivi painikkein',
    'Toinen kortti: Jo liittyneet -otsikkorivi ja pääpainike',
    'Henkilörivi: @tunnus, Unix-nimi, päivämäärä oikealla; alaviite',
  ],
  saneluavain: [
    'Johdanto kortin yllä',
    'Merkitty rivi kuvakkeella (s-marked), painikkeet',
    'Oikeudet ja säilytys -avattava',
  ],
  palvelinintegraatiot: [
    'Johdanto kortin sisällä',
    'Palvelurivi: kirjainmerkki, nimi, tila (✓ / ○), Tunnukset-painike',
    'Sisennetyt tasorivit palvelun alla',
  ],
  kayttoonotto: [
    'Johdanto kortin yllä + Näytä henkilön näkymä',
    'Leveä kaksipalstainen editori: reitti ja vaiheen asetukset',
    'Segmented, oma Henkilö näkee -laatikko',
  ],
};
export const INVENTORY: Record<string, {now: string[]; a: string[]; b: string[]; c: string[]}> = Object.fromEntries(
  Object.keys(USES).map((id) => [id, {
    now: NOW[id],
    a: USES[id].map((p) => PART[p].a),
    b: USES[id].filter((p) => !(p === 'subhead')).map((p) => PART[p].b),
    c: USES[id].map((p) => PART[p].c),
  }]),
);
/** The shared parts a new server section (for example disks) is written
 * from under each norm. */
export const KIT: Record<'a' | 'b' | 'c', string[]> = {
  a: (['lead', 'row', 'meter', 'amount', 'subhead', 'people'] as Part[]).map((p) => PART[p].a),
  b: (['lead', 'row', 'meter', 'amount', 'people'] as Part[]).map((p) => PART[p].b),
  c: (['lead', 'row', 'meter', 'amount', 'subhead', 'people'] as Part[]).map((p) => PART[p].c),
};
