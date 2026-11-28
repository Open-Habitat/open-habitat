# Worker ei enää lupaa selaimessa sellaista, mitä selaimella ei voi tehdä

## Korjaus

Workerin tila kertoo nyt, ketä se odottaa ja mistä asia hoidetaan:

- **Kysyy pääagentilta.** Worker on esittänyt kysymyksen
  (`taskfleet node ask`). Daemon lukee Taskfleetin `open_ask`-tiedon, ja
  tila on `waiting_parent`. Riville tulee teksti *kysyy pääagentilta*
  harmaana, koska vastaaminen kuuluu agentille. Workerin näkymässä on
  kortti, jossa kysymys näkyy workerin omin sanoin, ja painike *Avaa
  pääkeskustelu*. Vastauskenttää ei ole.
- **Kysymys siirretty sinulle** (`escalated`). Rivillä lukee *kysyy sinulta
  pääagentin kautta* keltaisena, ja kortti ohjaa vastaamaan pääagentille
  pääkeskustelussa.
- **Pysähtyi omaan kehotteeseensa** (`idle`). Rivillä lukee *pysähtyi ·
  odottaa pääagenttia*, ja keskustelulistassa *Worker pysähtyi · odottaa
  agenttia*.
- **Kehote päätteessä** (esimerkiksi Pi:n luottamuskysymys). Rivillä lukee
  *kehote päätteessä · odottaa pääagenttia*. Pääteviestin yläpuolella oleva
  ilmoitus kertoo nyt, ettei selaimesta voi vastata kehotteeseen, ja pyytää
  kertomaan asiasta agentille. Workerin näkymän kortti kertoo saman ja lisää,
  että agentti voi perua workerin ja käynnistää sen uudelleen.

Workerin kysymys estää työtilan worktreen poistamisen samalla tavalla kuin
työskentelevä worker, ja keskustelu pysyy kysymyksen ajan Käynnissä-osiossa,
koska työ on yhä kesken.

Testit: daemonin tilatesti (avoin, siirretty ja vanhentunut kysymys, kuollut
supervisor, laskenta), komponenttitesti sävyistä sekä `worker-view.spec.ts`,
joka käy läpi aidon daemonin ja fixture-Taskfleetin `open_ask`-kysymyksen ja
painikkeen pääkeskusteluun. Myös `scripts/test-web-fast.sh`,
`test-focused.sh --area go --go-package ./internal/daemon` ja
`spinoffs.spec.ts` menevät läpi.

## Myöhemmin arvioitavat päätökset

- Workeri, joka on pysähtynyt kehotteeseensa (`idle`), näkyy edelleen
  keltaisena ja keskustelu Sinun vuorosi -osiossa. Kun agentin vuoro on
  päättynyt, joku joutuu kertomaan sille asiasta, joten tämä on sinun
  tehtäväsi. Teksti ei kuitenkaan enää väitä, että worker odottaa sinua.
- Keskustelulistassa kysyvä worker näkyy tekstillä *Worker työskentelee*.
  Snapshot ei erottele kysymystä omaksi laskurikseen.
