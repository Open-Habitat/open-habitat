//go:build linux

package host

import (
	"context"
	"errors"
	"io"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// Only this fixed product-owned exemption group may be created. This is not
// broker account provisioning: sysusers receives a file containing one group
// declaration and no user/member directives. Never install session drop-ins
// naming a group that may not exist after Ubuntu's conditional sysusers boot.
func procGroup(ctx context.Context) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "/usr/bin/getent", "group", "open-habitat-proc")
	cmd.Env = []string{"PATH=/usr/sbin:/usr/bin:/sbin:/bin", "LANG=C", "LC_ALL=C"}
	cmd.Dir = "/"
	pipe, e := cmd.StdoutPipe()
	if e != nil {
		return "", ErrPrepareBlocked
	}
	if cmd.Start() != nil {
		return "", ErrPrepareBlocked
	}
	b, e := io.ReadAll(io.LimitReader(pipe, 4097))
	if e != nil || len(b) > 4096 {
		cmd.Process.Kill()
		cmd.Wait()
		return "", ErrPrepareBlocked
	}
	e = cmd.Wait()
	if e != nil {
		var exit *exec.ExitError
		if errors.As(e, &exit) && exit.ExitCode() == 2 && len(b) == 0 && ctx.Err() == nil {
			return "absent", nil
		}
		return "", ErrPrepareBlocked
	}
	return parseProcGroup(b)
}
func parseProcGroup(b []byte) (string, error) {
	fields := strings.Split(strings.TrimSuffix(string(b), "\n"), ":")
	if len(fields) != 4 || fields[0] != "open-habitat-proc" || fields[3] != "" {
		return "", ErrTrust
	}
	gid, e := strconv.ParseUint(fields[2], 10, 32)
	if e != nil || gid == 0 || gid >= 65534 || strconv.FormatUint(gid, 10) != fields[2] {
		return "", ErrTrust
	}
	return fields[2], nil
}
func ensureProcGroup(ctx context.Context) error {
	before, e := procGroup(ctx)
	if e != nil {
		return e
	}
	if before != "absent" {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "/usr/bin/systemd-sysusers", "/etc/sysusers.d/open-habitat-proc.conf")
	cmd.Env = []string{"PATH=/usr/sbin:/usr/bin:/sbin:/bin", "LANG=C", "LC_ALL=C"}
	cmd.Dir = "/"
	if cmd.Run() != nil {
		return ErrPrepareBlocked
	}
	after, e := procGroup(ctx)
	if e != nil {
		return e
	}
	if after == "absent" {
		return ErrPrepareBlocked
	}
	return nil
}
