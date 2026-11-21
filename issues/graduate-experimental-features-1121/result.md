# Result

The twelve named features are ordinary, default-on features. Their switches and cards are gone; rewind, remote browser, multiplayer and terminal copy-on-select remain experimental. Old saved feature keys remain readable but no longer gate graduated behavior.

The former Jaetut page is **Tuotokset / Outputs**, including navigation, headings, Explain cards and the generated UI reference. Its inventory includes agent-provided native views and files whether private or shared by link. Reading the inventory creates no address and publishes nothing. Removing an address leaves the native output in the list as private. Native file inventory now pages beyond 200 items.

## Decisions for later review

- Kept `/shares`, component names and internal test identifiers. Renaming internal routing adds migration churn without improving the visible name or behavior.
- Retired preference keys are inert, not migrated or deleted. The experimental CLI lists and accepts updates only for the remaining catalog entries; existing preference documents still round-trip.
- Removed the duplicate personal address-management settings page. Output addresses are managed in Outputs; administrator publication management stays in place.
- Missing Taskfleet means an empty helper inventory. An installed but unsupported, broken, non-executable or inaccessible tool remains unavailable: absence of a readable inventory is not proof of no work. Auxiliary launches still receive no helper recipe.
- Kept real prerequisites and authority checks: integration setup, storage availability, supported native tools, own-UID reads, wake launch ownership, publication policy and explicit publication actions. Graduation creates no provider connection or background work by itself.
- Native lists, not reserved addresses, define the Outputs inventory. Added paging to the existing file-offer contract rather than a second store or a truncated list advertised as complete.

## Verification

All checks ran with restrictive umask and the shared scratch lease. These are focused checks, **not a clean-gate or release qualification receipt**.

- `./scripts/test-focused.sh --area web`: static/type/catalog checks and **237 files / 1,934 unit and component tests passed**.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed, including default wakes, launch guidance, preferences, absent/broken native helper tools and 201-file pagination.
- The same focused Go entrypoint for `./internal/gateway` and `./internal/cli`: passed. `./internal/experimental` compiled; it has no tests of its own.
- `./scripts/test-focused.sh --area contracts`: generated packages clean; 106 schemas, 170 fixtures, 44 scenarios and negative checks passed.
- Focused browser batch with two workers: **33 host-backed tests passed, one screenshot-only test skipped; 22 lab tests passed**. Specs: agent-resources, atlassian-connect, browser-terminal, conversation-context-view, helper-archive, lab-explain-mode, lab-rail-background-door, lab-rail-scroll-region, scheduled-wake, settings-experimental, storage-breakdown, trello-connect, turn-changes and view-links.
- Separate `OH_VISUAL_CAPTURE=1` Outputs browser case: passed. Synthetic screenshot/static-HTML pairs are under `evidence/`; inspected Outputs at desktop/mobile and Explain J02 in Finnish/English at both widths. Labels and card text fit; no real installation was captured.
- `python3 scripts/validate-project-view.py` and `git diff --check`: passed.

An intermediate daemon run exposed a bad conversation ID in the new pagination test and an idle-resume timeout; the fixture was corrected and the complete final daemon run passed. Browser failures exposed a real phone sidebar fold/unfold loop: the folded-row estimate differed from the actual phone row height. Both now use the same CSS dimension. Browser fixtures were adjusted for two additional permanent navigation rows and the desktop Explain state card; all selected cases subsequently passed.

After rebasing onto the newer source branch, combined its multiplayer launch context with unconditional helper context without graduating multiplayer. Regenerated both contract packages, added an explicit multiplayer-off launch assertion, and reran focused launch/wake/helper/pagination/experimental Go tests, the CLI package, contracts, all 1,934 web tests, and the 12 settings/Outputs/helper/wake browser cases: all passed. The source branch's rename decision was preserved in the issue.

No live OAuth consent, installed systemd wake/restart, customer upgrade, whole browser suite, packaging or full green gate was run.

## Independent review

Required daemon/state/contract review completed with claude-fable-5-2 as finder and gpt-6-astra as independent verifier, followed by host assessment. Eight confirmed findings were repaired: missing-tool helper presentation, initial unknown address state, newly published-address visibility, obsolete wake guidance, obsolete settings guidance, file pagination, the gateway cursor whitelist, and broken-tool absence detection. Targeted regression tests cover the behavioral repairs. The verifier found no cross-UID access or unsolicited publication in the reviewed changes.

Assessment: seven FIX, one FIX WITH CARE (paging across the existing contract), no deferred finding or product decision. Review/assessment copies, raw logs and model scores are retained under `/var/tmp/agent-keep/graduate-features`. Model-corpus publication was not invoked because it pushes, outside this task's no-push authorization.

## Live check

Julkaisun jälkeen, myös puhelimella:

1. Avaa Asetukset → Kokeelliset ominaisuudet. Jäljellä ovat vain keskustelun kelaus, oma palvelinselain, moninpeli ja päätteen valinnan automaattikopiointi.
2. Älä kytke kokeiluja päälle. Tarkista päätteen URL-linkki, tallennustilan erittely, taustatyön sivupalkkimerkki, ajastettu herätys, Selitä-tila, Muutokset, kontekstinäkymä, Tuotokset, Agentin käytössä, Atlassian, Trello ja nimetyt avustajat. Puuttuva palvelinasetus tai työkalu saa näkyä puuttuvana, ei kokeilukytkimen vaatimuksena.
3. Pyydä agentilta näkymä ja tiedosto ilman jakamista. Molemmat löytyvät Tuotoksista yksityisinä. Sivu ei jaa niitä pelkällä avaamisella.
4. Jaa yksi tuotos linkillä, muuta kestoa ja poista osoite. Tuotos jää listalle yksityisenä. Tarkista samat nimet englanniksi: Outputs, ei Shares.
5. Avaa Selitä-tila Tuotoksissa. Ohje kertoo sekä yksityisistä että linkillä jaetuista tuotoksista. Kokeile sivupalkkia matalassa ikkunassa ja puhelimella: Hiljaisten taittuminen ei saa kaataa sivua.
