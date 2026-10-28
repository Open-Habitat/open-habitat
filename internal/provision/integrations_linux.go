//go:build linux

package provision

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"golang.org/x/sys/unix"

	"github.com/Open-Habitat/open-habitat/internal/integrationapps"
)

// HostOperationDir is the directory whose flock serializes every deliberate
// host mutation (host apply, prepare, upgrade). Host apply writes the tools
// section of the integrations file under it, so the broker takes the same
// lock before it writes an application section: the two writers of one file
// never interleave, and a maintenance window refuses browser changes.
const HostOperationDir = "/var/lib/open-habitat/host"

// integrationState is the broker's record beside the integrations file: root's
// browser_setup switch as host apply published it, and who set each section
// the broker wrote. A record names the exact section bytes it describes, so a
// section root later edits by hand is reported as root's, never as the
// administrator's. It holds no secret.
const integrationState = "integration_apps.json"

// The broker's own staging name, distinct from host apply's ".next".
const integrationStage = ".integrations.json.broker"

type integrationRecord struct {
	Provider string `json:"provider"`
	Actor    string `json:"actor"`
	At       string `json:"at"`
	SHA256   string `json:"sha256"`
}
type integrationFile struct {
	Version      int                 `json:"version"`
	BrowserSetup bool                `json:"browser_setup"`
	Apps         []integrationRecord `json:"apps"`
}

var errIntegrationFile = errors.New("integrations file unavailable")
var errHostBusy = errors.New("host operation in progress")

func (w Writer) integrationsPath() string {
	if w.IntegrationsFile != "" {
		return w.IntegrationsFile
	}
	return integrationapps.Path
}
func (w Writer) hostLockDir() string {
	if w.HostLock != "" {
		return w.HostLock
	}
	return HostOperationDir
}

func sectionDigest(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

// readIntegrationState reads the record under the broker's directory lock.
// Absent means host apply has not published the switch yet: the site
// default, on, with no recorded sections.
func readIntegrationState(fd int, owner uint32) (integrationFile, error) {
	if absent(fd, integrationState) {
		return integrationFile{Version: 1, BrowserSetup: true, Apps: []integrationRecord{}}, nil
	}
	b, e := readAt(fd, integrationState, owner)
	if e != nil {
		return integrationFile{}, e
	}
	var f integrationFile
	if decode(b, &f, "version", "browser_setup", "apps") != nil || f.Version != 1 {
		return integrationFile{}, ErrInvalid
	}
	raw, _ := object(b, "version", "browser_setup", "apps")
	apps, err := checkArray(raw["apps"], "apps")
	if err != nil || len(apps) > len(integrationapps.Providers) {
		return integrationFile{}, ErrInvalid
	}
	seen := map[string]bool{}
	for _, a := range apps {
		var x integrationRecord
		if decode(a, &x, "provider", "actor", "at", "sha256") != nil || !integrationProvider(x.Provider) || seen[x.Provider] || !validActor(x.Actor) || !validStamp(x.At) || !digestHex(x.SHA256) {
			return integrationFile{}, ErrInvalid
		}
		seen[x.Provider] = true
	}
	return f, nil
}
func digestHex(s string) bool {
	b, e := hex.DecodeString(s)
	return e == nil && len(b) == sha256.Size && hex.EncodeToString(b) == s
}

// writeIntegrationState replaces the record. A staging file only this writer
// creates, under the lock it holds, is a leftover of an interrupted write
// that never took effect, so it is removed rather than left to block.
func writeIntegrationState(fd int, f integrationFile) error {
	if e := unix.Unlinkat(fd, integrationState+".next", 0); e != nil && e != unix.ENOENT {
		return e
	}
	slices.SortFunc(f.Apps, func(a, b integrationRecord) int { return strings.Compare(a.Provider, b.Provider) })
	return replace(fd, integrationState, marshal(f))
}

// trustedParent opens path's directory without following links. Every
// component must be root's (or the test owner's) and writable by nobody
// else, as the daemon's core.ReadOperatorFile requires of the file's.
func trustedParent(path string, owner uint32) (int, error) {
	if !filepath.IsAbs(path) || filepath.Clean(path) != path {
		return -1, errIntegrationFile
	}
	fd, e := unix.Open("/", unix.O_RDONLY|unix.O_DIRECTORY|unix.O_CLOEXEC, 0)
	if e != nil {
		return -1, errIntegrationFile
	}
	for _, p := range strings.Split(strings.TrimPrefix(filepath.Dir(path), "/"), "/") {
		if p == "" {
			continue
		}
		n, err := unix.Openat(fd, p, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
		unix.Close(fd)
		if err != nil {
			return -1, errIntegrationFile
		}
		fd = n
		var st unix.Stat_t
		if unix.Fstat(fd, &st) != nil || (st.Uid != 0 && st.Uid != owner) || st.Mode&0022 != 0 {
			unix.Close(fd)
			return -1, errIntegrationFile
		}
	}
	return fd, nil
}

// readIntegrations returns the file's bytes, nil when it does not exist.
func readIntegrations(dir int, name string, owner uint32) ([]byte, error) {
	f, e := unix.Openat(dir, name, unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if e == unix.ENOENT {
		return nil, nil
	}
	if e != nil {
		return nil, errIntegrationFile
	}
	file := os.NewFile(uintptr(f), name)
	defer file.Close()
	var st unix.Stat_t
	if unix.Fstat(f, &st) != nil || st.Uid != owner || st.Mode&unix.S_IFMT != unix.S_IFREG || st.Mode&0022 != 0 || st.Nlink != 1 || st.Size > integrationapps.MaxFile {
		return nil, errIntegrationFile
	}
	b, e := io.ReadAll(io.LimitReader(file, integrationapps.MaxFile+1))
	if e != nil || len(b) > integrationapps.MaxFile {
		return nil, errIntegrationFile
	}
	return b, nil
}

// publishIntegrations atomically replaces the file with b, root's and
// readable by every mapped user's daemon, as host apply leaves it.
func publishIntegrations(dir int, name string, b []byte) error {
	if e := unix.Unlinkat(dir, integrationStage, 0); e != nil && e != unix.ENOENT {
		return e
	}
	f, e := unix.Openat(dir, integrationStage, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if e != nil {
		return e
	}
	file := os.NewFile(uintptr(f), integrationStage)
	n, e := file.Write(b)
	if e == nil && n != len(b) {
		e = io.ErrShortWrite
	}
	if e == nil {
		e = unix.Fchmod(f, 0644)
	}
	if e == nil {
		e = file.Sync()
	}
	if c := file.Close(); e == nil {
		e = c
	}
	if e == nil {
		e = unix.Renameat(dir, integrationStage, dir, name)
	}
	if e != nil {
		unix.Unlinkat(dir, integrationStage, 0)
		return e
	}
	return unix.Fsync(dir)
}

// hostLock takes the host operation lock. A held lock is a maintenance
// window: wait briefly, then refuse. Like host apply, the broker creates the
// private lock directory inside its trusted parent when it is missing: an
// installation that never ran host apply has no maintenance to wait for, and
// refusing there would lock the browser out of every write.
func hostLock(ctx context.Context, path string, owner uint32) (int, error) {
	fd, e := trustedParent(path, owner)
	if e != nil {
		return -1, e
	}
	defer unix.Close(fd)
	name := filepath.Base(path)
	e = unix.Mkdirat(fd, name, 0700)
	if e == nil && unix.Fsync(fd) != nil {
		return -1, errIntegrationFile
	}
	if e != nil && e != unix.EEXIST {
		return -1, errIntegrationFile
	}
	l, e := unix.Openat(fd, name, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if e != nil {
		return -1, errIntegrationFile
	}
	var st unix.Stat_t
	if unix.Fstat(l, &st) != nil || st.Uid != owner || st.Mode&0077 != 0 {
		unix.Close(l)
		return -1, errIntegrationFile
	}
	deadline := time.Now().Add(time.Second)
	for {
		err := unix.Flock(l, unix.LOCK_EX|unix.LOCK_NB)
		if err == nil {
			return l, nil
		}
		if err != unix.EWOULDBLOCK && err != unix.EAGAIN || time.Now().After(deadline) {
			unix.Close(l)
			return -1, errHostBusy
		}
		select {
		case <-ctx.Done():
			unix.Close(l)
			return -1, errHostBusy
		case <-time.After(20 * time.Millisecond):
		}
	}
}

// integrationApps lists the file's application sections with their source.
func integrationApps(file []byte, state integrationFile) ([]IntegrationApp, error) {
	apps := []IntegrationApp{}
	if file == nil {
		return apps, nil
	}
	members, err := integrationapps.Members(file)
	if err != nil {
		return nil, err
	}
	for _, p := range integrationapps.Providers {
		for _, m := range members {
			if m.Key != p {
				continue
			}
			fields, _ := integrationapps.ReadSection(m.Value)
			app := IntegrationApp{Provider: p, Source: AppSourceOperator, Usable: fields != nil && integrationapps.Usable(p, fields)}
			if publicID.MatchString(fields["client_id"]) {
				app.ClientID = fields["client_id"]
			}
			if integrationapps.ProviderOf(p) == "microsoft" && publicID.MatchString(fields["tenant_id"]) {
				app.TenantID = fields["tenant_id"]
			}
			for _, r := range state.Apps {
				if r.Provider == p && r.SHA256 == sectionDigest(m.Value) {
					app.Source, app.Actor, app.At = AppSourceSiteAdmin, r.Actor, r.At
				}
			}
			apps = append(apps, app)
		}
	}
	return apps, nil
}

// handleIntegrations serves the three integration operations. A write takes
// the host operation lock, then the broker's directory lock (host apply's
// order too), refuses while root's switch is off, splices exactly one
// provider's section into the file and only then records who asked. The
// file's rename is the commit point; a failure after it is reported as
// unavailable, which the gateway treats as uncertain.
func (w Writer) handleIntegrations(ctx context.Context, r Request) Reply {
	if ctx == nil || !w.valid() {
		return failure(StateUnavailable)
	}
	if _, e := EncodeRequest(r); e != nil {
		return failure(Invalid)
	}
	if r.Operation != OpIntegrationList {
		l, e := hostLock(ctx, w.hostLockDir(), w.owner)
		if errors.Is(e, errHostBusy) {
			return failure(HostBusy)
		}
		if e != nil {
			return failure(IntegrationsFile)
		}
		defer unix.Close(l)
	}
	fd, e := lockedDir(ctx, w.Dir, w.owner)
	if e != nil {
		return failure(StateUnavailable)
	}
	defer unix.Close(fd)
	defer unix.Flock(fd, unix.LOCK_UN)
	state, e := readIntegrationState(fd, w.owner)
	if e != nil {
		return failure(StateUnavailable)
	}
	path := w.integrationsPath()
	dir, e := trustedParent(path, w.owner)
	if e != nil {
		return failure(IntegrationsFile)
	}
	defer unix.Close(dir)
	file, e := readIntegrations(dir, filepath.Base(path), w.owner)
	if e != nil {
		return failure(IntegrationsFile)
	}
	page := func(file []byte, state integrationFile) Reply {
		apps, err := integrationApps(file, state)
		if err != nil {
			return failure(IntegrationsFile)
		}
		reply := Reply{Version: 1, Integrations: &IntegrationPage{BrowserSetup: state.BrowserSetup, Apps: apps}}
		if _, err = EncodeReply(reply); err != nil {
			return failure(StateUnavailable)
		}
		return reply
	}
	if r.Operation == OpIntegrationList {
		return page(file, state)
	}
	if !state.BrowserSetup {
		return failure(BrowserSetupOff)
	}
	// Host apply creates the file with its tools; the broker never creates
	// the installation's file, only edits one that host apply published.
	if file == nil {
		return failure(IntegrationsFile)
	}
	var section []byte
	if r.Operation == OpIntegrationSet {
		section = integrationapps.Section(r.Provider, r.Fields)
	}
	next, e := integrationapps.Replace(file, r.Provider, section)
	if e != nil {
		return failure(IntegrationsFile)
	}
	now := time.Now
	if w.Now != nil {
		now = w.Now
	}
	recorded := slices.DeleteFunc(append([]integrationRecord{}, state.Apps...), func(x integrationRecord) bool { return x.Provider == r.Provider })
	if section != nil {
		recorded = append(recorded, integrationRecord{Provider: r.Provider, Actor: r.Actor, At: now().UTC().Truncate(time.Second).Format(time.RFC3339), SHA256: sectionDigest(section)})
	}
	if ctx.Err() != nil {
		return failure(StateUnavailable)
	}
	if string(next) != string(file) {
		if publishIntegrations(dir, filepath.Base(path), next) != nil {
			return failure(StateUnavailable)
		}
	}
	state.Apps = recorded
	if writeIntegrationState(fd, state) != nil {
		return failure(StateUnavailable)
	}
	if w.IntegrationEvent != nil {
		w.IntegrationEvent(r.Operation, r.Provider, r.Actor)
	}
	return page(next, state)
}

// IntegrationState is what host plan reports: the published switch and each
// section's source, actor and time. It never carries a secret.
type IntegrationState struct {
	BrowserSetup bool             `json:"browser_setup"`
	Apps         []IntegrationApp `json:"apps"`
}

// InspectIntegrations is root-local and read-only.
func InspectIntegrations(ctx context.Context) (IntegrationState, error) {
	if os.Geteuid() != 0 {
		return IntegrationState{}, ErrInvalid
	}
	w := Writer{Dir: brokerState}
	return w.inspectIntegrations(ctx)
}
func (w Writer) inspectIntegrations(ctx context.Context) (IntegrationState, error) {
	fd, e := lockedDir(ctx, w.Dir, w.owner)
	if e != nil {
		return IntegrationState{}, e
	}
	defer unix.Close(fd)
	defer unix.Flock(fd, unix.LOCK_UN)
	state, e := readIntegrationState(fd, w.owner)
	if e != nil {
		return IntegrationState{}, e
	}
	path := w.integrationsPath()
	dir, e := trustedParent(path, w.owner)
	if e != nil {
		return IntegrationState{}, e
	}
	defer unix.Close(dir)
	file, e := readIntegrations(dir, filepath.Base(path), w.owner)
	if e != nil {
		return IntegrationState{}, e
	}
	apps, e := integrationApps(file, state)
	if e != nil {
		return IntegrationState{}, e
	}
	return IntegrationState{BrowserSetup: state.BrowserSetup, Apps: apps}, nil
}

// PublishIntegrationSetup records root's integrations.browser_setup switch.
// Host apply calls it while holding the host operation lock; the recorded
// sections are kept.
func PublishIntegrationSetup(ctx context.Context, on bool) error {
	if os.Geteuid() != 0 {
		return ErrInvalid
	}
	return publishIntegrationSetup(ctx, brokerState, 0, on)
}
func publishIntegrationSetup(ctx context.Context, dir string, owner uint32, on bool) error {
	fd, e := lockedDir(ctx, dir, owner)
	if e != nil {
		return e
	}
	defer unix.Close(fd)
	defer unix.Flock(fd, unix.LOCK_UN)
	state, e := readIntegrationState(fd, owner)
	if e != nil {
		return e
	}
	if state.BrowserSetup == on && !absent(fd, integrationState) {
		return nil
	}
	state.BrowserSetup = on
	return writeIntegrationState(fd, state)
}

// IntegrationSetupPublished reports whether the broker holds this switch.
func IntegrationSetupPublished(ctx context.Context, on bool) bool {
	s, e := InspectIntegrations(ctx)
	return e == nil && s.BrowserSetup == on
}
