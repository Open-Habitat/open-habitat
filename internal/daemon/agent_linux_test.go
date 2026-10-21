//go:build linux

package daemon

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestAgentCurrentFencesAndDefaultDeny(t *testing.T) {
	dir, err := os.MkdirTemp("/var/tmp", "oh-agent-")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, "agent.sock")
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: path, Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	cfg := transport.Config{UID: os.Geteuid(), Socket: filepath.Join(dir, "daemon.sock"), Home: dir, Provider: "github", Subject: "42"}
	id := "00000000-0000-4000-8000-000000000001"
	generation := "00000000-0000-4000-8000-000000000002"
	exited := make(chan struct{})
	controller := &ConversationController{sessions: map[string]*conversation{id: {id: id, workspace: "ws_example123", state: "idle", rpc: &piRPC{processGeneration: generation, exited: exited}}}}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan error, 1)
	go func() { done <- transport.ServeAgent(ctx, ln, cfg, agentHandler(cfg, controller, "test", "")) }()
	defer func() { cancel(); <-done }()
	tr := &http.Transport{DialContext: func(context.Context, string, string) (net.Conn, error) { return net.Dial("unix", path) }}
	defer tr.CloseIdleConnections()
	client := &http.Client{Transport: tr, Timeout: 2 * time.Second}
	get := func(method, path string, want int) string {
		t.Helper()
		req, _ := http.NewRequest(method, "http://unix"+path, nil)
		req.Header.Set("X-UID", "0")
		req.Header.Set("X-Username", "other")
		res, e := client.Do(req)
		if e != nil {
			t.Fatal(e)
		}
		defer res.Body.Close()
		b, _ := io.ReadAll(res.Body)
		if res.StatusCode != want {
			t.Fatalf("%s %s: %d %s", method, path, res.StatusCode, b)
		}
		return string(b)
	}
	current := AgentConversationPath + "?current=true&id=pi:" + id + "&workspace_id=ws_example123&generation=" + generation
	get("GET", current, 200)
	get("GET", strings.Replace(current, "pi:"+id, "pi:00000000-0000-4000-8000-000000000009", 1), 409)
	get("GET", AgentConversationPath+"?id=pi:00000000-0000-4000-8000-000000000009", 404)
	for _, bad := range []string{strings.Replace(current, generation, "00000000-0000-4000-8000-000000000003", 1), strings.Replace(current, "ws_example123", "ws_example456", 1)} {
		get("GET", bad, 409)
	}
	get("GET", current+"&uid=0", 400)
	get("GET", current+"&id=pi:"+id, 400)
	close(exited)
	get("GET", current, 409)
	get("GET", AgentConversationPath+"?id=pi:"+id, 200)
	for _, path := range []string{transport.Path, "/api/v1/editor", "/api/v1/editor/open", "/api/v1/editor/relay/x", "/api/v1/workspaces/terminal", "/api/v1/account/git-identity", "/api/v1/server/administration", "/api/v1/onboarding/pi/attempt", "/auth/sessions", "/internal/v1/provision", "/api/v1/snapshot", "/agent/v1/environment/"} {
		get("GET", path, 404)
		get("POST", path, 404)
	}
	get("POST", AgentEnvironmentPath, 404)
	get("GET", AgentEnvironmentPath+"?uid=0", 400)
	var env map[string]any
	if json.Unmarshal([]byte(get("GET", AgentEnvironmentPath, 200)), &env) != nil {
		t.Fatal("invalid environment")
	}
	q := env["quota"].(map[string]any)
	if q["state"] == "unavailable" && (q["usage_bytes"] != nil || q["hard_limit_bytes"] != nil) {
		t.Fatal("unavailable quota claimed a measurement")
	}
}

// This uses real different kernel UIDs, with permissive socket permissions in
// the second phase so the SO_PEERCRED guard (not just chmod) must reject them.
func TestAgentDistinctUIDs(t *testing.T) {
	if os.Getenv("AGENT_UID_CONTAINER") != "1" {
		t.Skip("requires scripts/test-agent-uids.sh disposable namespace")
	}
	if os.Getenv("AGENT_ROLE") == "serve" {
		file := os.NewFile(3, "agent")
		ln, err := net.FileListener(file)
		file.Close()
		if err != nil {
			t.Fatal(err)
		}
		cfg := transport.Config{UID: os.Geteuid(), Socket: os.Getenv("AGENT_BASE") + "/daemon.sock", Home: "/nonexistent", Provider: "github", Subject: "42"}
		c := &ConversationController{sessions: map[string]*conversation{}}
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		if err := transport.ServeAgent(ctx, ln.(*net.UnixListener), cfg, agentHandler(cfg, c, "test", "")); err != nil {
			t.Fatal(err)
		}
		return
	}
	if os.Getenv("AGENT_ROLE") == "probe" {
		conn, err := net.DialTimeout("unix", os.Getenv("AGENT_BASE")+"/agent.sock", time.Second)
		want, _ := strconv.Atoi(os.Getenv("AGENT_EXPECT"))
		if err != nil {
			if want == 0 {
				return
			}
			t.Fatal(err)
		}
		defer conn.Close()
		conn.SetDeadline(time.Now().Add(time.Second))
		fmt.Fprint(conn, "GET "+os.Getenv("AGENT_TARGET")+" HTTP/1.1\r\nHost: unix\r\nX-UID: 21001\r\nConnection: close\r\n\r\n")
		res, err := http.ReadResponse(bufio.NewReader(conn), nil)
		if want == 0 {
			if err == nil {
				res.Body.Close()
				t.Fatal("unauthorized peer reached handler")
			}
			return
		}
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		if res.StatusCode != want {
			t.Fatalf("status %d expected %d", res.StatusCode, want)
		}
		return
	}
	if os.Geteuid() != 0 {
		t.Fatal("namespace root required")
	}
	base, err := os.MkdirTemp("/var/tmp", "oh-agent-uid-")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(base)
	os.Chmod(base, 0755)
	ln, err := net.ListenUnix("unix", &net.UnixAddr{Name: base + "/agent.sock", Net: "unix"})
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	os.Chown(base+"/agent.sock", 21001, 21001)
	os.Chmod(base+"/agent.sock", 0600)
	f, err := ln.File()
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	cmd := exec.Command(os.Args[0], "-test.run=^TestAgentDistinctUIDs$")
	cmd.Env = append(os.Environ(), "AGENT_ROLE=serve", "AGENT_BASE="+base)
	cmd.ExtraFiles = []*os.File{f}
	cmd.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: 21001, Gid: 21001}}
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() { cmd.Process.Kill(); cmd.Wait() }()
	probe := func(uid uint32, target string, want int) {
		t.Helper()
		p := exec.Command(os.Args[0], "-test.run=^TestAgentDistinctUIDs$")
		p.Env = append(os.Environ(), "AGENT_ROLE=probe", "AGENT_BASE="+base, "AGENT_TARGET="+target, "AGENT_EXPECT="+strconv.Itoa(want))
		p.SysProcAttr = &syscall.SysProcAttr{Credential: &syscall.Credential{Uid: uid, Gid: uid}}
		if b, e := p.CombinedOutput(); e != nil {
			t.Fatalf("UID %d: %v %s", uid, e, b)
		}
	}
	probe(21001, AgentEnvironmentPath, 200)
	for _, uid := range []uint32{0, 21002, 21003} {
		probe(uid, AgentEnvironmentPath, 0)
	}
	// Force every peer through to the accept guard, including root and gateway.
	os.Chmod(base+"/agent.sock", 0666)
	for _, uid := range []uint32{0, 21002, 21003} {
		probe(uid, AgentWorkspacesPath, 0)
		probe(uid, AgentNoticesPath+"?id=pi:11111111-1111-4111-8111-111111111111", 0)
	}
	for _, target := range []string{transport.Path, "/api/v1/editor/open", "/api/v1/workspaces/terminal", "/api/v1/server/administration", "/auth/sessions"} {
		probe(21001, target, 404)
	}
}

func TestAgentNoPeerDoesNotRead(t *testing.T) {
	// Even the exact route is refused without a transport-installed capability.
	h := agentHandler(transport.Config{Home: "/should-not-be-read"}, nil, "test", "")
	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", AgentWorkspacesPath, nil)
	r.Header.Set("X-UID", strconv.Itoa(os.Geteuid()))
	h.ServeHTTP(w, r)
	if w.Code != 403 {
		t.Fatal(w.Code)
	}
}

func TestAgentLaunchEnvironment(t *testing.T) {
	home := t.TempDir()
	os.Chmod(home, 0700)
	owner, err := acquirePiOwnership(home, "00000000-0000-4000-8000-000000000001")
	if err != nil {
		t.Fatal(err)
	}
	defer owner.release()
	if err := owner.markBrowser("ws_example123", home); err != nil {
		t.Fatal(err)
	}
	script := filepath.Join(home, "fake-pi")
	// The actual child reports inherited values, not an inspection of cmd.Env.
	if err := os.WriteFile(script, []byte("#!/bin/sh\nprintf '%s\\n' \"$OPEN_HABITAT_CONVERSATION_ID\" \"$OPEN_HABITAT_WORKSPACE_ID\" \"$OPEN_HABITAT_LAUNCH_GENERATION\" > \"$HOME/context\"\n"), 0700); err != nil {
		t.Fatal(err)
	}
	ws, err := os.Open(home)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	p, err := launchPiRPCCommand(script, nil, home, home, []string{"OPEN_HABITAT_LAUNCH_GENERATION=forged", "OPEN_HABITAT_WORKSPACE_ID=ws_wrong123", "OPEN_HABITAT_CONVERSATION_ID=pi:forged"}, owner, ws, "ws_example123")
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	select {
	case <-p.exited:
	case <-time.After(3 * time.Second):
		t.Fatal("child did not exit")
	}
	b, err := os.ReadFile(filepath.Join(home, "context"))
	if err != nil {
		t.Fatal(err)
	}
	want := "pi:" + owner.id + "\nws_example123\n" + p.processGeneration + "\n"
	if string(b) != want {
		t.Fatalf("launch context %q expected %q", b, want)
	}
}

func TestAgentAuxiliaryTitleLaunchHasNoCurrentContext(t *testing.T) {
	home := t.TempDir()
	os.Chmod(home, 0700)
	owner, err := acquirePiOwnership(home, "00000000-0000-4000-8000-000000000001")
	if err != nil {
		t.Fatal(err)
	}
	defer owner.release()
	// Terminal history has no browser-origin record. A temporary native title
	// worker must still launch, without claiming to be a controller conversation.
	script := filepath.Join(home, "fake-pi")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nprintf '%s\\n' \"$OPEN_HABITAT_CONVERSATION_ID\" \"$OPEN_HABITAT_WORKSPACE_ID\" \"$OPEN_HABITAT_LAUNCH_GENERATION\" > \"$HOME/context\"\n"), 0700); err != nil {
		t.Fatal(err)
	}
	ws, err := os.Open(home)
	if err != nil {
		t.Fatal(err)
	}
	defer ws.Close()
	p, err := launchPiRPCSession(script, nil, home, home, []string{"OPEN_HABITAT_CONVERSATION_ID=pi:forged", "OPEN_HABITAT_WORKSPACE_ID=ws_wrong123", "OPEN_HABITAT_LAUNCH_GENERATION=forged"}, owner, ws, "", "")
	if err != nil {
		t.Fatal(err)
	}
	defer p.close()
	select {
	case <-p.exited:
	case <-time.After(3 * time.Second):
		t.Fatal("title child did not exit")
	}
	b, err := os.ReadFile(filepath.Join(home, "context"))
	if err != nil || string(b) != "\n\n\n" {
		t.Fatalf("auxiliary context %q %v", b, err)
	}
}
