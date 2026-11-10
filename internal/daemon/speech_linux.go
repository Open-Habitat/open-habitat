//go:build linux

package daemon

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/netip"
	"os"
	"regexp"
	"sync"
	"syscall"
	"time"

	"github.com/open-habitat/open-habitat/internal/egress"
	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

// Speech input (Jari 2026-10-27, decision D + P1). The person's Soniox key
// and its region live in ~/.config/soniox/key.json, a file this product
// names because Soniox has no native store; the daemon is its only product
// writer, and the person's agents may read it as any other credential in
// their home. A copy of the site's Soniox key is written there only where
// the file is absent or holds an earlier site copy (source "site"); a key
// the person saved is never replaced. For each dictation the daemon mints a
// single-use temporary key with the long-lived one and returns it to the
// browser, which streams audio straight to Soniox. That temporary key is
// the one provider token that crosses the contract (internal/AGENTS.md).

// SpeechKeyPath reads, saves and removes the person's own key;
// SpeechSessionPath mints one dictation's temporary key.
const (
	SpeechKeyPath     = "/api/v1/speech/key"
	SpeechSessionPath = "/api/v1/speech/session"
	// SpeechSiteKeyPath is the gateway's own request giving the site's
	// Soniox key to this person, and SpeechKeyCheckPath its request asking
	// an administrator's own daemon which region the key they are setting
	// works in, since the gateway never uses the key itself. Neither is
	// ever proxied from a browser.
	SpeechSiteKeyPath  = "/internal/v1/speech/site-key"
	SpeechKeyCheckPath = "/internal/v1/speech/key-check"
)

// SpeechMaxSessionSeconds is one dictation's ceiling (Jari 2026-10-28):
// Soniox ends the stream there, and the browser stops a little before.
const SpeechMaxSessionSeconds = 600

// The temporary key only opens a stream; it is useless a minute later.
const speechKeyLifetimeSeconds = 60

// A browser fault must not mint keys without end on the person's bill:
// at most this many per rolling minute.
const speechMintsPerMinute = 10

// sonioxKeyShape is what a long-lived Soniox key may look like here: a
// literal token, never a reference or command, short enough to be a key.
// A project key (snx_proj_…) is up to four such runs joined by dots; the
// last run is at least four characters so the shown suffix has no dot.
var sonioxKeyShape = regexp.MustCompile(`^(?:[A-Za-z0-9_-]+\.){0,3}[A-Za-z0-9_-]{4,}$`)

// ValidSonioxKey reports whether key has a long-lived Soniox key's shape.
func ValidSonioxKey(key string) bool {
	return len(key) >= 16 && len(key) <= 256 && sonioxKeyShape.MatchString(key)
}

var temporaryKeyShape = regexp.MustCompile(`^[A-Za-z0-9_.-]{8,512}$`)

// SpeechRegions are Soniox's data-residency regions a key may belong to.
// The key and the endpoints must be of the same region.
type SpeechEndpoints struct {
	API, WebSocket string
}

var speechRegions = map[string]SpeechEndpoints{
	"us": {API: "https://api.soniox.com", WebSocket: "wss://stt-rt.soniox.com/transcribe-websocket"},
	"eu": {API: "https://api.eu.soniox.com", WebSocket: "wss://stt-rt.eu.soniox.com/transcribe-websocket"},
}

func validSpeechRegion(region string) bool {
	_, ok := speechRegions[region]
	return ok
}

type speechKeyFile struct {
	APIKey string `json:"api_key"`
	Region string `json:"region"`
	// Source is "own" for a key the person saved and "site" for a copy of
	// the site's key, which a later site key may replace.
	Source string `json:"source"`
}

func (k speechKeyFile) valid() bool {
	return ValidSonioxKey(k.APIKey) && validSpeechRegion(k.Region) && (k.Source == "own" || k.Source == "site")
}

// Speech is one person's speech-input routes.
type Speech struct {
	cfg     transport.Config
	trusted func(*http.Request) bool
	// mu orders every read-decide-write of the key file in this daemon, so
	// a site copy cannot land over a key the person saved meanwhile.
	mu        sync.Mutex
	endpoints func(region string) SpeechEndpoints
	client    *http.Client
	now       func() time.Time
	mints     []time.Time
}

// NewSpeech serves the person's speech routes against Soniox itself.
func NewSpeech(cfg transport.Config, trusted func(*http.Request) bool) *Speech {
	return newSpeech(cfg, trusted, func(region string) SpeechEndpoints { return speechRegions[region] }, false)
}

// NewSpeechWithFixtureEndpoints points each region at a synthetic Soniox,
// for the browser host and tests only; loopback is allowed there.
func NewSpeechWithFixtureEndpoints(cfg transport.Config, trusted func(*http.Request) bool, endpoints func(region string) SpeechEndpoints, client *http.Client) *Speech {
	s := newSpeech(cfg, trusted, endpoints, true)
	if client != nil {
		s.client = client
	}
	return s
}

func newSpeech(cfg transport.Config, trusted func(*http.Request) bool, endpoints func(string) SpeechEndpoints, loopback bool) *Speech {
	dialer := &net.Dialer{Timeout: 5 * time.Second, Control: func(_, address string, _ syscall.RawConn) error {
		ap, err := netip.ParseAddrPort(address)
		if err != nil || !egress.Allowed(ap.Addr().Unmap(), loopback) {
			return errors.New("speech destination refused")
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
		// The key goes only to the region's own API address.
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	return &Speech{cfg: cfg, trusted: trusted, endpoints: endpoints, client: client, now: time.Now}
}

func speechDir(home string, create bool) (*os.File, error) {
	return personalDir(home, create, ".config", "soniox")
}

// readSpeechKey returns the stored key, or nil when there is none. A file
// that is not the person's private, well-formed key is an error, never
// absence: absence would let a site copy replace it.
func readSpeechKey(home string) (*speechKeyFile, error) {
	dir, err := speechDir(home, false)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer dir.Close()
	fd, err := unix.Openat(int(dir.Fd()), "key.json", unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	f := os.NewFile(uintptr(fd), "speech key")
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return nil, err
	}
	if !st.Mode().IsRegular() || st.Size() > 4096 || st.Mode().Perm()&0077 != 0 || st.Sys().(*syscall.Stat_t).Uid != uint32(os.Geteuid()) {
		return nil, errors.New("unsafe speech key file")
	}
	var k speechKeyFile
	dec := json.NewDecoder(io.LimitReader(f, 4097))
	dec.DisallowUnknownFields()
	if dec.Decode(&k) != nil || dec.Decode(new(any)) != io.EOF || !k.valid() {
		return nil, errors.New("invalid speech key file")
	}
	return &k, nil
}

func writeSpeechKey(home string, k speechKeyFile) error {
	if !k.valid() {
		return errors.New("invalid speech key")
	}
	dir, err := speechDir(home, true)
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
	f := os.NewFile(uintptr(fd), "speech key")
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
	return dir.Sync()
}

func removeSpeechKey(home string) error {
	dir, err := speechDir(home, false)
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
	return dir.Sync()
}

type speechKeyState struct {
	SchemaVersion int     `json:"schema_version"`
	Present       bool    `json:"present"`
	Suffix        *string `json:"suffix"`
	Region        *string `json:"region"`
	Source        *string `json:"source"`
}

func speechState(k *speechKeyFile) speechKeyState {
	state := speechKeyState{SchemaVersion: 1}
	if k != nil {
		suffix, region, source := k.APIKey[len(k.APIKey)-4:], k.Region, k.Source
		state.Present, state.Suffix, state.Region, state.Source = true, &suffix, &region, &source
	}
	return state
}

// GiveSiteKey writes a copy of the site's key where there is no key or an
// earlier site copy, and answers seeded, replaced, already_current or kept.
func (s *Speech) GiveSiteKey(key, region string) (string, error) {
	site := speechKeyFile{APIKey: key, Region: region, Source: "site"}
	if !site.valid() {
		return "", errors.New("invalid site key")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	current, err := readSpeechKey(s.cfg.Home)
	if err != nil {
		return "", err
	}
	outcome := "seeded"
	if current != nil {
		switch {
		case current.Source == "own":
			return "kept", nil
		case subtle.ConstantTimeCompare([]byte(current.APIKey), []byte(key)) == 1 && current.Region == region:
			return "already_current", nil
		}
		outcome = "replaced"
	}
	if err = writeSpeechKey(s.cfg.Home, site); err != nil {
		return "", err
	}
	return outcome, nil
}

// errSpeech carries one of the contract's fixed codes.
type errSpeech struct {
	status int
	code   string
}

func (e errSpeech) Error() string { return e.code }

var (
	errSpeechMissing     = errSpeech{409, "speech_key_missing"}
	errSpeechRejected    = errSpeech{409, "speech_key_rejected"}
	errSpeechLimit       = errSpeech{429, "speech_limit_reached"}
	errSpeechUnavailable = errSpeech{503, "speech_unavailable"}
	errSpeechFile        = errSpeech{503, "native_unavailable"}
)

type speechSession struct {
	SchemaVersion     int    `json:"schema_version"`
	APIKey            string `json:"api_key"`
	ExpiresAt         string `json:"expires_at"`
	WebSocketURL      string `json:"websocket_url"`
	MaxSessionSeconds int    `json:"max_session_seconds"`
}

// allowMint records one mint if the rolling minute has room.
func (s *Speech) allowMint() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	kept := s.mints[:0]
	for _, at := range s.mints {
		if now.Sub(at) < time.Minute {
			kept = append(kept, at)
		}
	}
	s.mints = kept
	if len(s.mints) >= speechMintsPerMinute {
		return false
	}
	s.mints = append(s.mints, now)
	return true
}

// mintAt asks Soniox in region for one dictation's temporary key made with
// key. Soniox failures become fixed codes; nothing Soniox said reaches the
// browser.
func (s *Speech) mintAt(ctx context.Context, key, region string) (speechSession, error) {
	endpoints := s.endpoints(region)
	body, _ := json.Marshal(map[string]any{
		"usage_type":                   "transcribe_websocket",
		"expires_in_seconds":           speechKeyLifetimeSeconds,
		"single_use":                   true,
		"max_session_duration_seconds": SpeechMaxSessionSeconds,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoints.API+"/v1/auth/temporary-api-key", bytes.NewReader(body))
	if err != nil {
		return speechSession{}, errSpeechUnavailable
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	res, err := s.client.Do(req)
	if err != nil {
		return speechSession{}, errSpeechUnavailable
	}
	defer res.Body.Close()
	switch {
	case res.StatusCode == http.StatusUnauthorized || res.StatusCode == http.StatusForbidden:
		return speechSession{}, errSpeechRejected
	case res.StatusCode == http.StatusTooManyRequests:
		return speechSession{}, errSpeechLimit
	case res.StatusCode != http.StatusOK && res.StatusCode != http.StatusCreated:
		return speechSession{}, errSpeechUnavailable
	}
	var reply struct {
		APIKey    string `json:"api_key"`
		ExpiresAt string `json:"expires_at"`
	}
	if json.NewDecoder(io.LimitReader(res.Body, 8192)).Decode(&reply) != nil || !temporaryKeyShape.MatchString(reply.APIKey) {
		return speechSession{}, errSpeechUnavailable
	}
	expires, err := time.Parse(time.RFC3339Nano, reply.ExpiresAt)
	if err != nil {
		return speechSession{}, errSpeechUnavailable
	}
	return speechSession{SchemaVersion: 1, APIKey: reply.APIKey, ExpiresAt: expires.UTC().Format(time.RFC3339), WebSocketURL: endpoints.WebSocket, MaxSessionSeconds: SpeechMaxSessionSeconds}, nil
}

// speechRegionOrder is the order a key of unknown region is tried in:
// the EU, the default here, first.
var speechRegionOrder = []string{"eu", "us"}

// findRegion mints with key in first (when given), then in the other
// regions, and returns the region that answered with its session. A Soniox
// project key works only in its own region, and the other regions refuse
// it as an unknown key (speech-key-wrong-region), so only a refusal moves
// on: a limit or an unreachable Soniox ends the search, and the key's region
// stays unknown rather than being guessed.
func (s *Speech) findRegion(ctx context.Context, key, first string) (string, speechSession, error) {
	order := speechRegionOrder
	if first != "" {
		order = []string{first}
		for _, region := range speechRegionOrder {
			if region != first {
				order = append(order, region)
			}
		}
	}
	for _, region := range order {
		session, err := s.mintAt(ctx, key, region)
		if err == nil {
			return region, session, nil
		}
		if err != errSpeechRejected {
			return "", speechSession{}, err
		}
	}
	return "", speechSession{}, errSpeechRejected
}

// correctRegion rewrites the stored key's region to the one Soniox took it
// in, if the file still holds exactly what the mint read.
func (s *Speech) correctRegion(read speechKeyFile, region string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	current, err := readSpeechKey(s.cfg.Home)
	if err != nil || current == nil || *current != read {
		return
	}
	current.Region = region
	_ = writeSpeechKey(s.cfg.Home, *current)
}

// Mint creates one dictation's temporary key with the person's key. A key
// stored with the wrong region, as the region picker once allowed, is
// tried once in the other region and its file corrected when it works
// there, so neither the person's key nor a site copy reads as refused.
func (s *Speech) Mint(ctx context.Context) (speechSession, error) {
	s.mu.Lock()
	k, err := readSpeechKey(s.cfg.Home)
	s.mu.Unlock()
	if err != nil {
		return speechSession{}, errSpeechFile
	}
	if k == nil {
		return speechSession{}, errSpeechMissing
	}
	if !s.allowMint() {
		return speechSession{}, errSpeechLimit
	}
	region, session, err := s.findRegion(ctx, k.APIKey, k.Region)
	if err != nil {
		return speechSession{}, err
	}
	if region != k.Region {
		s.correctRegion(*k, region)
	}
	return session, nil
}

// CheckKey finds the region key works in without storing it anywhere.
// The temporary key minted on the way is dropped unused.
func (s *Speech) CheckKey(ctx context.Context, key string) (string, error) {
	if !ValidSonioxKey(key) {
		return "", errors.New("invalid key")
	}
	if !s.allowMint() {
		return "", errSpeechLimit
	}
	region, _, err := s.findRegion(ctx, key, "")
	return region, err
}

func (s *Speech) fail(w http.ResponseWriter, err error) {
	var e errSpeech
	if !errors.As(err, &e) {
		e = errSpeechFile
	}
	snapshotError(w, e.status, e.code)
}

// KeyHandler is GET (state), POST {key} (save as the person's own) and
// DELETE (remove) on SpeechKeyPath. A key is saved only once Soniox has
// taken it, with the region it took it in; one that no region takes is
// speech_key_rejected, and a Soniox that cannot be asked saves nothing.
// Replies carry presence, region, source and at most the key's last four
// characters.
func (s *Speech) KeyHandler() http.Handler { return s.keyHandlerAt(SpeechKeyPath, s.trusted) }

// keyHandlerAt serves the same key reads and writes at path for another
// trusted peer (the agent listener); s.mu still orders every write.
func (s *Speech) keyHandlerAt(path string, trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(s.cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.URL.Path != path || r.URL.RawQuery != "" || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		var input speechKeyFile
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
				Key string `json:"key"`
			}
			dec := json.NewDecoder(io.LimitReader(r.Body, 513))
			dec.DisallowUnknownFields()
			if dec.Decode(&body) != nil || dec.Decode(new(any)) != io.EOF || !ValidSonioxKey(body.Key) {
				snapshotError(w, 400, "invalid_request")
				return
			}
			region, err := s.CheckKey(r.Context(), body.Key)
			if err != nil {
				s.fail(w, err)
				return
			}
			input = speechKeyFile{APIKey: body.Key, Region: region, Source: "own"}
		default:
			snapshotError(w, 405, "method_not_allowed")
			return
		}
		s.mu.Lock()
		var err error
		switch r.Method {
		case http.MethodPost:
			err = writeSpeechKey(s.cfg.Home, input)
		case http.MethodDelete:
			err = removeSpeechKey(s.cfg.Home)
		}
		var k *speechKeyFile
		if err == nil {
			k, err = readSpeechKey(s.cfg.Home)
		}
		s.mu.Unlock()
		if err != nil {
			snapshotError(w, 503, "native_unavailable")
			return
		}
		historyJSON(w, speechState(k))
	})
}

// SessionHandler is POST on SpeechSessionPath with no body.
func (s *Speech) SessionHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(s.cfg, s.trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.Method != http.MethodPost {
			snapshotError(w, 405, "method_not_allowed")
			return
		}
		if r.URL.Path != SpeechSessionPath || r.URL.RawQuery != "" || r.ContentLength > 0 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		session, err := s.Mint(r.Context())
		if err != nil {
			s.fail(w, err)
			return
		}
		historyJSON(w, session)
	})
}

// SiteKeyHandler answers the gateway's give with one word.
func (s *Speech) SiteKeyHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(s.cfg, s.trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.Method != http.MethodPost {
			snapshotError(w, 405, "method_not_allowed")
			return
		}
		if r.URL.RawQuery != "" || r.Header.Get("Content-Type") != "application/json" || r.ContentLength <= 0 || r.ContentLength > 1024 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		var body struct {
			SchemaVersion int    `json:"schema_version"`
			Key           string `json:"key"`
			Region        string `json:"region"`
		}
		dec := json.NewDecoder(io.LimitReader(r.Body, 1025))
		dec.DisallowUnknownFields()
		if dec.Decode(&body) != nil || dec.Decode(new(any)) != io.EOF || body.SchemaVersion != 1 || !ValidSonioxKey(body.Key) || !validSpeechRegion(body.Region) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		outcome, err := s.GiveSiteKey(body.Key, body.Region)
		if err != nil {
			snapshotError(w, 503, "native_unavailable")
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "outcome": outcome})
	})
}

// KeyCheckHandler answers the gateway's check of a key an administrator
// is setting: works with its region, rejected, limited or unavailable. It
// stores nothing.
func (s *Speech) KeyCheckHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(s.cfg, s.trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.Method != http.MethodPost {
			snapshotError(w, 405, "method_not_allowed")
			return
		}
		if r.URL.RawQuery != "" || r.Header.Get("Content-Type") != "application/json" || r.ContentLength <= 0 || r.ContentLength > 1024 || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		var body struct {
			SchemaVersion int    `json:"schema_version"`
			Key           string `json:"key"`
		}
		dec := json.NewDecoder(io.LimitReader(r.Body, 1025))
		dec.DisallowUnknownFields()
		if dec.Decode(&body) != nil || dec.Decode(new(any)) != io.EOF || body.SchemaVersion != 1 || !ValidSonioxKey(body.Key) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		reply := map[string]any{"schema_version": 1}
		region, err := s.CheckKey(r.Context(), body.Key)
		switch err {
		case nil:
			reply["outcome"], reply["region"] = "works", region
		case errSpeechRejected:
			reply["outcome"] = "rejected"
		case errSpeechLimit:
			reply["outcome"] = "limited"
		default:
			reply["outcome"] = "unavailable"
		}
		historyJSON(w, reply)
	})
}

// Mount adds the speech routes to a daemon mux.
func (s *Speech) Mount(mux *http.ServeMux) {
	mux.Handle(SpeechKeyPath, s.KeyHandler())
	mux.Handle(SpeechSessionPath, s.SessionHandler())
	mux.Handle(SpeechSiteKeyPath, s.SiteKeyHandler())
	mux.Handle(SpeechKeyCheckPath, s.KeyCheckHandler())
}
