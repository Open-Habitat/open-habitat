//go:build linux

package provision

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// LinuxHostExecutor is a root-only executor for a reserved, operator-controlled
// UID pool. Construct it with the deployment's fixed gateway UID/GID.
// Socket activation is restricted to a committed, verified ensure route.
// Its paths are fixed; no request data can select a command or directory root.
type LinuxHostExecutor struct {
	GatewayUID, GatewayGID uint32
	run                    func(context.Context, string, ...string) ([]byte, error)
}

func NewLinuxHostExecutor(gatewayUID, gatewayGID uint32) *LinuxHostExecutor {
	return &LinuxHostExecutor{GatewayUID: gatewayUID, GatewayGID: gatewayGID, run: linuxCommand}
}
func linuxCommand(ctx context.Context, path string, args ...string) ([]byte, error) {
	budget := 3 * time.Second
	// Starting a socket waits for Fleetrepo's ordered root policy gate, which
	// may itself wait briefly for a concurrent broker authorize lock holder.
	if path == systemctl && len(args) == 2 && args[0] == "start" && strings.HasPrefix(args[1], "open-habitat-daemon@") && strings.HasSuffix(args[1], ".socket") {
		// The JIT gate may wait up to 30s for the committed-ledger lock.
		// Leave time for its checks and for systemd to finish binding.
		budget = 45 * time.Second
	}
	// A boot start of a syncing person's daemon finds its socket already
	// active, but the job may queue behind other boot work.
	if path == systemctl && len(args) == 2 && args[0] == "start" && strings.HasPrefix(args[1], "open-habitat-daemon@") && strings.HasSuffix(args[1], ".service") {
		budget = 15 * time.Second
	}
	bounded, cancel := context.WithTimeout(ctx, budget)
	defer cancel()
	cmd := exec.CommandContext(bounded, path, args...)
	cmd.Stdin = nil
	cmd.WaitDelay = 500 * time.Millisecond
	cmd.Env = []string{"PATH=/usr/sbin:/usr/bin:/sbin:/bin", "LC_ALL=C"}
	output := &limitedOutput{}
	cmd.Stdout, cmd.Stderr = output, output
	err := cmd.Run()
	if bounded.Err() != nil {
		return nil, bounded.Err()
	}
	if output.truncated {
		return nil, ErrInvalid
	}
	return output.Bytes(), err
}

// Keep root command output bounded even when a helper emits indefinitely.
// A truncated response is never interpreted as successful NSS absence.
type limitedOutput struct {
	bytes.Buffer
	truncated bool
}

func (o *limitedOutput) Write(p []byte) (int, error) {
	n := len(p)
	room := 8193 - o.Len()
	if room < len(p) {
		o.truncated = true
		p = p[:max(0, room)]
	}
	_, _ = o.Buffer.Write(p)
	return n, nil
}
func (e *LinuxHostExecutor) command(ctx context.Context, path string, args ...string) ([]byte, error) {
	if e == nil || e.GatewayUID == 0 || e.GatewayGID == 0 || e.run == nil || ctx == nil || ctx.Err() != nil {
		return nil, ErrInvalid
	}
	return e.run(ctx, path, args...)
}

const (
	getent     = "/usr/bin/getent"
	useradd    = "/usr/sbin/useradd"
	groupadd   = "/usr/sbin/groupadd"
	setfacl    = "/usr/bin/setfacl"
	getfacl    = "/usr/bin/getfacl"
	systemctl  = "/usr/bin/systemctl"
	homeBase   = "/home"
	configBase = "/etc/open-habitat-daemon/daemon/user-mappings"
	socketBase = "/run/open-habitat/users"
)

func number(n uint32) string { return strconv.FormatUint(uint64(n), 10) }

// lookup distinguishes NSS absence (getent exit 2) from unavailable NSS.
func (e *LinuxHostExecutor) lookup(ctx context.Context, db, key string) (string, bool, error) {
	b, err := e.command(ctx, getent, db, key)
	if err != nil {
		var exit *exec.ExitError
		if errors.As(err, &exit) && exit.ExitCode() == 2 && ctx.Err() == nil && len(b) == 0 {
			return "", false, nil
		}
		return "", false, ErrInvalid
	}
	if ctx.Err() != nil || len(b) == 0 || bytes.Count(b, []byte{'\n'}) != 1 {
		return "", false, ErrInvalid
	}
	return strings.TrimSuffix(string(b), "\n"), true, nil
}

// NSS initgroups detects stale memberships that would grant a freshly created
// service account privileges even though no passwd record exists yet.
func (e *LinuxHostExecutor) noSupplementaryGroups(ctx context.Context, name string) error {
	b, err := e.command(ctx, getent, "initgroups", name)
	if err != nil || ctx.Err() != nil || !bytes.HasSuffix(b, []byte{'\n'}) || len(strings.Fields(string(b))) != 1 || strings.Fields(string(b))[0] != name {
		return ErrInvalid
	}
	return nil
}
func (e *LinuxHostExecutor) vacant(ctx context.Context, db, key string) (bool, error) {
	_, found, err := e.lookup(ctx, db, key)
	return !found && err == nil, err
}
func statNoFollow(path string) (unix.Stat_t, error) {
	var st unix.Stat_t
	err := unix.Fstatat(unix.AT_FDCWD, path, &st, unix.AT_SYMLINK_NOFOLLOW)
	return st, err
}

func owner(path string, uid, gid uint32, mode uint32, directory bool) error {
	return ownerWithStat(path, uid, gid, mode, directory, statNoFollow)
}

func ownerWithStat(path string, uid, gid uint32, mode uint32, directory bool, stat func(string) (unix.Stat_t, error)) error {
	st, err := stat(path)
	if err != nil {
		return err
	}
	kind := uint32(unix.S_IFREG)
	if directory {
		kind = unix.S_IFDIR
	}
	if st.Mode&unix.S_IFMT != kind || st.Uid != uid || st.Gid != gid || st.Mode&07777 != mode || (!directory && (st.Nlink != 1 || st.Size > 8192)) {
		return ErrInvalid
	}
	return nil
}

// A default ACL on the binding directory can be inherited by a new file.
// chmod(0640) would then make named read grants effective before any later
// verifier gets to reject the binding. Reject it before creation or writing.
func bindingDirACL(path string) error {
	for _, name := range []string{"system.posix_acl_default", "system.posix_acl_access"} {
		if _, err := unix.Getxattr(path, name, nil); err != unix.ENODATA {
			return ErrInvalid
		}
	}
	return nil
}

func bindingOwner(path string, gid uint32) error {
	if owner(path, 0, gid, 0640, false) != nil {
		return ErrInvalid
	}
	if _, err := unix.Getxattr(path, "system.posix_acl_access", nil); err != unix.ENODATA {
		return ErrInvalid
	}
	return nil
}
func missing(path string) (bool, error) {
	var st unix.Stat_t
	err := unix.Fstatat(unix.AT_FDCWD, path, &st, unix.AT_SYMLINK_NOFOLLOW)
	if err == unix.ENOENT {
		return true, nil
	}
	if err != nil {
		return false, err
	}
	return false, nil
}
func safeParents(path string) error {
	return safeParentsWithStat(path, statNoFollow)
}

func safeParentsWithStat(path string, stat func(string) (unix.Stat_t, error)) error {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path {
		return ErrInvalid
	}
	for p := filepath.Dir(path); ; p = filepath.Dir(p) {
		st, err := stat(p)
		if err != nil || st.Mode&unix.S_IFMT != unix.S_IFDIR || st.Uid != 0 || st.Mode&0022 != 0 {
			return ErrInvalid
		}
		if p == "/" {
			break
		}
	}
	return nil
}

// configParentPolicy checks the protected installation directory as well as
// every ancestor. In particular, safeParents alone does not constrain group
// identity or world-readable/searchable mode on the final directory.
func configParentPolicy(base string, stat func(string) (unix.Stat_t, error)) error {
	if safeParentsWithStat(base, stat) != nil {
		return ErrInvalid
	}
	for _, p := range []string{filepath.Dir(filepath.Dir(base)), filepath.Dir(base), base} {
		if ownerWithStat(p, 0, 0, 0711, true, stat) != nil {
			return ErrInvalid
		}
	}
	return nil
}

// availabilityGuard is root-local; its closed stage is never put on the wire.
// Underlying host errors and command output are deliberately discarded.
type availabilityGuard string

func (g availabilityGuard) Error() string { return "host availability refused" }

func (e *LinuxHostExecutor) available(ctx context.Context, name string, uid uint32) (bool, error) {
	if !username(name) || uid < 1000 || uid > 60000 || e == nil || e.GatewayUID == 0 || e.GatewayGID == 0 || uid == e.GatewayUID || uid == e.GatewayGID || ctx == nil || ctx.Err() != nil {
		return false, availabilityGuard("invalid_executor")
	}
	for _, pair := range [][2]string{{"passwd", name}, {"passwd", number(uid)}, {"group", name}, {"group", number(uid)}} {
		ok, err := e.vacant(ctx, pair[0], pair[1])
		if err != nil {
			return false, availabilityGuard("nss_probe")
		}
		if !ok {
			return false, nil
		}
	}
	if e.noSupplementaryGroups(ctx, name) != nil {
		return false, availabilityGuard("group_probe")
	}
	for _, p := range []string{filepath.Join(homeBase, name), filepath.Join(configBase, "daemon-"+name+".json"), filepath.Join(socketBase, name)} {
		if safeParents(p) != nil {
			return false, availabilityGuard("parent_policy")
		}
	}
	if owner(socketBase, 0, e.GatewayGID, 0710, true) != nil || configParentPolicy(configBase, statNoFollow) != nil || bindingDirACL(configBase) != nil {
		return false, availabilityGuard("parent_policy")
	}
	if e.parentACL(ctx, 0) != nil {
		return false, availabilityGuard("acl_policy")
	}
	for _, p := range []string{filepath.Join(homeBase, name), filepath.Join(configBase, "daemon-"+name+".json"), filepath.Join(socketBase, name), socketFor(name)} {
		ok, err := missing(p)
		if err != nil {
			return false, availabilityGuard("path_probe")
		}
		if !ok {
			return false, nil
		}
	}
	// Existing enabled instances must not be taken over, even if their socket
	// and per-user directory are currently absent after a reboot.
	for _, spec := range [][2]string{{"open-habitat-daemon@" + name + ".socket", "disabled"}, {"open-habitat-daemon@" + name + ".service", "static"}} {
		if err := e.inactiveUnit(ctx, spec[0], spec[1]); err != nil {
			return false, availabilityGuard("unit_probe")
		}
	}
	return true, nil
}
func (e *LinuxHostExecutor) inactiveUnit(ctx context.Context, unit, expected string) error {
	b, err := e.command(ctx, systemctl, "is-enabled", unit)
	if ctx.Err() != nil || strings.TrimSpace(string(b)) != expected {
		return ErrInvalid
	}
	if err != nil {
		var exit *exec.ExitError
		if !errors.As(err, &exit) || exit.ExitCode() != 1 {
			return ErrInvalid
		}
	}
	b, err = e.command(ctx, systemctl, "is-active", unit)
	if ctx.Err() != nil || strings.TrimSpace(string(b)) != "inactive" {
		return ErrInvalid
	}
	if err != nil {
		var exit *exec.ExitError
		if !errors.As(err, &exit) || exit.ExitCode() != 3 {
			return ErrInvalid
		}
	}
	return nil
}
func (e *LinuxHostExecutor) Available(ctx context.Context, name string, uid uint32) (bool, error) {
	return e.available(ctx, name, uid)
}
func (e *LinuxHostExecutor) account(ctx context.Context, i ExecutorIdentity) error {
	ok, err := e.available(ctx, i.username, i.uid)
	if err != nil || !ok {
		return ErrInvalid
	}
	if _, err = e.command(ctx, groupadd, "--gid", number(i.uid), "--", i.username); err != nil {
		return ErrInvalid
	}
	if ctx.Err() != nil {
		return ErrInvalid
	}
	// Never let useradd create the home: it is a separate journal phase.
	_, err = e.command(ctx, useradd, "--no-create-home", "--no-user-group", "--gid", number(i.uid), "--uid", number(i.uid), "--home-dir", filepath.Join(homeBase, i.username), "--shell", "/usr/sbin/nologin", "--", i.username)
	if err != nil {
		return ErrInvalid
	}
	return ctx.Err()
}
func (e *LinuxHostExecutor) identity(ctx context.Context, i ExecutorIdentity) error {
	if i.provider != "github" || !numericID(i.id) || !username(i.username) || i.uid < 1000 || i.uid > 60000 || e == nil || e.GatewayUID == 0 || e.GatewayGID == 0 || i.uid == e.GatewayUID || i.uid == e.GatewayGID {
		return ErrInvalid
	}
	u, ok, err := e.lookup(ctx, "passwd", i.username)
	if err != nil || !ok {
		return ErrInvalid
	}
	parts := strings.Split(u, ":")
	if len(parts) != 7 || parts[0] != i.username || parts[2] != number(i.uid) || parts[3] != number(i.uid) || parts[5] != filepath.Join(homeBase, i.username) || parts[6] != "/usr/sbin/nologin" {
		return ErrInvalid
	}
	byID, ok, err := e.lookup(ctx, "passwd", number(i.uid))
	if err != nil || !ok || byID != u {
		return ErrInvalid
	}
	g, ok, err := e.lookup(ctx, "group", i.username)
	if err != nil || !ok {
		return ErrInvalid
	}
	fields := strings.Split(g, ":")
	if len(fields) != 4 || fields[0] != i.username || fields[2] != number(i.uid) || fields[3] != "" {
		return ErrInvalid
	}
	byID, ok, err = e.lookup(ctx, "group", number(i.uid))
	if err != nil || !ok || byID != g {
		return ErrInvalid
	}
	return e.noSupplementaryGroups(ctx, i.username)
}
func (e *LinuxHostExecutor) config(i ExecutorIdentity) ([]byte, error) {
	if e.GatewayUID == 0 || e.GatewayGID == 0 || uint64(i.uid) > uint64(^uint(0)>>1) {
		return nil, ErrInvalid
	}
	return json.Marshal(struct {
		Component string           `json:"component"`
		Handoff   transport.Config `json:"handoff"`
	}{"daemon", transport.Config{GatewayUID: int(e.GatewayUID), UID: int(i.uid), Username: i.username, Home: filepath.Join(homeBase, i.username), Socket: socketFor(i.username), Provider: i.provider, Subject: i.id, BindingFile: filepath.Join(configBase, "daemon-"+i.username+".json")}})
}
func (e *LinuxHostExecutor) Step(ctx context.Context, phase string, i ExecutorIdentity) error {
	if ctx == nil || ctx.Err() != nil || e == nil || !username(i.username) || !numericID(i.id) || i.provider != "github" || i.uid < 1000 || i.uid > 60000 || e.GatewayUID == 0 || e.GatewayGID == 0 || i.uid == e.GatewayUID || i.uid == e.GatewayGID || os.Geteuid() != 0 {
		return ErrInvalid
	}
	if phase == "account" {
		return e.account(ctx, i)
	}
	if err := e.identity(ctx, i); err != nil {
		return err
	}
	switch phase {
	case "home":
		p := filepath.Join(homeBase, i.username)
		if safeParents(p) != nil {
			return ErrInvalid
		}
		absent, err := missing(p)
		if err != nil || !absent {
			return ErrInvalid
		}
		if err = os.Mkdir(p, 0700); err != nil {
			return err
		}
		if err = os.Chown(p, int(i.uid), int(i.uid)); err != nil {
			return err
		}
		if err := owner(p, i.uid, i.uid, 0700, true); err != nil {
			return err
		}
		return ensureSource(p, i.uid)
	case "config":
		p := filepath.Join(configBase, "daemon-"+i.username+".json")
		if configParentPolicy(configBase, statNoFollow) != nil || bindingDirACL(configBase) != nil || owner(filepath.Join(homeBase, i.username), i.uid, i.uid, 0700, true) != nil {
			return ErrInvalid
		}
		b, err := e.config(i)
		if err != nil {
			return err
		}
		f, err := os.OpenFile(p, os.O_WRONLY|os.O_CREATE|os.O_EXCL|syscall.O_NOFOLLOW, 0600)
		if err != nil {
			return err
		}
		// Even if the directory changed since preflight, no inherited ACL may
		// become readable when chmod widens the group/mask bit below.
		if _, aclErr := unix.Fgetxattr(int(f.Fd()), "system.posix_acl_access", nil); aclErr != unix.ENODATA {
			_ = f.Close()
			return ErrInvalid
		}
		if err = f.Chown(0, int(i.uid)); err != nil {
			_ = f.Close()
			return err
		}
		if err = f.Chmod(0640); err != nil {
			_ = f.Close()
			return err
		}
		_, err = f.Write(b)
		if err == nil {
			err = f.Sync()
		}
		closeErr := f.Close()
		if err != nil {
			return err
		}
		if closeErr != nil {
			return closeErr
		}
		if bindingOwner(p, i.uid) != nil {
			return ErrInvalid
		}
		d, err := os.OpenFile(configBase, os.O_RDONLY|syscall.O_DIRECTORY|syscall.O_NOFOLLOW, 0)
		if err != nil {
			return err
		}
		err = d.Sync()
		_ = d.Close()
		return err
	case "socket":
		return e.prepareSocket(ctx, i)
	case "unit":
		return e.unit(ctx, i, false)
	default:
		return ErrInvalid
	}
}
func (e *LinuxHostExecutor) prepareSocket(ctx context.Context, i ExecutorIdentity) error {
	if safeParents(socketBase) != nil || owner(socketBase, 0, e.GatewayGID, 0710, true) != nil || e.parentACL(ctx, 0) != nil || e.runtimeACL(ctx, 0) != nil {
		return ErrInvalid
	}
	p := filepath.Join(socketBase, i.username)
	absent, err := missing(p)
	if err != nil || !absent || e.GatewayUID == i.uid {
		return ErrInvalid
	}
	if _, err := e.command(ctx, setfacl, "-n", "-m", "u:"+number(i.uid)+":--x,m::r-x", "/run/open-habitat"); err != nil || e.runtimeACL(ctx, i.uid) != nil {
		return ErrInvalid
	}
	if _, err := e.command(ctx, setfacl, "-m", "u:"+number(i.uid)+":--x", socketBase); err != nil {
		return ErrInvalid
	}
	if err = os.Mkdir(p, 0700); err != nil {
		return err
	}
	// Named search ACLs are not inherited implicitly across a reboot.
	for _, id := range []uint32{e.GatewayUID, i.uid} {
		if _, err = e.command(ctx, setfacl, "-m", "u:"+number(id)+":--x", p); err != nil {
			return ErrInvalid
		}
	}
	return e.socket(ctx, i)
}
func (e *LinuxHostExecutor) runtimeACL(ctx context.Context, uid uint32) error {
	p := "/run/open-habitat"
	if owner(p, 0, e.GatewayGID, 0750, true) != nil {
		return ErrInvalid
	}
	b, err := e.command(ctx, getfacl, "-cpn", p)
	if err != nil {
		return ErrInvalid
	}
	seen := map[string]bool{}
	found := false
	mask := false
	for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
		if seen[line] {
			return ErrInvalid
		}
		seen[line] = true
		if line == "mask::r-x" {
			mask = true
			continue
		}
		if line == "user::rwx" || line == "group::r-x" || line == "other::---" {
			continue
		}
		id, ok := strings.CutPrefix(line, "user:")
		if !ok || !strings.HasSuffix(id, ":--x") {
			return ErrInvalid
		}
		id = strings.TrimSuffix(id, ":--x")
		n, parseErr := strconv.ParseUint(id, 10, 32)
		if parseErr != nil || number(uint32(n)) != id || n < 1000 || n > 60000 || n == uint64(e.GatewayUID) {
			return ErrInvalid
		}
		if n == uint64(uid) {
			found = true
		}
	}
	if !seen["user::rwx"] || !seen["group::r-x"] || !seen["other::---"] || (len(seen) > 3 && !mask) || (uid != 0 && !found) {
		return ErrInvalid
	}
	return nil
}
func (e *LinuxHostExecutor) parentACL(ctx context.Context, uid uint32) error {
	b, err := e.command(ctx, getfacl, "-cpn", socketBase)
	if err != nil {
		return ErrInvalid
	}
	// Deployment prepares the gateway search ACL on the common parent.
	want := map[string]bool{"user::rwx": false, "group::--x": false, "other::---": false}
	seenUID := map[uint64]bool{}
	mask := false
	for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
		if line == "mask::--x" {
			if mask {
				return ErrInvalid
			}
			mask = true
			continue
		}
		if _, ok := want[line]; ok {
			if want[line] {
				return ErrInvalid
			}
			want[line] = true
			continue
		}
		// Other accounts may have search permission on this shared parent,
		// but cannot enter a per-user directory without its exact named ACL.
		part, ok := strings.CutPrefix(line, "user:")
		if !ok {
			return ErrInvalid
		}
		id, ok := strings.CutSuffix(part, ":--x")
		if !ok || !numericID(id) {
			return ErrInvalid
		}
		n, err := strconv.ParseUint(id, 10, 32)
		if err != nil || n < 1000 || n > 60000 || n == uint64(e.GatewayUID) || seenUID[n] {
			return ErrInvalid
		}
		seenUID[n] = true
		if uid != 0 && n == uint64(uid) {
			uid = 0
		}
	}
	if uid != 0 {
		return ErrInvalid
	}
	for _, seen := range want {
		if !seen {
			return ErrInvalid
		}
	}
	return nil
}
func (e *LinuxHostExecutor) socket(ctx context.Context, i ExecutorIdentity) error {
	p := filepath.Join(socketBase, i.username)
	if safeParents(p) != nil || e.runtimeACL(ctx, i.uid) != nil || owner(socketBase, 0, e.GatewayGID, 0710, true) != nil || e.parentACL(ctx, i.uid) != nil || owner(p, 0, 0, 0710, true) != nil {
		return ErrInvalid
	}
	var sock unix.Stat_t
	err := unix.Fstatat(unix.AT_FDCWD, socketFor(i.username), &sock, unix.AT_SYMLINK_NOFOLLOW)
	if err != nil && err != unix.ENOENT {
		return ErrInvalid
	}
	if err == nil && (sock.Mode&unix.S_IFMT != unix.S_IFSOCK || sock.Uid != i.uid || sock.Gid != e.GatewayGID || sock.Mode&07777 != 0660) {
		return ErrInvalid
	}
	b, err := e.command(ctx, getfacl, "-cpn", p)
	if err != nil {
		return ErrInvalid
	}
	expected := map[string]bool{"user::rwx": false, "user:" + number(i.uid) + ":--x": false, "user:" + number(e.GatewayUID) + ":--x": false, "group::---": false, "mask::--x": false, "other::---": false}
	// If the gateway and daemon UIDs coincide, reject rather than weaken the
	// separation of the two security principals.
	if e.GatewayUID == i.uid {
		return ErrInvalid
	}
	for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
		if _, ok := expected[line]; !ok || expected[line] {
			return ErrInvalid
		}
		expected[line] = true
	}
	for _, seen := range expected {
		if !seen {
			return ErrInvalid
		}
	}
	return ctx.Err()
}

// properties rejects duplicate, missing and conflicting effective settings.
func properties(output []byte, expected map[string]string) bool {
	seen := make(map[string]bool, len(expected))
	for _, line := range strings.Split(strings.TrimSpace(string(output)), "\n") {
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			return false
		}
		if want, present := expected[key]; present {
			if seen[key] || value != want {
				return false
			}
			seen[key] = true
		}
	}
	return len(seen) == len(expected)
}
func singleUnixListener(output []byte, path string) bool {
	return string(output) == "Listen="+path+" (Stream)\n"
}
func (e *LinuxHostExecutor) unit(ctx context.Context, i ExecutorIdentity, retry bool) error {
	// No start or enable: merely ensure both templates are installed and
	// inactive, and explicitly verify the socket's restrictive DirectoryMode.
	for _, unit := range []string{"open-habitat-daemon@" + i.username + ".socket", "open-habitat-daemon@" + i.username + ".service"} {
		b, err := e.command(ctx, systemctl, "show", unit, "--property=LoadState,ActiveState,FragmentPath", "--no-pager")
		failedSocket := retry && strings.HasSuffix(unit, ".socket") && strings.Contains(string(b), "ActiveState=failed\n")
		if err != nil || !strings.Contains(string(b), "LoadState=loaded\n") || (!strings.Contains(string(b), "ActiveState=inactive\n") && !strings.Contains(string(b), "ActiveState=active\n") && !failedSocket) || !strings.Contains(string(b), "FragmentPath=/") {
			return ErrInvalid
		}
	}
	service := "open-habitat-daemon@" + i.username + ".service"
	effective, err := e.command(ctx, systemctl, "show", service, "--property=User,Group,SupplementaryGroups,NoNewPrivileges,ExecStart", "--no-pager")
	if err != nil || !properties(effective, map[string]string{"User": i.username, "Group": i.username, "SupplementaryGroups": "", "NoNewPrivileges": "yes"}) || !strings.Contains(string(effective), "/opt/open-habitat/current/open-habitat") || !strings.Contains(string(effective), "--config "+filepath.Join(configBase, "daemon-"+i.username+".json")) {
		return ErrInvalid
	}
	// Inspect effective socket properties too: systemctl cat includes the base
	// template even when an instance drop-in overrides its permissions.
	socketUnit := "open-habitat-daemon@" + i.username + ".socket"
	effective, err = e.command(ctx, systemctl, "show", socketUnit, "--property=SocketMode,DirectoryMode,SocketUser,SocketGroup,RemoveOnStop", "--no-pager")
	if err != nil || !properties(effective, map[string]string{"SocketMode": "0660", "DirectoryMode": "0710", "SocketUser": i.username, "SocketGroup": "open-habitat-gateway", "RemoveOnStop": "yes"}) {
		return ErrInvalid
	}
	g, ok, err := e.lookup(ctx, "group", "open-habitat-gateway")
	if err != nil || !ok {
		return ErrInvalid
	}
	gp := strings.Split(g, ":")
	if len(gp) != 4 || gp[0] != "open-habitat-gateway" || gp[2] != number(e.GatewayGID) {
		return ErrInvalid
	}
	// Listen is an effective, repeatable systemd socket property. Textual
	// template checks alone miss drop-ins with whitespace around '=' that
	// reset ListenStream and replace the Unix socket with a TCP listener.
	listen, err := e.command(ctx, systemctl, "show", socketUnit, "--property=Listen", "--no-pager")
	if err != nil || !singleUnixListener(listen, socketFor(i.username)) {
		return ErrInvalid
	}
	b, err := e.command(ctx, systemctl, "cat", socketUnit, "--no-pager")
	if err != nil {
		return ErrInvalid
	}
	for _, directive := range []string{
		"ListenStream=/run/open-habitat/users/%i/daemon.sock", "SocketMode=0660", "SocketUser=%i",
		"SocketGroup=open-habitat-gateway", "DirectoryMode=0710", "RemoveOnStop=yes",
	} {
		if strings.Count(string(b), "\n"+directive+"\n") != 1 {
			return ErrInvalid
		}
	}
	// An override or duplicate Socket directive could undo the verified ACL
	// and directory mode despite the base template containing the safe values.
	for _, line := range strings.Split(string(b), "\n") {
		if strings.HasPrefix(line, "ListenStream=") || strings.HasPrefix(line, "SocketMode=") || strings.HasPrefix(line, "SocketUser=") || strings.HasPrefix(line, "SocketGroup=") || strings.HasPrefix(line, "DirectoryMode=") || strings.HasPrefix(line, "RemoveOnStop=") {
			valid := false
			for _, directive := range []string{"ListenStream=/run/open-habitat/users/%i/daemon.sock", "SocketMode=0660", "SocketUser=%i", "SocketGroup=open-habitat-gateway", "DirectoryMode=0710", "RemoveOnStop=yes"} {
				if line == directive {
					valid = true
					break
				}
			}
			if !valid {
				return ErrInvalid
			}
		}
	}
	return ctx.Err()
}

// The systemd job can outlive a timed-out or cancelled systemctl client.
// Callers must not start another sibling socket until an operator resolves it.
var errActivationUncertain = errors.New("socket activation outcome uncertain")

// Ready is broker-only. Fleetrepo's systemd dependency performs its own
// activation-phase policy check; the broker must not bypass that gate with a
// direct daemon service start or an enable operation. Never repair drift.
func (e *LinuxHostExecutor) Ready(ctx context.Context, i ExecutorIdentity) error {
	if os.Geteuid() != 0 || ctx == nil || ctx.Err() != nil || e.Verify(ctx, i) != nil {
		return ErrInvalid
	}
	unit := "open-habitat-daemon@" + i.username + ".socket"
	b, err := e.command(ctx, systemctl, "show", unit, "--property=ActiveState", "--no-pager")
	if err != nil {
		return ErrInvalid
	}
	if string(b) == "ActiveState=active\n" {
		// Existing manually prepared static bindings and already-gated JIT
		// sockets do not need a second start. Never accept an active unit
		// unless its actual inode, UID and ACL still match the binding.
		return e.RouteReady(ctx, i)
	}
	if string(b) != "ActiveState=inactive\n" && string(b) != "ActiveState=failed\n" && string(b) != "ActiveState=activating\n" {
		return ErrInvalid
	}
	gate := "open-habitat-jit-policy-gate@" + i.username + ".service"
	b, err = e.command(ctx, systemctl, "show", unit, "--property=Requires,After", "--no-pager")
	if err != nil || !unitDependency(b, "Requires", gate) || !unitDependency(b, "After", gate) {
		return ErrInvalid
	}
	b, err = e.command(ctx, systemctl, "show", gate, "--property=LoadState,ExecStart,User,Type,RemainAfterExit,ExecStartPre,ExecStartPost,ExecCondition,ExecReload,ExecStop,ExecStopPost", "--no-pager")
	if err != nil || !gateProperties(b) || !exactGateExec(b, i.username) {
		return ErrInvalid
	}
	// A failed gate can leave a failed socket unit. A later explicit
	// ensure may retry it, but no route is returned until it is active.
	if err := e.startSocket(ctx, unit); err != nil {
		return err
	}
	if e.Verify(ctx, i) != nil {
		return ErrInvalid
	}
	return e.RouteReady(ctx, i)
}

// Once submitted, a systemd job can outlive the caller's exchange deadline.
// Keep the activation slot until this one start has a known outcome (or its
// own bound expires). All checks before and after the submission still honor
// the caller's context and no route can be returned after cancellation.
func (e *LinuxHostExecutor) startSocket(ctx context.Context, unit string) error {
	if ctx == nil || ctx.Err() != nil {
		return ErrInvalid
	}
	startCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 45*time.Second)
	defer cancel()
	if ctx.Err() != nil { // cancellation before submission submits no job
		return ErrInvalid
	}
	_, err := e.command(startCtx, systemctl, "start", unit)
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return errActivationUncertain
	}
	if err != nil {
		return ErrInvalid
	}
	return nil
}

// RouteReady does not start a unit: authorize must fit the short exchange
// budget and cannot mutate host state. Verify checks the directory ACLs.
func (e *LinuxHostExecutor) RouteReady(ctx context.Context, i ExecutorIdentity) error {
	if ctx == nil || ctx.Err() != nil || e == nil || e.GatewayUID == 0 || e.GatewayGID == 0 || !username(i.username) || i.uid < 1000 || i.uid > 60000 {
		return ErrInvalid
	}
	b, err := e.command(ctx, systemctl, "is-active", "open-habitat-daemon@"+i.username+".socket")
	if err != nil || strings.TrimSpace(string(b)) != "active" {
		return ErrInvalid
	}
	var st unix.Stat_t
	if unix.Lstat(socketFor(i.username), &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFSOCK || st.Uid != i.uid || st.Gid != e.GatewayGID || st.Mode&07777 != 0660 {
		return ErrInvalid
	}
	return ctx.Err()
}

func unitDependency(b []byte, key, name string) bool {
	for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
		if value, ok := strings.CutPrefix(line, key+"="); ok {
			for _, field := range strings.Fields(value) {
				if field == name {
					return true
				}
			}
		}
	}
	return false
}

// systemctl show omits empty Exec* properties on the pinned guest systemd.
// A nonempty extra command or a non-blocking gate type must fail closed.
func gateProperties(b []byte) bool {
	if !properties(b, map[string]string{"LoadState": "loaded", "User": "root", "Type": "oneshot", "RemainAfterExit": "no"}) {
		return false
	}
	allowed := map[string]bool{"LoadState": true, "User": true, "Type": true, "RemainAfterExit": true, "ExecStart": true,
		"ExecStartPre": true, "ExecStartPost": true, "ExecCondition": true, "ExecReload": true, "ExecStop": true, "ExecStopPost": true}
	for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
		key, value, ok := strings.Cut(line, "=")
		if !ok || !allowed[key] {
			return false
		} // no hidden continuation lines
		switch key {
		case "ExecStartPre", "ExecStartPost", "ExecCondition", "ExecReload", "ExecStop", "ExecStopPost":
			if value != "" {
				return false
			}
		}
	}
	return true
}

// systemctl show renders ExecStart as a single structured line. Do not accept
// extra arguments (especially --root), extra commands or an alternate binary.
func exactGateExec(b []byte, name string) bool {
	want := "ExecStart={ path=/usr/bin/python3 ; argv[]=/usr/bin/python3 /usr/local/libexec/open-habitat-test-jit/jit_policy.py verify --phase activation --target daemon:" + name + " --json ;"
	count := 0
	for _, line := range strings.Split(string(b), "\n") {
		if strings.HasPrefix(line, "ExecStart=") {
			count++
			if !strings.HasPrefix(line, want) || strings.Count(line, "argv[]=") != 1 || !strings.Contains(line, "ignore_errors=no") || strings.Count(line, "{ path=") != 1 {
				return false
			}
		}
	}
	return count == 1
}

func (e *LinuxHostExecutor) Verify(ctx context.Context, i ExecutorIdentity) error {
	if ctx == nil || ctx.Err() != nil || e == nil || e.GatewayUID == 0 || e.GatewayGID == 0 {
		return ErrInvalid
	}
	if err := e.identity(ctx, i); err != nil {
		return err
	}
	if err := safeParents(filepath.Join(homeBase, i.username)); err != nil {
		return err
	}
	// src belongs to the user's workspace after provisioning. Rechecking it
	// here would block authorization before the daemon can report a later
	// disappearance or permissions error as a source error.
	if err := owner(filepath.Join(homeBase, i.username), i.uid, i.uid, 0700, true); err != nil {
		return err
	}
	p := filepath.Join(configBase, "daemon-"+i.username+".json")
	if configParentPolicy(configBase, statNoFollow) != nil || bindingDirACL(configBase) != nil || bindingOwner(p, i.uid) != nil {
		return ErrInvalid
	}
	want, err := e.config(i)
	if err != nil {
		return err
	}
	got, err := os.ReadFile(p)
	if err != nil || !bytes.Equal(got, want) {
		return fmt.Errorf("%w: daemon binding config", ErrInvalid)
	}
	if err := e.socket(ctx, i); err != nil {
		return err
	}
	return e.unit(ctx, i, true)
}
