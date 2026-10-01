# Result: Unix-user conversation ownership

The gateway now forwards conversation lists, creates and controls to the mapped
user's daemon without a browser-cookie lease or reply rewriting. Only Pi device
login attempts still carry a session-bound header. The browser opens conversation
status directly; a returned status for the selected workspace determines whether
controls are shown. The app's daemon conversation catalog is still used to
route native read-only history separately from daemon-managed conversations; it
is not a browser-session authorization list. The daemon's ownership lock and
continuation proof are unchanged.

Evidence on the synthetic host (no real user data):

- `go test ./internal/gateway ./internal/daemon -count=1` passed. The gateway
  exercises a second login, a new gateway instance with a new login against the
  surviving daemon socket, and separate mapped socket routing. The daemon suite
  retains native flock and continuation tests. The socket-routing test uses two
  synthetic sockets under one test UID, not two kernel users.
- `./scripts/test-web-fast.sh` passed; targeted Playwright create, lost-create
  and navigation cases passed with `NAH_PORT_BASE=14500`.
- `python3 scripts/validate-project-view.py`, `git diff --check`, and
  `issuectl doctor --json` passed. Doctor reported existing legacy raster-image
  advisories, no blocking errors.

The clean committed-tree gate and its revision are recorded after it completes.
Cross-UID isolation remains established by the existing guest tests, not by the
same-UID synthetic browser host in this result. The surviving daemon/Pi child
across a real gateway restart is exercised by the synthetic socket fixture,
not a production deployment.
