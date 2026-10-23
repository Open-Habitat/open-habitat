// Package host implements deliberate local maintenance. It has no listener and
// is not imported by any runtime authority (gateway, daemon or broker).
package host

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/url"
	"path/filepath"
	"reflect"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"
)

var ErrSite = errors.New("invalid_site")

// SiteError contains only schema-owned paths and fixed rules, never input values.
// Unknown keys are deliberately identified at their containing object: a key can
// itself contain a secret. Array indexes are safe, generated positions.
type SiteError struct{ Path, Rule string }

func (e *SiteError) Error() string      { return e.Path + ": " + e.Rule }
func (e *SiteError) Unwrap() error      { return ErrSite }
func siteError(path, rule string) error { return &SiteError{path, rule} }

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

// ParseSite never returns raw decoder text or unknown input key names.
func ParseSite(b []byte) (Site, error) {
	var s Site
	if len(b) == 0 || len(b) > MaxSiteBytes {
		return s, siteError("$", "require 1..262144 bytes")
	}
	if !utf8.Valid(b) {
		return s, siteError("$", "require UTF-8 JSON")
	}
	if e := strictSiteJSON(b); e != nil {
		return s, e
	}
	if e := json.Unmarshal(b, &s); e != nil {
		return Site{}, siteError("$", "require representable site field values")
	}
	if e := s.Validate(); e != nil {
		return Site{}, e
	}
	sort.Strings(s.Identities.Admission)
	sort.Strings(s.Identities.Administrators)
	sort.Strings(s.Profiles)
	sort.Slice(s.Integrations, func(i, j int) bool { return s.Integrations[i].Provider < s.Integrations[j].Provider })
	return s, nil
}

// Token validation enforces exact JSON field spelling, required fields, types,
// duplicate keys and nesting before decoding. encoding/json alone accepts null
// scalars and case-insensitive field aliases, unlike the published schema.
func strictSiteJSON(b []byte) error {
	d := json.NewDecoder(bytes.NewReader(b))
	d.UseNumber()
	var value func(reflect.Type, string, int) error
	value = func(typ reflect.Type, path string, depth int) error {
		if depth > 32 {
			return siteError(path, "maximum nesting depth is 32")
		}
		for typ.Kind() == reflect.Pointer {
			typ = typ.Elem()
		}
		t, e := d.Token()
		if e != nil {
			return siteError(path, "require valid JSON value")
		}
		switch typ.Kind() {
		case reflect.Struct:
			if t != json.Delim('{') {
				return siteError(path, "require object (not null)")
			}
			fields := map[string]reflect.StructField{}
			for i := 0; i < typ.NumField(); i++ {
				f := typ.Field(i)
				fields[strings.Split(f.Tag.Get("json"), ",")[0]] = f
			}
			seen := map[string]bool{}
			for d.More() {
				k, e := d.Token()
				if e != nil {
					return siteError(path, "require object field")
				}
				key, ok := k.(string)
				if !ok {
					return siteError(path, "require object field")
				}
				f, known := fields[key]
				if !known {
					return siteError(path, "unknown field; only schema-declared field names are allowed")
				}
				fp := path + "." + key
				if seen[key] {
					return siteError(fp, "duplicate field is not allowed")
				}
				seen[key] = true
				if e := value(f.Type, fp, depth+1); e != nil {
					return e
				}
			}
			if t, e := d.Token(); e != nil || t != json.Delim('}') {
				return siteError(path, "require closing object delimiter")
			}
			for i := 0; i < typ.NumField(); i++ {
				f := typ.Field(i)
				name := strings.Split(f.Tag.Get("json"), ",")[0]
				if !strings.Contains(f.Tag.Get("json"), ",omitempty") && !seen[name] {
					return siteError(path+"."+name, "required field is missing")
				}
			}
		case reflect.Slice:
			if t != json.Delim('[') {
				return siteError(path, "require array (not null)")
			}
			for i := 0; d.More(); i++ {
				if e := value(typ.Elem(), fmt.Sprintf("%s[%d]", path, i), depth+1); e != nil {
					return e
				}
			}
			if t, e := d.Token(); e != nil || t != json.Delim(']') {
				return siteError(path, "require closing array delimiter")
			}
		case reflect.String:
			if _, ok := t.(string); !ok {
				return siteError(path, "require string (not null)")
			}
		case reflect.Bool:
			if _, ok := t.(bool); !ok {
				return siteError(path, "require boolean (not null)")
			}
		case reflect.Int, reflect.Uint32, reflect.Uint64:
			n, ok := t.(json.Number)
			if !ok {
				return siteError(path, "require integer (not null)")
			}
			// Bound the JSON number before unmarshal so failures retain their field path.
			if typ.Kind() == reflect.Int {
				if _, e := strconv.ParseInt(string(n), 10, typ.Bits()); e != nil {
					return siteError(path, "require representable integer")
				}
			} else if _, e := strconv.ParseUint(string(n), 10, typ.Bits()); e != nil {
				return siteError(path, "require representable unsigned integer")
			}
		default:
			panic("unhandled site type")
		}
		return nil
	}
	if e := value(reflect.TypeOf(Site{}), "$", 0); e != nil {
		return e
	}
	if _, e := d.Token(); e != io.EOF {
		return siteError("$", "require exactly one JSON document")
	}
	return nil
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

func (s Site) Validate() error {
	g, p, st := s.Gateway, s.Identities, s.Storage
	checks := []struct {
		path, rule string
		ok         bool
	}{
		{"schema_version", "must equal 1", s.SchemaVersion == 1},
		{"site_id", "require lowercase site identifier, 1..63 characters", siteIDRE.MatchString(s.SiteID)},
		{"release.version", "require major.minor.patch with optional prerelease", versionRE.MatchString(s.Release.Version)},
		{"release.manifest_sha256", "require 64 lowercase hexadecimal characters", digestRE.MatchString(s.Release.ManifestSHA256)},
		{"identities.uid_min", "require 1000..60000", p.UIDMin >= 1000 && p.UIDMin <= 60000},
		{"identities.uid_max", "require uid_min..60000 and at most 4096 pool entries", p.UIDMax >= p.UIDMin && p.UIDMax <= 60000 && p.UIDMax-p.UIDMin <= 4095},
		{"gateway.uid", "require 1000..60000", g.UID >= 1000 && g.UID <= 60000},
		{"gateway.gid", "require 1000..60000", g.GID >= 1000 && g.GID <= 60000},
		{"gateway.uid", "must lie outside identities uid_min..uid_max", !(g.UID >= p.UIDMin && g.UID <= p.UIDMax)},
		{"gateway.gid", "must lie outside identities uid_min..uid_max", !(g.GID >= p.UIDMin && g.GID <= p.UIDMax)},
		{"gateway.origin", "require HTTPS origin with host and no credentials, path, query or fragment", httpsOrigin(g.Origin)},
		{"gateway.oauth_callback", "must equal gateway.origin + /auth/github/callback", g.OAuthCallback == g.Origin+"/auth/github/callback"},
		{"gateway.oauth_client_id", "require 1..256 characters with no surrounding whitespace", g.OAuthClientID != "" && strings.TrimSpace(g.OAuthClientID) == g.OAuthClientID && utf8.RuneCountInString(g.OAuthClientID) <= 256},
		{"gateway.oauth_secret_file", "require canonical absolute non-root path without NUL or newlines", absolute(g.OAuthSecretFile)},
		{"gateway.tls_cert_file", "require canonical absolute non-root path without NUL or newlines", absolute(g.TLSCertFile)},
		{"gateway.tls_key_file", "require canonical absolute non-root path without NUL or newlines", absolute(g.TLSKeyFile)},
		{"gateway.origin_ca_file", "require canonical absolute non-root path without NUL or newlines when set", g.OriginCAFile == "" || absolute(g.OriginCAFile)},
		{"storage.home_uuid", "require canonical lowercase UUID", uuidRE.MatchString(st.HomeUUID)},
		{"storage.filesystem", "must equal ext4", st.Filesystem == "ext4"},
		{"storage.enforce_user_quota", "must equal true", st.EnforceUserQuota},
		{"storage.default_limit_bytes", "require 1048576..1125899906842624 bytes, multiple of 1024", st.DefaultLimitBytes >= 1<<20 && st.DefaultLimitBytes <= 1<<50 && st.DefaultLimitBytes%1024 == 0},
	}
	for _, c := range checks {
		if !c.ok {
			return siteError("$."+c.path, c.rule)
		}
	}
	for _, ids := range []struct {
		path   string
		values []string
	}{{"$.identities.admission", p.Admission}, {"$.identities.administrators", p.Administrators}} {
		if ids.values == nil || len(ids.values) > 128 {
			return siteError(ids.path, "require array of at most 128 subjects")
		}
		seen := map[string]bool{}
		for i, id := range ids.values {
			n, e := strconv.ParseUint(id, 10, 64)
			if !subjectRE.MatchString(id) || e != nil || n == 0 || seen[id] {
				return siteError(fmt.Sprintf("%s[%d]", ids.path, i), "require unique canonical nonzero uint64 subject")
			}
			seen[id] = true
		}
	}
	_, port, e := net.SplitHostPort(g.Listen)
	if e != nil {
		return siteError("$.gateway.listen", "require host:port endpoint (bracket IPv6)")
	}
	if n, e := strconv.ParseUint(port, 10, 16); e != nil || n == 0 || strconv.FormatUint(n, 10) != port {
		return siteError("$.gateway.listen", "require canonical decimal port 1..65535")
	}
	if s.Profiles == nil || len(s.Profiles) > 16 {
		return siteError("$.profiles", "require 1..16 unique profiles including core")
	}
	seen := map[string]bool{}
	for i, p := range s.Profiles {
		if !siteIDRE.MatchString(p) || seen[p] {
			return siteError(fmt.Sprintf("$.profiles[%d]", i), "require unique lowercase profile identifier, 1..63 characters")
		}
		seen[p] = true
	}
	if !seen["core"] {
		return siteError("$.profiles", "must include core")
	}
	if seen["editor"] != (s.Editor != nil) {
		return siteError("$.editor", "must be present exactly when profiles includes editor")
	}
	if s.Editor != nil && !validSiteEditorOrigin(g.Origin, s.Editor.OriginTemplate) {
		return siteError("$.editor.origin_template", "require separate HTTPS DNS origin with one * in the first label, no port, and room for a 52-character identity")
	}
	if len(s.Integrations) > 16 {
		return siteError("$.integrations", "maximum 16 declarations")
	}
	providers := map[string]bool{}
	for idx, i := range s.Integrations {
		path := fmt.Sprintf("$.integrations[%d]", idx)
		if !seen[i.Provider] || providers[i.Provider] {
			return siteError(path+".provider", "require unique provider named in profiles")
		}
		if !absolute(i.AppFile) {
			return siteError(path+".app_file", "require canonical absolute non-root path without NUL or newlines")
		}
		providers[i.Provider] = true
	}
	return nil
}

// Match the gateway's wildcard namespace and expanded DNS limits. Site files use
// the same '*' syntax as the gateway, not a second placeholder language.
func validSiteEditorOrigin(app, editor string) bool {
	u, e := url.Parse(editor)
	if e != nil || u.Scheme != "https" || u.User != nil || editor != "https://"+u.Host || u.Port() != "" || strings.Contains(u.Host, ":") {
		return false
	}
	host := u.Host
	if strings.Count(host, "*") != 1 || strings.Index(host, ".") < 0 || strings.Index(host, "*") > strings.Index(host, ".") {
		return false
	}
	expanded := strings.Replace(host, "*", strings.Repeat("a", 52), 1)
	if len(expanded) > 253 {
		return false
	}
	for _, label := range strings.Split(expanded, ".") {
		if len(label) == 0 || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, c := range label {
			if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '-') {
				return false
			}
		}
	}
	appURL, e := url.Parse(app)
	if e != nil {
		return false
	}
	prefix, suffix, _ := strings.Cut(host, "*")
	return !(strings.HasPrefix(appURL.Hostname(), prefix) && strings.HasSuffix(appURL.Hostname(), suffix))
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
