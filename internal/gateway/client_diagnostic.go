package gateway

import (
	"encoding/json"
	"io"
	"math"
	"net/http"
	"slices"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
)

const clientLoadFailurePath = "/api/v1/client/load-failure"

type clientLoadFailure struct {
	SchemaVersion   int    `json:"schema_version"`
	Read            string `json:"read"`
	Reason          string `json:"reason"`
	Status          int    `json:"status"`
	Phase           string `json:"phase"`
	Online          bool   `json:"online"`
	ReadDuration    int    `json:"read_duration_ms"`
	EpisodeDuration int    `json:"episode_duration_ms"`
	Attempts        int    `json:"attempts"`
}

func decodeClientLoadFailure(r io.Reader) (clientLoadFailure, bool) {
	var fields map[string]json.RawMessage
	d := json.NewDecoder(r)
	if d.Decode(&fields) != nil || d.Decode(new(any)) != io.EOF || len(fields) != 9 {
		return clientLoadFailure{}, false
	}
	for _, key := range []string{"schema_version", "read", "reason", "status", "phase", "online", "read_duration_ms", "episode_duration_ms", "attempts"} {
		if value, ok := fields[key]; !ok || string(value) == "null" {
			return clientLoadFailure{}, false
		}
	}
	data, _ := json.Marshal(fields)
	var v clientLoadFailure
	if json.Unmarshal(data, &v) != nil {
		return v, false
	}
	return v, v.SchemaVersion == 1 && slices.Contains([]string{"session", "snapshot", "onboarding", "identity_pair"}, v.Read) && slices.Contains([]string{"network", "http", "invalid", "timeout", "identity_mismatch", "other"}, v.Reason) && slices.Contains([]string{"landing", "stale"}, v.Phase) && v.Status >= 0 && v.Status <= 599 && v.ReadDuration >= 0 && v.ReadDuration <= 86400000 && v.EpisodeDuration >= 0 && v.EpisodeDuration <= 86400000 && v.Attempts >= 1 && v.Attempts <= 10000
}

func (a *Auth) clientLoadFailureHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !a.exact(r, clientLoadFailurePath) || r.URL.RawQuery != "" || !browserHTTP(r) || len(r.TransferEncoding) != 0 || r.ContentLength < 2 || r.ContentLength > 1024 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if denied := a.authorizeWrite(r, s); denied != "" {
		safe(w, 403, denied)
		return
	}
	// One fixed-size budget, independent of user-controlled keys. A malicious
	// authenticated client cannot grow memory or flood the diagnostic journal.
	a.mu.Lock()
	now := a.now()
	b := &a.clientDiagnosticLog
	if b.at.IsZero() {
		b.tokens = 20
	} else {
		b.tokens = math.Min(20, b.tokens+now.Sub(b.at).Seconds()/3)
	}
	b.at = now
	allowed := b.tokens >= 1
	if allowed {
		b.tokens--
	}
	a.mu.Unlock()
	if !allowed {
		safe(w, 429, "rate_limited")
		return
	}
	v, ok := decodeClientLoadFailure(http.MaxBytesReader(w, r.Body, 1024))
	if !ok {
		safe(w, 400, "invalid_request")
		return
	}
	if a.log != nil {
		a.log.Info("client_load_failed", "outcome", "recovered", "reason", v.Reason, "read", v.Read, "phase", v.Phase, "status", v.Status, "online", v.Online, "read_duration_ms", v.ReadDuration, "episode_duration_ms", v.EpisodeDuration, "attempts", v.Attempts, "user", s.identity.Username, "request_id", diagnostic.RequestID(r.Context()))
	}
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusNoContent)
}
