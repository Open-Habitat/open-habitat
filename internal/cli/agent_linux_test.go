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

func TestAgentCLIContextValidation(t *testing.T) {
	for _, k := range []string{"OPEN_HABITAT_CONVERSATION_ID", "OPEN_HABITAT_WORKSPACE_ID", "OPEN_HABITAT_LAUNCH_GENERATION"} {
		t.Setenv(k, "")
	}
	code, _, message := call(t, "agent", "conversation", "show", "--current", "--json")
	if code != 1 || !strings.Contains(message, "current_context_unavailable") {
		t.Fatalf("%d %s", code, message)
	}
	t.Setenv("OPEN_HABITAT_CONVERSATION_ID", "pi:00000000-0000-4000-8000-000000000001")
	t.Setenv("OPEN_HABITAT_WORKSPACE_ID", "ws_example123")
	t.Setenv("OPEN_HABITAT_LAUNCH_GENERATION", "00000000-0000-4000-8000-000000000002")
	if p, e := agentRequestPath([]string{"conversation", "show", "--current"}); e != nil || !strings.Contains(p, "generation=") {
		t.Fatalf("%s %v", p, e)
	}
	for _, args := range [][]string{{"environment", "show", "--uid", "0"}, {"workspace", "list", "--socket", "/elsewhere"}, {"conversation", "show", "--current", "pi:00000000-0000-4000-8000-000000000001"}, {"conversation", "show", " pi:00000000-0000-4000-8000-000000000001"}} {
		if _, e := agentRequestPath(args); e == nil {
			t.Fatalf("accepted %v", args)
		}
	}
}
func TestHelpDrilldownAndAgentSkill(t *testing.T) {
	for _, spec := range helpSpecs {
		args := append(strings.Fields(spec.path), "--help", "--json")
		code, out, message := call(t, args...)
		if code != 0 {
			t.Fatalf("%v: %s", args, message)
		}
		data := out["data"].(map[string]any)
		if len(data["examples"].([]any)) == 0 || data["command_path"] == nil || data["exit_codes"] == nil {
			t.Fatalf("incomplete help %v", data)
		}
	}
	var raw, stderr bytes.Buffer
	if code := Run([]string{"agent", "--help"}, &raw, &stderr); code != 0 || json.Valid(raw.Bytes()) || !strings.Contains(raw.String(), "Exit codes") {
		t.Fatalf("text help %d %s %s", code, raw.String(), stderr.String())
	}
	raw.Reset()
	if code := Run([]string{"skill", "print", "agent"}, &raw, &stderr); code != 0 {
		t.Fatal(code)
	}
	target := t.TempDir()
	if code, _, msg := call(t, "skill", "install", "agent", "--target", target, "--json"); code != 0 {
		t.Fatal(msg)
	}
	for _, layout := range []string{".claude/skills/agent/SKILL.md", ".pi/agent/skills/agent/SKILL.md", ".codex/skills/agent/SKILL.md"} {
		b, e := os.ReadFile(filepath.Join(target, layout))
		if e != nil || !bytes.Equal(b, raw.Bytes()) {
			t.Fatalf("%s: %v", layout, e)
		}
	}
}
func TestAgentHelpDescribesProcessLifetimeAndCommandSpecificIO(t *testing.T) {
	for _, tc := range []struct {
		path, flag string
		want, deny []string
	}{
		{"agent conversation stop", "", []string{"managed background processes (process tool)", "when the daemon stops", "even if detached", "Taskfleet workers", "XDG_RUNTIME_DIR=", "shell-tab and SSH"}, []string{"not its detached tools"}},
		{"agent attachment create", "--input-file", []string{"raw attachment bytes", "1 byte to 20 MiB", "regular file or - for stdin"}, []string{"protected JSON", "0600"}},
		{"agent attachment show", "--output", []string{"binary attachment bytes, not JSONL", "never overwrites"}, []string{"FILE.jsonl"}},
		{"agent conversation create", "--provider", []string{"Optional", "requires --model", "inherit native defaults"}, []string{"Required"}},
		{"agent conversation create", "--model", []string{"Optional", "inherit native defaults"}, []string{"Required"}},
		{"agent model update", "--provider", []string{"Required"}, nil},
		// A card's key is made once and kept; the reply-less retry looks first.
		{"agent notice create", "--idempotency-key", []string{"before the command and print it", "passes that printed key", "agent notice list --current before retrying"}, nil},
		{"agent view offer", "--idempotency-key", []string{"before the command and print it", "passes that printed key", "agent view list before retrying"}, nil},
		{"agent file offer", "--idempotency-key", []string{"before the command and print it", "passes that printed key", "agent file list before retrying"}, nil},
	} {
		t.Run(tc.path+"/"+tc.flag, func(t *testing.T) {
			args := append(strings.Fields(tc.path), "--help", "--json")
			code, out, message := call(t, args...)
			if code != 0 {
				t.Fatalf("help: %s", message)
			}
			data := out["data"].(map[string]any)
			text := data["description"].(string)
			if tc.flag != "" {
				text = ""
				for _, raw := range data["flags"].([]any) {
					flag := raw.(map[string]any)
					if flag["long"] == tc.flag {
						text = flag["description"].(string)
					}
				}
			}
			for _, want := range tc.want {
				if !strings.Contains(text, want) {
					t.Errorf("missing %q in %q", want, text)
				}
			}
			for _, deny := range tc.deny {
				if strings.Contains(text, deny) {
					t.Errorf("misleading %q in %q", deny, text)
				}
			}
		})
	}
}

func TestPersonalSettingsDoesNotExposeExtensionSecrets(t *testing.T) {
	p := filepath.Join(t.TempDir(), "settings.json")
	if err := os.WriteFile(p, []byte(`{"defaultModel":"example","extension":{"secret":"sentinel-secret"}}`), 0600); err != nil {
		t.Fatal(err)
	}
	settings, err := readPersonalSettings(p)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := json.Marshal(settings)
	if strings.Contains(string(b), "sentinel-secret") {
		t.Fatal("extension secrets leaked")
	}
	os.WriteFile(p, []byte("malformed"), 0600)
	if _, err := readPersonalSettings(p); err == nil {
		t.Fatal("malformed config succeeded")
	}
	t.Setenv("HOME", "/forged/home")
	t.Setenv("USER", "forged")
	t.Setenv("OPEN_HABITAT_CONFIG", "/forged/config")
	p, err = personalConfigPath()
	if err != nil || strings.HasPrefix(p, "/forged") {
		t.Fatalf("personal path trusted environment %s %v", p, err)
	}
}

func TestAgentWorkspaceOutput(t *testing.T) {
	p := filepath.Join(t.TempDir(), "workspaces.jsonl")
	data := json.RawMessage(`{"schema_version":1,"state":"present","workspaces":[{"workspace_id":"ws_example123","name":"example"}]}`)
	out, err := writeWorkspaceOutput(p, data)
	if err != nil {
		t.Fatal(err)
	}
	if out.(map[string]any)["data"].(map[string]any)["count"] != 1 {
		t.Fatal(out)
	}
	b, err := os.ReadFile(p)
	if err != nil || !json.Valid(bytes.TrimSpace(b)) || !bytes.Contains(b, []byte(`"schema_version":1`)) {
		t.Fatalf("invalid export %s %v", b, err)
	}
	if _, err := writeWorkspaceOutput(p, data); err == nil {
		t.Fatal("overwrote export")
	}
}

func TestVersionAliasJSONAndText(t *testing.T) {
	for _, jsonFlag := range [][]string{nil, {"--json"}} {
		run := func(args []string) (int, string, string) {
			var out, err bytes.Buffer
			code := Run(args, &out, &err)
			return code, out.String(), err.String()
		}
		code, out, err := run(append([]string{"version"}, jsonFlag...))
		for _, args := range [][]string{append([]string{"--version"}, jsonFlag...), append(append([]string{}, jsonFlag...), "--version")} {
			c, o, e := run(args)
			if c != code || o != out || e != err {
				t.Fatalf("alias drift %v", args)
			}
		}
	}
	if code, _, _ := call(t, "--version", "--unknown", "--json"); code != 1 {
		t.Fatal("version alias ignored unexpected argument")
	}
}

// The agent skill keeps the idempotency key past its shell and names the one
// persistence path each card command reports.
func TestAgentSkillKeepsIdempotencyKeys(t *testing.T) {
	var raw, stderr bytes.Buffer
	if code := Run([]string{"skill", "print", "agent"}, &raw, &stderr); code != 0 {
		t.Fatal(code, stderr.String())
	}
	skill := strings.Join(strings.Fields(raw.String()), " ")
	for _, want := range []string{`KEY=$(cat /proc/sys/kernel/random/uuid); echo "key $KEY"`, "passes that printed key", "`view list`, `file list`", "data.result.notice.persistence", "data.result.offer.persistence"} {
		if !strings.Contains(skill, want) {
			t.Errorf("agent skill lacks %q", want)
		}
	}
	if strings.Contains(skill, "--idempotency-key UUID") {
		t.Error("agent skill example names the key inline")
	}
}
