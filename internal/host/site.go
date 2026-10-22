// Package host implements deliberate local maintenance. It has no listener and
// is not imported by any runtime authority (gateway, daemon or broker).
package host

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/url"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"
)

var ErrSite = errors.New("invalid_site: expected strict site schema version 1; inspect the shipped site schema")

const MaxSiteBytes = 256 * 1024

type Release struct {
	Version        string `json:"version"`
	ManifestSHA256 string `json:"manifest_sha256"`
}
type Gateway struct {
	UID             uint32 `json:"uid"`
	GID             uint32 `json:"gid"`
	Listen          string `json:"listen"`
	Origin          string `json:"origin"`
	OAuthCallback   string `json:"oauth_callback"`
	OAuthClientID   string `json:"oauth_client_id"`
	OAuthSecretFile string `json:"oauth_secret_file"`
	TLSCertFile     string `json:"tls_cert_file"`
	TLSKeyFile      string `json:"tls_key_file"`
	OriginCAFile    string `json:"origin_ca_file,omitempty"`
}
type Identities struct {
	UIDMin         uint32   `json:"uid_min"`
	UIDMax         uint32   `json:"uid_max"`
	Admission      []string `json:"admission"`
	Administrators []string `json:"administrators"`
}
type Storage struct {
	HomeUUID          string `json:"home_uuid"`
	Filesystem        string `json:"filesystem"`
	EnforceUserQuota  bool   `json:"enforce_user_quota"`
	DefaultLimitBytes uint64 `json:"default_limit_bytes"`
}
type Editor struct {
	OriginTemplate string `json:"origin_template"`
}
type Integration struct {
	Provider string `json:"provider"`
	AppFile  string `json:"app_file"`
}
type Site struct {
	SchemaVersion int           `json:"schema_version"`
	SiteID        string        `json:"site_id"`
	Release       Release       `json:"release"`
	Gateway       Gateway       `json:"gateway"`
	Identities    Identities    `json:"identities"`
	Storage       Storage       `json:"storage"`
	Profiles      []string      `json:"profiles"`
	Editor        *Editor       `json:"editor,omitempty"`
	Integrations  []Integration `json:"integrations,omitempty"`
}

var siteIDRE = regexp.MustCompile(`^[a-z][a-z0-9-]{0,62}$`)
var versionRE = regexp.MustCompile(`^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.-]+)?$`)
var digestRE = regexp.MustCompile(`^[0-9a-f]{64}$`)
var subjectRE = regexp.MustCompile(`^[1-9][0-9]{0,19}$`)
var uuidRE = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// ParseSite never returns decoder text: unknown key names and malformed values
// may themselves be secrets. Duplicate keys are rejected at every nesting depth.
func ParseSite(b []byte) (Site, error) {
	var s Site
	if len(b) == 0 || len(b) > MaxSiteBytes || !utf8.Valid(b) || strictJSON(b) != nil {
		return s, ErrSite
	}
	d := json.NewDecoder(bytes.NewReader(b))
	d.DisallowUnknownFields()
	if d.Decode(&s) != nil || d.Decode(new(any)) != io.EOF || s.Validate() != nil {
		return Site{}, ErrSite
	}
	sort.Strings(s.Identities.Admission)
	sort.Strings(s.Identities.Administrators)
	sort.Strings(s.Profiles)
	sort.Slice(s.Integrations, func(i, j int) bool { return s.Integrations[i].Provider < s.Integrations[j].Provider })
	return s, nil
}
func strictJSON(b []byte) error {
	d := json.NewDecoder(bytes.NewReader(b))
	d.UseNumber()
	var value func(int) error
	value = func(depth int) error {
		if depth > 32 {
			return ErrSite
		}
		t, e := d.Token()
		if e != nil || t == nil {
			return ErrSite
		}
		if x, ok := t.(json.Delim); ok {
			switch x {
			case '{':
				keys := map[string]bool{}
				for d.More() {
					k, e := d.Token()
					if e != nil {
						return ErrSite
					}
					key, ok := k.(string)
					if !ok || keys[key] {
						return ErrSite
					}
					keys[key] = true
					if value(depth+1) != nil {
						return ErrSite
					}
				}
				t, e = d.Token()
				if e != nil || t != json.Delim('}') {
					return ErrSite
				}
			case '[':
				for d.More() {
					if value(depth+1) != nil {
						return ErrSite
					}
				}
				t, e = d.Token()
				if e != nil || t != json.Delim(']') {
					return ErrSite
				}
			default:
				return ErrSite
			}
		}
		return nil
	}
	if value(0) != nil {
		return ErrSite
	}
	if _, e := d.Token(); e != io.EOF {
		return ErrSite
	}
	return nil
}
func absolute(p string) bool {
	return filepath.IsAbs(p) && filepath.Clean(p) == p && p != "/" && !strings.ContainsAny(p, "\x00\n\r")
}
func httpsOrigin(s string) bool {
	u, e := url.Parse(s)
	return e == nil && u.Scheme == "https" && u.Hostname() != "" && u.User == nil && u.RawQuery == "" && u.Fragment == "" && u.Path == "" && u.RawPath == ""
}

// The existing broker state reader is bounded to 4096 bytes. 128 canonical
// uint64 subjects fit even at the longest representation; do not accept a site
// which could only fail after creating an initialization staging directory.
func subjects(ids []string) bool {
	if ids == nil || len(ids) > 128 {
		return false
	}
	seen := map[string]bool{}
	for _, id := range ids {
		if n, e := strconv.ParseUint(id, 10, 64); !subjectRE.MatchString(id) || e != nil || n == 0 || seen[id] {
			return false
		}
		seen[id] = true
	}
	return true
}
func (s Site) Validate() error {
	g, p, st := s.Gateway, s.Identities, s.Storage
	if s.SchemaVersion != 1 || !siteIDRE.MatchString(s.SiteID) || !versionRE.MatchString(s.Release.Version) || !digestRE.MatchString(s.Release.ManifestSHA256) {
		return ErrSite
	}
	if g.UID < 1000 || g.UID > 60000 || g.GID < 1000 || g.GID > 60000 || p.UIDMin < 1000 || p.UIDMax > 60000 || p.UIDMax < p.UIDMin || p.UIDMax-p.UIDMin > 4095 || g.UID >= p.UIDMin && g.UID <= p.UIDMax || g.GID >= p.UIDMin && g.GID <= p.UIDMax || !subjects(p.Admission) || !subjects(p.Administrators) {
		return ErrSite
	}
	if _, port, e := net.SplitHostPort(g.Listen); e != nil || port == "" {
		return ErrSite
	}
	_, port, _ := net.SplitHostPort(g.Listen)
	if n, e := strconv.ParseUint(port, 10, 16); e != nil || n == 0 || strconv.FormatUint(n, 10) != port {
		return ErrSite
	}
	if !httpsOrigin(g.Origin) || g.OAuthCallback != g.Origin+"/auth/github/callback" || g.OAuthClientID == "" || strings.TrimSpace(g.OAuthClientID) != g.OAuthClientID || len(g.OAuthClientID) > 256 {
		return ErrSite
	}
	for _, f := range []string{g.OAuthSecretFile, g.TLSCertFile, g.TLSKeyFile} {
		if !absolute(f) {
			return ErrSite
		}
	}
	if g.OriginCAFile != "" && !absolute(g.OriginCAFile) {
		return ErrSite
	}
	if !uuidRE.MatchString(st.HomeUUID) || st.Filesystem != "ext4" || !st.EnforceUserQuota || st.DefaultLimitBytes < 1<<20 || st.DefaultLimitBytes > 1<<50 || st.DefaultLimitBytes%1024 != 0 {
		return ErrSite
	}
	if s.Profiles == nil || len(s.Profiles) > 16 {
		return ErrSite
	}
	seen := map[string]bool{}
	for _, p := range s.Profiles {
		if !siteIDRE.MatchString(p) || seen[p] {
			return ErrSite
		}
		seen[p] = true
	}
	if !seen["core"] || seen["editor"] != (s.Editor != nil) {
		return ErrSite
	}
	if s.Editor != nil {
		t := s.Editor.OriginTemplate
		if strings.Count(t, "{identity}") != 1 || !httpsOrigin(strings.ReplaceAll(t, "{identity}", "example")) || strings.ReplaceAll(t, "{identity}", "example") == g.Origin {
			return ErrSite
		}
	}
	providers := map[string]bool{}
	for _, i := range s.Integrations {
		if !seen[i.Provider] || providers[i.Provider] || !absolute(i.AppFile) {
			return ErrSite
		}
		providers[i.Provider] = true
	}
	return nil
}

// Immutable is the only persisted site policy needed to reject a migration.
// It contains no identity bindings, settings snapshot or protected file hashes.
type Immutable struct {
	SiteID     string `json:"site_id"`
	GatewayUID uint32 `json:"gateway_uid"`
	GatewayGID uint32 `json:"gateway_gid"`
	UIDMin     uint32 `json:"uid_min"`
	UIDMax     uint32 `json:"uid_max"`
	HomeUUID   string `json:"home_uuid"`
}

func (s Site) Immutable() Immutable {
	return Immutable{s.SiteID, s.Gateway.UID, s.Gateway.GID, s.Identities.UIDMin, s.Identities.UIDMax, s.Storage.HomeUUID}
}
