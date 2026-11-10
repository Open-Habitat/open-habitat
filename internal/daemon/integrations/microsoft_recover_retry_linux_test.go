//go:build linux

package integrations

import (
	"context"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestMicrosoftRecoveryTerminatesPermanentFailures(t *testing.T) {
	for _, tc := range []struct {
		name, path string
		status     int
		done       bool
	}{
		{"deleted-site", "/v1.0/sites/" + testMicrosoftSite + "/drives", 404, true},
		{"revoked-grant", "/v1.0/me/drive", 401, true},
		{"outage", "/v1.0/me/drive", 503, false},
		{"rate-limit", "/v1.0/me/drive", 429, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			env, m := recoveryAccount(t, false)
			original := m.client.Transport
			m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
				if r.URL.Path == tc.path {
					return &http.Response{StatusCode: tc.status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{}`))}, nil
				}
				return original.RoundTrip(r)
			})
			c := New(env, []Entry{m}, nil, WithQuota(func() Room { return Room{OK: true, Free: 1 << 30} }))
			defer c.sync.stopAll()
			if got := c.tryRecoverMicrosoft(context.Background(), m, "person@example.test"); got != tc.done {
				t.Fatalf("terminal=%v want %v", got, tc.done)
			}
			if tc.name == "deleted-site" && microsoftRecoveryNeeded(env, "person@example.test") {
				t.Fatal("genuine 404 kept scheduling disruptive repair")
			}
			roots, err := microsoftRemotes(env, "person@example.test")
			if err != nil || len(roots) != 1 || !microsoftReady(env, "person@example.test", roots[0]) {
				t.Fatal("existing selection lost", roots, err)
			}
		})
	}
}

func TestMicrosoftRecoveryHandlesStoppedNativeLocks(t *testing.T) {
	for _, expired := range []bool{false, true} {
		env, m := recoveryAccount(t, false)
		work := filepath.Join(env.Home, microsoftWork("person@example.test", "onedrive"))
		expires := time.Now().Add(time.Hour)
		if expired {
			expires = time.Now().Add(-time.Hour)
		}
		if err := os.WriteFile(filepath.Join(work, "pair.lck"), []byte(lockAt(work, 0, expires)), 0600); err != nil {
			t.Fatal(err)
		}
		c := New(env, []Entry{m}, nil, WithQuota(func() Room { return Room{OK: true, Free: 1 << 30} }))
		if !c.tryRecoverMicrosoft(context.Background(), m, "person@example.test") {
			t.Fatal("dead native lock blocked recovery")
		}
		c.sync.stopAll()
		if microsoftRecoveryNeeded(env, "person@example.test") {
			t.Fatal("dead lock prevented library repair")
		}
	}
}

func TestMicrosoftRecoveryYieldsToLoginAndQuota(t *testing.T) {
	env, m := recoveryAccount(t, false)
	full := false
	c := New(env, []Entry{m}, nil, WithQuota(func() Room { return Room{Full: full, OK: true, Free: 1 << 30} }))
	defer c.sync.stopAll()
	busy := &attempt{provider: Microsoft, state: "device_code", done: make(chan struct{})}
	c.relay.put(busy)
	if c.tryRecoverMicrosoft(context.Background(), m, "person@example.test") {
		t.Fatal("busy login not deferred")
	}
	if c.relay.current() != busy {
		t.Fatal("replaced live login")
	}
	c.relay.attempts = nil
	full = true
	if c.tryRecoverMicrosoft(context.Background(), m, "person@example.test") {
		t.Fatal("full quota not deferred")
	}
	roots, _ := microsoftRemotes(env, "person@example.test")
	if len(roots) != 1 {
		t.Fatal("mutated despite exclusion")
	}
}
