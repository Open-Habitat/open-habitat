# Result: phone notification when it is your turn (experimental)

Landed as the experimental card *Ilmoitus puhelimeen, kun on vuorosi* in
Settings › Kokeelliset ominaisuudet, off by default. Authority stays as the
issue's architecture said: the person's daemon makes and keeps the VAPID key
pair and the devices in `~/.config/open-habitat/push.json` (0600), decides and
sends; the gateway relays the routes and serves `/push-sw.js` and the manifest
from the site origin. No installation-wide secret, no subscription outside the
person's home.

## Evidence

- `internal/webpush`: RFC 8291 test vector reproduced byte for byte; VAPID
  JWT verified under the public key; outcomes per status; the production
  client refuses loopback.
- `internal/daemon/push_linux_test.go`: file only in the person's home,
  0600, refused when group-readable or a symlink; browser view carries no
  endpoint, secret or private key; endpoint allowlist; off removes the file;
  presence suppression, one notification per turn and per conversation until
  the person returns, 410 removes the device, the payload decrypted carries
  only names/kind/url; the controller drops a turn that ended meanwhile.
- `internal/gateway/push_linux_test.go`: routes need a session, writes CSRF,
  bodies capped per route.
- Browser spec `web/tests/push-notifications.spec.ts` (synthetic host, real
  gateway/daemon/controller, fake Pi, fake push service decrypting with the
  subscription's keys): subscribe on the switch's press, test send, no push
  while present, one push while away with no message text, a second turn of
  the same conversation does not push again, tap routing, remove, off
  forgets the key; a refusing push service shows on the card.
- Screenshots (device scale 2) with HTML: `evidence/card-fi.*`, `evidence/card-en.*`.
- Review: independent `/llm-review` (finder gpt-6-astra, verifier
  claude-fable-5-1) + `/assess-findings`: 4 confirmed findings, all fixed
  (resume reused turn counters for de-dup; a failed preferences write could
  read as off and unsubscribe; a failed off-write unsubscribed; a tap could be
  lost in a tab without the listener).

## systemd and Fleetrepo

`systemd/open-habitat-daemon@.service` restricts no outbound traffic
(no `IPAddressDeny`, `RestrictAddressFamilies` or proxy), so no unit change.
Fleetrepo needs nothing for its installations: it has no daemon drop-ins, and
the test VM's firewall restricts inbound SSH only. Where an operator does
restrict egress, `docs/operations.md` names the four push-service hosts; the
card's *Lähetä testi* says when the server cannot reach them.

## Decisions for later review

1. **Crypto on the standard library**, not `SherClockHolmes/webpush-go`:
   Go 1.27 has ECDH, ECDSA raw keys and HKDF in the standard library, so the
   whole of RFC 8291/8292 is ~150 lines checked against the RFC vector,
   against a library plus golang-jwt and x/crypto.
2. **"In front of a tab" means a visible tab used in the last two minutes**,
   reported every 20 s to a new account-level presence route; a reply waits
   30 s and is dropped if such a report came within 60 s. Alternative: plain
   tab visibility (HAPI's choice), which lets a desktop tab left open block
   every phone notification.
3. **One notification per conversation until the person returns**, not per
   turn: an agent looping through turns while the person is away buzzes once.
   A question after a notified turn in the same conversation also waits.
4. **Endpoints limited to the vendors' push services** (FCM, Mozilla, Apple,
   WNS) plus the shared egress dial rule, so the browser cannot make the
   daemon post elsewhere. A new browser vendor needs a code change.
5. **Off forgets everything**: turning the switch off deletes the key pair and
   every device; a page load only refreshes a device still recorded, so one
   removed elsewhere does not come back. At most ten devices.
6. **Wording in the service worker**, in the language the device had when it
   subscribed (refreshed on every page load), since the worker runs without
   the app.
7. **No "cleared" push to other devices** when a turn is handled elsewhere: a
   push that shows nothing gets a Safari subscription revoked silently. A
   device closes its own notification for the conversation it shows; the
   push service's Topic replaces an undelivered older one; TTL is 12 h.
8. **Recap-only Pi starts do not notify**; Habitat's own wake turns do, as
   the rail counts them as the person's turn.
9. **Web app manifest and home-screen icon added** for the whole app, needed
   for iPhone Web Push (a home-screen web app).
