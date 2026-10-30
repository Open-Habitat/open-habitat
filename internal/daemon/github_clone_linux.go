//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"errors"
	"io"
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

type cloneRunner func(context.Context, string, string, string, ...string) ([]byte, error)

func strictCloneJSON(b []byte, v any) error {
	d := json.NewDecoder(strings.NewReader(string(b)))
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return err
	}
	if d.Decode(new(any)) != io.EOF {
		return errors.New("trailing")
	}
	return nil
}
func validCloneName(s string) bool {
	p := strings.Split(s, "/")
	return len(p) == 2 && repoOwner.MatchString(p[0]) && repoName.MatchString(p[1]) && p[1] != "." && p[1] != ".."
}
func cloneSource(cfg transport.Config, home string, allowCreate bool) (int, error) {
	if cfg.UID != os.Geteuid() {
		return -1, errors.New("identity")
	}
	root, e := unix.Open("/", unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return -1, e
	}
	defer unix.Close(root)
	if !filepath.IsAbs(home) || filepath.Clean(home) != home || home == "/" {
		return -1, errors.New("home")
	}
	h, e := dir(unix.Openat2, root, strings.TrimPrefix(home, "/"), false)
	if e != nil {
		return -1, e
	}
	defer unix.Close(h)
	hs, e := stat(h)
	if e != nil || hs.Uid != uint32(cfg.UID) || hs.Mode&0022 != 0 {
		return -1, errors.New("home ownership")
	}
	src, e := dir(unix.Openat2, h, "src", false)
	if errors.Is(e, unix.ENOENT) && allowCreate {
		if unix.Mkdirat(h, "src", 0700) != nil {
			return -1, errors.New("src")
		}
		src, e = dir(unix.Openat2, h, "src", false)
	}
	if e != nil {
		return -1, e
	}
	s, e := stat(src)
	if e != nil || s.Uid != uint32(cfg.UID) || s.Mode&0022 != 0 {
		unix.Close(src)
		return -1, errors.New("src ownership")
	}
	return src, nil
}
func cloneCommand(parent context.Context, program, cwd, fd string, args ...string) ([]byte, error) {
	return cloneCommandWithTimeout(parent, 70*time.Second, program, cwd, fd, args...)
}

// Preserve an executed command's exit status without retaining native diagnostics.
// Callers must not mistake cancellation or an output-cap failure for absence.
type nativeCommandExit struct{ Code int }

func (e *nativeCommandExit) Error() string { return "native failure" }

func cloneCommandWithTimeout(parent context.Context, limit time.Duration, program, cwd, fd string, args ...string) ([]byte, error) {
	return nativeCommandInput(parent, limit, io.Discard, "", program, cwd, fd, args...)
}

// nativeCommand is cloneCommandWithTimeout with the diagnostics sent to
// stderr, for a caller that classifies them and never passes them on.
func nativeCommand(parent context.Context, limit time.Duration, stderr io.Writer, program, cwd, fd string, args ...string) ([]byte, error) {
	return nativeCommandInput(parent, limit, stderr, "", program, cwd, fd, args...)
}

// cloneCommandInput is cloneCommandWithTimeout with input on stdin.
func cloneCommandInput(parent context.Context, limit time.Duration, program, cwd, fd, input string, args ...string) ([]byte, error) {
	return nativeCommandInput(parent, limit, io.Discard, input, program, cwd, fd, args...)
}

func nativeCommandInput(parent context.Context, limit time.Duration, stderr io.Writer, input, program, cwd, fd string, args ...string) ([]byte, error) {
	return nativeCommandEnv(parent, limit, stderr, input, nil, program, cwd, fd, args...)
}

// nativeCommandEnv is nativeCommandInput with variables added to the fixed
// environment, such as Git's GIT_INDEX_FILE for a private index.
func nativeCommandEnv(parent context.Context, limit time.Duration, stderr io.Writer, input string, extra []string, program, cwd, fd string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(parent, limit)
	defer cancel()
	cmd := exec.CommandContext(ctx, program, args...)
	home := cwd
	if fd != "" {
		n, e := strconv.Atoi(fd)
		if e != nil {
			return nil, e
		}
		copyFD, e := unix.Dup(n)
		if e != nil {
			return nil, e
		}
		file := os.NewFile(uintptr(copyFD), "checkout")
		defer file.Close()
		cmd.ExtraFiles = []*os.File{file}
		cmd.Dir = "/proc/" + strconv.Itoa(os.Getpid()) + "/fd/" + strconv.Itoa(int(file.Fd()))
	} else {
		cmd.Dir = cwd
	}

	cmd.Env = append([]string{"HOME=" + home, "XDG_CONFIG_HOME=" + filepath.Join(home, ".config"), "PATH=/usr/bin:/bin", "GH_PROMPT_DISABLED=1", "GIT_TERMINAL_PROMPT=0", "GCM_INTERACTIVE=never", "GIT_CONFIG_NOSYSTEM=1", "GIT_OPTIONAL_LOCKS=0"}, extra...)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.WaitDelay = time.Second
	out := &limitedRepoWriter{}
	cmd.Stdout = out
	cmd.Stderr = stderr
	if input != "" {
		cmd.Stdin = strings.NewReader(input)
	}
	if e := cmd.Start(); e != nil {
		return nil, e
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
	e := cmd.Wait()
	close(done)
	_ = syscall.Kill(-pid, syscall.SIGKILL)
	if e != nil || out.overflow || ctx.Err() != nil {
		var exit *exec.ExitError
		if !out.overflow && ctx.Err() == nil && errors.As(e, &exit) && exit.ExitCode() >= 0 {
			return nil, &nativeCommandExit{Code: exit.ExitCode()}
		}
		return nil, errors.New("native failure")
	}
	return out.Bytes(), nil
}

// Reopen the trusted path without creation: an fd pinned to an unlinked
// directory is not evidence that ~/src still contains the checkout.
func cloneSourceStillNamed(home string, expected unix.Stat_t) bool {
	root, e := unix.Open("/", unix.O_PATH|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return false
	}
	defer unix.Close(root)
	h, e := dir(unix.Openat2, root, strings.TrimPrefix(home, "/"), false)
	if e != nil {
		return false
	}
	defer unix.Close(h)
	src, e := dir(unix.Openat2, h, "src", false)
	if e != nil {
		return false
	}
	defer unix.Close(src)
	current, e := stat(src)
	return e == nil && same(expected, current)
}
