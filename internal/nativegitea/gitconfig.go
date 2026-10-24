package nativegitea

import (
	"bytes"
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"
)

// HelperArgs follow the executable in the registered helper command; Git
// appends get, store or erase.
const HelperArgs = "gitea git-credential"

var safeExecutable = regexp.MustCompile(`^(/[A-Za-z0-9._+-]+)+$`)

// HelperCommand is the Git helper value for an installed executable. Git
// runs an absolute helper through the shell, so the path is limited to
// characters that need no quoting.
func HelperCommand(executable string) (string, error) {
	if len(executable) > 1024 || !safeExecutable.MatchString(executable) || filepath.Clean(executable) != executable {
		return "", ErrHelperConflict
	}
	st, err := os.Stat(executable)
	if err != nil || !st.Mode().IsRegular() || st.Mode().Perm()&0o111 == 0 {
		return "", ErrHelperConflict
	}
	return executable + " " + HelperArgs, nil
}

// GitConfig edits the person's global Git configuration through Git itself,
// which owns that format, its includes and its lock. It writes only settings
// scoped to one Gitea base and never a secret.
type GitConfig struct {
	Home, ConfigHome string
	// Git is the Git executable; "" is /usr/bin/git.
	Git string
}

const gitTimeout = 10 * time.Second

var errAbsent = errors.New("absent")

func (g GitConfig) run(ctx context.Context, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, gitTimeout)
	defer cancel()
	program := g.Git
	if program == "" {
		program = "/usr/bin/git"
	}
	cmd := exec.CommandContext(ctx, program, args...)
	cmd.Dir = g.Home
	// No inherited environment: no GIT_CONFIG_* redirection, no prompt.
	cmd.Env = []string{"HOME=" + g.Home, "XDG_CONFIG_HOME=" + g.ConfigHome, "PATH=/usr/bin:/bin", "LC_ALL=C", "GIT_TERMINAL_PROMPT=0", "GIT_CONFIG_NOSYSTEM=1"}
	var out bytes.Buffer
	cmd.Stdout = &out
	err := cmd.Run()
	var exit *exec.ExitError
	switch {
	case err == nil:
		return out.Bytes(), nil
	case errors.As(err, &exit) && exit.ExitCode() == 1 && (args[1] == "--get-all" || args[1] == "--get-regexp"):
		return nil, errAbsent
	case errors.As(err, &exit) && exit.ExitCode() == 5:
		return nil, errAbsent
	}
	return nil, ErrGit
}

func (g GitConfig) values(ctx context.Context, key string) ([]string, error) {
	// Git loads included files during credential operations; so must we.
	out, err := g.run(ctx, "config", "--get-all", "--global", "--includes", key)
	if errors.Is(err, errAbsent) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return strings.Split(strings.TrimSuffix(string(out), "\n"), "\n"), nil
}

type helperKeys struct{ helper, useHTTPPath, followRedirects string }

func keysFor(b Base) helperKeys {
	s := b.String()
	return helperKeys{"credential." + s + ".helper", "credential." + s + ".useHttpPath", "http." + s + ".followRedirects"}
}

// HelperState reports whether b's scope holds exactly the registration
// Register writes for executable.
type HelperState string

const (
	HelperRegistered HelperState = "registered"
	HelperAbsent     HelperState = "absent"
	// HelperForeign: something else is configured in that scope.
	HelperForeign HelperState = "foreign"
	// HelperShadowed: our values are in place, but Git applies helpers in
	// configuration order and a later helper entry that may match this base
	// would also be asked, and could store a second copy.
	HelperShadowed HelperState = "shadowed"
)

type helperEntry struct{ scope, value string }

// helperEntries lists every global credential helper value in file order.
func (g GitConfig) helperEntries(ctx context.Context) ([]helperEntry, error) {
	out, err := g.run(ctx, "config", "--get-regexp", "--global", "--includes", "--null", `^credential\.(.*\.)?helper$`)
	if errors.Is(err, errAbsent) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var es []helperEntry
	for _, rec := range strings.Split(strings.TrimSuffix(string(out), "\x00"), "\x00") {
		key, value, _ := strings.Cut(rec, "\n")
		scope := strings.TrimSuffix(strings.TrimPrefix(key, "credential."), "helper")
		es = append(es, helperEntry{strings.TrimSuffix(scope, "."), value})
	}
	return es, nil
}

// mayApply reports whether Git could apply a helper configured for scope to
// requests under b. Anything that is not plainly another protocol, host or
// port counts.
func mayApply(scope string, b Base) bool {
	i := strings.Index(scope, "://")
	if scope == "" || i < 0 {
		return true
	}
	if !strings.EqualFold(scope[:i], "https") {
		return false
	}
	hostport := scope[i+3:]
	if j := strings.IndexByte(hostport, '/'); j >= 0 {
		hostport = hostport[:j]
	}
	if k := strings.LastIndexByte(hostport, '@'); k >= 0 {
		hostport = hostport[k+1:]
	}
	host, port, ok := parseAuthority(hostport)
	return !ok || strings.Contains(hostport, "*") || host == b.Host && port == b.Port
}

// shadowed: after our scope's last chain reset, Git would also ask a helper
// other than ours, or a later applicable reset drops ours from the chain. A
// reset followed again by our command (another of our base registrations)
// leaves ours in place.
func shadowed(es []helperEntry, b Base, command string) bool {
	reset := -1
	for i, e := range es {
		if e.scope == b.String() && e.value == "" {
			reset = i
		}
	}
	ours := false
	for _, e := range es[reset+1:] {
		switch {
		case !mayApply(e.scope, b):
		case e.value == command:
			ours = true
		case e.value == "":
			ours = false
		default:
			return true
		}
	}
	return !ours
}

func (g GitConfig) state(ctx context.Context, b Base, command string) (HelperState, [3][]string, error) {
	k := keysFor(b)
	var v [3][]string
	var err error
	for i, key := range []string{k.helper, k.useHTTPPath, k.followRedirects} {
		if v[i], err = g.values(ctx, key); err != nil {
			return "", v, err
		}
	}
	if len(v[0]) == 0 && len(v[1]) == 0 && len(v[2]) == 0 {
		return HelperAbsent, v, nil
	}
	if slices.Equal(v[0], []string{"", command}) && slices.Equal(v[1], []string{"true"}) && slices.Equal(v[2], []string{"false"}) {
		es, err := g.helperEntries(ctx)
		if err != nil {
			return "", v, err
		}
		if shadowed(es, b, command) {
			return HelperShadowed, v, nil
		}
		return HelperRegistered, v, nil
	}
	return HelperForeign, v, nil
}

// State observes the registration for b.
func (g GitConfig) State(ctx context.Context, b Base, executable string) (HelperState, error) {
	command, err := HelperCommand(executable)
	if err != nil {
		return "", err
	}
	st, _, err := g.state(ctx, b, command)
	return st, err
}

// Register scopes the helper to b: an empty value first resets any helper
// chain inherited for that URL (so no other helper is asked or stores a
// copy), then the absolute helper; useHttpPath so the helper sees the base
// path; and no HTTP redirects. github.com and every other scope are left
// alone. Anything foreign already in these keys is refused, not overwritten;
// a partial earlier registration is completed (explicit repair). A shadowed
// registration is moved after the later entries: Git drops a section whose
// last key is unset and appends re-added keys at the end of the file. When a
// foreign key keeps our section in place, the move cannot happen and the
// registration is refused as ErrHelperConflict.
func (g GitConfig) Register(ctx context.Context, b Base, executable string) error {
	if !b.valid() {
		return ErrInvalidAddress
	}
	command, err := HelperCommand(executable)
	if err != nil {
		return err
	}
	st, v, err := g.state(ctx, b, command)
	if err != nil || st == HelperRegistered {
		return err
	}
	if !onlyOurs(v[0], "", command) || !onlyOurs(v[1], "true") || !onlyOurs(v[2], "false") {
		return ErrHelperConflict
	}
	// Our values, complete, partial or shadowed, are removed by exact value
	// and written again together, after every other helper entry.
	if err := g.unset(ctx, b, command); err != nil {
		return err
	}
	k := keysFor(b)
	for _, kv := range [][2]string{{k.helper, ""}, {k.helper, command}, {k.useHTTPPath, "true"}, {k.followRedirects, "false"}} {
		if _, err := g.run(ctx, "config", "--global", "--add", kv[0], kv[1]); err != nil {
			return err
		}
	}
	if st, _, err = g.state(ctx, b, command); err != nil {
		return err
	}
	if st != HelperRegistered {
		return ErrHelperConflict
	}
	return nil
}

// onlyOurs: every value is one of ours, each at most once.
func onlyOurs(values []string, ours ...string) bool {
	seen := map[string]bool{}
	for _, v := range values {
		if seen[v] || !slices.Contains(ours, v) {
			return false
		}
		seen[v] = true
	}
	return true
}

// Unregister removes b's registration only while it is still exactly what
// Register wrote for executable; anything else in that scope is left as it
// is and reported as ErrHelperConflict. Each removal matches its exact value.
func (g GitConfig) Unregister(ctx context.Context, b Base, executable string) error {
	command, err := HelperCommand(executable)
	if err != nil {
		return err
	}
	st, _, err := g.state(ctx, b, command)
	if err != nil || st == HelperAbsent {
		return err
	}
	if st != HelperRegistered && st != HelperShadowed {
		return ErrHelperConflict
	}
	return g.unset(ctx, b, command)
}

func (g GitConfig) unset(ctx context.Context, b Base, command string) error {
	k := keysFor(b)
	for _, kv := range [][2]string{{k.helper, command}, {k.helper, ""}, {k.useHTTPPath, "true"}, {k.followRedirects, "false"}} {
		if _, err := g.run(ctx, "config", "--global", "--fixed-value", "--unset-all", kv[0], kv[1]); err != nil && !errors.Is(err, errAbsent) {
			return err
		}
	}
	return nil
}
