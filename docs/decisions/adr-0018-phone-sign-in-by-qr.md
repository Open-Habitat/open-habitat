# ADR 0018: Sign in a phone from a desktop session with a one-minute QR link

**Status:** Proposed — recommendation to Jari, 2026-10-16

**Issue:** [qr-phone-sign-in](../../issues/qr-phone-sign-in/item.md)

## Problem

A person signed in on a desktop browser wants to open Open Habitat on their
phone without signing in to GitHub there. Jari's case is testing the phone UI:
the phone's browser often has no github.com session, so the ordinary sign-in
means a GitHub password and second factor on a phone keyboard.

Anything that carries a sign-in from one device to another is a bearer
credential for the person's Unix account. A browser session reaches the
person's daemon, and through Pi a shell running as that user
([identity and trust](../architecture/identity-and-trust.md#unix-authority)).
Whoever holds the credential holds the account, so the design is judged first
by who can obtain it and what happens if they do.

Today only `internal/gateway` authenticates browsers. It issues a session after
the GitHub OAuth callback (`internal/gateway/auth.go`) and keeps hashed
session records in its private persistent state
(`internal/gateway/session_store.go`). The daemon trusts no identity claim, and
the broker only binds GitHub IDs to accounts. The test server is public and
admits any GitHub account ([ADR 0014](adr-0014-open-test-admission.md)).

## Decision

**The signed-in desktop shows a QR code with a link token that the gateway
mints. The phone scans it, the person confirms on the phone, and the gateway
gives the phone its own session for the same person.** This is option A of the
issue, with the direction chosen deliberately: the credential flows from the
device that is already trusted to the device the person is holding, and never
from an unknown device to an approval screen.

The gateway alone mints, redeems and records the link. The daemon and the
broker get no new role. The broker's existing `authorize` check runs at
redemption, as it does at the end of every OAuth login. The link token lives
in the gateway's memory beside pending OAuth flows. The new phone session is
an ordinary record in the existing session store. No new store is added.

### What the gateway guarantees

1. **Minting is a deliberate write from a live session.** Settings has a
   "Sign in on phone" button. It sends a POST that passes the existing Origin
   and CSRF checks (`authorizeWrite`). A GET, a link or a cross-site page
   cannot mint a token. One session has at most one outstanding token; minting
   again cancels the previous one.
2. **The token is short-lived, single-use and bound.** It is 256 random bits,
   kept only as a hash, and expires 60 seconds after minting. It records the
   minting session, the subject and its binding, the Access email when
   Cloudflare Access is configured, and the revocation serial at minting time.
   Redemption removes the token before checking anything else, so a failed
   attempt also uses it up, as the OAuth callback does with its state. The
   token is dead if the minting session has ended by then (logout, expiry,
   revocation), if a [subject revocation](adr-0006-subject-revocation.md) has
   happened since minting, or if the broker's `authorize` reply no longer
   matches the binding. With Access configured, the phone's Access email must
   equal the minting session's. A gateway restart drops all tokens, which
   costs one more click.
3. **The token never appears in a request line, log or Referer.** The QR
   encodes `https://<origin>/link#<token>`. Browsers do not send a URL
   fragment to the server or put it in `Referer`
   ([RFC 9110 §10.1.3](https://www.rfc-editor.org/rfc/rfc9110#section-10.1.3)).
   The token therefore never reaches the tunnel or Cloudflare request logs, or
   the gateway's own logs. The `/link` page reads the fragment, removes it with
   `history.replaceState`, and sends the token in a POST body. That POST has
   the same Origin check as other writes, which stops a cross-site page from
   redeeming a token into the phone's browser (login CSRF). Gateway log events
   for linking carry only fixed reasons, the attempt ID and the bound
   username, following [ADR 0013](adr-0013-service-logging.md). A link
   preview in a messaging app fetches only `/link` and learns nothing.
4. **The phone confirms the account before the session is created.** The
   `/link` page first shows which account and server it would sign into, for
   example "Sign in as Jari on Open Habitat test?". Only "Sign in" redeems the
   token. Looking up the display name does not use up the token and shares the
   existing per-peer rate limit with sign-in starts. A look-alike QR that
   carries someone else's account therefore stops at a visible confirmation
   instead of silently signing the phone into the wrong account.
5. **The desktop sees the redemption and can undo it.** While the QR is shown,
   Settings shows its countdown. It hides the code when the code is used or
   expires, and then names the device that used it with a "Sign out this
   device" action. If someone else scanned the code first, the person sees an
   unknown device and their own phone gets "this code was already used".
6. **The person can see and revoke their sessions.** The gateway adds a
   creation time, the method (`github` or `link`) and a coarse device label
   taken from the User-Agent to session records. Settings lists the person's
   own sessions and can end any one of them. This is the revocation that the
   issue's acceptance criteria require, and it is also missing for ordinary
   logins today: the only revocation is root's
   [subject revocation](adr-0006-subject-revocation.md), which still ends all
   of them. The label is only a description that the browser supplies, and
   nothing makes an authorization decision from it. Ending the desktop session
   does not end the phone session.
7. **A link session is not a recent GitHub sign-in.** Native `gh` disconnect
   requires an OAuth sign-in within five minutes. It now infers that from the
   session's absolute deadline (`github_disconnect_linux.go` and the
   `X-Agent-Host-Recent-Login` header in `proxy_linux.go`). A session minted by
   a link would have a fresh deadline and pass that check without any GitHub
   sign-in. The session must record when it last proved a GitHub sign-in, a
   link session inherits the parent's time rather than getting a new one, and
   both checks use that field.

Link sessions have the same lifetime as other sessions: 90 days idle and one
year absolute. A phone is a personal device. A shorter lifetime would only
send the person back to the desktop to scan again, and the session list
handles revocation better than an expiry does.

### What "fresh confirmation" means here

The issue suggests showing the QR only after a fresh confirmation. This
recommendation interprets that as the explicit CSRF-protected click in point
1, not a new GitHub sign-in. A new sign-in would protect against someone who
already holds the desktop session. Such a person can already run commands as
the user through Pi and leave persistent access as that user (an SSH key, a
scheduled job). A phone session gives them nothing new. With the session list,
it is even the most visible form of persistence. The precedent of native
disconnect, which does require a recent sign-in, differs: that action destroys
native state that the browser cannot restore. If a browser session ever
becomes narrower than the Unix account, this assumption must be reconsidered.
Minting would then require the same five-minute recent sign-in as disconnect.

## Threats and what answers them

| Threat | Answer |
|---|---|
| Shoulder-surfing, a photo or a screen share of the QR | Shown only on request, valid for 60 seconds, single use, hidden when used. If someone scans it first, the person sees an unknown device and can sign it out (5, 6). Residual risk: someone who sees the screen within that minute and acts before the person's phone. |
| Screenshot used later, link forwarded | Expires after 60 seconds and dies with the first redemption or with the minting session (2). |
| Replay | Removed before validation, so one attempt uses it up (2). |
| CSRF or login fixation | Minting and redemption are Origin-checked POSTs, minting also checks CSRF (1, 3). The phone confirms the account before the session is created (4). |
| Look-alike QR on a phishing page | It cannot carry the victim's account. One carrying another account stops at the confirmation (4). A fake "verification" page that asks the person to scan their own QR somewhere is social engineering. The Settings panel text says the code signs a device into the account, and the redemption is visible and revocable (5, 6). |
| Token in logs or Referer | In the fragment only, removed from history and sent in a body. Logs use fixed vocabulary (3). |
| Revocation | Per session from Settings (6). Root subject revocation also kills outstanding tokens (2). |
| Brute force | 256-bit token and the per-peer rate limit (2, 4). |

## Alternatives

**B. The phone shows a code, the desktop approves it.** This is the OAuth
device authorization grant ([RFC 8628](https://www.rfc-editor.org/rfc/rfc8628))
and the shape of WhatsApp Web and Signal linked devices, where the trusted
device approves a code from the new one. It avoids a scannable bearer token
on the trusted screen. However, it moves the risk to the most exploited
point: the person is asked to approve a device they cannot see. RFC 8628
§5.4 names this "remote phishing". In practice the attacker starts the flow on
their own device and persuades the victim to approve its code. That is
[Storm-2372's device code phishing](https://www.microsoft.com/en-us/security/blog/2025/02/13/storm-2372-conducts-device-code-phishing-campaign/)
against Microsoft accounts, and the
[Signal linked-device campaigns](https://cloud.google.com/blog/topics/threat-intelligence/russia-targeting-signal-messenger)
that Google's threat intelligence group reported in February 2025. Those
products use that direction because the trusted device is the phone with the
camera. Here the trusted device is the desktop, so in B the person would type
the phone's code on the desktop. The risk is higher, and the convenience is
not better. In A an attacker must see the person's own screen during one
minute. In B the attacker only needs a message the person believes. This is
not close.

**C. No QR; make GitHub sign-in fast on the phone.** This is the strongest
alternative because it adds no credential at all. The same phone signs in
once, and its session then lasts up to a year. If the phone's browser is
already signed in to github.com, it takes two taps. C stays available
regardless of this decision. It does not meet the request, though: Jari's
friction is the GitHub sign-in on each new phone or browser profile used for
testing (password manager, second factor, iOS in-app browser). A costs one
small in-memory token map, a few gateway routes and session metadata that the
session list needs anyway. Its guarantees above are tested at the gateway.
A wins because it removes exactly that friction at a contained risk. The call
was moderately close.

**Rejected refinements.** A token in the path or query string would be simpler
to redeem, but it would land in tunnel, proxy and browser-history logs before
any code could remove it. Binding the phone session to the desktop session,
so that logout ends both, is how a delegated session is often modelled.
However, it would make a phone the person kept surprisingly fragile, and the
explicit session list is clearer.

## Consequences

- The gateway gains `POST` routes to mint, describe and redeem a link and to
  list and end the person's own sessions. Session records gain creation time,
  method, device label and GitHub sign-in time. The session store's version
  changes; per the pre-release policy, old session files are discarded rather
  than migrated, which signs everyone out once.
- The browser gains a Settings panel with the QR and its countdown, the
  session list and a `/link` landing page. Encoding the QR needs one small
  encoder in the browser package. It is the only new dependency, and it can
  be chosen in implementation.
- [Identity and trust](../architecture/identity-and-trust.md) is updated with
  device linking and the person's session list when this is implemented.
- Tests: expiry at 60 seconds, single use including after a failed redemption,
  death on parent logout and on subject revocation, an Access-email mismatch,
  an Origin mismatch at redemption, a link session failing the
  recent-sign-in check, per-session revocation, and a browser test that signs
  a second browser context in through `/link`.
