package nativegitea

import (
	"bufio"
	"io"
	"strings"
)

// CredentialRequest is the part of Git's credential protocol the helper
// matches on.
type CredentialRequest struct {
	Protocol string
	Host     string
	Path     string
	Username string
}

// Credential is what the helper gives Git, and nothing else.
type Credential struct {
	Username string
	Password string
}

const (
	maxRequest     = 64 << 10
	maxRequestLine = 8 << 10
)

// ParseCredentialRequest reads one bounded request from Git. Repeated core
// attributes, NUL bytes, a url attribute (which would restate the others in
// a second encoding) and oversized input are refused. Unknown attributes,
// such as capability[] or wwwauth[], are ignored.
func ParseCredentialRequest(r io.Reader) (CredentialRequest, error) {
	var req CredentialRequest
	sc := bufio.NewScanner(io.LimitReader(r, maxRequest+1))
	sc.Buffer(make([]byte, 0, 1024), maxRequestLine)
	seen := map[string]bool{}
	total := 0
	for sc.Scan() {
		line := sc.Text()
		total += len(line) + 1
		if total > maxRequest || strings.IndexByte(line, 0) >= 0 {
			return CredentialRequest{}, ErrInvalidRequest
		}
		if line == "" {
			break
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			return CredentialRequest{}, ErrInvalidRequest
		}
		var field *string
		switch key {
		case "protocol":
			field = &req.Protocol
		case "host":
			field = &req.Host
		case "path":
			field = &req.Path
		case "username":
			field = &req.Username
		case "url":
			return CredentialRequest{}, ErrInvalidRequest
		default:
			continue
		}
		if seen[key] {
			return CredentialRequest{}, ErrInvalidRequest
		}
		seen[key] = true
		*field = value
	}
	if sc.Err() != nil {
		return CredentialRequest{}, ErrInvalidRequest
	}
	return req, nil
}

// WriteCredential writes the answer in Git's protocol.
func WriteCredential(w io.Writer, c Credential) error {
	_, err := io.WriteString(w, "username="+c.Username+"\npassword="+c.Password+"\n")
	return err
}

// requestPath turns Git's path attribute (sent because the helper's scope
// sets useHttpPath) into "/seg/...". Only plain repository-path segments are
// accepted; without a path the base boundary cannot be checked at all.
func requestPath(p string) (string, bool) {
	p = strings.TrimPrefix(p, "/")
	if p == "" {
		return "", false
	}
	for _, s := range strings.Split(p, "/") {
		if !validSegment(s) {
			return "", false
		}
	}
	return "/" + p, true
}

func underBase(path string, b Base) bool {
	return b.Path == "" || path == b.Path || strings.HasPrefix(path, b.Path+"/")
}

// match selects the one login for a Git request. The request must be HTTPS
// to exactly the login's host and port, under its base path at a segment
// boundary, with no other Gitea on that host claiming a longer base. Within
// that base the requested username selects the account; without one, only a
// base with exactly one entry of any kind matches. Duplicates, unsupported
// entries and mismatches yield ErrNoMatch or ErrAmbiguous, never the first
// or default login. An explicit login name narrows the same choice.
func match(entries []entry, req CredentialRequest, explicit string) (Credential, error) {
	if req.Protocol != "https" {
		return Credential{}, ErrNoMatch
	}
	host, port, ok := parseAuthority(req.Host)
	if !ok {
		return Credential{}, ErrNoMatch
	}
	path, ok := requestPath(req.Path)
	if !ok {
		return Credential{}, ErrNoMatch
	}
	longest := -1
	for _, e := range entries {
		if e.Base.valid() && e.Base.Host == host && e.Base.Port == port && underBase(path, e.Base) && len(e.Base.Path) > longest {
			longest = len(e.Base.Path)
		}
	}
	if longest < 0 {
		return Credential{}, ErrNoMatch
	}
	var instance []*entry
	for i := range entries {
		e := &entries[i]
		if e.Base.valid() && e.Base.Host == host && e.Base.Port == port && underBase(path, e.Base) && len(e.Base.Path) == longest {
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
