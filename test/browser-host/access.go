package main

import (
	"context"
	"errors"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/gateway"
)

// The synthetic host's admission (ADR 0030): Alice (42) is site.json's
// operator entry and the administrator, Bob (43) a runtime entry who has
// joined. /fixture/access switches the installation's mode and root's
// runtime switch, delays the broker's writes so the browser's waiting state
// can be seen, loses the next write's reply after committing it, or
// (unbound=43) makes Bob a person who has not signed in yet: his binding
// appears at his first sign-in.
type fixtureAccess struct {
	mu      sync.Mutex
	any     bool
	off     bool
	delay   time.Duration
	lose    bool
	runtime map[string]string // id -> "admitted" or "withdrawn"
	hints   map[string]string
	at      map[string]string
	unbound map[string]bool
}

func newFixtureAccess() *fixtureAccess {
	return &fixtureAccess{runtime: map[string]string{"43": "admitted"}, hints: map[string]string{"43": "bob"}, at: map[string]string{"43": "2026-10-20T08:00:00Z"}, unbound: map[string]bool{}}
}

// fixture applies /fixture/access query values; unknown values are refused.
func (b *fixtureBroker) fixture(q url.Values) error {
	b.access.mu.Lock()
	defer b.access.mu.Unlock()
	for key, values := range q {
		v := values[0]
		switch {
		case key == "mode" && (v == "any" || v == "allowlist"):
			b.access.any = v == "any"
		case key == "runtime" && (v == "on" || v == "off"):
			b.access.off = v == "off"
		case key == "delay":
			ms, err := strconv.Atoi(v)
			if err != nil || ms < 0 || ms > 5000 {
				return errors.New("bad delay")
			}
			b.access.delay = time.Duration(ms) * time.Millisecond
		case key == "lose" && v == "1":
			b.access.lose = true
		case key == "unbound" && v == "43":
			b.access.unbound[v] = true
		default:
			return errors.New("unknown access fixture")
		}
	}
	return nil
}

// bound is called under access.mu.
func (b *fixtureBroker) bound(id string) (string, bool) {
	if b.access.unbound[id] {
		return "", false
	}
	for _, m := range b.identities {
		if m.Subject == id {
			return m.Username, true
		}
	}
	return "", false
}

// rowLocked is one id's admission as the broker would list it.
func (b *fixtureBroker) rowLocked(id string) []gateway.AccessRow {
	username, bound := b.bound(id)
	state := "allowed"
	if bound {
		state = "joined"
	}
	if id == "42" {
		return []gateway.AccessRow{{ID: id, Source: "operator", State: state, Username: username}}
	}
	switch b.access.runtime[id] {
	case "":
		return nil
	case "withdrawn":
		state = "withdrawn"
	}
	return []gateway.AccessRow{{ID: id, Source: "site_admin", State: state, Username: username, LoginHint: b.access.hints[id], Actor: "42", At: b.access.at[id]}}
}

func (b *fixtureBroker) pageLocked(ids []string) gateway.AccessPage {
	mode := "allowlist"
	if b.access.any {
		mode = "any"
	}
	page := gateway.AccessPage{Mode: mode, RuntimeAdmission: !b.access.off, Rows: []gateway.AccessRow{}}
	for _, id := range ids {
		page.Rows = append(page.Rows, b.rowLocked(id)...)
	}
	return page
}

func (b *fixtureBroker) AccessList(context.Context) (gateway.AccessPage, error) {
	b.access.mu.Lock()
	defer b.access.mu.Unlock()
	ids := []string{"42"}
	for id := range b.access.runtime {
		ids = append(ids, id)
	}
	return b.pageLocked(ids), nil
}

func (b *fixtureBroker) AccessRead(_ context.Context, id string) (gateway.AccessPage, error) {
	b.access.mu.Lock()
	defer b.access.mu.Unlock()
	return b.pageLocked([]string{id}), nil
}

// write waits out the fixture delay, then reports whether this write's reply
// is lost after it commits.
func (b *fixtureBroker) write(ctx context.Context) (bool, error) {
	b.access.mu.Lock()
	delay := b.access.delay
	b.access.mu.Unlock()
	select {
	case <-time.After(delay):
	case <-ctx.Done():
		return false, gateway.ErrAccessUncertain
	}
	b.access.mu.Lock()
	lose := b.access.lose
	b.access.lose = false
	b.access.mu.Unlock()
	return lose, nil
}

func (b *fixtureBroker) Admit(ctx context.Context, id, hint, _ string) (gateway.AccessRow, error) {
	lose, err := b.write(ctx)
	if err != nil {
		return gateway.AccessRow{}, err
	}
	b.access.mu.Lock()
	defer b.access.mu.Unlock()
	switch {
	case b.access.any:
		return gateway.AccessRow{}, gateway.ErrAccessOpen
	case id == "42":
		return gateway.AccessRow{}, gateway.ErrOperatorOwned
	case b.access.off && b.access.runtime[id] != "admitted":
		return gateway.AccessRow{}, gateway.ErrAccessDisabled
	}
	b.access.runtime[id] = "admitted"
	b.access.hints[id] = hint
	b.access.at[id] = time.Now().UTC().Format(time.RFC3339)
	if lose {
		return gateway.AccessRow{}, gateway.ErrAccessUncertain
	}
	return b.rowLocked(id)[0], nil
}

func (b *fixtureBroker) Withdraw(ctx context.Context, id, _ string) (gateway.AccessRow, error) {
	lose, err := b.write(ctx)
	if err != nil {
		return gateway.AccessRow{}, err
	}
	b.access.mu.Lock()
	defer b.access.mu.Unlock()
	switch {
	case b.access.any:
		return gateway.AccessRow{}, gateway.ErrAccessOpen
	case id == "42":
		return gateway.AccessRow{}, gateway.ErrOperatorOwned
	}
	row := gateway.AccessRow{ID: id, Source: "site_admin", State: "removed"}
	if _, bound := b.bound(id); bound && b.access.runtime[id] != "" {
		b.access.runtime[id] = "withdrawn"
		b.access.at[id] = time.Now().UTC().Format(time.RFC3339)
		row = b.rowLocked(id)[0]
	} else {
		delete(b.access.runtime, id)
	}
	if lose {
		return gateway.AccessRow{}, gateway.ErrAccessUncertain
	}
	return row, nil
}

// admitted is what the real broker's authorize would answer.
func (b *fixtureBroker) admitted(id string) bool {
	b.access.mu.Lock()
	defer b.access.mu.Unlock()
	return b.access.any || id == "42" || b.access.runtime[id] == "admitted"
}

// The synthetic GitHub users API: two people with accounts here, one who has
// none yet, and an organisation. Logins match case-insensitively, as GitHub's.
var fixtureGitHub = []gateway.GitHubUser{
	{ID: "42", Login: "alice", Name: "Alice Example", Type: "User"},
	{ID: "43", Login: "bob", Name: "Bob Example", Type: "User"},
	{ID: "44", Login: "carol", Name: "Carol Example", Type: "User"},
	{ID: "61230001", Login: "example-org", Name: "Example Org", Type: "Organization"},
}

func (p *provider) LookupLogin(_ context.Context, login string) (gateway.GitHubUser, error) {
	for _, u := range fixtureGitHub {
		if strings.EqualFold(u.Login, login) {
			if u.Type != "User" {
				return gateway.GitHubUser{}, gateway.ErrGitHubNotUser
			}
			return u, nil
		}
	}
	return gateway.GitHubUser{}, gateway.ErrGitHubUserNotFound
}

func (p *provider) LookupID(_ context.Context, id string) (gateway.GitHubUser, error) {
	for _, u := range fixtureGitHub {
		if u.ID == id {
			return u, nil
		}
	}
	return gateway.GitHubUser{}, gateway.ErrGitHubUserNotFound
}
