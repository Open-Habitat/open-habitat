package gateway

import (
	"encoding/json"
	"io"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"unicode/utf8"
)

// AccountProfile is presentation only. It is never used to select a route or authorize a request.
type AccountProfile struct {
	Name      string `json:"name"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
}

func normalizeProfile(p AccountProfile) AccountProfile {
	p.Name = strings.TrimSpace(p.Name)
	if !utf8.ValidString(p.Name) || len(p.Name) > 200 {
		p.Name = ""
	}
	p.Email = strings.TrimSpace(p.Email)
	if len(p.Email) > 254 || !utf8.ValidString(p.Email) || !validEmail(p.Email) {
		p.Email = ""
	}
	u, err := url.Parse(p.AvatarURL)
	if err != nil || u.Scheme != "https" || u.Host != "avatars.githubusercontent.com" || u.User != nil || u.Fragment != "" || len(p.AvatarURL) > 1024 {
		p.AvatarURL = ""
	}
	return p
}
func validEmail(value string) bool {
	a, err := mail.ParseAddress(value)
	return err == nil && a.Address == value && !strings.ContainsAny(value, "\r\n")
}

func (a *Auth) updateProfile(w http.ResponseWriter, r *http.Request) {
	if !a.exact(r, "/auth/profile") || r.URL.RawQuery != "" || r.Header.Get("Content-Type") != "application/json" || r.ContentLength < 0 || r.ContentLength > 1024 {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if denied := a.authorizeWrite(r, s); denied != "" {
		safe(w, 403, denied)
		return
	}
	var input struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024))
	d.DisallowUnknownFields()
	if d.Decode(&input) != nil || d.Decode(new(any)) != io.EOF {
		safe(w, 400, "invalid_request")
		return
	}
	name, email := strings.TrimSpace(input.Name), strings.TrimSpace(input.Email)
	if s.profile.Name != "" && name != s.profile.Name || s.profile.Email != "" && email != s.profile.Email || name == "" || email == "" || normalizeProfile(AccountProfile{Name: name, Email: email}).Name != name || !validEmail(email) {
		safe(w, 400, "invalid_request")
		return
	}
	c, _ := r.Cookie(cookieName)
	a.mu.Lock()
	current, exists := a.sessions[c.Value]
	if !exists || current.identity != s.identity || current.csrf != s.csrf {
		a.mu.Unlock()
		safe(w, 401, "authentication_required")
		return
	}
	current.profile.Name, current.profile.Email = name, email
	a.sessions[c.Value] = current
	a.mu.Unlock()
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(current.profile)
}
