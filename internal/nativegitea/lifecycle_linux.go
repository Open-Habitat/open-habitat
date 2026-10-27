//go:build linux

package nativegitea

import (
	"context"
	"strings"
	"time"
)

// Verifier reads the account a PAT authenticates and proves it can read
// the repository list; Client.Verify is the production one.
type Verifier interface {
	Verify(ctx context.Context, b Base, token string) (Account, error)
}

// Connect validates a PAT against base (the account it authenticates and
// its repository read, see Client.Verify) and adds tea's entry for that
// account under the owned name. It never sets a default, never takes over an
// existing entry, and refuses an account or PAT tea already has: the person
// may already use that external entry, and a second one would make both
// ambiguous.
func (s *Store) Connect(ctx context.Context, v Verifier, b Base, token string) (Login, Outcome, error) {
	if !b.Valid() {
		return Login{}, "", ErrInvalidAddress
	}
	if !validToken(token) {
		return Login{}, "", ErrInvalidToken
	}
	account, err := v.Verify(ctx, b, token)
	if err != nil {
		return Login{}, "", err
	}
	if ctx.Err() != nil {
		return Login{}, "", ErrUnreachable
	}
	ss, err := s.open(true)
	if err != nil {
		return Login{}, "", err
	}
	defer ss.close()
	doc := ss.doc
	name := OwnedName(b, account.ID)
	switch e, err := doc.byName(name); {
	case err == ErrAmbiguous:
		return Login{}, "", ErrAmbiguous
	case err == nil:
		if e.Owned && e.Base == b && strings.EqualFold(e.User, account.Login) && e.Kind == KindPAT {
			if e.token == token && !e.Ambiguous {
				return e.Login, Unchanged, nil
			}
			return e.Login, "", ErrExists
		}
		return Login{}, "", ErrNameTaken
	}
	probe := Login{Base: b, User: account.Login}
	for _, e := range doc.entries {
		if sameAccount(e.Login, probe) {
			return Login{}, "", ErrExists
		}
	}
	if doc.tokenUsed(token, nil) {
		return Login{}, "", ErrExists
	}
	login := teaLogin{
		Name:         name,
		URL:          b.String(),
		Token:        token,
		SSHHost:      b.Authority(),
		VersionCheck: true,
		User:         account.Login,
		Created:      time.Now().Unix(),
	}
	if err := doc.append(login); err != nil {
		return Login{}, "", ErrWriteFailed
	}
	data, err := doc.encode()
	if err != nil {
		return Login{}, "", ErrWriteFailed
	}
	if err := s.commit(ss, data); err != nil {
		return Login{}, "", err
	}
	return Login{Name: name, URL: login.URL, Base: b, User: account.Login, Kind: KindPAT, Owned: true, OwnedID: account.ID}, Written, nil
}

// Replace swaps the PAT of the targeted PAT entry after validating that the
// new PAT authenticates the same account (the entry's user, and for an owned
// entry also the Gitea user ID in its name) and can read the repository list. A refusal at any point leaves the
// previous bytes intact. Only the token scalar changes.
func (s *Store) Replace(ctx context.Context, v Verifier, t Target, token string) (Login, Outcome, error) {
	if !t.Base.Valid() || t.Name == "" {
		return Login{}, "", ErrNotFound
	}
	if !validToken(token) {
		return Login{}, "", ErrInvalidToken
	}
	account, err := v.Verify(ctx, t.Base, token)
	if err != nil {
		return Login{}, "", err
	}
	if ctx.Err() != nil {
		return Login{}, "", ErrUnreachable
	}
	ss, err := s.open(true)
	if err != nil {
		return Login{}, "", err
	}
	defer ss.close()
	e, err := ss.doc.byName(t.Name)
	if err != nil {
		return Login{}, "", err
	}
	if e.Base != t.Base || !strings.EqualFold(e.User, t.User) {
		return Login{}, "", ErrChanged
	}
	if e.Ambiguous {
		return Login{}, "", ErrAmbiguous
	}
	if e.Kind != KindPAT {
		return Login{}, "", ErrUnsupported
	}
	if !strings.EqualFold(account.Login, e.User) || (e.Owned && account.ID != e.OwnedID) {
		return Login{}, "", ErrAccountMismatch
	}
	if e.token == token {
		return e.Login, Unchanged, nil
	}
	if ss.doc.tokenUsed(token, e) {
		return Login{}, "", ErrExists
	}
	if !e.setToken(token) {
		return Login{}, "", ErrUnsupported
	}
	data, err := ss.doc.encode()
	if err != nil {
		return Login{}, "", ErrWriteFailed
	}
	if err := s.commit(ss, data); err != nil {
		return Login{}, "", err
	}
	return e.Login, Written, nil
}

// Remove deletes the targeted local tea entry. It revokes nothing at Gitea
// and touches no clone. It is refused while the daemon holds the login for
// an active job; a process that already received the token may still finish.
func (s *Store) Remove(t Target) (Outcome, error) {
	end, err := s.holds.Removing(t.Name)
	if err != nil {
		return "", err
	}
	defer end()
	ss, err := s.open(true)
	if err != nil {
		return "", err
	}
	defer ss.close()
	e, err := ss.doc.byName(t.Name)
	if err == ErrNotFound {
		return Absent, nil
	}
	if err != nil {
		return "", err
	}
	if e.Base != t.Base || !strings.EqualFold(e.User, t.User) {
		return "", ErrChanged
	}
	ss.doc.remove(e)
	data, err := ss.doc.encode()
	if err != nil {
		return "", ErrWriteFailed
	}
	if err := s.commit(ss, data); err != nil {
		return "", err
	}
	return Written, nil
}

// Hold marks a login as used by an active daemon job until release is
// called; Remove is refused meanwhile. It is in-memory daemon state about
// the daemon's own jobs, not a record of connections.
func (s *Store) Hold(name string) (release func(), err error) { return s.holds.Hold(name) }
