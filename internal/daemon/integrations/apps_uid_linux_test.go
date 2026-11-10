//go:build linux

package integrations

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"

	"github.com/open-habitat/open-habitat/internal/integrationapps"
	"github.com/open-habitat/open-habitat/internal/provision"
)

// TestBrokerAppReachesAnotherUsersDaemon runs only inside
// scripts/test-integration-apps-uids.sh's disposable, networkless rootless
// container, as the container's root, with the production paths: the
// broker's writer edits /opt/open-habitat/integrations.json under
// /var/lib/open-habitat/host's lock, exactly as on a host. A second real
// kernel UID then runs this daemon package's own catalog against that file:
// Google is waiting for app credentials before the set, available after it,
// and waiting again after the clear. That UID can read the file but neither
// write it nor ask anything of the broker.
func TestBrokerAppReachesAnotherUsersDaemon(t *testing.T) {
	if os.Getenv("INTEGRATION_APPS_UID_CONTAINER") != "1" {
		t.Skip("requires the disposable rootless container of scripts/test-integration-apps-uids.sh")
	}
	if os.Geteuid() != 0 {
		t.Fatal("the container proof runs as the container's root, like the broker")
	}
	const person = 2100
	if out, err := exec.Command("/usr/sbin/useradd", "--uid", "2100", "--create-home", "--shell", "/usr/sbin/nologin", "person").CombinedOutput(); err != nil {
		t.Fatalf("synthetic account: %v %s", err, out)
	}
	// The installation as host apply leaves it: root's tools and file, the
	// operation lock directory and the broker's private state.
	bin := "/opt/open-habitat/profiles/integrations/bin"
	for _, d := range []struct {
		path string
		mode os.FileMode
	}{{bin, 0755}, {provision.HostOperationDir, 0700}, {"/var/lib/open-habitat/broker", 0700}} {
		if err := os.MkdirAll(d.path, d.mode); err != nil {
			t.Fatal(err)
		}
		os.Chmod(d.path, d.mode)
	}
	for _, tool := range []string{"rclone", "gog"} {
		if err := os.WriteFile(filepath.Join(bin, tool), []byte("#!/bin/sh\nexit 0\n"), 0755); err != nil {
			t.Fatal(err)
		}
		os.Chmod(filepath.Join(bin, tool), 0755)
	}
	tools := `{"tools":{"rclone":"` + bin + `/rclone","gog":"` + bin + `/gog"}}` + "\n"
	if err := os.WriteFile(integrationapps.Path, []byte(tools), 0644); err != nil {
		t.Fatal(err)
	}
	os.Chmod(integrationapps.Path, 0644)

	w := provision.NewWriter("/var/lib/open-habitat/broker", 2100, 2110, provision.NewLinuxHostExecutor(1001, 1002))
	write := func(r provision.Request) {
		t.Helper()
		if reply := w.Handle(context.Background(), r); reply.Failure != "" || reply.Integrations == nil {
			t.Fatalf("%s: %+v", r.Operation, reply)
		}
	}
	// The person's daemon, run as the person: its catalog's word on Google.
	reason := func() string {
		t.Helper()
		cmd := exec.Command(os.Args[0], "-test.run", "^TestBrokerAppAsPerson$")
		cmd.Env = []string{"INTEGRATION_APPS_PERSON=1", "HOME=/home/person"}
		cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: person, Gid: person}}
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("person's catalog: %v %s", err, out)
		}
		for _, line := range strings.Split(string(out), "\n") {
			if r, ok := strings.CutPrefix(line, "google: "); ok {
				return r
			}
		}
		t.Fatalf("no verdict: %s", out)
		return ""
	}
	if r := reason(); r != "app_credentials_required" {
		t.Fatalf("before set: %s", r)
	}
	write(provision.Request{Version: 1, Operation: provision.OpIntegrationSet, Provider: "google", ID: "0", Actor: "42", Fields: map[string]string{"client_id": "704213598812-k3v9q2mfa0b7s1dn5e8rjhtc4lpu6xwo.apps.googleusercontent.com", "client_secret": "GOCSPX-synthetic"}})
	if r := reason(); r != "available" {
		t.Fatalf("after set: %s", r)
	}
	b, err := os.ReadFile(integrationapps.Path)
	if err != nil || !strings.HasPrefix(string(b), strings.TrimSuffix(tools, "}\n")) {
		t.Fatalf("tools section changed: %s", b)
	}
	write(provision.Request{Version: 1, Operation: provision.OpIntegrationClear, Provider: "google", ID: "0", Actor: "42"})
	if r := reason(); r != "app_credentials_required" {
		t.Fatalf("after clear: %s", r)
	}
	if b, _ = os.ReadFile(integrationapps.Path); string(b) != tools {
		t.Fatalf("clear left other bytes changed: %q", b)
	}
}

// TestBrokerAppAsPerson is the person's side of the proof above, run by it
// as the second UID. It reads the production file with the daemon's own
// trust checks and also tries to write it, which must fail.
func TestBrokerAppAsPerson(t *testing.T) {
	if os.Getenv("INTEGRATION_APPS_PERSON") != "1" {
		t.Skip("run by TestBrokerAppReachesAnotherUsersDaemon as the second UID")
	}
	if os.Geteuid() == 0 {
		t.Fatal("must run as the person")
	}
	if f, err := os.OpenFile(integrationapps.Path, os.O_WRONLY, 0); err == nil {
		f.Close()
		t.Fatal("the person could open root's integrations file for writing")
	}
	if _, err := os.Stat(filepath.Join(provision.HostOperationDir, ".")); err == nil {
		t.Fatal("the person could look inside the host operation lock directory")
	}
	env := Env{Home: os.Getenv("HOME"), LoadConfig: func() (Config, error) { return LoadConfig(nil) }}
	g := &google{}
	verdict := UnavailableReason(g, env)
	if verdict == "" {
		verdict = "available"
	}
	os.Stdout.WriteString("google: " + verdict + "\n")
}
