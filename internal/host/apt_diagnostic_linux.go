//go:build linux

package host

import (
	"context"
	"errors"
	"net/url"
	"regexp"
	"strings"
	"unicode"
)

const maxAptExcerpt = 2048

// AptFailure is an operator-only diagnostic, never a browser/service error.
// The cause retains cancellation/deadline identity without exposing raw errors.
type AptFailure struct {
	Class   string
	Excerpt string
	cause   error
}

func (e *AptFailure) Error() string { return "apt " + e.Class + ": " + e.Excerpt }
func (e *AptFailure) Unwrap() error { return e.cause }

var aptURL = regexp.MustCompile(`(?i)[a-z][a-z0-9+.-]*://[^\s<>"']+`)
var aptSecret = regexp.MustCompile(`(?i)(password|passwd|token|secret|api[_-]?key)[ \t]*[:=][ \t]*(?:"[^"\r\n]*"|'[^'\r\n]*'|\S+)`)
var aptAuthorization = regexp.MustCompile(`(?i)(authorization|proxy-authorization)[ \t]*[:=][^\r\n]*`)
var aptDeb = regexp.MustCompile(`^[a-z0-9][a-z0-9+.-]*_[a-zA-Z0-9+._%:~-]+_[a-z0-9]+\.deb$`)

func aptFailure(stderr string, cause error) *AptFailure {
	// Strip credentials and query/fragment values before bounding the excerpt;
	// truncating first could separate a secret from its identifying key or URL.
	text := strings.Map(func(r rune) rune {
		if unicode.IsControl(r) && r != '\n' && r != '\t' {
			return -1
		}
		return r
	}, stderr)
	text = aptURL.ReplaceAllStringFunc(text, func(raw string) string {
		u, err := url.Parse(raw)
		if err != nil || u.Hostname() == "" {
			return "[redacted-url]"
		}
		base := u.Path[strings.LastIndex(u.Path, "/")+1:]
		path := "/[redacted-path]"
		if aptDeb.MatchString(base) {
			path = "/.../" + base
		}
		return u.Scheme + "://" + u.Host + path
	})
	text = aptSecret.ReplaceAllString(text, "$1=[redacted]")
	text = aptAuthorization.ReplaceAllString(text, "$1=[redacted]")
	lower := strings.ToLower(text)
	class := "unknown"
	switch {
	case strings.Contains(lower, "could not get lock"), strings.Contains(lower, "unable to acquire"), strings.Contains(lower, "lock was locked"), strings.Contains(lower, "waiting for cache lock"):
		class = "dpkg_lock"
	case strings.Contains(lower, "404"), strings.Contains(lower, "hash sum mismatch"), strings.Contains(lower, "file has unexpected size"):
		class = "mirror_index_mismatch"
	case strings.Contains(lower, "held broken packages"), strings.Contains(lower, "held packages"), strings.Contains(lower, "dpkg was interrupted"), strings.Contains(lower, "--fix-broken"):
		class = "held_or_broken_packages"
	case strings.Contains(lower, "unmet dependencies"), strings.Contains(lower, "depends:"), strings.Contains(lower, "dependency problems"):
		class = "unmet_dependencies"
	}
	if errors.Is(cause, context.DeadlineExceeded) && class == "unknown" {
		class = "deadline_exceeded"
	}
	text = strings.TrimSpace(text)
	if len(text) > maxAptExcerpt {
		// Keep the end, where apt normally writes its actionable error summary.
		text = "[truncated] " + strings.ToValidUTF8(text[len(text)-maxAptExcerpt+16:], "")
	}
	if text == "" {
		text = "no stderr captured; inspect host apt/dpkg logs"
	}
	return &AptFailure{Class: class, Excerpt: text, cause: cause}
}

// aptStderr drains all output without changing command success or memory use.
// Retain the tail, dropping a partial leading line before redaction.
type aptStderr struct {
	data      []byte
	truncated bool
}

func (b *aptStderr) Write(p []byte) (int, error) {
	n := len(p)
	const limit = 64 * 1024
	if len(p) >= limit {
		b.data = append(b.data[:0], p[len(p)-limit:]...)
		b.truncated = true
		return n, nil
	}
	if len(b.data)+len(p) > limit {
		b.data = b.data[len(b.data)+len(p)-limit:]
		b.truncated = true
	}
	b.data = append(b.data, p...)
	return n, nil
}
func (b *aptStderr) failure(cause error) *AptFailure {
	text := string(b.data)
	if b.truncated {
		if i := strings.IndexByte(text, '\n'); i >= 0 {
			text = text[i+1:]
		} else {
			text = "[truncated diagnostic line omitted]"
		}
	}
	return aptFailure(text, cause)
}
