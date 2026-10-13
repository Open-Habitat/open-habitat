//go:build linux

package daemon

import (
	"context"
	"fmt"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
)

func TestEmptyNativeFileRejectsUserInAnotherBranch(t *testing.T) {
	id := "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
	home := t.TempDir()
	path := filepath.Join(home, "session.jsonl")
	header := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, home)
	for name, body := range map[string]string{
		"empty":   header,
		"user":    header + `{"type":"message","id":"m1","message":{"role":"user","content":"hello"}}` + "\n" + `{"type":"message","id":"m2","message":{"role":"assistant","content":"reply"},"parentId":null}` + "\n",
		"partial": header + `{"type":"message","id":"m1","message":{"role":"assistant"}}`,
		"custom":  header + `{"type":"custom_message","id":"m1","display":true,"content":"visible"}` + "\n",
	} {
		t.Run(name, func(t *testing.T) {
			if err := os.WriteFile(path, []byte(body), 0600); err != nil {
				t.Fatal(err)
			}
			_, err := emptyNativeFile(path, os.Geteuid(), id, home)
			if (err == nil) != (name == "empty") {
				t.Fatalf("verification: %v", err)
			}
		})
	}
}

func TestCloseEmptyBrowserChild(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("nonroot daemon only")
	}
	for _, mode := range []string{"absent", "empty", "nonempty", "terminal", "writer"} {
		t.Run(mode, func(t *testing.T) {
			home := t.TempDir()
			id := "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
			ws := "ws_aaaaaaaa"
			owner, err := acquirePiOwnership(home, id)
			if err != nil {
				t.Fatal(err)
			}
			defer owner.release()
			if err := owner.markBrowser(ws, home); err != nil {
				t.Fatal(err)
			}
			script := filepath.Join(home, "pi")
			if err := os.WriteFile(script, []byte("#!/bin/sh\nexec sleep 30\n"), 0700); err != nil {
				t.Fatal(err)
			}
			p, err := launchPiRPCCommand(script, nil, home, home, []string{"PATH=/usr/bin:/bin"}, owner, nil)
			if err != nil {
				t.Fatal(err)
			}
			defer p.close()
			dir := filepath.Join(home, historyRoot)
			if err := os.MkdirAll(dir, 0700); err != nil {
				t.Fatal(err)
			}
			path := filepath.Join(dir, "session.jsonl")
			if mode != "absent" {
				contents := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, home)
				if mode == "nonempty" {
					contents += `{"type":"message","id":"m1","message":{"role":"user","content":"hello"}}` + "\n"
				}
				if err := os.WriteFile(path, []byte(contents), 0600); err != nil {
					t.Fatal(err)
				}
			}
			if mode == "terminal" {
				if err := owner.markBrowser(ws, home+"-different"); err != nil {
					t.Fatal(err)
				}
			}
			if mode == "writer" {
				other := exec.Command("bash", "-c", `exec -a pi sleep 30 3<"$1"`, "bash", path)
				other.Dir = t.TempDir()
				if err := other.Start(); err != nil {
					t.Fatal(err)
				}
				defer func() { _ = other.Process.Kill(); _ = other.Wait() }()
				deadline := time.Now().Add(time.Second)
				for piWriter(path, home, os.Geteuid()) != "writer_present" && time.Now().Before(deadline) {
					time.Sleep(time.Millisecond)
				}
				if piWriter(path, home, os.Geteuid()) != "writer_present" {
					t.Fatal("unaccounted writer fixture did not open history")
				}
			}
			c := &ConversationController{cfg: transport.Config{UID: os.Geteuid(), Home: home}, home: home, sessions: map[string]*conversation{id: {id: id, workspace: ws, cwd: home, rpc: p, owner: owner, state: "idle", commands: map[string]bool{}}}}
			go c.watch(c.sessions[id])
			request := httptest.NewRequest("POST", "http://unix/api/v1/conversations/"+id+"/close", strings.NewReader("")).WithContext(context.Background())
			w := httptest.NewRecorder()
			c.closeEmpty(w, request, id)
			if mode == "absent" || mode == "empty" {
				if w.Code != 200 || c.sessions[id] != nil {
					t.Fatalf("close: %d %s", w.Code, w.Body.String())
				}
				if _, err := os.Stat(path); !os.IsNotExist(err) {
					t.Fatalf("native file remains: %v", err)
				}
				select {
				case <-p.exited:
				default:
					t.Fatal("child not reaped")
				}
			} else {
				if w.Code != 409 || c.sessions[id] == nil {
					t.Fatalf("refusal: %d %s", w.Code, w.Body.String())
				}
				if mode == "nonempty" {
					if _, err := os.Stat(path); err != nil {
						t.Fatal("history changed", err)
					}
				}
				select {
				case <-p.exited:
					t.Fatal("child stopped on refusal")
				default:
				}
			}
		})
	}
}

func TestCloseTerminalBegunSessionHasNoControllerAuthority(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("nonroot daemon only")
	}
	home := t.TempDir()
	id := "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
	path := filepath.Join(home, historyRoot, "native.jsonl")
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	body := fmt.Sprintf("{\"type\":\"session\",\"version\":3,\"id\":%q,\"cwd\":%q}\n", id, home)
	if err := os.WriteFile(path, []byte(body), 0600); err != nil {
		t.Fatal(err)
	}
	c := &ConversationController{cfg: transport.Config{UID: os.Geteuid(), Home: home}, home: home, sessions: map[string]*conversation{}}
	w := httptest.NewRecorder()
	c.closeEmpty(w, httptest.NewRequest("POST", "http://unix/api/v1/conversations/"+id+"/close", nil), id)
	after, err := os.ReadFile(path)
	if w.Code != 409 || err != nil || string(after) != body {
		t.Fatalf("terminal session changed: %d %s %v", w.Code, string(after), err)
	}
}
