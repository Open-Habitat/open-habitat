//go:build linux

package daemon

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
)

var testSalt = strings.Repeat("5a", 32)

func testFingerprint(key string) string {
	m := hmac.New(sha256.New, mustHex(testSalt))
	m.Write([]byte(key))
	return hex.EncodeToString(m.Sum(nil))
}

func mustHex(s string) []byte { b, _ := hex.DecodeString(s); return b }

func storedKey(t *testing.T, home, provider string) string {
	t.Helper()
	raw, _ := os.ReadFile(filepath.Join(home, ".pi/agent/auth.json"))
	var stored map[string]struct{ Type, Key string }
	_ = json.Unmarshal(raw, &stored)
	return stored[provider].Key
}

// An already-joined person gets the site key only where their Pi has none
// for the provider or exactly a copy the site gave earlier; their own key
// or subscription is never touched, and the check writes nothing.
func TestGiveSiteKeyReplacesOnlySiteCopies(t *testing.T) {
	p, home := piFixture(t)
	ctx := context.Background()
	old := "sk-ant-api03-" + strings.Repeat("O", 40) + "m4Pz"
	cur := "sk-ant-api03-" + strings.Repeat("C", 40) + "7Q2x"
	check := func(earlier ...string) string {
		t.Helper()
		got, err := p.CheckSiteKey(ctx, "anthropic", SiteKeyInput{Salt: testSalt, Current: testFingerprint(cur), Earlier: append([]string{}, earlier...)})
		if err != nil {
			t.Fatal(err)
		}
		return got
	}
	give := func(key string, earlier ...string) string {
		t.Helper()
		got, err := p.GiveSiteKey(ctx, "anthropic", SiteKeyInput{Salt: testSalt, Key: key, Earlier: append([]string{}, earlier...)})
		if err != nil {
			t.Fatal(err)
		}
		return got
	}
	if got := check(); got != "absent" {
		t.Fatal(got)
	}
	if _, err := os.Stat(filepath.Join(home, ".pi/agent/auth.json")); err == nil {
		if storedKey(t, home, "anthropic") != "" {
			t.Fatal("a check wrote a key")
		}
	}
	if got := give(old); got != "seeded" {
		t.Fatal(got)
	}
	models, err := p.catalog(ctx, "")
	if err != nil || models.DefaultProvider == nil || *models.DefaultProvider != "anthropic" {
		t.Fatal("the first site key did not become the default of a person with none")
	}
	settings := filepath.Join(home, ".pi/agent/settings.json")
	before, _ := os.ReadFile(settings)
	if got := check(testFingerprint(old)); got != "earlier" {
		t.Fatal(got)
	}
	// Without the earlier fingerprint the old copy is not recognised, and
	// anything unrecognised is the person's own.
	if got := check(); got != "own" {
		t.Fatal(got)
	}
	if got := give(cur); got != "kept" || storedKey(t, home, "anthropic") != old {
		t.Fatal("replaced an unrecognised key", got)
	}
	if got := give(cur, testFingerprint(old)); got != "replaced" || storedKey(t, home, "anthropic") != cur {
		t.Fatal("did not replace the site's earlier copy", got)
	}
	if after, _ := os.ReadFile(settings); !bytes.Equal(before, after) {
		t.Fatal("a replacement changed the person's settings")
	}
	if got := check(testFingerprint(old)); got != "current" {
		t.Fatal(got)
	}
	if got := give(cur, testFingerprint(old)); got != "already_current" {
		t.Fatal(got)
	}
	// The person changes to their own key; nothing the site sends replaces it.
	own := "sk-ant-api03-" + strings.Repeat("M", 40) + "k9Lw"
	if _, err := p.credentials(ctx, "save", "anthropic", own); err != nil {
		t.Fatal(err)
	}
	if got := check(testFingerprint(old)); got != "own" {
		t.Fatal(got)
	}
	if got := give(cur, testFingerprint(old)); got != "kept" || storedKey(t, home, "anthropic") != own {
		t.Fatal("overwrote the person's own key", got)
	}

	// A Claude sign-in kept under the same id, and a raw command reference,
	// are the person's own and stay byte for byte.
	for _, entry := range []string{
		`{"anthropic":{"type":"oauth","access":"synthetic-access","refresh":"synthetic-refresh","expires":4102444800000}}`,
		`{"anthropic":{"type":"api_key","key":"!echo sk-ant-api03-` + strings.Repeat("O", 40) + `m4Pz"}}`,
	} {
		p2, home2 := piFixture(t)
		path := filepath.Join(home2, ".pi/agent/auth.json")
		if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(entry), 0600); err != nil {
			t.Fatal(err)
		}
		in := SiteKeyInput{Salt: testSalt, Current: testFingerprint(cur), Earlier: []string{testFingerprint(old)}}
		if got, err := p2.CheckSiteKey(ctx, "anthropic", in); err != nil || got != "own" {
			t.Fatal(got, err)
		}
		if got, err := p2.GiveSiteKey(ctx, "anthropic", SiteKeyInput{Salt: testSalt, Key: cur, Earlier: in.Earlier}); err != nil || got != "kept" {
			t.Fatal(got, err)
		}
		if raw, _ := os.ReadFile(path); string(raw) != entry {
			t.Fatal("the site key changed a credential the person added")
		}
	}

	// Malformed input never reaches Pi.
	for _, in := range []SiteKeyInput{
		{Salt: "zz", Key: cur, Earlier: []string{}},
		{Salt: testSalt, Key: "!id", Earlier: []string{}},
		{Salt: testSalt, Key: cur},
		{Salt: testSalt, Key: cur, Current: testFingerprint(cur), Earlier: []string{}},
		{Salt: testSalt, Key: cur, Earlier: []string{"nothex"}},
	} {
		if _, err := p.GiveSiteKey(ctx, "anthropic", in); err == nil {
			t.Fatalf("accepted %+v", in)
		}
	}
	if _, err := p.CheckSiteKey(ctx, "anthropic", SiteKeyInput{Salt: testSalt, Current: testFingerprint(cur), Earlier: []string{testFingerprint(cur)}}); err == nil {
		t.Fatal("accepted the current fingerprint as an earlier one")
	}
}

// The write decides under Pi's own file lock: a key the person saves while
// the site's write waits is never replaced, even though a check made before
// the lock said earlier.
func TestGiveSiteKeyDecidesUnderTheLock(t *testing.T) {
	p, home := piFixture(t)
	path := filepath.Join(home, ".pi/agent/auth.json")
	old := "sk-" + strings.Repeat("o", 30) + "olds"
	cur := "sk-" + strings.Repeat("n", 30) + "news"
	own := "sk-" + strings.Repeat("p", 30) + "mine"
	if got, err := p.GiveSiteKey(context.Background(), "openai", SiteKeyInput{Salt: testSalt, Key: old, Earlier: []string{}}); err != nil || got != "seeded" {
		t.Fatal(got, err)
	}
	storage, _ := filepath.Abs(filepath.Join("pi-device-test", "node_modules", "@earendil-works", "pi-coding-agent", "dist", "core", "auth-storage.js"))
	holder := `import { AuthStorage } from ` + strconvQuote(storage) + `;
import { createInterface } from 'node:readline';
const lines = createInterface({ input: process.stdin });
await AuthStorage.create(process.argv[1]).storage.withLockAsync(async () => {
  process.stdout.write('locked\n');
  for await (const _ of lines) break;
  return { result: undefined, next: JSON.stringify({ openai: { type: 'api_key', key: process.argv[2] } }) };
});
`
	node, _ := exec.LookPath("node")
	cmd := exec.Command(node, "--input-type=module", "--eval", holder, path, own)
	cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=" + home}
	in, _ := cmd.StdinPipe()
	out, _ := cmd.StdoutPipe()
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	defer cmd.Process.Kill()
	buf := make([]byte, 7)
	if _, err := io.ReadFull(out, buf); err != nil || string(buf) != "locked\n" {
		t.Fatal("holder did not take the lock", err, string(buf))
	}
	result := make(chan string, 1)
	go func() {
		got, _ := p.GiveSiteKey(context.Background(), "openai", SiteKeyInput{Salt: testSalt, Key: cur, Earlier: []string{testFingerprint(old)}})
		result <- got
	}()
	select {
	case got := <-result:
		t.Fatal("the write did not wait for the lock", got)
	case <-time.After(1500 * time.Millisecond):
	}
	_, _ = io.WriteString(in, "save\n")
	_ = in.Close()
	select {
	case got := <-result:
		if got != "kept" {
			t.Fatal("write answered", got)
		}
	case <-time.After(15 * time.Second):
		t.Fatal("write never finished")
	}
	_ = cmd.Wait()
	if storedKey(t, home, "openai") != own {
		t.Fatal("the person's own key was replaced")
	}
}

// The route answers only the gateway peer, with one fixed word, and refuses
// any request shape it does not know before Pi runs.
func TestSiteKeyHandler(t *testing.T) {
	p, _ := piFixture(t)
	cur := "sk-" + strings.Repeat("n", 30) + "news"
	trusted := true
	h := SiteKeyHandler(transport.Config{}, func(*http.Request) bool { return trusted }, p)
	post := func(body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodPost, SiteKeyPath, strings.NewReader(body))
		r.Host = "unix"
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	check := `{"schema_version":1,"action":"check","provider":"openai","salt":"` + testSalt + `","current":"` + testFingerprint(cur) + `","earlier":[]}`
	if w := post(check); w.Code != 200 || strings.TrimSpace(w.Body.String()) != `{"schema_version":1,"state":"absent"}` {
		t.Fatal(w.Code, w.Body.String())
	}
	seed := `{"schema_version":1,"action":"seed","provider":"openai","salt":"` + testSalt + `","key":"` + cur + `","earlier":[]}`
	if w := post(seed); w.Code != 200 || strings.TrimSpace(w.Body.String()) != `{"outcome":"seeded","schema_version":1}` {
		t.Fatal(w.Code, w.Body.String())
	}
	for _, bad := range []string{
		strings.Replace(check, `"check"`, `"save"`, 1),
		strings.Replace(check, `"openai"`, `"openai-codex"`, 1),
		strings.Replace(check, `"earlier":[]`, `"earlier":[],"subject":"1"`, 1),
		strings.Replace(seed, `"earlier":[]`, `"earlier":[],"current":"`+testFingerprint(cur)+`"`, 1),
		`{"schema_version":2}`,
	} {
		if w := post(bad); w.Code != 400 {
			t.Fatal("accepted", bad, w.Code)
		}
	}
	trusted = false
	if w := post(check); w.Code != 403 {
		t.Fatal("answered a peer other than the gateway", w.Code)
	}
}
