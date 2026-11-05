//go:build linux

package host

import (
	"errors"
	"os"
	"path/filepath"

	"github.com/Open-Habitat/open-habitat/internal/gateway"
	"golang.org/x/sys/unix"
)

type Warning struct {
	Code          string `json:"code"`
	Message       string `json:"message"`
	FixSuggestion string `json:"fix_suggestion"`
}

// This observation is deliberately outside readiness and plan fingerprints:
// changing the OAuth app fixes future tokens, not installation qualification.
func githubExpiryWarnings(path string, owner uint32) []Warning {
	state, err := readGitHubExpiry(path, owner)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	} // no observed grant yet
	if err != nil {
		return []Warning{{"github_token_expiry_unavailable", "The gateway's latest GitHub token expiry observation could not be read.", "Check gateway state directory ownership, permissions and disk space, and the gateway journal; sign in again after repairing state writes."}}
	}
	if state == "non-expiring\n" {
		return nil
	}
	return []Warning{{"github_token_expiring", "The gateway last observed an expiring GitHub token; gh cannot refresh it.", "GitHub Settings > Developer settings > OAuth Apps > Optional features: opt out of expiring user tokens. Reconnect after the existing token expires; an ordinary sign-in while it still works keeps the old token. A later non-expiring sign-in clears this warning."}}
}

func readGitHubExpiry(path string, owner uint32) (string, error) {
	// The installed parent is root-managed, gateway-owned private state. Never
	// follow a leaf symlink or block on a FIFO while inspecting as root.
	dir, err := unix.Open(filepath.Dir(path), unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return "", err
	}
	defer unix.Close(dir)
	var st unix.Stat_t
	if unix.Fstat(dir, &st) != nil || st.Uid != owner || st.Mode&0077 != 0 {
		return "", ErrTrust
	}
	b, err := readPrivateAtLimit(dir, filepath.Base(path), owner, 64)
	if err != nil {
		return "", err
	}
	if string(b) != "expiring\n" && string(b) != "non-expiring\n" {
		return "", ErrTrust
	}
	return string(b), nil
}

func inspectGitHubExpiry(r *Inspection) {
	r.Warnings = githubExpiryWarnings(gateway.GitHubExpiryFile, r.gatewayUID)
}
