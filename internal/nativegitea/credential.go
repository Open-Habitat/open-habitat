package nativegitea

import (
	"strings"

	"github.com/Open-Habitat/open-habitat/internal/nativeforge"
)

// repoUnder: path is exactly /owner/repository[.git] below b's base path.
// Requiring Gitea's repository shape, rather than any descendant, keeps a
// root instance from claiming a base-path instance's repositories once that
// instance's own login is gone.
func repoUnder(path string, b Base) bool {
	if !strings.HasPrefix(path, b.Path+"/") {
		return false
	}
	return strings.Count(path[len(b.Path)+1:], "/") == 1
}

// match selects the one login for a Git request. The request must be HTTPS
// to exactly the login's host and port, for an owner/repository path under
// its base path, with no other Gitea on that host claiming a longer base. Within
// that base the requested username selects the account; without one, only a
// base with exactly one entry of any kind matches. Duplicates, unsupported
// entries and mismatches yield ErrNoMatch or ErrAmbiguous, never the first
// or default login. An explicit login name narrows the same choice.
func match(entries []entry, req CredentialRequest, explicit string) (Credential, error) {
	if req.Protocol != "https" {
		return Credential{}, ErrNoMatch
	}
	host, port, ok := nativeforge.ParseAuthority(req.Host)
	if !ok {
		return Credential{}, ErrNoMatch
	}
	path, ok := nativeforge.RequestPath(req.Path)
	if !ok {
		return Credential{}, ErrNoMatch
	}
	longest := -1
	for _, e := range entries {
		if e.Base.Valid() && e.Base.Host == host && e.Base.Port == port && repoUnder(path, e.Base) && len(e.Base.Path) > longest {
			longest = len(e.Base.Path)
		}
	}
	if longest < 0 {
		return Credential{}, ErrNoMatch
	}
	var instance []*entry
	for i := range entries {
		e := &entries[i]
		if e.Base.Valid() && e.Base.Host == host && e.Base.Port == port && repoUnder(path, e.Base) && len(e.Base.Path) == longest {
			instance = append(instance, e)
		}
	}
	if explicit != "" {
		var named []*entry
		for i := range entries {
			if strings.EqualFold(entries[i].Name, explicit) {
				named = append(named, &entries[i])
			}
		}
		if len(named) != 1 {
			return Credential{}, ErrNoMatch
		}
		inside := false
		for _, e := range instance {
			inside = inside || e == named[0]
		}
		if !inside {
			return Credential{}, ErrNoMatch
		}
		instance = named
	}
	var chosen []*entry
	for _, e := range instance {
		if req.Username == "" || strings.EqualFold(e.User, req.Username) {
			chosen = append(chosen, e)
		}
	}
	switch {
	case len(chosen) == 0:
		return Credential{}, ErrNoMatch
	case len(chosen) > 1:
		return Credential{}, ErrAmbiguous
	case chosen[0].Ambiguous:
		return Credential{}, ErrAmbiguous
	case !chosen[0].Usable():
		return Credential{}, ErrNoMatch
	}
	return Credential{Username: chosen[0].User, Password: chosen[0].token}, nil
}
