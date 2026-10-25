//go:build linux

package provision

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"golang.org/x/sys/unix"
)

// Every account the broker creates has no login shell, so the browser is the
// only way in. Root may declare, through the site's identities.login_shell
// and host apply, that some operator-admitted people get one, so that SSH
// reaches the same Unix user as the browser. The broker never chooses this
// itself and no request can ask for it: the declaration arrives only as this
// root-written file, and verification then accepts exactly the declared shell
// for those accounts and nologin for every other.
const (
	loginShellState = "login_shells.json"
	nologin         = "/usr/sbin/nologin"
	usermod         = "/usr/sbin/usermod"
)

// MaxLoginShellSubjects matches the site's admission bound: a declared
// subject must also be operator-admitted.
const MaxLoginShellSubjects = 128

type loginShellFile struct {
	Version  int      `json:"version"`
	Shell    string   `json:"shell"`
	Subjects []string `json:"subjects"`
}

func (f loginShellFile) valid() bool {
	if f.Version != 1 || f.Subjects == nil || len(f.Subjects) > MaxLoginShellSubjects || (f.Shell == "") != (len(f.Subjects) == 0) || (f.Shell != "" && !ValidLoginShell(f.Shell)) {
		return false
	}
	return slices.IsSorted(f.Subjects) && validAdmission(f.Subjects)
}

// shellFor is the passwd shell the account of subject id must have.
func (f loginShellFile) shellFor(id string) string {
	if slices.Contains(f.Subjects, id) {
		return f.Shell
	}
	return nologin
}

func parseLoginShells(b []byte) (loginShellFile, error) {
	var f loginShellFile
	if decode(b, &f, "version", "shell", "subjects") != nil || !f.valid() {
		return loginShellFile{}, ErrInvalid
	}
	return f, nil
}

// Absent means host apply has not published a declaration: no login shells,
// as every installation before this file existed.
func readLoginShellsAt(fd int, owner uint32) (loginShellFile, error) {
	if absent(fd, loginShellState) {
		return loginShellFile{Version: 1, Subjects: []string{}}, nil
	}
	b, e := readAt(fd, loginShellState, owner)
	if e != nil {
		return loginShellFile{}, e
	}
	return parseLoginShells(b)
}

// readLoginShells reads without the broker lock: the file is only ever
// replaced by rename under that lock, so an unlocked reader sees a whole
// declaration, old or new. Verification runs inside ledger transactions that
// already hold the lock and keep their pending journal, so it neither takes
// the lock again nor refuses that journal as secureFile does.
func readLoginShells(dir string, owner uint32) (loginShellFile, error) {
	fd, e := privateDir(dir, owner)
	if e != nil {
		return loginShellFile{}, ErrInvalid
	}
	defer unix.Close(fd)
	return readLoginShellsAt(fd, owner)
}

// usableShell checks the host side of a declaration before any account is
// changed: the shell is one /etc/shells lists, and it resolves to a root-owned
// executable nobody else can replace. sshd and PAM consult /etc/shells too.
func usableShell(shell string) error {
	f, e := os.OpenFile("/etc/shells", os.O_RDONLY|unix.O_NOFOLLOW, 0)
	if e != nil {
		return ErrInvalid
	}
	defer f.Close()
	var st unix.Stat_t
	if unix.Fstat(int(f.Fd()), &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Uid != 0 || st.Mode&0022 != 0 || st.Size > 64<<10 || safeParents("/etc/shells") != nil {
		return ErrInvalid
	}
	b := make([]byte, st.Size+1)
	n, _ := f.ReadAt(b, 0)
	if int64(n) != st.Size {
		return ErrInvalid
	}
	listed := false
	for _, line := range strings.Split(string(b[:n]), "\n") {
		if strings.TrimSpace(line) == shell {
			listed = true
		}
	}
	if !listed {
		return ErrInvalid
	}
	return trustedPath(shell, 0)
}

// trustedPath requires every component of path, and of each link it passes
// through, to be root's and writable by nobody else, and the end to be a
// regular executable. Ubuntu's /bin -> usr/bin passes; a link or directory
// another user could replace after apply does not, since passwd keeps the
// declared path, not the file it reached today.
func trustedPath(path string, depth int) error {
	if depth > 8 || !filepath.IsAbs(path) || filepath.Clean(path) != path {
		return ErrInvalid
	}
	parts := strings.Split(strings.TrimPrefix(path, "/"), "/")
	cur := "/"
	for i, part := range parts {
		next := filepath.Join(cur, part)
		var st unix.Stat_t
		if unix.Lstat(cur, &st) != nil || st.Mode&unix.S_IFMT != unix.S_IFDIR || st.Uid != 0 || st.Mode&0022 != 0 {
			return ErrInvalid
		}
		if unix.Lstat(next, &st) != nil || st.Uid != 0 {
			return ErrInvalid
		}
		if st.Mode&unix.S_IFMT == unix.S_IFLNK {
			// Lexical joining equals the kernel's walk only without "..".
			target, e := os.Readlink(next)
			if e != nil || slices.Contains(strings.Split(target, "/"), "..") {
				return ErrInvalid
			}
			if !filepath.IsAbs(target) {
				target = filepath.Join(cur, target)
			}
			rest := filepath.Join(append([]string{filepath.Clean(target)}, parts[i+1:]...)...)
			return trustedPath(rest, depth+1)
		}
		if i == len(parts)-1 {
			if st.Mode&unix.S_IFMT != unix.S_IFREG || st.Mode&0022 != 0 || st.Mode&0111 == 0 {
				return ErrInvalid
			}
			return nil
		}
		cur = next
	}
	return ErrInvalid
}

// PublishLoginShells records root's identities.login_shell declaration and
// moves every committed account to the shell it now must have: the declared
// shell for a declared subject, nologin for every other. Host apply calls it
// while holding the host operation lock with entries closed; the broker lock
// held here keeps provisioning from interleaving. The file is written before
// any account changes, so an interrupted run leaves accounts the broker
// refuses until a retry finishes them, never an account it accepts wrongly.
func PublishLoginShells(ctx context.Context, shell string, subjects []string) error {
	if os.Geteuid() != 0 {
		return ErrInvalid
	}
	return publishLoginShells(ctx, brokerState, 0, shell, subjects, usableShell, NewLinuxHostExecutor)
}

func publishLoginShells(ctx context.Context, dir string, owner uint32, shell string, subjects []string, usable func(string) error, executor func(uint32, uint32) *LinuxHostExecutor) error {
	want := loginShellFile{Version: 1, Shell: shell, Subjects: slices.Sorted(slices.Values(subjects))}
	if want.Subjects == nil {
		want.Subjects = []string{}
	}
	if !want.valid() {
		return ErrInvalid
	}
	if shell != "" && usable(shell) != nil {
		return ErrInvalid
	}
	fd, e := lockedDir(ctx, dir, owner)
	if e != nil {
		return e
	}
	defer unix.Close(fd)
	defer unix.Flock(fd, unix.LOCK_UN)
	state, e := installationAt(ctx, fd, owner)
	if e != nil {
		return e
	}
	a, ledger, _, _, e := stateAt(ctx, fd, owner)
	if e != nil {
		return e
	}
	// Only an operator-admitted person may have a login shell. Revocation
	// would close the browser but leave SSH open otherwise.
	for _, id := range want.Subjects {
		if !slices.ContainsFunc(a.IDs, func(x allowed) bool { return x.ID == id }) {
			return ErrInvalid
		}
	}
	current, e := readLoginShellsAt(fd, owner)
	if e != nil {
		return e
	}
	if !slices.Equal(marshal(current), marshal(want)) || absent(fd, loginShellState) {
		if e = unix.Unlinkat(fd, loginShellState+".next", 0); e != nil && e != unix.ENOENT {
			return e
		}
		if e = replace(fd, loginShellState, marshal(want)); e != nil {
			return e
		}
	}
	x := executor(state.Policy.GatewayUID, state.Policy.GatewayGID)
	x.shells = func() (loginShellFile, error) { return want, nil }
	for _, b := range ledger.Bindings {
		i := ExecutorIdentity{provider: "github", id: b.ID, username: b.Username, uid: b.UID}
		if e = x.reconcileShell(ctx, i); e != nil {
			return e
		}
	}
	return nil
}

// LoginShellsPublished reports whether the broker holds exactly this
// declaration and every committed account has the shell it requires.
func LoginShellsPublished(ctx context.Context, shell string, subjects []string) bool {
	if os.Geteuid() != 0 {
		return false
	}
	return loginShellsPublished(ctx, brokerState, 0, shell, subjects, NewLinuxHostExecutor)
}

func loginShellsPublished(ctx context.Context, dir string, owner uint32, shell string, subjects []string, executor func(uint32, uint32) *LinuxHostExecutor) bool {
	want := loginShellFile{Version: 1, Shell: shell, Subjects: slices.Sorted(slices.Values(subjects))}
	if want.Subjects == nil {
		want.Subjects = []string{}
	}
	fd, e := lockedDir(ctx, dir, owner)
	if e != nil {
		return false
	}
	defer unix.Close(fd)
	defer unix.Flock(fd, unix.LOCK_UN)
	if !want.valid() || absent(fd, loginShellState) && shell != "" {
		return false
	}
	current, e := readLoginShellsAt(fd, owner)
	if e != nil || !slices.Equal(marshal(current), marshal(want)) {
		return false
	}
	state, e := installationAt(ctx, fd, owner)
	if e != nil {
		return false
	}
	_, ledger, _, _, e := stateAt(ctx, fd, owner)
	if e != nil {
		return false
	}
	x := executor(state.Policy.GatewayUID, state.Policy.GatewayGID)
	x.shells = func() (loginShellFile, error) { return want, nil }
	for _, b := range ledger.Bindings {
		if x.identity(ctx, ExecutorIdentity{provider: "github", id: b.ID, username: b.Username, uid: b.UID}) != nil {
			return false
		}
	}
	return true
}

// reconcileShell changes only the shell of an account that is otherwise
// exactly the committed identity; anything else stays refused for diagnosis.
func (e *LinuxHostExecutor) reconcileShell(ctx context.Context, i ExecutorIdentity) error {
	want, err := e.loginShell(i.id)
	if err != nil {
		return err
	}
	have, err := e.accountRecord(ctx, i)
	if err != nil {
		return err
	}
	if have != want {
		if _, err = e.command(ctx, usermod, "--shell", want, "--", i.username); err != nil || ctx.Err() != nil {
			return ErrInvalid
		}
	}
	return e.identity(ctx, i)
}
