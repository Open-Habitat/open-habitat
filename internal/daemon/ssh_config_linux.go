//go:build linux

package daemon

import (
	"context"
	"errors"
	"io"
	"net/netip"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"

	"golang.org/x/sys/unix"
)

// SSHConfigFeature is the experimental switch that shows the hosts of the
// person's own ~/.ssh/config on Omat koneet. While it is off the daemon does
// not even read the file.
const SSHConfigFeature = "own-machines-ssh-config"

// The hosts of the person's own ~/.ssh/config, read as the person (prototype
// round 2026-11-22-omat-koneet-ssh-config, direction "Oma ryhmä"):
//
//   - Read only, with this parser and never with `ssh -G`: ssh runs a
//     `Match exec` command while it parses, and opening a page must have no
//     side effects. Habitat never writes ~/.ssh/config for this, nor
//     known_hosts, nor a key.
//   - Every concrete pattern of a Host line is one host. Its values are the
//     ones `ssh <alias>` uses: the first value wins over every block the alias
//     matches, wildcard blocks included. Match blocks are not interpreted,
//     so the page says values may differ where the file has one.
//   - What the person chose (shown or hidden) is only the alias in their
//     preferences; everything else is read again from the file every time,
//     so a host removed from the file leaves the page too.
//   - A check is the person's own `ssh <alias> exit 0`, made only when they
//     ask: it may raise a second factor, an alarm or a ProxyJump chain.

const (
	sshConfigFileLimit  = 1 << 20
	sshConfigMaxFiles   = 32
	sshConfigMaxDepth   = 16
	sshConfigMaxHosts   = 64
	sshConfigMaxSkipped = 32
	sshConfigMaxChosen  = 32
	sshConfigMaxKeys    = 8
	// sshConfigMaxCandidates bounds the names resolved: more than are
	// listed, as Git services and duplicates fall out.
	sshConfigMaxCandidates = 2 * sshConfigMaxHosts
)

// sshAliasPattern is a host the page can name and pass to ssh as one word,
// never one that reads as an option. Host patterns match case-sensitively,
// as in ssh, so the case is kept.
var sshAliasPattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$`)

// gitServices are code hosts, not machines; the code services settings own them.
var gitServices = map[string]bool{"github.com": true, "gitlab.com": true, "codeberg.org": true, "bitbucket.org": true, "ssh.dev.azure.com": true}

type sshConfigKey struct {
	Path string `json:"path"`
	// Present is absent when the path keeps a token known only on
	// connecting, so whether the file exists is not known.
	Present *bool `json:"present,omitempty"`
}

type sshConfigHost struct {
	Alias    string `json:"alias"`
	HostName string `json:"host_name"`
	User     string `json:"user"`
	Port     int    `json:"port"`
	// Keys are the IdentityFiles named for the host; empty is ssh's
	// default keys. Only whether each file exists is looked at.
	Keys      []sshConfigKey `json:"keys"`
	ProxyJump string         `json:"proxy_jump,omitempty"`
	// ProxyCommand only says one is set: its text may hold a token.
	ProxyCommand bool   `json:"proxy_command"`
	Tailscale    bool   `json:"tailscale"`
	File         string `json:"file"`
	Line         int    `json:"line"`
}

type sshConfigSkipped struct {
	What string `json:"what"`
	// Why: wildcard, match, git_service, name, unreadable, limit.
	Why string `json:"why"`
}

type sshConfigView struct {
	// State: ok (hosts found), empty (no file or no host), unreadable.
	State   string             `json:"state"`
	Files   []string           `json:"files"`
	Hosts   []sshConfigHost    `json:"hosts"`
	Skipped []sshConfigSkipped `json:"skipped"`
	// Match: the files have Match blocks, which are not interpreted.
	Match  bool     `json:"match"`
	Shown  []string `json:"shown"`
	Hidden []string `json:"hidden"`
}

type sshDirective struct {
	key  string
	args []string
}

// sshBlock is a run of directives that apply to a host matching every one
// of conds: a Host line's patterns, and those of the Host lines an Include
// is nested in. A Match block applies to nothing here.
type sshBlock struct {
	conds      [][]string
	match      bool
	directives []sshDirective
}

type sshCandidate struct {
	alias string
	file  string
	line  int
}

type sshConfigParser struct {
	home, username string
	files          []string
	blocks         []*sshBlock
	candidates     []sshCandidate
	skipped        []sshConfigSkipped
	match          bool
	unreadable     bool
	truncated      bool
	opened         int
}

// readSSHConfig parses home/.ssh/config as the person. username is the
// local user, ssh's default remote user.
func readSSHConfig(home, username string) sshConfigView {
	view, _ := parseSSHConfig(home, username)
	return view
}

func parseSSHConfig(home, username string) (sshConfigView, *sshConfigParser) {
	p := &sshConfigParser{home: home, username: username}
	view := sshConfigView{Files: []string{}, Hosts: []sshConfigHost{}, Skipped: []sshConfigSkipped{}, Shown: []string{}, Hidden: []string{}}
	exists := p.parseFile(filepath.Join(home, ".ssh", "config"), nil, false, 0)
	view.Files, view.Match = p.files, p.match
	if p.files == nil {
		view.Files = []string{}
	}
	if p.unreadable {
		view.State = "unreadable"
		return view, p
	}
	seen := map[string]bool{}
	for _, c := range p.candidates {
		if seen[c.alias] {
			continue
		}
		seen[c.alias] = true
		h, ok := p.resolve(c)
		if !ok {
			continue
		}
		if gitServices[strings.ToLower(h.Alias)] || gitServices[strings.ToLower(h.HostName)] {
			p.skip(h.Alias, "git_service")
			continue
		}
		if len(view.Hosts) == sshConfigMaxHosts {
			p.skip(h.Alias, "limit")
			continue
		}
		view.Hosts = append(view.Hosts, h)
	}
	view.Skipped = p.skipped
	if view.Skipped == nil {
		view.Skipped = []sshConfigSkipped{}
	}
	view.State = "empty"
	if exists && len(view.Hosts) > 0 {
		view.State = "ok"
	}
	return view, p
}

func (p *sshConfigParser) skip(what, why string) {
	if len(p.skipped) < sshConfigMaxSkipped {
		p.skipped = append(p.skipped, sshConfigSkipped{What: clip(what, 200), Why: why})
	}
}

// display names a file as the person knows it: ~/ for their home.
func (p *sshConfigParser) display(path string) string {
	if rel, err := filepath.Rel(p.home, path); err == nil && !strings.HasPrefix(rel, "..") {
		return "~/" + rel
	}
	return path
}

// readConfigFile reads one regular file of at most the limit. A link is
// followed: a dotfiles link is ordinary, and reading as the person reaches
// nothing their own ssh could not. O_NONBLOCK keeps a FIFO from hanging.
func readConfigFile(path string) ([]byte, error) {
	fd, err := unix.Open(path, unix.O_RDONLY|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, err
	}
	f := os.NewFile(uintptr(fd), path)
	defer f.Close()
	var st unix.Stat_t
	if err = unix.Fstat(fd, &st); err != nil {
		return nil, err
	}
	if st.Mode&unix.S_IFMT != unix.S_IFREG || st.Size > sshConfigFileLimit {
		return nil, errors.New("not a readable configuration file")
	}
	b, err := io.ReadAll(io.LimitReader(f, sshConfigFileLimit+1))
	if err != nil || len(b) > sshConfigFileLimit {
		return nil, errors.New("not a readable configuration file")
	}
	return b, nil
}

// parseFile reads one file in the context it is included in. It says
// whether the file exists.
func (p *sshConfigParser) parseFile(path string, conds [][]string, match bool, depth int) bool {
	shown := p.display(path)
	if p.opened >= sshConfigMaxFiles {
		p.skip("Include "+shown, "limit")
		return true
	}
	p.opened++
	b, err := readConfigFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return false
		}
		if depth == 0 {
			p.unreadable = true
		} else {
			p.skip("Include "+shown, "unreadable")
		}
		return true
	}
	p.files = append(p.files, shown)
	cur := &sshBlock{conds: conds, match: match}
	p.blocks = append(p.blocks, cur)
	for n, raw := range strings.Split(string(b), "\n") {
		key, args, ok := sshConfigLine(raw)
		if !ok {
			continue
		}
		switch key {
		case "host":
			own := append(append([][]string{}, conds...), args)
			cur = &sshBlock{conds: own, match: match}
			p.blocks = append(p.blocks, cur)
			if match {
				continue
			}
			var patterns []string
			for _, a := range args {
				if strings.ContainsAny(a, "*?!") {
					patterns = append(patterns, a)
					continue
				}
				if !sshAliasPattern.MatchString(a) {
					p.skip(a, "name")
					continue
				}
				// Resolving costs a pass over every block, so only so many
				// names are kept; the rest is said once.
				if len(p.candidates) == sshConfigMaxCandidates {
					if !p.truncated {
						p.truncated = true
						p.skip(a, "limit")
					}
					continue
				}
				p.candidates = append(p.candidates, sshCandidate{alias: a, file: shown, line: n + 1})
			}
			if len(patterns) == len(args) {
				p.skip("Host "+strings.Join(args, " "), "wildcard")
			}
		case "match":
			p.match = true
			// Only where it is: a Match exec argument may hold a token.
			p.skip("Match ("+shown+":"+strconv.Itoa(n+1)+")", "match")
			cur = &sshBlock{conds: conds, match: true}
			p.blocks = append(p.blocks, cur)
		case "include":
			if cur.match {
				continue
			}
			for _, a := range args {
				p.include(a, cur, depth)
			}
			// The including block goes on after the included files.
			cur = &sshBlock{conds: cur.conds, match: cur.match}
			p.blocks = append(p.blocks, cur)
		default:
			cur.directives = append(cur.directives, sshDirective{key: key, args: args})
		}
	}
	return true
}

// include reads the files one Include argument names: ~ is the home, a
// relative path is under ~/.ssh, and a glob is read in sorted order as ssh
// does. Habitat's own machine files are already on the page.
func (p *sshConfigParser) include(arg string, at *sshBlock, depth int) {
	path := arg
	switch {
	case path == "~" || strings.HasPrefix(path, "~/"):
		path = filepath.Join(p.home, strings.TrimPrefix(path, "~"))
	case !filepath.IsAbs(path):
		path = filepath.Join(p.home, ".ssh", path)
	}
	if depth+1 > sshConfigMaxDepth {
		p.skip("Include "+arg, "limit")
		return
	}
	if p.opened >= sshConfigMaxFiles {
		p.skip("Include "+arg, "limit")
		return
	}
	matches, err := filepath.Glob(path)
	if err != nil {
		p.skip("Include "+arg, "unreadable")
		return
	}
	sort.Strings(matches)
	ownDir := filepath.Join(p.home, machineDirRel)
	for _, m := range matches {
		if filepath.Dir(m) == ownDir && machineFilePattern.MatchString(filepath.Base(m)) {
			continue
		}
		p.parseFile(m, at.conds, false, depth+1)
	}
}

// sshConfigLine splits one line as ssh_config(5) reads it: a keyword, then
// whitespace or one "=", then arguments as OpenSSH's argv_split makes them:
// single or double quotes group, a backslash escapes a quote, a backslash
// or a blank, and a word beginning with # ends the line. A malformed line
// is skipped, as this reader only ever shows what it understood.
func sshConfigLine(raw string) (string, []string, bool) {
	line := strings.TrimSpace(strings.TrimRight(raw, "\r"))
	if line == "" || line[0] == '#' {
		return "", nil, false
	}
	end := strings.IndexAny(line, " \t=")
	if end <= 0 {
		return "", nil, false
	}
	key := strings.ToLower(line[:end])
	rest := strings.TrimLeft(line[end:], " \t")
	if strings.HasPrefix(rest, "=") {
		rest = strings.TrimLeft(rest[1:], " \t")
	}
	var args []string
	var word strings.Builder
	inWord, quote := false, byte(0)
	for i := 0; i < len(rest); i++ {
		c := rest[i]
		switch {
		case c == '\\' && i+1 < len(rest) && strings.IndexByte("\\\"' ", rest[i+1]) >= 0:
			i++
			word.WriteByte(rest[i])
			inWord = true
		case quote != 0:
			if c == quote {
				quote = 0
			} else {
				word.WriteByte(c)
			}
		case c == '"' || c == '\'':
			quote, inWord = c, true
		case c == ' ' || c == '\t':
			if inWord {
				args = append(args, word.String())
				word.Reset()
				inWord = false
			}
		case c == '#' && !inWord:
			i = len(rest)
		default:
			word.WriteByte(c)
			inWord = true
		}
	}
	if quote != 0 {
		return "", nil, false
	}
	if inWord {
		args = append(args, word.String())
	}
	for _, a := range args {
		if strings.ContainsAny(a, "\x00\x1b") {
			return "", nil, false
		}
	}
	if len(args) == 0 {
		return "", nil, false
	}
	return key, args, true
}

// sshPatternMatch is ssh's wildcard match: * any run, ? one character.
// Iterative with one backtrack point, so its work stays linear in practice
// and quadratic at worst, whatever the pattern.
func sshPatternMatch(name, pattern string) bool {
	n, p := 0, 0
	star, mark := -1, 0
	for n < len(name) {
		switch {
		case p < len(pattern) && (pattern[p] == '?' || pattern[p] == name[n]):
			n++
			p++
		case p < len(pattern) && pattern[p] == '*':
			star, mark = p, n
			p++
		case star >= 0:
			mark++
			n, p = mark, star+1
		default:
			return false
		}
	}
	for p < len(pattern) && pattern[p] == '*' {
		p++
	}
	return p == len(pattern)
}

// sshPatternList is a Host line: some positive pattern matches and no
// negated one does.
func sshPatternList(name string, patterns []string) bool {
	found := false
	for _, pat := range patterns {
		if neg, ok := strings.CutPrefix(pat, "!"); ok {
			if sshPatternMatch(name, neg) {
				return false
			}
		} else if sshPatternMatch(name, pat) {
			found = true
		}
	}
	return found
}

func (b *sshBlock) applies(alias string) bool {
	if b.match {
		return false
	}
	for _, c := range b.conds {
		if !sshPatternList(alias, c) {
			return false
		}
	}
	return true
}

// routed says ssh would reach name through a ProxyJump or ProxyCommand of
// its own, Match blocks aside.
func (p *sshConfigParser) routed(name string) bool {
	for _, b := range p.blocks {
		if !b.applies(name) {
			continue
		}
		for _, d := range b.directives {
			if d.key == "proxyjump" || d.key == "proxycommand" {
				return !strings.EqualFold(d.args[0], "none")
			}
		}
	}
	return false
}

// resolve is what `ssh <alias>` uses, Match blocks aside.
func (p *sshConfigParser) resolve(c sshCandidate) (sshConfigHost, bool) {
	h := sshConfigHost{Alias: c.alias, File: c.file, Line: c.line, Keys: []sshConfigKey{}}
	var hostName, user, port, jump, command string
	set := func(v *string, args []string) {
		if *v == "" {
			*v = args[0]
		}
	}
	var keys []string
	own := false
	for _, b := range p.blocks {
		if !b.applies(c.alias) {
			continue
		}
		// The Host line that named the alias must itself let it through
		// (`Host a !a` does not); a block that applies is that proof.
		if len(b.conds) > 0 {
			for _, pat := range b.conds[len(b.conds)-1] {
				if pat == c.alias {
					own = true
				}
			}
		}
		for _, d := range b.directives {
			switch d.key {
			case "hostname":
				set(&hostName, d.args)
			case "user":
				set(&user, d.args)
			case "port":
				set(&port, d.args)
			case "proxyjump":
				if jump == "" && command == "" {
					jump = d.args[0]
				}
			case "proxycommand":
				if jump == "" && command == "" {
					command = strings.Join(d.args, " ")
				}
			case "identityfile":
				keys = append(keys, d.args[0])
			}
		}
	}
	if !own {
		return h, false
	}
	h.HostName = c.alias
	if hostName != "" {
		h.HostName = strings.ReplaceAll(strings.ReplaceAll(hostName, "%h", c.alias), "%%", "%")
	}
	h.Port = 22
	if port != "" {
		n, err := strconv.Atoi(port)
		if err != nil || n < 1 || n > 65535 {
			return h, false
		}
		h.Port = n
	}
	t := sshTokens{home: p.home, alias: c.alias, host: h.HostName, port: strconv.Itoa(h.Port), localUser: p.username}
	h.User = p.username
	if user != "" {
		h.User = t.expand(user)
	}
	t.remoteUser = h.User
	if !printable(h.HostName, 255) || !printable(h.User, 64) {
		return h, false
	}
	if jump != "" && !strings.EqualFold(jump, "none") {
		h.ProxyJump = clip(jump, 255)
	}
	h.ProxyCommand = command != "" && !strings.EqualFold(command, "none")
	for _, k := range keys {
		if len(h.Keys) == sshConfigMaxKeys || strings.EqualFold(k, "none") {
			continue
		}
		path := t.expand(k)
		if !filepath.IsAbs(path) {
			// ssh reads a relative IdentityFile from ~/.ssh.
			path = filepath.Join(p.home, ".ssh", path)
		}
		key := sshConfigKey{Path: clip(p.display(path), 255)}
		if !strings.Contains(path, "%") {
			var st unix.Stat_t
			present := unix.Stat(path, &st) == nil && st.Mode&unix.S_IFMT == unix.S_IFREG
			key.Present = &present
		}
		h.Keys = append(h.Keys, key)
	}
	h.Tailscale = strings.HasSuffix(strings.ToLower(h.HostName), ".ts.net")
	if a, err := netip.ParseAddr(h.HostName); err == nil && a.Is4() && netip.MustParsePrefix("100.64.0.0/10").Contains(a) {
		h.Tailscale = true
	}
	return h, true
}

// sshTokens are the ssh_config(5) tokens known without connecting: ~, %d,
// %h, %n (the alias as given), %p, %r, %u and %%. Any other token stays as
// written.
type sshTokens struct {
	home, alias, host, port, remoteUser, localUser string
}

func (t sshTokens) expand(s string) string {
	if s == "~" || strings.HasPrefix(s, "~/") {
		s = t.home + s[1:]
	}
	values := map[byte]string{'d': t.home, 'h': t.host, 'n': t.alias, 'p': t.port, 'r': t.remoteUser, 'u': t.localUser, '%': "%"}
	var out strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] != '%' || i+1 == len(s) {
			out.WriteByte(s[i])
			continue
		}
		i++
		if v := values[s[i]]; v != "" {
			out.WriteString(v)
		} else {
			out.WriteByte('%')
			out.WriteByte(s[i])
		}
	}
	return out.String()
}

func printable(s string, limit int) bool {
	if s == "" || len(s) > limit {
		return false
	}
	for _, r := range s {
		if r < 0x21 || r == 0x7f {
			return false
		}
	}
	return true
}

func clip(s string, limit int) string {
	if len(s) > limit {
		return s[:limit]
	}
	return s
}

// ---- The person's choices ----

// sshConfigMachines is what the person chose for config hosts, by alias,
// in their preferences. Nothing else about a host is kept.
type sshConfigMachines struct {
	Shown  []string `json:"shown,omitempty"`
	Hidden []string `json:"hidden,omitempty"`
}

func (m *sshConfigMachines) valid() bool {
	if m == nil {
		return true
	}
	if len(m.Shown) > sshConfigMaxChosen || len(m.Hidden) > sshConfigMaxChosen {
		return false
	}
	seen := map[string]bool{}
	for _, a := range append(append([]string{}, m.Shown...), m.Hidden...) {
		if !sshAliasPattern.MatchString(a) || seen[a] {
			return false
		}
		seen[a] = true
	}
	return true
}

func (m *sshConfigMachines) empty() bool { return m == nil || len(m.Shown) == 0 && len(m.Hidden) == 0 }

func without(list []string, alias string) []string {
	out := []string{}
	for _, a := range list {
		if a != alias {
			out = append(out, a)
		}
	}
	return out
}

// changeSSHConfigMachines applies one choice. known are the aliases the file
// has now: a choice for an alias that left the file is dropped on the way.
func changeSSHConfigMachines(home, action, alias string, known map[string]bool) error {
	preferencesLock.Lock()
	defer preferencesLock.Unlock()
	value, err := readPreferences(home)
	if err != nil {
		return err
	}
	m := sshConfigMachines{}
	if value.SSHConfigMachines != nil {
		m = *value.SSHConfigMachines
	}
	keep := func(list []string) []string {
		out := []string{}
		for _, a := range list {
			if known[a] {
				out = append(out, a)
			}
		}
		return out
	}
	m.Shown, m.Hidden = keep(m.Shown), keep(m.Hidden)
	switch action {
	case "config_show":
		m.Hidden, m.Shown = without(m.Hidden, alias), append(without(m.Shown, alias), alias)
	case "config_unshow":
		m.Shown = without(m.Shown, alias)
	case "config_hide":
		m.Shown, m.Hidden = without(m.Shown, alias), append(without(m.Hidden, alias), alias)
	case "config_unhide":
		m.Hidden = without(m.Hidden, alias)
	}
	if len(m.Shown) > sshConfigMaxChosen || len(m.Hidden) > sshConfigMaxChosen {
		return errTooManyChosen
	}
	value.SSHConfigMachines = &m
	return savePreferences(home, value)
}

var errTooManyChosen = errors.New("too_many_machines")

// withChoices puts the person's choices for the hosts the file has now
// into the view.
func (v *sshConfigView) withChoices(m *sshConfigMachines) {
	if m == nil {
		return
	}
	known := map[string]bool{}
	for _, h := range v.Hosts {
		known[h.Alias] = true
	}
	for _, a := range m.Shown {
		if known[a] {
			v.Shown = append(v.Shown, a)
		}
	}
	for _, a := range m.Hidden {
		if known[a] {
			v.Hidden = append(v.Hidden, a)
		}
	}
}

// ---- Checking a host on request ----

type sshConfigCheck struct {
	Alias string `json:"alias"`
	// Result: ok, offline, unresolved, hostkey_unknown, host_key_changed,
	// key_rejected, route_unsupported, failed.
	Result string `json:"result"`
}

// sshJumpPattern is the one ProxyJump hop a check reproduces:
// [user@]host[:port], each part a plain word.
var sshJumpPattern = regexp.MustCompile(`^(?:([A-Za-z0-9_][A-Za-z0-9_.-]{0,63})@)?([A-Za-z0-9][A-Za-z0-9._-]{0,252})(?::([0-9]{1,5}))?$`)

// sshPlainHost is a destination a hop can name in its -W without quoting:
// a name or an IPv4 address (an IPv6 one is not reproduced).
var sshPlainHost = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,252}$`)

// checkOptions keep a check from changing anything: StrictHostKeyChecking,
// UpdateHostKeys and CheckHostIP leave known_hosts as it is, no connection
// is shared, left open or forwarded, no local command runs, and BatchMode
// never asks for a password.
var checkOptions = []string{
	"-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "-o", "ConnectionAttempts=1",
	"-o", "StrictHostKeyChecking=yes", "-o", "UpdateHostKeys=no", "-o", "CheckHostIP=no",
	"-o", "ControlMaster=no", "-o", "ControlPath=none", "-o", "ControlPersist=no",
	"-o", "ClearAllForwardings=yes", "-o", "PermitLocalCommand=no", "-o", "ForwardAgent=no",
}

// checkArgs is the person's own `ssh <alias> exit 0` with their
// configuration, which is what is being checked (unlike probe, no -F
// /dev/null), or false when its route cannot be held to checkOptions. ssh
// starts a ProxyJump hop as a child of its own without the options given
// here, so one hop is reproduced as a ProxyCommand that carries them; a
// hop reached through a further jump, several hops, or a ProxyCommand of
// the person's own are not checked here.
func (e ownMachineEnv) checkArgs(h sshConfigHost, p *sshConfigParser) ([]string, bool) {
	args := append([]string{}, checkOptions...)
	switch {
	case h.ProxyCommand:
		return nil, false
	case h.ProxyJump != "":
		m := sshJumpPattern.FindStringSubmatch(h.ProxyJump)
		if m == nil || p.routed(m[2]) || !sshPlainHost.MatchString(h.HostName) {
			return nil, false
		}
		hop := append([]string{e.ssh}, checkOptions...)
		hop = append(hop, "-o", "ProxyJump=none", "-o", "ProxyCommand=none")
		if m[1] != "" {
			hop = append(hop, "-l", m[1])
		}
		if m[3] != "" {
			if n, err := strconv.Atoi(m[3]); err != nil || n < 1 || n > 65535 {
				return nil, false
			}
			hop = append(hop, "-p", m[3])
		}
		// Every word is a plain word (the patterns above and fixed
		// options), so the shell ssh runs a ProxyCommand with sees no
		// metacharacter.
		hop = append(hop, "-W", h.HostName+":"+strconv.Itoa(h.Port), "--", m[2])
		args = append(args, "-o", "ProxyCommand="+strings.Join(hop, " "))
	}
	return append(args, "--", h.Alias, "exit 0"), true
}

func (e ownMachineEnv) checkConfigHost(ctx context.Context, h sshConfigHost, p *sshConfigParser) sshConfigCheck {
	result := sshConfigCheck{Alias: h.Alias, Result: "route_unsupported"}
	args, ok := e.checkArgs(h, p)
	if !ok {
		return result
	}
	run, cancel := context.WithTimeout(ctx, 25*time.Second)
	defer cancel()
	cmd := exec.CommandContext(run, e.ssh, args...)
	cmd.Dir = e.home
	cmd.Env = []string{"HOME=" + e.home, "USER=" + e.username, "LOGNAME=" + e.username, "PATH=/usr/bin:/bin", "LANG=C.UTF-8"}
	cmd.Stdin, cmd.Stdout = nil, io.Discard
	// A Match exec or hop that outlives ssh would hold stderr open and the
	// request with it: the whole group goes, and Run waits no longer.
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error { return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL) }
	cmd.WaitDelay = 2 * time.Second
	var stderr boundedText
	stderr.limit = 8192
	cmd.Stderr = &stderr
	err := cmd.Run()
	if cmd.Process != nil {
		_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
	result.Result = classifyConfigCheck(err, stderr.String())
	return result
}

func classifyConfigCheck(err error, text string) string {
	switch {
	case err == nil:
		return "ok"
	case strings.Contains(text, "REMOTE HOST IDENTIFICATION HAS CHANGED"):
		return "host_key_changed"
	case strings.Contains(text, "Host key verification failed") || strings.Contains(text, "host key is known"):
		return "hostkey_unknown"
	case strings.Contains(text, "Could not resolve hostname"):
		return "unresolved"
	case strings.Contains(text, "Permission denied"):
		return "key_rejected"
	case strings.Contains(text, "timed out") || strings.Contains(text, "Connection refused") || strings.Contains(text, "No route to host") || strings.Contains(text, "Network is unreachable"):
		return "offline"
	}
	return "failed"
}
