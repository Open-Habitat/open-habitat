//go:build linux

package integrations

import (
	"context"
	"strings"
	"testing"

	"golang.org/x/sys/unix"
)

// The folder step an earlier release offered at every Microsoft sign-in,
// kept for the tests: accounts it left syncing still exist, and these
// helpers give a test account the same roots and native state.

// microsoftFolders lists the account's roots as that step offered them.
func (m *microsoft) testFolders(ctx context.Context, env Env, address string) ([]Folder, error) {
	m.native.Lock()
	defer m.native.Unlock()
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		return nil, err
	}
	var out []Folder
	anyReady := false
	for _, r := range remotes {
		anyReady = anyReady || microsoftReady(env, address, r)
	}
	for _, r := range remotes {
		label := r.Label
		if label == "" && r.Name == "onedrive" {
			label = "OneDrive"
		} else if label == "" {
			// Written before roots carried the person's names for them.
			label = "SharePoint · " + strings.TrimPrefix(r.Directory, "cloud/sharepoint/")
		}
		out = append(out, Folder{ID: r.Name, Name: label, UnknownSize: true, Suggested: microsoftReady(env, address, r) || (!anyReady && r.Name == "onedrive")})
	}
	return out, nil
}

// testChoose applies a choice as that step did: a first pass for each chosen
// root, and the pairs of the others stopped without deleting any file.
func (m *microsoft) testChoose(ctx context.Context, env Env, address string, ids []string) error {
	m.native.Lock()
	defer m.native.Unlock()
	if len(ids) == 0 {
		return ToolFailed
	}
	remotes, err := microsoftRemotes(env, address)
	if err != nil {
		return err
	}
	selected := map[string]bool{}
	for _, id := range ids {
		if selected[id] {
			return ToolFailed
		}
		found := false
		for _, r := range remotes {
			found = found || id == r.Name
		}
		if !found {
			return ToolFailed
		}
		selected[id] = true
	}
	// An explicit choice supersedes every automatic recovery selection, even
	// if a later first pass fails. Never re-add a library the person removed.
	fd, err := openHomeDir(env.Home, false, splitPath(microsoftDir)...)
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	data, err := readFileAt(fd, address+".conf", maxMicrosoftConfigRead)
	if err != nil {
		return err
	}
	var lines []string
	for _, line := range strings.Split(string(data), "\n") {
		key, _, _ := strings.Cut(line, "=")
		if strings.TrimSpace(key) != microsoftRecoverySelected {
			lines = append(lines, line)
		}
	}
	if err := writeFileAt(fd, address+".conf", []byte(strings.Join(lines, "\n")), 0600); err != nil {
		return err
	}
	for _, r := range remotes {
		if !selected[r.Name] || microsoftReady(env, address, r) {
			// Choosing more libraries never resyncs a healthy existing pair.
			continue
		}
		if err := microsoftInitialPass(ctx, env, address, r); err != nil {
			return err
		}
	}
	// Native listings are the selection. Stop deselected pairs without
	// deleting local files or approving any cloud-side deletion.
	for _, r := range remotes {
		if !selected[r.Name] {
			if err := microsoftRemoveFiles(env, microsoftWork(address, r.Name)); err != nil {
				return err
			}
		}
	}
	return nil
}

// earlierRoots gives a connected account the roots an earlier release's
// sign-in discovered (the synthetic tenant's OneDrive and followed library),
// under the level's application and the given grant, none synced yet.
func earlierRoots(t *testing.T, m *microsoft, env Env, address string, level Level, scopes string) {
	t.Helper()
	app, ok := env.microsoftApps()[level]
	if !ok {
		t.Fatal("no application for the level")
	}
	granted := strings.Fields(scopes)
	l := &microsoftLogin{entry: m, env: env, app: app, address: address, token: []byte(`{"access_token":"access-secret","refresh_token":"refresh-secret","token_type":"Bearer","expiry":"2099-01-01T00:00:00Z"}`), granted: granted}
	if err := l.discover(context.Background(), "access-secret", microsoftGranted(granted)); err != nil {
		t.Fatal(err)
	}
	writeConfig(t, env, address, l.config)
}

// earlierFullGrant is the grant the synthetic tenant's token names.
const earlierFullGrant = "User.Read Files.ReadWrite.All Sites.ReadWrite.All"
