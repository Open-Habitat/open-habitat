// Package entryfence observes close-only markers without mutation authority.
package entryfence

import (
	"errors"
	"os"
)

// Closed requires absence of both publication names. The stage must be checked
// first: a legitimate stage→final rename between final-first lookups could make
// continuous denial appear absent. Callers retain their own parent/peer checks.
func Closed(path string) bool {
	return closed(path, func(name string) error { _, e := os.Lstat(name); return e })
}

func closed(path string, probe func(string) error) bool {
	for _, name := range []string{path + ".next", path} {
		if e := probe(name); !errors.Is(e, os.ErrNotExist) {
			return true
		}
	}
	return false
}
