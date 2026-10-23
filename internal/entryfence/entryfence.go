// Package entryfence observes close-only markers without mutation authority.
package entryfence

import (
	"errors"
	"os"
)

// UpgradePath fences cold root startup. Its location stays stable because an
// interrupted upgrade can still boot the predecessor's guard through current.
const UpgradePath = "/etc/open-habitat/upgrade-closed"

// AgentUpgradePath fences own-UID mutations outside the gateway's private
// configuration ancestor. The root operator publishes both close-only markers;
// mapped users need no search access to the private cold-start fence.
const AgentUpgradePath = "/opt/open-habitat/upgrade-closed"

// Closed requires absence of both publication names. The stage must be checked
// first: a legitimate stage→final rename between final-first lookups could make
// continuous denial appear absent. Callers retain their own parent/peer checks.
func Closed(path string) bool {
	return Reason(path) != ""
}

// Reason returns only fixed diagnostic codes, never filesystem error text.
func Reason(path string) string {
	return reason(path, func(name string) error { _, e := os.Lstat(name); return e })
}

func closed(path string, probe func(string) error) bool { return reason(path, probe) != "" }

func reason(path string, probe func(string) error) string {
	for _, name := range []string{path + ".next", path} {
		if e := probe(name); e == nil {
			return "upgrade_closed"
		} else if !errors.Is(e, os.ErrNotExist) {
			return "upgrade_fence_unavailable"
		}
	}
	return ""
}
