package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// BoundUser is the broker's public selection projection: never a route or credential.
type BoundUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}
type BrokerReader interface {
	ListBound(context.Context) ([]BoundUser, error)
	LookupBound(context.Context, string) (bool, error)
}

// ErrAdministrationState distinguishes a corrupt shared state record from OAuth config.
var ErrAdministrationState = errors.New("invalid gateway administration state")
var errAdminDenied = errors.New("administrator role removed")

type serverSettings struct {
	Version        int      `json:"version"`
	Name           string   `json:"name"`
	Administrators []string `json:"administrators"`
}

func emptySettings() serverSettings { return serverSettings{Version: 1, Administrators: []string{}} }
func canonicalSubject(id string) bool {
	n, e := strconv.ParseUint(id, 10, 64)
	return e == nil && n > 0 && strconv.FormatUint(n, 10) == id
}
func validName(name string) bool {
	if len(name) > 80 || len(strings.TrimSpace(name)) != len(name) {
		return false
	}
	for _, c := range name {
		if c < 32 || c == 127 {
			return false
		}
	}
	return true
}
func validSettings(s serverSettings) bool {
	if s.Version != 1 || !validName(s.Name) || s.Administrators == nil || len(s.Administrators) > 1024 {
		return false
	}
	seen := map[string]bool{}
	for _, id := range s.Administrators {
		if !canonicalSubject(id) || seen[id] {
			return false
		}
		seen[id] = true
	}
	return true
}

// The gateway holds the only in-process writer lock for browser and control changes.
// State is outside the release; a corrupt existing record fails startup closed.
func (a *Auth) loadAdministration(path string) (err error) {
	defer func() {
		if err != nil {
			err = ErrAdministrationState
		}
	}()
	a.adminEstablished = false
	a.adminFile = path
	a.settings = emptySettings()
	if path == "" {
		return nil
	}
	f, e := os.Open(path)
	if os.IsNotExist(e) {
		return nil
	}
	if e != nil {
		return e
	}
	defer f.Close()
	info, e := f.Stat()
	if e != nil || !privateSessionFile(info) || info.Size() > 65536 {
		return errors.New("invalid administration state")
	}
	dec := json.NewDecoder(io.LimitReader(f, 65537))
	dec.DisallowUnknownFields()
	var state serverSettings
	if dec.Decode(&state) != nil || dec.Decode(new(any)) != io.EOF || !validSettings(state) {
		return errors.New("invalid administration state")
	}
	a.settings = state
	a.adminEstablished = true
	return nil
}
func (a *Auth) administrationHealthy() bool {
	if a.adminFile == "" || !a.adminEstablished {
		return true
	}
	info, e := os.Lstat(a.adminFile)
	return e == nil && privateSessionFile(info)
}
func (a *Auth) commitAdministration(next serverSettings) error {
	if !a.administrationHealthy() {
		return ErrAdministrationState
	}
	if !validSettings(next) {
		return errors.New("invalid settings")
	}
	if a.adminFile != "" {
		if info, e := os.Lstat(a.adminFile); e == nil {
			if !privateSessionFile(info) {
				return errors.New("invalid administration file")
			}
		} else if a.adminEstablished || !os.IsNotExist(e) {
			return ErrAdministrationState
		}
		b, e := json.Marshal(next)
		if e != nil || len(b) > 65536 {
			return errors.New("invalid settings size")
		}
		dir := filepath.Dir(a.adminFile)
		f, e := os.CreateTemp(dir, ".admin-*")
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
		if e = os.Rename(f.Name(), a.adminFile); e != nil {
			return e
		}
		// Once renamed, the new record is authoritative even if the directory sync fails.
		a.settings = next
		a.adminEstablished = true
		d, e := os.Open(dir)
		if e != nil {
			return e
		}
		e = d.Sync()
		d.Close()
		if e != nil {
			return e
		}
	}
	a.settings = next
	return nil
}
func (a *Auth) isAdministratorLocked(id string) bool {
	if !a.administrationHealthy() {
		return false
	}
	for _, admin := range a.settings.Administrators {
		if admin == id {
			return true
		}
	}
	return false
}
func (a *Auth) isAdministrator(id string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.isAdministratorLocked(id)
}
func (a *Auth) settingsView() serverSettings {
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.administrationHealthy() {
		return emptySettings()
	}
	return a.settings
}
func (a *Auth) changeName(name string) error { return a.changeNameFor("", name) }
func (a *Auth) changeNameFor(caller, name string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if caller != "" && !a.isAdministratorLocked(caller) {
		return errAdminDenied
	}
	next := a.settings
	next.Name = name
	return a.commitAdministration(next)
}
func (a *Auth) changeRole(ctx context.Context, id string, administrator bool) error {
	return a.changeRoleFor(ctx, "", id, administrator)
}
func (a *Auth) changeRoleFor(ctx context.Context, caller, id string, administrator bool) error {
	if !canonicalSubject(id) {
		return errors.New("invalid subject")
	}
	// Granting needs a current bound target. Removal only subtracts authority:
	// permit root recovery even when a binding is gone or the broker is offline.
	if administrator {
		reader, ok := a.broker.(BrokerReader)
		if !ok {
			return errors.New("broker read unavailable")
		}
		bound, e := reader.LookupBound(ctx, id)
		if e != nil || !bound {
			return errors.New("binding unavailable")
		}
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if caller != "" && !a.isAdministratorLocked(caller) {
		return errAdminDenied
	}
	if !a.administrationHealthy() {
		return ErrAdministrationState
	}
	next := a.settings
	next.Administrators = append([]string{}, next.Administrators...)
	found := false
	out := next.Administrators[:0]
	for _, v := range next.Administrators {
		if v == id {
			found = true
			continue
		}
		out = append(out, v)
	}
	next.Administrators = out
	if administrator {
		next.Administrators = append(next.Administrators, id)
	}
	if found == administrator {
		return nil
	}
	return a.commitAdministration(next)
}
func (a *Auth) adminHTTP(w http.ResponseWriter, r *http.Request) {
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	if !a.exact(r, "/api/v1/server") && !a.exact(r, "/api/v1/server/administration") {
		safe(w, 400, "invalid_request")
		return
	}
	if r.URL.RawQuery != "" {
		safe(w, 400, "invalid_request")
		return
	}
	if r.URL.Path == "/api/v1/server" && r.Method == http.MethodGet {
		v := a.settingsView()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(struct {
			Version       int    `json:"schema_version"`
			Name          string `json:"name"`
			Administrator bool   `json:"administrator"`
		}{1, v.Name, a.isAdministrator(s.identity.Subject)})
		return
	}
	if !a.isAdministrator(s.identity.Subject) {
		safe(w, 403, "admin_required")
		return
	}
	if r.URL.Path == "/api/v1/server/administration" && r.Method == http.MethodGet {
		reader, ok := a.broker.(BrokerReader)
		if !ok {
			safe(w, 503, "broker_unavailable")
			return
		}
		users, e := reader.ListBound(r.Context())
		if e != nil {
			safe(w, 503, "broker_unavailable")
			return
		}
		v := a.settingsView()
		type row struct {
			ID            string `json:"id"`
			Username      string `json:"username"`
			Administrator bool   `json:"administrator"`
		}
		rows := make([]row, 0, len(users))
		for _, u := range users {
			admin := false
			for _, id := range v.Administrators {
				if id == u.ID {
					admin = true
					break
				}
			}
			rows = append(rows, row{u.ID, u.Username, admin})
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(struct {
			Version int    `json:"schema_version"`
			Name    string `json:"name"`
			Users   []row  `json:"users"`
		}{1, v.Name, rows})
		return
	}
	if r.URL.Path != "/api/v1/server/administration" || r.Method != http.MethodPut {
		safe(w, 405, "method_not_allowed")
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
	var request struct {
		Name          *string `json:"name"`
		Subject       string  `json:"subject"`
		Administrator *bool   `json:"administrator"`
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, 1025))
	dec.DisallowUnknownFields()
	if dec.Decode(&request) != nil || dec.Decode(new(any)) != io.EOF || (request.Name == nil) == (request.Administrator == nil) || request.Name != nil && request.Subject != "" || request.Administrator != nil && !canonicalSubject(request.Subject) {
		safe(w, 400, "invalid_request")
		return
	}
	var e error
	if request.Name != nil {
		if !validName(*request.Name) {
			safe(w, 400, "invalid_request")
			return
		}
		e = a.changeNameFor(s.identity.Subject, *request.Name)
	} else {
		e = a.changeRoleFor(r.Context(), s.identity.Subject, request.Subject, *request.Administrator)
	}
	if errors.Is(e, errAdminDenied) {
		safe(w, 403, "admin_required")
		return
	}
	if e != nil {
		safe(w, 503, "administration_unavailable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// AdminControl is called only after the private control listener verifies root
// peer credentials. The CLI client belongs to server-administration-cli.
func (a *Auth) AdminControl(ctx context.Context, payload []byte) ([]byte, error) {
	var r struct {
		Operation     string `json:"operation"`
		Name          string `json:"name"`
		Subject       string `json:"subject"`
		Administrator *bool  `json:"administrator"`
	}
	dec := json.NewDecoder(strings.NewReader(string(payload)))
	dec.DisallowUnknownFields()
	if len(payload) > 1024 || dec.Decode(&r) != nil || dec.Decode(new(any)) != io.EOF {
		return nil, errors.New("invalid control request")
	}
	switch r.Operation {
	case "show":
		if r.Name != "" || r.Subject != "" || r.Administrator != nil {
			break
		}
		return json.Marshal(a.settingsView())
	case "name":
		if r.Subject != "" || r.Administrator != nil || !validName(r.Name) {
			break
		}
		if e := a.changeName(r.Name); e != nil {
			return nil, e
		}
		return []byte(`{"ok":true}`), nil
	case "role":
		if r.Name != "" || r.Administrator == nil {
			break
		}
		if e := a.changeRole(ctx, r.Subject, *r.Administrator); e != nil {
			return nil, e
		}
		return []byte(`{"ok":true}`), nil
	}
	return nil, errors.New("invalid control request")
}
