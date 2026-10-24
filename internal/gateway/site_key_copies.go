package gateway

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"maps"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"time"
)

// The site key's copies (ADR 0030): the gateway's own record of which site
// key it gave whom and when, at the sign-in that created an account or
// later by an administrator. It holds salted fingerprints, never a key, so
// a key the site no longer stores can still be recognised in a person's Pi
// by that person's own daemon, which compares them in its own UID. It says
// what the site gave, not what anyone's Pi holds now.
//
// It is a gateway-UID 0600 file of its own beside the key file, outside
// administration state (whose digest enters upgrade proofs), and it outlives
// the key: removing the key leaves the copies with their people, and the
// next key replaces them.

const (
	maxLedgerKeys   = 32
	maxLedgerCopies = 4096
	maxLedgerFile   = 1 << 20
)

type siteKeyLedger struct {
	Version int    `json:"version"`
	Salt    string `json:"salt"`
	// Keys are the site keys the gateway has stored, oldest first.
	Keys []ledgerKey `json:"keys"`
	// Copies is each person's latest copy, by GitHub subject.
	Copies map[string]ledgerCopy `json:"copies"`
}
type ledgerKey struct {
	Fingerprint string `json:"fingerprint"`
	Provider    string `json:"provider"`
	Suffix      string `json:"suffix"`
	SetAt       string `json:"set_at"`
}
type ledgerCopy struct {
	Fingerprint string `json:"fingerprint"`
	At          string `json:"at"`
}

var ledgerHex = regexp.MustCompile(`^[0-9a-f]{64}$`)
var ledgerSuffix = regexp.MustCompile(`^[A-Za-z0-9_-]{4}$`)

func siteKeyFingerprint(salt, key string) string {
	b, _ := hex.DecodeString(salt)
	m := hmac.New(sha256.New, b)
	m.Write([]byte(key))
	return hex.EncodeToString(m.Sum(nil))
}

func validRFC3339(s string) bool {
	at, e := time.Parse(time.RFC3339, s)
	return e == nil && at.UTC().Format(time.RFC3339) == s
}

func validLedger(l siteKeyLedger) bool {
	if l.Version != 1 || !ledgerHex.MatchString(l.Salt) || l.Keys == nil || len(l.Keys) > maxLedgerKeys || l.Copies == nil || len(l.Copies) > maxLedgerCopies {
		return false
	}
	known := map[string]bool{}
	for _, k := range l.Keys {
		if !ledgerHex.MatchString(k.Fingerprint) || known[k.Fingerprint] || !slices.Contains(siteKeyProviders, k.Provider) || !ledgerSuffix.MatchString(k.Suffix) || !validRFC3339(k.SetAt) {
			return false
		}
		known[k.Fingerprint] = true
	}
	for subject, c := range l.Copies {
		if !canonicalSubject(subject) || !known[c.Fingerprint] || !validRFC3339(c.At) {
			return false
		}
	}
	return true
}

func (a *Auth) ledgerFile() string {
	if a.siteKeyFile == "" {
		return ""
	}
	return filepath.Join(filepath.Dir(a.siteKeyFile), "site-ai-key-copies.json")
}

// loadSiteKeyLedger reads the record once at startup, after the key. A file
// that is not the gateway's private record fails startup closed; a missing
// one is an empty record whose salt is made at its first write.
func (a *Auth) loadSiteKeyLedger() error {
	a.ledger = siteKeyLedger{Version: 1, Keys: []ledgerKey{}, Copies: map[string]ledgerCopy{}}
	path := a.ledgerFile()
	if path == "" {
		return nil
	}
	f, e := os.Open(path)
	if os.IsNotExist(e) {
		return a.knowStoredKeyLocked()
	}
	if e != nil {
		return ErrAdministrationState
	}
	defer f.Close()
	info, e := f.Stat()
	if e != nil || !privateSessionFile(info) || info.Size() > maxLedgerFile {
		return ErrAdministrationState
	}
	var l siteKeyLedger
	dec := json.NewDecoder(io.LimitReader(f, maxLedgerFile+1))
	dec.DisallowUnknownFields()
	if dec.Decode(&l) != nil || dec.Decode(new(any)) != io.EOF || !validLedger(l) {
		return ErrAdministrationState
	}
	a.ledger = l
	return a.knowStoredKeyLocked()
}

// knowStoredKeyLocked makes sure the stored key is among the known keys, in
// memory; the next write persists it. A key stored before this record
// existed is recognised the same way.
func (a *Auth) knowStoredKeyLocked() error {
	if a.siteKey == nil {
		return nil
	}
	next, e := a.ledgerBaseLocked()
	if e != nil {
		return e
	}
	a.ledger = withKnownKey(next, *a.siteKey)
	return nil
}

func (a *Auth) secretHex() (string, error) {
	b := make([]byte, 32)
	if _, e := io.ReadFull(a.random, b); e != nil {
		return "", e
	}
	return hex.EncodeToString(b), nil
}

// withKnownKey returns l with k among its keys, dropping the oldest key, and
// the copies of it, beyond the bound.
func withKnownKey(l siteKeyLedger, k siteKeyRecord) siteKeyLedger {
	fp := siteKeyFingerprint(l.Salt, k.Key)
	next := cloneLedger(l)
	for _, known := range next.Keys {
		if known.Fingerprint == fp {
			return next
		}
	}
	next.Keys = append(next.Keys, ledgerKey{Fingerprint: fp, Provider: k.Provider, Suffix: k.Key[len(k.Key)-4:], SetAt: k.SetAt})
	for len(next.Keys) > maxLedgerKeys {
		dropped := next.Keys[0].Fingerprint
		next.Keys = next.Keys[1:]
		maps.DeleteFunc(next.Copies, func(_ string, c ledgerCopy) bool { return c.Fingerprint == dropped })
	}
	return next
}

func cloneLedger(l siteKeyLedger) siteKeyLedger {
	l.Keys = append([]ledgerKey{}, l.Keys...)
	l.Copies = maps.Clone(l.Copies)
	if l.Copies == nil {
		l.Copies = map[string]ledgerCopy{}
	}
	return l
}

// commitLedgerLocked writes next and makes it the record. Call under mu.
func (a *Auth) commitLedgerLocked(next siteKeyLedger) error {
	path := a.ledgerFile()
	if path == "" {
		a.ledger = next
		return nil
	}
	if !validLedger(next) {
		return ErrAdministrationState
	}
	b, e := json.Marshal(next)
	if e != nil {
		return e
	}
	dir := filepath.Dir(path)
	f, e := os.CreateTemp(dir, ".site-ai-key-copies-*")
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
	if e = os.Rename(f.Name(), path); e != nil {
		return e
	}
	a.ledger = next
	if syncDir(dir) != nil {
		a.log.Warn("site_ai_key_copies", "outcome", "degraded", "reason", "directory_sync_failed")
	}
	return nil
}

// ledgerBaseLocked is a copy of the record to change, with its salt made.
// Call under mu.
func (a *Auth) ledgerBaseLocked() (siteKeyLedger, error) {
	next := cloneLedger(a.ledger)
	next.Version = 1
	if next.Salt == "" {
		salt, e := a.secretHex()
		if e != nil {
			return siteKeyLedger{}, e
		}
		next.Salt = salt
	}
	return next, nil
}

// recordKeyLocked adds a newly stored key to the known keys. Call under mu.
func (a *Auth) recordKeyLocked(k siteKeyRecord) error {
	next, e := a.ledgerBaseLocked()
	if e != nil {
		return e
	}
	return a.commitLedgerLocked(withKnownKey(next, k))
}

// recordCopyLocked notes that subject now holds a copy of k, or, with given
// false, that their own credential means they hold none the site gave.
// Call under mu.
func (a *Auth) recordCopyLocked(subject string, k siteKeyRecord, given bool) error {
	if _, had := a.ledger.Copies[subject]; !given && !had {
		return nil
	}
	next, e := a.ledgerBaseLocked()
	if e != nil {
		return e
	}
	next = withKnownKey(next, k)
	if given {
		next.Copies[subject] = ledgerCopy{Fingerprint: siteKeyFingerprint(next.Salt, k.Key), At: a.now().UTC().Format(time.RFC3339)}
	} else {
		delete(next.Copies, subject)
	}
	if len(next.Copies) > maxLedgerCopies {
		return ErrAdministrationState
	}
	return a.commitLedgerLocked(next)
}

// siteKeyMaterial is what a check or a write sends a person's daemon for
// provider: the salt, the stored key's fingerprint and the fingerprints of
// every earlier site key of the same provider. Call under mu.
type siteKeyMaterial struct {
	Salt, Current string
	Earlier       []string
}

func (a *Auth) siteKeyMaterialLocked(k siteKeyRecord) siteKeyMaterial {
	l := withKnownKey(a.ledger, k)
	m := siteKeyMaterial{Salt: l.Salt, Current: siteKeyFingerprint(l.Salt, k.Key), Earlier: []string{}}
	for _, known := range l.Keys {
		if known.Provider == k.Provider && known.Fingerprint != m.Current {
			m.Earlier = append(m.Earlier, known.Fingerprint)
		}
	}
	return m
}

// copyView is one person's copy as administrators and that person see it.
type copyView struct {
	Provider string `json:"provider"`
	Suffix   string `json:"suffix"`
	At       string `json:"at"`
	// Current: the copy is of the key the site stores now.
	Current bool `json:"current"`
}

func (a *Auth) copyViewLocked(subject string) *copyView {
	c, ok := a.ledger.Copies[subject]
	if !ok {
		return nil
	}
	for _, k := range a.ledger.Keys {
		if k.Fingerprint == c.Fingerprint {
			current := a.siteKey != nil && siteKeyFingerprint(a.ledger.Salt, a.siteKey.Key) == c.Fingerprint
			return &copyView{Provider: k.Provider, Suffix: k.Suffix, At: c.At, Current: current}
		}
	}
	return nil
}

func (a *Auth) copyView(subject string) *copyView {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.copyViewLocked(subject)
}

// staleHoldersLocked are the people whose recorded copy is of an earlier key
// of the stored key's provider: the people a new key replaces. Call under mu.
func (a *Auth) staleHoldersLocked() []string {
	if a.siteKey == nil {
		return nil
	}
	m := a.siteKeyMaterialLocked(*a.siteKey)
	var out []string
	for subject, c := range a.ledger.Copies {
		if slices.Contains(m.Earlier, c.Fingerprint) {
			out = append(out, subject)
		}
	}
	slices.Sort(out)
	return out
}

// copyHolders is everyone the record says holds a copy the site gave.
func (a *Auth) copyHolders() []string {
	a.mu.Lock()
	defer a.mu.Unlock()
	out := slices.Collect(maps.Keys(a.ledger.Copies))
	slices.Sort(out)
	return out
}
