package gateway

import (
	"context"
	"errors"
	"strconv"
)

// LogControlFailure records a fixed diagnostic when the private listener fails.
func (a *Auth) LogControlFailure() {
	a.log.Error("revoke_accept_failed", "outcome", "failed", "reason", "accept_failed")
}

// LogAdminControlFailure records a bounded reason, never the request or file contents.
func (a *Auth) LogAdminControlFailure(err error) {
	a.log.Error("admin_control_failed", "outcome", "failed", "reason", AdminControlError(err))
}

// RevokeSubject is callable only by the local privileged control listener, never HTTP.
// The binding is checked against the broker before touching memory. A flow has no
// known subject until Exchange; its start serial is compared at callback issuance.
func (a *Auth) RevokeSubject(ctx context.Context, subject string) error {
	n, err := strconv.ParseUint(subject, 10, 64)
	if err != nil || n == 0 || strconv.FormatUint(n, 10) != subject {
		return errors.New("invalid subject")
	}
	reply, err := a.broker.Exchange(ctx, BrokerRequest{Operation: "authorize", ID: subject})
	if err != nil {
		return errors.New("broker unavailable or denied")
	}
	_, ok := brokerIdentity(subject, reply)
	if !ok {
		return errors.New("binding unavailable")
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	// The broker verification precedes the lock. Revocation removes sessions
	// synchronously; a later broker policy edit alone does not end them.
	removed, err := a.revokeSessionsLocked(subject)
	if err != nil {
		return err
	}
	a.log.Info("subject_revoked", "outcome", "accepted", "actor", "root_peer", "subject", subject, "sessions_removed", removed)
	return nil
}

// revokeSessionsLocked durably removes every session and shared view link of
// subject, which ends its relays and editor sessions, and fences login flows started before now.
// Call under mu.
func (a *Auth) revokeSessionsLocked(subject string) (int, error) {
	if a.revoked == nil {
		a.revoked = make(map[string]uint64)
	}
	removed := 0
	if err := a.changedSessions(func(next map[string]session) {
		for key, s := range next {
			if s.identity.Subject == subject {
				delete(next, key)
				removed++
			}
		}
	}); err != nil {
		return 0, errors.New("session store unavailable")
	}
	// A revoked or withdrawn person's shared view links end with their
	// sessions (ADR 0033).
	if _, err := a.removeViewLinksLocked(subject); err != nil {
		return 0, errors.New("view link store unavailable")
	}
	a.revoked[subject] = a.serial
	return removed, nil
}
