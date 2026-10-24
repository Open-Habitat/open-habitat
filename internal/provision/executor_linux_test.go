//go:build linux

package provision

import (
	"context"
	"errors"
	"net"
	"os"
	"os/exec"
	"path/filepath"
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
	gate := "open-habitat-binding@carol.service"
	if !unitDependency([]byte("Requires="+gate+" other.service\nAfter=other.service "+gate+"\n"), "Requires", gate) || !unitDependency([]byte("Requires="+gate+"\nAfter="+gate+"\n"), "After", gate) {
		t.Fatal("valid gate rejected")
	}
	for _, got := range []string{"", "open-habitat-binding@bob.service", "fake" + gate} {
		if unitDependency([]byte("Requires="+got+"\n"), "Requires", gate) {
			t.Fatal("wrong gate accepted", got)
		}
	}
}

func TestExactGateExec(t *testing.T) {
	good := "ExecStart={ path=/opt/open-habitat/current/open-habitat ; argv[]=/opt/open-habitat/current/open-habitat binding-activation-check carol ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }\n"
	if !exactGateExec([]byte(good), "carol") {
		t.Fatal("valid gate rejected")
	}
	for _, bad := range []string{
		strings.Replace(good, "check carol", "check bob", 1),
		strings.Replace(good, " carol ;", " carol --root /tmp ;", 1),
		strings.Replace(good, "ignore_errors=no", "ignore_errors=yes", 1),
		strings.Replace(good, " }", " } { path=/bin/true ; argv[]=/bin/true ; ignore_errors=no }", 1),
	} {
		if exactGateExec([]byte(bad), "carol") {
			t.Fatal("unsafe gate accepted", bad)
		}
	}
}

func TestSubmittedSocketStartObservesOwnDeadline(t *testing.T) {
	e := NewLinuxHostExecutor(1001, 1002)
	ctx, cancel := context.WithCancel(context.Background())
	calls := 0
	e.run = func(commandCtx context.Context, path string, args ...string) ([]byte, error) {
		calls++
		if path != systemctl || len(args) != 2 || args[0] != "start" || args[1] != "open-habitat-daemon@carol.socket" {
			t.Fatalf("wrong start command: %s %v", path, args)
		}
		cancel() // caller's exchange expires while systemd is still starting
		if commandCtx.Err() != nil {
			t.Fatal("submitted start canceled by browser exchange")
		}
		return nil, nil // systemd confirms that the socket is active
	}
	if err := e.startSocket(ctx, "open-habitat-daemon@carol.socket"); err != nil || calls != 1 {
		t.Fatalf("completed start latched broker: %v, calls=%d", err, calls)
	}
	if err := e.startSocket(ctx, "open-habitat-daemon@carol.socket"); err == nil || calls != 1 {
		t.Fatalf("start submitted after caller cancellation: %v, calls=%d", err, calls)
	}
	e.run = func(context.Context, string, ...string) ([]byte, error) {
		return nil, context.DeadlineExceeded // dedicated command budget elapsed
	}
	if err := e.startSocket(context.Background(), "open-habitat-daemon@carol.socket"); !errors.Is(err, errActivationUncertain) {
		t.Fatalf("lost uncertain systemd outcome: %v", err)
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

// The boot start of a syncing person's daemon is the broker's only service
// start. It is never submitted for a binding that does not verify or whose
// socket is not active, and never as anyone but root.
func TestStartDaemonRequiresVerifiedActiveSocket(t *testing.T) {
	e := NewLinuxHostExecutor(21003, 21003)
	e.run = func(_ context.Context, path string, args ...string) ([]byte, error) {
		if len(args) > 0 && args[0] == "start" {
			t.Fatalf("submitted %s %v", path, args)
		}
		return nil, &exec.ExitError{}
	}
	i := ExecutorIdentity{provider: "github", id: "42", username: "uncreated_guest_foo", uid: 21032}
	if e.StartDaemon(context.Background(), i) == nil {
		t.Fatal("started an unverified daemon")
	}
	// Past Verify, an inactive socket, or an active unit without the
	// verified socket inode, submits nothing either.
	for _, state := range []string{"inactive", "active"} {
		e.run = func(_ context.Context, path string, args ...string) ([]byte, error) {
			if path != systemctl || len(args) != 2 || args[0] != "is-active" {
				t.Fatalf("submitted %s %v", path, args)
			}
			return []byte(state + "\n"), nil
		}
		if e.startOnActiveSocket(context.Background(), i) == nil {
			t.Fatal("started a daemon without its active socket", state)
		}
	}
	if os.Geteuid() != 0 {
		if _, err := e.SyncAtBoot(context.Background(), i); err == nil {
			t.Fatal("looked into a home without root")
		}
	}
}

func TestAgentUnitEffectivePolicy(t *testing.T) {
	e := NewLinuxHostExecutor(21003, 21003)
	i := ExecutorIdentity{username: "carol", uid: 21001}
	good := "SocketMode=0600\nDirectoryMode=0710\nSocketUser=carol\nSocketGroup=carol\nRemoveOnStop=yes\nFileDescriptorName=agent\nTriggers=open-habitat-daemon@carol.service\nListen=/run/open-habitat/users/carol/agent.sock (Stream)\n"
	for _, b := range []string{good, strings.Replace(good, "0600", "0660", 1), strings.Replace(good, "Triggers=open-habitat-daemon@carol.service", "Triggers=other.service", 1), good + "SocketMode=0600\n", strings.Replace(good, "agent.sock (Stream)", "0.0.0.0:80 (Stream)", 1)} {
		e.run = func(_ context.Context, path string, args ...string) ([]byte, error) {
			if path != systemctl || args[0] != "show" || args[1] != "open-habitat-agent@carol.socket" {
				t.Fatalf("unexpected command %s %v", path, args)
			}
			return []byte(b), nil
		}
		if (e.agentUnit(context.Background(), i) == nil) != (b == good) {
			t.Fatalf("wrong policy verdict %q", b)
		}
	}
}

func TestAgentSocketRouteDistinctUIDs(t *testing.T) {
	if os.Getenv("AGENT_UID_CONTAINER") != "1" {
		t.Skip("requires disposable scripts/test-agent-uids.sh namespace")
	}
	if os.Geteuid() != 0 {
		t.Fatal("namespace root required")
	}
	name := "synthetic-agent-route"
	dir := filepath.Join(socketBase, name)
	if err := os.MkdirAll(dir, 0710); err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir)
	d, err := net.ListenUnix("unix", &net.UnixAddr{Name: socketFor(name), Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	os.Chown(socketFor(name), 21001, 21003)
	os.Chmod(socketFor(name), 0660)
	e := NewLinuxHostExecutor(21003, 21003)
	i := ExecutorIdentity{username: name, uid: 21001}
	starts := 0
	agentActive := true
	e.run = func(_ context.Context, path string, args ...string) ([]byte, error) {
		if path != systemctl {
			t.Fatalf("unexpected command %s", path)
		}
		if args[0] == "start" {
			starts++
			if args[1] != "open-habitat-daemon@"+name+".service" {
				t.Fatalf("wrong unit %v", args)
			}
			return nil, nil
		}
		if args[0] != "is-active" {
			t.Fatalf("unexpected command %v", args)
		}
		if args[1] == "open-habitat-agent@"+name+".socket" && !agentActive {
			return []byte("inactive\n"), nil
		}
		return []byte("active\n"), nil
	}
	if e.startOnActiveSocket(context.Background(), i) == nil || starts != 0 {
		t.Fatal("started with missing agent socket")
	}
	a, err := net.ListenUnix("unix", &net.UnixAddr{Name: agentSocketFor(name), Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	defer a.Close()
	os.Chown(agentSocketFor(name), 21001, 21001)
	os.Chmod(agentSocketFor(name), 0600)
	agentActive = false
	if e.startOnActiveSocket(context.Background(), i) == nil || starts != 0 {
		t.Fatal("started with inactive agent socket")
	}
	agentActive = true
	os.Chmod(agentSocketFor(name), 0660)
	if e.startOnActiveSocket(context.Background(), i) == nil || starts != 0 {
		t.Fatal("started with unsafe agent mode")
	}
	os.Chmod(agentSocketFor(name), 0600)
	if err := e.startOnActiveSocket(context.Background(), i); err != nil || starts != 1 {
		t.Fatalf("safe pair refused: %v starts %d", err, starts)
	}
}

// A boot can make systemd answer far slower than the request-time budget.
// Startup probes wait longer for the answer, but judge it exactly as before:
// a slow safe answer starts the broker and a slow unsafe one still refuses.
func TestStartupProbesTolerateOnlySlowness(t *testing.T) {
	e := NewLinuxHostExecutor(21003, 21003)
	i := ExecutorIdentity{username: "carol", uid: 21001}
	good := "SocketMode=0600\nDirectoryMode=0710\nSocketUser=carol\nSocketGroup=carol\nRemoveOnStop=yes\nFileDescriptorName=agent\nTriggers=open-habitat-daemon@carol.service\nListen=/run/open-habitat/users/carol/agent.sock (Stream)\n"
	answer := good
	// Each answer takes 4 s to arrive; a command whose budget is shorter
	// times out as linuxCommand would.
	e.run = func(ctx context.Context, path string, args ...string) ([]byte, error) {
		if commandBudget(ctx, path, args...) < 4*time.Second {
			return nil, context.DeadlineExceeded
		}
		return []byte(answer), nil
	}
	if e.agentUnit(context.Background(), i) == nil {
		t.Fatal("request-time probe outlived its budget")
	}
	boot := withStartupProbes(context.Background())
	if err := e.agentUnit(boot, i); err != nil {
		t.Fatal("slow but safe startup probe refused", err)
	}
	answer = strings.Replace(good, "0600", "0666", 1)
	if e.agentUnit(boot, i) == nil {
		t.Fatal("slow unsafe startup probe accepted")
	}
	// Startup raises short budgets only; longer ones are kept.
	for _, c := range []struct {
		args          []string
		plain, atBoot time.Duration
	}{
		{[]string{"show", "open-habitat-daemon@carol.socket"}, 3 * time.Second, startupProbeBudget},
		{[]string{"start", "open-habitat-daemon@carol.service"}, 15 * time.Second, startupProbeBudget},
		{[]string{"start", "open-habitat-daemon@carol.socket"}, 45 * time.Second, 45 * time.Second},
	} {
		if got := commandBudget(context.Background(), systemctl, c.args...); got != c.plain {
			t.Fatal("request budget", c.args, got)
		}
		if got := commandBudget(boot, systemctl, c.args...); got != c.atBoot {
			t.Fatal("startup budget", c.args, got)
		}
	}
}
