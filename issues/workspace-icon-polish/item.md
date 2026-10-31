---
created: 2026-10-31
updated: 2026-10-31
type: improvement
reporter: jari
status: open
priority: normal
lane: workspace-icons
lane_seq: 4
preparation: ready
---

# Workspace icons: keep suggestions, dictate the wish, longer model time, say what a choice did

## Description

## Description

Jarin havainnot 30.10. (testikone pilot.536, kokeellinen Työtilan kuvake). Jarin tuomio: ominaisuus palaa hiottavaksi ja testataan uudelleen.

1. **Ehdotukset generoidaan aina uudelleen.** Kun työtilan sivulta lähtee ja palaa, malli tekee ehdotukset alusta. Kerran tehdyt ehdotukset pitää säilyttää näkymässä; uusia saa pyytää tai ne voi tehdä myöhemmin (`web/src/components/WorkspaceIconSuggestions.tsx`).
2. **Toivekenttään sanelu.** Kentästä *Toive, esim. kettu, sininen, kirjaimet* puuttuu *Sanele*-painike.
3. **Ehdotus toiveesta aikakatkesi.** Tulos *Ehdotuksia ei saatu. Voit yrittää uudelleen. Edelliset ehdotukset ovat yhä tässä.* Malli `openai-codex/gpt-6-luna`; daemonin journal 14:38:39Z `workspace_icon_suggestions outcome=failed reason=model_timeout`. Raja on 15 s (`internal/daemon/workspace_icon_suggest_linux.go:40`); onnistuneista ei jää journaliin riviä, joten epäonnistumisten osuutta ei näe.
4. **Kuvakkeen valinta sulki ehdotuspalkin ja commitoi huomaamatta.** Jari ihmetteli, mihin palkki katosi ja tallentuiko jotain. Se tallentui: `~/src/open-habitat` main sai commitin `1b2eb3a1 Työtilan kuvake: design-system/favicon.svg (open-habitat)` (poistettu Jarin pyynnöstä ennen pushia) klo 14:40:38Z. Palkin sai takaisin kuvaketta napsauttamalla. **Valinnan pitää kertoa näkyvästi, että se kirjoitettiin ja commitoitiin, ja mistä palkin saa takaisin.** Tämä muuttaa 30.10. aamupäivän linjausta (commit kyselemättä *ja siitä mitään sanomatta*): commit tehdään edelleen kysymättä, mutta siitä kerrotaan.

## Acceptance Criteria

- [ ] Ehdotukset säilyvät työtilakohtaisesti käyntien yli (selaimessa tai natiivissa tiedostossa, ei uutta palvelinvarastoa) ja uusitaan vain pyynnöstä.
- [ ] Toivekentässä on *Sanele*, joka käyttää samaa sanelua kuin kirjoituskenttä.
- [ ] Aikakatkaisu mitoitettu oikeilla mallien ajoilla (journal kirjaa myös onnistumisen keston), ja hidas malli ei katkea turhaan.
- [ ] Valinnan jälkeen näkyy lyhyt ilmoitus siitä, mitä kirjoitettiin ja commitoitiin (ja *Kumoa*, jos se on helppo), sekä mistä ehdotukset saa takaisin; selainspec.
