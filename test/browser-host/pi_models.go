//go:build linux

package main

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

// piModelsFixture is deliberately synthetic: the browser host runs fake Pi,
// while the daemon's disposable native-home test exercises the real SDK.
func piModelsFixture(home string, trusted func(*http.Request) bool) http.Handler {
	path := filepath.Join(home, ".pi", "agent", "settings.json")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !trusted(r) || r.URL.Path != "/api/v1/pi/models" || r.URL.RawQuery != "" || r.Host != "unix" {
			http.Error(w, "denied", 403)
			return
		}
		if r.Method != http.MethodGet && r.Method != http.MethodPost {
			http.Error(w, "invalid method", 405)
			return
		}
		state := struct {
			Provider string `json:"defaultProvider"`
			Model    string `json:"defaultModel"`
		}{}
		b, err := os.ReadFile(path)
		if err != nil && !os.IsNotExist(err) {
			http.Error(w, "unavailable", 503)
			return
		}
		if len(b) > 0 && json.Unmarshal(b, &state) != nil {
			http.Error(w, "unavailable", 503)
			return
		}
		if r.Method == http.MethodPost {
			if r.Header.Get("Content-Type") != "application/json" || r.ContentLength <= 0 || r.ContentLength > 512 {
				http.Error(w, "invalid body", 400)
				return
			}
			input := struct {
				Model string `json:"model"`
			}{}
			d := json.NewDecoder(io.LimitReader(r.Body, 513))
			d.DisallowUnknownFields()
			if d.Decode(&input) != nil || d.Decode(new(any)) != io.EOF || (input.Model != "gpt-5.5" && input.Model != "gpt-5.4") {
				http.Error(w, "invalid model", 400)
				return
			}
			state.Provider = "openai-codex"
			state.Model = input.Model
			b, _ := json.Marshal(state)
			if os.WriteFile(path, b, 0600) != nil {
				http.Error(w, "unavailable", 503)
				return
			}
		}
		var provider, model *string
		if state.Provider != "" {
			provider = &state.Provider
		}
		if state.Model != "" {
			model = &state.Model
		}
		response := struct {
			SchemaVersion   int                 `json:"schema_version"`
			DefaultProvider *string             `json:"default_provider"`
			DefaultModel    *string             `json:"default_model"`
			Models          []map[string]string `json:"models"`
		}{
			1, provider, model, []map[string]string{{"id": "gpt-5.5", "name": "GPT 5.5"}, {"id": "gpt-5.4", "name": "GPT 5.4"}},
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(response)
	})
}
