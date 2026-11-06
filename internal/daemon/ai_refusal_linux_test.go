//go:build linux

package daemon

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// A provider refuses the sign-in from its latest refusal on any branch until a
// reply comes from it or its credential store changes.
func TestAIRefusalsWeighRepliesAndSignIns(t *testing.T) {
	line := func(id, parent, at, message string) string {
		p := "null"
		if parent != "" {
			p = `"` + parent + `"`
		}
		return `{"type":"message","id":"` + id + `","parentId":` + p + `,"timestamp":"` + at + `","message":` + message + `}`
	}
	prompt := `{"role":"user","content":"x"}`
	oauth := `{"role":"assistant","provider":"claude-bridge","stopReason":"error","errorMessage":"Failed to authenticate: OAuth session expired and could not be refreshed"}`
	overloaded := `{"role":"assistant","provider":"claude-bridge","stopReason":"error","errorMessage":"529 overloaded"}`
	claudeAnswer := `{"role":"assistant","provider":"claude-bridge","stopReason":"stop"}`
	codexAnswer := `{"role":"assistant","provider":"openai-codex","stopReason":"stop"}`
	key := `{"role":"assistant","provider":"openai","stopReason":"error","errorMessage":"401 Incorrect API key provided"}`
	scan := func(lines ...string) branchScan { return scanBranch([]byte(strings.Join(lines, "\n"))) }
	failed := scan(line("a1", "", "2030-01-01T10:00:00Z", prompt), line("a2", "a1", "2030-01-01T10:00:01Z", oauth),
		// Asked again and still waiting: the refusal stands.
		line("a3", "a2", "2030-01-01T10:00:05Z", prompt))
	if failed.refused["claude-bridge"] == 0 || failed.turnError {
		t.Fatalf("refusal must outlive the next prompt: %+v", failed)
	}
	if s := scan(line("o1", "", "2030-01-01T10:00:00Z", prompt), line("o2", "o1", "2030-01-01T10:00:01Z", overloaded)); len(s.refused) != 0 {
		t.Fatalf("an outage is not a refused sign-in: %+v", s.refused)
	}
	if s := scan(line("s1", "", "2030-01-01T10:00:00Z", prompt), line("s2", "s1", "2030-01-01T10:00:01Z", oauth), line("s3", "s1", "2030-01-01T10:00:02Z", claudeAnswer)); len(s.refused) != 0 {
		t.Fatalf("an abandoned branch's refusal does not count: %+v", s.refused)
	}
	home := t.TempDir()
	got := aiRefusals(home, []branchScan{failed, scan(line("k1", "", "2030-01-01T09:00:00Z", prompt), line("k2", "k1", "2030-01-01T09:00:01Z", key))})
	if len(got) != 2 || got[0] != (aiRefusal{"claude-bridge", "2030-01-01T10:00:01Z"}) || got[1].Provider != "openai" {
		t.Fatalf("refusals: %+v", got)
	}
	// A later answer from Claude in another conversation ends it; another
	// provider's answer does not.
	later := scan(line("b1", "", "2030-01-01T11:00:00Z", prompt), line("b2", "b1", "2030-01-01T11:00:01Z", claudeAnswer))
	other := scan(line("c1", "", "2030-01-01T11:00:00Z", prompt), line("c2", "c1", "2030-01-01T11:00:01Z", codexAnswer))
	if got := aiRefusals(home, []branchScan{failed, other}); len(got) != 1 {
		t.Fatalf("another provider's answer ended the refusal: %+v", got)
	}
	if got := aiRefusals(home, []branchScan{failed, later}); len(got) != 0 {
		t.Fatalf("a later answer must end the refusal: %+v", got)
	}
	// A sign-in rewrites Claude Code's own store after the refusal.
	store := filepath.Join(home, ".claude", ".credentials.json")
	if err := os.MkdirAll(filepath.Dir(store), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(store, []byte("{}"), 0o600); err != nil {
		t.Fatal(err)
	}
	signed := time.Date(2030, 1, 1, 10, 30, 0, 0, time.UTC)
	if err := os.Chtimes(store, signed, signed); err != nil {
		t.Fatal(err)
	}
	if got := aiRefusals(home, []branchScan{failed}); len(got) != 0 {
		t.Fatalf("a later sign-in must end the refusal: %+v", got)
	}
	before := time.Date(2030, 1, 1, 9, 30, 0, 0, time.UTC)
	if err := os.Chtimes(store, before, before); err != nil {
		t.Fatal(err)
	}
	if got := aiRefusals(home, []branchScan{failed}); len(got) != 1 {
		t.Fatalf("an older sign-in is what was refused: %+v", got)
	}
}

func TestAfterKeySavedHearsOnlyASave(t *testing.T) {
	calls := 0
	h := afterKeySaved(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Fail") != "" {
			w.WriteHeader(503)
		}
	}), func() { calls++ })
	for _, tc := range []struct {
		method, fail string
		want         int
	}{{"GET", "", 0}, {"POST", "1", 0}, {"DELETE", "", 0}, {"POST", "", 1}} {
		calls = 0
		r := httptest.NewRequest(tc.method, "/api/v1/pi/credentials", nil)
		if tc.fail != "" {
			r.Header.Set("X-Fail", tc.fail)
		}
		h.ServeHTTP(httptest.NewRecorder(), r)
		if calls != tc.want {
			t.Fatalf("%s fail=%q: %d calls", tc.method, tc.fail, calls)
		}
	}
}

// A failed reply names the provider that refused the sign-in; an outage or a
// provider Habitat does not repair does not.
func TestHistoryNamesTheRefusingProvider(t *testing.T) {
	for _, tc := range []struct{ message, want string }{
		{`{"role":"assistant","provider":"claude-bridge","stopReason":"error","errorMessage":"Failed to authenticate: OAuth session expired and could not be refreshed","content":[]}`, "claude-bridge"},
		{`{"role":"assistant","provider":"openai","stopReason":"error","errorMessage":"401 Incorrect API key provided","content":[]}`, "openai"},
		{`{"role":"assistant","provider":"claude-bridge","stopReason":"error","errorMessage":"529 overloaded","content":[]}`, ""},
		{`{"role":"assistant","provider":"synthetic","stopReason":"error","errorMessage":"401 Unauthorized","content":[]}`, ""},
		{`{"role":"assistant","provider":"claude-bridge","stopReason":"stop","content":[]}`, ""},
	} {
		if got := nativeBlocks(nativeEntry{ID: "e1", Type: "message", Message: []byte(tc.message)}).RefusedBy; got != tc.want {
			t.Errorf("%s: refused_by %q, want %q", tc.message, got, tc.want)
		}
	}
}
