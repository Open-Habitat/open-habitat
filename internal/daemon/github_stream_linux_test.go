//go:build linux

package daemon

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func streamFixture(t *testing.T) (transport.Config, string, string, cloneRunner) {
	t.Helper()
	cfg, home := cloneFixture(t)
	cfg.Home = home
	if err := os.Mkdir(filepath.Join(home, "src"), 0700); err != nil {
		t.Fatal(err)
	}
	script := filepath.Join(home, "git")
	// No provider calls or real GitHub credentials; all native text is hostile.
	code := "#!/bin/sh\nif [ \"$1\" = clone ]; then\n printf 'remote: credential https://bad:token@example.invalid/private\\rReceiving objects: 17%% (1/6), 1.25 MiB\\rUpdating files: 100%% (6/6)\\n' >&2\n mkdir .git\n exit 0\nfi\nexit 9\n"
	if err := os.WriteFile(script, []byte(code), 0700); err != nil {
		t.Fatal(err)
	}
	run := func(_ context.Context, program, _, _ string, args ...string) ([]byte, error) {
		if program == "gh" {
			if args[len(args)-1] == "/user" {
				return []byte(`{"id":42}`), nil
			}
			return []byte(`{"name":"repo","full_name":"org/repo","owner":{"login":"org"},"clone_url":"https://github.com/org/repo.git"}`), nil
		}
		switch args[0] {
		case "rev-parse":
			if args[len(args)-1] == "HEAD^{commit}" {
				return []byte("0123456789abcdef0123456789abcdef01234567\n"), nil
			}
			return []byte("true\n"), nil
		case "remote":
			return []byte("https://github.com/org/repo.git\n"), nil
		case "status":
			return nil, nil
		}
		return nil, context.Canceled
	}
	return cfg, home, script, run
}
func streamRequest() *http.Request {
	r := cloneRequest(`{"full_name":"org/repo"}`)
	r.URL.Path = RepoCloneStreamPath
	r.RequestURI = RepoCloneStreamPath
	return r
}
func TestCloneStreamNativeStagesAndBudget(t *testing.T) {
	cfg, home, script, run := streamFixture(t)
	h := repoCloneStreamHandler(cfg, func(*http.Request) bool { return true }, home, "gh", script, run, func(int) bool { return false })
	w := httptest.NewRecorder()
	h.ServeHTTP(w, streamRequest())
	if w.Code != 409 || strings.Contains(w.Body.String(), "event:") {
		t.Fatalf("budget admission: %d %s", w.Code, w.Body.String())
	}
	if _, err := os.Stat(filepath.Join(home, "src", "repo")); !os.IsNotExist(err) {
		t.Fatalf("destination written before budget: %v", err)
	}
	h = repoCloneStreamHandler(cfg, func(*http.Request) bool { return true }, home, "gh", script, run, func(int) bool { return true })
	w = httptest.NewRecorder()
	h.ServeHTTP(w, streamRequest())
	data := w.Body.String()
	if w.Code != 200 || !strings.Contains(data, `"stage":"receiving","percent":17`) || !strings.Contains(data, `"received_bytes":1310720`) || !strings.Contains(data, `"stage":"checkout","percent":100`) || !strings.Contains(data, `"outcome":"confirmed"`) {
		t.Fatalf("stream: %d %s", w.Code, data)
	}
	if strings.Contains(data, "credential") || strings.Contains(data, "example.invalid") {
		t.Fatal("native stderr leaked")
	}
	w = httptest.NewRecorder()
	h.ServeHTTP(w, streamRequest())
	if w.Code != 409 || !strings.Contains(w.Body.String(), "checkout_exists") {
		t.Fatalf("partial collision: %d %s", w.Code, w.Body.String())
	}
}
func TestCloneStreamCancellationKeepsUncertainTree(t *testing.T) {
	cfg, home, _, run := streamFixture(t)
	script := filepath.Join(home, "slow-git")
	slow := "#!/bin/sh\n/usr/bin/git init -q . || exit 1\n/usr/bin/git remote add origin https://github.com/org/repo.git || exit 1\nprintf 'ready' > '" + filepath.Join(home, "clone-ready") + "'\nprintf 'Receiving objects: 1%%\\r' >&2\nexec /bin/sleep 30\n"
	if err := os.WriteFile(script, []byte(slow), 0700); err != nil {
		t.Fatal(err)
	}
	h := repoCloneStreamHandler(cfg, func(*http.Request) bool { return true }, home, "gh", script, run, func(int) bool { return true })
	ctx, cancel := context.WithCancel(context.Background())
	r := streamRequest().WithContext(ctx)
	w := httptest.NewRecorder()
	finished := make(chan struct{})
	go func() { defer close(finished); h.ServeHTTP(w, r) }()
	// Wait until the synthetic process has written to the reserved directory.
	deadline := time.After(3 * time.Second)
	for {
		if _, err := os.Stat(filepath.Join(home, "clone-ready")); err == nil {
			break
		}
		select {
		case <-deadline:
			cancel()
			<-finished
			t.Fatal("native clone did not start")
		case <-time.After(10 * time.Millisecond):
		}
	}
	cancel()
	select {
	case <-finished:
	case <-time.After(3 * time.Second):
		t.Fatal("native group did not settle on disconnect")
	}
	if _, err := os.Stat(filepath.Join(home, "src", "repo")); err != nil {
		t.Fatal("cancelled tree removed")
	}
	if strings.Contains(w.Body.String(), `"outcome":"confirmed"`) {
		t.Fatal("cancelled clone confirmed")
	}
	if got := observeCheckout(context.Background(), cfg, home, "/usr/bin/git", cloneCommand, "org/repo"); got != "conflict" {
		t.Fatalf("partial native Git tree promoted to %s", got)
	}
}

func TestCloneStreamRejectsUnreadableQuota(t *testing.T) {
	cfg, home, script, run := streamFixture(t)
	// A CI host may have a valid quota for the test UID. Model an unreadable
	// quota explicitly instead of relying on the runner's mount configuration.
	h := repoCloneStreamHandler(cfg, func(*http.Request) bool { return true }, home, "gh", script, run, func(int) bool { return false })
	w := httptest.NewRecorder()
	h.ServeHTTP(w, streamRequest())
	if w.Code != 409 || strings.Contains(w.Body.String(), "event:") {
		t.Fatalf("unavailable quota admitted: %d %s", w.Code, w.Body.String())
	}
	if _, err := os.Stat(filepath.Join(home, "src", "repo")); !os.IsNotExist(err) {
		t.Fatalf("unsafe write: %v", err)
	}
}

func TestNativeProgressParserDiscardsHostileAndOversizedLines(t *testing.T) {
	w := httptest.NewRecorder()
	emit := &cloneEmitter{w: w, cancel: func() {}}
	parser := &gitProgressWriter{emit: emit}
	hostile := "Receiving objects: 101% https://user:password@example.invalid\r" + strings.Repeat("x", 513) + "Receiving objects: 49%\r" + "remote: Updating files: 20% /home/private\r" + "Receiving objects: 0% (0/10)\r"
	for _, chunk := range []string{hostile[:13], hostile[13:]} {
		if _, err := parser.Write([]byte(chunk)); err != nil {
			t.Fatal(err)
		}
	}
	if strings.Contains(w.Body.String(), "password") || strings.Contains(w.Body.String(), "private") || strings.Contains(w.Body.String(), "49") || strings.Contains(w.Body.String(), "101") || !strings.Contains(w.Body.String(), `"percent":0`) {
		t.Fatal(w.Body.String())
	}
}

func TestCloneStreamRejectsReadableSharedSource(t *testing.T) {
	cfg, home, script, run := streamFixture(t)
	if err := os.Chmod(filepath.Join(home, "src"), 0755); err != nil {
		t.Fatal(err)
	}
	h := repoCloneStreamHandler(cfg, func(*http.Request) bool { return true }, home, "gh", script, run, func(int) bool { return true })
	w := httptest.NewRecorder()
	h.ServeHTTP(w, streamRequest())
	if w.Code != 409 {
		t.Fatalf("shared source admitted: %d %s", w.Code, w.Body.String())
	}
	if _, err := os.Stat(filepath.Join(home, "src", "repo")); !os.IsNotExist(err) {
		t.Fatalf("directory created: %v", err)
	}
}

func TestCloneTerminalClosesHeartbeatAndLastCheckoutMeasurement(t *testing.T) {
	w := httptest.NewRecorder()
	emit := &cloneEmitter{w: w, cancel: func() {}}
	p := &gitProgressWriter{emit: emit}
	for _, stage := range []string{"Receiving objects", "Updating files"} {
		for n := 0; n <= 100; n++ {
			if _, e := p.Write([]byte(fmt.Sprintf("%s: %d%% (fixture)\r", stage, n))); e != nil {
				t.Fatal(e)
			}
		}
	}
	if !strings.Contains(w.Body.String(), `"stage":"checkout","percent":100`) {
		t.Fatal("checkout 100% dropped by frame budget")
	}
	emit.terminal("confirmed", "")
	before := w.Body.String()
	emit.heartbeat()
	if w.Body.String() != before {
		t.Fatal("heartbeat emitted after terminal")
	}
}

func TestCloneStreamSyntheticDiskExhaustionIsUncertain(t *testing.T) {
	cfg, home, _, run := streamFixture(t)
	script := filepath.Join(home, "full-disk-git")
	code := "#!/bin/sh\nmkdir .git\nprintf 'No space left on device: https://user:secret@invalid.example/private\\n' >&2\nexit 1\n"
	if err := os.WriteFile(script, []byte(code), 0700); err != nil {
		t.Fatal(err)
	}
	h := repoCloneStreamHandler(cfg, func(*http.Request) bool { return true }, home, "gh", script, run, func(int) bool { return true })
	w := httptest.NewRecorder()
	h.ServeHTTP(w, streamRequest())
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"outcome":"uncertain","reason":"native_failure"`) || strings.Contains(w.Body.String(), "secret") || strings.Contains(w.Body.String(), "invalid.example") {
		t.Fatalf("disk failure leaked or confirmed: %d %s", w.Code, w.Body.String())
	}
	if _, err := os.Stat(filepath.Join(home, "src", "repo", ".git")); err != nil {
		t.Fatal("partial directory removed", err)
	}
	w = httptest.NewRecorder()
	h.ServeHTTP(w, streamRequest())
	if w.Code != 409 || !strings.Contains(w.Body.String(), "checkout_exists") {
		t.Fatalf("partial tree retried: %d %s", w.Code, w.Body.String())
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
	emit := &cloneEmitter{w: httptest.NewRecorder(), cancel: cancel}
	result := make(chan error, 1)
	go func() {
		result <- cloneProgressCommand(ctx, script, home, int(fd.Fd()), "https://github.com/fixture/repo.git", emit)
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
		if os.IsNotExist(err) {
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
