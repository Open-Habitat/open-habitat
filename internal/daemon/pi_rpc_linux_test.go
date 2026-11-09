//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"os"
	"os/exec"
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
	if accepted, err := p.request("abort", "", time.Second); err != nil || !accepted {
		t.Fatalf("abort: %v %v", accepted, err)
	}
}

func TestPiRPCSlowAbortDoesNotShutDownChild(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("requires nonroot")
	}
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	// Pi's abort receipt can be delayed until the run loop is idle.
	body := `#!/bin/sh
read line
sleep .15
printf '%s\n' '{"type":"response","id":"late","command":"abort","success":true}'
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
	if accepted, err := p.request("abort", "", 25*time.Millisecond); accepted || err == nil {
		t.Fatalf("slow abort: %v %v", accepted, err)
	}
	select {
	case <-p.exited:
		t.Fatal("abort timeout terminated Pi child")
	default:
	}
	if !p.poisoned {
		t.Fatal("ambiguous channel reused")
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

// More events than the queue holds wait for the consumer instead of ending
// Pi: Pi waits for its stdout in turn.
func TestPiRPCEventBurstWaitsForConsumer(t *testing.T) {
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	body := `#!/bin/sh
read line
id=$(printf '%s' "$line" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
i=0
while [ "$i" -lt 1000 ]; do
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
	got := make(chan int)
	go func() {
		time.Sleep(300 * time.Millisecond) // the controller is busy elsewhere
		n := 0
		for range p.events {
			if n++; n == 1000 {
				break
			}
		}
		got <- n
	}()
	if ok, err := p.request("prompt", "once", 5*time.Second); !ok || err != nil {
		t.Fatalf("burst ended acceptance: %v %v (%s)", ok, err, p.inputEndCause())
	}
	if n := <-got; n != 1000 || p.overflow.Load() || p.inputEndCause() != "" {
		t.Fatal("events lost or Pi ended", n, p.inputEndCause())
	}
}

// A controller that stops consuming still poisons the channel, and the
// reason Pi then ended is kept.
func TestPiRPCStalledConsumerPoisonsWithCause(t *testing.T) {
	defer func(d time.Duration) { piEventStall = d }(piEventStall)
	piEventStall = 200 * time.Millisecond
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
	if ok, err := p.request("prompt", "once", 2*time.Second); ok || err == nil || !strings.Contains(err.Error(), "uncertain") {
		t.Fatalf("stall accepted: %v %v", ok, err)
	}
	if _, err := p.request("prompt", "retry", time.Second); err == nil {
		t.Fatal("channel reused after stall")
	}
	if cause := p.inputEndCause(); cause != "Habitat stopped reading Pi's events for 200ms" {
		t.Fatal(cause)
	}
}

// The claude bridge releases a large tool call's argument deltas at once:
// measured on Birch, 7408 toolcall_delta frames within one second for a
// 50 KB write. The controller's drain is slower than the reader, so a queue
// that refused to wait closed Pi's input after about 150 of them and ended
// Pi mid-reply.
func TestToolcallDeltaBurstDoesNotEndPi(t *testing.T) {
	home := t.TempDir()
	var b strings.Builder
	b.WriteString(`{"type":"agent_start"}` + "\n" + `{"type":"message_start","message":{"role":"assistant","content":[]}}` + "\n")
	b.WriteString(`{"type":"message_update","assistantMessageEvent":{"type":"toolcall_start","contentIndex":1,"id":"toolu_1","toolName":"write"}}` + "\n")
	const deltas = 7400
	for i := 0; i < deltas; i++ {
		b.WriteString(`{"type":"message_update","usage":{"input":2,"output":5,"cacheRead":204776,"cacheWrite":612,"totalTokens":205395},"assistantMessageEvent":{"type":"toolcall_delta","contentIndex":1,"delta":"<td>` + strconv.Itoa(i) + `</td>"}}` + "\n")
	}
	if err := os.WriteFile(filepath.Join(home, "burst"), []byte(b.String()), 0600); err != nil {
		t.Fatal(err)
	}
	script := filepath.Join(home, "pi")
	body := `#!/bin/sh
cat "$HOME/burst"
read line
id=$(printf '%s' "$line" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
printf '{"id":"%s","type":"response","command":"get_state","success":true,"data":{}}\n' "$id"
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
	const id = "11111111-1111-4111-8111-111111111111"
	s := &conversation{id: id, rpc: p, state: "accepted"}
	c := &ConversationController{sessions: map[string]*conversation{id: s}, journal: newEventJournal()}
	go c.drain(s)
	if ok, err := p.request("get_state", "", 10*time.Second); !ok || err != nil {
		t.Fatalf("Pi ended by its own output: %v %v (%s)", ok, err, p.inputEndCause())
	}
	// The reply overtakes the drain's last events; wait for them.
	var cursor uint64
	for deadline := time.Now().Add(5 * time.Second); time.Now().Before(deadline); time.Sleep(10 * time.Millisecond) {
		c.mu.Lock()
		cursor = s.cursor
		c.mu.Unlock()
		if cursor == deltas+3 {
			break
		}
	}
	if p.overflow.Load() || p.inputEndCause() != "" || cursor != deltas+3 {
		t.Fatal("burst lost or ended Pi", cursor, p.inputEndCause())
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
	// Cut off before its end, the frame never reached Pi.
	if !errors.Is(err, errPiNotReceived) {
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
	until := time.Now().Add(2 * time.Second)
	for time.Now().Before(until) {
		b, readErr := os.ReadFile(filepath.Join(home, "holder.pid"))
		if readErr == nil {
			pid, _ = strconv.Atoi(strings.TrimSpace(string(b)))
			if pid > 0 { // The file can exist before the shell writes its PID.
				break
			}
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

func TestPiAggregateImageEchoIsDrainedBoundedly(t *testing.T) {
	// The small limit exercises the same framing path without a 32 MiB fixture.
	for _, kind := range []string{"agent_end", "turn_end", "response"} {
		input := `{"type":"` + kind + `","messages":["` + strings.Repeat("A", 4096) + `"]}` + "\n" + `{"type":"response","id":"next"}` + "\n"
		reader := bufio.NewReaderSize(strings.NewReader(input), 128)
		frame, err := readPiFrame(reader, 256)
		if kind == "response" {
			if err == nil {
				t.Fatal("oversized ordinary frame accepted")
			}
			continue
		}
		if err != nil || !bytes.Contains(frame, []byte(kind)) || len(frame) > 64 {
			t.Fatal(string(frame), err)
		}
		next, err := readPiFrame(reader, 256)
		if err != nil || !bytes.Contains(next, []byte("next")) {
			t.Fatal(string(next), err)
		}
		if _, err := readPiFrame(reader, 256); err != io.EOF {
			t.Fatal(err)
		}
	}
}

// Frames that legitimately exceed 1 MiB are reduced to what the controller
// reads; only those needed whole fail closed.
func TestOversizedNotificationFramesAreBounded(t *testing.T) {
	huge := strings.Repeat("x", 1<<20+1)
	for _, tc := range []struct {
		frame string
		want  []string
	}{
		{`{"type":"message_update","assistantMessageEvent":{"type":"toolcall_end","contentIndex":1,"toolCall":{"id":"toolu_1","name":"write","arguments":{"content":"` + huge + `"}}}}`, []string{`"toolcall_end"`, `"contentIndex":1`, `"id":"toolu_1"`, `"name":"write"`}},
		{`{"type":"message_update","assistantMessageEvent":{"type":"text_delta","contentIndex":0,"delta":"` + huge + `"}}`, []string{`"text_delta"`}},
		{`{"type":"message_end","message":{"role":"assistant","stopReason":"toolUse","content":[{"type":"text","text":"` + huge + `"}]}}`, []string{`"message_end"`, `"role":"assistant"`, `"stopReason":"toolUse"`}},
		{`{"type":"message_end","message":{"role":"custom","customType":"ad-process:notification","content":"` + huge + `"}}`, []string{`"customType":"ad-process:notification"`}},
		{`{"type":"tool_execution_start","toolCallId":"toolu_1","toolName":"write","args":{"content":"` + huge + `"}}`, []string{`"tool_execution_start"`, `"toolCallId":"toolu_1"`, `"toolName":"write"`}},
		{`{"type":"tool_execution_end","toolCallId":"toolu_1","toolName":"bash","isError":true,"result":"` + huge + `"}`, []string{`"isError":true`}},
		{`{"type":"message_start","message":{"role":"user","content":[{"type":"text","text":"steer"},{"type":"image","data":"` + huge + `"}]}}`, []string{`"text":"steer"`, `"role":"user"`}},
		{`{"type":"message_start","message":{"role":"toolResult","toolCallId":"toolu_1","toolName":"read","content":[{"type":"text","text":"` + huge + `"}]}}`, []string{`"toolCallId":"toolu_1"`, `"isError":false`}},
		{`{"type":"turn_end","message":{"role":"assistant"},"toolResults":["` + huge + `"]}`, []string{`{"type":"turn_end"}`}},
		{`{"type":"some_future_event","payload":"` + huge + `"}`, []string{`{"type":"some_future_event"}`}},
	} {
		got, ok := boundedPiFrame([]byte(tc.frame))
		if !ok || len(got) > 4096 || !json.Valid(got) {
			t.Fatalf("%.80s: %v %.200s", tc.frame, ok, got)
		}
		for _, want := range tc.want {
			if !bytes.Contains(got, []byte(want)) {
				t.Fatalf("%.80s: %s lacks %s", tc.frame, got, want)
			}
		}
	}
	for _, whole := range []string{
		`{"type":"response","id":"r","command":"get_commands","success":true,"data":{"commands":["` + huge + `"]}}`,
		`{"type":"extension_ui_request","id":"q","method":"select","title":"` + huge + `"}`,
		`{"type":"queue_update","steering":["` + huge + `"],"followUp":[]}`,
		`{"type":"` + huge + `"}`,
	} {
		if got, ok := boundedPiFrame([]byte(whole)); ok {
			t.Fatalf("%.60s bounded: %.200s", whole, got)
		}
	}
}

// An unasked end says what this daemon saw: why it closed Pi's input, if it
// did, and how Pi exited. The agent's catch-up receives it (restEnv).
func TestUnaskedPiEndRecordsItsCause(t *testing.T) {
	home := t.TempDir()
	script := filepath.Join(home, "pi")
	// Never answers; ends on EOF as Pi does.
	if err := os.WriteFile(script, []byte("#!/bin/sh\nread line\nread line\nexit 0\n"), 0700); err != nil {
		t.Fatal(err)
	}
	p, err := launchPiRPC(script, home, home, "", []string{"PATH=/usr/bin:/bin"})
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	const id = "11111111-1111-4111-8111-111111111111"
	s := &conversation{id: id, rpc: p, state: "idle"}
	c := &ConversationController{sessions: map[string]*conversation{id: s}}
	if _, err := p.request("get_commands", "", 200*time.Millisecond); err == nil {
		t.Fatal("unanswered request accepted")
	}
	c.watch(s)
	c.mu.Lock()
	s.owner = &piOwnership{} // restOf tells a launched child's rest from a stand-in
	rest, _, resting := c.restOf(s)
	c.mu.Unlock()
	want := "Habitat closed Pi's input after no reply from Pi to get_commands within 200ms, which ends Pi; Pi exited with status 0"
	if !resting || rest.cause != "crash" || rest.detail != want {
		t.Fatalf("%v %+v", resting, rest)
	}
	env := strings.Join(restEnv(rest), "\n")
	if !strings.Contains(env, "OPEN_HABITAT_STOP_DETAIL="+want) {
		t.Fatal(env)
	}
	if strings.Contains(strings.Join(restEnv(restFact{cause: "idle", at: rest.at, detail: want}), "\n"), "DETAIL") {
		t.Fatal("a detail outside a crash")
	}

	killed := exec.Command("/bin/sh", "-c", "kill -9 $$")
	_ = killed.Run()
	if got := crashDetail("", killed.ProcessState); got != "Pi was killed by signal killed; Habitat had not closed its input" {
		t.Fatal(got)
	}
	failed := exec.Command("/bin/sh", "-c", "exit 3")
	_ = failed.Run()
	if got := crashDetail("", failed.ProcessState); got != "Pi exited with status 3; Habitat had not closed its input" {
		t.Fatal(got)
	}
}

// The budget for handing a prompt to Pi follows Pi's reader, whose cost grows
// with the square of the frame: small prompts keep 15 s, the largest admitted
// image batch gets minutes, never more than the RPC layer's ceiling.
func TestPromptRequestTimeoutFollowsFrameSize(t *testing.T) {
	batch := func(raw int) []piAttachmentImage {
		return []piAttachmentImage{{"image", strings.Repeat("A", (raw+2)/3*4), "image/png"}}
	}
	if got := promptRequestTimeout(nil); got != 15*time.Second {
		t.Fatalf("plain prompt: %s", got)
	}
	if got := promptRequestTimeout(batch(1 << 20)); got < 15*time.Second || got > 16*time.Second {
		t.Fatalf("1 MiB: %s", got)
	}
	half, full := promptRequestTimeout(batch(50<<20)), promptRequestTimeout(batch(promptAttachmentLimit))
	if half < 90*time.Second || full < 5*time.Minute || full > maxPiRequestTimeout || full < 3*half {
		t.Fatalf("50 MiB %s, 100 MiB %s", half, full)
	}
}
