//go:build linux

package daemon

import (
	"encoding/json"
	"io"
	"net/http"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/experimental"
	"github.com/open-habitat/open-habitat/internal/jsoncheck"
	"github.com/open-habitat/open-habitat/internal/transport"
)

const AgentExperimentalPath = "/agent/v1/experimental"

type experimentalChoice struct {
	experimental.Feature
	Enabled bool `json:"enabled"`
}

// AgentExperimentalHandler reads and changes only the listener owner's switches.
func AgentExperimentalHandler(cfg transport.Config) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !transport.AgentPeer(r) {
			snapshotError(w, 403, "peer_not_authorized")
			return
		}
		if r.URL.Path != AgentExperimentalPath || r.URL.RawPath != "" || r.RequestURI != r.URL.RequestURI() || r.URL.RawQuery != "" || len(r.TransferEncoding) != 0 || (r.Method != "GET" && r.Method != "PUT") || (r.Method == "GET" && r.ContentLength != 0) {
			snapshotError(w, 400, "invalid_arguments")
			return
		}
		var value accountPreferences
		var err error
		if r.Method == "PUT" {
			if r.ContentLength < 2 || r.ContentLength > 128 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 {
				snapshotError(w, 400, "invalid_arguments")
				return
			}
			body, e := io.ReadAll(io.LimitReader(r.Body, 129))
			var input map[string]json.RawMessage
			var id string
			var enabled *bool
			if e != nil || int64(len(body)) != r.ContentLength || !utf8.Valid(body) || !jsoncheck.NoDuplicates(body) || json.Unmarshal(body, &input) != nil || len(input) != 2 || json.Unmarshal(input["id"], &id) != nil || json.Unmarshal(input["enabled"], &enabled) != nil || enabled == nil || !validFeatureID(id) {
				snapshotError(w, 400, "invalid_arguments")
				return
			}
			if !experimental.Known(id) {
				snapshotError(w, 400, "unknown_experimental_feature")
				return
			}
			value, err = applyPreferences(cfg.Home, preferencesWrite{Experimental: map[string]bool{id: *enabled}})
		} else {
			value, err = readPreferences(cfg.Home)
		}
		if err != nil {
			snapshotError(w, 503, "preferences_unavailable")
			return
		}
		choices := []experimentalChoice{}
		for _, feature := range experimental.List() {
			choices = append(choices, experimentalChoice{Feature: feature, Enabled: value.Experimental[feature.ID]})
		}
		historyJSON(w, map[string]any{"schema_version": 1, "features": choices})
	})
}
