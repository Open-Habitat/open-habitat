// Package integrationapps is the one definition of an integration provider's
// application registration in /opt/open-habitat/integrations.json: which
// fields each provider's section has, which values the person's daemon will
// use, and which values the root broker accepts from a browser administrator.
// It also edits one member of that file without touching any other byte.
// It holds no authority and reads no file; the daemon and the broker do.
package integrationapps

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

// Path is the installation-wide file. It names application identifiers and
// pinned tools, never a person, so every mapped user may read it; only root
// may write it.
const Path = "/opt/open-habitat/integrations.json"

// MaxFile is the most the daemon reads of the operator file.
const MaxFile = 16384

// Providers are the file's application sections in the catalog's order;
// each needs the operator's application. A provider whose account levels are
// separate applications has one section per level beside its own, which is
// the full level: an Entra application's consented permissions are what every
// one of its tokens carries, and a Dropbox application's access type (App
// folder or Full Dropbox) is fixed when it is created, so a narrower level
// that the provider itself enforces is another registration. The section
// name is the provider, an underscore and the level.
//
// The microsoft_shared sections are the operator's multi-tenant Entra
// applications, one per level like the single-tenant ones: each serves every
// organisation on the allowed list (TenantsKey) whose cell of that level no
// single-tenant section fills. Their tenant_id is the tenant that owns the
// registration, never a sign-in authority on its own account.
var Providers = []string{"google", "microsoft", "microsoft_nosend", "microsoft_drafts", "microsoft_read", "microsoft_shared", "microsoft_shared_nosend", "microsoft_shared_drafts", "microsoft_shared_read", "dropbox", "dropbox_app_folder"}

// MicrosoftShared is the shared section of a level's single-tenant section
// name ("microsoft_read" → "microsoft_shared_read"), "" for anything else.
func MicrosoftShared(section string) string {
	switch section {
	case "microsoft":
		return "microsoft_shared"
	case "microsoft_nosend", "microsoft_drafts", "microsoft_read":
		return "microsoft_shared_" + strings.TrimPrefix(section, "microsoft_")
	}
	return ""
}

// ProviderOf is the provider a section registers an application for.
func ProviderOf(section string) string {
	provider, _, _ := strings.Cut(section, "_")
	return provider
}

// Fields are a provider's section members, in the order they are written.
func Fields(provider string) []string {
	switch provider {
	case "google", "dropbox", "dropbox_app_folder":
		return []string{"client_id", "client_secret"}
	case "microsoft", "microsoft_nosend", "microsoft_drafts", "microsoft_read", "microsoft_shared", "microsoft_shared_nosend", "microsoft_shared_drafts", "microsoft_shared_read":
		return []string{"client_id", "tenant_id"}
	}
	return nil
}

// SecretField names the member that must never leave root's file, or "" when
// the provider's application is a public client without one.
func SecretField(provider string) string {
	if ProviderOf(provider) == "microsoft" {
		return ""
	}
	return "client_secret"
}

var (
	googleValue   = regexp.MustCompile(`^[A-Za-z0-9._-]{1,256}$`)
	dropboxValue  = regexp.MustCompile(`^[A-Za-z0-9_-]{1,256}$`)
	microsoftGUID = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	// Google's OAuth client id is the project number, a dash, a lowercase
	// identifier and this fixed domain.
	googleClientID = regexp.MustCompile(`^[0-9]{1,20}-[a-z0-9]{1,64}\.apps\.googleusercontent\.com$`)
)

// Usable is the daemon's rule: whether the person's daemon uses a section.
// An operator may hand-edit the file, so it is no stricter than the tools
// themselves need. Every Microsoft tenant is a Directory (tenant) ID, never
// common, organizations or consumers: a single-tenant app cannot sign in
// through them (AADSTS50194), and a multi-tenant one through organizations
// would sign a guest in at their home tenant instead of the organisation
// they chose. Personal Microsoft accounts are out either way.
func Usable(provider string, f map[string]string) bool {
	if Fields(provider) == nil {
		return false
	}
	switch ProviderOf(provider) {
	case "google":
		return googleValue.MatchString(f["client_id"]) && googleValue.MatchString(f["client_secret"])
	case "dropbox":
		return dropboxValue.MatchString(f["client_id"]) && dropboxValue.MatchString(f["client_secret"])
	case "microsoft":
		return microsoftGUID.MatchString(f["client_id"]) && microsoftGUID.MatchString(f["tenant_id"])
	}
	return false
}

// Valid is what the broker writes: exactly the provider's fields, usable by
// the daemon, in the provider's own format, and no value pasted twice. Both
// Microsoft ids sit on the same Entra Overview page, so the same GUID in
// either case is refused as the likeliest paste mistake. A level's section is
// judged alone: which application a sign-in used decides only what it asks
// for, while the level an account shows is read from what it was granted.
func Valid(provider string, f map[string]string) bool {
	want := Fields(provider)
	if want == nil || len(f) != len(want) || !Usable(provider, f) {
		return false
	}
	for _, k := range want {
		if _, ok := f[k]; !ok {
			return false
		}
	}
	if strings.EqualFold(f[want[0]], f[want[1]]) {
		return false
	}
	if provider == "google" {
		return googleClientID.MatchString(f["client_id"])
	}
	return true
}

// Section is the canonical member value for a valid section.
func Section(provider string, f map[string]string) []byte {
	var b bytes.Buffer
	b.WriteByte('{')
	for i, k := range Fields(provider) {
		if i > 0 {
			b.WriteByte(',')
		}
		key, _ := json.Marshal(k)
		value, _ := json.Marshal(f[k])
		b.Write(key)
		b.WriteByte(':')
		b.Write(value)
	}
	b.WriteByte('}')
	return b.Bytes()
}

// ReadSection decodes a member value into its string fields. It refuses
// anything but one object of distinct string members.
func ReadSection(raw []byte) (map[string]string, bool) {
	members, err := Members(raw)
	if err != nil {
		return nil, false
	}
	out := make(map[string]string, len(members))
	for _, m := range members {
		var s string
		if json.Unmarshal(m.Value, &s) != nil {
			return nil, false
		}
		out[m.Key] = s
	}
	return out, true
}

var ErrFile = errors.New("integrations file is not one JSON object of distinct members")

// Member is one top-level member: its key, its value's exact bytes and where
// they lie in the file.
type Member struct {
	Key        string
	Value      []byte
	Start, End int // segment from just after the preceding token to the value's end
}

// Members parses one JSON object with distinct keys and nothing after it
// except whitespace, recording each member's byte range.
func Members(b []byte) ([]Member, error) {
	if len(b) > MaxFile || !json.Valid(b) {
		return nil, ErrFile
	}
	d := json.NewDecoder(bytes.NewReader(b))
	if t, e := d.Token(); e != nil || t != json.Delim('{') {
		return nil, ErrFile
	}
	var out []Member
	seen := map[string]bool{}
	for d.More() {
		start := int(d.InputOffset())
		t, e := d.Token()
		key, ok := t.(string)
		var raw json.RawMessage
		if e != nil || !ok || seen[key] || d.Decode(&raw) != nil {
			return nil, ErrFile
		}
		seen[key] = true
		end := int(d.InputOffset())
		out = append(out, Member{Key: key, Value: b[end-len(raw) : end], Start: start, End: end})
	}
	if t, e := d.Token(); e != nil || t != json.Delim('}') {
		return nil, ErrFile
	}
	if _, e := d.Token(); e != io.EOF {
		return nil, ErrFile
	}
	return out, nil
}

// Replace sets member key to value, or removes it when value is nil. Every
// byte outside that member stays as it was: an existing member's value is
// replaced in place, a new one is appended after the last member, and a
// removed one takes one adjacent comma with it.
func Replace(file []byte, key string, value []byte) ([]byte, error) {
	members, err := Members(file)
	if err != nil {
		return nil, err
	}
	at := -1
	for i, m := range members {
		if m.Key == key {
			at = i
		}
	}
	var out []byte
	switch {
	case value != nil && at >= 0:
		m := members[at]
		out = concat(file[:m.End-len(m.Value)], value, file[m.End:])
	case value != nil:
		k, _ := json.Marshal(key)
		member := append(append(k, ':'), value...)
		if len(members) == 0 {
			open := bytes.IndexByte(file, '{') + 1
			out = concat(file[:open], member, file[open:])
		} else {
			last := members[len(members)-1].End
			out = concat(file[:last], append([]byte{','}, member...), file[last:])
		}
	case at < 0:
		return file, nil
	case at > 0:
		// Take the separating comma before the member with it.
		m := members[at]
		out = concat(file[:members[at-1].End], file[m.End:])
	default:
		m := members[0]
		end := m.End
		if len(members) > 1 {
			// The first member takes the comma that follows it and the
			// whitespace up to the next key.
			end += strings.IndexByte(string(file[m.End:]), ',') + 1
			for end < len(file) && strings.IndexByte(" \t\r\n", file[end]) >= 0 {
				end++
			}
		}
		out = concat(file[:m.Start], file[end:])
	}
	if len(out) > MaxFile {
		return nil, ErrFile
	}
	if _, err = Members(out); err != nil {
		return nil, err
	}
	return out, nil
}

func concat(parts ...[]byte) []byte {
	var b bytes.Buffer
	for _, p := range parts {
		b.Write(p)
	}
	return b.Bytes()
}

// TenantsKey is the allowed list of organisations the shared Microsoft
// applications serve: a member whose keys are tenant GUIDs and whose values
// are the labels people see. It is not a security boundary: a refresh token
// of a multi-tenant application is bound to the person and the application,
// not to one organisation, so the list governs what Habitat's own connect,
// refresh and tool paths do, never what a program running as the person can
// reach. The labels are in a file every mapped user can read.
const TenantsKey = "microsoft_tenants"

// MaxTenants and MaxLabel bound the list and a label (in characters).
const (
	MaxTenants = 32
	MaxLabel   = 64
)

// Tenant is one allowed organisation.
type Tenant struct {
	ID    string `json:"tenant_id"`
	Label string `json:"label"`
}

var lowerGUID = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// CanonicalTenant is a tenant GUID in the list's form, lowercase, or false
// when s is not a GUID. A domain name or an audience keyword is not one.
func CanonicalTenant(s string) (string, bool) {
	if !microsoftGUID.MatchString(s) {
		return "", false
	}
	return strings.ToLower(s), true
}

// ValidTenantID is the broker's rule for a list key: a lowercase GUID.
func ValidTenantID(s string) bool { return lowerGUID.MatchString(s) }

// ValidLabel admits 1 to MaxLabel printable characters with no space at
// either end. Nothing in it can break a line or a terminal's display.
func ValidLabel(s string) bool {
	if !utf8.ValidString(s) || s != strings.TrimSpace(s) {
		return false
	}
	n := 0
	for _, r := range s {
		if !unicode.IsPrint(r) {
			return false
		}
		n++
	}
	return n >= 1 && n <= MaxLabel
}

// ReadTenants decodes the list in the file's order. A list with a key that
// is not a GUID, a label the broker would refuse, two keys naming the same
// tenant in different case, or more than MaxTenants entries is refused
// whole: the daemon then serves no organisation through the shared
// applications rather than guessing which entries were meant.
func ReadTenants(raw []byte) ([]Tenant, bool) {
	members, err := Members(raw)
	if err != nil || len(members) > MaxTenants {
		return nil, false
	}
	out := make([]Tenant, 0, len(members))
	seen := map[string]bool{}
	for _, m := range members {
		id, ok := CanonicalTenant(m.Key)
		var label string
		if !ok || seen[id] || json.Unmarshal(m.Value, &label) != nil || !ValidLabel(label) {
			return nil, false
		}
		seen[id] = true
		out = append(out, Tenant{ID: id, Label: label})
	}
	return out, true
}

// TenantsValue is the canonical member value for a list. Labels are not
// HTML-escaped, so a full list of the longest labels stays within the file.
func TenantsValue(list []Tenant) []byte {
	var b bytes.Buffer
	b.WriteByte('{')
	for i, t := range list {
		if i > 0 {
			b.WriteByte(',')
		}
		key, _ := json.Marshal(t.ID)
		b.Write(key)
		b.WriteByte(':')
		var value bytes.Buffer
		enc := json.NewEncoder(&value)
		enc.SetEscapeHTML(false)
		_ = enc.Encode(t.Label)
		b.Write(bytes.TrimSuffix(value.Bytes(), []byte("\n")))
	}
	b.WriteByte('}')
	return b.Bytes()
}

// SetTenant relabels the tenant where it is, or appends it, so an
// organisation keeps its place; false when the list is full.
func SetTenant(list []Tenant, t Tenant) ([]Tenant, bool) {
	out := append([]Tenant{}, list...)
	for i := range out {
		if out[i].ID == t.ID {
			out[i].Label = t.Label
			return out, true
		}
	}
	if len(out) >= MaxTenants {
		return nil, false
	}
	return append(out, t), true
}

// RemoveTenant drops the tenant; the list is unchanged when it is absent.
func RemoveTenant(list []Tenant, id string) []Tenant {
	out := make([]Tenant, 0, len(list))
	for _, t := range list {
		if t.ID != id {
			out = append(out, t)
		}
	}
	return out
}
