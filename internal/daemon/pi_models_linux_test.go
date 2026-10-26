//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestPiModelsNativeDefault(t *testing.T) {
	p, home := piFixture(t)
	if _, err := p.models(context.Background(), "gpt-5.5"); err == nil {
		t.Fatal("accepted model without credentials")
	}
	missing, err := p.models(context.Background(), "")
	if err != nil || missing.CatalogStatus != "native_cached" || !slices.ContainsFunc(missing.Models, func(m piModel) bool { return m.Provider == "claude-bridge" }) {
		t.Fatalf("missing auth: %+v %v", missing, err)
	}
	_, events, err := p.Start()
	if err != nil {
		t.Fatal(err)
	}
	for range events {
	}
	// A native cached catalog entry must remain visible without network access.
	catalog, _ := json.Marshal(map[string]any{"openai-codex": map[string]any{
		"lastModified": int64(4102444800000),
		"models":       []any{map[string]any{"provider": "openai-codex", "id": "gpt-99-sol", "name": "Cached fixture", "api": "openai-codex-responses", "input": []string{"text"}, "contextWindow": 128000, "maxTokens": 4096}},
	}})
	if err := os.WriteFile(filepath.Join(home, ".pi", "agent", "models-store.json"), catalog, 0600); err != nil {
		t.Fatal(err)
	}
	available, err := p.models(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(available.Models) == 0 {
		t.Fatal("no native models")
	}
	model := "gpt-99-sol"
	// The context indicator's limits are Pi's: the registry window and the
	// compaction reserve, here Pi's defaults.
	cached := func(r piModelsResponse) piModel {
		i := slices.IndexFunc(r.Models, func(m piModel) bool { return m.ID == model })
		if i < 0 {
			t.Fatalf("Pi cached model absent: %+v", r.Models)
		}
		return r.Models[i]
	}
	if m := cached(available); m.ContextWindow != 128000 || m.CompactionReserve == nil || *m.CompactionReserve != 16384 || available.AutoCompaction == nil || !*available.AutoCompaction {
		t.Fatalf("context limits: %+v auto=%v", m, available.AutoCompaction)
	}
	settingsPath := filepath.Join(home, ".pi", "agent", "settings.json")
	if err := os.WriteFile(settingsPath, []byte(`{"theme":"dark","defaultProvider":"anthropic","defaultModel":"old","compaction":{"enabled":false,"modelOverrides":{"openai-codex/gpt-99-sol":{"reserveTokens":30000}}}}`), 0600); err != nil {
		t.Fatal(err)
	}
	previous, err := p.models(context.Background(), "")
	if err != nil || previous.DefaultProvider == nil || *previous.DefaultProvider != "anthropic" || previous.DefaultModel == nil || *previous.DefaultModel != "old" {
		t.Fatalf("lost other provider's default: %+v, %v", previous, err)
	}
	if m := cached(previous); m.CompactionReserve == nil || *m.CompactionReserve != 30000 || previous.AutoCompaction == nil || *previous.AutoCompaction {
		t.Fatalf("Pi's own compaction settings not read: %+v auto=%v", m, previous.AutoCompaction)
	}
	chosen, err := p.models(context.Background(), model)
	if err != nil {
		t.Fatal(err)
	}
	if chosen.DefaultModel == nil || *chosen.DefaultModel != model {
		t.Fatalf("not read back: %+v", chosen)
	}
	b, err := os.ReadFile(filepath.Join(home, ".pi", "agent", "settings.json"))
	if err != nil {
		t.Fatal(err)
	}
	var settings map[string]any
	if err := json.Unmarshal(b, &settings); err != nil {
		t.Fatal(err)
	}
	if settings["theme"] != "dark" || settings["defaultProvider"] != "openai-codex" || settings["defaultModel"] != model {
		t.Fatal("Pi settings not updated")
	}
	if _, err := p.models(context.Background(), "not-a-model"); err == nil {
		t.Fatal("accepted unknown model")
	}
	again, err := p.models(context.Background(), "")
	if err != nil || *again.DefaultModel != model {
		t.Fatalf("changed after rejection: %+v, %v", again, err)
	}
	outside := t.TempDir()
	if err := os.Remove(filepath.Join(home, ".pi", "agent", "settings.json")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(outside, "settings.json"), filepath.Join(home, ".pi", "agent", "settings.json")); err != nil {
		t.Fatal(err)
	}
	if _, err := p.models(context.Background(), model); err == nil {
		t.Fatal("wrote through settings symlink")
	}
}

func TestPiModelsHandlerRejectsUntrusted(t *testing.T) {
	p, _ := piFixture(t)
	handler := PiModelsHandler(transport.Config{}, func(*http.Request) bool { return false }, p)
	for _, method := range []string{"GET", "POST"} {
		req := httptest.NewRequest(method, "http://unix/api/v1/pi/models", strings.NewReader(`{"model":"gpt-5.5"}`))
		req.RequestURI = "/api/v1/pi/models"
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		if w.Code != 403 {
			t.Fatalf("%s: %d", method, w.Code)
		}
	}
}
