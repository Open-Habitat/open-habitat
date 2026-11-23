//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"testing"
)

// removalEntry is a catalog entry whose accounts and revocation a test sets.
type removalEntry struct {
	mu        sync.Mutex
	provider  Provider
	accounts  []string
	revoke    func(string) error
	removed   []string
	revoked   []string
	removeErr error
}

func (e *removalEntry) Provider() Provider                           { return e.provider }
func (e *removalEntry) Login() LoginKind                             { return AppPassword }
func (e *removalEntry) Services() []string                           { return []string{"mail"} }
func (e *removalEntry) Available(Env) bool                           { return true }
func (e *removalEntry) Skill(Env, string) SkillAccount               { return SkillAccount{} }
func (e *removalEntry) Check(context.Context, Env, string) []Service { return nil }
func (e *removalEntry) Accounts(Env) ([]string, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	return append([]string{}, e.accounts...), nil
}
func (e *removalEntry) Remove(_ context.Context, _ Env, address string) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.removeErr != nil {
		return e.removeErr
	}
	e.removed = append(e.removed, address)
	kept := e.accounts[:0]
	for _, a := range e.accounts {
		if a != address {
			kept = append(kept, a)
		}
	}
	e.accounts = kept
	return nil
}

type revokingEntry struct{ *removalEntry }

func (e revokingEntry) RevokeGrant(_ context.Context, _ Env, address string) error {
	e.mu.Lock()
	e.revoked = append(e.revoked, address)
	e.mu.Unlock()
	return e.revoke(address)
}

// Every account is disconnected as the person: revoked where the provider
// allows it, removed locally everywhere, a failed revocation still removed
// and counted failed. The reply names no account, and a repeat is empty.
func TestDisconnectAllCountsWithoutNames(t *testing.T) {
	google := &removalEntry{provider: Google, accounts: []string{"a@example.test", "b@example.test"}, revoke: func(a string) error {
		if a == "b@example.test" {
			return errors.New("provider down")
		}
		return nil
	}}
	imap := &removalEntry{provider: IMAP, accounts: []string{"c@example.test"}}
	c := testCatalog(t, newHome(t), []Entry{revokingEntry{google}, imap})
	got := c.DisconnectAll(context.Background())
	want := []DisconnectCount{{Provider: "google", Revoked: 1, Failed: 1}, {Provider: "imap", LocalOnly: 1}}
	b, _ := json.Marshal(got)
	if string(b) != mustJSON(want) {
		t.Fatalf("counts %s", b)
	}
	if strings.Contains(string(b), "example.test") {
		t.Fatal("reply names an account")
	}
	if len(google.removed) != 2 || len(imap.removed) != 1 || len(google.revoked) != 2 {
		t.Fatal("not every account removed", google.removed, imap.removed)
	}
	if again := c.DisconnectAll(context.Background()); len(again) != 0 {
		t.Fatal("repeat found something", again)
	}
}

func mustJSON(v any) string { b, _ := json.Marshal(v); return string(b) }
