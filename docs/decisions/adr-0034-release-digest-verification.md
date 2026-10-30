# ADR 0034: A release is verified by the SHA-256 GitHub states for it; no product signing key

**Status:** Accepted 2026-10-30 (Jari, in `issues/decide-release-trust-anchor`). Supersedes the release-signing part of [ADR 0029](adr-0029-installation-baseline.md): wherever ADR 0029 says "signed manifest" or "signed runtime release", read "manifest pinned by its SHA-256". The rest of ADR 0029 stands. The changes named here are work to implement, not today's behaviour.

## Tiivistelmä

Asennus ja päivitys tarkistavat jatkossa vain sen, että ladattu paketti on sama
kuin GitHub-julkaisussa: sen SHA-256 vastaa GitHubin julkaisulle ilmoittamaa
tiivistettä. Oma tuoteavain, Aldern kehitysavain, `.sig`-tiedostot ja palvelimille
asennettava julkinen avain poistuvat.

Käytännössä tarkistettavia tiivisteitä on kaksi: tuotepaketti ja julkaisun
manifesti (`release-linux-<arch>.json`). Manifesti luettelee jo nyt kaikkien
runtime-arkistojen ja tuotetiedostojen tiivisteet, joten yksi manifestin tiiviste
kattaa koko julkaisun. Manifestin tiiviste kirjoitetaan palvelimen `site.json`iin
niin kuin nytkin (`release.manifest_sha256`). Tuote tarkistaa kaiken muun sitä
vasten, eikä tuotteen tarvitse ottaa yhteyttä GitHubiin.

Muutos tehdään neljässä vaiheessa, jotta testipalvelimen julkaisuvahti ja
pilottien päivitys toimivat koko ajan:

1. Tuote lakkaa vaatimasta allekirjoitusta, mutta julkaisut tehdään vielä
   allekirjoitettuina.
2. Fleetrepon päivitystyökalu tarkistaa julkaisun GitHubin tiivisteillä.
3. Tuotteen julkaisut lakkaavat olemasta allekirjoitettuja.
4. Avaimet poistetaan palvelimilta ja Alderlta.

Julkaisuvahti ei käytä allekirjoituksia lainkaan, joten se ei muutu.

## Problem

ADR 0029 made a product Ed25519 key the root of release trust. The verifier
checks the key's signature over the manifest, and the operator installs the
public key on every host as `/etc/open-habitat/release-key.pub`. The key is a
development key on Alder. Production custody was never solved, and every release
needs its own signing step, sidecar `.sig` files, a published `.pub` asset, a key
pin in Fleetrepo and an "independently trusted verifier" rule.

Open Habitat is a closed product that Jari releases and installs himself. The
signature protects against an attacker who could replace release assets but not
the key. For this product that is the same person who controls the GitHub
repository, which also holds the source. The digest pin already in the site file
gives the protection that matters: the installed bytes are exactly the release
that was chosen.

## Decision

**Where the expected digest comes from.** For each release asset, GitHub's
releases API reports a SHA-256 that GitHub computes from the bytes it stores:
`GET /repos/Open-Habitat/open-habitat/releases/tags/<tag>` →
`assets[].digest = "sha256:<hex>"`, which the release page also shows. The
operator's tooling reads it with authenticated `gh` over TLS. Two assets per
architecture matter: the product package `open-habitat-<version>-linux-<arch>.tar.gz`
and the manifest `release-linux-<arch>.json`. The downloaded bytes of both must
hash to GitHub's stated digest before anything is extracted or run as root. A
self-published `SHA256SUMS` or `.sha256` asset is not the source; it sits on the
same page and adds nothing to GitHub's own figure.

**What the operator pins.** It pins `site.release.version` and
`site.release.manifest_sha256`, the fields that exist today. Their value is
GitHub's stated digest of the manifest. No key, key digest or verifier binary is
pinned. The customer repositories keep their `pilot.N-pins.sha256` files as a
record of what was installed. The record does not approve anything, but it lets
the next installer notice if a release's assets have changed since then.

**What the product checks.** `open-habitat host apply` and `host upgrade`, and
`runtime-release verify`/`stage`, check the following. These checks exist today;
only the signature check before them goes.

- The SHA-256 of the exact `release.json` bytes equals the site pin, and the
  manifest's version equals the pinned version.
- The manifest parses strictly.
- Every selected archive matches the manifest's size, digest and file inventory
  before extraction.
- For an upgrade, the successor's binary and web files match `upgrade.product`,
  and the predecessor matches `upgrade.predecessor`.

The product never contacts GitHub. The host stays offline for verification, and
the site file is the one place that names the release. A leftover `release.sig`
or `release-key.pub` is ignored and never required. The product carries no
compatibility code for it, because the project has none to keep (root
`AGENTS.md`).

**What is removed.**

- In the product: the Ed25519 sign and verify paths and their signature domain,
  `ErrReleaseSignature`, the `release.sig` file in generations and incoming
  directories, `/etc/open-habitat/release-key.pub`, `runtime-release key-create`,
  the private key that `runtime-release sign` takes (it becomes a keyless command
  that writes `release.json` and prints its digest), `--key-file`, and
  `cloud-qualify.py --release-key`.
- From the release cut: the `.sig` and `pilot-development.pub` assets and
  `SHA256SUMS`.
- In Fleetrepo: the key pin and signature check in `/open-habitat-upgrade`, the
  requirement for a separately trusted verifier binary, key and signature staging
  on Birch, Northwind and Contoso, and the development private key on Alder.

**What stays.** The manifest stays. It is what lets one stated digest cover a
dozen runtime archives and every product file. The upgrade's predecessor binding
also stays, because it is a compatibility protocol and not a trust mechanism.
`release-gate.json` stays, and so do the product package's internal
`MANIFEST.sha256` and its local `.sha256` sidecar. The test-release watcher uses
the local sidecar for a package it built itself. `bin/runtime-release` stays in
the package, so the watcher's package inventory does not change.

**What this does not protect against.** Someone with write access to the GitHub
repository could replace an asset of a mutable release, and GitHub would
recompute its digest. This is accepted: that person could change the source too.
The pins in the customer repositories make such a swap visible for any release
that has already been installed.

## Order of change

Each step leaves every consumer working. The test-server watcher builds the
package locally and never uses the signed runtime release, so no step touches it.

| Step | Repository | Change | May start when |
|---|---|---|---|
| 1 | product | The verifier accepts a digest-only release and ignores signatures and keys. Releases are still signed, and Fleetrepo is untouched. | now |
| 2 | Fleetrepo | `/open-habitat-upgrade` and the Birch/customer staging check GitHub's stated digests and stop requiring or staging the key and `.sig`. | a release containing step 1 is published, so that no staged successor still needs a signature |
| 3 | product | The release cut stops signing: keyless manifest command, no `.sig`, `.pub` or `SHA256SUMS` assets. Operator docs are rewritten. | step 2 has landed and Alder runs it |
| 4 | Fleetrepo | `release-key.pub` is removed from the three hosts, the development private key from Alder, and leftover key references from records. | the first unsigned release is installed on Northwind, Contoso and Birch |

Steps 1 and 3 are product issues, with step 3 blocked by step 1. Steps 2 and 4
are Fleetrepo intake issues, with step 4 blocked by step 2. The cross-repository
preconditions are written into each issue, because a `blocked_by` edge cannot
span repositories.

## Decisions for later review

- **Immutable releases.** GitHub's immutable releases (`immutable: false` today)
  would stop a published release's assets and tag from being replaced, which
  closes the gap above at no cost. Recommended; it is a repository setting for
  Jari to switch on.
- **`SHA256SUMS` is dropped** rather than kept as a human-readable listing,
  because GitHub shows each asset's digest itself.
- **The product does not fetch digests.** `open-habitat host` could look the
  digest up from GitHub itself. That would need GitHub credentials on customer
  hosts while the repository is private, so the lookup stays in the operator's
  tooling.
- **`runtime-release` stays in the package.** Removing it would also need a
  same-round change to the test watcher's package inventory.
