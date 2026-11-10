//go:build linux

package cli

import (
	"github.com/open-habitat/open-habitat/internal/entryfence"
	"golang.org/x/sys/unix"
	"net/http"
	"path/filepath"
)

// This root-owned fence controls HTTP entry points only. Private root control
// stays available for quota/role/revocation convergence while admission is shut.
// Any failure to establish absence fails closed, including parent permission
// loss. The gateway can neither create nor remove the fence.
func entryGate(path string, next http.Handler) http.Handler {
	return entryGateWithOwner(path, 0, next)
}
func entryGateWithOwner(path string, owner uint32, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var parent unix.Stat_t
		if unix.Lstat(filepath.Dir(path), &parent) != nil || parent.Uid != owner || parent.Mode&0022 != 0 || parent.Mode&unix.S_IFMT != unix.S_IFDIR {
			http.Error(w, "maintenance", http.StatusServiceUnavailable)
			return
		}
		if entryfence.Closed(path) {
			http.Error(w, "maintenance", http.StatusServiceUnavailable)
			return
		}
		next.ServeHTTP(w, r)
	})
}
