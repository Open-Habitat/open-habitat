---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: jari
status: open
priority: normal
lane: recap
lane_seq: 2
preparation: ready
---

# Automatic recap is lost when the daemon restarts first

_Source: chat_

## Description

From KOKEILTAVAA.md (test server testing):

Automaattinen tilannekatsaus katoaa, jos daemon käynnistyy uudelleen ennen kuin katsaus ehtii syntyä (28.10., pilot.456–462, havaittu testikierroksella): agentin vuoro päättyi 05:36:45 UTC, ja testikone päivittyi seuraavan puolen tunnin aikana useita kertoja (daemon viimeksi 06:10:21). Katsausta ei tullut, vaan näkyi vain *Agentti lepää*. Uusinta katsausta kokeiltiin ilman uudelleenkäynnistystä: vuoro päättyi 06:12 ja katsaus syntyi 06:15:32 (`trigger: automatic`), joten ajastin toimii. Syy on lähes varmasti se, että `scheduleAutomaticRecap` (`internal/daemon/recap_linux.go`) on muistissa oleva `time.AfterFunc`, joka viritetään vain vuoron päättyessä. Jos daemon käynnistyy uudelleen, ajastin katoaa, eikä mikään viritä sitä uudelleen, koska Pi on pysähtynyt. Ensimmäisen kokeilun aikana kenttään oli myös jätetty luonnos, joka keskeyttää katsauksen tarkoituksella (`recap-card-labels`).
