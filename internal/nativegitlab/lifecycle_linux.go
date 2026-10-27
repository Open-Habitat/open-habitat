//go:build linux

package nativegitlab

import (
	"context"
	"strings"

	"github.com/Open-Habitat/open-habitat/internal/nativeforge"
)

// Verifier reads what a token is for and proves it can list projects;
// Client.Verify is the production one.
type Verifier interface {
	Verify(ctx context.Context, b Base, token string) (Account, TokenInfo, error)
}

// Connect validates a token against base (Client.Verify) and writes glab's
// host entry for that server: what `glab auth login --stdin --hostname
// <host> --api-protocol https --git-protocol https` would write, with the
// token in the file (use_keyring "false"), never the keyring. glab keeps one
// account per server, so a server glab already holds any credential for is
// refused (ErrExists), whichever account; so is a token glab holds for
// another server. glab's own blank entry for the server, or one left by a
// logout, is filled in place with its other settings kept, unless they would
// make the entry one the adapter cannot use (ErrUnsupported). Nothing else
// in the file changes.
func (s *Store) Connect(ctx context.Context, v Verifier, b Base, token string) (Login, TokenInfo, Outcome, error) {
	if !b.Valid() {
		return Login{}, TokenInfo{}, "", ErrInvalidAddress
	}
	if !nativeforge.ValidToken(token) {
		return Login{}, TokenInfo{}, "", ErrInvalidToken
	}
	account, info, err := v.Verify(ctx, b, token)
	if err != nil {
		return Login{}, TokenInfo{}, "", err
	}
	if ctx.Err() != nil {
		return Login{}, TokenInfo{}, "", ErrUnreachable
	}
	ss, err := s.open(true)
	if err != nil {
		return Login{}, TokenInfo{}, "", err
	}
	defer ss.close()
	doc := ss.doc
	key := b.Authority()
	var blank *entry
	for i := range doc.entries {
		e := &doc.entries[i]
		if !e.Base.Valid() || !e.Base.SameServer(b) {
			continue
		}
		switch {
		case e.Ambiguous:
			return Login{}, TokenInfo{}, "", ErrAmbiguous
		case e.signedIn && e.Usable() && e.Base == b && strings.EqualFold(e.User, account.Username) && e.token == token:
			// The lost reply of this very connect.
			return e.Login, info, nativeforge.Unchanged, nil
		case e.signedIn:
			return Login{}, TokenInfo{}, "", ErrExists
		case e.Key == key:
			blank = e
		default:
			// glab's key for this server is spelled otherwise; two keys for
			// one server would read two ways.
			return Login{}, TokenInfo{}, "", ErrExists
		}
	}
	if doc.tokenUsed(token, nil) {
		return Login{}, TokenInfo{}, "", ErrExists
	}
	if blank != nil {
		if p, _ := subfolder(blank.fields["subfolder"]); p != b.Path {
			// The blank entry names another base path on this server.
			return Login{}, TokenInfo{}, "", ErrExists
		}
	}
	m := doc.hostEntry(key)
	set(m, "use_keyring", "false")
	set(m, "token", token)
	set(m, "api_host", key)
	if b.Path != "" {
		set(m, "subfolder", strings.TrimPrefix(b.Path, "/"))
	}
	if blank == nil || blank.fields["api_protocol"] == "" {
		set(m, "api_protocol", "https")
	}
	if blank == nil || blank.fields["git_protocol"] == "" {
		set(m, "git_protocol", "https")
	}
	set(m, "user", account.Username)
	data, err := doc.encode()
	if err != nil {
		return Login{}, TokenInfo{}, "", ErrWriteFailed
	}
	// What glab will read back must be exactly the usable entry intended;
	// a blank entry's own settings could make it otherwise.
	check, err := parseDocument(data)
	if err != nil {
		nativeforge.Wipe(data)
		return Login{}, TokenInfo{}, "", ErrWriteFailed
	}
	written, err := check.byKey(key)
	if err != nil || !written.Usable() || written.Base != b || written.token != token || !strings.EqualFold(written.User, account.Username) {
		nativeforge.Wipe(data)
		return Login{}, TokenInfo{}, "", ErrUnsupported
	}
	if err := s.commit(ss, data); err != nil {
		return Login{}, TokenInfo{}, "", err
	}
	return written.Login, info, nativeforge.Written, nil
}

// Replace swaps the token of the targeted entry after validating that the
// new token authenticates the same GitLab user and can list projects. A
// refusal at any point leaves the previous bytes intact. Only the token
// scalar changes.
func (s *Store) Replace(ctx context.Context, v Verifier, t Target, token string) (Login, TokenInfo, Outcome, error) {
	if !t.Base.Valid() || t.Key == "" {
		return Login{}, TokenInfo{}, "", ErrNotFound
	}
	if !nativeforge.ValidToken(token) {
		return Login{}, TokenInfo{}, "", ErrInvalidToken
	}
	account, info, err := v.Verify(ctx, t.Base, token)
	if err != nil {
		return Login{}, TokenInfo{}, "", err
	}
	if ctx.Err() != nil {
		return Login{}, TokenInfo{}, "", ErrUnreachable
	}
	ss, err := s.open(true)
	if err != nil {
		return Login{}, TokenInfo{}, "", err
	}
	defer ss.close()
	e, err := usableEntry(ss.doc, t)
	if err != nil {
		return Login{}, TokenInfo{}, "", err
	}
	if !strings.EqualFold(account.Username, e.User) {
		return Login{}, TokenInfo{}, "", ErrAccountMismatch
	}
	if e.token == token {
		return e.Login, info, nativeforge.Unchanged, nil
	}
	if ss.doc.tokenUsed(token, e) {
		return Login{}, TokenInfo{}, "", ErrExists
	}
	set(e.node, "token", token)
	data, err := ss.doc.encode()
	if err != nil {
		return Login{}, TokenInfo{}, "", ErrWriteFailed
	}
	if err := s.commit(ss, data); err != nil {
		return Login{}, TokenInfo{}, "", err
	}
	return e.Login, info, nativeforge.Written, nil
}

// Remove logs the targeted entry out the way `glab auth logout` does: its
// token and use_keyring go, every other setting of the host stays. It
// revokes nothing at GitLab and touches no clone. It is refused while the
// daemon holds the login for an active job; a process that already received
// the token may still finish.
func (s *Store) Remove(t Target) (Outcome, error) {
	end, err := s.holds.Removing(t.Key)
	if err != nil {
		return "", err
	}
	defer end()
	ss, err := s.open(true)
	if err != nil {
		return "", err
	}
	defer ss.close()
	e, err := ss.doc.byKey(t.Key)
	if err == ErrNotFound || (err == nil && !e.signedIn) {
		return nativeforge.Absent, nil
	}
	if err != nil {
		return "", err
	}
	if e.Base != t.Base || !strings.EqualFold(e.User, t.User) {
		return "", ErrChanged
	}
	if e.Kind != KindPAT || e.node == nil {
		return "", ErrUnsupported
	}
	unset(e.node, "token")
	unset(e.node, "use_keyring")
	data, err := ss.doc.encode()
	if err != nil {
		return "", ErrWriteFailed
	}
	if err := s.commit(ss, data); err != nil {
		return "", err
	}
	return nativeforge.Written, nil
}
