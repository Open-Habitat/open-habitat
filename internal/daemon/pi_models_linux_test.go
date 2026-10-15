//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestPiModelsNativeDefault(t *testing.T) {
	p, home := piFixture(t)
	if _, err := p.models(context.Background(), "gpt-5.5"); err == nil {
		t.Fatal("accepted model without credentials")
	}
	_, events, err := p.Start()
	if err != nil {
		t.Fatal(err)
	}
	for range events {
	}
	available, err := p.models(context.Background(), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(available.Models) == 0 {
		t.Fatal("no native models")
	}
	model := available.Models[0].ID
	settingsPath := filepath.Join(home, ".pi", "agent", "settings.json")
	if err := os.WriteFile(settingsPath, []byte(`{"theme":"dark","defaultModel":"old"}`), 0600); err != nil {
		t.Fatal(err)
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
