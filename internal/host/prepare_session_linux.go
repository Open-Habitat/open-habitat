//go:build linux

package host

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

var ErrSessionPolicy = errors.New("session_policy_unavailable: effective proc/session policy required")

func sessionCommand(ctx context.Context, args ...string) ([]byte, error) {
	bounded, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	cmd := exec.CommandContext(bounded, "/usr/bin/systemctl", args...)
	cmd.Env = []string{"PATH=/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL=C"}
	cmd.WaitDelay = time.Second
	// systemctl's selected properties are bounded; never return native diagnostics.
	b, err := cmd.Output()
	if err != nil || len(b) > 16384 {
		return nil, ErrSessionPolicy
	}
	return b, nil
}
func restartSessionPolicy(ctx context.Context) error {
	for _, args := range [][]string{{"daemon-reload"}, {"enable", "open-habitat-proc.service"}, {"restart", "open-habitat-proc.service"}, {"restart", "systemd-logind.service", "polkit.service"}} {
		if _, err := sessionCommand(ctx, args...); err != nil {
			return ErrSessionPolicy
		}
	}
	return sessionPolicyReady(ctx)
}
func sessionPolicyReady(ctx context.Context) error {
	group, err := procGroup(ctx)
	if err != nil || group == "absent" {
		return ErrSessionPolicy
	}
	// procGroup returns the validated numeric GID, not the NSS row.
	gid, err := strconv.ParseUint(group, 10, 32)
	if err != nil || gid == 0 {
		return ErrSessionPolicy
	}
	b, err := os.ReadFile("/proc/self/mountinfo")
	if err != nil || !procMountPolicy(b, group) {
		return ErrSessionPolicy
	}
	for _, unit := range []string{"systemd-logind.service", "polkit.service"} {
		b, err = sessionCommand(ctx, "show", unit, "--property=LoadState,ActiveState,SubState,SupplementaryGroups,MainPID", "--no-pager")
		if err != nil {
			return ErrSessionPolicy
		}
		if err = sessionUnitPolicy(unit, b, group, os.ReadFile); err != nil {
			return err
		}
	}
	return ctx.Err()
}

func sessionUnitPolicy(unit string, b []byte, group string, readFile func(string) ([]byte, error)) error {
	props := map[string]string{}
	for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
		k, v, ok := strings.Cut(line, "=")
		if _, duplicate := props[k]; !ok || duplicate {
			return ErrSessionPolicy
		}
		props[k] = v
	}
	if props["LoadState"] != "loaded" || props["SupplementaryGroups"] != "open-habitat-proc" {
		return ErrSessionPolicy
	}
	pid, e := strconv.ParseUint(props["MainPID"], 10, 32)
	if e != nil {
		return ErrSessionPolicy
	}
	// Ubuntu starts its static polkit service on the first D-Bus request, not
	// necessarily at boot. No process means no effective group set to check;
	// the loaded launch policy must still carry the exact exemption group.
	// A running process always needs native group readback. Check stays read-only.
	if unit == "polkit.service" && props["ActiveState"] == "inactive" && props["SubState"] == "dead" && pid == 0 {
		return nil
	}
	if props["ActiveState"] != "active" || props["SubState"] != "running" || pid == 0 {
		return ErrSessionPolicy
	}
	status, e := readFile("/proc/" + strconv.FormatUint(pid, 10) + "/status")
	if e != nil {
		return ErrSessionPolicy
	}
	for _, line := range strings.Split(string(status), "\n") {
		if strings.HasPrefix(line, "Groups:") {
			for _, v := range strings.Fields(strings.TrimPrefix(line, "Groups:")) {
				if v == group {
					return nil
				}
			}
		}
	}
	return ErrSessionPolicy
}
func procMountPolicy(b []byte, gid string) bool {
	seen, valid := false, false
	for _, line := range strings.Split(string(b), "\n") {
		f := strings.Fields(line)
		if len(f) < 10 || f[4] != "/proc" {
			continue
		}
		if seen {
			return false
		}
		seen = true
		_, super, ok := strings.Cut(line, " - proc ")
		if !ok {
			return false
		}
		fields := strings.Fields(super)
		if len(fields) != 2 {
			return false
		}
		opts := "," + fields[1] + ","
		valid = (strings.Contains(opts, ",hidepid=invisible,") || strings.Contains(opts, ",hidepid=2,")) && strings.Contains(opts, ",gid="+gid+",")
	}
	return seen && valid
}
