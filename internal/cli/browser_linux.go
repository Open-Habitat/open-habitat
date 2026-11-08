//go:build linux

package cli

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/browserhost"
	"github.com/Open-Habitat/open-habitat/internal/daemon"
	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
)

// browserHostCommand runs the person's server browser. Their daemon starts
// it as them with every path chosen; it is not an operator command.
func browserHostCommand(args []string, stderr io.Writer) (any, error) {
	cfg := browserhost.Config{Width: 1280, Height: 800, Idle: 24 * time.Hour}
	seen := map[string]bool{}
	for i := 0; i < len(args); i++ {
		flag := args[i]
		if seen[flag] {
			return nil, usage("duplicate " + flag)
		}
		seen[flag] = true
		if i+1 == len(args) {
			return nil, usage("missing value for " + flag)
		}
		i++
		value := args[i]
		switch flag {
		case "--dir":
			cfg.Dir = value
		case "--xvnc":
			cfg.Xvnc = value
		case "--chrome":
			cfg.Chrome = value
		case "--profile":
			cfg.Profile = value
		case "--cache":
			cfg.Cache = value
		case "--idle-seconds":
			n, err := strconv.Atoi(value)
			if err != nil || n < 60 || n > 30*24*3600 {
				return nil, usage(fmt.Sprintf("invalid --idle-seconds %q; expected 60–2592000", value))
			}
			cfg.Idle = time.Duration(n) * time.Second
		default:
			return nil, usage(fmt.Sprintf("unknown flag %q; expected --dir, --xvnc, --chrome, --profile, --cache or --idle-seconds", flag))
		}
	}
	for flag, p := range map[string]string{"--dir": cfg.Dir, "--xvnc": cfg.Xvnc, "--chrome": cfg.Chrome, "--profile": cfg.Profile, "--cache": cfg.Cache} {
		if !filepath.IsAbs(p) || filepath.Clean(p) != p {
			return nil, usage(fmt.Sprintf("%s must be an absolute clean path", flag))
		}
	}
	home, _ := os.UserHomeDir()
	lang := os.Getenv("LANG")
	if lang == "" {
		lang = "C.UTF-8"
	}
	cfg.Env = []string{"HOME=" + home, "USER=" + os.Getenv("USER"), "LOGNAME=" + os.Getenv("LOGNAME"), "LANG=" + lang, "PATH=/usr/local/bin:/usr/bin:/bin"}
	if rt := os.Getenv("XDG_RUNTIME_DIR"); rt != "" {
		cfg.Env = append(cfg.Env, "XDG_RUNTIME_DIR="+rt)
	}
	cfg.Log = diagnostic.New(stderr, "browser")
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	if err := browserhost.Run(ctx, cfg); err != nil {
		return nil, system("browser_failed", "the browser could not start")
	}
	return nil, nil
}

// agentBrowserCommand is the agent's view of the person's server browser:
// its state and DevTools address, starting it, and asking the person to
// handle one window.
func agentBrowserCommand(args []string) (any, error) {
	method, path, body, err := agentBrowserRequest(args)
	if err != nil {
		return nil, err
	}
	var data json.RawMessage
	if method == "GET" {
		data, err = exchangeAgent(path)
	} else {
		data, err = exchangeAgentBody(method, path, body)
	}
	if err != nil {
		return nil, err
	}
	return envelope(map[string]any{"cli_version": version, "result": data}), nil
}

func agentBrowserRequest(args []string) (method, path string, body []byte, err error) {
	switch {
	case len(args) == 1 && args[0] == "status":
		return "GET", daemon.AgentBrowserPath, nil, nil
	case len(args) == 1 && args[0] == "start":
		return "POST", daemon.AgentBrowserStartPath, []byte("{}"), nil
	case len(args) == 2 && args[0] == "request" && args[1] == "--clear":
		body, _ := json.Marshal(map[string]bool{"clear": true})
		return "POST", daemon.AgentBrowserRequestPath, body, nil
	case len(args) >= 3 && args[0] == "request":
		values := map[string]string{}
		for i := 1; i < len(args); i += 2 {
			if (args[i] != "--text" && args[i] != "--window") || i+1 == len(args) {
				return "", "", nil, usage("expected agent browser request --text TEXT [--window ID] or agent browser request --clear")
			}
			if _, dup := values[args[i]]; dup {
				return "", "", nil, usage("duplicate " + args[i])
			}
			values[args[i]] = args[i+1]
		}
		text, ok := values["--text"]
		if !ok || strings.TrimSpace(text) == "" || len([]rune(text)) > 300 {
			return "", "", nil, usage("invalid --text; expected 1–300 characters telling the person what the window needs")
		}
		req := map[string]string{"text": text}
		if w, ok := values["--window"]; ok {
			if !browserhost.TargetPattern.MatchString(w) {
				return "", "", nil, usage(fmt.Sprintf("invalid --window %q; expected a window id from agent browser status", w))
			}
			req["window"] = w
		}
		body, _ := json.Marshal(req)
		return "POST", daemon.AgentBrowserRequestPath, body, nil
	}
	return "", "", nil, usage("expected agent browser status, start, request --text TEXT [--window ID] or request --clear")
}
