package provision

import (
	"path/filepath"
	"regexp"
)

// The shell becomes a passwd field and a usermod argument; it is a plain
// canonical absolute path, never a nologin or false placeholder.
var loginShellRE = regexp.MustCompile(`^(?:/[A-Za-z0-9._+-]+)+$`)

// ValidLoginShell is the syntax both the site and the broker accept.
func ValidLoginShell(s string) bool {
	if len(s) > 128 || !loginShellRE.MatchString(s) || filepath.Clean(s) != s {
		return false
	}
	switch filepath.Base(s) {
	case "nologin", "false":
		return false
	}
	return true
}
