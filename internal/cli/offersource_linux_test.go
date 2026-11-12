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
	t.Setenv("PWD", root+"/link/../other")
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

// The CLI refuses what the kernel would refuse while walking the path: a
// ".." through a missing directory, a file or a symlink, and a trailing "/"
// on a file. Each refusal names the absolute path and nothing is sent.
func TestOfferSourceRefusalsNameThePath(t *testing.T) {
	root := offerSourceTree(t)
	t.Chdir(filepath.Join(root, "other"))
	key := "22222222-2222-4222-8222-222222222222"
	base := []string{"offer", "--conversation", "pi:11111111-1111-4111-8111-111111111111", "--workspace", "ws_example123", "--idempotency-key", key}
	for _, tc := range []struct {
		run              func([]string, func(string, string, []byte) (json.RawMessage, error)) (any, error)
		source, code, in string
	}{
		{runAgentFileCommand, "missing/../a.pdf", "file_source_not_found", root + "/other/missing"},
		{runAgentFileCommand, "../sub/a.pdf/../r.html", "file_source_not_found", root + "/sub/a.pdf/"},
		{runAgentFileCommand, "../sub/a.pdf/", "file_source_not_found", root + "/sub/a.pdf/"},
		{runAgentFileCommand, "../sub/a.pdf/.", "file_source_not_found", root + "/sub/a.pdf/"},
		{runAgentFileCommand, "../link/../sub/a.pdf", "unsafe_file_source", root + "/link"},
		{runAgentViewCommand, "../sub/r.html/../r.html", "view_source_not_found", root + "/sub/r.html/"},
	} {
		sent, err := capturedOffer(t, tc.run, append(append([]string{}, base...), "--source", tc.source))
		var c *cliError
		if !errors.As(err, &c) || c.code != tc.code || c.exit != 1 || !strings.Contains(c.message, tc.in) || sent != nil {
			t.Fatalf("%q: sent %v, %#v", tc.source, sent, err)
		}
	}
	// A final symlink is the daemon's to refuse, and a missing source
	// reaches the daemon too: a replay with the same key must succeed after
	// the source is gone.
	for _, source := range []string{"../link", "gone.pdf", root + "/gone.pdf"} {
		sent, err := capturedOffer(t, runAgentFileCommand, append(append([]string{}, base...), "--source", source))
		if paths, _ := sent["paths"].([]any); err == nil || len(paths) != 1 || !strings.HasPrefix(paths[0].(string), root+"/") {
			t.Fatalf("%q not left to the daemon: %v %v", source, sent, err)
		}
	}
}

// When the daemon finds no source, the refusal names the absolute paths the
// CLI sent, so the agent sees what a relative path was taken to mean.
func TestOfferDaemonNotFoundNamesSentPaths(t *testing.T) {
	root := offerSourceTree(t)
	t.Chdir(filepath.Join(root, "other"))
	base := []string{"offer", "--conversation", "pi:11111111-1111-4111-8111-111111111111", "--workspace", "ws_example123", "--idempotency-key", "22222222-2222-4222-8222-222222222222"}
	for _, tc := range []struct {
		run                func([]string, func(string, string, []byte) (json.RawMessage, error)) (any, error)
		path, source, code string
	}{
		{runAgentFileCommand, daemon.AgentFileOffersPath, "a.pdf", "file_source_not_found"},
		{runAgentViewCommand, daemon.AgentViewsPath, "r.html", "view_source_not_found"},
	} {
		_, err := tc.run(append(append([]string{}, base...), "--source", tc.source), func(string, string, []byte) (json.RawMessage, error) {
			return nil, agentResponseError("POST", tc.path, 404, tc.code)
		})
		var c *cliError
		if !errors.As(err, &c) || c.code != tc.code || c.exit != 1 || !strings.Contains(c.message, root+"/other/"+tc.source) || !strings.Contains(c.message, "current working directory") {
			t.Fatalf("daemon %s: %#v", tc.code, err)
		}
	}
}
