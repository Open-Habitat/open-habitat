//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"sync"
	"syscall"
	"time"

	"golang.org/x/sys/unix"
)

const cloneVolumeBytes uint64 = 20 << 30
const cloneMinimumFree uint64 = 5 << 30

// The operator mounts a dedicated hard-bounded volume at ~/src. A free-space
// check by itself is not a budget: the mount and total-size checks are required.
func sourceOnDifferentMount(home, src int) bool {
	var h, s unix.Statx_t
	return unix.Statx(home, "", unix.AT_EMPTY_PATH, unix.STATX_MNT_ID, &h) == nil && unix.Statx(src, "", unix.AT_EMPTY_PATH, unix.STATX_MNT_ID, &s) == nil && h.Mnt_id != s.Mnt_id
}

func dedicatedCloneVolume(src int) bool {
	var at, parent unix.Statx_t
	if unix.Statx(src, "", unix.AT_EMPTY_PATH, unix.STATX_MNT_ID, &at) != nil ||
		unix.Statx(src, "..", 0, unix.STATX_MNT_ID, &parent) != nil ||
		at.Mnt_id == parent.Mnt_id {
		return false
	}
	// A bind mount of the home filesystem has a distinct mount ID but shares
	// its blocks with other users; it cannot enforce a per-user budget.
	var source, home unix.Stat_t
	if unix.Fstat(src, &source) != nil || unix.Fstatat(src, "..", &home, 0) != nil || source.Dev == home.Dev {
		return false
	}
	var fs unix.Statfs_t
	if unix.Fstatfs(src, &fs) != nil || fs.Frsize <= 0 || fs.Blocks == 0 {
		return false
	}
	return fs.Blocks <= cloneVolumeBytes/uint64(fs.Frsize)
}
func cloneHeadroom(src int) bool {
	var fs unix.Statfs_t
	if unix.Fstatfs(src, &fs) != nil || fs.Frsize <= 0 {
		return false
	}
	return fs.Bavail >= cloneMinimumFree/uint64(fs.Frsize)
}
func boundedCloneVolume(src int) bool {
	return dedicatedCloneVolume(src) && cloneHeadroom(src)
}

type cloneFrame struct {
	SchemaVersion int     `json:"schema_version"`
	Sequence      int     `json:"sequence"`
	Kind          string  `json:"kind"`
	Stage         string  `json:"stage,omitempty"`
	Percent       *int    `json:"percent,omitempty"`
	ReceivedBytes *uint64 `json:"received_bytes,omitempty"`
	Outcome       string  `json:"outcome,omitempty"`
	Reason        string  `json:"reason,omitempty"`
}
type cloneEmitter struct {
	w        http.ResponseWriter
	sequence int
	failed   bool
	stage    string
	mu       sync.Mutex
	cancel   context.CancelFunc
}

func (e *cloneEmitter) send(f cloneFrame) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.failed || e.sequence >= 4096 {
		return false
	}
	e.sequence++
	if f.Stage != "" {
		e.stage = f.Stage
	}
	f.SchemaVersion, f.Sequence = 1, e.sequence
	b, _ := json.Marshal(f)
	if err := http.NewResponseController(e.w).SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil && !errors.Is(err, http.ErrNotSupported) {
		e.failed = true
		e.cancel()
		return false
	}
	if _, err := io.WriteString(e.w, "event: "+f.Kind+"\ndata: "+string(b)+"\n\n"); err != nil {
		e.failed = true
		e.cancel()
		return false
	}
	e.w.(http.Flusher).Flush()
	if f.Kind == "terminal" {
		e.failed = true
	} // Still under the mutex: no late heartbeat.
	return true
}
func (e *cloneEmitter) progress(stage string, percent int) bool {
	return e.progressMeasured(stage, percent, nil)
}
func (e *cloneEmitter) progressMeasured(stage string, percent int, received *uint64) bool {
	f := cloneFrame{Kind: "progress", Stage: stage, ReceivedBytes: received}
	if percent >= 0 && percent <= 100 {
		f.Percent = &percent
	}
	return e.send(f)
}
func (e *cloneEmitter) heartbeat() {
	e.mu.Lock()
	stage := e.stage
	failed := e.failed
	e.mu.Unlock()
	if !failed && stage != "" {
		_ = e.progress(stage, -1)
	}
}
func (e *cloneEmitter) terminal(outcome, reason string) {
	_ = e.send(cloneFrame{Kind: "terminal", Outcome: outcome, Reason: reason})
}
func cloneFail(w http.ResponseWriter, emit *cloneEmitter, reason string) {
	if emit == nil {
		snapshotError(w, 409, "checkout_uncertain")
		return
	}
	emit.terminal("uncertain", reason)
}

// Git progress contains remote messages and URLs. Only these anchored native
// labels plus decimal percentages are parsed; all other text is discarded.
var nativeCloneProgress = regexp.MustCompile(`^(Receiving objects|Updating files):\s+([0-9]{1,3})%`)
var nativeCloneBytes = regexp.MustCompile(`^Receiving objects:\s+[0-9]{1,3}% \([0-9]+/[0-9]+\), ([0-9]{1,9})(?:\.([0-9]{1,2}))? (bytes|KiB|MiB|GiB)(?:\s|$)`)

func parsedGitBytes(line []byte) *uint64 {
	m := nativeCloneBytes.FindSubmatch(line)
	if len(m) != 4 {
		return nil
	}
	whole, err := strconv.ParseUint(string(m[1]), 10, 64)
	if err != nil {
		return nil
	}
	fraction := uint64(0)
	if len(m[2]) > 0 {
		digits := string(m[2])
		if len(digits) == 1 {
			digits += "0"
		}
		fraction, err = strconv.ParseUint(digits, 10, 64)
		if err != nil {
			return nil
		}
	}
	scale := uint64(1)
	switch string(m[3]) {
	case "KiB":
		scale = 1 << 10
	case "MiB":
		scale = 1 << 20
	case "GiB":
		scale = 1 << 30
	}
	count := whole*scale + fraction*scale/100
	if count > 9007199254740991 {
		return nil
	}
	return &count
}

type gitProgressWriter struct {
	emit            *cloneEmitter
	line            []byte
	skip            bool
	lastStage       string
	lastPercent     int
	lastBytes       uint64
	receivingFrames int
	checkoutFrames  int
}

func (p *gitProgressWriter) Write(b []byte) (int, error) {
	for _, ch := range b {
		if ch == '\r' || ch == '\n' {
			if !p.skip {
				m := nativeCloneProgress.FindSubmatch(p.line)
				if len(m) == 3 {
					n, _ := strconv.Atoi(string(m[2]))
					stage := "receiving"
					if string(m[1]) == "Updating files" {
						stage = "checkout"
					}
					var received *uint64
					if stage == "receiving" {
						received = parsedGitBytes(p.line)
					}
					bytesChanged := received != nil && *received != p.lastBytes
					stageRoom := stage == "receiving" && p.receivingFrames < 128 || stage == "checkout" && p.checkoutFrames < 128
					if n <= 100 && stageRoom && (stage != p.lastStage || n != p.lastPercent || bytesChanged) {
						if !p.emit.progressMeasured(stage, n, received) {
							return len(b), errors.New("stream closed")
						}
						if stage == "receiving" {
							p.receivingFrames++
						} else {
							p.checkoutFrames++
						}
						p.lastStage, p.lastPercent = stage, n
						if received != nil {
							p.lastBytes = *received
						}
					}
				}
			}
			p.line = p.line[:0]
			p.skip = false
		} else if !p.skip {
			if len(p.line) >= 512 {
				p.line = p.line[:0]
				p.skip = true
			} else {
				p.line = append(p.line, ch)
			}
		}
	}
	return len(b), nil
}

func cloneProgressCommand(ctx context.Context, program, home string, child int, url string, emit *cloneEmitter) error {
	copyFD, err := unix.Dup(child)
	if err != nil {
		return err
	}
	file := os.NewFile(uintptr(copyFD), "checkout")
	defer file.Close()
	cmd := exec.CommandContext(ctx, program, "clone", "--progress", "--", url, ".")
	cmd.ExtraFiles = []*os.File{file}
	cmd.Dir = "/proc/" + strconv.Itoa(os.Getpid()) + "/fd/" + strconv.Itoa(int(file.Fd()))
	cmd.Env = []string{"HOME=" + home, "XDG_CONFIG_HOME=" + filepath.Join(home, ".config"), "PATH=/usr/bin:/bin", "GH_PROMPT_DISABLED=1", "GIT_TERMINAL_PROMPT=0", "GCM_INTERACTIVE=never", "GIT_CONFIG_NOSYSTEM=1", "GIT_OPTIONAL_LOCKS=0"}
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.WaitDelay = time.Second
	cmd.Stdout = io.Discard
	cmd.Stderr = &gitProgressWriter{emit: emit}
	if err := cmd.Start(); err != nil {
		return err
	}
	pid := cmd.Process.Pid
	done := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			_ = syscall.Kill(-pid, syscall.SIGKILL)
		case <-done:
		}
	}()
	err = cmd.Wait()
	close(done)
	// The process group can outlive its leader (credential helpers included).
	_ = syscall.Kill(-pid, syscall.SIGKILL)
	if ctx.Err() != nil {
		return ctx.Err()
	}
	return err
}

// An unborn HEAD is indistinguishable from an interrupted clone after git
// init. Require a resolvable commit before native observation confirms it.
func validCloneCommit(b []byte) bool {
	if len(b) != 41 && len(b) != 65 {
		return false
	}
	if b[len(b)-1] != '\n' {
		return false
	}
	for _, c := range b[:len(b)-1] {
		if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f') {
			return false
		}
	}
	return true
}

// Only use these codes on the wire, never the native error or URL.
func cloneReason(err error) string {
	if err == nil {
		return ""
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "deadline_exceeded"
	}
	if errors.Is(err, context.Canceled) {
		return "cancelled"
	}
	return "native_failure"
}

var cloneWriter sync.Mutex
