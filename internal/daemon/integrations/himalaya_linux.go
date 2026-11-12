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

// himalaya is generic IMAP mail with an app password (any provider: a university mailbox,
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

func (*himalaya) Tools() []string          { return []string{"himalaya"} }
func (h *himalaya) Available(env Env) bool { return MissingTools(h, env) == nil }

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
	if a.AppleID != "" {
		fmt.Fprintf(&b, "%s%s\n", appleIDComment, a.AppleID)
	}
	fmt.Fprintf(&b, "[accounts.%s]\n", tomlString(a.Address))
	b.WriteString("default = true\n")
	fmt.Fprintf(&b, "email = %s\n", tomlString(a.Address))
	fmt.Fprintf(&b, "imap.server = %s\n", tomlString(server))
	if a.Security == "starttls" {
		b.WriteString("imap.starttls = true\n")
	}
	fmt.Fprintf(&b, "imap.sasl.plain.username = %s\n", tomlString(a.Username))
	fmt.Fprintf(&b, "imap.sasl.plain.password.raw = %s\n", tomlString(a.Password))
	if a.SMTPServer != "" {
		scheme := "smtps"
		if a.SMTPSecurity == "starttls" {
			scheme = "smtp"
		}
		fmt.Fprintf(&b, "smtp.server = %s\n", tomlString(fmt.Sprintf("%s://%s:%d", scheme, a.SMTPServer, a.SMTPPort)))
		if a.SMTPSecurity == "starttls" {
			b.WriteString("smtp.starttls = true\n")
		}
		user := a.Username
		if a.SMTPUsername != "" {
			user = a.SMTPUsername
		}
		fmt.Fprintf(&b, "smtp.sasl.plain.username = %s\n", tomlString(user))
		fmt.Fprintf(&b, "smtp.sasl.plain.password.raw = %s\n", tomlString(a.Password))
	}
	return []byte(b.String())
}

// parseHimalayaConfig reads back a file the catalog wrote. A file the person
// rewrote by hand is not guessed at.
func parseHimalayaConfig(address string, data []byte) (PasswordAccount, bool) {
	a := PasswordAccount{Address: address, Security: "tls"}
	values := map[string]string{}
	for _, line := range strings.Split(string(data), "\n") {
		if id, ok := strings.CutPrefix(line, appleIDComment); ok && ValidAddress(id) {
			a.AppleID = id
			continue
		}
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "[accounts.") || line == "default = true" {
			continue
		}
		k, v, ok := strings.Cut(line, " = ")
		if !ok {
			return a, false
		}
		if k == "smtp.starttls" && v == "true" {
			a.SMTPSecurity = "starttls"
			continue
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
	if smtp := values["smtp.server"]; smtp != "" {
		scheme := "smtps://"
		if a.SMTPSecurity == "starttls" {
			scheme = "smtp://"
		} else {
			a.SMTPSecurity = "tls"
		}
		host, port, ok := strings.Cut(strings.TrimPrefix(smtp, scheme), ":")
		n, err := strconv.Atoi(port)
		if !strings.HasPrefix(smtp, scheme) || !ok || err != nil || n < 1 || n > 65535 || !hostPattern.MatchString(host) || values["smtp.sasl.plain.username"] == "" || values["smtp.sasl.plain.password.raw"] != a.Password {
			return a, false
		}
		a.SMTPServer, a.SMTPPort = host, n
		if u := values["smtp.sasl.plain.username"]; u != a.Username {
			a.SMTPUsername = u
		}
	}
	return a, a.Username != "" && a.Password != ""
}

func printableCredential(s string, max int) bool {
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

func validPasswordAccount(a PasswordAccount) bool {
	smtpOK := a.SMTPServer == "" && a.SMTPPort == 0 && a.SMTPSecurity == "" && a.SMTPUsername == "" ||
		len(a.SMTPServer) <= 253 && hostPattern.MatchString(a.SMTPServer) && a.SMTPPort > 0 && a.SMTPPort <= 65535 && (a.SMTPSecurity == "tls" || a.SMTPSecurity == "starttls") &&
			(a.SMTPUsername == "" || printableCredential(a.SMTPUsername, 254))
	return smtpOK && (a.AppleID == "" || ValidAddress(a.AppleID)) && a.URL == "" && ValidAddress(a.Address) && len(a.Server) <= 253 && hostPattern.MatchString(a.Server) && a.Port >= 1 && a.Port <= 65535 &&
		(a.Security == "tls" || a.Security == "starttls") && printableCredential(a.Username, 254) && printableCredential(a.Password, 1024)
}

func (*himalaya) ValidAccount(a PasswordAccount) bool { return validPasswordAccount(a) }

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

// read returns the account the catalog wrote, password included. Only the
// daemon, as the person, reads it; it never leaves the daemon.
func (h *himalaya) read(env Env, address string) (PasswordAccount, error) {
	dir, err := openHomeDir(env.Home, false, splitPath(himalayaDir)...)
	if errors.Is(err, os.ErrNotExist) {
		return PasswordAccount{}, AccountMissing
	}
	if err != nil {
		return PasswordAccount{}, err
	}
	defer unix.Close(dir)
	data, err := readFileAt(dir, address+".toml", 16384)
	if errors.Is(err, unix.ENOENT) {
		return PasswordAccount{}, AccountMissing
	}
	if err != nil {
		return PasswordAccount{}, err
	}
	a, ok := parseHimalayaConfig(address, data)
	if !ok {
		return PasswordAccount{}, ToolFailed
	}
	return a, nil
}

func (h *himalaya) ChangePassword(ctx context.Context, env Env, address, password string) error {
	a, err := h.read(env, address)
	if err != nil {
		return err
	}
	dir, err := openHomeDir(env.Home, false, splitPath(himalayaDir)...)
	if err != nil {
		return err
	}
	defer unix.Close(dir)
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
	path := procPath(env.Home, splitPath(himalayaDir)...) + "/" + staged
	state := h.checkFile(ctx, env, path, a.Address)
	if state == StateOK && a.SMTPServer != "" {
		state = h.checkBackend(ctx, env, path, a.Address, "smtp")
	}
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
		path := procPath(env.Home, splitPath(himalayaDir)...) + "/" + address + ".toml"
		state = h.checkFile(ctx, env, path, address)
		dir, err := openHomeDir(env.Home, false, splitPath(himalayaDir)...)
		if err == nil {
			data, err := readFileAt(dir, address+".toml", 16384)
			unix.Close(dir)
			if a, ok := parseHimalayaConfig(address, data); err == nil && ok && a.SMTPServer != "" && state == StateOK {
				state = h.checkBackend(ctx, env, path, address, "smtp")
			}
		}
	}
	return []Service{{ID: "mail", State: state}}
}

// checkFile signs in with himalaya's own account check. Its JSON names each
// backend and whether it answered; the reason is classified here and never
// forwarded, since it is native text.
func (h *himalaya) checkFile(ctx context.Context, env Env, path, address string) ServiceState {
	return h.checkBackend(ctx, env, path, address, "imap")
}

func (h *himalaya) checkBackend(ctx context.Context, env Env, path, address, backend string) ServiceState {
	tool, ok := env.Tool("himalaya")
	if !ok {
		return StateUnknown
	}
	out, err := env.run(ctx, Command{Path: tool, Args: []string{"--config", path, "--account", address, "--log-level", "off", "account", "check", "--backend", backend, "--json"}}, nil)
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
	if err != nil || json.Unmarshal(out, &report) != nil || len(report.Backends) != 1 || report.Backends[0].Backend != backend {
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
		Label: "mail (IMAP / SMTP)",
		Kinds: []string{"mail"},
		Body: fmt.Sprintf(`Mail over IMAP with himalaya. Every command names the account's own
configuration file, which also holds its password:

    %[1]s envelope list            # newest first; -m <mailbox>, -p <page>
    %[1]s envelope search …        # see envelope search --help
    %[1]s message read <id>
    %[1]s mailbox list             # names the Drafts and Archive mailboxes

A reply or a new message is saved as a draft with
`+"`%[1]s message compose --to … --subject … --body … --save <Drafts mailbox>`"+`.
The same command with `+"`--send`"+` in place of `+"`--save <Drafts mailbox>`"+` sends
it, which works only when the account has SMTP configured; without SMTP the person sends
drafts from their own mail client. `+"`account check --backend smtp --json`"+`
tells whether SMTP works without sending anything, so a test message is never
needed.`, cmd),
	}
}
