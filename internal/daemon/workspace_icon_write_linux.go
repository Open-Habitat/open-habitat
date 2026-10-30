//go:build linux

package daemon

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"go.yaml.in/yaml/v3"
	"golang.org/x/sys/unix"
)

// Setting the icon from the workspace page (Otsikko, Jari 2026-10-30) writes
// the `icon` line of the repository's own .open-habitat.yaml and commits that
// file alone, silently: the icon belongs to the repository so that every clone
// shows it, and an uncommitted config would linger or ride along in an
// agent's next commit about something else. Nothing is pushed. Without Git
// the file is only written.
//
// The commit holds exactly the bytes written, through a private index, not
// `git commit --only`: that would take whatever the working tree holds when
// Git reads it, including an agent's edit to the same file in between.

// Fixed refusals; the reply never carries file content or Git's text.
var (
	errIconInvalid     = errors.New("icon_invalid")
	errIconConfig      = errors.New("icon_config_unsupported")
	errIconUnavailable = errors.New("icon_config_unavailable")
)

// How the commit of a written icon went, as the reply's `icon_commit` says.
const (
	iconCommitted     = "committed"     // a commit holding only the config
	iconUnchanged     = "unchanged"     // the config already said this
	iconNotGit        = "not_git"       // a plain directory: only the file
	iconUncommitted   = "uncommitted"   // the config had other changes; left for the person
	iconCommitFailed  = "commit_failed" // Git refused (no identity, HEAD moved, a merge or rebase under way)
	iconCommitMessage = "Työtilan kuvake: %s (open-habitat)"
)

var iconLine = regexp.MustCompile(`^icon[ \t]*:`)

// editIconConfig replaces, or appends, the one top-level `icon:` line and
// keeps every other line and comment as it was; a YAML library would
// rewrite the file and lose them. It refuses a file it cannot edit line by
// line (several icon lines, a multi-line value, not a mapping), proved by
// reading the result back: the other keys unchanged, the icon the one asked.
func editIconConfig(old []byte, value string) ([]byte, error) {
	set := parseIconValue(value)
	if set.Kind == "" || set.Value != value {
		return nil, errIconInvalid
	}
	if !utf8.Valid(old) {
		return nil, errIconConfig
	}
	line := `icon: "` + value + `"`
	if set.Kind == "auto" {
		line = "icon: auto"
	}
	newline := "\n"
	if bytes.Contains(old, []byte("\r\n")) {
		newline = "\r\n"
	}
	text := strings.ReplaceAll(string(old), "\r\n", "\n")
	lines := strings.Split(text, "\n")
	found := -1
	for i, l := range lines {
		if iconLine.MatchString(l) {
			if found >= 0 {
				return nil, errIconConfig
			}
			found = i
		}
	}
	if found >= 0 {
		lines[found] = line
	} else {
		if lines[len(lines)-1] == "" {
			lines = lines[:len(lines)-1]
		}
		lines = append(lines, line, "")
	}
	if lines[len(lines)-1] != "" {
		lines = append(lines, "")
	}
	result := []byte(strings.Join(lines, newline))
	var before, after map[string]any
	if yaml.Unmarshal(old, &before) != nil || yaml.Unmarshal(result, &after) != nil || after == nil {
		return nil, errIconConfig
	}
	delete(before, "icon")
	delete(after, "icon")
	if len(before) == 0 {
		before = nil
	}
	if len(after) == 0 {
		after = nil
	}
	if !reflect.DeepEqual(before, after) || configIcon(result) != set || len(result) > maxWorkspaceConfig {
		return nil, errIconConfig
	}
	return result, nil
}

// iconWrite is what writeIconConfig did: the bytes it edited (nil when the
// config did not exist) and the bytes it wrote.
type iconWrite struct {
	old, next []byte
	changed   bool
}

// iconBeforeRename runs between the final check and the rename; tests use it
// to land another writer's change there.
var iconBeforeRename = func() {}

// writeIconConfig writes the icon into the pinned workspace directory's
// config atomically. The config must be a regular file reached without a
// symlink, as the reader requires. Another writer's change is not lost: the
// edit starts from bytes proved against their stat, and the replacement is
// an exchange whose displaced file must still be that one, else it is put
// back. Linux has no compare-and-swap rename, so this detects and restores
// rather than excludes.
func writeIconConfig(root int, value string) (iconWrite, error) {
	set := parseIconValue(value)
	if set.Kind == "" || set.Value != value {
		return iconWrite{}, errIconInvalid
	}
	if set.Kind == "image" {
		if _, ok := iconFile(unix.Openat2, root, value); !ok {
			return iconWrite{}, errIconInvalid
		}
	}
	old, before, state := readSmallStat(unix.Openat2, root, workspaceConfigName, maxWorkspaceConfig)
	mode := uint32(0644)
	switch state {
	case "valid":
		mode = before.Mode & 0777
	case "missing":
		old = nil
	default:
		return iconWrite{}, errIconUnavailable
	}
	if old != nil && configIcon(old) == set {
		return iconWrite{old: old, next: old}, nil
	}
	next, err := editIconConfig(old, value)
	if err != nil {
		return iconWrite{}, err
	}
	var nonce [9]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return iconWrite{}, errIconUnavailable
	}
	tmp := workspaceConfigName + ".oh-" + base64.RawURLEncoding.EncodeToString(nonce[:])
	fd, err := unix.Openat(root, tmp, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, mode)
	if err != nil {
		return iconWrite{}, errIconUnavailable
	}
	defer unix.Unlinkat(root, tmp, 0)
	file := os.NewFile(uintptr(fd), tmp)
	_, err = file.Write(next)
	if err == nil {
		err = unix.Fchmod(fd, mode)
	}
	if err == nil {
		err = file.Sync()
	}
	if closeErr := file.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return iconWrite{}, errIconUnavailable
	}
	iconBeforeRename()
	if state == "missing" {
		// A config created meanwhile is someone's; never replace it.
		if unix.Renameat2(root, tmp, root, workspaceConfigName, unix.RENAME_NOREPLACE) != nil {
			return iconWrite{}, errIconUnavailable
		}
	} else {
		if unix.Renameat2(root, tmp, root, workspaceConfigName, unix.RENAME_EXCHANGE) != nil {
			return iconWrite{}, errIconUnavailable
		}
		// The rename itself changes the displaced file's ctime, not its
		// mtime or size.
		var displaced unix.Stat_t
		if unix.Fstatat(root, tmp, &displaced, unix.AT_SYMLINK_NOFOLLOW) != nil || !same(before, displaced) || displaced.Size != before.Size || displaced.Mtim != before.Mtim {
			// Someone wrote after the read: theirs goes back in place.
			_ = unix.Renameat2(root, tmp, root, workspaceConfigName, unix.RENAME_EXCHANGE)
			return iconWrite{}, errIconUnavailable
		}
	}
	_ = unix.Fsync(root)
	return iconWrite{old: old, next: next, changed: true}, nil
}

// iconGit runs Git in the pinned workspace as the person, with no hooks,
// signing, fsmonitor or automatic maintenance, like the worktree save.
func iconGit(ctx context.Context, home string, root int, args ...string) ([]byte, error) {
	return iconGitEnv(ctx, home, root, "", nil, args...)
}

func iconGitEnv(ctx context.Context, home string, root int, input string, env []string, args ...string) ([]byte, error) {
	return nativeCommandEnv(ctx, worktreeCommitLimit, io.Discard, input, env, "/usr/bin/git", home, strconv.Itoa(root), append([]string{"-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgsign=false", "-c", "maintenance.auto=false", "-c", "gc.auto=0", "-c", "core.quotepath=false"}, args...)...)
}

// iconGitState is the committed and indexed config before the write: the
// HEAD commit ("" on an unborn branch), the config's blob in HEAD and its
// index entry ("" when absent), and the entry's mode.
type iconGitState struct {
	head, committed, indexed, mode string
}

func readIconGitState(ctx context.Context, home string, root int) (iconGitState, error) {
	var st iconGitState
	if out, err := iconGit(ctx, home, root, "rev-parse", "--verify", "--quiet", "HEAD^{commit}"); err == nil {
		st.head = strings.TrimSpace(string(out))
		if out, err := iconGit(ctx, home, root, "rev-parse", "--verify", "--quiet", "HEAD:"+workspaceConfigName); err == nil {
			st.committed = strings.TrimSpace(string(out))
		}
	} else if _, err := iconGit(ctx, home, root, "symbolic-ref", "--quiet", "HEAD"); err != nil {
		return st, err // neither a commit nor an unborn branch
	}
	// A commit in the middle of a merge, rebase, cherry-pick or revert
	// would become part of that operation's history.
	gitDir, err := iconGit(ctx, home, root, "rev-parse", "--absolute-git-dir")
	if err != nil {
		return st, err
	}
	for _, busy := range []string{"MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"} {
		if _, err := os.Lstat(filepath.Join(strings.TrimSpace(string(gitDir)), busy)); !errors.Is(err, os.ErrNotExist) {
			return st, errors.New("operation under way")
		}
	}
	out, err := iconGit(ctx, home, root, "ls-files", "--stage", "-z", "--", workspaceConfigName)
	if err != nil {
		return st, err
	}
	if line := strings.TrimSuffix(string(out), "\x00"); line != "" {
		f := strings.Fields(line)
		if len(f) < 4 || f[2] != "0" {
			return st, errors.New("conflicted or unexpected index entry")
		}
		st.mode, st.indexed = f[0], f[1]
	}
	return st, nil
}

// iconBlob stores bytes as a blob and names it, in the repository's own
// object format.
func iconBlob(ctx context.Context, home string, root int, b []byte, write bool) (string, error) {
	args := []string{"hash-object", "--stdin", "--no-filters"}
	if write {
		args = append(args, "-w")
	}
	out, err := iconGitEnv(ctx, home, root, string(b), nil, args...)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

// iconConfigClean says whether the bytes the write started from are the
// committed config, unchanged in the index: absent everywhere, or the same
// blob in HEAD and the index. Otherwise the config holds the person's or an
// agent's change, and committing it silently would commit work nobody chose.
func iconConfigClean(ctx context.Context, home string, root int, st iconGitState, old []byte) bool {
	if old == nil {
		return st.committed == "" && st.indexed == ""
	}
	blob, err := iconBlob(ctx, home, root, old, false)
	return err == nil && blob == st.committed && blob == st.indexed
}

// commitIconConfig commits exactly the bytes written, the config alone, on
// top of the HEAD read before the write: through a private index, so the
// working tree's content at commit time and the work an agent has staged do
// not enter it, and with a compare-and-swap of HEAD, so a commit made
// meanwhile is not overwritten. The real index then gets the same entry for
// the config, which is what `git commit --only` would leave there.
func commitIconConfig(ctx context.Context, home string, root int, st iconGitState, next []byte, value string) string {
	if value == "auto" {
		value = "automaattinen"
	}
	message := strings.Replace(iconCommitMessage, "%s", value, 1)
	blob, err := iconBlob(ctx, home, root, next, true)
	if err != nil {
		return iconCommitFailed
	}
	mode := st.mode
	if mode == "" {
		mode = "100644"
	}
	dir, err := os.MkdirTemp("/var/tmp", "oh-icon-index-")
	if err != nil {
		return iconCommitFailed
	}
	defer os.RemoveAll(dir)
	index := []string{"GIT_INDEX_FILE=" + dir + "/index"}
	base := []string{"read-tree", "--empty"}
	if st.head != "" {
		base = []string{"read-tree", st.head}
	}
	if _, err := iconGitEnv(ctx, home, root, "", index, base...); err != nil {
		return iconCommitFailed
	}
	if _, err := iconGitEnv(ctx, home, root, "", index, "update-index", "--add", "--cacheinfo", mode+","+blob+","+workspaceConfigName); err != nil {
		return iconCommitFailed
	}
	tree, err := iconGitEnv(ctx, home, root, "", index, "write-tree")
	if err != nil {
		return iconCommitFailed
	}
	args := []string{"commit-tree", strings.TrimSpace(string(tree)), "-m", message}
	if st.head != "" {
		args = append(args, "-p", st.head)
	}
	commit, err := iconGit(ctx, home, root, args...)
	if err != nil {
		return iconCommitFailed
	}
	if _, err := iconGit(ctx, home, root, "update-ref", "-m", "commit: "+message, "HEAD", strings.TrimSpace(string(commit)), st.head); err != nil {
		return iconCommitFailed
	}
	if _, err := iconGit(ctx, home, root, "update-index", "--add", "--cacheinfo", mode+","+blob+","+workspaceConfigName); err != nil {
		return iconCommitFailed
	}
	return iconCommitted
}

// setWorkspaceIcon writes the icon into the pinned workspace and commits it
// when the workspace is a Git checkout and the config had no other change.
// The reply's commit outcome is the only word the page gets; a commit that
// did not happen leaves the written file for the person.
func setWorkspaceIcon(ctx context.Context, home string, root int, kind, value string) (string, error) {
	git := kind == "git_main_worktree" || kind == "git_linked_worktree"
	var st iconGitState
	var stateErr error
	if git {
		st, stateErr = readIconGitState(ctx, home, root)
	}
	w, err := writeIconConfig(root, value)
	switch {
	case err != nil:
		return "", err
	case !git && w.changed:
		return iconNotGit, nil
	case !git:
		return iconUnchanged, nil
	case stateErr != nil:
		return iconCommitFailed, nil
	case !iconConfigClean(ctx, home, root, st, w.old):
		return iconUncommitted, nil
	case !w.changed:
		return iconUnchanged, nil
	}
	return commitIconConfig(ctx, home, root, st, w.next, value), nil
}
