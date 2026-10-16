//go:build linux

package daemon

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

func TestPiCredentialsNative(t *testing.T) {
	p, home := piFixture(t)
	ctx := context.Background()
	for _, key := range []string{"!id", "$HOME", "${X}", "sk-short", "sk-" + strings.Repeat("a", 201)} {
		if _, err := p.credentials(ctx, "save", key); err == nil {
			t.Fatal("accepted nonliteral key")
		}
	}
	if _, err := os.Stat(filepath.Join(home, ".pi")); !os.IsNotExist(err) {
		t.Fatal("invalid input wrote native files")
	}
	// A real native OAuth record is preserved byte-for-byte through key changes.
	_, events, err := p.Start()
	if err != nil {
		t.Fatal(err)
	}
	for range events {
	}
	path := filepath.Join(home, ".pi/agent/auth.json")
	before, _ := os.ReadFile(path)
	var original map[string]json.RawMessage
	_ = json.Unmarshal(before, &original)
	key := "sk-" + strings.Repeat("a", 24) + "abcd"
	result, err := p.credentials(ctx, "save", key)
	if err != nil {
		t.Fatal(err)
	}
	reply, _ := json.Marshal(result)
	if !result.OpenAI.Present || result.OpenAI.Suffix == nil || *result.OpenAI.Suffix != "abcd" || strings.Contains(string(reply), key) {
		t.Fatal("unsafe or incomplete credential reply")
	}
	st, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if st.Mode().Perm() != 0600 || st.Sys().(*syscall.Stat_t).Uid != uint32(os.Geteuid()) {
		t.Fatal("credential file has wrong mode/owner")
	}
	raw, _ := os.ReadFile(path)
	var stored map[string]json.RawMessage
	_ = json.Unmarshal(raw, &stored)
	if string(stored["openai-codex"]) != string(original["openai-codex"]) {
		t.Fatal("OAuth entry changed")
	}
	models, err := p.catalog(ctx, "")
	if err != nil {
		t.Fatal(err)
	}
	var apiModel string
	for _, m := range models.Models {
		if m.Provider == "openai" {
			apiModel = m.ID
			break
		}
	}
	if apiModel == "" {
		t.Fatal("no API models")
	}
	if _, err = p.catalog(ctx, apiModel, "", "openai"); err != nil {
		t.Fatal(err)
	}
	if _, err = p.credentials(ctx, "remove", ""); err != nil {
		t.Fatal(err)
	}
	raw, _ = os.ReadFile(path)
	_ = json.Unmarshal(raw, &stored)
	var after map[string]json.RawMessage
	_ = json.Unmarshal(raw, &after)
	if after["openai"] != nil || string(after["openai-codex"]) != string(original["openai-codex"]) {
		t.Fatal("removal damaged native credentials")
	}
	models, err = p.catalog(ctx, "")
	if err != nil || models.DefaultProvider == nil || *models.DefaultProvider != "openai-codex" || models.DefaultModel == nil || *models.DefaultModel != "gpt-6.1-sol" {
		t.Fatal("removal did not restore subscription default")
	}
}

func TestPiCredentialsUnsafeAndRawReferences(t *testing.T) {
	p, home := piFixture(t)
	ctx := context.Background()
	path := filepath.Join(home, ".pi/agent/auth.json")
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		t.Fatal(err)
	}
	// Raw read does not execute Pi's command syntax and does not invent a suffix.
	if err := os.WriteFile(path, []byte(`{"openai":{"type":"api_key","key":"!touch should-not-exist"}}`), 0600); err != nil {
		t.Fatal(err)
	}
	result, err := p.credentials(ctx, "read", "")
	if err != nil || !result.OpenAI.Present || result.OpenAI.Suffix != nil {
		t.Fatal("raw credential read failed")
	}
	if _, err := os.Stat(filepath.Join(home, "should-not-exist")); !os.IsNotExist(err) {
		t.Fatal("read executed a resolver")
	}
	// Native read-only auth resolves environment variables in Pi 1.3; suffix reads
	// must instead use its raw stored-credential reader.
	t.Setenv("OH_TEST_KEY", "sk-"+strings.Repeat("z", 24)+"wxyz")
	for _, ref := range []string{"$OH_TEST_KEY", "${OH_TEST_KEY}"} {
		raw, _ := json.Marshal(map[string]any{"openai": map[string]any{"type": "api_key", "key": ref}})
		if err := os.WriteFile(path, raw, 0600); err != nil {
			t.Fatal(err)
		}
		result, err = p.credentials(ctx, "read", "")
		if err != nil || !result.OpenAI.Present || result.OpenAI.Suffix != nil {
			t.Fatal("credential read resolved an environment reference")
		}
	}
	// Pi's session directories can be 0755 under a normal SSH umask. Read bits
	// do not disclose a 0600 credential, but group/other write bits remain unsafe.
	for _, dir := range []string{filepath.Join(home, ".pi"), filepath.Join(home, ".pi/agent")} {
		if err := os.Chmod(dir, 0755); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = p.credentials(ctx, "save", "sk-"+strings.Repeat("c", 24)); err != nil {
		t.Fatal("rejected native nonwritable directories")
	}
	if err := os.Chmod(filepath.Join(home, ".pi/agent"), 0770); err != nil {
		t.Fatal(err)
	}
	if _, err = p.credentials(ctx, "remove", ""); err == nil {
		t.Fatal("accepted group-writable credential directory")
	}
	_ = os.Chmod(filepath.Join(home, ".pi/agent"), 0755)
	if err := os.Chmod(path, 0644); err != nil {
		t.Fatal(err)
	}
	for _, action := range []string{"read", "save", "remove"} {
		if _, err := p.credentials(ctx, action, "sk-"+strings.Repeat("b", 24)); err == nil {
			t.Fatal("accepted unsafe mode")
		}
	}
	_ = os.Remove(path)
	outside := filepath.Join(t.TempDir(), "auth.json")
	_ = os.WriteFile(outside, []byte("{}"), 0600)
	_ = os.Symlink(outside, path)
	if _, err := p.credentials(ctx, "save", "sk-"+strings.Repeat("b", 24)); err == nil {
		t.Fatal("followed credential symlink")
	}
	raw, _ := os.ReadFile(outside)
	if string(raw) != "{}" {
		t.Fatal("changed symlink target")
	}
}

func TestPiCredentialsAPIOnlyReadinessAndReplacement(t *testing.T) {
	p, home := piFixture(t)
	ctx := context.Background()
	if _, err := p.credentials(ctx, "save", "sk-"+strings.Repeat("a", 24)); err != nil {
		t.Fatal(err)
	}
	models, err := p.catalog(ctx, "")
	if err != nil || models.DefaultModel == nil || *models.DefaultModel != "gpt-5.5" {
		t.Fatal("first API key did not select Pi's native default model")
	}
	if p.Status() != "usable" {
		t.Fatal("API-only account blocked by subscription gate")
	}
	settings := filepath.Join(home, ".pi/agent/settings.json")
	before, _ := os.ReadFile(settings)
	if _, err := p.credentials(ctx, "save", "sk-"+strings.Repeat("b", 24)); err != nil {
		t.Fatal(err)
	}
	after, _ := os.ReadFile(settings)
	if string(before) != string(after) {
		t.Fatal("replacement changed default settings")
	}
	if _, err := p.credentials(ctx, "remove", ""); err != nil {
		t.Fatal(err)
	}
	if p.Status() != "missing" {
		t.Fatal("account without credentials did not return to onboarding")
	}
}
