package nativeforge

import (
	"crypto/sha256"
	"encoding/hex"
	"net/netip"
	"strconv"
	"strings"
)

// Base is a canonical HTTPS forge base: exact host, port and base path. Two
// bases are the same server instance only when all three are equal.
type Base struct {
	// Host is a lowercase DNS name or a canonical IP literal without brackets.
	Host string
	// Port is explicit or 443.
	Port int
	// Path is "" for a root instance, otherwise "/seg[/seg...]" without a
	// trailing slash.
	Path string
}

// MaxAddress bounds an address a person types or a remote URL.
const MaxAddress = 2048

// ParseBase accepts what a person types as a forge address. "https://" is
// inferred only when no scheme is present; an explicit port and a
// self-hosted base path are kept. Anything that could mean two different
// destinations is refused rather than corrected: other schemes, userinfo,
// query, fragment, percent-encoding, backslashes, dot segments, empty
// segments, non-ASCII or control bytes, and numeric host spellings that are
// not a canonical IP literal.
func ParseBase(raw string) (Base, error) {
	if raw == "" || len(raw) > MaxAddress {
		return Base{}, ErrInvalidAddress
	}
	for i := 0; i < len(raw); i++ {
		c := raw[i]
		if c <= ' ' || c > '~' || strings.IndexByte(`%\?#@`, c) >= 0 {
			return Base{}, ErrInvalidAddress
		}
	}
	rest := raw
	if i := strings.Index(raw, "://"); i >= 0 {
		if !strings.EqualFold(raw[:i], "https") {
			return Base{}, ErrInvalidAddress
		}
		rest = raw[i+3:]
	} else if strings.Contains(raw, ":/") {
		// "http:/x" and similar half-written schemes are not addresses.
		return Base{}, ErrInvalidAddress
	}
	authority, path := rest, ""
	if i := strings.IndexByte(rest, '/'); i >= 0 {
		authority, path = rest[:i], rest[i:]
	}
	host, port, ok := ParseAuthority(authority)
	if !ok {
		return Base{}, ErrInvalidAddress
	}
	path, ok = canonicalPath(path)
	if !ok {
		return Base{}, ErrInvalidAddress
	}
	return Base{Host: host, Port: port, Path: path}, nil
}

// ParseAuthority parses host[:port] or [v6][:port].
func ParseAuthority(a string) (string, int, bool) {
	host, portText := a, ""
	if strings.HasPrefix(a, "[") {
		end := strings.IndexByte(a, ']')
		if end < 0 {
			return "", 0, false
		}
		host = a[1:end]
		after := a[end+1:]
		if after != "" {
			if !strings.HasPrefix(after, ":") {
				return "", 0, false
			}
			portText = after[1:]
			if portText == "" {
				return "", 0, false
			}
		}
		ip, err := netip.ParseAddr(host)
		if err != nil || !ip.Is6() || ip.Zone() != "" {
			return "", 0, false
		}
		host = ip.String()
	} else {
		if i := strings.IndexByte(a, ':'); i >= 0 {
			host, portText = a[:i], a[i+1:]
			if portText == "" {
				return "", 0, false
			}
		}
		h, ok := canonicalHost(host)
		if !ok {
			return "", 0, false
		}
		host = h
	}
	port := 443
	if portText != "" {
		p, ok := parsePort(portText)
		if !ok {
			return "", 0, false
		}
		port = p
	}
	return host, port, true
}

func parsePort(s string) (int, bool) {
	if s == "" || len(s) > 5 || s[0] == '0' {
		return 0, false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return 0, false
		}
	}
	p, err := strconv.Atoi(s)
	return p, err == nil && p >= 1 && p <= 65535
}

// canonicalHost accepts a dotted-quad IPv4 literal in canonical form or a
// DNS name. DNS names are compared case-insensitively, so lowercasing them is
// canonicalisation, not correction.
func canonicalHost(h string) (string, bool) {
	if h == "" || len(h) > 253 {
		return "", false
	}
	if ip, err := netip.ParseAddr(h); err == nil {
		if !ip.Is4() || ip.String() != h {
			return "", false
		}
		return h, true
	}
	h = strings.ToLower(h)
	labels := strings.Split(h, ".")
	for _, l := range labels {
		if l == "" || len(l) > 63 || l[0] == '-' || l[len(l)-1] == '-' {
			return "", false
		}
		for i := 0; i < len(l); i++ {
			c := l[i]
			if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '-') {
				return "", false
			}
		}
	}
	// A numeric final label ("10.1", "0x7f.1", "127.1") is an alternative
	// IPv4 spelling to some resolvers, never a forge's DNS name.
	last := labels[len(labels)-1]
	if strings.Trim(last, "0123456789") == "" || strings.HasPrefix(last, "0x") {
		return "", false
	}
	return h, true
}

// canonicalPath accepts "" or "/a/b" with one optional trailing slash.
func canonicalPath(p string) (string, bool) {
	if p == "" || p == "/" {
		return "", true
	}
	p = strings.TrimSuffix(p, "/")
	segs := strings.Split(p[1:], "/")
	for _, s := range segs {
		if !ValidSegment(s) {
			return "", false
		}
	}
	return p, true
}

func ValidSegment(s string) bool {
	if s == "" || s == "." || s == ".." || len(s) > 255 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || strings.IndexByte("._~-", c) >= 0) {
			return false
		}
	}
	return true
}

// Authority is host or host:port as Git's credential protocol names it
// (IPv6 in brackets, port omitted when 443).
func (b Base) Authority() string {
	h := b.Host
	if strings.Contains(h, ":") {
		h = "[" + h + "]"
	}
	if b.Port != 443 {
		h += ":" + strconv.Itoa(b.Port)
	}
	return h
}

// String is the canonical base URL, as written into a native tool's file.
func (b Base) String() string { return "https://" + b.Authority() + b.Path }

// Digest identifies the base in an owned login name.
func (b Base) Digest() string {
	sum := sha256.Sum256([]byte(b.String()))
	return hex.EncodeToString(sum[:6])
}

// ExplicitLoopback reports whether the person named a loopback destination
// themselves. Only then may the connection dial loopback.
func (b Base) ExplicitLoopback() bool {
	if b.Host == "localhost" {
		return true
	}
	ip, err := netip.ParseAddr(b.Host)
	return err == nil && ip.IsLoopback()
}

// Valid: b has a host and port.
func (b Base) Valid() bool { return b.Host != "" && b.Port > 0 }

// RemoteAuthority is the host and port of an HTTPS Git remote address as
// the credential helper matches them: Git sends the URL's host and the
// helper canonicalises it, so "https://FORGE.example:443/x" reaches the same
// login as "https://forge.example/x". Userinfo is skipped. Any other scheme,
// or an authority the helper would refuse, is not ok.
func RemoteAuthority(raw string) (Base, bool) {
	i := strings.Index(raw, "://")
	if i < 0 || !strings.EqualFold(raw[:i], "https") {
		return Base{}, false
	}
	rest := raw[i+3:]
	if j := strings.IndexAny(rest, "/?#"); j >= 0 {
		rest = rest[:j]
	}
	if k := strings.LastIndexByte(rest, '@'); k >= 0 {
		rest = rest[k+1:]
	}
	host, port, ok := ParseAuthority(rest)
	if !ok {
		return Base{}, false
	}
	return Base{Host: host, Port: port}, true
}

// SameServer: a and b are the same host and port, whatever their paths.
func (b Base) SameServer(o Base) bool { return b.Host == o.Host && b.Port == o.Port }
