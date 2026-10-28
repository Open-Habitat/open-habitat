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

// The site's Soniox key (Jari 2026-10-27, decision D) follows the site AI
// key's pattern: the gateway keeps it in a gateway-UID 0600 file of its
// own, reads back only region, a four-character suffix and when it was set,
// and never uses it. A copy is written into a person's home only by their
// own daemon, at the sign-in that created their account and when an
// administrator sets the key; the daemon writes it only where the person has
// no Soniox key or an earlier site copy. Removing the key recalls nothing.
// Unlike the AI key it is not part of the onboarding offer, so the file
// alone is the commit point and there is no record of copies: a person's
// file says itself whether it is a site copy.

const siteSpeechKeyPath = "/api/v1/server/speech-key"

// speechDaemonPath is the daemon's SpeechSiteKeyPath.
const speechDaemonPath = "/internal/v1/speech/site-key"

// sonioxKeyShape and speechRegionNames are the daemon's rules
// (speech_linux.go).
var sonioxKeyShape = regexp.MustCompile(`^[A-Za-z0-9_-]{16,256}$`)
var speechRegionNames = []string{"us", "eu"}

// speechGiven are the daemon's words; not_reached when nothing was sent,
// unknown when the daemon did not answer.
var speechGiven = []string{"seeded", "replaced", "already_current", "kept"}

type speechKeyRecord struct {
	Version int    `json:"version"`
	Region  string `json:"region"`
	Key     string `json:"key"`
	SetAt   string `json:"set_at"`
}

type speechKeyView struct {
	Region string `json:"region"`
	Suffix string `json:"suffix"`
	SetAt  string `json:"set_at"`
}

func (k *speechKeyRecord) view() *speechKeyView {
	if k == nil {
		return nil
	}
	return &speechKeyView{Region: k.Region, Suffix: k.Key[len(k.Key)-4:], SetAt: k.SetAt}
}

func validSpeechKeyRecord(k speechKeyRecord) bool {
	return k.Version == 1 && sonioxKeyShape.MatchString(k.Key) && slices.Contains(speechRegionNames, k.Region) && validRFC3339(k.SetAt)
}

// siteSpeech is the gateway's state for the site's Soniox key.
type siteSpeech struct {
	file string
	key  *speechKeyRecord
	// ops runs one set and its gives at a time.
	ops chan struct{}
}

func (a *Auth) speechKeyFile() string {
	if a.siteKeyFile == "" {
		return ""
	}
	return filepath.Join(filepath.Dir(a.siteKeyFile), "site-soniox-key.json")
}

// loadSiteSpeechKey reads the key once at startup. A file that is not the
// gateway's private record fails startup closed, like the AI key's.
func (a *Auth) loadSiteSpeechKey() error {
	a.speech = siteSpeech{file: a.speechKeyFile(), ops: make(chan struct{}, 1)}
	if a.speech.file == "" {
		return nil
	}
	f, e := os.Open(a.speech.file)
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
	var k speechKeyRecord
	dec := json.NewDecoder(io.LimitReader(f, maxSiteKeyFile+1))
	dec.DisallowUnknownFields()
	if dec.Decode(&k) != nil || dec.Decode(new(any)) != io.EOF || !validSpeechKeyRecord(k) {
		return ErrAdministrationState
	}
	a.speech.key = &k
	return nil
}

func (a *Auth) writeSpeechKeyFile(k speechKeyRecord) error {
	b, e := json.Marshal(k)
	if e != nil {
		return e
	}
	dir := filepath.Dir(a.speech.file)
	f, e := os.CreateTemp(dir, ".site-soniox-key-*")
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
	if e = os.Rename(f.Name(), a.speech.file); e != nil {
		return e
	}
	if syncDir(dir) != nil {
		a.log.Warn("site_speech_key", "outcome", "degraded", "reason", "directory_sync_failed")
	}
	return nil
}

func (a *Auth) siteSpeechKeyView() *speechKeyView {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.speech.key.view()
}

func (a *Auth) siteSpeechKeyCopy() *speechKeyRecord {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.speech.key == nil || !a.administrationHealthy() {
		return nil
	}
	k := *a.speech.key
	return &k
}

func (a *Auth) lockSpeechOps(ctx context.Context) (func(), error) {
	wait := time.NewTimer(siteKeyDaemonDeadline + 5*time.Second)
	defer wait.Stop()
	select {
	case a.speech.ops <- struct{}{}:
		return func() { <-a.speech.ops }, nil
	case <-ctx.Done():
	case <-wait.C:
	}
	return nil, errSiteKeyBusy
}

// setSiteSpeechKey stores the key. caller is the browser administrator.
func (a *Auth) setSiteSpeechKey(caller, region, key string) (*speechKeyView, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.speech.file == "" || !a.administrationHealthy() {
		return nil, ErrAdministrationState
	}
	if !a.isAdministratorLocked(caller) {
		return nil, errAdminDenied
	}
	record := speechKeyRecord{Version: 1, Region: region, Key: key, SetAt: a.now().UTC().Format(time.RFC3339)}
	if !validSpeechKeyRecord(record) {
		return nil, onboardingInvalid("invalid_key")
	}
	if e := a.writeSpeechKeyFile(record); e != nil {
		return nil, e
	}
	a.speech.key = &record
	a.log.Info("site_speech_key", "outcome", "accepted", "reason", "set", "region", region, "actor", actorFor(caller))
	return record.view(), nil
}

// deleteSiteSpeechKey removes the key. People keep their copies; only
// revoking the key at Soniox stops them.
func (a *Auth) deleteSiteSpeechKey(caller string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.speech.file == "" || !a.administrationHealthy() {
		return ErrAdministrationState
	}
	if !a.isAdministratorLocked(caller) {
		return errAdminDenied
	}
	if e := os.Remove(a.speech.file); e != nil && !os.IsNotExist(e) {
		return e
	}
	a.speech.key = nil
	if syncDir(filepath.Dir(a.speech.file)) != nil {
		a.log.Warn("site_speech_key", "outcome", "degraded", "reason", "directory_sync_failed")
	}
	a.log.Info("site_speech_key", "outcome", "accepted", "reason", "delete", "actor", actorFor(caller))
	return nil
}

// giveSpeechKey asks target's own daemon to take a copy of k and returns
// its one word, not_reached or unknown. Nothing is retried.
func (a *Auth) giveSpeechKey(ctx context.Context, target Identity, k speechKeyRecord) string {
	body, _ := json.Marshal(map[string]any{"schema_version": 1, "key": k.Key, "region": k.Region})
	b, err := a.postDaemon(ctx, target, speechDaemonPath, body)
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
	a.log.Info("site_speech_key_give", "outcome", outcome, "subject", target.Subject, "user", target.Username)
	return outcome
}

// giveSpeechKeyAtFirstLogin hands the site's key to the person whose
// account this login created. It runs after the login has answered and
// changes nothing about it.
func (a *Auth) giveSpeechKeyAtFirstLogin(target Identity) {
	k := a.siteSpeechKeyCopy()
	if k == nil {
		return
	}
	go a.giveSpeechKey(context.Background(), target, *k)
}

// speechGiveCounts says how many joined people got which answer.
type speechGiveCounts map[string]int

// giveSpeechKeyToJoined offers the stored key to every joined person,
// four at a time. A person not reached is given it by the next set.
func (a *Auth) giveSpeechKeyToJoined(ctx context.Context) (speechGiveCounts, error) {
	k := a.siteSpeechKeyCopy()
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
				outcome = a.giveSpeechKey(ctx, target, *k)
			}
			mu.Lock()
			counts[outcome]++
			mu.Unlock()
		}()
	}
	wg.Wait()
	return counts, nil
}

// siteSpeechKeyHTTP is GET …/speech-key, POST …/speech-key/set {region,
// key} and POST …/speech-key/delete {} for a current administrator.
func (a *Auth) siteSpeechKeyHTTP(w http.ResponseWriter, r *http.Request) {
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	path := r.URL.Path
	if !a.exact(r, path) || path != siteSpeechKeyPath && path != siteSpeechKeyPath+"/set" && path != siteSpeechKeyPath+"/delete" {
		safe(w, 400, "invalid_request")
		return
	}
	read := path == siteSpeechKeyPath
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
	reply := func(k *speechKeyView, given speechGiveCounts) {
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
		reply(a.siteSpeechKeyView(), nil)
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
		Region *string `json:"region"`
		Key    *string `json:"key"`
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, 1025))
	dec.DisallowUnknownFields()
	set := path == siteSpeechKeyPath+"/set"
	if dec.Decode(&body) != nil || dec.Decode(new(any)) != io.EOF || set != (body.Region != nil && body.Key != nil) || !set && (body.Region != nil || body.Key != nil) {
		safe(w, 400, "invalid_request")
		return
	}
	if !set {
		if err := a.deleteSiteSpeechKey(s.identity.Subject); err != nil {
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
	unlock, err := a.lockSpeechOps(ctx)
	if err != nil {
		status, code := siteKeyGiveStatus(err)
		safe(w, status, code)
		return
	}
	defer unlock()
	k, err := a.setSiteSpeechKey(s.identity.Subject, *body.Region, *body.Key)
	if err != nil {
		status, code := siteKeyGiveStatus(err)
		safe(w, status, code)
		return
	}
	given, err := a.giveSpeechKeyToJoined(ctx)
	if err != nil {
		// The key is stored; who has a copy is unknown until the next set.
		given = nil
		a.log.Warn("site_speech_key_give", "outcome", "degraded", "reason", "access_list_unavailable")
	}
	reply(k, given)
}
