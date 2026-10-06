package gateway

import (
	"context"
	"errors"
	"strconv"
)

// LogControlFailure records a fixed diagnostic when the private listener fails.
func (a *Auth) LogControlFailure() { a.log.Error("revoke_accept_failed") }

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
		return errors.New("session store unavailable")
	}
	a.revoked[subject] = a.serial
	a.log.Info("subject_revoked", "subject", subject, "sessions_removed", removed)
	return nil
}
