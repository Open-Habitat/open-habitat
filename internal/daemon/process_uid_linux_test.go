//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"
)

// Runs only in the disposable rootless UID fixture, never mutates real accounts.
func TestProcessDistinctUIDs(t *testing.T) {
	if os.Getenv("PI_UID_CONTAINER") != "1" {
		t.Skip("requires disposable UID fixture")
	}
	path := os.Getenv("PROCESS_UID_SOCKET")
	switch os.Getenv("PROCESS_UID_ROLE") {
	case "owner":
		ln, err := net.Listen("unix", path)
		if err != nil {
			t.Fatal(err)
		}
		defer ln.Close()
		os.Chmod(path, 0600)
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			var q any
			_ = json.NewDecoder(conn).Decode(&q)
			_ = json.NewEncoder(conn).Encode(map[string]any{"ok": true, "data": map[string]any{"result": "cleared"}})
			conn.Close()
		}
	case "probe":
		pid, _ := strconv.Atoi(os.Getenv("PROCESS_UID_PID"))
		proc, _ := os.FindProcess(pid)
		p := &piRPC{cmd: &exec.Cmd{Process: proc}, processSocket: path, exited: make(chan struct{})}
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		err := p.processRequest(ctx, map[string]string{"op": "clear"}, nil)
		if os.Geteuid() == 21001 && err != nil {
			t.Fatal("own daemon could not reach its child", err)
		}
		if os.Geteuid() != 21001 && err == nil {
			t.Fatal("foreign user reached process control")
		}
		return
	}
	if os.Geteuid() != 0 {
		t.Fatal("requires namespace root")
	}
	base, err := os.MkdirTemp("/tmp", "process-uids-")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(base)
	os.Chmod(base, 0711)
	dir := filepath.Join(base, "private")
	if err := os.Mkdir(dir, 0700); err != nil {
		t.Fatal(err)
	}
	os.Chown(dir, 21001, 21001)
	path = filepath.Join(dir, "p.sock")
	child := exec.Command(os.Args[0], "-test.run=^TestProcessDistinctUIDs$")
	child.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: 21001, Gid: 21001}}
	child.Env = append(os.Environ(), "PROCESS_UID_ROLE=owner", "PROCESS_UID_SOCKET="+path)
	var output strings.Builder
	child.Stdout, child.Stderr = &output, &output
	if err := child.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { child.Process.Kill(); child.Wait() }()
	deadline := time.Now().Add(5 * time.Second)
	for {
		if _, err := os.Stat(path); err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("owner socket unavailable %s", output.String())
		}
		time.Sleep(10 * time.Millisecond)
	}
	for _, uid := range []uint32{21001, 21002, 21003} {
		probe := exec.Command(os.Args[0], "-test.run=^TestProcessDistinctUIDs$")
		probe.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uid, Gid: uid}}
		probe.Env = append(os.Environ(), "PROCESS_UID_ROLE=probe", "PROCESS_UID_SOCKET="+path, "PROCESS_UID_PID="+strconv.Itoa(child.Process.Pid))
		if b, err := probe.CombinedOutput(); err != nil {
			t.Fatalf("UID %d probe %v %s", uid, err, b)
		}
	}
}
