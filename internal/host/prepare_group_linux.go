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
	b, absent, e := readProcNSS(ctx, 4096, "group", "open-habitat-proc")
	if e != nil {
		return "", e
	}
	if absent {
		return "absent", nil
	}
	gid, e := parseProcGroup(b)
	if e != nil {
		return "", e
	}
	groups, absent, e := readProcNSS(ctx, 1<<20, "group")
	if e != nil || absent {
		return "", ErrPrepareBlocked
	}
	users, absent, e := readProcNSS(ctx, 1<<20, "passwd")
	if e != nil || absent {
		return "", ErrPrepareBlocked
	}
	if !safeProcMembership(gid, groups, users) {
		return "", ErrTrust
	}
	return gid, nil
}

// The supported baseline uses enumerable native NSS. Partial, oversized or
// unavailable enumeration cannot certify that the exemption GID is unoccupied.
func readProcNSS(ctx context.Context, limit int64, args ...string) ([]byte, bool, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, "/usr/bin/getent", args...)
	cmd.Env = []string{"PATH=/usr/sbin:/usr/bin:/sbin:/bin", "LANG=C", "LC_ALL=C"}
	cmd.Dir = "/"
	pipe, e := cmd.StdoutPipe()
	if e != nil {
		return nil, false, ErrPrepareBlocked
	}
	if cmd.Start() != nil {
		return nil, false, ErrPrepareBlocked
	}
	b, e := io.ReadAll(io.LimitReader(pipe, limit+1))
	if e != nil || int64(len(b)) > limit {
		cmd.Process.Kill()
		cmd.Wait()
		return nil, false, ErrPrepareBlocked
	}
	e = cmd.Wait()
	if e != nil {
		var exit *exec.ExitError
		if errors.As(e, &exit) && exit.ExitCode() == 2 && len(b) == 0 && ctx.Err() == nil {
			return nil, true, nil
		}
		return nil, false, ErrPrepareBlocked
	}
	return b, false, nil
}
func safeProcMembership(gid string, groups, users []byte) bool {
	target, e := strconv.ParseUint(gid, 10, 32)
	if e != nil {
		return false
	}
	named := 0
	for _, line := range strings.Split(strings.TrimSuffix(string(groups), "\n"), "\n") {
		f := strings.Split(line, ":")
		if len(f) != 4 {
			return false
		}
		n, e := strconv.ParseUint(f[2], 10, 32)
		if e != nil {
			return false
		}
		if f[0] == "open-habitat-proc" {
			if n != target || f[3] != "" {
				return false
			}
			named++
		} else if n == target {
			return false
		}
	}
	if named != 1 {
		return false
	}
	for _, line := range strings.Split(strings.TrimSuffix(string(users), "\n"), "\n") {
		f := strings.Split(line, ":")
		if len(f) != 7 {
			return false
		}
		n, e := strconv.ParseUint(f[3], 10, 32)
		if e != nil || n == target {
			return false
		}
	}
	return true
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

// Native installation/verification never accepts an unresolved template.
// First-prepare preview separately permits an absent group through src.policies.
func nativePreparePolicies(ctx context.Context, s Site) ([]policyFile, error) {
	gid, err := procGroup(ctx)
	if err != nil {
		return nil, err
	}
	return preparePoliciesGID(s, gid)
}
func preparePoliciesGID(s Site, gid string) ([]policyFile, error) {
	if _, err := parseProcGroup([]byte("open-habitat-proc:x:" + gid + ":")); err != nil {
		return nil, err
	}
	ps := preparePolicies(s)
	for i := range ps {
		ps[i].Content = strings.ReplaceAll(ps[i].Content, "@PROC_GID@", gid)
	}
	return ps, nil
}
func (src prepareSources) policies(ctx context.Context, s Site) ([]policyFile, error) {
	if src.group == nil {
		return preparePolicies(s), nil
	}
	gid, err := src.group(ctx)
	if err != nil {
		return nil, err
	}
	if gid == "absent" {
		return preparePolicies(s), nil
	}
	return preparePoliciesGID(s, gid)
}
