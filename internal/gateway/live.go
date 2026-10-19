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
	ctx, cancel := context.WithCancel(r.Context())
	if a.live == nil {
		a.live = make(map[string]map[*liveRelay]struct{})
	}
	relay := &liveRelay{cancel: cancel}
	if a.live[key] == nil {
		a.live[key] = make(map[*liveRelay]struct{})
	}
	a.live[key][relay] = struct{}{}
	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				a.mu.Lock()
				current, exists := a.sessions[key]
				if !exists || !a.now().Before(current.idle) || !a.now().Before(current.absolute) || !a.sessionStoreHealthy() {
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
	}, true
}

type liveRelay struct{ cancel context.CancelFunc }

// publishSessions also ends relays synchronously with authority changes. All
// callers hold mu, including the post-rename/directory-sync-failure path.
func (a *Auth) publishSessions(next map[string]session) {
	a.sessions = next
	for key, relays := range a.live {
		if _, ok := next[key]; !ok {
			for relay := range relays {
				relay.cancel()
			}
		}
	}
}
