//go:build linux

package host

import "strings"

// Debian policy version ordering: epoch, upstream, then Debian revision. In each
// part non-digits sort before a numeric run, '~' before everything (even end),
// letters before punctuation; numeric runs ignore leading zeroes. No subprocess
// or host locale is involved in a read-only package requirement check.
func compareDebVersions(a, b string) int {
	split := func(s string) (string, string, string) {
		epoch := "0"
		if i := strings.IndexByte(s, ':'); i >= 0 {
			epoch, s = s[:i], s[i+1:]
		}
		revision := "0"
		if i := strings.LastIndexByte(s, '-'); i >= 0 {
			s, revision = s[:i], s[i+1:]
		}
		return epoch, s, revision
	}
	ae, au, ar := split(a)
	be, bu, br := split(b)
	if c := compareDebPart(ae, be); c != 0 {
		return c
	}
	if c := compareDebPart(au, bu); c != 0 {
		return c
	}
	return compareDebPart(ar, br)
}
func compareDebPart(a, b string) int {
	digit := func(c byte) bool { return c >= '0' && c <= '9' }
	order := func(s string) int {
		if s == "" {
			return 0
		}
		c := s[0]
		if c == '~' {
			return -1
		}
		if digit(c) {
			return 0
		}
		if c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z' {
			return int(c)
		}
		return int(c) + 256
	}
	for a != "" || b != "" {
		for a != "" && !digit(a[0]) || b != "" && !digit(b[0]) {
			x, y := order(a), order(b)
			if x < y {
				return -1
			}
			if x > y {
				return 1
			}
			if a != "" {
				a = a[1:]
			}
			if b != "" {
				b = b[1:]
			}
		}
		a = strings.TrimLeft(a, "0")
		b = strings.TrimLeft(b, "0")
		i, j := 0, 0
		for i < len(a) && digit(a[i]) {
			i++
		}
		for j < len(b) && digit(b[j]) {
			j++
		}
		if i < j {
			return -1
		}
		if i > j {
			return 1
		}
		if c := strings.Compare(a[:i], b[:j]); c != 0 {
			return c
		}
		a, b = a[i:], b[j:]
	}
	return 0
}
