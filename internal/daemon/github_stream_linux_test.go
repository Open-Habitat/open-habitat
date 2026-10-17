//go:build linux

package daemon

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"
)

// recordedProgress keeps what the parser hands on: only stage and percent.
type recordedProgress struct{ frames []string }

func (r *recordedProgress) progressMeasured(stage string, percent int, _ *uint64) bool {
	r.frames = append(r.frames, stage+" "+strconv.Itoa(percent))
	return true
}

func TestNativeProgressParserDiscardsHostileAndOversizedLines(t *testing.T) {
	emit := &recordedProgress{}
	parser := &gitProgressWriter{emit: emit}
	hostile := "Receiving objects: 101% https://user:password@example.invalid\r" + strings.Repeat("x", 513) + "Receiving objects: 49%\r" + "remote: Updating files: 20% /home/private\r" + "Receiving objects: 0% (0/10)\r"
	for _, chunk := range []string{hostile[:13], hostile[13:]} {
		if _, err := parser.Write([]byte(chunk)); err != nil {
			t.Fatal(err)
		}
	}
	if got := strings.Join(emit.frames, ";"); got != "receiving 0" {
		t.Fatal(got)
	}
}

// fixtureDeadline turns a condition-driven cancellation into a deadline result.
// Its Done channel is the real context's; only Err differs after cancellation.
type fixtureDeadline struct{ context.Context }

func (c fixtureDeadline) Err() error {
	if c.Context.Err() != nil {
		return context.DeadlineExceeded
	}
	return nil
}

func TestCloneNativeDeadlineKillsSlowProcessGroup(t *testing.T) {
	home := t.TempDir()
	dir := filepath.Join(home, "repo")
	if err := os.Mkdir(dir, 0700); err != nil {
		t.Fatal(err)
	}
	fd, err := os.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer fd.Close()
	script := filepath.Join(home, "slow-git")
	ready := filepath.Join(home, "clone-ready")
	childPID := filepath.Join(home, "clone-child-pid")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nmkdir .git || exit 1\n/bin/sleep 30 &\nprintf '%s' \"$!\" > '"+childPID+"'\nprintf ready > '"+ready+"'\nwait\n"), 0700); err != nil {
		t.Fatal(err)
	}
	// The safety timeout bounds a broken fixture; the tested deadline is
	// triggered only after the native child has established a partial tree.
	base, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	ctx := fixtureDeadline{base}
	emit := &recordedProgress{}
	result := make(chan error, 1)
	go func() {
		result <- cloneProgressCommand(ctx, script, home, int(fd.Fd()), "https://github.com/fixture/repo.git", "full", emit)
	}()
	wait := time.NewTicker(10 * time.Millisecond)
	defer wait.Stop()
	for {
		if _, err := os.Stat(ready); err == nil {
			if _, err := os.Stat(filepath.Join(dir, ".git")); err != nil {
				cancel()
				<-result
				t.Fatal("fixture signalled ready without partial tree", err)
			}
			break
		}
		select {
		case err := <-result:
			t.Fatalf("native clone exited before partial tree: %v", err)
		case <-base.Done():
			<-result
			t.Fatal("native clone did not establish partial tree before safety timeout")
		case <-wait.C:
		}
	}
	started := time.Now()
	cancel()
	err = <-result
	if err != context.DeadlineExceeded || time.Since(started) > 3*time.Second {
		t.Fatalf("deadline did not settle: %v after %s", err, time.Since(started))
	}
	if _, err := os.Stat(filepath.Join(dir, ".git")); err != nil {
		t.Fatal("deadline removed partial tree", err)
	}
	pidBytes, err := os.ReadFile(childPID)
	if err != nil {
		t.Fatal("child PID not recorded", err)
	}
	pid, err := strconv.Atoi(string(pidBytes))
	if err != nil || pid <= 0 {
		t.Fatalf("invalid fixture child PID: %q (%v)", pidBytes, err)
	}
	// A shell leader alone dying would leave its sleep child running.
	// An orphaned child may briefly be a zombie awaiting reaping; Z is dead.
	for until := time.Now().Add(3 * time.Second); ; {
		stat, err := os.ReadFile(fmt.Sprintf("/proc/%d/stat", pid))
		// procfs can report ESRCH when the process disappears between
		// opening and reading stat; that also proves the child has exited.
		if os.IsNotExist(err) || errors.Is(err, syscall.ESRCH) {
			break
		}
		if err == nil {
			end := strings.LastIndex(string(stat), ") ")
			if end < 0 || len(stat) <= end+2 {
				t.Fatalf("invalid clone child proc stat: %q", stat)
			}
			if stat[end+2] == 'Z' {
				break
			}
		}
		if err != nil {
			t.Fatal("inspect clone child", err)
		}
		if time.Now().After(until) {
			t.Fatalf("clone process group left child %d running", pid)
		}
		time.Sleep(10 * time.Millisecond)
	}
}
