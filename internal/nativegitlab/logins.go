package nativegitlab

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"regexp"
	"strconv"
	"strings"

	"github.com/Open-Habitat/open-habitat/internal/nativeforge"
	"go.yaml.in/yaml/v3"
)

// Kind says how this adapter may use a glab host entry.
type Kind string

const (
	// KindPAT is a token in glab's file for an HTTPS server, with a user.
	KindPAT Kind = "pat"
	// KindOAuth entries are glab's OAuth logins: their token expires and only
	// glab refreshes it, so the adapter never uses or rewrites them.
	KindOAuth Kind = "oauth"
	// KindKeyring entries keep their token in the operating system's
	// keyring, which the adapter never reads.
	KindKeyring Kind = "keyring"
	// KindInsecure entries tell glab to bypass a rule the adapter keeps:
	// skip or replace TLS verification, use a proxy, add headers, or speak
	// plain HTTP.
	KindInsecure Kind = "insecure"
	// KindInvalid entries have a server, API host, user or token this
	// adapter cannot interpret safely (a CI job token included).
	KindInvalid Kind = "invalid"
)

// Login is the token-free projection of one signed-in glab host entry.
type Login struct {
	// Key is glab's hosts key, host or host:port.
	Key string
	// URL is the canonical base URL, and Base its parts, only when the key
	// and subfolder are a valid HTTPS server; otherwise both are empty.
	URL  string
	Base Base
	User string
	Kind Kind
	// Ambiguous is set when another entry names the same server. glab
	// would use the one whose key matches exactly; neither is used here.
	Ambiguous bool
}

// Usable reports whether the login may supply a credential.
func (l Login) Usable() bool { return l.Kind == KindPAT && !l.Ambiguous && l.URL != "" }

// ConnectionID is a stable browser-facing identity derived from the native
// key, canonical base and user. It carries no token material.
func (l Login) ConnectionID() string {
	sum := sha256.Sum256([]byte(l.Key + "\x00" + l.Base.String() + "\x00" + strings.ToLower(l.User)))
	return "gitlab_" + hex.EncodeToString(sum[:12])
}

// Target names an entry for a mutation together with the identity the
// caller observed, so a changed entry is refused rather than edited.
type Target struct {
	Key  string
	Base Base
	User string
}

// Target returns the mutation target for l.
func (l Login) Target() Target { return Target{Key: l.Key, Base: l.Base, User: l.User} }

// gitlabUser is a GitLab username as /user and glab spell it.
var gitlabUser = regexp.MustCompile(`^[A-Za-z0-9_][A-Za-z0-9_.-]{0,254}$`)

// aliasKeys are older spellings glab still resolves; an entry using one is
// not interpreted, because the adapter and glab could read it differently.
var aliasKeys = []string{"gitlab_token", "oauth_token", "gitlab_api_host", "gitlab_subfolder", "gitlab_ssh_host"}

type entry struct {
	Login
	token string
	// signedIn: glab holds some credential for this host. An entry without
	// one (glab's blank gitlab.com seed, or one logged out) is no
	// connection and may be filled.
	signedIn bool
	key      *yaml.Node
	node     *yaml.Node // the host mapping, nil when its value is not one
	fields   map[string]string
}

type document struct {
	root    *yaml.Node
	top     *yaml.Node
	hosts   *yaml.Node // the hosts mapping, nil when absent or null
	entries []entry
}

func truthy(v string) bool {
	if v == "" {
		return false
	}
	b, err := strconv.ParseBool(v)
	return err != nil || b
}

// parseDocument interprets glab's file. Anything that could read two ways
// (several documents, aliases, a repeated top-level key, a hosts value that
// is not a mapping) is ErrUnavailable: never an empty catalog. An empty
// file is glab's empty configuration: glab writes atomically and treats one
// as such.
func parseDocument(data []byte) (*document, error) {
	if len(bytes.TrimSpace(data)) == 0 {
		return newDocument(), nil
	}
	dec := yaml.NewDecoder(bytes.NewReader(data))
	var root yaml.Node
	if err := dec.Decode(&root); errors.Is(err, io.EOF) {
		// Only comments: glab reads an empty configuration.
		return newDocument(), nil
	} else if err != nil {
		return nil, ErrUnavailable
	}
	var extra yaml.Node
	if err := dec.Decode(&extra); !errors.Is(err, io.EOF) {
		return nil, ErrUnavailable
	}
	if root.Kind != yaml.DocumentNode || len(root.Content) != 1 || hasAlias(&root) {
		return nil, ErrUnavailable
	}
	top := root.Content[0]
	if top.Kind == yaml.ScalarNode && top.Tag == "!!null" {
		top = &yaml.Node{Kind: yaml.MappingNode, Tag: "!!map"}
		root.Content[0] = top
	}
	if top.Kind != yaml.MappingNode {
		return nil, ErrUnavailable
	}
	doc := &document{root: &root, top: top}
	seen := map[string]bool{}
	for i := 0; i+1 < len(top.Content); i += 2 {
		k := top.Content[i]
		if k.Kind != yaml.ScalarNode || seen[k.Value] {
			return nil, ErrUnavailable
		}
		seen[k.Value] = true
		if k.Value != "hosts" {
			continue
		}
		v := top.Content[i+1]
		switch {
		case v.Kind == yaml.ScalarNode && v.Tag == "!!null":
		case v.Kind == yaml.MappingNode:
			doc.hosts = v
		default:
			return nil, ErrUnavailable
		}
	}
	if doc.hosts != nil {
		for i := 0; i+1 < len(doc.hosts.Content); i += 2 {
			k, v := doc.hosts.Content[i], doc.hosts.Content[i+1]
			if k.Kind != yaml.ScalarNode {
				return nil, ErrUnavailable
			}
			doc.entries = append(doc.entries, classify(k, v))
		}
	}
	markAmbiguous(doc.entries)
	return doc, nil
}

func hasAlias(n *yaml.Node) bool {
	if n.Kind == yaml.AliasNode || n.Anchor != "" {
		return true
	}
	for _, c := range n.Content {
		if hasAlias(c) {
			return true
		}
	}
	return false
}

// classify reads one host entry. A value glab could read differently from
// how this adapter would (not a mapping, a repeated key, a nested value
// other than custom_headers' list) makes the entry invalid and, because what
// it holds is unknown, signed in: nothing fills or lends it.
func classify(k, v *yaml.Node) entry {
	e := entry{Login: Login{Key: k.Value, Kind: KindInvalid}, key: k, fields: map[string]string{}}
	host, port, okKey := nativeforge.ParseAuthority(k.Value)
	canonical := okKey && (Base{Host: host, Port: port}).Authority() == k.Value
	if okKey {
		e.Base = Base{Host: host, Port: port}
	}
	if v.Kind == yaml.ScalarNode && v.Tag == "!!null" {
		// An empty entry: nothing signed in.
		return e
	}
	if v.Kind != yaml.MappingNode {
		e.signedIn = true
		return e
	}
	e.node = v
	headers := 0
	for i := 0; i+1 < len(v.Content); i += 2 {
		fk, fv := v.Content[i], v.Content[i+1]
		if _, dup := e.fields[fk.Value]; dup || fk.Kind != yaml.ScalarNode {
			e.signedIn = true
			return e
		}
		switch {
		case fv.Kind == yaml.ScalarNode:
			value := fv.Value
			if fv.Tag == "!!null" {
				value = ""
			}
			e.fields[fk.Value] = value
		case fk.Value == "custom_headers" && fv.Kind == yaml.SequenceNode:
			e.fields[fk.Value] = ""
			headers = len(fv.Content)
		default:
			e.fields[fk.Value] = "\x00"
		}
	}
	f := e.fields
	odd := false
	for _, a := range aliasKeys {
		odd = odd || f[a] != ""
	}
	for _, value := range f {
		// A nested value we cannot read could hold anything.
		odd = odd || value == "\x00"
	}
	e.User, e.token = f["user"], f["token"]
	e.signedIn = f["token"] != "" || f["job_token"] != "" || f["use_keyring"] == "true" || truthy(f["is_oauth2"]) ||
		f["oauth2_refresh_token"] != "" || f["refresh_token"] != "" || odd
	path, okPath := subfolder(f["subfolder"])
	if canonical && okPath {
		e.Base.Path = path
		e.URL = e.Base.String()
	} else {
		e.URL = ""
	}
	switch {
	case f["use_keyring"] == "true":
		e.Kind = KindKeyring
	case truthy(f["is_oauth2"]) || f["oauth2_refresh_token"] != "" || f["refresh_token"] != "":
		e.Kind = KindOAuth
	case truthy(f["skip_tls_verify"]) || f["ca_cert"] != "" || f["client_cert"] != "" || f["client_key"] != "" || f["proxy"] != "" || headers > 0 ||
		(f["api_protocol"] != "" && f["api_protocol"] != "https"):
		e.Kind = KindInsecure
	case odd || f["job_token"] != "" || !canonical || !okPath || (f["api_host"] != "" && f["api_host"] != k.Value) ||
		!nativeforge.ValidToken(e.token) || !gitlabUser.MatchString(e.User):
		e.Kind = KindInvalid
	default:
		e.Kind = KindPAT
	}
	return e
}

// subfolder is glab's subfolder setting as a base path: glab trims the
// slashes, so "gitlab", "/gitlab" and "gitlab/" are one path.
func subfolder(s string) (string, bool) {
	s = strings.Trim(s, "/")
	if s == "" {
		return "", true
	}
	b, err := ParseBase("https://x.invalid/" + s)
	if err != nil {
		return "", false
	}
	return b.Path, true
}

// markAmbiguous flags entries that name one server twice. glab keys hosts by
// the exact string, so "gitlab.example" and "gitlab.example:443" are two
// entries to glab and one server to Git; neither is chosen.
func markAmbiguous(es []entry) {
	for i := range es {
		for j := range es {
			if i != j && es[i].Base.Valid() && es[i].Base.SameServer(es[j].Base) {
				es[i].Ambiguous = true
			}
		}
	}
}

// projection lists the signed-in entries; an entry without any credential is
// glab's own seed or a logout, not a connection.
func (d *document) projection() []Login {
	out := []Login{}
	for _, e := range d.entries {
		if e.signedIn {
			out = append(out, e.Login)
		}
	}
	return out
}

// byKey returns the entry whose key is key.
func (d *document) byKey(key string) (*entry, error) {
	var found *entry
	for i := range d.entries {
		if d.entries[i].Key == key {
			if found != nil {
				return nil, ErrAmbiguous
			}
			found = &d.entries[i]
		}
	}
	if found == nil {
		return nil, ErrNotFound
	}
	return found, nil
}

func (d *document) tokenUsed(token string, except *entry) bool {
	for i := range d.entries {
		if &d.entries[i] != except && d.entries[i].token == token {
			return true
		}
	}
	return false
}

// encode serialises the edited node tree the way glab's yaml.Marshal does.
func (d *document) encode() ([]byte, error) {
	var buf bytes.Buffer
	enc := yaml.NewEncoder(&buf)
	enc.SetIndent(4)
	if err := enc.Encode(d.root); err != nil {
		return nil, err
	}
	if err := enc.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// newDocument is the document for a file that does not exist yet, or is
// empty. Habitat writes only its hosts entry, none of glab's defaults.
func newDocument() *document {
	top := &yaml.Node{Kind: yaml.MappingNode, Tag: "!!map"}
	return &document{root: &yaml.Node{Kind: yaml.DocumentNode, Content: []*yaml.Node{top}}, top: top}
}

func str(v string) *yaml.Node { return &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: v} }

// hostEntry returns key's mapping in hosts, creating hosts and the mapping
// when needed (an existing null entry becomes a mapping).
func (d *document) hostEntry(key string) *yaml.Node {
	if d.hosts == nil {
		d.hosts = &yaml.Node{Kind: yaml.MappingNode, Tag: "!!map"}
		replaced := false
		for i := 0; i+1 < len(d.top.Content); i += 2 {
			if d.top.Content[i].Value == "hosts" {
				d.top.Content[i+1] = d.hosts
				replaced = true
			}
		}
		if !replaced {
			d.top.Content = append(d.top.Content, str("hosts"), d.hosts)
		}
	}
	for i := 0; i+1 < len(d.hosts.Content); i += 2 {
		if d.hosts.Content[i].Value == key {
			v := d.hosts.Content[i+1]
			if v.Kind != yaml.MappingNode {
				v = &yaml.Node{Kind: yaml.MappingNode, Tag: "!!map"}
				d.hosts.Content[i+1] = v
			}
			return v
		}
	}
	m := &yaml.Node{Kind: yaml.MappingNode, Tag: "!!map"}
	d.hosts.Content = append(d.hosts.Content, str(key), m)
	return m
}

// set changes one scalar of a host mapping, or appends it as glab's Set
// does.
func set(m *yaml.Node, key, value string) {
	for i := 0; i+1 < len(m.Content); i += 2 {
		if m.Content[i].Value == key {
			m.Content[i+1] = str(value)
			return
		}
	}
	m.Content = append(m.Content, str(key), str(value))
}

// unset removes one key of a host mapping, as glab's Set with "" does.
func unset(m *yaml.Node, key string) {
	out := m.Content[:0]
	for i := 0; i+1 < len(m.Content); i += 2 {
		if m.Content[i].Value != key {
			out = append(out, m.Content[i], m.Content[i+1])
		}
	}
	m.Content = out
}
