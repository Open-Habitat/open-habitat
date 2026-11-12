//go:build linux

package main

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// piModelsFixture is deliberately synthetic: the browser host runs fake Pi,
// while the daemon's disposable native-home test exercises the real SDK.
// Pi's own ids for these providers, including Pi 1.5.2's native default after
// a first key (claude-opus-5-5, deepseek-v4-pro).
var fixtureKeyModels = map[string][][3]string{
	"anthropic": {{"claude-opus-5-5", "Claude Opus 5.5", ""}, {"claude-sonnet-5-5", "Claude Sonnet 5.5", ""}, {"claude-opus-4-8", "Claude Opus 4.8", "older"}},
	"deepseek":  {{"deepseek-v4-pro", "DeepSeek V4 Pro", ""}, {"deepseek-flash", "DeepSeek V4.1 Flash", ""}},
}

func keyModel(provider, id string) bool {
	for _, m := range fixtureKeyModels[provider] {
		if m[0] == id {
			return true
		}
	}
	return false
}

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
			Thinking string `json:"defaultThinkingLevel"`
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
				Provider string `json:"provider"`
				Model    string `json:"model"`
				Thinking string `json:"thinking"`
			}{}
			d := json.NewDecoder(io.LimitReader(r.Body, 513))
			d.DisallowUnknownFields()
			subscription := func() bool {
				return input.Model == "gpt-5.5" || input.Model == "gpt-5.4" || input.Model == "gpt-6-luna" || input.Model == "gpt-5.6-terra" || input.Model == "gpt-6-astra" || input.Model == "gpt-6.1-sol" || input.Model == "gpt-6-sol" || input.Model == "gpt-6-nova"
			}
			if d.Decode(&input) != nil || d.Decode(new(any)) != io.EOF || !keyModel(input.Provider, input.Model) && (input.Provider == "anthropic" || input.Provider == "deepseek" || !subscription()) {
				http.Error(w, "invalid model", 400)
				return
			}
			state.Provider = input.Provider
			if state.Provider == "" {
				state.Provider = "openai-codex"
			}
			state.Model = input.Model
			state.Thinking = input.Thinking
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
		level := state.Thinking
		if level == "" {
			level = "off"
		}
		response := map[string]any{"schema_version": 1, "default_provider": provider, "default_model": model, "default_thinking": level, "catalog_status": "native_cached", "models": []map[string]any{
			{"id": "gpt-6-luna", "name": "GPT-6 Luna", "thinking_levels": []string{"off", "low", "medium", "high"}},
			{"id": "gpt-5.6-terra", "name": "GPT-5.6 Terra", "thinking_levels": []string{"off", "low", "medium", "high", "xhigh"}},
			{"id": "gpt-6-astra", "name": "GPT-6 Astra", "outcome": "answered", "observed_at": time.Now().UTC().Add(-time.Hour).Format(time.RFC3339), "thinking_levels": []string{"off", "low", "medium", "high", "xhigh"}},
			{"id": "gpt-6.1-sol", "name": "GPT-6.1 Sol", "thinking_levels": []string{"off", "low", "medium", "high"}},
			{"id": "gpt-6-nova", "name": "GPT-6 Nova", "thinking_levels": []string{"off", "high"}},
			{"id": "gpt-6-sol", "name": "GPT-6 Sol", "older": true, "thinking_levels": []string{"off", "high"}},
			{"id": "gpt-5.5", "name": "GPT 5.5", "outcome": "refused", "observed_at": time.Now().UTC().Add(-2 * time.Hour).Format(time.RFC3339), "older": true, "thinking_levels": []string{"off", "high"}},
			{"id": "gpt-5.4", "name": "GPT 5.4", "older": true, "thinking_levels": []string{"off", "high"}},
		}}
		models := response["models"].([]map[string]any)
		for _, m := range models {
			m["provider"] = "openai-codex"
			m["context_window"] = 272000
			m["compaction_reserve_tokens"] = 16384
		}
		response["auto_compaction"] = true
		response["background_models"] = map[string]string{"openai-codex": "gpt-6-luna"}
		raw, _ := os.ReadFile(filepath.Join(home, ".pi/agent/auth.json"))
		var credentials map[string]any
		_ = json.Unmarshal(raw, &credentials)
		if credentials["openai"] != nil {
			for _, m := range append([]map[string]any{}, models...) {
				models = append(models, map[string]any{"provider": "openai", "id": m["id"], "name": m["name"], "thinking_levels": m["thinking_levels"], "older": m["older"] == true, "context_window": 400000, "compaction_reserve_tokens": 16384})
			}
		}
		for _, provider := range []string{"anthropic", "deepseek"} {
			if credentials[provider] != nil {
				for _, m := range fixtureKeyModels[provider] {
					models = append(models, map[string]any{"provider": provider, "id": m[0], "name": m[1], "thinking_levels": []string{"off", "high"}, "older": m[2] == "older", "context_window": 1000000, "compaction_reserve_tokens": 16384})
				}
			}
		}
		response["models"] = models
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(response)
	})
}
