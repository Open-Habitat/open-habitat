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
	"syscall"
	"time"
)

const sessionIdle = 90 * 24 * time.Hour
const sessionAbsolute = 365 * 24 * time.Hour
const renewalInterval = 24 * time.Hour

// Version 2 added the session list fields of ADR 0018. An older file is
// discarded at startup, which signs everyone out once (pre-release policy).
const sessionStoreVersion = 2

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
	ID          string         `json:"id"`
	Method      string         `json:"method"`
	Device      string         `json:"device"`
	Created     time.Time      `json:"created"`
	GitHubAt    time.Time      `json:"github_at"`
}

func (s session) MarshalJSON() ([]byte, error) {
	return json.Marshal(diskSession{s.identity, s.profile, s.accessEmail, s.csrf, s.idle, s.absolute, s.id, s.method, s.device, s.created, s.githubAt})
}
func (s *session) UnmarshalJSON(b []byte) error {
	var d diskSession
	if err := json.Unmarshal(b, &d); err != nil {
		return err
	}
	*s = session{identity: d.Identity, profile: d.Profile, accessEmail: d.AccessEmail, csrf: d.CSRF, idle: d.Idle, absolute: d.Absolute, id: d.ID, method: d.Method, device: d.Device, created: d.Created, githubAt: d.GitHubAt}
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
	if !validSessionID(s.id) || s.method != "github" && s.method != "link" || !knownDevice(s.device) || s.created.IsZero() || s.githubAt.IsZero() || s.githubAt.After(s.created) {
		return false
	}
	_, ok := brokerIdentity(s.identity.Subject, BrokerReply{Route: &BrokerRoute{UID: uint32(s.identity.UID), Username: s.identity.Username, Socket: s.identity.Socket}, Epoch: 1, Generation: 1})
	return ok && s.identity.UID > 0
}

func privateSessionFile(info os.FileInfo) bool {
	stat, ok := info.Sys().(*syscall.Stat_t)
	return ok && info.Mode().IsRegular() && info.Mode().Perm() == 0600 && stat.Uid == uint32(os.Getuid())
}

func (a *Auth) sessionStoreHealthy() bool {
	if a.sessionFile == "" {
		return true
	}
	info, err := os.Lstat(a.sessionFile)
	return err == nil && privateSessionFile(info)
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
	if !privateSessionFile(info) {
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
	if state.Version != sessionStoreVersion || state.Sessions == nil || d.Decode(new(any)) != io.EOF {
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
		}{sessionStoreVersion, next})
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
		// An absent or unreadable record invalidates all previous cookies.
		// A new login can atomically replace it, not restore old memory.
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
