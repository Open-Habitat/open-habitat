//go:build linux

package host

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/unix"
)

func TestGitHubExpiryWarnings(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "github-token-expiry")
	owner := uint32(os.Geteuid())
	if w := githubExpiryWarnings(path, owner); len(w) != 0 {
		t.Fatal(w)
	}
	for _, tc := range []struct{ value, code string }{
		{"expiring\n", "github_token_expiring"},
		{"non-expiring\n", ""},
		{"gho_synthetic_secret", "github_token_expiry_unavailable"},
		{strings.Repeat("x", 10000), "github_token_expiry_unavailable"},
	} {
		if err := os.WriteFile(path, []byte(tc.value), 0600); err != nil {
			t.Fatal(err)
		}
		w := githubExpiryWarnings(path, owner)
		if tc.code == "" {
			if len(w) != 0 {
				t.Fatal(w)
			}
			continue
		}
		if len(w) != 1 || w[0].Code != tc.code || strings.Contains(w[0].Message+w[0].FixSuggestion, "synthetic_secret") {
			t.Fatal(w)
		}
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("missing", path); err != nil {
		t.Fatal(err)
	}
	if w := githubExpiryWarnings(path, owner); len(w) != 1 || w[0].Code != "github_token_expiry_unavailable" {
		t.Fatal(w)
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := unix.Mkfifo(path, 0600); err != nil {
		t.Fatal(err)
	}
	if w := githubExpiryWarnings(path, owner); len(w) != 1 || w[0].Code != "github_token_expiry_unavailable" {
		t.Fatal(w)
	}
}
