# Result

The setup guide's scope step now lists `https://www.googleapis.com/auth/userinfo.email`
instead of `email`, so every line is a name the Cloud Console's Data Access ›
Add or Remove Scopes list shows. The other lines already matched it: `openid`
is listed under that bare name, and drive, gmail.modify, calendar and contacts
under their full URLs. The daemon's request is unchanged (`openid email ...`);
Google grants `email` as `userinfo.email`, and `googleIdentity` accepts both.
A component test now pins the listed scopes.

Review: focused self-review (web-only text change, no daemon, contract or
authority path touched). Checks: `scripts/test-focused.sh --area web` passed.

## Decisions for later review

- Kept the daemon's short `email` in its authorization request rather than
  switching it to the URL form too: the brief asked to leave it, both forms
  yield the same grant, and the only visible problem was the guide's text.
