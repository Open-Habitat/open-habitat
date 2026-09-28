//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"
)

func TestPiRPCSynthetic(t *testing.T) {
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	if err := os.WriteFile(script, []byte(`#!/bin/sh
while IFS= read -r line; do
 id=$(printf '%s' "$line" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
 type=$(printf '%s' "$line" | sed -n 's/.*"type":"\([^"]*\)".*/\1/p')
 printf '{"id":"%s","type":"response","command":"%s","success":true}\n' "$id" "$type"
done
`), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	accepted, err := p.request("prompt", "synthetic message", 3*time.Second)
	if err != nil || !accepted {
		t.Fatalf("acknowledgement: %v %v", accepted, err)
	}
	if _, err := p.request("prompt", "", time.Second); err == nil {
		t.Fatal("empty message accepted")
	}
	if _, err := p.request("abort", "", time.Second); err == nil {
		t.Fatal("unsupported command accepted")
	}
}

func TestPiRPCEventsBeforeAndAfterAcknowledgement(t *testing.T) {
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	body := `#!/bin/sh
while IFS= read -r line; do
 id=$(printf '%s' "$line" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
 type=$(printf '%s' "$line" | sed -n 's/.*"type":"\([^"]*\)".*/\1/p')
 printf '{"type":"agent_start"}\n'
 printf '{"id":"%s","type":"response","command":"%s","success":true}\n' "$id" "$type"
 printf '{"type":"agent_end"}\n'
done
`
	if err := os.WriteFile(script, []byte(body), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	for i := 0; i < 2; i++ {
		ok, err := p.request("prompt", "once", time.Second)
		if err != nil || !ok {
			t.Fatalf("request %d: %v %v", i, ok, err)
		}
		for _, want := range []string{`"agent_start"`, `"agent_end"`} {
			select {
			case event := <-p.events:
				if !strings.Contains(string(event), want) {
					t.Fatalf("event %d: %s, want %s", i, event, want)
				}
			case <-time.After(time.Second):
				t.Fatalf("event %d missing: %s", i, want)
			}
		}
	}
}

func TestPiRPCEventOverflowPoisonsAcknowledgement(t *testing.T) {
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	body := `#!/bin/sh
read line
id=$(printf '%s' "$line" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
i=0
while [ "$i" -lt 129 ]; do
 printf '{"type":"agent_start"}\n'
 i=$((i+1))
done
printf '{"id":"%s","type":"response","command":"prompt","success":true}\n' "$id"
read line
`
	if err := os.WriteFile(script, []byte(body), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	if ok, err := p.request("prompt", "once", time.Second); ok || err == nil || !strings.Contains(err.Error(), "uncertain") {
		t.Fatalf("overflow accepted: %v %v", ok, err)
	}
	if _, err := p.request("prompt", "retry", time.Second); err == nil {
		t.Fatal("channel reused after overflow")
	}
}

func TestPiRPCUncertain(t *testing.T) {
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nread line\nsleep 3\n"), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	_, err = p.request("prompt", "once", 25*time.Millisecond)
	if err == nil || !strings.Contains(err.Error(), "uncertain") {
		t.Fatalf("lost uncertain acceptance: %v", err)
	}
}

// An unresponsive reader must not hold the request mutex or hide a timed-out
// write. Escaped input expands beyond Linux pipe capacity.
func TestPiRPCNonReading(t *testing.T) {
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nsleep 10\n"), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	start := time.Now()
	_, err = p.request("prompt", strings.Repeat("\\n", 32768), 25*time.Millisecond)
	if err == nil || !strings.Contains(err.Error(), "uncertain") {
		t.Fatalf("write outcome: %v", err)
	}
	if time.Since(start) > time.Second {
		t.Fatal("write exceeded bounded deadline")
	}
	if _, err = p.request("prompt", "retry", time.Second); err == nil {
		t.Fatal("ambiguous writer reused")
	}
	if err = p.close(); err == nil || !strings.Contains(err.Error(), "unknown") {
		t.Fatalf("false confirmed termination: %v", err)
	}
}

func TestPiRPCDetachedStdout(t *testing.T) {
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	// Announce readiness only AFTER detachment, then hold inherited stdout.
	// The fixture explicitly kills its own child to avoid leaking test processes.
	if err := os.WriteFile(script, []byte("#!/bin/sh\nsetsid sh -c 'echo $$ > \"$HOME/holder.pid\"; exec sleep 5' &\nread line\n"), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	var pid int
	until := time.Now().Add(time.Second)
	for time.Now().Before(until) {
		b, readErr := os.ReadFile(filepath.Join(home, "holder.pid"))
		if readErr == nil {
			pid, _ = strconv.Atoi(strings.TrimSpace(string(b)))
			break
		}
		time.Sleep(time.Millisecond)
	}
	if pid <= 0 {
		_ = p.close()
		t.Fatal("detached holder never started")
	}
	defer syscall.Kill(pid, syscall.SIGKILL)
	start := time.Now()
	err = p.close()
	if err == nil || !strings.Contains(err.Error(), "unknown") {
		t.Fatalf("false success: %v", err)
	}
	if time.Since(start) > time.Second {
		t.Fatal("inherited stdout held close")
	}
	select {
	case <-p.exited:
	default:
		t.Fatal("direct child not reaped")
	}
	select {
	case <-p.done:
	default:
		t.Fatal("stdout reader not stopped")
	}
	if syscall.Kill(pid, 0) != nil {
		t.Fatal("detached holder absent before fixture cleanup")
	}
}

func TestPiRPCUnacknowledgedAndRestartFailClosed(t *testing.T) {
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nread line\n# Native processing may have started; no acknowledgement.\nsleep 2\n"), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	_, err = p.request("prompt", "one", 25*time.Millisecond)
	if err == nil || !strings.Contains(err.Error(), "uncertain") {
		t.Fatalf("lost ambiguous ack: %v", err)
	}
	_ = p.close()
	// A new daemon cannot infer writer absence or settled history from a path.
	if _, err = launchPiRPC(script, home, home, filepath.Join(home, "history.jsonl"), nil); err == nil {
		t.Fatal("resume bypassed owner reconciliation")
	}
}

func TestPiRPCMalformedAckIsUnknown(t *testing.T) {
	for _, field := range []string{"", `,"success":null`} {
		t.Run(field, func(t *testing.T) {
			home := t.TempDir()
			script := filepath.Join(home, "pi")
			body := "#!/bin/sh\nread line\nid=$(printf '%s' \"$line\" | sed -n 's/.*\"id\":\"\\([^\"]*\\)\".*/\\1/p')\nprintf '{\"id\":\"%s\",\"type\":\"response\",\"command\":\"prompt\"" + field + "}\\n' \"$id\"\nread line\n"
			if err := os.WriteFile(script, []byte(body), 0700); err != nil {
				t.Fatal(err)
			}
			p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
			if err != nil {
				t.Fatal(err)
			}
			defer p.close()
			if _, err = p.request("prompt", "once", time.Second); err == nil || !strings.Contains(err.Error(), "uncertain") {
				t.Fatalf("malformed response accepted: %v", err)
			}
			if _, err = p.request("prompt", "twice", time.Second); err == nil {
				t.Fatal("channel reused")
			}
		})
	}
}
