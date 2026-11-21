//go:build linux

package daemon

import (
	"bufio"
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/open-habitat/open-habitat/internal/jsoncheck"
	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

const AgentInstructionsPath = "/api/v1/account/agent-instructions"

// The person's own agent instructions (Settings › Tili › Ohjeet agentille and
// the onboarding note). Pi reads ~/.pi/agent/AGENTS.md at the start of every
// conversation; Claude reads it through an import line in ~/.claude/CLAUDE.md.
// The daemon reads and writes exactly that one file as the person, never a
// path from a request, and keeps no copy or record of it: the file is the
// only truth, so an agent editing it in a conversation and the page editing
// it here meet only in the file.
//
// A write is compare-and-swap against the version the browser read, or a
// create that succeeds only while the file is absent. Like the workspace
// editor's save it detects a change between read and write but cannot exclude
// an uncooperative writer in the instant before the rename; it never forces,
// retries or merges. Merging is the browser's.
var (
	instructionsDir = []string{".pi", "agent"}
	claudeDir       = []string{".claude"}
	// instructionsSaves serializes this daemon's own writes, so two tabs'
	// saves cannot both pass the version check before either renames.
	instructionsSaves sync.Mutex
)

const (
	instructionsFile   = "AGENTS.md"
	claudeFile         = "CLAUDE.md"
	claudeImport       = "@~/.pi/agent/AGENTS.md"
	instructionsLimit  = 256 << 10
	instructionsWire   = 2 << 20
	claudeReadLimit    = 1 << 20
	instructionsDomain = "open-habitat-agent-instructions-v1"
)

type instructionsObservation struct {
	exists  bool
	content string
	stat    unix.Stat_t
	version string
}

func instructionsVersion(s unix.Stat_t, raw []byte) string {
	h := sha256.New()
	sum := sha256.Sum256(raw)
	for _, f := range []string{instructionsDomain, fmt.Sprint(s.Dev), fmt.Sprint(s.Ino), fmt.Sprint(s.Size), fmt.Sprint(s.Mode), fmt.Sprint(s.Mtim.Sec), fmt.Sprint(s.Mtim.Nsec), fmt.Sprint(s.Ctim.Sec), fmt.Sprint(s.Ctim.Nsec), hex.EncodeToString(sum[:])} {
		fmt.Fprintf(h, "%d:%s", len(f), f)
	}
	return "sha256:v1:" + hex.EncodeToString(h.Sum(nil))
}

// instructionsText says whether bytes are text the editor can show and give
// back unchanged: UTF-8 without CR or NUL.
func instructionsText(raw []byte) bool {
	return utf8.Valid(raw) && bytes.IndexByte(raw, 0) < 0 && bytes.IndexByte(raw, '\r') < 0
}

// readInstructionsAt reads the file in an already opened ~/.pi/agent. A
// link, a second hard link, another owner, special bits or anything but text
// is refused rather than shown: a write would replace a link with a file,
// and the editor could not give such content back unchanged.
func readInstructionsAt(dir int) (instructionsObservation, error) {
	fd, err := unix.Openat(dir, instructionsFile, unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if errors.Is(err, unix.ENOENT) {
		return instructionsObservation{}, nil
	}
	if errors.Is(err, unix.ELOOP) || errors.Is(err, unix.ENXIO) {
		return instructionsObservation{}, fileError(415, "file_unsupported")
	}
	if err != nil {
		return instructionsObservation{}, err
	}
	f := os.NewFile(uintptr(fd), "instructions")
	defer f.Close()
	s, err := stat(fd)
	if err != nil {
		return instructionsObservation{}, err
	}
	if s.Mode&unix.S_IFMT != unix.S_IFREG || s.Uid != uint32(os.Geteuid()) || s.Nlink != 1 || s.Mode&07000 != 0 {
		return instructionsObservation{}, fileError(415, "file_unsupported")
	}
	if s.Size > instructionsLimit {
		return instructionsObservation{}, fileError(413, "file_too_large")
	}
	raw, err := io.ReadAll(io.LimitReader(f, instructionsLimit+1))
	if err != nil {
		return instructionsObservation{}, err
	}
	if len(raw) > instructionsLimit {
		return instructionsObservation{}, fileError(413, "file_too_large")
	}
	after, err := stat(fd)
	if err != nil {
		return instructionsObservation{}, err
	}
	after.Atim = s.Atim
	if after != s {
		return instructionsObservation{}, fileError(409, "file_changed")
	}
	if !instructionsText(raw) {
		return instructionsObservation{}, fileError(415, "file_unsupported")
	}
	return instructionsObservation{true, string(raw), s, instructionsVersion(s, raw)}, nil
}

func readInstructions(home string) (instructionsObservation, error) {
	dir, err := personalDir(home, false, instructionsDir...)
	if errors.Is(err, os.ErrNotExist) {
		return instructionsObservation{}, nil
	}
	if err != nil {
		return instructionsObservation{}, err
	}
	defer dir.Close()
	return readInstructionsAt(int(dir.Fd()))
}

// claudeState reads ~/.claude/CLAUDE.md only to say whether Claude reads the
// instructions. Reading follows a link there: it is the person's own file read
// as the person, and nothing is ever written to it.
func claudeState(home string) string {
	dir, err := personalDir(home, false, claudeDir...)
	if errors.Is(err, os.ErrNotExist) {
		return "none"
	}
	if err != nil {
		return "unknown"
	}
	defer dir.Close()
	fd, err := unix.Openat(int(dir.Fd()), claudeFile, unix.O_RDONLY|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if errors.Is(err, unix.ENOENT) {
		return "none"
	}
	if err != nil {
		return "unknown"
	}
	f := os.NewFile(uintptr(fd), "claude")
	defer f.Close()
	s, err := stat(fd)
	if err != nil || s.Mode&unix.S_IFMT != unix.S_IFREG || s.Size > claudeReadLimit {
		return "unknown"
	}
	lines := bufio.NewScanner(io.LimitReader(f, claudeReadLimit))
	lines.Buffer(make([]byte, 0, 4096), claudeReadLimit)
	absolute := "@" + strings.TrimSuffix(home, "/") + "/.pi/agent/AGENTS.md"
	for lines.Scan() {
		line := strings.TrimSpace(lines.Text())
		if line == claudeImport || line == absolute {
			return "imports"
		}
	}
	if lines.Err() != nil {
		return "unknown"
	}
	return "own"
}

// stageFile writes content to a fresh hidden name in dir and makes it durable.
// The caller renames it into place or the returned cleanup removes it.
func stageFile(dir int, content []byte, mode uint32) (string, func(), error) {
	var nonce [16]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return "", nil, err
	}
	name := ".oh-instructions-" + hex.EncodeToString(nonce[:]) + ".tmp"
	fd, err := unix.Openat(dir, name, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if err != nil {
		return "", nil, err
	}
	cleanup := func() { _ = unix.Unlinkat(dir, name, 0) }
	f := os.NewFile(uintptr(fd), "staged")
	defer f.Close()
	if n, err := f.Write(content); err != nil || n != len(content) {
		cleanup()
		if err == nil {
			err = io.ErrShortWrite
		}
		return "", nil, err
	}
	if err = unix.Fchmod(fd, mode&0777); err != nil {
		cleanup()
		return "", nil, err
	}
	if err = f.Sync(); err != nil {
		cleanup()
		return "", nil, err
	}
	return name, cleanup, nil
}

// createOnly places content at dir/name only while that name is absent.
func createOnly(dir int, name string, content []byte) error {
	tmp, cleanup, err := stageFile(dir, content, 0600)
	if err != nil {
		return err
	}
	if err = unix.Renameat2(dir, tmp, dir, name, unix.RENAME_NOREPLACE); err != nil {
		cleanup()
		return err
	}
	return unix.Fsync(dir)
}

type instructionsWrite struct {
	BaseVersion *string `json:"base_version"`
	Create      *bool   `json:"create"`
	Content     *string `json:"content"`
}

func saveInstructions(home string, in instructionsWrite) error {
	content := []byte(*in.Content)
	if len(content) > instructionsLimit {
		return fileError(413, "file_too_large")
	}
	if !instructionsText(content) {
		return fileError(400, "invalid_request")
	}
	instructionsSaves.Lock()
	defer instructionsSaves.Unlock()
	if in.Create != nil {
		dir, err := personalDir(home, true, instructionsDir...)
		if err != nil {
			return err
		}
		defer dir.Close()
		if err = createOnly(int(dir.Fd()), instructionsFile, content); errors.Is(err, unix.EEXIST) {
			return fileError(409, "file_changed")
		} else if err != nil {
			return err
		}
		// Claude reads the new file through one import line, written only
		// where Claude has no instructions file at all. A failure here leaves
		// the instructions saved; the reply's claude field says what is true.
		if cdir, e := personalDir(home, true, claudeDir...); e == nil {
			_ = createOnly(int(cdir.Fd()), claudeFile, []byte(claudeImport+"\n"))
			cdir.Close()
		}
		return nil
	}
	dir, err := personalDir(home, false, instructionsDir...)
	if errors.Is(err, os.ErrNotExist) {
		return fileError(409, "file_changed")
	}
	if err != nil {
		return err
	}
	defer dir.Close()
	d := int(dir.Fd())
	current, err := readInstructionsAt(d)
	if err != nil {
		return err
	}
	if !current.exists || current.version != *in.BaseVersion {
		return fileError(409, "file_changed")
	}
	if current.stat.Mode&0200 == 0 {
		return fileError(415, "file_unsupported")
	}
	tmp, cleanup, err := stageFile(d, content, current.stat.Mode)
	if err != nil {
		return err
	}
	renamed := false
	defer func() {
		if !renamed {
			cleanup()
		}
	}()
	// Look again just before the rename: a change while staging refuses.
	fresh, err := readInstructionsAt(d)
	if err != nil {
		return err
	}
	if !fresh.exists || fresh.version != *in.BaseVersion {
		return fileError(409, "file_changed")
	}
	if err = unix.Renameat(d, tmp, d, instructionsFile); err != nil {
		return err
	}
	renamed = true
	return unix.Fsync(d)
}

func instructionsReply(cfg transport.Config, o instructionsObservation) map[string]any {
	out := map[string]any{"schema_version": 1, "web_identity_id": opaque("wid_", cfg.Provider+":"+cfg.Subject), "exists": o.exists, "version": nil, "content": "", "modified": nil, "claude": claudeState(cfg.Home)}
	if o.exists {
		out["version"] = o.version
		out["content"] = o.content
		out["modified"] = time.Unix(o.stat.Mtim.Sec, o.stat.Mtim.Nsec).UTC().Format(time.RFC3339Nano)
	}
	return out
}

func decodeInstructionsWrite(b []byte) (instructionsWrite, bool) {
	var in instructionsWrite
	if !editorJSONUnicode(b) || !jsoncheck.NoDuplicates(b) {
		return in, false
	}
	d := json.NewDecoder(bytes.NewReader(b))
	d.DisallowUnknownFields()
	if d.Decode(&in) != nil || d.Decode(new(any)) != io.EOF || in.Content == nil {
		return in, false
	}
	if in.Create != nil {
		return in, *in.Create && in.BaseVersion == nil
	}
	return in, in.BaseVersion != nil && len(*in.BaseVersion) == 74 && strings.HasPrefix(*in.BaseVersion, "sha256:v1:")
}

func AgentInstructionsHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		put := r.Method == http.MethodPut
		if r.URL.Path != AgentInstructionsPath || r.URL.EscapedPath() != AgentInstructionsPath || r.URL.RawQuery != "" || len(r.TransferEncoding) != 0 || (!put && r.Method != http.MethodGet) || (!put && r.ContentLength > 0) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		fail := func(err error) {
			var fe *editorFileError
			if errors.As(err, &fe) {
				snapshotError(w, fe.status, fe.code)
				return
			}
			snapshotError(w, 503, "instructions_unavailable")
		}
		if put {
			if r.ContentLength < 2 || r.ContentLength > instructionsWire || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			b, err := io.ReadAll(io.LimitReader(r.Body, instructionsWire+1))
			if err != nil || int64(len(b)) != r.ContentLength {
				snapshotError(w, 400, "invalid_request")
				return
			}
			in, ok := decodeInstructionsWrite(b)
			if !ok {
				snapshotError(w, 400, "invalid_request")
				return
			}
			if err = saveInstructions(cfg.Home, in); err != nil {
				fail(err)
				return
			}
		}
		o, err := readInstructions(cfg.Home)
		if err != nil && put {
			// The write is done; only the read after it failed. A refusal
			// here would read as "not saved", so the answer is uncertain.
			snapshotError(w, 503, "instructions_unavailable")
			return
		}
		if err != nil {
			fail(err)
			return
		}
		historyJSON(w, instructionsReply(cfg, o))
	})
}
