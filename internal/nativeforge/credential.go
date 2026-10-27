package nativeforge

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

// RequestPath turns Git's path attribute (sent because the helper's scope
// sets useHttpPath) into "/seg/...". Only plain repository-path segments are
// accepted; without a path the base boundary cannot be checked at all.
func RequestPath(p string) (string, bool) {
	p = strings.TrimPrefix(p, "/")
	if p == "" {
		return "", false
	}
	for _, s := range strings.Split(p, "/") {
		if !ValidSegment(s) {
			return "", false
		}
	}
	return "/" + p, true
}

