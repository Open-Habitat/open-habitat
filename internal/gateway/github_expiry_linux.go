//go:build linux

package gateway

import (
	"os"
	"path/filepath"
	"time"
)

// GitHubExpiryFile holds only an observation, never credentials or identities.
const GitHubExpiryFile = StateDir + "/github-token-expiry"

// recordGitHubExpiry serializes publication, not the network exchange or login.
// Unknown provider metadata must not clear a previously observed warning.
func (a *Auth) recordGitHubExpiry(expires time.Duration) {
	if a.githubExpiryFile == "" || expires < 0 {
		return
	}
	a.githubExpiryMu.Lock()
	defer a.githubExpiryMu.Unlock()
	value := "non-expiring\n"
	if expires > 0 {
		value = "expiring\n"
	}
	if err := writeGitHubExpiry(a.githubExpiryFile, value); err != nil {
		a.log.Warn("github_token_expiry_state", "outcome", "degraded", "reason", "state_write_failed")
	}
}

func writeGitHubExpiry(path, value string) error {
	dir := filepath.Dir(path)
	f, err := os.CreateTemp(dir, ".github-token-expiry-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err = f.WriteString(value); err == nil {
		err = f.Sync()
	}
	if closeErr := f.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}
	if err = os.Rename(f.Name(), path); err != nil {
		return err
	}
	return syncDir(dir)
}
