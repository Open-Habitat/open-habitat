//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestAgentConversationControls(t *testing.T) {
	h := newHeldHarness(t)
	// Add the real clear_queue response shape to the reusable synthetic Pi.
	script := strings.Replace(heldFakePi, `    elif r["type"]=="get_commands":`, `    elif r["type"]=="clear_queue":
        out(dict(type="response",id=r["id"],command="clear_queue",success=True,data=dict(steering=[],followUp=[])))
    elif r["type"]=="get_commands":`, 1)
	if err := os.WriteFile(h.runtime.Node, []byte(script), 0700); err != nil {
		t.Fatal(err)
	}
	c, stop := h.daemon()
	defer stop()
	// Agent operations must not consult or modify the browser trust predicate.
	c.trusted = func(*http.Request) bool { return false }
	h.cfg.Socket = filepath.Join(h.root, "daemon.sock")
	socket := filepath.Join(h.root, "agent.sock")
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: socket, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- transport.ServeAgent(ctx, ln, h.cfg, agentHandler(h.cfg, c, "test", "", nil)) }()
	defer func() {
		cancel()
		if err := <-done; err != nil {
			t.Error(err)
		}
	}()
	tr := &http.Transport{DialContext: func(context.Context, string, string) (net.Conn, error) { return net.Dial("unix", socket) }}
	defer tr.CloseIdleConnections()
	client := &http.Client{Transport: tr, Timeout: 20 * time.Second}
	request := func(method, path, body string, want int) map[string]any {
		t.Helper()
		r, _ := http.NewRequest(method, "http://unix"+path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("X-UID", "0")
		res, err := client.Do(r)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		b, _ := io.ReadAll(res.Body)
		if res.StatusCode != want {
			t.Fatalf("%s %s: %d %s", method, path, res.StatusCode, b)
		}
		var out map[string]any
		if json.Unmarshal(b, &out) != nil {
			t.Fatal(string(b))
		}
		return out
	}
	base := AgentConversationsPath
	request("GET", base, "", 200)
	if len(h.lines("launches.log")) != 0 {
		t.Fatal("read started Pi")
	}
	created := request("POST", base, fmt.Sprintf(`{"workspace_id":%q}`, h.workspace), 200)
	id := strings.TrimPrefix(created["agent_id"].(string), "pi:")
	path := base + "/" + id + "/"
	h.eventually("idle", func() bool { _, s := h.status(c, id); return s.State == "idle" })
	request("GET", path+"status", "", 200)
	request("GET", path+"status?uid=0", "", 400)
	request("GET", base, `{}`, 400)
	for _, action := range []string{"question", "bash", "abort_bash", "processes", "../stop"} {
		request("POST", path+action, `{}`, 404)
	}
	request("POST", path+"send", `{"message":"x","command_id":"00000000-0000-4000-8000-000000000001","uid":0}`, 400)
	request("POST", path+"send", `{"message":"first","command_id":"00000000-0000-4000-8000-000000000001"}`, 200)
	h.eventually("settled", func() bool { _, s := h.status(c, id); return s.State == "idle" && len(h.prompts()) == 1 })
	// A repeated command never repeats native work (the controller refuses spent IDs).
	request("POST", path+"send", `{"message":"first","command_id":"00000000-0000-4000-8000-000000000001"}`, 409)
	request("POST", path+"close", "", 409) // content is not deletable
	for i, action := range []string{"steer", "follow_up", "clear_queue", "cancel_held", "abort"} {
		body := fmt.Sprintf(`{"command_id":"00000000-0000-4000-8000-%012d"`, i+10)
		if action == "steer" || action == "follow_up" {
			body += `,"message":"queued"`
		}
		body += "}"
		// Idle steering is refused, never a new prompt; clear/cancel/abort use their
		// existing state-dependent responses, not an alternate agent implementation.
		want := 200
		if action == "steer" || action == "follow_up" || action == "abort" {
			want = 409
		}
		request("POST", path+action, body, want)
	}
	request("GET", path+"recap", "", 200)
	request("POST", path+"recap", "", 200)
	request("POST", path+"regenerate_title", "", 200)
	observation := request("GET", path+"archive", "", 200)
	request("POST", path+"archive", fmt.Sprintf(`{"workspace_id":%q,"archived":true,"observation_token":"obs_stale","previous_archive":"active"}`, h.workspace), 409)
	request("POST", path+"archive", fmt.Sprintf(`{"workspace_id":%q,"archived":true,"observation_token":%q,"previous_archive":"active"}`, h.workspace, observation["observation_token"]), 200)
	request("POST", path+"archive", fmt.Sprintf(`{"workspace_id":%q,"archived":false,"observation_token":%q,"previous_archive":"archived"}`, h.workspace, observation["observation_token"]), 200)
	promptsBeforeResume := len(h.prompts())
	// Foreign/unowned histories cannot be resumed or titled by naming an ID.
	foreign := base + "/00000000-0000-4000-8000-999999999999/"
	request("POST", foreign+"continue", "", 409)
	request("POST", foreign+"history_title", fmt.Sprintf(`{"workspace_id":%q}`, h.workspace), 409)
	request("POST", path+"stop", "", 200)
	h.eventually("dead", func() bool { c.mu.Lock(); defer c.mu.Unlock(); return c.sessions[id].dead })
	request("GET", path+"eligibility", "", 200)
	request("POST", path+"continue", "", 200)
	h.eventually("resumed", func() bool { _, s := h.status(c, id); return s.State == "idle" })
	// Closing a separate fresh, empty child keeps the first conversation/history.
	empty := request("POST", base, fmt.Sprintf(`{"workspace_id":%q}`, h.workspace), 200)
	emptyID := strings.TrimPrefix(empty["agent_id"].(string), "pi:")
	h.eventually("empty idle", func() bool { _, s := h.status(c, emptyID); return s.State == "idle" })
	request("POST", base+"/"+emptyID+"/close", "", 200)
	if len(h.prompts()) != promptsBeforeResume {
		t.Fatal("control replayed native prompt")
	}
	if _, err := os.Stat(filepath.Join(h.root, "prompts.log")); err != nil {
		t.Fatal(err)
	}
}
