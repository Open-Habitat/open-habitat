//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"net/url"
	"strings"
	"sync"
	"time"
)

// piOAuthLogin relays only the built-in MCP command's OAuth UI. It never
// prompts a model, follows a browser URL, or transports a token. Pi alone
// exchanges the callback and writes its native credentials.
type piOAuthLogin struct {
	tool   *LineTool
	server string
	mu     sync.Mutex
	input  string
	prefix string
	state  string
	sent   bool
	denied bool
	prompt chan Prompt
	done   chan struct{}
	err    error
	fresh  bool
}

func startPiOAuth(ctx context.Context, env Env, server string, fresh bool) (*piOAuthLogin, error) {
	pi, ok := env.Tool("pi")
	if !ok {
		return nil, ToolFailed
	}
	tool, err := env.StartLineTool(ctx, Command{Path: pi, Args: []string{"--mode", "rpc", "--no-session", "--no-extensions", "--extension", "builtin:mcp", "--no-skills", "--no-prompt-templates"}, Env: []string{"BROWSER=/bin/false"}})
	if err != nil {
		return nil, ToolFailed
	}
	l := &piOAuthLogin{tool: tool, server: server, prompt: make(chan Prompt, 1), done: make(chan struct{}), fresh: fresh}
	if err := l.send(map[string]any{"type": "prompt", "message": "/mcp"}); err != nil {
		tool.Stop()
		return nil, ToolFailed
	}
	go l.read(ctx)
	return l, nil
}

func (l *piOAuthLogin) send(v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return ToolFailed
	}
	return l.tool.Write(string(b))
}

func (l *piOAuthLogin) read(ctx context.Context) {
	defer l.tool.Stop()
	finish := func(err error) {
		l.mu.Lock()
		if err == ToolFailed && l.denied {
			err = PermissionRefused
		}
		l.mu.Unlock()
		l.err = err
		close(l.done)
	}
	started, announced := false, false
	var authorization string
	for {
		select {
		case <-ctx.Done():
			finish(ctx.Err())
			return
		case raw, ok := <-l.tool.Lines():
			if !ok {
				finish(ToolFailed)
				return
			}
			var e struct {
				Type       string `json:"type"`
				Command    string `json:"command"`
				Success    bool   `json:"success"`
				Method     string `json:"method"`
				ID         string `json:"id"`
				Message    string `json:"message"`
				NotifyType string `json:"notifyType"`
			}
			if json.Unmarshal([]byte(raw), &e) != nil {
				continue
			}
			if e.Type == "response" && e.Command == "prompt" {
				if !e.Success {
					finish(ToolFailed)
					return
				}
				if !started {
					started = true
					if l.send(map[string]any{"type": "prompt", "message": "/mcp login " + l.server}) != nil {
						finish(ToolFailed)
						return
					}
				}
			}
			if !started || e.Type != "extension_ui_request" {
				continue
			}
			l.mu.Lock()
			if e.Method == "input" && l.input == "" && !l.sent {
				l.input = e.ID
			}
			if e.Method == "notify" {
				if strings.HasPrefix(e.Message, "Signed in to MCP server \""+l.server+"\"") {
					missingConsent := l.fresh && authorization == ""
					l.mu.Unlock()
					if missingConsent {
						finish(ToolFailed)
					} else {
						finish(nil)
					}
					return
				}
				if e.NotifyType == "error" {
					l.mu.Unlock()
					finish(ToolFailed)
					return
				}
				// Pi's native message ends with the authorization URL. Only Atlassian's
				// fixed authorization host, which Trello's MCP also uses, is exposed,
				// not arbitrary extension output.
				parts := strings.Split(e.Message, "\n")
				candidate := parts[len(parts)-1]
				u, err := url.Parse(candidate)
				if err == nil && u.Scheme == "https" && u.Host == "auth.atlassian.com" && u.Path == "/authorize" && u.User == nil && u.Fragment == "" && len(candidate) <= 4096 {
					redirect := u.Query().Get("redirect_uri")
					state := u.Query().Get("state")
					p := Prompt{AuthorizationURL: candidate, RedirectPrefix: redirect, ExpiresAt: time.Now().Add(5 * time.Minute)}
					if state != "" && validPiOAuthPrompt(p) {
						authorization, l.prefix, l.state = candidate, redirect, state
					}
				}
			}
			if !announced && authorization != "" && l.input != "" {
				announced = true
				l.prompt <- Prompt{AuthorizationURL: authorization, RedirectPrefix: l.prefix, ExpiresAt: time.Now().Add(5 * time.Minute)}
			}
			l.mu.Unlock()
		}
	}
}

// Unlike Google's root redirect, native MCP uses exactly /callback with an
// allocated port. Do not broaden this into arbitrary loopback HTTP forwarding.
func validPiOAuthPrompt(p Prompt) bool {
	u, err := url.Parse(p.RedirectPrefix)
	return err == nil && u.Scheme == "http" && u.Hostname() == "127.0.0.1" && u.Port() != "" && u.Path == "/callback" && u.RawPath == "" && u.RawQuery == "" && u.Fragment == "" && u.User == nil && !strings.ContainsAny(p.RedirectPrefix, " \t\r\n")
}
func (l *piOAuthLogin) Prompt(ctx context.Context) (Prompt, error) {
	select {
	case p := <-l.prompt:
		return p, nil
	case <-l.done:
		if l.err != nil {
			return Prompt{}, l.err
		}
		return Prompt{Completed: true, ExpiresAt: time.Now().Add(time.Minute)}, nil
	case <-ctx.Done():
		return Prompt{}, ctx.Err()
	}
}
func (l *piOAuthLogin) Redirect(_ context.Context, raw string) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.sent || l.input == "" || !validRedirect(l.prefix, raw) {
		return RedirectRejected
	}
	u, err := url.Parse(raw)
	prefix, prefixErr := url.Parse(l.prefix)
	if err != nil || prefixErr != nil || u.Host != prefix.Host || u.Path != prefix.Path || u.RawPath != "" || len(u.Query()["state"]) != 1 || u.Query().Get("state") != l.state || u.Fragment != "" {
		return RedirectRejected
	}
	l.sent = true
	l.denied = u.Query().Get("error") == "access_denied"
	return l.send(map[string]any{"type": "extension_ui_response", "id": l.input, "value": raw})
}
func (l *piOAuthLogin) Wait(ctx context.Context) (string, error) {
	select {
	case <-l.done:
		<-l.tool.Done()
		return l.server, l.err
	case <-ctx.Done():
		return "", ctx.Err()
	}
}
func (l *piOAuthLogin) Cancel() { l.tool.Stop(); <-l.done }
