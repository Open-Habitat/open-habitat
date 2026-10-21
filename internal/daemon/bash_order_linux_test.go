//go:build linux

package daemon

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

// Delay the controller until the reader has consumed both output and EOF.
// Completion must not bypass that backlog, even for identical command text.
func TestBashReplyFollowsQueuedOutput(t *testing.T) {
	for _, dead := range []bool{false, true} {
		id := fmt.Sprintf("native-request-dead-%t", dead)
		t.Run(id, func(t *testing.T) {
			outR, outW, err := os.Pipe()
			if err != nil {
				t.Fatal(err)
			}
			defer outR.Close()
			inR, inW, err := os.Pipe()
			if err != nil {
				t.Fatal(err)
			}
			defer inR.Close()
			defer inW.Close()
			reply := make(chan json.RawMessage, 1)
			p := &piRPC{out: outR, in: inW, done: make(chan struct{}), frames: make(chan json.RawMessage, 8), events: make(chan json.RawMessage, 8), eventsDrained: make(chan struct{}), bashReplies: map[string]chan json.RawMessage{id: reply}}
			go p.read()
			_, err = fmt.Fprintf(outW, "{\"type\":\"bash_execution_update\",\"delta\":\"same output\"}\n{\"type\":\"response\",\"id\":%q,\"command\":\"bash\",\"success\":true,\"data\":{\"exitCode\":0}}\n", id)
			if err != nil {
				t.Fatal(err)
			}
			outW.Close()
			<-p.done
			select {
			case <-reply:
				t.Fatal("native completion overtook queued output")
			default:
			}
			j := newEventJournal()
			s := &conversation{id: "fixture", rpc: p, state: "stopped", dead: dead}
			c := &ConversationController{journal: j, sessions: map[string]*conversation{"fixture": s}}
			c.drain(s)
			select {
			case frame := <-reply:
				if outcome, ok := parseBashReply(frame); !ok || outcome.State != "finished" {
					t.Fatalf("reply: %s", frame)
				}
			default:
				t.Fatal("ordered native completion was lost at EOF")
			}
			// Publication now comes after every output fragment, never before one.
			j.nativeEntry("pi:fixture", historyEntry{Key: id, Kind: "bash"})
			j.mu.Lock()
			for _, frame := range j.tail("pi:fixture").frames {
				var event struct {
					Kind string `json:"kind"`
				}
				_ = json.Unmarshal(frame, &event)
				if event.Kind == "bash.output" {
					t.Error("saved command retained live output")
				}
			}
			j.mu.Unlock()
		})
	}
}

// Exercise runBash's EOF wait itself, not just delivery by the event drain.
func TestRunBashWaitsForQueuedReplyAtEOF(t *testing.T) {
	outR, outW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer outR.Close()
	inR, inW, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	defer inR.Close()
	defer inW.Close()
	p := &piRPC{out: outR, in: inW, done: make(chan struct{}), frames: make(chan json.RawMessage, 8), events: make(chan json.RawMessage, 8), eventsDrained: make(chan struct{})}
	run := &bashRun{command: "git status", commandID: "browser-request", state: "running", wrote: make(chan struct{})}
	s := &conversation{id: "fixture", rpc: p, state: "stopped", bash: run}
	home := t.TempDir()
	c := &ConversationController{cfg: transport.Config{Home: home, UID: os.Geteuid()}, home: home, sessions: map[string]*conversation{"fixture": s}}
	go p.read()
	finished := make(chan struct{})
	go func() { c.runBash(s, run); close(finished) }()
	request, err := bufio.NewReader(inR).ReadBytes('\n')
	if err != nil {
		t.Fatal(err)
	}
	var head struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(request, &head); err != nil {
		t.Fatal(err)
	}
	if _, err := fmt.Fprintf(outW, "{\"type\":\"bash_execution_update\",\"delta\":\"same output\"}\n{\"type\":\"response\",\"id\":%q,\"command\":\"bash\",\"success\":true,\"data\":{\"exitCode\":0}}\n", head.ID); err != nil {
		t.Fatal(err)
	}
	outW.Close()
	<-p.done
	select {
	case <-finished:
		t.Fatal("runBash decided the outcome before the EOF backlog drained")
	default:
	}
	c.drain(s)
	select {
	case <-finished:
	case <-time.After(2 * time.Second):
		t.Fatal("runBash did not finish after draining EOF")
	}
	if run.state != "finished" || run.exitCode == nil || *run.exitCode != 0 {
		t.Fatalf("lost native outcome: %+v", run)
	}
}
