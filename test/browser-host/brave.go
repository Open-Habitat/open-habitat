package main

import (
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// braveFake is a synthetic Brave Search API on the host's own TLS origin,
// which the daemons' trial searches reach. No real key or network is used.
// A key starting "BSAbad" is refused with 401 as Brave refuses an unknown
// subscription token; any other well-formed key works. /fixture/brave
// reports how many trial searches came, and /fixture/brave?action=refuse&
// user=NAME writes the search extension's refusal mark for the key in that
// person's home, as pi-web-search does after a refused search.
type braveFake struct {
	mu     sync.Mutex
	asked  int
	homes  map[string]string
	origin func() string
}

func newBraveFake(origin func() string) *braveFake {
	return &braveFake{homes: map[string]string{}, origin: origin}
}

// endpoint is where the daemon's fixture constructor points the search.
func (f *braveFake) endpoint(string) string {
	return f.origin() + "/fixture/brave/res/v1/web/search"
}

// client trusts the host's ephemeral certificate, as only the fixture may.
func (f *braveFake) client() *http.Client {
	return &http.Client{Timeout: 10 * time.Second, Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
}

// nativeList writes the search extension's list of providers that search
// on their own, as pi-web-search 0.2.0 ships it, and returns its path.
func nativeSearchList(dir string) string {
	path := filepath.Join(dir, "native-search.json")
	if err := os.WriteFile(path, []byte(`{"schema":1,"providers":[{"provider":"openai-codex","api":"openai-codex-responses"},{"provider":"openai","api":"openai-responses"},{"provider":"anthropic","api":"anthropic-messages"},{"provider":"claude-bridge"}]}`), 0600); err != nil {
		panic(err)
	}
	return path
}

func (f *braveFake) serve(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/fixture/brave/res/v1/web/search":
		key := r.Header.Get("X-Subscription-Token")
		f.mu.Lock()
		f.asked++
		f.mu.Unlock()
		if r.Method != http.MethodGet || r.URL.Query().Get("q") == "" || r.Header.Get("Accept") != "application/json" {
			http.Error(w, `{"error":{"code":"VALIDATION"}}`, 422)
			return
		}
		if strings.HasPrefix(key, "BSAbad") {
			http.Error(w, `{"error":{"code":"SUBSCRIPTION_TOKEN_INVALID","detail":"synthetic detail"}}`, 401)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"web":{"results":[{"title":"Synthetic","url":"https://example.invalid/","description":"synthetic"}]}}`)
	case "/fixture/brave":
		f.control(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (f *braveFake) control(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	switch r.URL.Query().Get("action") {
	case "state":
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]int{"asked": f.asked})
	case "refuse":
		home, ok := f.homes[r.URL.Query().Get("user")]
		dir := filepath.Join(home, ".config", "web-search")
		var key struct {
			APIKey  string `json:"api_key"`
			Backend string `json:"backend"`
		}
		b, err := os.ReadFile(filepath.Join(dir, "key.json"))
		if !ok || err != nil || json.Unmarshal(b, &key) != nil {
			http.Error(w, "no key", 409)
			return
		}
		digest := sha256.Sum256([]byte(key.APIKey))
		mark, _ := json.Marshal(map[string]any{"last_refused_at": time.Date(2026, 11, 9, 7, 30, 0, 0, time.UTC).Format(time.RFC3339), "backend": key.Backend, "status": 401, "key_sha256": hex.EncodeToString(digest[:])})
		if os.WriteFile(filepath.Join(dir, "state.json"), mark, 0600) != nil {
			http.Error(w, "unwritable", 503)
			return
		}
		w.WriteHeader(204)
	default:
		http.Error(w, "unknown action", 400)
	}
}
