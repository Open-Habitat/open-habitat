package nativegitea

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"regexp"
	"strconv"
	"strings"

	"go.yaml.in/yaml/v3"
)

// Kind says how this adapter may use a tea login.
type Kind string

const (
	// KindPAT is a token login with a canonical HTTPS URL and a user.
	KindPAT Kind = "pat"
	// KindOAuth logins keep their token in tea's credential store; this
	// connector does not import or refresh them.
	KindOAuth Kind = "oauth"
	// KindSSH logins have no HTTPS token.
	KindSSH Kind = "ssh"
	// KindInsecure logins skip TLS verification in tea; never used here.
	KindInsecure Kind = "insecure"
	// KindInvalid logins have an address, user or token this adapter
	// cannot interpret safely.
	KindInvalid Kind = "invalid"
)

// Login is the token-free projection of one tea entry.
type Login struct {
	Name string
	// URL is the canonical base URL, and Base its parts, only when tea's url
	// field is a valid HTTPS address; otherwise both are empty, because an
	// invalid url may carry userinfo or a query.
	URL     string
	Base    Base
	User    string
	Default bool
	Kind    Kind
	// Owned is set for a login this adapter created; OwnedID is the Gitea
	// user ID its name carries.
	Owned   bool
	OwnedID int64
	// Ambiguous is set when another entry has the same name or the same
	// base and user. Such entries are never selected.
	Ambiguous bool
}

// Usable reports whether the login may supply a credential.
func (l Login) Usable() bool { return l.Kind == KindPAT && !l.Ambiguous }

// ConnectionID is a stable browser-facing identity derived from the native
// name, canonical base and user. It carries no token material.
func (l Login) ConnectionID() string {
	sum := sha256.Sum256([]byte(strings.ToLower(l.Name) + "\x00" + l.Base.String() + "\x00" + strings.ToLower(l.User)))
	return "gitea_" + hex.EncodeToString(sum[:12])
}

// Target names an entry for a mutation together with the identity the
// caller observed, so a changed entry is refused rather than edited.
type Target struct {
	Name string
	Base Base
	User string
}

// Target returns the mutation target for l.
func (l Login) Target() Target { return Target{Name: l.Name, Base: l.Base, User: l.User} }

// OwnedName is the tea login name for an account this adapter connects:
// canonical-base digest plus Gitea's user ID.
func OwnedName(b Base, id int64) string {
	return "habitat-" + b.Digest() + "-" + strconv.FormatInt(id, 10)
}

var ownedName = regexp.MustCompile(`^habitat-([0-9a-f]{12})-([1-9][0-9]{0,18})$`)

// teaLogin mirrors tea v0.16.0 config.Login's YAML fields, in tea's order,
// so a created entry is what tea itself would write.
type teaLogin struct {
	Name              string `yaml:"name"`
	URL               string `yaml:"url"`
	Token             string `yaml:"token,omitempty"`
	Default           bool   `yaml:"default"`
	SSHHost           string `yaml:"ssh_host"`
	SSHKey            string `yaml:"ssh_key"`
	Insecure          bool   `yaml:"insecure"`
	SSHCertPrincipal  string `yaml:"ssh_certificate_principal"`
	SSHAgent          bool   `yaml:"ssh_agent"`
	SSHKeyFingerprint string `yaml:"ssh_key_agent_pub"`
	VersionCheck      bool   `yaml:"version_check"`
	User              string `yaml:"user"`
	Created           int64  `yaml:"created"`
	AuthMethod        string `yaml:"auth_method,omitempty"`
	RefreshToken      string `yaml:"refresh_token,omitempty"`
	TokenExpiry       int64  `yaml:"token_expiry,omitempty"`
}

// teaConfig mirrors tea's LocalConfig. Decoding into it is how we know tea
// itself would accept the file.
type teaConfig struct {
	Logins []teaLogin `yaml:"logins"`
	Prefs  struct {
		Editor       bool `yaml:"editor"`
		FlagDefaults struct {
			Remote string `yaml:"remote"`
		} `yaml:"flag_defaults"`
	} `yaml:"preferences"`
}

type entry struct {
	Login
	token string
	node  *yaml.Node
}

type document struct {
	root    *yaml.Node // the document node, edited in place to preserve the rest
	logins  *yaml.Node // the logins sequence, nil when absent or null
	entries []entry
}

// parseDocument interprets tea's file. Anything tea would reject, anything
// that could read two ways (duplicate keys, several documents, aliases), and
// an empty file (what tea's truncating writer leaves after a crash) is
// ErrUnavailable: never an empty catalog.
func parseDocument(data []byte) (*document, error) {
	if len(bytes.TrimSpace(data)) == 0 {
		return nil, ErrUnavailable
	}
	var cfg teaConfig
	if yaml.Unmarshal(data, &cfg) != nil {
		return nil, ErrUnavailable
	}
	dec := yaml.NewDecoder(bytes.NewReader(data))
	var root yaml.Node
	if dec.Decode(&root) != nil {
		return nil, ErrUnavailable
	}
	var extra yaml.Node
	if err := dec.Decode(&extra); !errors.Is(err, io.EOF) {
		return nil, ErrUnavailable
	}
	if root.Kind != yaml.DocumentNode || len(root.Content) != 1 || root.Content[0].Kind != yaml.MappingNode || hasAlias(&root) {
		return nil, ErrUnavailable
	}
	doc := &document{root: &root}
	top := root.Content[0]
	for i := 0; i+1 < len(top.Content); i += 2 {
		if top.Content[i].Value != "logins" {
			continue
		}
		v := top.Content[i+1]
		switch {
		case v.Kind == yaml.ScalarNode && v.Tag == "!!null":
		case v.Kind == yaml.SequenceNode:
			doc.logins = v
		default:
			return nil, ErrUnavailable
		}
	}
	if doc.logins != nil && len(doc.logins.Content) != len(cfg.Logins) {
		return nil, ErrUnavailable
	}
	if doc.logins != nil {
		for i, n := range doc.logins.Content {
			if n.Kind != yaml.MappingNode {
				return nil, ErrUnavailable
			}
			doc.entries = append(doc.entries, classify(cfg.Logins[i], n))
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

func classify(t teaLogin, n *yaml.Node) entry {
	e := entry{Login: Login{Name: t.Name, User: t.User, Default: t.Default}, token: t.Token, node: n}
	base, err := ParseBase(t.URL)
	// tea stores what the person typed after its own normalisation; an
	// explicit https:// URL that ParseBase accepts has exactly one meaning.
	canonical := err == nil && len(t.URL) > 8 && strings.EqualFold(t.URL[:8], "https://")
	switch {
	case t.AuthMethod != "" || t.RefreshToken != "":
		e.Kind = KindOAuth
	case t.Insecure:
		e.Kind = KindInsecure
	case t.Token == "" && (t.SSHKey != "" || t.SSHAgent || t.SSHCertPrincipal != ""):
		e.Kind = KindSSH
	case !canonical || !validToken(t.Token) || !giteaLogin.MatchString(t.User) || t.Name == "":
		e.Kind = KindInvalid
	default:
		e.Kind = KindPAT
	}
	if canonical {
		e.Base, e.URL = base, base.String()
	}
	if m := ownedName.FindStringSubmatch(t.Name); m != nil && canonical && m[1] == base.Digest() {
		if id, err := strconv.ParseInt(m[2], 10, 64); err == nil {
			e.Owned, e.OwnedID = true, id
		}
	}
	e.token = t.Token
	return e
}

// markAmbiguous flags duplicated names (tea compares them case-insensitively)
// and duplicated base+user accounts. tea itself would pick the first; we pick
// neither.
func markAmbiguous(es []entry) {
	for i := range es {
		for j := range es {
			if i == j {
				continue
			}
			if strings.EqualFold(es[i].Name, es[j].Name) || sameAccount(es[i].Login, es[j].Login) {
				es[i].Ambiguous = true
			}
		}
	}
}

func sameAccount(a, b Login) bool {
	return a.Base.Valid() && a.Base == b.Base && a.User != "" && strings.EqualFold(a.User, b.User)
}

func (d *document) projection() []Login {
	out := make([]Login, 0, len(d.entries))
	for _, e := range d.entries {
		out = append(out, e.Login)
	}
	return out
}

// byName returns the single entry named name, ErrAmbiguous for duplicates
// and ErrNotFound when there is none.
func (d *document) byName(name string) (*entry, error) {
	var found *entry
	for i := range d.entries {
		if strings.EqualFold(d.entries[i].Name, name) {
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

// encode serialises the edited node tree the way tea's yaml.Marshal does.
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

// newDocument is the document for a file that does not exist yet.
func newDocument() *document {
	top := &yaml.Node{Kind: yaml.MappingNode, Tag: "!!map"}
	return &document{root: &yaml.Node{Kind: yaml.DocumentNode, Content: []*yaml.Node{top}}}
}

func (d *document) append(l teaLogin) error {
	var n yaml.Node
	if err := n.Encode(l); err != nil {
		return err
	}
	if d.logins == nil {
		top := d.root.Content[0]
		seq := &yaml.Node{Kind: yaml.SequenceNode, Tag: "!!seq"}
		replaced := false
		for i := 0; i+1 < len(top.Content); i += 2 {
			if top.Content[i].Value == "logins" {
				top.Content[i+1] = seq
				replaced = true
			}
		}
		if !replaced {
			// tea writes logins first; keep that order for a new key.
			key := &yaml.Node{Kind: yaml.ScalarNode, Tag: "!!str", Value: "logins"}
			top.Content = append([]*yaml.Node{key, seq}, top.Content...)
		}
		d.logins = seq
	}
	d.logins.Content = append(d.logins.Content, &n)
	return nil
}

func (d *document) remove(e *entry) {
	out := d.logins.Content[:0]
	for _, n := range d.logins.Content {
		if n != e.node {
			out = append(out, n)
		}
	}
	d.logins.Content = out
}

// setToken changes only the token scalar of e's mapping.
func (e *entry) setToken(token string) bool {
	for i := 0; i+1 < len(e.node.Content); i += 2 {
		if e.node.Content[i].Value == "token" && e.node.Content[i+1].Kind == yaml.ScalarNode {
			v := e.node.Content[i+1]
			v.Value, v.Tag, v.Style = token, "!!str", 0
			return true
		}
	}
	return false
}
