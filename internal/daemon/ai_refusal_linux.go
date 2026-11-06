//go:build linux

package daemon

import (
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"time"
)

// Pi's providers whose sign-in or key a person repairs in Habitat.
var aiProviders = map[string]bool{"claude-bridge": true, "openai-codex": true, "openai": true, "anthropic": true, "deepseek": true}

type aiRefusal struct {
	Provider string `json:"provider"`
	Since    string `json:"since"`
}

// aiRefusals tells which providers refuse the person's sign-in now, from
// the native histories the snapshot already reads: the latest refusal on any
// branch is newer than the latest reply from that provider on any branch and
// than the last change to the provider's credential store, which a sign-in or
// a saved key rewrites (proto-ai-sign-in-expired round 1). Nothing is stored:
// a reply or a new sign-in ends the refusal, wherever it was made.
func aiRefusals(home string, scans []branchScan) []aiRefusal {
	refused, works := map[string]int64{}, map[string]int64{}
	for _, s := range scans {
		for p, at := range s.refused {
			refused[p] = max(refused[p], at)
		}
		for p, at := range s.works {
			works[p] = max(works[p], at)
		}
	}
	result := []aiRefusal{}
	for p, at := range refused {
		if at <= works[p] || at <= credentialsChanged(home, p) {
			continue
		}
		result = append(result, aiRefusal{Provider: p, Since: time.UnixMilli(at).UTC().Format(time.RFC3339Nano)})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Provider < result[j].Provider })
	return result
}

// credentialsChanged is when the provider's native credential store last
// changed, Unix ms; 0 when it cannot be read. Claude Code keeps its own
// sign-in; Pi keeps its subscriptions and keys in one file.
func credentialsChanged(home, provider string) int64 {
	if home == "" {
		return 0
	}
	path := filepath.Join(home, ".pi", "agent", "auth.json")
	if provider == "claude-bridge" {
		path = filepath.Join(home, ".claude", ".credentials.json")
	}
	st, err := os.Lstat(path)
	if err != nil || !st.Mode().IsRegular() {
		return 0
	}
	return st.ModTime().UnixMilli()
}

// afterKeySaved calls signedIn once the credentials handler has saved a key:
// a new key may end a provider's refusal.
func afterKeySaved(h http.Handler, signedIn func()) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen := &savedStatus{ResponseWriter: w, code: http.StatusOK}
		h.ServeHTTP(seen, r)
		if r.Method == http.MethodPost && seen.code == http.StatusOK {
			signedIn()
		}
	})
}

type savedStatus struct {
	http.ResponseWriter
	code int
}

func (s *savedStatus) WriteHeader(code int) {
	s.code = code
	s.ResponseWriter.WriteHeader(code)
}
