//go:build linux

package provision

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"
)

func TestLinuxExecutorRejectsBadAuthorityBeforeCommands(t *testing.T) {
	count := 0
	e := NewLinuxHostExecutor(0, 99)
	e.run = func(context.Context, string, ...string) ([]byte, error) { count++; return nil, nil }
	if ok, err := e.Available(context.Background(), "alice", 21000); ok || err == nil {
		t.Fatal(ok, err)
	}
	e.GatewayUID = 1001
	for _, name := range []string{"../alice", "Alice", "alice/bob", ""} {
		if ok, err := e.Available(context.Background(), name, 21000); ok || err == nil {
			t.Fatal(name, ok, err)
		}
	}
	if ok, err := e.Available(context.Background(), "alice", 0); ok || err == nil {
		t.Fatal(ok, err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if ok, err := e.Available(ctx, "alice", 21000); ok || err == nil {
		t.Fatal(ok, err)
	}
	if count != 0 {
		t.Fatal("executed with invalid authority")
	}
}
func TestLinuxExecutorNSSCollisionAndFailure(t *testing.T) {
	e := NewLinuxHostExecutor(1001, 1002)
	calls := 0
	e.run = func(_ context.Context, path string, args ...string) ([]byte, error) {
		calls++
		if path != getent {
			t.Fatalf("unexpected command %s", path)
		}
		if len(args) != 2 {
			t.Fatal(args)
		}
		if args[0] == "passwd" && args[1] == "alice" {
			return []byte("alice:x:21000:21000::/home/alice:/usr/sbin/nologin\n"), nil
		}
		t.Fatal("continued after name collision")
		return nil, nil
	}
	ok, err := e.Available(context.Background(), "alice", 21000)
	if ok || err != nil || calls != 1 {
		t.Fatal(ok, err, calls)
	}
	e.run = func(context.Context, string, ...string) ([]byte, error) { return nil, errors.New("NSS unavailable") }
	if ok, err = e.Available(context.Background(), "carol", 21000); ok || err != availabilityGuard("nss_probe") {
		t.Fatal(ok, err)
	}
}
func TestLinuxExecutorExactNSSIdentity(t *testing.T) {
	e := NewLinuxHostExecutor(1001, 1002)
	i := ExecutorIdentity{provider: "github", id: "42", username: "carol", uid: 21000}
	rows := map[string]string{
		"passwd carol":     "carol:x:21000:21000::/home/carol:/usr/sbin/nologin\n",
		"passwd 21000":     "carol:x:21000:21000::/home/carol:/usr/sbin/nologin\n",
		"group carol":      "carol:x:21000:\n",
		"group 21000":      "carol:x:21000:\n",
		"initgroups carol": "carol \n",
	}
	e.run = func(_ context.Context, path string, args ...string) ([]byte, error) {
		if path != getent {
			t.Fatal(path)
		}
		return []byte(rows[strings.Join(args, " ")]), nil
	}
	if err := e.identity(context.Background(), i); err != nil {
		t.Fatal(err)
	}
	rows["passwd 21000"] = "bob:x:21000:21000::/home/bob:/usr/sbin/nologin\n"
	if err := e.identity(context.Background(), i); err == nil {
		t.Fatal("UID alias accepted")
	}
	rows["passwd 21000"] = rows["passwd carol"]
	rows["group 21000"] = "bob:x:21000:\n"
	if err := e.identity(context.Background(), i); err == nil {
		t.Fatal("GID alias accepted")
	}
	rows["group 21000"] = rows["group carol"]
	rows["passwd carol"] = "carol:x:21000:21000::/other:/usr/sbin/nologin\n"
	if err := e.identity(context.Background(), i); err == nil {
		t.Fatal("home drift accepted")
	}
	rows["passwd carol"] = rows["passwd 21000"]
	rows["initgroups carol"] = "carol 27\n"
	if err := e.identity(context.Background(), i); err == nil {
		t.Fatal("supplementary privilege accepted")
	}
}
func TestUnitAvailabilityMatchesTemplates(t *testing.T) {
	exit := func(code string) error { return exec.Command("/bin/sh", "-c", "exit "+code).Run() }
	e := NewLinuxHostExecutor(1001, 1002)
	e.run = func(_ context.Context, path string, args ...string) ([]byte, error) {
		if path != systemctl || len(args) != 2 {
			t.Fatalf("unexpected command: %s %v", path, args)
		}
		if args[0] == "is-active" {
			return []byte("inactive\n"), exit("3")
		}
		if strings.HasSuffix(args[1], ".service") {
			return []byte("static\n"), nil
		}
		return []byte("disabled\n"), exit("1")
	}
	for _, pair := range [][2]string{{"daemon@carol.socket", "disabled"}, {"daemon@carol.service", "static"}} {
		if err := e.inactiveUnit(context.Background(), pair[0], pair[1]); err != nil {
			t.Fatal(pair, err)
		}
	}
	if err := e.inactiveUnit(context.Background(), "daemon@carol.service", "disabled"); err == nil {
		t.Fatal("static service accepted as disabled")
	}
	e.run = func(_ context.Context, _ string, args ...string) ([]byte, error) {
		if args[0] == "is-active" {
			return []byte("active\n"), nil
		}
		return []byte("disabled\n"), exit("1")
	}
	if err := e.inactiveUnit(context.Background(), "daemon@carol.socket", "disabled"); err == nil {
		t.Fatal("active socket accepted")
	}
}
func TestCommandOutputIsBounded(t *testing.T) {
	out := &limitedOutput{}
	p := strings.Repeat("x", 100000)
	if n, err := out.Write([]byte(p)); n != len(p) || err != nil || !out.truncated || out.Len() != 8193 {
		t.Fatal(n, err, out.Len(), out.truncated)
	}
}
func TestEffectiveListenerRejectsWhitespaceDropInOverride(t *testing.T) {
	path := socketFor("carol")
	if !singleUnixListener([]byte("Listen="+path+" (Stream)\n"), path) {
		t.Fatal("expected single Unix listener rejected")
	}
	for _, output := range []string{
		"Listen=" + path + " (Stream)\nListen=0.0.0.0:9999 (Stream)\n",
		"Listen=0.0.0.0:9999 (Stream)\n",
		"Listen=" + path + " (Datagram)\n",
		"Listen=\n",
	} {
		if singleUnixListener([]byte(output), path) {
			t.Fatal("accepted overridden listener", output)
		}
	}
}
func TestEffectivePropertiesRejectOverrides(t *testing.T) {
	want := map[string]string{"SocketMode": "0660", "DirectoryMode": "0710"}
	if !properties([]byte("SocketMode=0660\nDirectoryMode=0710\n"), want) {
		t.Fatal("valid properties rejected")
	}
	for _, output := range []string{"SocketMode=0666\nDirectoryMode=0710\n", "SocketMode=0660\n", "SocketMode=0660\nSocketMode=0660\nDirectoryMode=0710\n"} {
		if properties([]byte(output), want) {
			t.Fatal("accepted unsafe effective properties", output)
		}
	}
}
func TestLinuxCommandBoundsAndCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	start := time.Now()
	if _, err := linuxCommand(ctx, "/usr/bin/sleep", "10"); err == nil || time.Since(start) > time.Second {
		t.Fatal("cancellation ignored", err)
	}
	if os.Geteuid() != 0 {
		e := NewLinuxHostExecutor(1001, 1002)
		if err := e.Step(context.Background(), "account", ExecutorIdentity{provider: "github", id: "42", username: "carol", uid: 21000}); err == nil {
			t.Fatal("non-root mutation accepted")
		}
	}
	// Non-zero status other than getent's definitive exit 2 cannot be treated
	// as an available name, including exec failures and timeout.
	e := NewLinuxHostExecutor(1001, 1002)
	e.run = func(context.Context, string, ...string) ([]byte, error) { return nil, &exec.ExitError{} }
	if ok, err := e.Available(context.Background(), "carol", 21000); ok || err == nil {
		t.Fatal(ok, err)
	}
}

func TestSocketActivationDependencyIsExact(t *testing.T) {
	gate := "native-agent-host-jit-policy-gate@carol.service"
	if !unitDependency([]byte("Requires="+gate+" other.service\nAfter=other.service "+gate+"\n"), "Requires", gate) || !unitDependency([]byte("Requires="+gate+"\nAfter="+gate+"\n"), "After", gate) {
		t.Fatal("valid gate rejected")
	}
	for _, got := range []string{"", "native-agent-host-jit-policy-gate@bob.service", "fake" + gate} {
		if unitDependency([]byte("Requires="+got+"\n"), "Requires", gate) {
			t.Fatal("wrong gate accepted", got)
		}
	}
}

func TestExactGateExec(t *testing.T) {
	good := "ExecStart={ path=/usr/bin/python3 ; argv[]=/usr/bin/python3 /usr/local/libexec/native-agent-host-test-jit/jit_policy.py verify --phase activation --target daemon:carol --json ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }\n"
	if !exactGateExec([]byte(good), "carol") {
		t.Fatal("valid gate rejected")
	}
	for _, bad := range []string{
		strings.Replace(good, "daemon:carol", "daemon:bob", 1),
		strings.Replace(good, " --json ;", " --json --root /tmp ;", 1),
		strings.Replace(good, "ignore_errors=no", "ignore_errors=yes", 1),
		strings.Replace(good, " }", " } { path=/bin/true ; argv[]=/bin/true ; ignore_errors=no }", 1),
	} {
		if exactGateExec([]byte(bad), "carol") {
			t.Fatal("unsafe gate accepted", bad)
		}
	}
}

func TestRouteReadyDoesNotStartOrAdoptMissingSocket(t *testing.T) {
	e := NewLinuxHostExecutor(21003, 21003)
	i := ExecutorIdentity{provider: "github", id: "42", username: "uncreated_guest_foo", uid: 21032}
	for _, state := range []string{"inactive", "active"} {
		e.run = func(_ context.Context, path string, args ...string) ([]byte, error) {
			if path != systemctl || len(args) != 2 || args[0] != "is-active" {
				t.Fatalf("unexpected mutation: %s %v", path, args)
			}
			return []byte(state + "\n"), nil
		}
		if e.RouteReady(context.Background(), i) == nil {
			t.Fatal("accepted missing socket", state)
		}
	}
}

func TestGateExecutionIsBlockingAndHasNoOtherRootCommands(t *testing.T) {
	good := "LoadState=loaded\nUser=root\nType=oneshot\nRemainAfterExit=no\n"
	if !gateProperties([]byte(good)) || !gateProperties([]byte(good+"ExecStartPre=\n")) {
		t.Fatal("valid gate rejected")
	}
	for _, bad := range []string{
		strings.Replace(good, "Type=oneshot", "Type=simple", 1),
		strings.Replace(good, "RemainAfterExit=no", "RemainAfterExit=yes", 1),
		good + "ExecStartPre=/bin/true\n", good + "ExecCondition=/bin/true\n",
		good + "ExecStartPost=/bin/true\n", good + "ExecReload=/bin/true\n", good + "ExecStop=/bin/true\n", good + "ExecStopPost=/bin/true\n",
		good + "ExecStartPre=\n path=/bin/true\n",
	} {
		if gateProperties([]byte(bad)) {
			t.Fatal("unsafe gate accepted", bad)
		}
	}
}
