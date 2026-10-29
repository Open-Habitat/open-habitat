---
created: 2026-10-29
updated: 2026-10-29
type: bug
reporter: conductor
status: fixed
priority: normal
preparation: ready
provenance: chat
source_ref: chat:2026-10-29/conversation-pi-ends-mid-reply
lane: conversation-live
lane_seq: 50
closed: 2026-10-29
---

# Habitat conversation's Pi is ended mid-reply without being asked (twice on 28.10.)

Konduktorin keskustelu Birchlla (Habitat, Pi + claude-bridge, Opus) pysähtyi 28.10. kahdesti: 18:22:57Z ja 19:26:55Z. Habitat kertoi molemmilla kerroilla "Pi ended without being asked". Toisen jälkeen kukaan ei herättänyt keskustelua yhdeksään tuntiin, ja yön julkaisu (pilot.14 kolmelle palvelimelle) jäi tekemättä.

Mitä lähteet sanovat:
- Pi:n istunto (~/.pi/agent/sessions/…84da662d….jsonl): kummallakin kerralla viimeinen tallennettu rivi on työkalun tulos, sen jälkeen ei assistentin viestiä eikä virhettä.
- Claude Coden transkripti (~/.claude/projects/-home-maintainer-src-open-habitat/576c606b….jsonl ja 2abdf024….jsonl): malli ehti aloittaa vastauksen (thinking 18:22:08 ja 19:26:43; molemmilla kerroilla se oli tuottamassa pitkää työkalukutsua, isoa HTML-tiedostoa ja julkaisubriefiä), sitten "[Request interrupted by user]" 18:22:57 ja 19:26:55. Bridge kirjoittaa tämän, kun Pi:n abort-signaali laukeaa (pi-claude-bridge src/index.ts onAbort → sdkQuery.interrupt()). Pi siis pysäytettiin ulkopuolelta, mutta Habitat ei pyytänyt sitä.
- Järjestelmän journal Birchlla alkaa 29.10. 00:02, joten daemonin oma syy on hävinnyt. claude-bridge.log ei ole päällä.
- Ehdokas (todentamatta): internal/daemon/pi_rpc_linux.go read() sulkee Pi:n stdinin, kun Pi:n RPC-kehys on yli 1 MiB eikä sen tyyppi ole sallittujen listalla (message_update ym. → default: overflow, p.in.Close()). Pi päättyy stdinin sulkeutuessa. Pitkä keskustelu ja pitkä suoratoistettava työkalukutsu voisi tuottaa tällaisen kehyksen.

Tehtävä: toista (pitkä keskustelu, jossa malli tuottaa suuren työkalukutsun; tai Pi:n RPC-kehyksen koko mitattuna), selvitä todellinen syy, korjaa se, ja pidä huoli, että tällainen pysähdys jättää syyn talteen (keskustelun catch-up-viestiin tai daemonin pysyvään lokiin), ettei seuraava selvitys riipu journalin kierrosta.
