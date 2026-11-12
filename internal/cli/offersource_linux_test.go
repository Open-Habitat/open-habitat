//go:build linux

package cli

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/open-habitat/open-habitat/internal/daemon"
)

// offerSourceTree is root/{sub/a.pdf, sub/r.html, other/, link -> sub} with
// root named physically, so expectations do not depend on TMPDIR symlinks.
func offerSourceTree(t *testing.T) string {
	t.Helper()
	root, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, d := range []string{"sub", "other"} {
		if err := os.Mkdir(filepath.Join(root, d), 0o700); err != nil {
			t.Fatal(err)
		}
	}
	for _, f := range []string{"sub/a.pdf", "sub/r.html"} {
		if err := os.WriteFile(filepath.Join(root, f), []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Symlink("sub", filepath.Join(root, "link")); err != nil {
		t.Fatal(err)
	}
	return root
}

// capturedOffer runs an offer with an exchange that records the request
// body instead of reaching a daemon.
func capturedOffer(t *testing.T, run func([]string, func(string, string, []byte) (json.RawMessage, error)) (any, error), args []string) (map[string]any, error) {
	t.Helper()
	var sent map[string]any
	_, err := run(args, func(_, _ string, body []byte) (json.RawMessage, error) {
		if json.Unmarshal(body, &sent) != nil {
			t.Fatalf("request body: %s", body)
		}
		return nil, system("test_transport", "synthetic transport reached")
	})
	return sent, err
}

// A relative --source names a file below the CLI's own working directory, as
// in any shell command, and is sent to the daemon as an absolute path.
func TestOfferRelativeSourceUsesWorkingDirectory(t *testing.T) {
	root := offerSourceTree(t)
	t.Chdir(filepath.Join(root, "other"))
	// A logical $PWD through a symlink must not leak into the path: the
	// daemon refuses symlinks and ".." would mean another directory.
	t.Setenv("PWD", filepath.Join(root, "link", "..", "other"))
	key := "22222222-2222-4222-8222-222222222222"
	base := []string{"offer", "--conversation", "pi:11111111-1111-4111-8111-111111111111", "--workspace", "ws_example123", "--idempotency-key", key}
	for _, tc := range []struct{ source, want string }{
		{"../sub/a.pdf", root + "/sub/a.pdf"},
		{"./../sub//a.pdf", root + "/sub/a.pdf"},
		{"..", root},
		{".", root + "/other"},
		{root + "/sub/a.pdf", root + "/sub/a.pdf"},
	} {
		sent, err := capturedOffer(t, runAgentFileCommand, append(append([]string{}, base...), "--source", tc.source))
		var c *cliError
		if !errors.As(err, &c) || c.code != "test_transport" {
			t.Fatalf("%q: %v", tc.source, err)
		}
		if paths, _ := sent["paths"].([]any); len(paths) != 1 || paths[0] != tc.want {
			t.Fatalf("%q sent %v, want %s", tc.source, sent["paths"], tc.want)
		}
	}
	t.Chdir(filepath.Join(root, "sub"))
	sent, err := capturedOffer(t, runAgentViewCommand, append(append([]string{}, base...), "--source", "r.html"))
	if err == nil || sent["path"] != root+"/sub/r.html" {
		t.Fatalf("view offer sent %v: %v", sent["path"], err)
	}
	sent, err = capturedOffer(t, runAgentFileCommand, append(append([]string{}, base...), "--source", "a.pdf", "--source", "../other", "--title", "Paketti"))
	if paths, _ := sent["paths"].([]any); err == nil || len(paths) != 2 || paths[0] != root+"/sub/a.pdf" || paths[1] != root+"/other" {
		t.Fatalf("several sources sent %v: %v", sent["paths"], err)
	}
}

// A missing source is refused before the daemon with the absolute path that
// was looked for; a symlink before ".." is refused rather than skipped over
// lexically, and a symlink at the end is left for the daemon to refuse.
func TestOfferSourceRefusalsNameThePath(t *testing.T) {
	root := offerSourceTree(t)
	t.Chdir(filepath.Join(root, "other"))
	key := "22222222-2222-4222-8222-222222222222"
	base := []string{"offer", "--conversation", "pi:11111111-1111-4111-8111-111111111111", "--workspace", "ws_example123", "--idempotency-key", key}
	for _, tc := range []struct {
		run              func([]string, func(string, string, []byte) (json.RawMessage, error)) (any, error)
		source, code, in string
	}{
		{runAgentFileCommand, "a.pdf", "file_source_not_found", root + "/other/a.pdf"},
		{runAgentFileCommand, "../sub/a.pdf/x", "file_source_not_found", root + "/sub/a.pdf/x"},
		{runAgentFileCommand, root + "/nope", "file_source_not_found", root + "/nope"},
		{runAgentFileCommand, "missing/../a.pdf", "file_source_not_found", root + "/other/missing"},
		{runAgentFileCommand, "../link/../sub/a.pdf", "unsafe_file_source", root + "/link"},
		{runAgentViewCommand, "r.html", "view_source_not_found", root + "/other/r.html"},
	} {
		sent, err := capturedOffer(t, tc.run, append(append([]string{}, base...), "--source", tc.source))
		var c *cliError
		if !errors.As(err, &c) || c.code != tc.code || c.exit != 1 || !strings.Contains(c.message, tc.in) || sent != nil {
			t.Fatalf("%q: sent %v, %#v", tc.source, sent, err)
		}
	}
	sent, err := capturedOffer(t, runAgentFileCommand, append(append([]string{}, base...), "--source", "../link"))
	if paths, _ := sent["paths"].([]any); err == nil || len(paths) != 1 || paths[0] != root+"/link" {
		t.Fatalf("final symlink not left to the daemon: %v %v", sent, err)
	}
}

// When the daemon still finds no source (it vanished after the CLI looked),
// the refusal names the absolute paths that were sent.
func TestOfferDaemonNotFoundNamesSentPaths(t *testing.T) {
	root := offerSourceTree(t)
	t.Chdir(root)
	args := []string{"offer", "--conversation", "pi:11111111-1111-4111-8111-111111111111", "--workspace", "ws_example123", "--idempotency-key", "22222222-2222-4222-8222-222222222222", "--source", "sub/a.pdf"}
	_, err := runAgentFileCommand(args, func(string, string, []byte) (json.RawMessage, error) {
		return nil, agentResponseError("POST", daemon.AgentFileOffersPath, 404, "file_source_not_found")
	})
	var c *cliError
	if !errors.As(err, &c) || c.code != "file_source_not_found" || !strings.Contains(c.message, root+"/sub/a.pdf") {
		t.Fatalf("daemon not-found: %#v", err)
	}
}
