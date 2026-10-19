//go:build linux

package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// Poll instead of setting PR_SET_PDEATHSIG on a Go thread: Linux ties that
// signal to the creating thread, whose lifetime need not match the process.
// Fake Pi runs this too, so even SIGKILL of the host cannot leak its Pi.
func guardLifetime(fakePi bool) {
	owner := os.Getppid()
	if !fakePi {
		if raw := os.Getenv("BROWSER_HOST_OWNER_PID"); raw != "" {
			var err error
			owner, err = strconv.Atoi(raw)
			if err != nil || owner <= 1 {
				log.Fatal("invalid BROWSER_HOST_OWNER_PID")
			}
		}
	}
	name, _ := os.ReadFile(fmt.Sprintf("/proc/%d/comm", owner))
	if strings.TrimSpace(string(name)) == "systemd" || strings.TrimSpace(string(name)) == "init" {
		log.Fatal("browser host has no launching owner")
	}
	identity := processIdentity(owner)
	if owner <= 1 || identity == "" {
		log.Fatal("browser host owner is not alive")
	}
	exe, err := os.Executable()
	if err != nil {
		log.Fatal(err)
	}
	// The binary is built in the worktree's .cache. Retain the directory inode,
	// so removing and recreating the worktree does not adopt an abandoned host.
	root := filepath.Dir(filepath.Dir(exe))
	original, err := os.Stat(root)
	if err != nil {
		log.Fatal(err)
	}
	go func() {
		for range time.NewTicker(200 * time.Millisecond).C {
			current, err := os.Stat(root)
			if processIdentity(owner) != identity || err != nil || !os.SameFile(original, current) {
				// Allow normal host defers to reclaim its synthetic home, but do
				// not depend on the server/event loop remaining responsive.
				// Each Pi independently observes its host's death, even on KILL.
				fmt.Fprintln(os.Stderr, "browser host lifetime ended: owner or worktree disappeared")
				_ = syscall.Kill(os.Getpid(), syscall.SIGTERM)
				time.Sleep(2 * time.Second)
				_ = syscall.Kill(os.Getpid(), syscall.SIGKILL)
				return
			}
		}
	}()
}

func processIdentity(pid int) string {
	b, err := os.ReadFile(fmt.Sprintf("/proc/%d/stat", pid))
	if err != nil {
		return ""
	}
	end := strings.LastIndexByte(string(b), ')')
	if end < 0 {
		return ""
	}
	fields := strings.Fields(string(b[end+1:]))
	if len(fields) < 20 || fields[0] == "Z" || fields[0] == "X" {
		return ""
	}
	return fields[19] // starttime, field 22; PID reuse is not ownership.
}
