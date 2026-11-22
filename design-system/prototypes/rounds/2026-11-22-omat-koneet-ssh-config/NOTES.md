# Omat koneet ja ~/.ssh/config

Issue `own-machines-import-ssh-config`. This is a prototype only; production,
the contract and the daemon are untouched.

Axis: **where hosts found in `~/.ssh/config` stand on the Omat koneet page.**
The content is the same in every direction: five concrete hosts (one comes
through an `Include`), four skipped entries (`github.com`, `Host *`,
`Host *.lan`, a `Match` block), and the same facts for each host: HostName,
User, Port, IdentityFile and whether the file exists, ProxyJump, a Tailscale
name, and the file and line it comes from.

- **1 Oma ryhmä** (recommended): a group headed *Löytyi ~/.ssh/config:sta* sits
  under the machines. Each host gets *Näytä omana koneena* or *Piilota*.
  A host that is shown moves into the machine list as a card.
- **2 Yksi lista:** every config host is already a machine in the list, with
  a `~/.ssh/config` badge. The only action is *Piilota sivulta*.
- **3 Läpikäynti:** the page starts with one line, *~/.ssh/config:ssa on 5
  konetta…* *Käy läpi*. A dialog with checkboxes lists the hosts, and the
  chosen ones become machines.

Shared by all three: a config machine card with *Ei tarkistettu* until the
person presses *Tarkista yhteys*, because no host is checked automatically.
The card also has five check results: *Vastaa*, *Ei vastaa* (which names the
jump host), *Nimi ei ratkea* (for a Tailscale name, it points to *Lisää kone*),
*Isäntäavain hyväksymättä* (Habitat never accepts a key on the person's
behalf) and *Kirjautuminen ei onnistu* (which names the missing key file). The
empty config and the unreadable config have their own lines. Hidden hosts are
collected under *Piilotetut*.

Built from production pieces: the Settings frame, `OwnMachinesPage` fed a
synthetic daemon view, `Badge`, `ControlButton`, `Icon` and the om-* styles.
The round inserts config machines into production's machine list, and one CSS
rule hides production's "Ei yhdistettyjä koneita" while config machines are
on the page. All data is synthetic: the account `maija`, `*.example`,
`home.arpa` and documentation IP addresses.

## Try

The review bar holds the theme. The tools row sets Habitatin koneet (none or
one, `kirjasto-mac`), ~/.ssh/config (found, empty, unreadable) and *Alusta*.
The URL can set the same: `?habitat=1`, `?config=empty|unreadable`.

## Build and check

From the repository root, with `web/node_modules` installed from the lock:

```sh
node design-system/prototypes/rounds/2026-11-22-omat-koneet-ssh-config/build.mjs <out-dir>
PLAYWRIGHT_BROWSERS_PATH=… node design-system/prototypes/rounds/2026-11-22-omat-koneet-ssh-config/check.mjs <out-dir>/offline.html <shots-dir> [--quick]
```

On shared hosts, wrap both in the scratch lease and a timeout. `check.mjs`
covers every direction × Päivä/Yö/Kontrasti × 1440/390 px at DPR 2. In Päivä
it also runs each direction's flow: adopt or pick, check every result, hide
and unhide, Habitat's own machine beside the config machines, and the empty
and unreadable config. It also checks the picker contract, overflow, the
console and the network. Finnish only; there is no English text in this round.
