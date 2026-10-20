//go:build linux

package daemon

import (
	"context"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"syscall"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/storagequota"
	"golang.org/x/sys/unix"
)

// Admission is a current-state check, not a prediction of the eventual
// remote repository size. Kernel EDQUOT remains the final enforcement point.
func quotaCloneAdmission(src int, uid uint32) bool {
	var st unix.Stat_t
	var fs unix.Statfs_t
	if unix.Fstat(src, &st) != nil || st.Uid != uid || unix.Fstatfs(src, &fs) != nil || fs.Frsize <= 0 || fs.Bavail == 0 {
		return false
	}
	var home unix.Stat_t
	if unix.Stat("/home", &home) != nil || st.Dev != home.Dev {
		return false // a per-user image or bind of another filesystem is not quota-covered
	}
	q, err := storagequota.Read(uid)
	return err == nil && q.Usage < q.Limit
}

func boundedCloneVolume(src int) bool { return quotaCloneAdmission(src, uint32(os.Geteuid())) }

// cloneProgressSink receives the parsed native measurements. A false return
// means the receiver is gone and the native process should stop.
type cloneProgressSink interface {
	progressMeasured(stage string, percent int, received *uint64) bool
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
	emit        cloneProgressSink
	line        []byte
	skip        bool
	lastStage   string
	lastPercent int
	lastBytes   uint64
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
					if n <= 100 && (stage != p.lastStage || n != p.lastPercent || bytesChanged) {
						if !p.emit.progressMeasured(stage, n, received) {
							return len(b), errors.New("stream closed")
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

func cloneProgressCommand(ctx context.Context, program, home string, child int, url, mode string, emit cloneProgressSink) error {
	copyFD, err := unix.Dup(child)
	if err != nil {
		return err
	}
	file := os.NewFile(uintptr(copyFD), "checkout")
	defer file.Close()
	args := []string{"clone", "--progress"}
	if mode == "blobless" {
		args = append(args, "--filter=blob:none")
	}
	cmd := exec.CommandContext(ctx, program, append(args, "--", url, ".")...)
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
