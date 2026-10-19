//go:build linux

package integrations

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/sys/unix"
)

// himalaya is generic IMAP mail with an app password (any provider: iki.fi,
// Nextcloud, Fastmail). Each account is its own configuration file under a
// catalog-owned directory, so the person's own ~/.config/himalaya/config.toml
// is never edited; the file holds the password, as himalaya's own store, and
// its name is the account's address.
type himalaya struct{}

// himalayaDir holds the catalog's account files below the home.
const himalayaDir = ".config/himalaya/open-habitat"

func (*himalaya) Provider() Provider { return IMAP }
func (*himalaya) Login() LoginKind   { return AppPassword }
func (*himalaya) Services() []string { return []string{"mail"} }

func (*himalaya) Available(env Env) bool {
	_, ok := env.Tool("himalaya")
	return ok
}

func (*himalaya) Accounts(env Env) ([]string, error) {
	names, dir, err := listHomeDir(env.Home, himalayaDir)
	if err != nil || dir < 0 {
		return nil, err
	}
	defer unix.Close(dir)
	var out []string
	for _, n := range names {
		if a, ok := strings.CutSuffix(n, ".toml"); ok && ValidAddress(a) {
			var st unix.Stat_t
			if unix.Fstatat(dir, n, &st, unix.AT_SYMLINK_NOFOLLOW) == nil && st.Mode&unix.S_IFMT == unix.S_IFREG {
				out = append(out, a)
			}
		}
	}
	return out, nil
}

var hostPattern = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$`)

// tomlString quotes s as a TOML basic string. Only printable text reaches
// here, but quoting is complete anyway: a password must never be able to end
// its string and add configuration.
func tomlString(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch {
		case r == '"':
			b.WriteString(`\"`)
		case r == '\\':
			b.WriteString(`\\`)
		case r < 0x20 || r == 0x7f:
			fmt.Fprintf(&b, `\u%04X`, r)
		default:
			b.WriteRune(r)
		}
	}
	b.WriteByte('"')
	return b.String()
}

// tomlUnquote reverses tomlString for the lines the catalog wrote itself.
func tomlUnquote(s string) (string, bool) {
	if len(s) < 2 || s[0] != '"' || s[len(s)-1] != '"' {
		return "", false
	}
	var b strings.Builder
	in := s[1 : len(s)-1]
	for i := 0; i < len(in); i++ {
		c := in[i]
		if c == '"' {
			return "", false
		}
		if c != '\\' {
			b.WriteByte(c)
			continue
		}
		if i+1 >= len(in) {
			return "", false
		}
		i++
		switch in[i] {
		case '"', '\\':
			b.WriteByte(in[i])
		case 'u':
			if i+4 >= len(in) {
				return "", false
			}
			n, err := strconv.ParseUint(in[i+1:i+5], 16, 32)
			if err != nil {
				return "", false
			}
			b.WriteRune(rune(n))
			i += 4
		default:
			return "", false
		}
	}
	return b.String(), true
}

func himalayaConfig(a PasswordAccount) []byte {
	server := fmt.Sprintf("imaps://%s:%d", a.Server, a.Port)
	if a.Security == "starttls" {
		server = fmt.Sprintf("imap://%s:%d", a.Server, a.Port)
	}
	var b strings.Builder
	fmt.Fprintf(&b, "# Written by open-habitat for %s. Removing the account in\n# Asetukset › Integraatiot deletes this file.\n", a.Address)
	fmt.Fprintf(&b, "[accounts.%s]\n", tomlString(a.Address))
	b.WriteString("default = true\n")
	fmt.Fprintf(&b, "email = %s\n", tomlString(a.Address))
	fmt.Fprintf(&b, "imap.server = %s\n", tomlString(server))
	if a.Security == "starttls" {
		b.WriteString("imap.starttls = true\n")
	}
	fmt.Fprintf(&b, "imap.sasl.plain.username = %s\n", tomlString(a.Username))
	fmt.Fprintf(&b, "imap.sasl.plain.password.raw = %s\n", tomlString(a.Password))
	return []byte(b.String())
}

// parseHimalayaConfig reads back a file the catalog wrote. A file the person
// rewrote by hand is not guessed at.
func parseHimalayaConfig(address string, data []byte) (PasswordAccount, bool) {
	a := PasswordAccount{Address: address, Security: "tls"}
	values := map[string]string{}
	for _, line := range strings.Split(string(data), "\n") {
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "[accounts.") || line == "default = true" {
			continue
		}
		k, v, ok := strings.Cut(line, " = ")
		if !ok {
			return a, false
		}
		if k == "imap.starttls" && v == "true" {
			a.Security = "starttls"
			continue
		}
		s, ok := tomlUnquote(v)
		if !ok {
			return a, false
		}
		values[k] = s
	}
	server := values["imap.server"]
	scheme := "imaps://"
	if a.Security == "starttls" {
		scheme = "imap://"
	}
	host, port, ok := strings.Cut(strings.TrimPrefix(server, scheme), ":")
	n, err := strconv.Atoi(port)
	if !strings.HasPrefix(server, scheme) || !ok || err != nil || n < 1 || n > 65535 || !hostPattern.MatchString(host) {
		return a, false
	}
	a.Server, a.Port = host, n
	a.Username, a.Password = values["imap.sasl.plain.username"], values["imap.sasl.plain.password.raw"]
	return a, a.Username != "" && a.Password != ""
}

func validPasswordAccount(a PasswordAccount) bool {
	printable := func(s string, max int) bool {
		if s == "" || len(s) > max {
			return false
		}
		for _, r := range s {
			if r < 0x20 || r == 0x7f {
				return false
			}
		}
		return true
	}
	return ValidAddress(a.Address) && len(a.Server) <= 253 && hostPattern.MatchString(a.Server) && a.Port >= 1 && a.Port <= 65535 &&
		(a.Security == "tls" || a.Security == "starttls") && printable(a.Username, 254) && printable(a.Password, 1024)
}

func (h *himalaya) Connect(ctx context.Context, env Env, a PasswordAccount) error {
	if !validPasswordAccount(a) {
		return errors.New("invalid account")
	}
	dir, err := openHomeDir(env.Home, true, splitPath(himalayaDir)...)
	if err != nil {
		return err
	}
	defer unix.Close(dir)
	var st unix.Stat_t
	if unix.Fstatat(dir, a.Address+".toml", &st, unix.AT_SYMLINK_NOFOLLOW) == nil {
		return AccountExists
	}
	return h.install(ctx, env, dir, a, false)
}

func (h *himalaya) ChangePassword(ctx context.Context, env Env, address, password string) error {
	dir, err := openHomeDir(env.Home, false, splitPath(himalayaDir)...)
	if errors.Is(err, os.ErrNotExist) {
		return AccountMissing
	}
	if err != nil {
		return err
	}
	defer unix.Close(dir)
	data, err := readFileAt(dir, address+".toml", 16384)
	if errors.Is(err, unix.ENOENT) {
		return AccountMissing
	}
	if err != nil {
		return err
	}
	a, ok := parseHimalayaConfig(address, data)
	if !ok {
		return ToolFailed
	}
	a.Password = password
	if !validPasswordAccount(a) {
		return errors.New("invalid account")
	}
	return h.install(ctx, env, dir, a, true)
}

// install writes the account beside its final name, lets himalaya sign in
// with it, and only then puts it in place. A rejected password or an
// unreachable server leaves nothing behind, and a new password replaces the
// old one only once it works.
func (h *himalaya) install(ctx context.Context, env Env, dir int, a PasswordAccount, replace bool) error {
	staged := "." + a.Address + ".toml.new"
	_ = unix.Unlinkat(dir, staged, 0)
	if err := writeNewFileAt(dir, staged, himalayaConfig(a), 0o600); err != nil {
		return err
	}
	state := h.checkFile(ctx, env, procPath(env.Home, splitPath(himalayaDir)...)+"/"+staged, a.Address)
	if state != StateOK {
		_ = unix.Unlinkat(dir, staged, 0)
		if state == StateCredentialsRejected {
			return CredentialsRejected
		}
		return ServerUnreachable
	}
	if !replace {
		// Never replace an account that appeared meanwhile.
		if err := unix.Linkat(dir, staged, dir, a.Address+".toml", 0); err != nil {
			_ = unix.Unlinkat(dir, staged, 0)
			if errors.Is(err, unix.EEXIST) {
				return AccountExists
			}
			return err
		}
		_ = unix.Unlinkat(dir, staged, 0)
		return unix.Fsync(dir)
	}
	if err := unix.Renameat(dir, staged, dir, a.Address+".toml"); err != nil {
		_ = unix.Unlinkat(dir, staged, 0)
		return err
	}
	return unix.Fsync(dir)
}

func (h *himalaya) Check(ctx context.Context, env Env, address string) []Service {
	state := StateUnknown
	if _, ok := env.Tool("himalaya"); ok {
		state = h.checkFile(ctx, env, procPath(env.Home, splitPath(himalayaDir)...)+"/"+address+".toml", address)
	}
	return []Service{{ID: "mail", State: state}}
}

// checkFile signs in with himalaya's own account check. Its JSON names each
// backend and whether it answered; the reason is classified here and never
// forwarded, since it is native text.
func (h *himalaya) checkFile(ctx context.Context, env Env, path, address string) ServiceState {
	tool, ok := env.Tool("himalaya")
	if !ok {
		return StateUnknown
	}
	out, err := env.run(ctx, Command{Path: tool, Args: []string{"--config", path, "--account", address, "--log-level", "off", "account", "check", "--backend", "imap", "--json"}}, nil)
	var report struct {
		Backends []struct {
			Backend string  `json:"backend"`
			OK      bool    `json:"ok"`
			Error   *string `json:"error"`
		} `json:"backends"`
	}
	if ctx.Err() != nil {
		return StateUnreachable
	}
	if err != nil || json.Unmarshal(out, &report) != nil || len(report.Backends) != 1 || report.Backends[0].Backend != "imap" {
		return StateUnknown
	}
	b := report.Backends[0]
	if b.OK {
		return StateOK
	}
	reason := ""
	if b.Error != nil {
		reason = strings.ToLower(*b.Error)
	}
	switch {
	case strings.Contains(reason, "authenticat") || strings.Contains(reason, "login") || strings.Contains(reason, "credential") || strings.Contains(reason, "password"):
		return StateCredentialsRejected
	case strings.Contains(reason, "connect") || strings.Contains(reason, "resolve") || strings.Contains(reason, "dns") || strings.Contains(reason, "timed out") || strings.Contains(reason, "tls") || strings.Contains(reason, "certificate") || strings.Contains(reason, "refused"):
		return StateUnreachable
	}
	return StateUnknown
}

func (h *himalaya) Remove(ctx context.Context, env Env, address string) error {
	dir, err := openHomeDir(env.Home, false, splitPath(himalayaDir)...)
	if errors.Is(err, os.ErrNotExist) {
		return AccountMissing
	}
	if err != nil {
		return err
	}
	defer unix.Close(dir)
	if err := unix.Unlinkat(dir, address+".toml", 0); err != nil {
		if errors.Is(err, unix.ENOENT) {
			return AccountMissing
		}
		return err
	}
	return unix.Fsync(dir)
}

func (h *himalaya) Skill(env Env, address string) SkillAccount {
	tool, _ := env.Tool("himalaya")
	if tool == "" {
		tool = "himalaya"
	}
	cmd := fmt.Sprintf("%s -c ~/%s/%s.toml", tool, himalayaDir, address)
	return SkillAccount{
		Label: "mail (IMAP)",
		Kinds: []string{"mail"},
		Body: fmt.Sprintf(`Mail over IMAP with himalaya. Every command names the account's own
configuration file, which also holds its password:

    %[1]s envelope list            # newest first; -m <mailbox>, -p <page>
    %[1]s envelope search …        # see envelope search --help
    %[1]s message read <id>
    %[1]s mailbox list             # find the Drafts and Archive mailboxes

To prepare a reply or a new message, save it as a draft without sending:
`+"`%[1]s message compose --to … --subject … --body … --save <Drafts mailbox>`"+`
(no `+"`--send`"+`). This account has no SMTP server configured, so nothing can
be sent from here; the person sends drafts from their own mail client.`, cmd),
	}
}
