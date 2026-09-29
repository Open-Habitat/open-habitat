//go:build linux

package daemon

import (
	"net/http"
	"regexp"
	"sync"
	"time"

	"github.com/maintainer/native-agent-host/internal/transport"
)

// Attempt state is ephemeral and scoped to this daemon process. Pi remains the
// only authority for whether credentials actually work.
type piAttempt struct {
	mu                        sync.Mutex
	device                    *PiDevice
	owner, id, progress, code string
	until                     time.Time
	done                      bool
}

var sessionToken = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)

// PiAttemptHandler binds one ephemeral attempt lease to a daemon instance.
// The caller must mount the returned handler only on its trusted peer socket.
func PiAttemptHandler(cfg transport.Config, trusted func(*http.Request) bool, device *PiDevice) http.Handler {
	return (&piAttempt{device: device}).handler(cfg, trusted)
}

func (a *piAttempt) handler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := "/api/v1/onboarding/pi/attempt"
		if (r.Method != "GET" && r.Method != "POST" && r.Method != "DELETE") || r.RequestURI != path || r.URL.RawQuery != "" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		tokens := r.Header.Values("X-Agent-Host-Session")
		if len(tokens) != 1 || !sessionToken.MatchString(tokens[0]) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		owner := tokens[0]
		a.mu.Lock()
		if a.owner != "" && time.Now().After(a.until) {
			a.device.Cancel(a.id)
			a.owner, a.id, a.progress, a.code = "", "", "", ""
			a.done = false
		}
		switch r.Method {
		case "POST":
			if a.owner != "" && (!a.done || a.owner != owner) {
				a.mu.Unlock()
				snapshotError(w, 409, "attempt_active")
				return
			}
			id, events, err := a.device.Start()
			if err != nil {
				a.mu.Unlock()
				snapshotError(w, 503, "native_source_unavailable")
				return
			}
			a.owner, a.id, a.progress, a.code = owner, id, "pending", ""
			a.done = false
			a.until = time.Now().Add(5 * time.Minute)
			go a.collect(id, events)
		case "DELETE":
			if a.owner != owner {
				a.mu.Unlock()
				snapshotError(w, 404, "attempt_not_found")
				return
			}
			// Even an accepted cancel is not evidence of failed or successful native login.
			a.device.Cancel(a.id)
			a.progress, a.code = "unknown", ""
		default:
			if a.owner != owner {
				a.mu.Unlock()
				snapshotError(w, 404, "attempt_not_found")
				return
			}
		}
		id := a.id
		a.mu.Unlock()
		// The active helper may need the whole HTTP deadline to prepare its code.
		// Do not block a start (or a code read) on a second native status helper.
		// Only a terminal attempt needs credential evidence; the separate status
		// endpoint remains the authority for onboarding completion.
		state := "unknown"
		a.mu.Lock()
		terminal := a.owner == owner && a.id == id && (a.progress == "completed" || a.progress == "unknown")
		a.mu.Unlock()
		if terminal {
			state = a.device.StatusContext(r.Context())
			if r.Context().Err() != nil {
				state = "unknown"
			}
		}
		result := struct {
			SchemaVersion int `json:"schema_version"`
			Attempt       struct {
				State           string `json:"state"`
				PiState         string `json:"pi_state"`
				VerificationURI string `json:"verification_uri,omitempty"`
				UserCode        string `json:"user_code,omitempty"`
			} `json:"attempt"`
		}{SchemaVersion: 1}
		a.mu.Lock()
		if a.owner != owner || a.id != id {
			a.mu.Unlock()
			snapshotError(w, 404, "attempt_not_found")
			return
		}
		result.Attempt.State, result.Attempt.PiState = a.progress, state
		if result.Attempt.State == "completed" && state != "usable" {
			result.Attempt.State = "unknown"
		}
		if a.progress == "device_code" {
			result.Attempt.VerificationURI = "https://auth.openai.com/codex/device"
			result.Attempt.UserCode = a.code
		}
		a.mu.Unlock()
		historyJSON(w, result)
	})
}
func (a *piAttempt) collect(id string, events <-chan PiDeviceEvent) {
	for event := range events {
		a.mu.Lock()
		if a.id == id && a.progress != "unknown" {
			switch event.Type {
			case "device_code":
				a.progress, a.code = "device_code", event.UserCode
			case "status":
				a.progress, a.code = "completed", ""
			case "unknown":
				a.progress, a.code = "unknown", ""
			}
		}
		a.mu.Unlock()
	}
	a.mu.Lock()
	if a.id == id {
		if a.progress != "completed" {
			a.progress, a.code = "unknown", ""
		}
		a.done = true
	}
	a.mu.Unlock()
}
