//go:build linux

package cli

import (
	"strings"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/daemon"
)

func TestAgentBrowserRequestShapes(t *testing.T) {
	win := strings.Repeat("A", 32)
	for _, tc := range []struct {
		args         []string
		method, path string
		body         string
	}{
		{[]string{"status"}, "GET", daemon.AgentBrowserPath, ""},
		{[]string{"start"}, "POST", daemon.AgentBrowserStartPath, "{}"},
		{[]string{"request", "--clear"}, "POST", daemon.AgentBrowserRequestPath, `{"clear":true}`},
		{[]string{"request", "--text", "Syötä koodi"}, "POST", daemon.AgentBrowserRequestPath, `{"text":"Syötä koodi"}`},
		{[]string{"request", "--window", win, "--text", "x"}, "POST", daemon.AgentBrowserRequestPath, `{"text":"x","window":"` + win + `"}`},
	} {
		method, path, body, err := agentBrowserRequest(tc.args)
		if err != nil || method != tc.method || path != tc.path || string(body) != tc.body {
			t.Errorf("%v: %s %s %s %v", tc.args, method, path, body, err)
		}
	}
	for _, bad := range [][]string{nil, {"stop"}, {"request"}, {"request", "--text"}, {"request", "--text", " "}, {"request", "--text", "x", "--text", "y"}, {"request", "--window", "nope", "--text", "x"}, {"request", "--text", strings.Repeat("a", 301)}, {"status", "--json"}} {
		if _, _, _, err := agentBrowserRequest(bad); err == nil {
			t.Errorf("accepted %v", bad)
		}
	}
}

func TestBrowserHostRoleRefusesRelativePathsAndUnknownFlags(t *testing.T) {
	for _, args := range [][]string{
		{"--dir", "rel", "--xvnc", "/x", "--chrome", "/c", "--profile", "/p", "--cache", "/k"},
		{"--dir", "/d", "--xvnc", "/x", "--chrome", "/c", "--profile", "/p", "--cache", "/k", "--chrome-arg", "--no-sandbox"},
		{"--dir", "/d", "--xvnc", "/x", "--chrome", "/c", "--profile", "/p", "--cache", "/k", "--idle-seconds", "5"},
		{"--dir", "/d", "--dir", "/e"},
	} {
		if _, err := browserHostCommand(args, nil); err == nil {
			t.Errorf("accepted %v", args)
		}
	}
}
