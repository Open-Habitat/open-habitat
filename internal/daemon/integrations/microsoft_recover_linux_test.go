//go:build linux

package integrations

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func recoveryAccount(t *testing.T, narrow bool) (Env, *microsoft) {
	t.Helper()
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	original := m.client.Transport
	if !narrow {
		m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
			if r.URL.Path == "/v1.0/sites/"+testMicrosoftSite+"/drives" {
				return &http.Response{StatusCode: 404, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"error":{"code":"itemNotFound"}}`))}, nil
			}
			return original.RoundTrip(r)
		})
	}
	l := msLogin(t, m, env, "")
	address, err := l.Wait(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	// The pre-upgrade 404 left only OneDrive. Old releases did not record
	// which discovery implementation produced the inventory.
	m.client.Transport = original
	l.config = []byte(strings.ReplaceAll(string(l.config), microsoftDiscoveryFixed, ""))
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	selected := []string{"onedrive"}
	if narrow {
		roots, _ := microsoftRemotes(env, address)
		selected = []string{roots[1].Name}
	}
	if err := m.ChooseFolders(context.Background(), env, address, selected); err != nil {
		t.Fatal(err)
	}
	if narrow {
		original := m.client.Transport
		m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
			if r.URL.Path == "/v1.0/sites/"+testMicrosoftSite+"/drives" {
				return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"value":[{"id":"library-drive","name":"Documents","driveType":"documentLibrary"},{"id":"recovered-library","name":"Recovered","driveType":"documentLibrary"}]}`))}, nil
			}
			return original.RoundTrip(r)
		})
	}
	return env, m
}

func recoveryAttempt(c *Catalog) bool {
	c.relay.mu.Lock()
	defer c.relay.mu.Unlock()
	return c.relay.current() != nil
}

// stopRecovery stops the started catalog before the test returns, so nothing
// writes into the temporary home while it is removed.
func stopRecovery(c *Catalog, cancel context.CancelFunc) {
	cancel()
	c.Stop()
}

func TestMicrosoftStartupRecoversSkippedLibrariesWithoutWideningNarrowChoice(t *testing.T) {
	for _, narrow := range []bool{false, true} {
		t.Run(fmt.Sprint(narrow), func(t *testing.T) {
			env, m := recoveryAccount(t, narrow)
			c := New(env, []Entry{m}, nil, WithQuota(func() Room { return Room{OK: true, Free: 1 << 30} }), WithResumeTiming(time.Millisecond, time.Millisecond, 10*time.Millisecond))
			ctx, cancel := context.WithCancel(context.Background())
			c.Start(ctx)
			defer stopRecovery(c, cancel)
			deadline := time.Now().Add(5 * time.Second)
			// The rewritten inventory clears the need before the first passes
			// end; the attempt itself is over once the relay is free again.
			for microsoftRecoveryNeeded(env, "person@example.test") || recoveryAttempt(c) {
				if time.Now().After(deadline) {
					t.Fatal("startup did not recover")
				}
				time.Sleep(10 * time.Millisecond)
			}
			roots, err := microsoftRemotes(env, "person@example.test")
			want := 2
			if narrow {
				want = 3
			}
			if err != nil || len(roots) != want {
				t.Fatal(roots, err)
			}
			ready := 0
			for _, r := range roots {
				if microsoftReady(env, "person@example.test", r) {
					ready++
				}
			}
			if narrow && ready != 1 || !narrow && ready != 2 {
				t.Fatal("selection changed incorrectly", ready)
			}
			folders, err := m.Folders(ctx, env, "person@example.test")
			if err != nil || len(folders) != want {
				t.Fatal("not offered in existing folder UI", folders, err)
			}
			if narrow && folders[2].Suggested {
				t.Fatal("new library preselected for narrowed account")
			}
		})
	}
}

func TestMicrosoftRecoveryPublicationSurvivesFailureAndExplicitDeselection(t *testing.T) {
	env, m := recoveryAccount(t, false)
	fail := filepath.Join(env.Home, "resync-fail")
	if err := os.WriteFile(fail, nil, 0600); err != nil {
		t.Fatal(err)
	}
	if err := m.recoverLibraries(context.Background(), env, "person@example.test"); err == nil {
		t.Fatal("expected initial failure")
	}
	if !microsoftRecoveryNeeded(env, "person@example.test") {
		t.Fatal("lost pending choice")
	}
	if err := os.Remove(fail); err != nil {
		t.Fatal(err)
	}
	if err := m.ChooseFolders(context.Background(), env, "person@example.test", []string{"onedrive"}); err != nil {
		t.Fatal(err)
	}
	if microsoftRecoveryNeeded(env, "person@example.test") {
		t.Fatal("explicit deselection did not cancel recovery")
	}
	if err := m.recoverLibraries(context.Background(), env, "person@example.test"); err != nil {
		t.Fatal(err)
	}
	roots, _ := microsoftRemotes(env, "person@example.test")
	if microsoftReady(env, "person@example.test", roots[1]) {
		t.Fatal("deselected library synced")
	}
}

func TestMicrosoftRecoveryOutagePreservesConfigAndRetries(t *testing.T) {
	env, m := recoveryAccount(t, false)
	path := filepath.Join(env.Home, microsoftDir, "person@example.test.conf")
	before, _ := os.ReadFile(path)
	original := m.client.Transport
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 503, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{}`))}, nil
	})
	if err := m.recoverLibraries(context.Background(), env, "person@example.test"); err == nil {
		t.Fatal("outage accepted")
	}
	after, _ := os.ReadFile(path)
	if string(before) != string(after) {
		t.Fatal("outage rewrote inventory")
	}
	m.client.Transport = original
	if err := m.recoverLibraries(context.Background(), env, "person@example.test"); err != nil {
		t.Fatal(err)
	}
	if microsoftRecoveryNeeded(env, "person@example.test") {
		t.Fatal("retry not completed")
	}
	// A restart must not run the first pass again.
	before, _ = os.ReadFile(filepath.Join(env.Home, "resyncs"))
	if err := m.recoverLibraries(context.Background(), env, "person@example.test"); err != nil {
		t.Fatal(err)
	}
	after, _ = os.ReadFile(filepath.Join(env.Home, "resyncs"))
	if string(before) != string(after) {
		t.Fatal("repeated healthy first pass")
	}
}

// The legacy repair restores followed sites' libraries only. A grant that
// also lists teams never makes it discover or select the person's teams
// (syntheticMicrosoft fails the test on any Teams request).
func TestMicrosoftRecoveryNeverSelectsTeams(t *testing.T) {
	env, m := recoveryAccount(t, false)
	config := filepath.Join(env.Home, microsoftDir, "person@example.test.conf")
	data, err := os.ReadFile(config)
	if err != nil {
		t.Fatal(err)
	}
	data = []byte(strings.ReplaceAll(string(data), grantKey+" = ", grantKey+" = Team.ReadBasic.All Channel.ReadBasic.All "))
	if err := os.WriteFile(config, data, 0600); err != nil {
		t.Fatal(err)
	}
	c := New(env, []Entry{m}, nil, WithQuota(func() Room { return Room{OK: true, Free: 1 << 30} }), WithResumeTiming(time.Millisecond, time.Millisecond, 10*time.Millisecond))
	ctx, cancel := context.WithCancel(context.Background())
	c.Start(ctx)
	defer stopRecovery(c, cancel)
	deadline := time.Now().Add(5 * time.Second)
	for microsoftRecoveryNeeded(env, "person@example.test") || recoveryAttempt(c) {
		if time.Now().After(deadline) {
			t.Fatal("startup did not recover")
		}
		time.Sleep(10 * time.Millisecond)
	}
	if roots, err := microsoftRemotes(env, "person@example.test"); err != nil || len(roots) != 2 {
		t.Fatal(roots, err)
	}
}
