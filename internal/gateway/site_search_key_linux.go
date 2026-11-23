//go:build linux

package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"sync"
	"time"
)

// The site's web search key (Jari 2026-11-23: it works like the Soniox
// key) follows the site Soniox key's pattern line by line: the gateway
// keeps it in a gateway-UID 0600 file of its own, reads back only the
// service, a four-character suffix and when it was set, and never uses it.
// Whether the key works is asked from the setting administrator's own
// daemon with one trial search before anything is stored, because only a
// daemon talks to the search service. A copy is written into a person's
// home only by their own daemon, at the sign-in that created their account
// and when an administrator sets the key; the daemon writes it only where
// the person has no search key or an earlier site copy. Search uses one
// service at a time, so a key for another service replaces the stored key
// and its copies as a changed key would. Removing the key recalls nothing.
// The file alone is the commit point and there is no record of copies: a
// person's file says itself whether it is a site copy.

const siteSearchKeyPath = "/api/v1/server/search-key"

// webSearchKeyPath is the person's own key route, forwarded to their
// daemon; searchDaemonPath is the daemon's WebSearchSiteKeyPath and
// searchCheckDaemonPath its WebSearchKeyCheckPath.
const (
	webSearchKeyPath      = "/api/v1/web-search/key"
	searchDaemonPath      = "/internal/v1/web-search/site-key"
	searchCheckDaemonPath = "/internal/v1/web-search/key-check"
)

// A key the administrator's daemon could not confirm is not stored. These
// carry the codes the person's own save answers with.
var (
	errSearchKeyRejected    = &OnboardingError{"search_key_rejected"}
	errSearchLimitReached   = &OnboardingError{"search_limit_reached"}
	errSearchKeyUncheckable = &OnboardingError{"search_unavailable"}
)

func siteSearchKeyStatus(e error) (int, string) {
	var oe *OnboardingError
	if errors.As(e, &oe) {
		switch oe {
		case errSearchKeyRejected:
			return 409, oe.Reason
		case errSearchLimitReached:
			return 429, oe.Reason
		case errSearchKeyUncheckable:
			return 503, oe.Reason
		}
	}
	return siteKeyGiveStatus(e)
}

// searchKeyShape and the backends are the daemon's rules
// (web_search_key_linux.go). Only Brave is settable until Staan's coverage
// has been checked; a stored record may name either.
var searchKeyShape = regexp.MustCompile(`^[A-Za-z0-9_-]{16,256}$`)
var searchBackendNames = []string{"brave", "staan"}

func validSearchKey(key string) bool { return searchKeyShape.MatchString(key) }

func settableSearchBackend(b string) bool { return b == "brave" }

type searchKeyRecord struct {
	Version int    `json:"version"`
	Backend string `json:"backend"`
	Key     string `json:"key"`
	SetAt   string `json:"set_at"`
}

type searchKeyView struct {
	Backend string `json:"backend"`
	Suffix  string `json:"suffix"`
	SetAt   string `json:"set_at"`
}

func (k *searchKeyRecord) view() *searchKeyView {
	if k == nil {
		return nil
	}
	return &searchKeyView{Backend: k.Backend, Suffix: k.Key[len(k.Key)-4:], SetAt: k.SetAt}
}

func validSearchKeyRecord(k searchKeyRecord) bool {
	return k.Version == 1 && validSearchKey(k.Key) && slices.Contains(searchBackendNames, k.Backend) && validRFC3339(k.SetAt)
}

// siteSearch is the gateway's state for the site's web search key.
type siteSearch struct {
	file string
	key  *searchKeyRecord
	// ops runs one set and its gives at a time.
	ops chan struct{}
}

func (a *Auth) searchKeyFile() string {
	if a.siteKeyFile == "" {
		return ""
	}
	return filepath.Join(filepath.Dir(a.siteKeyFile), "site-search-key.json")
}

// loadSiteSearchKey reads the key once at startup. A file that is not the
// gateway's private record fails startup closed, like the other site keys.
func (a *Auth) loadSiteSearchKey() error {
	a.webSearch = siteSearch{file: a.searchKeyFile(), ops: make(chan struct{}, 1)}
	if a.webSearch.file == "" {
		return nil
	}
	f, e := os.Open(a.webSearch.file)
	if os.IsNotExist(e) {
		return nil
	}
	if e != nil {
		return ErrAdministrationState
	}
	defer f.Close()
	info, e := f.Stat()
	if e != nil || !privateSessionFile(info) || info.Size() > maxSiteKeyFile {
		return ErrAdministrationState
	}
	var k searchKeyRecord
	dec := json.NewDecoder(io.LimitReader(f, maxSiteKeyFile+1))
	dec.DisallowUnknownFields()
	if dec.Decode(&k) != nil || dec.Decode(new(any)) != io.EOF || !validSearchKeyRecord(k) {
		return ErrAdministrationState
	}
	a.webSearch.key = &k
	return nil
}

func (a *Auth) writeSearchKeyFile(k searchKeyRecord) error {
	b, e := json.Marshal(k)
	if e != nil {
		return e
	}
	dir := filepath.Dir(a.webSearch.file)
	f, e := os.CreateTemp(dir, ".site-search-key-*")
	if e != nil {
		return e
	}
	defer os.Remove(f.Name())
	if e = f.Chmod(0600); e == nil {
		_, e = f.Write(b)
	}
	if e == nil {
		e = f.Sync()
	}
	if closeErr := f.Close(); e == nil {
		e = closeErr
	}
	if e != nil {
		return e
	}
	if e = os.Rename(f.Name(), a.webSearch.file); e != nil {
		return e
	}
	if syncDir(dir) != nil {
		a.log.Warn("site_search_key", "outcome", "degraded", "reason", "directory_sync_failed")
	}
	return nil
}

func (a *Auth) siteSearchKeyView() *searchKeyView {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.webSearch.key.view()
}

func (a *Auth) siteSearchKeyCopy() *searchKeyRecord {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.webSearch.key == nil || !a.administrationHealthy() {
		return nil
	}
	k := *a.webSearch.key
	return &k
}

func (a *Auth) lockSearchOps(ctx context.Context) (func(), error) {
	wait := time.NewTimer(siteKeyDaemonDeadline + 5*time.Second)
	defer wait.Stop()
	select {
	case a.webSearch.ops <- struct{}{}:
		return func() { <-a.webSearch.ops }, nil
	case <-ctx.Done():
	case <-wait.C:
	}
	return nil, errSiteKeyBusy
}

// checkSiteSearchKey asks caller's own daemon to make one trial search with
// key at backend. The daemon stores nothing; the gateway itself never sends
// the key to the service.
func (a *Auth) checkSiteSearchKey(ctx context.Context, caller, backend, key string) error {
	if !validSearchKey(key) || !settableSearchBackend(backend) {
		return onboardingInvalid("invalid_key")
	}
	target, _, err := a.personRoute(ctx, caller)
	outcome := "not_reached"
	if err == nil {
		body, _ := json.Marshal(map[string]any{"schema_version": 1, "backend": backend, "key": key})
		b, err := a.postDaemon(ctx, target, searchCheckDaemonPath, body)
		outcome = "unknown"
		var reply struct {
			SchemaVersion int    `json:"schema_version"`
			Outcome       string `json:"outcome"`
		}
		if err == nil && json.Unmarshal(b, &reply) == nil && reply.SchemaVersion == 1 && slices.Contains([]string{"works", "rejected", "limited", "unavailable"}, reply.Outcome) {
			outcome = reply.Outcome
		}
	}
	a.log.Info("site_search_key_check", "outcome", outcome, "backend", backend, "actor", actorFor(caller))
	switch outcome {
	case "works":
		return nil
	case "rejected":
		return errSearchKeyRejected
	case "limited":
		return errSearchLimitReached
	}
	return errSearchKeyUncheckable
}

// setSiteSearchKey stores the checked key. caller is the browser
// administrator.
func (a *Auth) setSiteSearchKey(caller, backend, key string) (*searchKeyView, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.webSearch.file == "" || !a.administrationHealthy() {
		return nil, ErrAdministrationState
	}
	if !a.isAdministratorLocked(caller) {
		return nil, errAdminDenied
	}
	record := searchKeyRecord{Version: 1, Backend: backend, Key: key, SetAt: a.now().UTC().Format(time.RFC3339)}
	if !validSearchKeyRecord(record) || !settableSearchBackend(backend) {
		return nil, onboardingInvalid("invalid_key")
	}
	if e := a.writeSearchKeyFile(record); e != nil {
		return nil, e
	}
	a.webSearch.key = &record
	a.log.Info("site_search_key", "outcome", "accepted", "reason", "set", "backend", backend, "actor", actorFor(caller))
	return record.view(), nil
}

// deleteSiteSearchKey removes the key. People keep their copies; only
// revoking the key at the search service stops them.
func (a *Auth) deleteSiteSearchKey(caller string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.webSearch.file == "" || !a.administrationHealthy() {
		return ErrAdministrationState
	}
	if !a.isAdministratorLocked(caller) {
		return errAdminDenied
	}
	if e := os.Remove(a.webSearch.file); e != nil && !os.IsNotExist(e) {
		return e
	}
	a.webSearch.key = nil
	if syncDir(filepath.Dir(a.webSearch.file)) != nil {
		a.log.Warn("site_search_key", "outcome", "degraded", "reason", "directory_sync_failed")
	}
	a.log.Info("site_search_key", "outcome", "accepted", "reason", "delete", "actor", actorFor(caller))
	return nil
}

// giveSearchKey asks target's own daemon to take a copy of k and returns
// its one word, not_reached or unknown. Nothing is retried.
func (a *Auth) giveSearchKey(ctx context.Context, target Identity, k searchKeyRecord) string {
	body, _ := json.Marshal(map[string]any{"schema_version": 1, "key": k.Key, "backend": k.Backend})
	b, err := a.postDaemon(ctx, target, searchDaemonPath, body)
	outcome := "unknown"
	switch {
	case errors.Is(err, errNotSent):
		outcome = "not_reached"
	case err == nil:
		var reply struct {
			SchemaVersion int    `json:"schema_version"`
			Outcome       string `json:"outcome"`
		}
		if json.Unmarshal(b, &reply) == nil && reply.SchemaVersion == 1 && slices.Contains(speechGiven, reply.Outcome) {
			outcome = reply.Outcome
		}
	}
	a.log.Info("site_search_key_give", "outcome", outcome, "subject", target.Subject, "user", target.Username)
	return outcome
}

// giveSearchKeyAtFirstLogin hands the site's key to the person whose
// account this login created. It runs after the login has answered and
// changes nothing about it.
func (a *Auth) giveSearchKeyAtFirstLogin(target Identity) {
	k := a.siteSearchKeyCopy()
	if k == nil {
		return
	}
	go a.giveSearchKey(context.Background(), target, *k)
}

// giveSearchKeyToJoined offers the stored key to every joined person, four
// at a time. A person not reached is given it by the next set.
func (a *Auth) giveSearchKeyToJoined(ctx context.Context) (speechGiveCounts, error) {
	k := a.siteSearchKeyCopy()
	if k == nil {
		return nil, errSiteKeyUnavailable
	}
	list, err := a.accessList(ctx)
	if err != nil {
		return nil, err
	}
	counts := speechGiveCounts{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	slots := make(chan struct{}, 4)
	for _, e := range list.Entries {
		if e.Denied || e.State != "joined" {
			continue
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()
			outcome := "not_reached"
			if target, _, err := a.personRoute(ctx, e.ID); err == nil {
				outcome = a.giveSearchKey(ctx, target, *k)
			}
			mu.Lock()
			counts[outcome]++
			mu.Unlock()
		}()
	}
	wg.Wait()
	return counts, nil
}

// siteSearchKeyHTTP is GET …/search-key, POST …/search-key/set {backend,
// key} and POST …/search-key/delete {} for a current administrator.
func (a *Auth) siteSearchKeyHTTP(w http.ResponseWriter, r *http.Request) {
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	path := r.URL.Path
	if !a.exact(r, path) || path != siteSearchKeyPath && path != siteSearchKeyPath+"/set" && path != siteSearchKeyPath+"/delete" {
		safe(w, 400, "invalid_request")
		return
	}
	read := path == siteSearchKeyPath
	if read && r.Method != http.MethodGet || !read && r.Method != http.MethodPost {
		safe(w, 405, "method_not_allowed")
		return
	}
	if !a.administrationAvailable() {
		safe(w, 503, "administration_unavailable")
		return
	}
	if !a.isAdministrator(s.identity.Subject) {
		safe(w, 403, "admin_required")
		return
	}
	reply := func(k *searchKeyView, given speechGiveCounts) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", "application/json")
		v := map[string]any{"schema_version": 1}
		if k != nil {
			v["site_key"] = k
		}
		if given != nil {
			v["given"] = given
		}
		json.NewEncoder(w).Encode(v)
	}
	if read {
		reply(a.siteSearchKeyView(), nil)
		return
	}
	if reason := a.authorizeWrite(r, s); reason != "" {
		safe(w, 403, reason)
		return
	}
	if r.Header.Get("Content-Type") != "application/json" {
		safe(w, 400, "invalid_request")
		return
	}
	var body struct {
		Backend *string `json:"backend"`
		Key     *string `json:"key"`
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, 1025))
	dec.DisallowUnknownFields()
	set := path == siteSearchKeyPath+"/set"
	if dec.Decode(&body) != nil || dec.Decode(new(any)) != io.EOF || set != (body.Key != nil) || set != (body.Backend != nil) || set && (!validSearchKey(*body.Key) || !settableSearchBackend(*body.Backend)) {
		safe(w, 400, "invalid_request")
		return
	}
	if !set {
		if err := a.deleteSiteSearchKey(s.identity.Subject); err != nil {
			status, code := siteKeyGiveStatus(err)
			safe(w, status, code)
			return
		}
		reply(nil, nil)
		return
	}
	// The gives outlive a browser that leaves: each answer is a person's
	// state, logged here.
	ctx := context.WithoutCancel(r.Context())
	unlock, err := a.lockSearchOps(ctx)
	if err != nil {
		status, code := siteKeyGiveStatus(err)
		safe(w, status, code)
		return
	}
	defer unlock()
	if err := a.checkSiteSearchKey(ctx, s.identity.Subject, *body.Backend, *body.Key); err != nil {
		status, code := siteSearchKeyStatus(err)
		safe(w, status, code)
		return
	}
	k, err := a.setSiteSearchKey(s.identity.Subject, *body.Backend, *body.Key)
	if err != nil {
		status, code := siteKeyGiveStatus(err)
		safe(w, status, code)
		return
	}
	given, err := a.giveSearchKeyToJoined(ctx)
	if err != nil {
		// The key is stored; who has a copy is unknown until the next set.
		given = nil
		a.log.Warn("site_search_key_give", "outcome", "degraded", "reason", "access_list_unavailable")
	}
	reply(k, given)
}

// webSearchRoute forwards the person's search key route to their daemon
// without parsing it: the key is tried and saved only there.
func (a *Auth) webSearchRoute(w http.ResponseWriter, r *http.Request) {
	if !(r.Method == http.MethodGet || r.Method == http.MethodPost || r.Method == http.MethodDelete) || !a.exact(r, webSearchKeyPath) {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if r.Method != http.MethodGet {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return
		}
	}
	a.proxy(w, r, s, false)
}
