---
created: 2026-10-01
updated: 2026-10-01
type: task
reporter: Jari
status: done
priority: high
related: ['@pilot14-session-revalidation-loop']
closed: 2026-10-01
closed_by: claude
---

# Arkkitehtuuri on rakennettu varovaisuuden, ei tarpeen varaan

## Miksi tämä työ tehdään

Pilot.14:ssä tavallinen paluu selainikkunaan peitti työtilan pitkällä
istunnontarkistuksella, ja Pi-keskustelun ohjaus jäi katkenneeseen tilaan.
[Natiivilukujen Pi-portin poistamisesta on jo päätetty](../pilot14-session-revalidation-loop/item.md):
kirjautuminen tarkistetaan onboardingissa, ja myöhemmät kielimallikirjautumisen
ongelmat näytetään Pi:n mallikutsun epäonnistuessa. Portti käynnisti natiivin
Pi-apuprosessin toistuvasti myös tietojen lukemista varten. Bugikorjaus ja sen
vaikutuksen todentaminen kuuluvat tuohon issueen.

Jari 2026-10-01: tämä on vahva indikaatio siitä, että koko tähän mennessä tehty arkkitehtuuri on kuraa. Ei siksi, että yksi portti oli kallis, vaan siksi, että näin typerä ratkaisu pääsi syntymään, läpäisi katselmoinnit ja päätyi julkaisuun asti ilman, että kukaan kysyi, mitä se maksaa ja mitä se suojaa.

Tämä työ selvittää, missä muualla gatewayn, daemonin ja selaimen ratkaisut
rasittavat käyttöä tai mutkistavat toteutusta ilman vastaavaa hyötyä. Yhden
Pi-portin korjaaminen ei vastaa tähän huoleen.

## Mitä arvioidaan

Jokaisen puolustavan mekanismin tarvetta arvioidaan sen vaikutuksella:
mitä käyttäjälle arvokasta se suojaa, kuinka usein se suoritetaan, mitä se
maksaa ja mitä sen poistamisesta tai yksinkertaistamisesta seuraisi.
Koodikommentti, aiempi katselmointi tai agentin kirjoittama sääntö ei yksin
perustele ratkaisua. Suorituskykyä koskevat päätelmät tarvitsevat mittauksen;
monimutkaisuuden haitta pitää osoittaa konkreettisesta toiminnasta tai muutostyöstä.

Lähtökohtia koko toteutuksen tarkasteluun ovat:

- Natiivikutsujen toistuvat tarkistukset: Pi-portti
  (`internal/daemon/handoff_linux.go`) ja asennusvalitsimen tarkistus
  (`internal/daemon/pi_device_linux.go`).
- Brokerin tarkistus jokaisella istunnollisella pyynnöllä
  (`internal/gateway/auth.go`). Se tarkistaa käyttäjäsidonnan, epochin ja
  generationin. [ADR 0006](../../docs/adr-0006-subject-revocation.md) säilyttää
  nämä tarkistukset erillisen istunnon peruutuksen rinnalla. Niiden tarpeellisuus
  ja tiheys ovat arvioitavia, eivät peruutustoiminnon perusteella ratkaistuja.
- Selainikkunaan paluun peite ja pyyntöjono (`web/src/app/App.tsx`): miksi
  tavallinen paluu katkaisee käytön ja mitä todentamista se oikeasti tarvitsee.
- Daemonin vastausten muotoehdot ja viiden sekunnin aikarajat
  (`internal/gateway/snapshot_linux.go`, `conversation_linux.go`): mitä kukin
  ehto suojaa ja missä se hylkää muuten käyttökelpoisen vastauksen.
- Keskustelu- ja sovelluskoodin vastuunjako, etenkin `BrowserConversation.tsx`,
  `App.tsx` ja `internal/daemon/conversation_linux.go`. Tiedoston koko on
  tarkasteluvihje; haitta selviää siitä, miten toiminta on jäsennetty.

Unix-käyttäjät eristävät ihmisten tiedostot ja prosessit. Gatewayn pitää silti
päästää oikea selainistunto oikean käyttäjän daemoniin, eikä käyttäjän daemon
ole gatewayn kanssa sama luottamusalue. Nykyiset vastuut ja niiden syyt löytyvät
[arkkitehtuurista](../../docs/architecture.md) ja
[Go-pakettien ohjeesta](../../internal/AGENTS.md). Ne ovat arvioinnin lähtötietoa;
myös nykyisen ratkaisun voi kyseenalaistaa. Tuntematon perustelu on
selvitettävä kysymys, ei sellaisenaan näyttö mekanismin tarpeellisuudesta tai
turhuudesta.

## Lopputulos

Katselmuksesta käy ilmi, mitkä mekanismit kannattaa säilyttää, yksinkertaistaa
tai poistaa ja miksi. Havaintoihin liittyvät kustannukset, käyttäjälle näkyvät
seuraukset ja vielä epävarmat päätelmät erotetaan toisistaan. Korjaukset saavat
rajatut toteutusissuet; valmis Pi-portin poistopäätös pysyy omassa issuessaan.

Merkittävät muutokset komponenttien vastuisiin tai turvallisuusmalliin tuodaan
Jarille perusteltuna suosituksena. Tavalliset toteutuskorjaukset etenevät
projektin normaalin työnjaon mukaan. Arkkitehtuurikuvaus ja toteuttajien ohjeet
päivitetään siltä osin kuin havainnot muuttavat niitä: seuraavan toteuttajan
pitää ymmärtää ratkaisun syy ja hinta. Sama kysymys kuuluu katselmointiin,
jotta sääntöjen noudattaminen ei korvaa niiden tarpeellisuuden arviointia.

## Decisions

### 2026-10-01T18:22:47Z · @jari

Jari 2026-10-01: (1) Gateway tarkistaa brokerin valtuutuksen kerran kirjautumisessa. Istunnon elinaikana ainoa peruutustie on ADR 0006:n RevokeSubject; allowlistin muokkaus ei kirjaa ketään ulos lennossa. (2) Keskustelun omistaa Unix-käyttäjä, ei selainistunto. Saman henkilön toinen selain tai uusi kirjautuminen ohjaa samoja keskusteluja; daemonin flock pitää yhden kirjoittajan säännön. Nämä eivät ole ADR-tason muutoksia; ne kirjataan ADR 0006:n ja interfaces.md:n päivityksinä toteutusissueissa. Toteutusjärjestys: katselmuksen osan 3 askeleet 1–8 sarjassa (lane caution-removal); selainpuoli tehdään yhtenä uudelleenkirjoituksena kohdemuotoon, yksi tekijä.

## Resolution

### 2026-10-01T18:22:47Z · @claude

Katselmus docs/reviews/architecture-review-2026-10.md: 59 mekanismia, mitatut kustannukset (lab, pilot, go test), suositus per rivi, rakenteen analyysi ja järjestetty poistosuunnitelma. Toteutusissuet: @gateway-authorize-once, @gateway-single-proxy, @daemon-validate-startup, @daemon-drop-status-stream, @drop-conversation-lease, @browser-state-rewrite, @split-large-files, @pi-onboarding-poll. Jarin päätökset Decisions-osiossa.
