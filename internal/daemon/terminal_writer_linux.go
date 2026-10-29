//go:build linux

package daemon

import (
	"bytes"
	"context"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// A conversation written by a Pi in the person's own terminal can be watched
// in the browser's terminal panel when that Pi runs in tmux
// (terminal-watch-experimental, Jari 29.10.2026: Katso). The view is the same
// capture-pane redraw as a Taskfleet window: no tmux client is attached, no
// key is sent and nothing is resized. The browser names only the workspace
// and the conversation; the daemon finds the process, its tmux server and
// its pane itself, every time.
const TerminalWriterPath = "/api/v1/workspaces/terminals/writer"

var tmuxPaneID = regexp.MustCompile(`^%[0-9]{1,6}$`)

// terminalPi is a Pi process of the daemon's own UID, as /proc showed it.
type terminalPi struct {
	pid int
	// start is the kernel's start time in clock ticks: with the PID it names
	// one process, not whatever later reuses the number.
	start  uint64
	cwd    string
	socket string // the tmux server's socket from TMUX, in Pi's mount namespace
	pane   string // TMUX_PANE
}

func procStatFields(base string) ([]string, bool) {
	raw, err := os.ReadFile(filepath.Join(base, "stat"))
	if err != nil {
		return nil, false
	}
	end := bytes.LastIndexByte(raw, ')')
	if end < 0 {
		return nil, false
	}
	// fields[0] is stat's third field, the task state.
	return strings.Fields(string(raw[end+1:])), true
}

func procStart(base string) (uint64, bool) {
	f, ok := procStatFields(base)
	if !ok || len(f) < 20 {
		return 0, false
	}
	v, err := strconv.ParseUint(f[19], 10, 64)
	return v, err == nil
}

func procParent(base string) (int, bool) {
	f, ok := procStatFields(base)
	if !ok || len(f) < 2 {
		return 0, false
	}
	v, err := strconv.Atoi(f[1])
	return v, err == nil
}

// startedAt converts a start time in clock ticks to wall time. USER_HZ is
// 100 on every architecture Linux exposes to user space here.
func startedAt(proc string, ticks uint64) (time.Time, bool) {
	raw, err := os.ReadFile(filepath.Join(proc, "stat"))
	if err != nil {
		return time.Time{}, false
	}
	for _, line := range strings.Split(string(raw), "\n") {
		if v, ok := strings.CutPrefix(line, "btime "); ok {
			boot, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
			if err != nil {
				return time.Time{}, false
			}
			return time.Unix(boot, 0).Add(time.Duration(ticks) * 10 * time.Millisecond), true
		}
	}
	return time.Time{}, false
}

// tmuxFromEnviron reads tmux's own variables from a process environment.
// TMUX is "socket,server-pid,session-index"; the socket path may contain
// commas, the other two never do.
func tmuxFromEnviron(raw []byte) (socket, pane string) {
	for _, kv := range bytes.Split(raw, []byte{0}) {
		if v, ok := bytes.CutPrefix(kv, []byte("TMUX=")); ok {
			s := string(v)
			if i := strings.LastIndexByte(s, ','); i > 0 {
				if j := strings.LastIndexByte(s[:i], ','); j > 0 {
					socket = s[:j]
				}
			}
		} else if v, ok := bytes.CutPrefix(kv, []byte("TMUX_PANE=")); ok {
			pane = string(v)
		}
	}
	if !filepath.IsAbs(socket) || filepath.Clean(socket) != socket || len(socket) > 80 || !tmuxPaneID.MatchString(pane) {
		return "", ""
	}
	return socket, pane
}

// locateTerminalPi finds the one Pi process that writes target. The census
// (scanPiWriter) is a write fence and only has to know whether some writer
// may exist; this has to name one. Pi appends to its session file without
// keeping it open and overwrites its command line with its title, so an
// open descriptor or a --session argument proves the writer only now and
// then. Otherwise the writer is the only Pi working in the conversation's
// directory, provided the conversation changed after that Pi started and no
// other conversation in the directory did, the daemon's own Pi children's
// aside. That is not proof: a second Pi that wrote the conversation and has
// since exited leaves the same traces, a limitation accepted for a read-only
// view (issues/terminal-watch-experimental/result.md). Anything less certain
// is no answer.
func locateTerminalPi(proc string, target nativeSession, histories []nativeSession, uid int, own map[int]bool, ownIDs map[string]bool) (terminalPi, bool) {
	if uid != os.Geteuid() || uid == 0 || !filepath.IsAbs(target.path) || !filepath.IsAbs(target.cwd) {
		return terminalPi{}, false
	}
	file, err := os.Stat(target.path)
	if err != nil || !file.Mode().IsRegular() {
		return terminalPi{}, false
	}
	entries, err := os.ReadDir(proc)
	if err != nil {
		return terminalPi{}, false
	}
	var proved, near []terminalPi
	for _, entry := range entries {
		pid, err := strconv.Atoi(entry.Name())
		if err != nil || pid <= 0 || pid == os.Getpid() || own[pid] {
			continue
		}
		base := filepath.Join(proc, entry.Name())
		info, err := os.Stat(base)
		if procEntryGone(err) {
			continue
		}
		if err != nil {
			return terminalPi{}, false
		}
		if owner, ok := fileOwner(info); !ok || owner != uid {
			continue // Never read the process details of another UID.
		}
		pinned, err := os.Open(base)
		if procEntryGone(err) {
			continue
		}
		if err != nil {
			return terminalPi{}, false
		}
		pinnedInfo, err := pinned.Stat()
		owner, ok := fileOwner(pinnedInfo)
		if err != nil || !os.SameFile(info, pinnedInfo) || !ok || owner != uid {
			_ = pinned.Close()
			return terminalPi{}, false
		}
		p, holds, kind := observeTerminalPi(filepath.Join("/proc/self/fd", strconv.Itoa(int(pinned.Fd()))), target.path, file)
		_ = pinned.Close()
		switch kind {
		case "unknown":
			return terminalPi{}, false
		case "pi":
			p.pid = pid
			if holds {
				proved = append(proved, p)
			} else if p.cwd == target.cwd {
				near = append(near, p)
			}
		}
	}
	switch {
	case len(proved) == 1:
		return proved[0], true
	case len(proved) > 1 || len(near) != 1:
		return terminalPi{}, false
	}
	started, ok := startedAt(proc, near[0].start)
	if !ok || file.ModTime().Before(started) {
		return terminalPi{}, false
	}
	for _, other := range histories {
		if other.path == target.path || other.cwd != target.cwd || ownIDs[other.id] {
			continue
		}
		info, err := os.Stat(other.path)
		if err != nil || !info.ModTime().Before(started) {
			return terminalPi{}, false
		}
	}
	return near[0], true
}

// observeTerminalPi reads one pinned process directory. kind is "pi", "other"
// (not a Pi, or gone) or "unknown" (a Pi whose details could not be read).
func observeTerminalPi(base, path string, target os.FileInfo) (p terminalPi, holds bool, kind string) {
	raw, err := os.ReadFile(filepath.Join(base, "cmdline"))
	if procEntryGone(err) || err == nil && (knownNonPiSystemProcess(raw) || !isPiCommand(raw)) {
		return p, false, "other"
	}
	if err != nil {
		return p, false, "unknown"
	}
	if procTaskExited(base) {
		return p, false, "other"
	}
	start, ok := procStart(base)
	cwd, cwdErr := os.Readlink(filepath.Join(base, "cwd"))
	env, envErr := os.ReadFile(filepath.Join(base, "environ"))
	fds, fdErr := os.ReadDir(filepath.Join(base, "fd"))
	for _, err := range []error{cwdErr, envErr, fdErr} {
		if procEntryGone(err) {
			return p, false, "other"
		}
		if err != nil {
			return p, false, "unknown"
		}
	}
	if !ok {
		return p, false, "unknown"
	}
	p.start, p.cwd = start, cwd
	p.socket, p.pane = tmuxFromEnviron(env)
	holds = strings.Contains(string(raw), path)
	for _, fd := range fds {
		if fi, err := os.Stat(filepath.Join(base, "fd", fd.Name())); err == nil && os.SameFile(fi, target) {
			holds = true
		}
	}
	return p, holds, "pi"
}

// withinWorkspace is the scope of a workspace's terminal views: the
// directory, below it, or one of its worktrees.
func withinWorkspace(dir, path string) bool {
	path = filepath.Clean(path)
	return path == dir || strings.HasPrefix(path, dir+"/") || strings.HasPrefix(path, dir+"__worktrees/")
}

// writerPane is where a conversation's terminal Pi is, as the browser may
// learn it: place is "tmux", "terminal" (running, but not in a tmux pane the
// daemon can reach) or "none".
type writerPane struct {
	place        string
	conversation string
	session      string
	window       int
	name         string
	// For the view only; never sent.
	socket, pane string
	pi           terminalPi
	proc         string
	uid          int
}

func (h *terminalHost) procRoot() string {
	if h.proc != "" {
		return h.proc
	}
	return "/proc"
}

// ownProc is a process directory of the daemon's own UID, or nothing: the
// daemon never reads another user's process details.
func ownProc(proc string, pid, uid int) (string, bool) {
	base := filepath.Join(proc, strconv.Itoa(pid))
	info, err := os.Stat(base)
	if err != nil {
		return "", false
	}
	owner, ok := fileOwner(info)
	return base, ok && owner == uid
}

// same reports whether the located Pi is still the same process.
func (w *writerPane) same() bool {
	base, ok := ownProc(w.proc, w.pi.pid, w.uid)
	if !ok {
		return false
	}
	start, ok := procStart(base)
	return ok && start == w.pi.start
}

// still reports whether the view's conversation is still this Pi's: Pi can
// switch to another session without exiting (/new, /resume).
func (h *terminalHost) still(ctx context.Context, dir string, w *writerPane) bool {
	now := h.writerPane(ctx, dir, w.conversation)
	return now.place == "tmux" && now.pi.pid == w.pi.pid && now.pi.start == w.pi.start && now.pane == w.pane
}

func (h *terminalHost) writerPane(ctx context.Context, dir, conversation string) writerPane {
	proc := h.procRoot()
	none := writerPane{place: "none", conversation: conversation}
	read := h.histories
	if read == nil {
		read = func() ([]nativeSession, error) { return nativeSessions(h.cfg) }
	}
	histories, err := read()
	if err != nil {
		return none
	}
	var target nativeSession
	found := 0
	for _, s := range histories {
		if s.id == conversation {
			target = s
			found++
		}
	}
	if found != 1 || target.state != "readable" || !withinWorkspace(dir, target.cwd) {
		return none
	}
	var own map[int]bool
	var ownIDs map[string]bool
	if h.ownPIDs != nil {
		own = h.ownPIDs()
	}
	if h.ownSessions != nil {
		ownIDs = h.ownSessions()
	}
	pi, ok := locateTerminalPi(proc, target, histories, h.cfg.UID, own, ownIDs)
	if !ok || !withinWorkspace(dir, pi.cwd) {
		return none
	}
	w := writerPane{place: "terminal", conversation: conversation, pi: pi, proc: proc, uid: h.cfg.UID}
	if pi.socket == "" || h.tmux == "" {
		return w
	}
	// The person's tmux socket is usually under /tmp, which the daemon's
	// PrivateTmp hides; Pi's own root shows it (Jari 29.10.2026: the same
	// Unix user, so this crosses the daemon's sandbox, not a person boundary).
	base := filepath.Join(proc, strconv.Itoa(pi.pid))
	socket := filepath.Join(base, "root") + pi.socket
	info, err := os.Stat(socket)
	if err != nil || info.Mode()&os.ModeSocket == 0 || len(socket) > 107 {
		return w
	}
	if owner, ok := fileOwner(info); !ok || owner != h.cfg.UID {
		return w
	}
	out, err := h.run(ctx, socket, "display-message", "-p", "-t", pi.pane, terminalFormat("pane_pid", "session_name", "window_index", "window_name"))
	f := strings.Split(strings.TrimSuffix(string(out), "\n"), "\t")
	if err != nil || len(f) != 4 {
		return w
	}
	panePID, err1 := strconv.Atoi(f[0])
	window, err2 := strconv.Atoi(f[2])
	session := tmuxText(f[1], 64)
	if err1 != nil || err2 != nil || window < 0 || window > 999999 || session == "" {
		return w
	}
	// TMUX_PANE is inherited text: the pane counts only if Pi runs inside it.
	inside := false
	for p, i := pi.pid, 0; p > 1 && i < 64; i++ {
		if p == panePID {
			inside = true
			break
		}
		base, ok := ownProc(proc, p, h.cfg.UID)
		if !ok {
			break // An ancestor of another user ends the walk unread.
		}
		next, ok := procParent(base)
		if !ok {
			break
		}
		p = next
	}
	if !inside || !w.same() {
		return w
	}
	w.place, w.session, w.window, w.name = "tmux", session, window, tmuxText(f[3], 128)
	w.socket, w.pane = socket, pi.pane
	return w
}

// TerminalWriterHandler says where a conversation's terminal Pi runs. It
// reads /proc and the person's tmux and changes nothing.
func (h *terminalHost) TerminalWriterHandler(trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(h.cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		q := r.URL.Query()
		id, conversation := q.Get("workspace_id"), q.Get("conversation")
		if r.Method != http.MethodGet || r.URL.Path != TerminalWriterPath || r.URL.EscapedPath() != TerminalWriterPath || r.ContentLength > 0 || len(r.TransferEncoding) != 0 || len(q) != 2 || len(q["workspace_id"]) != 1 || len(q["conversation"]) != 1 || !idPattern.MatchString(id) || !sessionIDPattern.MatchString(conversation) || r.URL.RawQuery != "workspace_id="+id+"&conversation="+conversation {
			snapshotError(w, 400, "invalid_request")
			return
		}
		dir, _, ok := terminalWorkspace(h.cfg, id)
		if !ok {
			snapshotError(w, 404, "workspace_unavailable")
			return
		}
		found := h.writerPane(r.Context(), dir, conversation)
		body := map[string]any{"schema_version": 1, "workspace_id": id, "conversation": conversation, "place": found.place}
		if found.place == "tmux" {
			body["session"], body["window"], body["name"] = found.session, found.window, found.name
		}
		terminalJSON(w, body)
	})
}
