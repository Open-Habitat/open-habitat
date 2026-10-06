package gateway

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const sessionIdle = 90 * 24 * time.Hour
const sessionAbsolute = 365 * 24 * time.Hour
const renewalInterval = 24 * time.Hour

// The map is keyed by SHA-256 of the cookie secret, never the bearer value.
// An empty path is reserved for synthetic tests; the CLI always supplies a path.
func (a *Auth) sessionKey(secret string) string {
	if a.sessionFile == "" {
		return secret
	}
	h := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(h[:])
}

type diskSession struct {
	Identity    Identity       `json:"identity"`
	Profile     AccountProfile `json:"profile"`
	AccessEmail string         `json:"access_email"`
	CSRF        string         `json:"csrf"`
	Idle        time.Time      `json:"idle"`
	Absolute    time.Time      `json:"absolute"`
}

func (s session) MarshalJSON() ([]byte, error) {
	return json.Marshal(diskSession{s.identity, s.profile, s.accessEmail, s.csrf, s.idle, s.absolute})
}
func (s *session) UnmarshalJSON(b []byte) error {
	var d diskSession
	if err := json.Unmarshal(b, &d); err != nil {
		return err
	}
	*s = session{identity: d.Identity, profile: d.Profile, accessEmail: d.AccessEmail, csrf: d.CSRF, idle: d.Idle, absolute: d.Absolute}
	return nil
}

func validSessionRecord(key string, s session) bool {
	if len(key) != 64 {
		return false
	}
	if _, err := hex.DecodeString(key); err != nil {
		return false
	}
	if s.identity.Provider != "github" || s.identity.Subject == "" || s.csrf == "" || s.idle.IsZero() || s.absolute.IsZero() || s.idle.After(s.absolute) {
		return false
	}
	_, ok := brokerIdentity(s.identity.Subject, BrokerReply{Route: &BrokerRoute{UID: uint32(s.identity.UID), Username: s.identity.Username, Socket: s.identity.Socket}, Epoch: 1, Generation: 1})
	return ok && s.identity.UID > 0
}

func (a *Auth) sessionStoreHealthy() bool {
	if a.sessionFile == "" {
		return true
	}
	info, err := os.Lstat(a.sessionFile)
	return err == nil && info.Mode().IsRegular() && info.Mode().Perm() == 0600
}

func (a *Auth) loadSessions() error {
	if a.sessionFile == "" {
		return nil
	}
	info, err := os.Lstat(a.sessionFile)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() || info.Mode().Perm() != 0600 {
		return errors.New("invalid session store permissions")
	}
	f, err := os.Open(a.sessionFile)
	if err != nil {
		return err
	}
	defer f.Close()
	d := json.NewDecoder(io.LimitReader(f, 4<<20))
	d.DisallowUnknownFields()
	var state struct {
		Version  int                `json:"version"`
		Sessions map[string]session `json:"sessions"`
	}
	if err := d.Decode(&state); err != nil {
		return err
	}
	if state.Version != 1 || state.Sessions == nil || d.Decode(new(any)) != io.EOF {
		return errors.New("invalid session store")
	}
	now := a.now()
	for key, s := range state.Sessions {
		if !validSessionRecord(key, s) {
			return errors.New("invalid session record")
		}
		if !now.Before(s.idle) || !now.Before(s.absolute) {
			delete(state.Sessions, key)
		}
	}
	a.sessions = state.Sessions
	return nil
}

// commitSessions is called under mu. Publication follows a durable atomic replace;
// a pre-rename failure leaves the old authority unchanged.
func (a *Auth) commitSessions(next map[string]session) error {
	if a.sessionFile != "" {
		data, err := json.Marshal(struct {
			Version  int                `json:"version"`
			Sessions map[string]session `json:"sessions"`
		}{1, next})
		if err != nil {
			return err
		}
		if len(data) > 4<<20 {
			return errors.New("session store capacity exceeded")
		}
		dir := filepath.Dir(a.sessionFile)
		f, err := os.CreateTemp(dir, ".sessions-*")
		if err != nil {
			return err
		}
		defer os.Remove(f.Name())
		if err = f.Chmod(0600); err == nil {
			_, err = f.Write(data)
		}
		if err == nil {
			err = f.Sync()
		}
		if closeErr := f.Close(); err == nil {
			err = closeErr
		}
		if err != nil {
			return err
		}
		if err = os.Rename(f.Name(), a.sessionFile); err != nil {
			return err
		}
		// Rename changes the on-disk authority even if directory sync fails.
		a.sessions = next
		d, err := os.Open(dir)
		if err != nil {
			return err
		}
		err = d.Sync()
		_ = d.Close()
		if err != nil {
			return err
		}
	}
	a.sessions = next
	return nil
}
func (a *Auth) changedSessions(change func(map[string]session)) error {
	if a.sessionFile != "" && !a.sessionStoreHealthy() {
		if _, err := os.Lstat(a.sessionFile); !errors.Is(err, os.ErrNotExist) {
			return errors.New("session store unavailable")
		}
		// Losing the file invalidates every previous cookie, including when the
		// next operation is a login rather than an authenticated request.
		a.sessions = map[string]session{}
	}
	next := make(map[string]session, len(a.sessions))
	for k, v := range a.sessions {
		next[k] = v
	}
	change(next)
	return a.commitSessions(next)
}

// Avoid accepting unbounded, noncanonical cookie values as a lookup key.
func (a *Auth) cookieKey(value string) string {
	if a.sessionFile != "" && (len(value) != 43 || strings.ContainsAny(value, "=+/")) {
		return ""
	}
	return a.sessionKey(value)
}
