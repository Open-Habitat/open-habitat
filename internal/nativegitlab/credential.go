package nativegitlab

import (
	"strings"

	"github.com/open-habitat/open-habitat/internal/nativeforge"
)

// projectUnder: path is exactly /group/.../project[.git] below b's base path,
// two to MaxSegments GitLab path segments. Requiring a project's shape,
// rather than any descendant, keeps GitLab's own routes (/-/...) and anything
// below a repository (an LFS endpoint, say) from receiving the token.
func projectUnder(path string, b Base) bool {
	if !strings.HasPrefix(path, b.Path+"/") {
		return false
	}
	return ValidFullName(strings.TrimSuffix(path[len(b.Path)+1:], ".git"))
}

// match selects the one login for a Git request. The request must be HTTPS
// to exactly the login's host and port, for a project path under its base
// path. glab keeps one account per server, so at most one entry can match;
// a requested username must be that entry's user. An ambiguous or unusable
// entry yields no credential, never a guess.
func match(entries []entry, req CredentialRequest) (Credential, error) {
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
	server := Base{Host: host, Port: port}
	var found []*entry
	for i := range entries {
		e := &entries[i]
		if e.signedIn && e.Base.Valid() && e.Base.SameServer(server) {
			found = append(found, e)
		}
	}
	switch {
	case len(found) == 0:
		return Credential{}, ErrNoMatch
	case len(found) > 1 || found[0].Ambiguous:
		return Credential{}, ErrAmbiguous
	}
	e := found[0]
	if !e.Usable() || !projectUnder(path, e.Base) || (req.Username != "" && !strings.EqualFold(e.User, req.Username)) {
		return Credential{}, ErrNoMatch
	}
	return Credential{Username: e.User, Password: e.token}, nil
}
