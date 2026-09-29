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
	// The broker verification precedes the lock. No broker rebind is accepted:
	// subsequent requests reauthorize, and this operation never routes to a UID.
	if a.revoked == nil {
		a.revoked = make(map[string]uint64)
	}
	a.revoked[subject] = a.serial
	removed := 0
	for key, s := range a.sessions {
		if s.identity.Subject == subject {
			delete(a.sessions, key)
			delete(a.conversations, key)
			removed++
		}
	}
	a.log.Info("subject_revoked", "subject", subject, "sessions_removed", removed)
	return nil
}
