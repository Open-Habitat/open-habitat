//go:build linux

package daemon

import (
	"errors"
	"os"
)

// Root's upgrade fence denies new native agent mutations without stopping an
// active turn. It is not drain or readiness evidence and grants no root API.
// Reads remain available so the own-UID operator can observe busy work.
func upgradeEntryClosed(path string) bool {
	_, e := os.Lstat(path)
	return !errors.Is(e, os.ErrNotExist)
}
