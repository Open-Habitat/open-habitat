//go:build linux

package daemon

import (
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"
)

// Invoked only by test-proc-hidepid-uids.sh in a disposable PID/mount namespace.
func TestProcHidepidDistinctUIDs(t *testing.T) {
	if os.Getenv("PROC_HIDEPID_UID_CONTAINER") != "1" {
		t.Skip("requires isolated hidepid UID fixture")
	}
	if os.Getenv("PROC_HIDEPID_PROBE") == "1" {
		own, _ := strconv.Atoi(os.Getenv("PROC_OWN_PID"))
		foreign := os.Getenv("PROC_FOREIGN_PID")
		exempt := os.Getenv("PROC_EXEMPT") == "1"
		for _, field := range []string{"cmdline", "stat"} {
			_, err := os.ReadFile("/proc/" + foreign + "/" + field)
			if exempt && err != nil {
				t.Fatalf("exempt observer cannot read %s: %v", field, err)
			}
			if !exempt && !os.IsNotExist(err) {
				t.Fatalf("foreign %s not invisible: %v", field, err)
			}
		}
		if exempt {
			return
		}
		entries, err := os.ReadDir("/proc")
		if err != nil {
			t.Fatal(err)
		}
		for _, entry := range entries {
			if _, err := strconv.Atoi(entry.Name()); err != nil {
				continue
			}
			info, err := os.Stat(filepath.Join("/proc", entry.Name()))
			if os.IsNotExist(err) {
				continue
			}
			if err != nil {
				t.Fatal(err)
			}
			uid, ok := fileOwner(info)
			if !ok || uid != os.Geteuid() {
				t.Fatalf("foreign process visible: %s", entry.Name())
			}
		}
		out, err := exec.Command("ps", "-e", "-o", "pid=").Output()
		if err != nil {
			t.Fatal(err)
		}
		for _, pid := range strings.Fields(string(out)) {
			if pid == foreign {
				t.Fatal("ps exposes foreign process")
			}
		}
		dir := os.Getenv("PROC_WORKSPACE")
		inside, unreadable, complete := scanWorkspaceProcesses("/proc", dir, os.Geteuid(), nil)
		found := false
		for _, p := range inside {
			if p.PID == own {
				found = true
			}
		}
		if !found || !complete || len(unreadable) != 0 {
			t.Fatalf("trash busy-check lost own process: inside=%v unreadable=%v complete=%v", inside, unreadable, complete)
		}
		if got := piWriter(filepath.Join(dir, "session.jsonl"), dir, os.Geteuid()); got != "not_observed" {
			t.Fatalf("hidden foreign processes made Pi writer observation uncertain: %s", got)
		}
		return
	}
	if os.Geteuid() != 0 {
		t.Fatal("requires namespace root")
	}
	base, err := os.MkdirTemp("/var/tmp", "proc-hidepid-uids-")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(base)
	os.Chmod(base, 0755)
	// Run Ubuntu's actual polkitd with the supplementary group shipped in its
	// drop-in, but no broad ptrace capability. D-Bus is private to this container.
	polkitUID, _ := strconv.Atoi(os.Getenv("PROC_POLKIT_UID"))
	polkitGID, _ := strconv.Atoi(os.Getenv("PROC_POLKIT_GID"))
	if polkitUID <= 0 || polkitGID <= 0 {
		t.Fatal("missing polkit service identity")
	}
	polkit := exec.Command("/usr/lib/polkit-1/polkitd", "--no-debug")
	polkit.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uint32(polkitUID), Gid: uint32(polkitGID), Groups: []uint32{21004}}}
	if err := polkit.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { polkit.Process.Kill(); polkit.Wait() }()
	deadline := time.Now().Add(5 * time.Second)
	for {
		err := exec.Command("dbus-send", "--system", "--print-reply", "--dest=org.freedesktop.DBus", "/org/freedesktop/DBus", "org.freedesktop.DBus.GetNameOwner", "string:org.freedesktop.PolicyKit1").Run()
		if err == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("polkit D-Bus name unavailable")
		}
		time.Sleep(20 * time.Millisecond)
	}
	type person struct {
		uid uint32
		dir string
		cmd *exec.Cmd
	}
	people := []person{{uid: 21001}, {uid: 21002}}
	for i := range people {
		p := &people[i]
		p.dir = filepath.Join(base, strconv.Itoa(int(p.uid)))
		if err := os.Mkdir(p.dir, 0700); err != nil {
			t.Fatal(err)
		}
		os.Chown(p.dir, int(p.uid), int(p.uid))
		session := filepath.Join(p.dir, "session.jsonl")
		os.WriteFile(session, []byte("{}\n"), 0600)
		os.Chown(session, int(p.uid), int(p.uid))
		p.cmd = exec.Command("/usr/bin/sleep", "60")
		p.cmd.Dir = p.dir
		p.cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: p.uid, Gid: p.uid}}
		if err := p.cmd.Start(); err != nil {
			t.Fatal(err)
		}
		defer func(cmd *exec.Cmd) { cmd.Process.Kill(); cmd.Wait() }(p.cmd)
	}
	for i, p := range people {
		foreign := people[1-i].cmd.Process.Pid
		probe := exec.Command(os.Args[0], "-test.run=^TestProcHidepidDistinctUIDs$", "-test.v")
		probe.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: p.uid, Gid: p.uid}}
		probe.Env = append(os.Environ(), "PROC_HIDEPID_PROBE=1", "PROC_OWN_PID="+strconv.Itoa(p.cmd.Process.Pid), "PROC_FOREIGN_PID="+strconv.Itoa(foreign), "PROC_WORKSPACE="+p.dir)
		if b, err := probe.CombinedOutput(); err != nil {
			t.Fatalf("UID %d: %v\n%s", p.uid, err, b)
		}
		check := exec.Command("pkcheck", "--action-id", "org.openhabitat.fixture", "--process", strconv.Itoa(p.cmd.Process.Pid))
		check.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: p.uid, Gid: p.uid}}
		if b, err := check.CombinedOutput(); err != nil {
			t.Fatalf("polkit could not resolve UID %d process subject: %v %s", p.uid, err, b)
		}
		t.Logf("UID %d: foreign proc/ps invisible; own trash scan and Pi observation work", p.uid)
	}
	probe := exec.Command(os.Args[0], "-test.run=^TestProcHidepidDistinctUIDs$", "-test.v")
	probe.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: 21003, Gid: 21003, Groups: []uint32{21004}}}
	probe.Env = append(os.Environ(), "PROC_HIDEPID_PROBE=1", "PROC_EXEMPT=1", "PROC_FOREIGN_PID="+strconv.Itoa(people[0].cmd.Process.Pid))
	if b, err := probe.CombinedOutput(); err != nil {
		t.Fatalf("gid exemption: %v\n%s", err, b)
	}
	t.Log("Only the supplementary gid=21004 observer can read foreign stat/cmdline")
}
