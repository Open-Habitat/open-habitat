//go:build linux

package cli

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestProtectedIntegrationInput(t *testing.T) {
	secret := "sk-" + strings.Repeat("q", 24)
	for _, file := range []bool{false, true} {
		source := "-"
		if file {
			source = filepath.Join(t.TempDir(), "key")
			if err := os.WriteFile(source, []byte(secret+"\n"), 0600); err != nil {
				t.Fatal(err)
			}
		}
		req, err := parseIntegrationRequest([]string{"credential", "update", "--provider", "deepseek", "--secret-file", source}, strings.NewReader(secret+"\n"))
		if err != nil {
			t.Fatal(err)
		}
		var input map[string]string
		if json.Unmarshal(req.body, &input) != nil || input["key"] != secret || input["provider"] != "deepseek" {
			t.Fatal("protected key not conveyed")
		}
	}
	input := `{"provider":"imap","address":"a@example.test","password":"secret"}`
	req, err := parseIntegrationRequest([]string{"integration-account", "update", "--input-file", "-"}, strings.NewReader(input))
	if err != nil || !bytes.Contains(req.body, []byte(`"action":"password"`)) {
		t.Fatal("password update not constructed", err)
	}
	for _, body := range []string{`{"provider":"imap","address":"a@example.test","password":"secret","action":"remove"}`, `{"uid":0}`, `{"provider":"imap","provider":"caldav","address":"a@example.test"}`, `null`, input + `{}`} {
		if _, err := parseIntegrationRequest([]string{"integration-account", "create", "--input-file", "-"}, strings.NewReader(body)); err == nil {
			t.Fatal("accepted ambiguous input")
		}
	}
	// The provider is an explicit target: never implied, never a subscription.
	for _, args := range [][]string{{"credential", "delete"}, {"credential", "delete", "--provider", "openai-codex"}, {"credential", "update", "--secret-file", "-"}, {"credential", "delete", "--provider", "openai", "--provider", "deepseek"}} {
		if _, err := parseIntegrationRequest(args, strings.NewReader(secret)); err == nil {
			t.Fatalf("accepted %v", args)
		}
	}
	if req, err := parseIntegrationRequest([]string{"credential", "delete", "--provider", "anthropic"}, nil); err != nil || req.method != "DELETE" || req.path != "/agent/v1/credentials/anthropic" {
		t.Fatal("removal does not target its provider")
	}
	// A refused preview must not even consume the secret stream.
	reader := strings.NewReader(secret)
	_, err = parseIntegrationRequest([]string{"credential", "update", "--provider", "openai", "--secret-file", "-", "--dry-run"}, reader)
	if ce, ok := err.(*cliError); !ok || ce.code != "dry_run_unsupported" || reader.Len() != len(secret) {
		t.Fatal("dry run read or wrote")
	}
}

func TestProtectedFilesAndErrors(t *testing.T) {
	secret := "sentinel-never-print"
	dir := t.TempDir()
	file := filepath.Join(dir, secret)
	os.WriteFile(file, []byte(secret), 0644)
	os.Chmod(file, 0644)
	for _, path := range []string{file, filepath.Join(dir, "missing")} {
		if _, err := readProtectedInput(path, strings.NewReader(""), 32); err == nil || strings.Contains(err.Error(), secret) {
			t.Fatal("unsafe file/error")
		}
	}
	os.Chmod(file, 0600)
	link := filepath.Join(dir, "link")
	os.Symlink(file, link)
	if _, err := readProtectedInput(link, strings.NewReader(""), 32); err == nil {
		t.Fatal("followed symlink")
	}
	if _, err := readProtectedInput("-", strings.NewReader(strings.Repeat("x", 33)), 32); err == nil {
		t.Fatal("unbounded input")
	}
	for _, args := range [][]string{
		{"agent", "credential", "update", "--key", secret, "--json"},
		{"agent", "credential", "update", "--secret-file", file, "--extra", secret, "--json"},
		{"agent", "integration-account", secret, "--help", "--json"},
		{"agent", "credential", "update", "--json=" + secret},
		{"--json=" + secret, "agent", "credential", "update"},
	} {
		var out, stderr bytes.Buffer
		if Run(args, &out, &stderr) == 0 || strings.Contains(out.String()+stderr.String(), secret) {
			t.Fatalf("secret leaked or input accepted: %s %s", out.String(), stderr.String())
		}
	}
}

func TestCodeHostProtectedToken(t *testing.T) {
	token := "sentinel" + strings.Repeat("7", 32)
	file := filepath.Join(t.TempDir(), "token")
	if err := os.WriteFile(file, []byte(token+"\n"), 0600); err != nil {
		t.Fatal(err)
	}
	req, err := parseIntegrationRequest([]string{"code-host", "create", "--provider", "gitlab", "--base-url", "https://forge.example.test/git", "--secret-file", file}, nil)
	var body map[string]string
	if err != nil || req.method != "POST" || req.path != "/agent/v1/integrations/gitlab" || json.Unmarshal(req.body, &body) != nil || body["action"] != "connect" || body["token"] != token || body["base_url"] != "https://forge.example.test/git" || len(body) != 3 {
		t.Fatal("connect not constructed", err, req)
	}
	// Later commands take the provider from the connection, never a flag
	// that could disagree with it.
	req, err = parseIntegrationRequest([]string{"code-host", "update", "--connection", "gitea_0123456789abcdef01234567", "--secret-file", "-"}, strings.NewReader(token))
	if err != nil || req.path != "/agent/v1/integrations/gitea" || !bytes.Contains(req.body, []byte(`"action":"replace"`)) || !bytes.Contains(req.body, []byte(token)) {
		t.Fatal("replace not constructed", err, req)
	}
	req, err = parseIntegrationRequest([]string{"code-host", "delete", "--connection", "gitea_0123456789abcdef01234567"}, nil)
	if err != nil || req.method != "DELETE" || string(req.body) != `{"action":"disconnect","connection_id":"gitea_0123456789abcdef01234567"}` {
		t.Fatal("disconnect not constructed", err, req)
	}
	for _, args := range [][]string{
		{"code-host", "create", "--provider", "gitea", "--base-url", "https://g.example.test"},
		{"code-host", "create", "--provider", "github", "--base-url", "https://g.example.test", "--secret-file", "-"},
		{"code-host", "create", "--base-url", "https://g.example.test", "--secret-file", "-"},
		{"code-host", "update", "--provider", "gitea", "--connection", "gitea_0123456789abcdef01234567", "--secret-file", "-"},
		{"code-host", "update", "--connection", "gitea_0123", "--secret-file", "-"},
		{"code-host", "check", "--connection", "gitea_0123456789abcdef01234567", "--secret-file", "-"},
		{"code-host", "check", "--connection", "gitea_0123456789abcdef01234567", "--dry-run"},
		{"code-host", "delete", "--connection", "gitea_0123456789abcdef01234567", "--connection", "gitlab_0123456789abcdef01234567"},
		{"code-host", "list"},
	} {
		if _, err := parseIntegrationRequest(args, strings.NewReader(token)); err == nil {
			t.Fatalf("accepted %v", args)
		}
	}
	// A token that is not one printable word is refused, not trimmed.
	for _, bad := range []string{token + " extra", token + "\n\n", "\n"} {
		if _, err := parseIntegrationRequest([]string{"code-host", "update", "--connection", "gitlab_0123456789abcdef01234567", "--secret-file", "-"}, strings.NewReader(bad)); err == nil {
			t.Fatalf("accepted %q", bad)
		}
	}
	reader := strings.NewReader(token)
	_, err = parseIntegrationRequest([]string{"code-host", "create", "--provider", "gitea", "--base-url", "https://g.example.test", "--secret-file", "-", "--dry-run"}, reader)
	if ce, ok := err.(*cliError); !ok || ce.code != "dry_run_unsupported" || reader.Len() != len(token) {
		t.Fatal("dry run read the token")
	}
	for _, args := range [][]string{
		{"agent", "code-host", "create", "--provider", "gitea", "--base-url", "https://g.example.test", "--token", token, "--json"},
		{"agent", "code-host", "update", "--connection", token, "--secret-file", file, "--json"},
		{"agent", "code-host", "create", "--json=" + token},
	} {
		var out, stderr bytes.Buffer
		if Run(args, &out, &stderr) == 0 || strings.Contains(out.String()+stderr.String(), token) {
			t.Fatalf("token leaked or input accepted: %s %s", out.String(), stderr.String())
		}
	}
}

func TestSettingCommands(t *testing.T) {
	key := "sentinel" + strings.Repeat("S", 24)
	req, err := parseIntegrationRequest([]string{"speech-key", "update", "--secret-file", "-"}, strings.NewReader(key+"\r\n"))
	if err != nil || req.method != "POST" || req.path != "/agent/v1/speech/key" || string(req.body) != `{"key":"`+key+`"}` {
		t.Fatal("speech key not constructed", err, req)
	}
	if req, err := parseIntegrationRequest([]string{"speech-key", "delete"}, nil); err != nil || req.method != "DELETE" || req.body != nil {
		t.Fatal("speech key removal", err, req)
	}
	settings := `{"level":"short","delay_seconds":120,"model":null,"words":20,"next_words":8,"messages":16,"history_tokens":4000,"message_tokens":500,"response_tokens":256,"first_after_turns":1}`
	req, err = parseIntegrationRequest([]string{"recap-settings", "update", "--input-file", "-"}, strings.NewReader(settings+"\n"))
	if err != nil || req.method != "PUT" || req.path != "/agent/v1/settings/recap" || string(req.body) != settings {
		t.Fatal("recap settings not constructed", err, req)
	}
	for _, c := range []struct {
		args  []string
		input string
	}{
		{[]string{"speech-key", "update", "--secret-file", "-"}, "$SONIOX_API_KEY"},
		{[]string{"speech-key", "update", "--input-file", "-"}, key},
		{[]string{"speech-key", "update"}, key},
		{[]string{"speech-key", "create", "--secret-file", "-"}, key},
		{[]string{"speech-key", "show", "--secret-file", "-"}, key},
		{[]string{"recap-settings", "delete"}, ""},
		{[]string{"recap-settings", "update", "--input-file", "-"}, `{"words":20,"words":30}`},
		{[]string{"recap-settings", "update", "--input-file", "-"}, `[]`},
		{[]string{"recap-settings", "show", "--dry-run"}, ""},
	} {
		if _, err := parseIntegrationRequest(c.args, strings.NewReader(c.input)); err == nil {
			t.Fatalf("accepted %v", c.args)
		}
	}
	reader := strings.NewReader(key)
	_, err = parseIntegrationRequest([]string{"speech-key", "update", "--secret-file", "-", "--dry-run"}, reader)
	if ce, ok := err.(*cliError); !ok || ce.code != "dry_run_unsupported" || reader.Len() != len(key) {
		t.Fatal("dry run read the key")
	}
	var out, stderr bytes.Buffer
	if Run([]string{"agent", "speech-key", "update", "--key", key, "--json"}, &out, &stderr) == 0 || strings.Contains(out.String()+stderr.String(), key) {
		t.Fatalf("key leaked or input accepted: %s %s", out.String(), stderr.String())
	}
}
