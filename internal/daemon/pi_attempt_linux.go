//go:build linux

package daemon

import (
	"errors"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"sync"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
	"github.com/Open-Habitat/open-habitat/internal/transport"
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

var piAgentAttemptID = regexp.MustCompile(`^[0-9a-f]{32}$`)

var sessionToken = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)

// PiAttemptHandler binds one ephemeral attempt lease to a daemon instance.
// The caller must mount the returned handler only on its trusted peer socket.
func PiAttemptHandler(cfg transport.Config, trusted func(*http.Request) bool, device *PiDevice, onAuthenticated func()) http.Handler {
	return (&piAttempt{device: device}).handler(cfg, trusted, onAuthenticated)
}

func (a *piAttempt) handler(cfg transport.Config, trusted func(*http.Request) bool, onAuthenticated func()) http.Handler {
	return a.handlerAt(cfg, trusted, onAuthenticated, "/api/v1/onboarding/pi/attempt", false)
}
func (a *piAttempt) handlerAt(cfg transport.Config, trusted func(*http.Request) bool, onAuthenticated func(), path string, agent bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		target := ""
		if agent && (r.Method == "GET" || r.Method == "DELETE") {
			q, err := url.ParseQuery(r.URL.RawQuery)
			if err != nil || len(q) != 1 || len(q["attempt_id"]) != 1 || !piAgentAttemptID.MatchString(q.Get("attempt_id")) {
				snapshotError(w, 400, "invalid_request")
				return
			}
			target = q.Get("attempt_id")
		}
		if (r.Method != "GET" && r.Method != "POST" && r.Method != "DELETE") || (r.URL.Path != path || r.URL.RawPath != "" || r.RequestURI != r.URL.RequestURI()) || (!agent && r.URL.RawQuery != "") || (r.Method == "POST" && r.URL.RawQuery != "") || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		owner := "agent-own-uid"
		if !agent {
			tokens := r.Header.Values("X-Agent-Host-Session")
			if len(tokens) != 1 || !sessionToken.MatchString(tokens[0]) {
				snapshotError(w, 403, "cross_user_denied")
				return
			}
			owner = tokens[0]
		}
		a.mu.Lock()
		if a.owner != "" && time.Now().After(a.until) {
			a.device.Cancel(a.id)
			a.owner, a.id, a.progress, a.code = "", "", "", ""
			a.done = false
		}
		if agent && r.Method != "POST" && (a.owner != owner || a.id != target) {
			a.mu.Unlock()
			snapshotError(w, 404, "attempt_not_found")
			return
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
				if errors.Is(err, errPiAttemptActive) {
					snapshotError(w, 409, "attempt_active")
					return
				}
				diagnostic.New(os.Stderr, "daemon").Warn("pi_device_start", "outcome", "failed", "reason", "native_source_unavailable", "user", cfg.Username)
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
		if r.Method == "POST" {
			diagnostic.New(os.Stderr, "daemon").Info("pi_device_start", "outcome", "accepted", "user", cfg.Username, "attempt_id", id)
		}
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
			SchemaVersion int    `json:"schema_version"`
			AttemptID     string `json:"attempt_id,omitempty"`
			Attempt       struct {
				State           string `json:"state"`
				PiState         string `json:"pi_state"`
				VerificationURI string `json:"verification_uri,omitempty"`
				UserCode        string `json:"user_code,omitempty"`
			} `json:"attempt"`
		}{SchemaVersion: 1}
		if agent {
			result.AttemptID = id
		}
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
		if result.Attempt.State == "completed" && state == "usable" && onAuthenticated != nil {
			onAuthenticated()
		}
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
