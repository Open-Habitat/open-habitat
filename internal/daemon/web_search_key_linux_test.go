//go:build linux

package daemon

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/open-habitat/open-habitat/internal/transport"
)

const ownSearchKey = "BSAown00000000000000000000Ab12"
const siteSearchKey = "BSAsite0000000000000000000Zz99"

// fakeBrave is a synthetic Brave Search API: a key it lists works, any
// other is refused with 401; status, when set, is every answer instead and
// body its text.
type fakeBrave struct {
	srv    *httptest.Server
	mu     sync.Mutex
	works  map[string]bool
	asked  []string
	status atomic.Int32
	body   atomic.Value
}

func newFakeBrave(t *testing.T, works ...string) *fakeBrave {
	f := &fakeBrave{works: map[string]bool{}}
	for _, k := range works {
		f.works[k] = true
	}
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := r.Header.Get("X-Subscription-Token")
		f.mu.Lock()
		f.asked = append(f.asked, r.URL.Path+"?"+r.URL.RawQuery+" "+r.Header.Get("Accept"))
		ok := f.works[key]
		f.mu.Unlock()
		switch code := int(f.status.Load()); {
		case code != 0:
			body, _ := f.body.Load().(string)
			w.WriteHeader(code)
			io.WriteString(w, body)
		case !ok:
			http.Error(w, `{"error":{"code":"SUBSCRIPTION_TOKEN_INVALID","detail":"secret detail"}}`, 401)
		default:
			w.Header().Set("Content-Type", "application/json")
			io.WriteString(w, `{"web":{"results":[{"title":"x","url":"https://example.invalid"}]}}`)
		}
	}))
	t.Cleanup(f.srv.Close)
	return f
}

func (f *fakeBrave) search(t *testing.T, home string) *WebSearch {
	native := filepath.Join(t.TempDir(), "native-search.json")
	if err := os.WriteFile(native, []byte(`{"schema":1,"providers":[{"provider":"openai-codex","api":"openai-codex-responses"},{"provider":"openai","api":"openai-responses"},{"provider":"anthropic","api":"anthropic-messages"},{"provider":"claude-bridge"}]}`), 0644); err != nil {
		t.Fatal(err)
	}
	return NewWebSearchWithFixture(transport.Config{Home: home}, func(*http.Request) bool { return true }, func(string) string { return f.srv.URL + "/res/v1/web/search" }, nil, native)
}

func searchState(t *testing.T, w *httptest.ResponseRecorder) webSearchKeyState {
	t.Helper()
	var s webSearchKeyState
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &s) != nil || s.SchemaVersion != 1 {
		t.Fatalf("state: %d %s", w.Code, w.Body)
	}
	return s
}

func TestWebSearchSiteCopyNeverReplacesTheOwnKey(t *testing.T) {
	home := t.TempDir()
	s := newFakeBrave(t, ownSearchKey).search(t, home)
	give := func(key, want string) {
		t.Helper()
		got, err := s.GiveSiteKey(key, "brave")
		if err != nil || got != want {
			t.Fatalf("give %s: %q %v, want %q", key, got, err, want)
		}
	}
	give(siteSearchKey, "seeded")
	give(siteSearchKey, "already_current")
	give("BSAnext0000000000000000000Zz98", "replaced")
	if w := speechRequest(t, s.KeyHandler(), "POST", WebSearchKeyPath, `{"backend":"brave","key":"`+ownSearchKey+`"}`); w.Code != 200 {
		t.Fatalf("save: %d %s", w.Code, w.Body)
	}
	give(siteSearchKey, "kept")
	k, err := readWebSearchKey(home)
	if err != nil || k.APIKey != ownSearchKey || k.Source != "own" || k.Backend != "brave" {
		t.Fatalf("own key replaced: %+v %v", k, err)
	}
	st, err := os.Stat(filepath.Join(home, ".config/web-search/key.json"))
	if err != nil || st.Mode().Perm() != 0600 {
		t.Fatalf("permissions: %v %v", st, err)
	}
	// A Staan key the person wrote by hand is theirs, though no trial
	// search exists for it.
	if err := os.WriteFile(filepath.Join(home, ".config/web-search/key.json"), []byte(`{"api_key":"`+ownSearchKey+`","backend":"staan","source":"own"}`), 0600); err != nil {
		t.Fatal(err)
	}
	give(siteSearchKey, "kept")
	// A file the daemon cannot read as the person's key is never absence: a
	// site copy must not land over it.
	for _, bad := range []string{`{"api_key":"x"}`, `{"api_key":"` + ownSearchKey + `","backend":"brave","source":"own","extra":1}`} {
		if err := os.WriteFile(filepath.Join(home, ".config/web-search/key.json"), []byte(bad), 0600); err != nil {
			t.Fatal(err)
		}
		if _, err := s.GiveSiteKey(siteSearchKey, "brave"); err == nil {
			t.Fatalf("gave over an unreadable key file %s", bad)
		}
	}
	if err := os.Chmod(filepath.Join(home, ".config/web-search/key.json"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(home, ".config/web-search/key.json"), []byte(`{"api_key":"`+ownSearchKey+`","backend":"brave","source":"own"}`), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GiveSiteKey(siteSearchKey, "brave"); err == nil {
		t.Fatal("gave over a group-readable key file")
	}
	if w := speechRequest(t, s.KeyHandler(), "GET", WebSearchKeyPath, ""); w.Code != 503 || !strings.Contains(w.Body.String(), "native_unavailable") {
		t.Fatalf("unsafe file read: %d %s", w.Code, w.Body)
	}
}

func TestWebSearchSaveTriesTheKeyFirst(t *testing.T) {
	home := t.TempDir()
	brave := newFakeBrave(t, ownSearchKey)
	s := brave.search(t, home)
	h := s.KeyHandler()
	empty := searchState(t, speechRequest(t, h, "GET", WebSearchKeyPath, ""))
	if empty.Present || empty.Backend != nil || empty.Suffix != nil || empty.RefusedAt != nil || strings.Join(empty.NativeProviders, ",") != "openai-codex,openai,anthropic,claude-bridge" {
		t.Fatalf("empty state: %+v", empty)
	}
	// A refused key, a limit and an unreachable service store nothing and
	// carry none of the service's text.
	w := speechRequest(t, h, "POST", WebSearchKeyPath, `{"backend":"brave","key":"BSAwrong000000000000000000Xy00"}`)
	if w.Code != 409 || !strings.Contains(w.Body.String(), "search_key_rejected") || strings.Contains(w.Body.String(), "secret") {
		t.Fatalf("refused: %d %s", w.Code, w.Body)
	}
	for status, want := range map[int]string{429: "search_limit_reached", 402: "search_limit_reached", 500: "search_unavailable", 302: "search_unavailable", 403: "search_key_rejected"} {
		brave.status.Store(int32(status))
		brave.body.Store("secret detail")
		w = speechRequest(t, h, "POST", WebSearchKeyPath, `{"backend":"brave","key":"`+ownSearchKey+`"}`)
		if !strings.Contains(w.Body.String(), want) || strings.Contains(w.Body.String(), "secret") {
			t.Fatalf("status %d: %d %s", status, w.Code, w.Body)
		}
		s.checks = nil
	}
	brave.status.Store(422)
	brave.body.Store(`{"error":{"code":"SUBSCRIPTION_TOKEN_INVALID"}}`)
	if w = speechRequest(t, h, "POST", WebSearchKeyPath, `{"backend":"brave","key":"`+ownSearchKey+`"}`); !strings.Contains(w.Body.String(), "search_key_rejected") {
		t.Fatalf("422 token: %d %s", w.Code, w.Body)
	}
	brave.body.Store(`{"error":{"code":"VALIDATION"}}`)
	if w = speechRequest(t, h, "POST", WebSearchKeyPath, `{"backend":"brave","key":"`+ownSearchKey+`"}`); !strings.Contains(w.Body.String(), "search_unavailable") {
		t.Fatalf("422 other: %d %s", w.Code, w.Body)
	}
	if k, _ := readWebSearchKey(home); k != nil {
		t.Fatalf("stored without a passing trial search: %+v", k)
	}
	brave.status.Store(0)
	s.checks = nil
	saved := searchState(t, speechRequest(t, h, "POST", WebSearchKeyPath, `{"backend":"brave","key":"`+ownSearchKey+`"}`))
	if !saved.Present || *saved.Backend != "brave" || *saved.Suffix != "Ab12" || *saved.Source != "own" || saved.RefusedAt != nil {
		t.Fatalf("saved: %+v", saved)
	}
	asked := brave.asked[len(brave.asked)-1]
	if !strings.HasPrefix(asked, "/res/v1/web/search?") || !strings.Contains(asked, "count=1") || !strings.Contains(asked, "text_decorations=false") || !strings.HasSuffix(asked, " application/json") {
		t.Fatalf("trial search request: %s", asked)
	}
	// The key never comes back.
	if strings.Contains(speechRequest(t, h, "GET", WebSearchKeyPath, "").Body.String(), ownSearchKey) {
		t.Fatal("key in reply")
	}
	// Staan is reserved, malformed keys and unknown fields are refused, and
	// nothing is tried for them.
	before := len(brave.asked)
	for _, body := range []string{`{"backend":"staan","key":"` + ownSearchKey + `"}`, `{"key":"` + ownSearchKey + `"}`, `{"backend":"brave","key":"$BRAVE_API_KEY_0000000"}`, `{"backend":"brave","key":"short"}`, `{"backend":"brave","key":"` + ownSearchKey + `","source":"site"}`} {
		if w := speechRequest(t, h, "POST", WebSearchKeyPath, body); w.Code != 400 {
			t.Fatalf("%s: %d", body, w.Code)
		}
	}
	if len(brave.asked) != before {
		t.Fatal("tried an invalid request")
	}
	removed := searchState(t, speechRequest(t, h, "DELETE", WebSearchKeyPath, ""))
	if removed.Present {
		t.Fatalf("remove: %+v", removed)
	}
}

func TestWebSearchRefusalMarkNamesItsKey(t *testing.T) {
	home := t.TempDir()
	s := newFakeBrave(t, ownSearchKey, siteSearchKey).search(t, home)
	h := s.KeyHandler()
	searchState(t, speechRequest(t, h, "POST", WebSearchKeyPath, `{"backend":"brave","key":"`+ownSearchKey+`"}`))
	mark := func(key, backend string) {
		t.Helper()
		digest := sha256.Sum256([]byte(key))
		b, _ := json.Marshal(map[string]any{"last_refused_at": "2026-11-09T07:30:00.250Z", "backend": backend, "status": 401, "key_sha256": hex.EncodeToString(digest[:])})
		if err := os.WriteFile(filepath.Join(home, ".config/web-search/state.json"), b, 0600); err != nil {
			t.Fatal(err)
		}
	}
	mark(ownSearchKey, "brave")
	st := searchState(t, speechRequest(t, h, "GET", WebSearchKeyPath, ""))
	if st.RefusedAt == nil || *st.RefusedAt != "2026-11-09T07:30:00Z" {
		t.Fatalf("refusal not shown: %+v", st)
	}
	// Another key's or another service's mark is no refusal of this key.
	for _, other := range [][2]string{{siteSearchKey, "brave"}, {ownSearchKey, "staan"}} {
		mark(other[0], other[1])
		if st := searchState(t, speechRequest(t, h, "GET", WebSearchKeyPath, "")); st.RefusedAt != nil {
			t.Fatalf("foreign mark %v shown", other)
		}
	}
	// A mark others could have written is ignored.
	mark(ownSearchKey, "brave")
	if err := os.Chmod(filepath.Join(home, ".config/web-search/state.json"), 0644); err != nil {
		t.Fatal(err)
	}
	if st := searchState(t, speechRequest(t, h, "GET", WebSearchKeyPath, "")); st.RefusedAt != nil {
		t.Fatal("group-readable mark shown")
	}
	// Saving again, after its trial search passed, removes the mark.
	mark(ownSearchKey, "brave")
	searchState(t, speechRequest(t, h, "POST", WebSearchKeyPath, `{"backend":"brave","key":"`+ownSearchKey+`"}`))
	if _, err := os.Stat(filepath.Join(home, ".config/web-search/state.json")); !os.IsNotExist(err) {
		t.Fatalf("mark kept after save: %v", err)
	}
}

func TestWebSearchNativeListIsTheExtensions(t *testing.T) {
	home := t.TempDir()
	brave := newFakeBrave(t)
	s := brave.search(t, home)
	for _, bad := range []string{`{"schema":2,"providers":[]}`, `{"schema":1,"providers":[{"provider":"../x"}]}`, `not json`} {
		if err := os.WriteFile(s.native, []byte(bad), 0644); err != nil {
			t.Fatal(err)
		}
		if got := s.nativeProviders(); got != nil {
			t.Fatalf("%s: %v", bad, got)
		}
	}
	s.native = filepath.Join(t.TempDir(), "missing.json")
	if st := searchState(t, speechRequest(t, s.KeyHandler(), "GET", WebSearchKeyPath, "")); st.NativeProviders != nil {
		t.Fatalf("missing list: %+v", st.NativeProviders)
	}
	if !strings.Contains(speechRequest(t, s.KeyHandler(), "GET", WebSearchKeyPath, "").Body.String(), `"native_providers":null`) {
		t.Fatal("unknown list is not null")
	}
	if NewWebSearch(transport.Config{Home: home}, nil, "/opt/runtime").native != "/opt/runtime/node_modules/@open-habitat/pi-web-search/native-search.json" {
		t.Fatal("runtime list path")
	}
}

func TestWebSearchGatewayRoutes(t *testing.T) {
	home := t.TempDir()
	brave := newFakeBrave(t, siteSearchKey)
	s := brave.search(t, home)
	check := func(key, want string) {
		t.Helper()
		w := speechRequest(t, s.KeyCheckHandler(), "POST", WebSearchKeyCheckPath, `{"schema_version":1,"backend":"brave","key":"`+key+`"}`)
		if w.Code != 200 || !strings.Contains(w.Body.String(), `"outcome":"`+want+`"`) {
			t.Fatalf("check %s: %d %s", key, w.Code, w.Body)
		}
	}
	check(siteSearchKey, "works")
	check(ownSearchKey, "rejected")
	brave.status.Store(429)
	check(siteSearchKey, "limited")
	brave.status.Store(503)
	check(siteSearchKey, "unavailable")
	if k, _ := readWebSearchKey(home); k != nil {
		t.Fatal("the check stored a key")
	}
	w := speechRequest(t, s.SiteKeyHandler(), "POST", WebSearchSiteKeyPath, `{"schema_version":1,"backend":"brave","key":"`+siteSearchKey+`"}`)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"outcome":"seeded"`) {
		t.Fatalf("give: %d %s", w.Code, w.Body)
	}
	for _, body := range []string{`{"schema_version":1,"backend":"staan","key":"` + siteSearchKey + `"}`, `{"schema_version":2,"backend":"brave","key":"` + siteSearchKey + `"}`, `{"schema_version":1,"backend":"brave","key":"` + siteSearchKey + `","source":"own"}`} {
		if w := speechRequest(t, s.SiteKeyHandler(), "POST", WebSearchSiteKeyPath, body); w.Code != 400 {
			t.Fatalf("give %s: %d", body, w.Code)
		}
	}
	denied := NewWebSearchWithFixture(transport.Config{Home: home}, func(*http.Request) bool { return false }, nil, nil, "")
	for _, h := range []http.Handler{denied.KeyHandler(), denied.SiteKeyHandler(), denied.KeyCheckHandler()} {
		if w := speechRequest(t, h, "POST", WebSearchKeyPath, `{}`); w.Code != 403 {
			t.Fatalf("untrusted peer: %d", w.Code)
		}
	}
}

func TestWebSearchTrialSearchesAreBounded(t *testing.T) {
	brave := newFakeBrave(t, ownSearchKey)
	s := brave.search(t, t.TempDir())
	for i := 0; i < webSearchChecksPerMinute; i++ {
		if err := s.CheckKey(t.Context(), "brave", ownSearchKey); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.CheckKey(t.Context(), "brave", ownSearchKey); err != errWebSearchLimit {
		t.Fatalf("eleventh check: %v", err)
	}
	if len(brave.asked) != webSearchChecksPerMinute {
		t.Fatalf("asked %d", len(brave.asked))
	}
}
