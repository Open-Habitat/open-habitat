//go:build linux

package daemon

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/open-habitat/open-habitat/internal/egress"
	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// The web search key (Jari 2026-11-23: it works like the speech key). The
// person's key for a search service lives in ~/.config/web-search/key.json,
// which the core runtime's search extension (pi-web-search) reads natively
// and uses only for models whose provider does not search by itself. The
// daemon is the file's only product writer, as with ~/.config/soniox: a copy
// of the site's search key is written only where the file is absent or holds
// an earlier site copy (source "site"), and a key the person saved is never
// replaced. Search uses one service at a time, so a key for one service
// replaces a key for the other. The extension writes only its refusal mark
// (state.json) beside the key; the daemon reads it, and removes it when it
// writes a new key.

// WebSearchKeyPath reads, saves and removes the person's own search key.
// The conversation search already owns /api/v1/search, so the key has its
// own prefix.
const (
	WebSearchKeyPath = "/api/v1/web-search/key"
	// WebSearchSiteKeyPath is the gateway's own request giving the site's
	// search key to this person, and WebSearchKeyCheckPath its request
	// asking an administrator's own daemon to make one trial search with the
	// key they are setting, since the gateway never uses the key itself.
	// Neither is ever proxied from a browser.
	WebSearchSiteKeyPath  = "/internal/v1/web-search/site-key"
	WebSearchKeyCheckPath = "/internal/v1/web-search/key-check"
)

// webSearchKeyShape is what a search key may look like here: a literal
// token, never a reference or command. The extension accepts any printable
// ASCII; Brave's keys are letters and digits, and a narrower shape keeps the
// shown suffix plain.
var webSearchKeyShape = regexp.MustCompile(`^[A-Za-z0-9_-]{16,256}$`)

// ValidWebSearchKey reports whether key has a search key's shape.
func ValidWebSearchKey(key string) bool { return webSearchKeyShape.MatchString(key) }

// webSearchBackends are the services a key file may name. Staan is reserved:
// the extension offers no tool for it and no trial search exists, so a key
// is accepted from the browser or the gateway only for Brave (settable).
var webSearchBackends = []string{"brave", "staan"}

func validWebSearchBackend(b string) bool {
	return b == webSearchBackends[0] || b == webSearchBackends[1]
}

func settableWebSearchBackend(b string) bool { return b == "brave" }

// The trial search goes to the service's own API only.
const braveSearchAPI = "https://api.search.brave.com/res/v1/web/search"

// A browser fault must not make trial searches without end on the person's
// bill: at most this many per rolling minute.
const webSearchChecksPerMinute = 10

// webSearchNativeList is the installed extension's list of providers that
// search on their own, under the core runtime.
const webSearchNativeList = "node_modules/@open-habitat/pi-web-search/native-search.json"

var nativeProviderShape = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,63}$`)

type webSearchKeyFile struct {
	APIKey  string `json:"api_key"`
	Backend string `json:"backend"`
	// Source is "own" for a key the person saved and "site" for a copy of
	// the site's key, which a later site key may replace.
	Source string `json:"source"`
}

func (k webSearchKeyFile) valid() bool {
	return ValidWebSearchKey(k.APIKey) && validWebSearchBackend(k.Backend) && (k.Source == "own" || k.Source == "site")
}

// WebSearch is one person's search key routes.
type WebSearch struct {
	cfg     transport.Config
	trusted func(*http.Request) bool
	// mu orders every read-decide-write of the key file in this daemon, so
	// a site copy cannot land over a key the person saved meanwhile.
	mu       sync.Mutex
	endpoint func(backend string) string
	client   *http.Client
	// native is the extension's native-search.json; "" when unknown.
	native string
	now    func() time.Time
	checks []time.Time
}

// NewWebSearch serves the person's search key routes against the services
// themselves. runtimeRoot is the core runtime the daemon validated at start.
func NewWebSearch(cfg transport.Config, trusted func(*http.Request) bool, runtimeRoot string) *WebSearch {
	native := ""
	if runtimeRoot != "" {
		native = runtimeRoot + "/" + webSearchNativeList
	}
	return newWebSearch(cfg, trusted, func(string) string { return braveSearchAPI }, native, false)
}

// NewWebSearchWithFixture points the trial search at a synthetic service
// and reads native from a fixture list, for the browser host and tests
// only; loopback is allowed there.
func NewWebSearchWithFixture(cfg transport.Config, trusted func(*http.Request) bool, endpoint func(backend string) string, client *http.Client, native string) *WebSearch {
	s := newWebSearch(cfg, trusted, endpoint, native, true)
	if client != nil {
		s.client = client
	}
	return s
}

func newWebSearch(cfg transport.Config, trusted func(*http.Request) bool, endpoint func(string) string, native string, loopback bool) *WebSearch {
	dialer := &net.Dialer{Timeout: 5 * time.Second, Control: func(_, address string, _ syscall.RawConn) error {
		ap, err := netip.ParseAddrPort(address)
		if err != nil || !egress.Allowed(ap.Addr().Unmap(), loopback) {
			return errors.New("search destination refused")
		}
		return nil
	}}
	client := &http.Client{
		Timeout: 10 * time.Second,
		Transport: &http.Transport{
			DialContext:            dialer.DialContext,
			TLSHandshakeTimeout:    5 * time.Second,
			ResponseHeaderTimeout:  8 * time.Second,
			MaxResponseHeaderBytes: 16 << 10,
			DisableKeepAlives:      true,
		},
		// The key goes only to the service's own API address.
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	return &WebSearch{cfg: cfg, trusted: trusted, endpoint: endpoint, client: client, native: native, now: time.Now}
}

func webSearchDir(home string, create bool) (*os.File, error) {
	return personalDir(home, create, ".config", "web-search")
}

// openPrivate opens name in dir if it is the person's own regular file with
// no group or other bits and at most 4096 bytes, the extension's own rule.
func openPrivate(dir *os.File, name string) (*os.File, error) {
	fd, err := unix.Openat(int(dir.Fd()), name, unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, err
	}
	f := os.NewFile(uintptr(fd), name)
	st, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, err
	}
	if !st.Mode().IsRegular() || st.Size() > 4096 || st.Mode().Perm()&0077 != 0 || st.Sys().(*syscall.Stat_t).Uid != uint32(os.Geteuid()) {
		f.Close()
		return nil, errors.New("unsafe web search file")
	}
	return f, nil
}

// readWebSearchKey returns the stored key, or nil when there is none. A
// file that is not the person's private, well-formed key is an error, never
// absence: absence would let a site copy replace it.
func readWebSearchKey(home string) (*webSearchKeyFile, error) {
	dir, err := webSearchDir(home, false)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer dir.Close()
	f, err := openPrivate(dir, "key.json")
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var k webSearchKeyFile
	dec := json.NewDecoder(io.LimitReader(f, 4097))
	dec.DisallowUnknownFields()
	if dec.Decode(&k) != nil || dec.Decode(new(any)) != io.EOF || !k.valid() {
		return nil, errors.New("invalid web search key file")
	}
	return &k, nil
}

// writeWebSearchKey replaces the key file and then removes the extension's
// refusal mark, which named the earlier key. A mark left by a failed removal
// names that key's digest, so it never applies to the new one.
func writeWebSearchKey(home string, k webSearchKeyFile) error {
	if !k.valid() {
		return errors.New("invalid web search key")
	}
	dir, err := webSearchDir(home, true)
	if err != nil {
		return err
	}
	defer dir.Close()
	var random [16]byte
	if _, err = rand.Read(random[:]); err != nil {
		return err
	}
	name := ".key-" + hex.EncodeToString(random[:])
	fd, err := unix.Openat(int(dir.Fd()), name, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if err != nil {
		return err
	}
	defer unix.Unlinkat(int(dir.Fd()), name, 0)
	f := os.NewFile(uintptr(fd), "web search key")
	defer f.Close()
	if err = json.NewEncoder(f).Encode(k); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	if err = unix.Renameat(int(dir.Fd()), name, int(dir.Fd()), "key.json"); err != nil {
		return err
	}
	_ = unix.Unlinkat(int(dir.Fd()), "state.json", 0)
	return dir.Sync()
}

func removeWebSearchKey(home string) error {
	dir, err := webSearchDir(home, false)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	defer dir.Close()
	if err = unix.Unlinkat(int(dir.Fd()), "key.json", 0); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	_ = unix.Unlinkat(int(dir.Fd()), "state.json", 0)
	return dir.Sync()
}

// readRefusal returns when the extension last recorded the service refusing
// exactly k, or nil. The mark is advisory: one that cannot be read, or names
// another key or service, is no refusal.
func readRefusal(home string, k *webSearchKeyFile) *string {
	if k == nil {
		return nil
	}
	dir, err := webSearchDir(home, false)
	if err != nil {
		return nil
	}
	defer dir.Close()
	f, err := openPrivate(dir, "state.json")
	if err != nil {
		return nil
	}
	defer f.Close()
	var mark struct {
		LastRefusedAt string `json:"last_refused_at"`
		Backend       string `json:"backend"`
		KeySHA256     string `json:"key_sha256"`
	}
	if json.NewDecoder(io.LimitReader(f, 4097)).Decode(&mark) != nil {
		return nil
	}
	digest := sha256.Sum256([]byte(k.APIKey))
	if mark.Backend != k.Backend || subtle.ConstantTimeCompare([]byte(strings.ToLower(mark.KeySHA256)), []byte(hex.EncodeToString(digest[:]))) != 1 {
		return nil
	}
	at, err := time.Parse(time.RFC3339Nano, mark.LastRefusedAt)
	if err != nil {
		return nil
	}
	s := at.UTC().Format(time.RFC3339)
	return &s
}

// nativeProviders reads the installed extension's list of Pi providers that
// search on their own; nil when it cannot be read. Only the provider names
// cross: the browser compares them with the person's own providers.
func (s *WebSearch) nativeProviders() []string {
	if s.native == "" {
		return nil
	}
	f, err := os.Open(s.native)
	if err != nil {
		return nil
	}
	defer f.Close()
	if st, err := f.Stat(); err != nil || !st.Mode().IsRegular() || st.Size() > 16<<10 {
		return nil
	}
	var list struct {
		Schema    int `json:"schema"`
		Providers []struct {
			Provider string `json:"provider"`
		} `json:"providers"`
	}
	if json.NewDecoder(io.LimitReader(f, 16<<10+1)).Decode(&list) != nil || list.Schema != 1 || len(list.Providers) > 32 {
		return nil
	}
	out := []string{}
	for _, p := range list.Providers {
		if !nativeProviderShape.MatchString(p.Provider) {
			return nil
		}
		seen := false
		for _, o := range out {
			seen = seen || o == p.Provider
		}
		if !seen {
			out = append(out, p.Provider)
		}
	}
	return out
}

type webSearchKeyState struct {
	SchemaVersion   int      `json:"schema_version"`
	Present         bool     `json:"present"`
	Backend         *string  `json:"backend"`
	Suffix          *string  `json:"suffix"`
	Source          *string  `json:"source"`
	RefusedAt       *string  `json:"refused_at"`
	NativeProviders []string `json:"native_providers"`
}

func (s *WebSearch) state(k *webSearchKeyFile) webSearchKeyState {
	state := webSearchKeyState{SchemaVersion: 1, NativeProviders: s.nativeProviders()}
	if k != nil {
		suffix, backend, source := k.APIKey[len(k.APIKey)-4:], k.Backend, k.Source
		state.Present, state.Suffix, state.Backend, state.Source = true, &suffix, &backend, &source
		state.RefusedAt = readRefusal(s.cfg.Home, k)
	}
	return state
}

// GiveSiteKey writes a copy of the site's key where there is no key or an
// earlier site copy, and answers seeded, replaced, already_current or kept.
func (s *WebSearch) GiveSiteKey(key, backend string) (string, error) {
	site := webSearchKeyFile{APIKey: key, Backend: backend, Source: "site"}
	if !site.valid() {
		return "", errors.New("invalid site key")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	current, err := readWebSearchKey(s.cfg.Home)
	if err != nil {
		return "", err
	}
	outcome := "seeded"
	if current != nil {
		switch {
		case current.Source == "own":
			return "kept", nil
		case subtle.ConstantTimeCompare([]byte(current.APIKey), []byte(key)) == 1 && current.Backend == backend:
			return "already_current", nil
		}
		outcome = "replaced"
	}
	if err = writeWebSearchKey(s.cfg.Home, site); err != nil {
		return "", err
	}
	return outcome, nil
}

// errWebSearch carries one of the contract's fixed codes.
type errWebSearch struct {
	status int
	code   string
}

func (e errWebSearch) Error() string { return e.code }

var (
	errWebSearchRejected    = errWebSearch{409, "search_key_rejected"}
	errWebSearchLimit       = errWebSearch{429, "search_limit_reached"}
	errWebSearchUnavailable = errWebSearch{503, "search_unavailable"}
	errWebSearchFile        = errWebSearch{503, "native_unavailable"}
)

// allowCheck records one trial search if the rolling minute has room.
func (s *WebSearch) allowCheck() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	kept := s.checks[:0]
	for _, at := range s.checks {
		if now.Sub(at) < time.Minute {
			kept = append(kept, at)
		}
	}
	s.checks = kept
	if len(s.checks) >= webSearchChecksPerMinute {
		return false
	}
	s.checks = append(s.checks, now)
	return true
}

// CheckKey makes one trial search with key at backend and stores nothing.
// The outcome rules are the extension's own (backends.brave.outcome), so a
// key the save accepts is one the agent's searches accept: 2xx works; 401,
// 403, or 422 naming the subscription token is a refusal; 429 and 402 are a
// limit; anything else, a redirect included, is unavailable. Nothing the
// service said reaches the browser.
func (s *WebSearch) CheckKey(ctx context.Context, backend, key string) error {
	if !ValidWebSearchKey(key) || !settableWebSearchBackend(backend) {
		return errors.New("invalid key")
	}
	if !s.allowCheck() {
		return errWebSearchLimit
	}
	q := url.Values{"q": {"open habitat"}, "count": {"1"}, "text_decorations": {"false"}}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.endpoint(backend)+"?"+q.Encode(), nil)
	if err != nil {
		return errWebSearchUnavailable
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Subscription-Token", key)
	res, err := s.client.Do(req)
	if err != nil {
		return errWebSearchUnavailable
	}
	defer res.Body.Close()
	switch {
	case res.StatusCode >= 200 && res.StatusCode < 300:
		return nil
	case res.StatusCode == http.StatusUnauthorized || res.StatusCode == http.StatusForbidden:
		return errWebSearchRejected
	case res.StatusCode == http.StatusTooManyRequests || res.StatusCode == http.StatusPaymentRequired:
		return errWebSearchLimit
	case res.StatusCode == http.StatusUnprocessableEntity:
		var body struct {
			Error struct {
				Code string `json:"code"`
			} `json:"error"`
		}
		if json.NewDecoder(io.LimitReader(res.Body, 16<<10)).Decode(&body) == nil && strings.HasPrefix(body.Error.Code, "SUBSCRIPTION_TOKEN_") {
			return errWebSearchRejected
		}
	}
	return errWebSearchUnavailable
}

func (s *WebSearch) fail(w http.ResponseWriter, err error) {
	var e errWebSearch
	if !errors.As(err, &e) {
		e = errWebSearchFile
	}
	snapshotError(w, e.status, e.code)
}

// KeyHandler is GET (state), POST {backend, key} (save as the person's own)
// and DELETE (remove) on WebSearchKeyPath. A key is saved only after its
// trial search has passed; a refused key is search_key_rejected, and a
// service that cannot be asked saves nothing. Replies carry presence,
// service, source, at most the key's last four characters, the extension's
// refusal of exactly this key and its list of providers that search on
// their own.
func (s *WebSearch) KeyHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(s.cfg, s.trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.URL.Path != WebSearchKeyPath || r.URL.RawQuery != "" || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		var input webSearchKeyFile
		switch r.Method {
		case http.MethodGet, http.MethodDelete:
			if r.ContentLength > 0 {
				snapshotError(w, 400, "invalid_request")
				return
			}
		case http.MethodPost:
			if r.Header.Get("Content-Type") != "application/json" || r.ContentLength <= 0 || r.ContentLength > 512 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			var body struct {
				Backend string `json:"backend"`
				Key     string `json:"key"`
			}
			dec := json.NewDecoder(io.LimitReader(r.Body, 513))
			dec.DisallowUnknownFields()
			if dec.Decode(&body) != nil || dec.Decode(new(any)) != io.EOF || !settableWebSearchBackend(body.Backend) || !ValidWebSearchKey(body.Key) {
				snapshotError(w, 400, "invalid_request")
				return
			}
			if err := s.CheckKey(r.Context(), body.Backend, body.Key); err != nil {
				s.fail(w, err)
				return
			}
			input = webSearchKeyFile{APIKey: body.Key, Backend: body.Backend, Source: "own"}
		default:
			snapshotError(w, 405, "method_not_allowed")
			return
		}
		s.mu.Lock()
		var err error
		switch r.Method {
		case http.MethodPost:
			err = writeWebSearchKey(s.cfg.Home, input)
		case http.MethodDelete:
			err = removeWebSearchKey(s.cfg.Home)
		}
		var k *webSearchKeyFile
		if err == nil {
			k, err = readWebSearchKey(s.cfg.Home)
		}
		var state webSearchKeyState
		if err == nil {
			state = s.state(k)
		}
		s.mu.Unlock()
		if err != nil {
			snapshotError(w, 503, "native_unavailable")
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		historyJSON(w, state)
	})
}

// SiteKeyHandler answers the gateway's give with one word.
func (s *WebSearch) SiteKeyHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(s.cfg, s.trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.Method != http.MethodPost {
			snapshotError(w, 405, "method_not_allowed")
			return
		}
		if r.URL.Path != WebSearchSiteKeyPath || r.URL.RawQuery != "" || r.Header.Get("Content-Type") != "application/json" || r.ContentLength <= 0 || r.ContentLength > 1024 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		var body struct {
			SchemaVersion int    `json:"schema_version"`
			Key           string `json:"key"`
			Backend       string `json:"backend"`
		}
		dec := json.NewDecoder(io.LimitReader(r.Body, 1025))
		dec.DisallowUnknownFields()
		if dec.Decode(&body) != nil || dec.Decode(new(any)) != io.EOF || body.SchemaVersion != 1 || !ValidWebSearchKey(body.Key) || !settableWebSearchBackend(body.Backend) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		outcome, err := s.GiveSiteKey(body.Key, body.Backend)
		if err != nil {
			snapshotError(w, 503, "native_unavailable")
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "outcome": outcome})
	})
}

// KeyCheckHandler answers the gateway's check of a key an administrator is
// setting: works, rejected, limited or unavailable. It stores nothing.
func (s *WebSearch) KeyCheckHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(s.cfg, s.trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.Method != http.MethodPost {
			snapshotError(w, 405, "method_not_allowed")
			return
		}
		if r.URL.Path != WebSearchKeyCheckPath || r.URL.RawQuery != "" || r.Header.Get("Content-Type") != "application/json" || r.ContentLength <= 0 || r.ContentLength > 1024 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		var body struct {
			SchemaVersion int    `json:"schema_version"`
			Key           string `json:"key"`
			Backend       string `json:"backend"`
		}
		dec := json.NewDecoder(io.LimitReader(r.Body, 1025))
		dec.DisallowUnknownFields()
		if dec.Decode(&body) != nil || dec.Decode(new(any)) != io.EOF || body.SchemaVersion != 1 || !ValidWebSearchKey(body.Key) || !settableWebSearchBackend(body.Backend) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		reply := map[string]any{"schema_version": 1}
		switch err := s.CheckKey(r.Context(), body.Backend, body.Key); err {
		case nil:
			reply["outcome"] = "works"
		case errWebSearchRejected:
			reply["outcome"] = "rejected"
		case errWebSearchLimit:
			reply["outcome"] = "limited"
		default:
			reply["outcome"] = "unavailable"
		}
		historyJSON(w, reply)
	})
}

// Mount adds the search key routes to a daemon mux.
func (s *WebSearch) Mount(mux *http.ServeMux) {
	mux.Handle(WebSearchKeyPath, s.KeyHandler())
	mux.Handle(WebSearchSiteKeyPath, s.SiteKeyHandler())
	mux.Handle(WebSearchKeyCheckPath, s.KeyCheckHandler())
}
