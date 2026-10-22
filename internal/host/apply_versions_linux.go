//go:build linux

package host

import (
	"context"
	"errors"
	"io"
	"os/exec"
	"time"
)

// Version ordering only refuses a downgrade; it never relaxes exact readback.
// dpkg exit 1 means a false predicate, not an observation/system failure.
func runtimeVersionNewer(ctx context.Context, installed, wanted string) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "/usr/bin/dpkg", "--compare-versions", installed, "gt", wanted)
	cmd.Dir = "/"
	cmd.Env = []string{"PATH=/usr/bin:/bin", "LC_ALL=C"}
	cmd.Stdout = io.Discard
	cmd.Stderr = io.Discard
	cmd.WaitDelay = time.Second
	e := cmd.Run()
	if ctx.Err() != nil {
		return false, ctx.Err()
	}
	if e == nil {
		return true, nil
	}
	var exit *exec.ExitError
	if errors.As(e, &exit) && exit.ExitCode() == 1 {
		return false, nil
	}
	return false, ErrNativeApply
}
