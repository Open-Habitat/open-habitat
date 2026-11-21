package gateway

import (
	"context"
	"net/http"
	"time"
)

// liveRequest binds a relay to the session that authenticated it, closing the
// authenticate/register race under mu. A future upgraded relay must also close
// its hijacked socket when this context ends (net/http no longer owns it).
// Traffic on the relay does not renew the browser's idle session lifetime.
func (a *Auth) liveRequest(r *http.Request, authenticated session) (context.Context, func(), bool) {
	c, err := r.Cookie(cookieName)
	if err != nil {
		return nil, nil, false
	}
	key := a.cookieKey(c.Value)
	a.mu.Lock()
	defer a.mu.Unlock()
	s, ok := a.sessions[key]
	if !ok || s.csrf != authenticated.csrf || s.identity != authenticated.identity || !a.now().Before(s.idle) || !a.now().Before(s.absolute) || !a.sessionStoreHealthy() {
		return nil, nil, false
	}
	ctx, release := a.registerLive(r.Context(), key, func() bool {
		current, exists := a.sessions[key]
		return exists && a.now().Before(current.idle) && a.now().Before(current.absolute) && a.sessionStoreHealthy() && !a.deniedLocked(current.identity.Subject)
	})
	return ctx, release, true
}

// registerLive adds a relay under the browser session's store key, so that
// removing the session cancels it, and checks valid (under mu) every second
// for expiry. Call under mu.
func (a *Auth) registerLive(parent context.Context, key string, valid func() bool) (context.Context, func()) {
	return a.registerRelay(parent, key, "", valid)
}

// registerRelay is registerLive for a relay that is also tied to a share of
// a conversation (ADR 0038): removing the participant or withdrawing either
// person cancels it under mu, the lock its registration was checked under.
// Call under mu.
func (a *Auth) registerRelay(parent context.Context, key, share string, valid func() bool) (context.Context, func()) {
	ctx, cancel := context.WithCancel(parent)
	if a.live == nil {
		a.live = make(map[string]map[*liveRelay]struct{})
	}
	relay := &liveRelay{cancel: cancel}
	if a.live[key] == nil {
		a.live[key] = make(map[*liveRelay]struct{})
	}
	a.live[key][relay] = struct{}{}
	if share != "" {
		if a.shareLive == nil {
			a.shareLive = make(map[string]map[*liveRelay]struct{})
		}
		if a.shareLive[share] == nil {
			a.shareLive[share] = make(map[*liveRelay]struct{})
		}
		a.shareLive[share][relay] = struct{}{}
	}
	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				a.mu.Lock()
				if !valid() {
					cancel()
				}
				a.mu.Unlock()
			}
		}
	}()
	return ctx, func() {
		cancel()
		a.mu.Lock()
		defer a.mu.Unlock()
		delete(a.live[key], relay)
		if len(a.live[key]) == 0 {
			delete(a.live, key)
		}
		if share != "" {
			delete(a.shareLive[share], relay)
			if len(a.shareLive[share]) == 0 {
				delete(a.shareLive, share)
			}
		}
	}
}

// cancelShareRelaysLocked ends every relay of one share. Call under mu.
func (a *Auth) cancelShareRelaysLocked(share string) {
	for relay := range a.shareLive[share] {
		relay.cancel()
	}
	delete(a.shareLive, share)
}

type liveRelay struct{ cancel context.CancelFunc }

// publishSessions also ends relays synchronously with authority changes. All
// callers hold mu, including the post-rename/directory-sync-failure path.
func (a *Auth) publishSessions(next map[string]session) {
	a.sessions = next
	a.pruneEditorSessions()
	for key, relays := range a.live {
		if _, ok := next[key]; !ok {
			for relay := range relays {
				relay.cancel()
			}
		}
	}
}
