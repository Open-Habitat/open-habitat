---
created: 2026-11-09
updated: 2026-11-09
type: bug
reporter: jari
status: untriaged
priority: normal
provenance: chat
source_ref: habitat-chat:tailspin-contoso/2026-11-09-explain-path
---

# Selitystila: työtilan etusivun hakemistorivillä näkyy nimen selitys

## Description

Jari 9.11.2026 (Contoso-keskustelu Habitatissa): selitystilassa työtilan (repon) etusivulla hakemistorivin tooltip on työtilan nimen tooltip, eli sama "Työtilan nimi" -kortti näkyy kahdesti.

## Syy

`web/src/components/explainParts.ts`, kortti T01:

    sel: '.ah-workspace-page-head [data-testid="workspace-title"], .ah-workspace-page-title > p:has(> code)'

Valitsimen jälkimmäinen osa osuu `WorkspacePage.tsx`:n polkuriviin (`<p><code title={workspace.path}>{displayPath}</code></p>`, rivi ~348), joten polku saa nimen kortin ("Työtilan nimi; kansion nimi, ellei sille ole annettu näyttönimeä."). Tuli muutoksessa 56320d319 (8.11., "explain every control the views show"), joka ilmeisesti liitti polun T01:een kattavuustestin läpäisemiseksi.

## Ehdotettu korjaus

Oma kortti polkuriville (seuraava vapaa T-tunniste, fi + en tekstit `text/explainMode.ts`), esim. "Kansio" / "Folder": työtilan kansion sijainti kotihakemistossa; koko polku näkyy vietäessä hiiri päälle, Kopioi polku -painike kopioi sen. T01:n valitsin vain otsikkoon. Päivitä explain-coverage / lab-explain-mode -testit niin, että sama kortti ei kata kahta eri ohjainta samassa näkymässä. Tarkista samalla `workspace-icon-source`-rivi (kuvakkeen lähde), ettei sillä ole samaa ongelmaa.
