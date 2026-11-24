// The round's words, Finnish only (the round is reviewed in Finnish; the
// production guide's English stays as it is). Google Cloud's own menu,
// field and button names stay in English as the console shows them. Of
// Google's Finnish refusal page only the heading "Pääsy estetty" and the
// line "Virhe 403: org_internal" are known from a report; the rest of
// Google's wording is written with "…" rather than guessed.

export type Gs = 'internal' | 'testing' | 'production';
export type CaseId = 'org_internal' | 'access_denied' | 'expired' | 'admin_policy' | 'cap' | 'rate' | 'warning';

export const T = {
  title: 'Google ja henkilökohtaiset tilit · ylläpitäjä · kierros 1',
  roundLine:
    'Akseli: mistä ylläpitäjä (ja sen kautta henkilö) tietää, kenen Google-tilit tämän palvelimen sovellukseen pääsevät. Sisältö on sama kaikissa: julkaisuvaiheessa ei ole oletusta, ja yksi ohje kertoo, mitä kukin Googlen pysäytys tarkoittaa ja mitä uusi henkilö tarvitsee.',
  lines: [
    'Nyt: tuotannon näkymät synteettisestä labista kuvina (fi, 1440 ja 390, vaalea).',
    'A Kysy Googlelta: Habitat ei muista mitään. Rivi sanoo sen ääneen ja vie tarkistukseen; vastaus ohjaa vain ikkunaa.',
    'B Ilmoitettu yleisö (suositus): ylläpitäjä ilmoittaa Googlen tilan tunnusten rinnalle. Rivi ja henkilön ikkuna kertovat sen ennen Googlea.',
    'C Kokeile itse: Habitat ei muista valintaa vaan lukee ylläpitäjän oman Gmail-yhteyden. Kokeilu on näyttö, ei ilmoitus.',
  ],
  scenario: 'Tilanne',
  scenarios: {
    rivi: 'Asetettu sovellus, Googlessa Internal',
    julkaisu: 'Uusi asetus: julkaisu',
    'org-internal': 'Henkilö sai "Pääsy estetty · org_internal"',
    testing: 'Sovellus jäi Testing-tilaan',
    'uusi-henkilo': 'Uusi henkilö haluaa yhdistää Gmailin',
    henkilo: 'Henkilön puoli (luonnos)',
  },
  reset: 'Alusta',
  wouldOpen: 'Avautuisi uuteen välilehteen:',
  pageTitle: 'Integraatiot',
  pageLead: 'Palvelimen ylläpito',

  // Shared: Google's state in words.
  gs: {
    internal: 'Vain organisaation tilit',
    testing: 'Testing: vain testaajat',
    production: 'Myös henkilökohtaiset tilit',
  } as Record<Gs, string>,
  gsGoogle: {internal: 'Internal', testing: 'External · Testing', production: 'External · In production'} as Record<Gs, string>,
  gsMeans: {
    internal:
      'Vain organisaatiosi Google Workspacen tilit pääsevät. Henkilökohtainen @gmail.com-tili ja muiden organisaatioiden tilit saavat Googlelta sivun "Pääsy estetty … Virhe 403: org_internal", eikä Google palaa Habitatiin.',
    testing:
      'Vain Test users -listan tilit pääsevät, ja jokainen yhteys katkeaa 7 päivässä. Muut saavat Googlelta virheen 403 access_denied.',
    production:
      'Mikä tahansa Google-tili pääsee. Google varoittaa henkilöä ennen lupia, ja uusia käyttäjiä voi olla 100 projektin elinaikana.',
  } as Record<Gs, string>,
  newPerson: {
    internal:
      'Henkilökohtainen Gmail ei käy. Henkilö tarvitsee organisaatiosi Workspace-tilin, tai salli myös henkilökohtaiset tilit.',
    testing:
      'Lisää hänen tilinsä: Audience › Test users › Add users. Yhteys katkeaa silti 7 päivässä. Julkaisu poistaa sekä listan että vanhenemisen.',
    production:
      'Googleen ei lisätä mitään. Henkilö näkee varoituksen ja vie yhden paikan käyttäjärajasta; käytön näet kohdasta Audience › OAuth user cap.',
  } as Record<Gs, string>,
  allowPersonal: 'Salli myös henkilökohtaiset tilit…',
  newPersonTitle: 'Uusi henkilö',

  // Shared: the publishing step without a default.
  publishTitle: 'Julkaisu',
  publishWhere: 'Mitä Publishing status -kohdassa nyt lukee?',
  publishNone: 'Valitse, mitä Googlessa lukee. Ohje ei oleta kumpaakaan.',
  testingStop:
    'Testing-tilassa vain Test users -listan henkilöt pääsevät, ja jokainen yhteys katkeaa 7 päivässä. Se sopii kokeiluun, ei perheen tai yrityksen käyttöön.',
  publishNow: 'Valitse Publish app ja vahvista. Kun kohdassa lukee In production, valitse se yllä.',
  keepTesting: 'Jätän Testing-tilaan tarkoituksella',
  keptTesting: 'Jätit Testing-tilaan. Muista: yhteydet katkeavat 7 päivässä.',
  production: 'Julkaistu. Tämä ei ole Googlen vahvistus: henkilöt näkevät yhä varoituksen.',
  next: 'Seuraava',
  back: 'Takaisin',
  done: 'Valmis',
  save: 'Tallenna',
  close: 'Sulje',
  cancel: 'Peruuta',
  guideTitle: 'Google: aseta tunnukset',
  stepClient: 'Asiakas',
  stepCheck: 'Tarkista',
  stepTry: 'Kokeile',
  clientFields: 'Client ID ja Client secret syötetään tässä kuten tuotannossa (kierros ei toista kenttiä).',
  saved: 'Tunnukset on tallennettu.',

  // Shared: what Google said.
  troubleTitle: 'Google: henkilö ei pääse yhdistämään',
  troubleLead:
    'Habitat ei näe Googlen sivua, eikä pysäytys palaa tänne. Kysy henkilöltä, mitä Googlen sivulla luki, ja valitse:',
  troubleOpen: 'Joku ei pääse yhdistämään…',
  cause: 'Syy',
  fix: 'Mitä teet',
  toPerson: 'Viesti henkilölle',
  cases: {
    org_internal: {
      said: 'Pääsy estetty · … · Virhe 403: org_internal',
      cause: 'Sovellus on Googlessa Internal. Vain organisaatiosi Workspace-tilit pääsevät; henkilökohtaiset @gmail.com-tilit ja muiden organisaatioiden tilit pysähtyvät tähän.',
      fix: 'Salli myös henkilökohtaiset tilit: Make external ja Publish app. Asiakas, salaisuus ja nykyiset yhteydet säilyvät. Tai henkilö käyttää organisaation tiliä.',
      person: 'Palvelimen Google-sovellus hyväksyy nyt vain organisaation tilit. Kerron, kun henkilökohtainen tili käy, ja yritä silloin uudelleen.',
    },
    access_denied: {
      said: '… has not completed the Google verification process · Virhe 403: access_denied',
      cause: 'Sovellus on Testing-tilassa, eikä tili ole Test users -listalla.',
      fix: 'Julkaise: Audience › Publish app. Testaajaksi lisääminen auttaa vain 7 päiväksi kerrallaan.',
      person: 'Sovellus oli vielä testitilassa. Julkaisin sen; yritä uudelleen, ja jatka Googlen varoituksesta Advanced-linkillä.',
    },
    expired: {
      said: 'Yhteys toimi, mutta Habitat pyysi kirjautumaan uudelleen noin viikon päästä',
      cause: 'Testing-tilassa jokainen yhteys vanhenee 7 päivässä.',
      fix: 'Audience › Publish app. Sen jälkeen henkilö yhdistää kerran uudelleen; julkaisu ei pidennä jo annettua yhteyttä.',
      person: 'Sovellus oli testitilassa, ja siksi yhteys katkesi. Julkaisin sen; yhdistä vielä kerran, niin yhteys pysyy.',
    },
    admin_policy: {
      said: '… blocked by your administrator · Virhe 400: admin_policy_enforced',
      cause: 'Henkilön työ- tai koulutilin organisaatio estää sovelluksen. Tämä ei koske henkilökohtaisia tilejä.',
      fix: 'Organisaation ylläpitäjä voi luottaa sovellukseen client ID:llä. Lähetä hänelle viesti alta.',
      person: 'Organisaatiosi estää sovelluksen. Lähetin ylläpitäjällesi ohjeen; hyväksyntä voi kestää vuorokauden.',
    },
    cap: {
      said: 'Sovellus ei ota uusia käyttäjiä',
      cause: '100 uuden käyttäjän raja projektin elinaikana on täynnä. Raja ei nollaudu, kun yhteyksiä poistetaan.',
      fix: 'Seuraava askel on Googlen vahvistus, joka on oma, raskas prosessinsa. Kerro henkilölle, ettei uusi yritys auta.',
      person: 'Palvelimen Google-sovellus on täynnä. Uusi yritys ei auta; selvitän asiaa.',
    },
    rate: {
      said: 'Virhe 403: rate_limit_exceeded',
      cause: 'Uusia kirjautumisia on tullut liian monta lyhyessä ajassa.',
      fix: 'Odota ja pyydä yrittämään myöhemmin.',
      person: 'Google rajoittaa uusia kirjautumisia hetken. Yritä huomenna uudelleen.',
    },
    warning: {
      said: 'Google hasn\'t verified this app (suomeksi varmistamatta)',
      cause: 'Ei virhe. External-sovellus, jota Google ei ole vahvistanut, näyttää aina tämän varoituksen.',
      fix: 'Ei korjattavaa. Henkilö jatkaa Advanced › Go to … (unsafe).',
      person: 'Varoitus kuuluu asiaan. Jatka Advanced-linkistä, jos osoite on tämän palvelimen.',
    },
  } as Record<CaseId, {said: string; cause: string; fix: string; person: string}>,

  // A
  a: {
    rowLine: 'Kenen tilit: Habitat ei näe tätä Googlesta.',
    check: 'Tarkista…',
    checkTitle: 'Google: kenen tilit pääsevät',
    checkLead: 'Avaa Audience-sivu ja kerro, mitä siellä lukee. Habitat ei tallenna vastausta; se ohjaa vain tätä ikkunaa.',
    userType: 'Mitä User type -kohdassa lukee?',
    publishing: 'Entä Publishing status?',
    pickFirst: 'Valitse, mitä Googlessa lukee.',
    afterSave: 'Tarkista lopuksi, mitä Audience-sivulla nyt lukee:',
  },
  // B
  b: {
    declared: (date: string) => `ilmoitettu ${date}`,
    unverified: 'Habitat ei voi tarkistaa tätä Googlesta.',
    change: 'Muuta…',
    rowInternal: 'Henkilökohtaiset Gmail-tilit eivät voi yhdistää.',
    rowTesting: 'Yhteydet katkeavat 7 päivässä. Vain testaajat pääsevät.',
    rowProduction: 'Google varoittaa henkilöä. 100 uutta käyttäjää projektin elinaikana.',
    declareTitle: 'Google: mitä Googlessa on valittu',
    declareLead:
      'Kerro, mitä Audience-sivulla lukee. Habitat tallentaa vastauksen tunnusten rinnalle ja näyttää sen sinulle ja henkilöille ennen Googlea. Se ei muuta mitään Googlessa.',
    declareSave: 'Tallenna ilmoitus',
    declaredSaved: 'Ilmoitus tallennettu. Henkilöt näkevät sen ennen Googlea.',
    stale: 'Jos muutat sovellusta Googlessa, päivitä ilmoitus tästä. Habitat ei huomaa muutosta itse.',
    willSave: 'Tallentuu tunnusten kanssa:',
    afterWalk: 'Kun Audience-sivulla lukee External ja In production, päivitä ilmoitus:',
    markProduction: 'Merkitse: Myös henkilökohtaiset tilit',
    published: 'Julkaisin…',
    newPerson: 'Uusi henkilö…',
    explains: 'Ilmoituksesi selittää tämän:',
  },
  // C
  c: {
    notTried: 'Henkilökohtaisella tilillä ei ole kokeiltu tällä palvelimella.',
    tryOwn: 'Kokeile omalla Gmaililla…',
    worked: (addr: string, days: number) => `Toimii henkilökohtaisella tilillä: oma yhteytesi ${addr} on toiminut ${days} päivää.`,
    workedNote: 'Yli 7 päivää toiminut yhteys kertoo myös, ettei sovellus ole Testing-tilassa.',
    stopped: 'Oma kokeilusi pysähtyi Googlessa.',
    brokeSeven: (addr: string) => `Oma yhteytesi ${addr} katkesi 7 päivää yhdistämisen jälkeen. Sovellus on todennäköisesti Testing-tilassa.`,
    tryTitle: 'Google: kokeile henkilökohtaisella tilillä',
    tryLead:
      'Yhdistä oma @gmail.com-tilisi kohdassa Tiedot agenteille. Jos se onnistuu, henkilökohtaiset tilit pääsevät. Habitat lukee tuloksen omasta yhteydestäsi; mitään ei tallenneta erikseen.',
    open: 'Yhdistä oma Gmail',
    sim: 'Kierroksessa valitaan, miten kokeilu päättyi:',
    simOk: 'Palasin osoitteen kanssa',
    simStop: 'Google pysäytti',
    okResult: 'Henkilökohtaiset tilit pääsevät. Jos Google varoitti ennen lupia, sovellus on External ja vahvistamaton, kuten pitääkin.',
    stopLead: 'Mitä Googlen sivulla luki?',
    noPersonal: 'Minulla ei ole henkilökohtaista Google-tiliä',
    noPersonalBody: 'Tarkista silloin Audience-sivulta, mitä User type ja Publishing status sanovat.',
    ownAccount: 'synteettinen.yllapitaja@gmail.com',
  },

  // Person side
  p: {
    title: 'Henkilön puoli: Yhdistä tili: Google',
    lead: 'Luonnos siitä, mitä suunta tarkoittaa henkilölle. Vasemmalla tuotannon nykyinen huomautus, oikealla suunnan muutos.',
    today: 'Nyt (tuotanto)',
    change: 'Suunnan muutos',
    a: [
      'Ennen Googlea sama ehdollinen huomautus kuin nyt: Habitat ei tiedä enempää.',
      'Ohjeen Google pysäytti -listassa ensimmäisenä "Pääsy estetty · org_internal" Googlen sanoin, ja siinä valmis viesti palvelimen ylläpitäjälle.',
      'Yhteyden katketessa ei mitään uutta: Habitat ei erota 7 päivän vanhenemista muusta.',
    ],
    bInternal: 'Tämä palvelin hyväksyy vain organisaation Google-tilit. Henkilökohtainen @gmail.com-tili ei käy.',
    bInternalSub: 'Palvelimen ylläpitäjän ilmoitus. Jos haluat yhdistää henkilökohtaisen tilin, pyydä häntä sallimaan se.',
    bAsk: 'Kopioi pyyntö ylläpitäjälle',
    bContinue: 'Jatka silti organisaation tilillä',
    b: [
      'Internal: ylläpitäjän ilmoitus näkyy ennen Googlea, eikä henkilö kävele seinään.',
      'Testing: "Vain testaajiksi lisätyt tilit pääsevät, ja yhteys katkeaa 7 päivässä."',
      'In production: nykyinen varoitushuomautus, nyt ilman "voi".',
    ],
    cOrphan: 'Avasit Googlen, mutta kirjautuminen ei palannut. Pysäyttikö Google?',
    cOrphanSub: 'Valitse, mitä sivulla luki, niin kerromme, kenen puoleen kääntyä.',
    cBroke: 'Yhteys katkesi 7 päivää yhdistämisen jälkeen. Palvelimen sovellus on todennäköisesti testitilassa; kerro ylläpitäjälle.',
    c: [
      'Ennen Googlea sama huomautus kuin nyt: ylläpitäjän kokeilu on hänen tiliään, eikä sitä näytetä toiselle käyttäjälle.',
      'Kun kirjautuminen vanhenee palaamatta, ikkuna kysyy, pysäyttikö Google (org_internal ensimmäisenä).',
      'Henkilön oma daemon huomaa 7 päivän katkoksen ja sanoo sen kortilla.',
    ],
  },
};
