# Pilot handoff — released pilot.7 installed

**https://open-habitat.acme.test** is serving the downloaded, verified
**0.1.0-pilot.7** release, not a development build. Jari has already signed in
with GitHub and is administrator. Browser session preservation passed during
the product-managed upgrades; no cookie was copied or fabricated.

Release: https://github.com/Open-Habitat/open-habitat/releases/tag/v0.1.0-pilot.7

## Installed identity and independent pins

| Item | SHA-256 / identity |
| --- | --- |
| Product archive | `9b5f4864b918b675f91d2c0930434932bff756387f0dca74f219d78908f1d6cc` |
| Signed release.json | `e567abbd1f8106e38612d60a5b59448f48ccce6490fdb7c8b8fc52b2ab17945f` |
| release.sig | `1d6e0176952b6fdd31891f2c335a797ab50e519ee822f4734153fbf676c619cd` |
| Independently retained public key | `97963aebfb20e5426281433c6c20673559aaba362273951572c401b281180268` |
| Actual running gateway executable | `5a0b72452798e95cab4e36deed252480541ddcd694cee65211a2a5dc3d1eae43` |
| Embedded source / release tag | `1759a8456a999f33fdcc9993321b7c732bdf69c3` |
| Integrated upstream main | `6f79650835ba73c529340c518f5ed04c2a999167` |

All downloaded assets passed [the independently saved pins](pilot.7-pins.sha256),
package verification and complete signed-runtime closure verification before
root delivery. [The release receipt](release-gate.json) identifies the source
and test limits. This is an **ungated disposable prerelease**, using the existing
**development key**, not production signing custody or full clean-gate approval.

The twelve runtime archives are byte-for-byte pilot.3: core, native-build, php,
media, documents, operations, containers, browser, editor, uv, python,
integrations. Signed metadata is now version pilot.7 because it authenticates
the successor product and exact installed predecessor; payloads were not rebuilt.
The private signing key was never transported to the pilot or committed.

## Native operation and acceptance

- Original interrupted apply `2b013f00b02585b1ce2f3791054d6b44` completed intact,
  same original approval, seq12→17. No journal/broker reset or manual unit fix.
- Final native upgrade `2c01c98d39e25eab0981022579cd6f56` completed seq6;
  approval `d0da852d1690684a90f78c6f67bf5b9407fd8779d87c9b1a3e29ccd24dc71b1a`.
- Installed immutable owner:
  `/opt/open-habitat/generations/e567abbd1f8106e38612d60a5b59448f48ccce6490fdb7c8b8fc52b2ab17945f/open-habitat`.
  Bootstrap package: `/opt/open-habitat-0.1.0-pilot.7-linux-amd64`.
- `/proc/<gateway-pid>/exe` hash and version match the released signed product;
  served index bytes also match the downloaded release. All host checks pass;
  broker, gateway and private revoke listener active; no failed units.
- Gateway is actual UID31000 with only NET_BIND_SERVICE in effective, bounding
  and ambient sets, NoNewPrivs=1. No root gateway, file capability or sysctl change.
- Public HTTPS health/UI, exact GitHub callback redirect and editor-host TLS
  pass certificate validation. Anonymous HTTP/2 catalog reaches authentication
  (401), not the former protocol400. Independent native catalog returns all54
  repositories; conductor/onboarding worker confirmed successful live route200.
- Two actual cold boots were tested during development. The first exposed the
  dormant-polkit false blocker; the corrected installed build passed all checks
  on the second, boot ID `2fdd84c5-85f7-46af-b013-01d3c6cd271e`. Both dormant
  polkit and subsequent normal D-Bus activation/native group readback passed.
  Pilot.7's post-install checks ran on that same boot; no extra final reboot
  interrupted Jari's now-active native account.

## What Jari does first

1. Return to **https://open-habitat.acme.test**. Sign in with GitHub if a fresh
   browser session needs it; the existing session was preserved.
2. Administrator subject1272053 is **already granted**; readback confirms it and
   the declared 21474836480-byte/person default. If a future fresh installation
   defers the role until binding, follow the guide's fresh apply preview/approval
   after first login, or supported `admin role update 1272053 --administrator
   true --json` as root. Never edit gateway administration files.
3. Complete your own Pi/model-provider and other optional tool authorization.
   No shared provider credentials were installed. A working repo catalog does
   not establish model-provider entitlement or every optional integration.

## Maintenance

Strict-pinned SSH uses the customer's existing known_hosts and acme-servers
identity, endpoint203.0.113.30, open-habitat-pilot-1. Protected declaration and
source secrets stay under /etc/open-habitat. Incoming release inputs remain
under /var/lib/open-habitat/release. Future upgrades must name the exact current
release and executable digest above, use a fresh approved plan, then invoke the
staged immutable owner. Never recover through a mutable selector or reset a
journal; inspect typed checks first.

No new customer OS/TLS/DNS change was needed in this round. The prior authorized
security.ubuntu.com repair remains. TLS expires2027-01-21 02:12:16UTC; **Jari
owns manual renewal by2026-12-20**. Use isolated external certbot DNS-01 for only
*.acme.test, save to SOPS, then the operator guide's supported source-pair
rotation and approved apply. No automatic renewal timer or DNS admin token is
installed on the pilot.
