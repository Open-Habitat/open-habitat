//go:build linux

package daemon

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/transport"
)

type instructionsReplyBody struct {
	Exists  bool    `json:"exists"`
	Version *string `json:"version"`
	Content string  `json:"content"`
	Claude  string  `json:"claude"`
}

func instructionsClient(t *testing.T, home string) func(method, body string) (*httptest.ResponseRecorder, instructionsReplyBody) {
	t.Helper()
	handler := AgentInstructionsHandler(transport.Config{Home: home, Provider: "github", Subject: "42"}, func(*http.Request) bool { return true })
	return func(method, body string) (*httptest.ResponseRecorder, instructionsReplyBody) {
		r := httptest.NewRequest(method, "http://unix"+AgentInstructionsPath, strings.NewReader(body))
		if body != "" {
			r.Header.Set("Content-Type", "application/json")
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		var v instructionsReplyBody
		if w.Code == 200 {
			if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
				t.Fatal(err)
			}
		}
		return w, v
	}
}

func writeBody(t *testing.T, fields map[string]any) string {
	b, err := json.Marshal(fields)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

// A fresh home: reading creates nothing; the first save creates the
// instructions and Claude's import line, a second create is refused, and the
// replies match the contract.
func TestAgentInstructionsCreateOnlyWhileAbsent(t *testing.T) {
	home := t.TempDir()
	call := instructionsClient(t, home)
	w, v := call("GET", "")
	if w.Code != 200 || v.Exists || v.Version != nil || v.Claude != "none" {
		t.Fatal(w.Code, w.Body.String())
	}
	matchesSchema(t, "agent-instructions.schema.json", w.Body.String())
	if _, err := os.Stat(filepath.Join(home, ".pi")); !os.IsNotExist(err) {
		t.Fatal("read created a directory")
	}
	w, v = call("PUT", writeBody(t, map[string]any{"create": true, "content": "# Note\n\nAnswer briefly.\n"}))
	if w.Code != 200 || !v.Exists || v.Content != "# Note\n\nAnswer briefly.\n" || v.Version == nil || v.Claude != "imports" {
		t.Fatal(w.Code, w.Body.String())
	}
	matchesSchema(t, "agent-instructions.schema.json", w.Body.String())
	st, err := os.Stat(filepath.Join(home, ".pi/agent/AGENTS.md"))
	if err != nil || st.Mode().Perm() != 0600 {
		t.Fatal(st, err)
	}
	if b, _ := os.ReadFile(filepath.Join(home, ".claude/CLAUDE.md")); string(b) != "@~/.pi/agent/AGENTS.md\n" {
		t.Fatalf("claude file %q", b)
	}
	if w, _ = call("PUT", writeBody(t, map[string]any{"create": true, "content": "other"})); w.Code != 409 {
		t.Fatal("second create", w.Code)
	}
	if b, _ := os.ReadFile(filepath.Join(home, ".pi/agent/AGENTS.md")); string(b) != "# Note\n\nAnswer briefly.\n" {
		t.Fatal("refused create changed the file")
	}
	if entries, _ := os.ReadDir(filepath.Join(home, ".pi/agent")); len(entries) != 1 {
		t.Fatal("staged file left behind", entries)
	}
}

// Claude's own instructions are never changed, whether or not they already
// name the file; the reply says what Claude reads.
func TestAgentInstructionsLeaveClaudesFileAlone(t *testing.T) {
	for _, tc := range []struct{ claude, want string }{
		{"# My Claude rules\n\nUse uv.\n", "own"},
		{"Intro\n  @~/.pi/agent/AGENTS.md  \n", "imports"},
	} {
		home := t.TempDir()
		if err := os.MkdirAll(filepath.Join(home, ".claude"), 0700); err != nil {
			t.Fatal(err)
		}
		path := filepath.Join(home, ".claude/CLAUDE.md")
		if err := os.WriteFile(path, []byte(tc.claude), 0644); err != nil {
			t.Fatal(err)
		}
		before, _ := os.Stat(path)
		w, v := instructionsClient(t, home)("PUT", writeBody(t, map[string]any{"create": true, "content": "note"}))
		if w.Code != 200 || v.Claude != tc.want {
			t.Fatal(w.Code, w.Body.String())
		}
		after, _ := os.Stat(path)
		if b, _ := os.ReadFile(path); string(b) != tc.claude || !os.SameFile(before, after) || before.ModTime() != after.ModTime() {
			t.Fatal("claude file changed")
		}
	}
}

// Compare-and-swap: the version read is the only licence to replace. A
// stale version, or a change made by another writer (an agent in another
// conversation) after the read, is refused and leaves the file as it is.
func TestAgentInstructionsCompareAndSwap(t *testing.T) {
	home := t.TempDir()
	call := instructionsClient(t, home)
	_, created := call("PUT", writeBody(t, map[string]any{"create": true, "content": "one\n"}))
	path := filepath.Join(home, ".pi/agent/AGENTS.md")
	if err := os.Chmod(path, 0640); err != nil {
		t.Fatal(err)
	}
	_, read := call("GET", "")
	w, saved := call("PUT", writeBody(t, map[string]any{"base_version": *read.Version, "content": "two\n"}))
	if w.Code != 200 || saved.Content != "two\n" || *saved.Version == *read.Version {
		t.Fatal(w.Code, w.Body.String())
	}
	if st, _ := os.Stat(path); st.Mode().Perm() != 0640 {
		t.Fatal("mode not kept", st.Mode())
	}
	// The version before the save is stale now.
	if w, _ = call("PUT", writeBody(t, map[string]any{"base_version": *read.Version, "content": "three\n"})); w.Code != 409 {
		t.Fatal("stale base", w.Code)
	}
	_ = created
	// Another writer changes the file to the same length behind the page.
	if err := os.WriteFile(path, []byte("Two\n"), 0640); err != nil {
		t.Fatal(err)
	}
	if w, _ = call("PUT", writeBody(t, map[string]any{"base_version": *saved.Version, "content": "mine\n"})); w.Code != 409 {
		t.Fatal("changed meanwhile", w.Code)
	}
	if b, _ := os.ReadFile(path); string(b) != "Two\n" {
		t.Fatalf("refused save wrote %q", b)
	}
	// Deleted meanwhile: replacing is refused rather than creating.
	_, now := call("GET", "")
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if w, _ = call("PUT", writeBody(t, map[string]any{"base_version": *now.Version, "content": "x"})); w.Code != 409 {
		t.Fatal("deleted meanwhile", w.Code)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatal("replace created the file")
	}
}

// A link, a hard link or non-text is neither shown nor replaced, and nothing
// is written outside the home.
func TestAgentInstructionsRefuseWhatTheyCannotGiveBack(t *testing.T) {
	for _, kind := range []string{"symlink", "hardlink", "crlf", "nul", "dir-link"} {
		t.Run(kind, func(t *testing.T) {
			home, outside := t.TempDir(), t.TempDir()
			target := filepath.Join(outside, "target")
			if err := os.WriteFile(target, []byte("outside\n"), 0600); err != nil {
				t.Fatal(err)
			}
			if err := os.MkdirAll(filepath.Join(home, ".pi"), 0700); err != nil {
				t.Fatal(err)
			}
			path := filepath.Join(home, ".pi/agent/AGENTS.md")
			var err error
			switch kind {
			case "dir-link":
				err = os.Symlink(outside, filepath.Join(home, ".pi/agent"))
			default:
				if err = os.Mkdir(filepath.Join(home, ".pi/agent"), 0700); err != nil {
					break
				}
				switch kind {
				case "symlink":
					err = os.Symlink(target, path)
				case "hardlink":
					err = os.Link(target, path)
				case "crlf":
					err = os.WriteFile(path, []byte("a\r\nb\r\n"), 0600)
				case "nul":
					err = os.WriteFile(path, []byte("a\x00b"), 0600)
				}
			}
			if err != nil {
				t.Fatal(err)
			}
			call := instructionsClient(t, home)
			if w, _ := call("GET", ""); w.Code == 200 || strings.Contains(w.Body.String(), "outside") {
				t.Fatal("read", w.Code, w.Body.String())
			}
			for _, body := range []map[string]any{{"create": true, "content": "x"}, {"base_version": "sha256:v1:" + strings.Repeat("0", 64), "content": "x"}} {
				if w, _ := call("PUT", writeBody(t, body)); w.Code == 200 {
					t.Fatal("write accepted", body)
				}
			}
			if b, _ := os.ReadFile(target); string(b) != "outside\n" {
				t.Fatal("target changed")
			}
			if entries, _ := os.ReadDir(outside); len(entries) != 1 {
				t.Fatal("wrote outside the home", entries)
			}
		})
	}
}

func TestAgentInstructionsHTTPBoundary(t *testing.T) {
	home := t.TempDir()
	trusted := true
	handler := AgentInstructionsHandler(transport.Config{Home: home, Provider: "github", Subject: "42"}, func(*http.Request) bool { return trusted })
	call := func(method, suffix, body string) int {
		r := httptest.NewRequest(method, "http://unix"+AgentInstructionsPath+suffix, strings.NewReader(body))
		if body != "" {
			r.Header.Set("Content-Type", "application/json")
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w.Code
	}
	base := `"sha256:v1:` + strings.Repeat("0", 64) + `"`
	for _, tc := range []struct{ method, suffix, body string }{
		{"GET", "?path=/etc/passwd", ""},
		{"POST", "", `{"create":true,"content":"x"}`},
		{"PUT", "", `{"create":true,"content":"x","path":"/home/x/.bashrc"}`},
		{"PUT", "", `{"create":true,"base_version":` + base + `,"content":"x"}`},
		{"PUT", "", `{"create":false,"content":"x"}`},
		{"PUT", "", `{"content":"x"}`},
		{"PUT", "", `{"create":true}`},
		{"PUT", "", `{"create":true,"content":"a\r\nb"}`},
		{"PUT", "", `{"create":true,"content":"x","content":"y"}`},
		{"PUT", "", `{"create":true,"content":"x"} {}`},
		{"PUT", "", `{"base_version":"sha256:v1:short","content":"x"}`},
	} {
		if code := call(tc.method, tc.suffix, tc.body); code != 400 {
			t.Fatalf("%+v: %d", tc, code)
		}
	}
	if code := call("PUT", "", `{"create":true,"content":"`+strings.Repeat("a", instructionsLimit+1)+`"}`); code != 413 {
		t.Fatal("over the limit", code)
	}
	if _, err := os.Stat(filepath.Join(home, ".pi")); !os.IsNotExist(err) {
		t.Fatal("a refused request wrote")
	}
	trusted = false
	if code := call("GET", "", ""); code != 403 {
		t.Fatal("untrusted peer", code)
	}
}
