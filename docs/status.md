# Projektin tilanne

**Updated:** 2026-09-22
**Source revision:** `0dd5226ba18d410f22eade7fa4500310cf8e9924`

## Sovittu perusta

ADR 0001:n Unix-natiivi arkkitehtuuri ja UI v1:n tuotekäyttäytyminen on
hyväksytty. Workspace-/agenttinavigointi, koko keskustelukokemus, workspacejen
elinkaari, GitHub, Taskfleetin hallitsemat worktreet, arkisto, kahden käyttäjän
erottelu ja operointi kuuluvat koko MVP:hen. Tuotetta ei ole vielä toteutettu.

## Toteutusvalmiuden paketti on valmis

[`plan-v1-implementation`](../issues/plan-v1-implementation/result.md) on
koonnut pinotut lähderevisiot, 12 rajattua toteutusbriefiä, Y1–Y5/M1–M7- ja
CT-001–CT-033-omistajuuden, foundationin ehdotetun green gaten, neljä
sopimustäsmennystä sekä Fleetrepo/Alder-käyttöönoton ja palautumisen ehdotetut
komennot. Komennot eivät ole vielä ajettavaa tuotenäyttöä: ensimmäinen
`build-app-foundation`-työ toteuttaa ja todentaa ne.

Kävely-ydin säilyy järjestyksessä sovelluspohja → design system → autentikoitu
kahden käyttäjän workspace → natiivi Pi-historia → Pi-ohjaus. Sen jälkeen
rakennetaan koko hyväksytty keskustelu sekä workspace-, GitHub-, Taskfleet- ja
arkistotoiminnot. Lopun tekninen pilotti todentaa kaikki kriteerit; Jari hyväksyy
MVP:n erillisessä katselmoinnissa.

## Katselmoi seuraavaksi

Seuraava toiminto on Jarin kanssa käytävä
[`review-implementation-plan`](../issues/review-implementation-plan/item.md).
Sen [päätöspaketti](../issues/plan-v1-implementation/review.md) suosittelee
Proposed ADR 0002:n ja 0003:n hyväksymistä kirjatuin CLI-täsmennyksin,
tuotantodesignin hyväksymistä sekä täsmällisiä retention-, otsikko-, OIDC-,
GitHub- ja Fleetrepo-politiikkoja. ADR:t 0002/0003, tuotantodesign ja ehdotetut
komennot eivät muutu hyväksytyiksi ennen Jarin kirjattua päätöstä.

Alder on jo valtuutettu myöhemmäksi testi-/pilottikohteeksi katselmoinnin ja
ajettavien green gatejen jälkeen. Nykyistä deploymentia ei ole. Pysyvä tila
luodaan vain erillisessä katselmoidussa Fleetrepo-issuen worktreessä ja
konvergoidaan Fleetrepon omalla fleet-/Alder-hook-rajalla; Native Agent Host ei
muuta käyttäjiä, unitteja, OIDC-salaisuuksia tai Tailscale-reittiä sivuvaikutuksena.

## Todennetut rajat ja avoin näyttö

Pi 0.85.1:n historia/RPC/jono/steering/diffi/dialogi-rajat ja paikallisen
workspace/Git/Taskfleet/GitHub-read-proben rajat on todennettu. Host-sopimuksen
29 nykyistä skenaariota validoituvat. Tuotantodesign ja staattinen kierros ovat
katselmointiaineistoa, eivät runtime-näyttöä.

Vielä toteutuksessa todistettavia ovat QEMU-systemd-fixture, oikea OIDC/session/
CSRF/socket/peer-UID-polku, Pi:n otsikkokutsu, SSE-/ledger-/pitkän historian
budjetit, daemon-crash ja history settlement, kahden käyttäjän GitHub-kirjoitukset,
Taskfleetin osittaiset elinkaaret, path/mount/process-racet, saavutettavuus,
paketointi, päivitys, rollback ja pilottiteardown. Tuntematon tila pysyy
fail-closed-tilana eikä poista hyväksyttyä ominaisuutta.

## Dokumentaation katselu

Dokumentaatio on suoraan `docs/`-hakemistossa ja sen aloitus on `index.md`.
Glasspadin nykyversio hylkää hakemiston AGENTS.md/CLAUDE.md-ohjeet. Siksi suora
näyttäminen tarvitsee Glasspad-korjauksen; dokumentaation rakennetta ei muuteta
sen vuoksi. Näitä muutoksia ei ole julkaistu Glasspadissa.
