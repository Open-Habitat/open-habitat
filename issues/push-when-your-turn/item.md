---
created: 2026-10-31
updated: 2026-10-31
type: feature
reporter: jari
status: done
priority: normal
lane: push-when-your-turn
lane_seq: 1
preparation: ready
closed: 2026-10-31
---

# Phone notification when an agent waits for you (Web Push, experimental)

## Description

Jari 31.10.: from the Orca benchmark (`issues/benchmark-orca/report.md`,
recommendation 2): a notification on the phone (and desktop) when a
conversation becomes the person's turn (*Sinun vuorosi*: a new reply or a
question) and Open Habitat is not open in front of them. Ships as an
experimental feature (Settings › Kokeelliset ominaisuudet, its own card),
off until the person turns it on. This lifts, for this experiment, the line
in `docs/product.md` that keeps browser/OS notifications outside the product
for now; the line changes when the feature graduates.

### Architecture (conductor's recommendation, 31.10.; Jari may change it)

Authority stays where it already is: the person's daemon decides and sends,
the gateway only serves.

- **Standard Web Push** (Push API + service worker, VAPID, RFC 8291
  encryption). No third-party notification service of ours; the browser
  vendor's push service (Apple, Google, Mozilla) delivers the encrypted
  message.
- **Keys and subscriptions belong to the person.** The daemon, running as
  the Unix user, creates a VAPID key pair for that person and keeps it with
  the subscriptions (one per device) in the person's own configuration
  under their home, 0600. No installation-wide secret, no subscriptions in
  the gateway, nothing one user's process can read of another's. The
  browser gets the person's public key through the daemon API when
  subscribing.
- **The daemon sends** when a conversation enters the person's turn and no
  browser tab of theirs is visible (the presence the daemon already has),
  with a short delay so a reply read at once does not buzz the phone.
- **Minimal content**: workspace and conversation title and "odottaa
  sinua" / "kysyy", no message text; tapping opens the conversation. The
  payload is end-to-end encrypted to the device, but the push service still
  sees timing and size.
- **Service worker** served by the gateway from the site origin (needed for
  push; it does nothing else: no offline caching). iPhone delivers Web Push
  only to a site added to the home screen, so the card says how.
- Each installation needs outbound HTTPS from the daemon to the push
  services; where egress is restricted the card says delivery is not
  possible rather than failing silently.

## Acceptance Criteria

- [x] Experimental card: turn on → permission asked → this device
      subscribed; per-device list with remove; a *Lähetä testi* button.
- [x] A conversation entering Sinun vuorosi while no tab is visible sends
      one notification per turn (not per event), with the minimal content;
      tapping opens that conversation.
- [x] Keys and subscriptions only in the person's own files; removing the
      device or turning the feature off unsubscribes.
- [x] Contract, daemon tests (sending, de-duplication, presence), browser
      spec with a fake push endpoint; English and Finnish texts.
- [x] Notes for operators: egress needs; iPhone home-screen requirement.

## Comments
