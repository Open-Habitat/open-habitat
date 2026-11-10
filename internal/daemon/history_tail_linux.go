//go:build linux

package daemon

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"syscall"
	"time"

	"github.com/open-habitat/open-habitat/internal/diagnostic"
	"golang.org/x/sys/unix"
)

// A write cut by a full quota or a crash leaves Pi's session file ending in a
// partial record. Pi would append its next record onto that fragment, making
// it a corrupt line in the middle of the history, so the conversation cannot
// continue until the fragment is gone (29.10.2026: a conductor conversation
// could not wake after EDQUOT). Only that one trailing, non-newline-terminated
// prefix of a JSON value is ever removed; a complete corrupt line anywhere is
// damage the person decides about, never something the daemon skips.

var errHistoryDamaged = errors.New("native Pi history damaged")

// reconciledNativeTail is reconciledNativeHistory that also admits a stable
// cut-off tail, reporting it. A damaged read that stands still is
// errHistoryDamaged. One whole-file pass proves the history; the file's
// unchanged stamp afterwards proves it settled, without a second pass.
func reconciledNativeTail(path string, uid int, id, cwd string) (cutOff bool, err error) {
	a := proveNativeSettled(path, uid)
	if a.revision == "" || !nativeStill(path, a.stamp) {
		return false, errors.New("native Pi history unsettled or unavailable")
	}
	if a.state == "corrupt" {
		return false, errHistoryDamaged
	}
	if a.state != "readable" || a.id != id || a.cwd != cwd {
		return false, errors.New("native Pi history unsettled or unavailable")
	}
	return a.cutOff, nil
}

// writeQuarantine writes the copy; a test replaces it to simulate EDQUOT.
var writeQuarantine = func(f *os.File, r io.Reader) error {
	_, err := io.Copy(f, r)
	return err
}

// cutPartialTail removes a cut-off final record from the native file. The
// caller holds the owner fence and has observed no other Pi writer. Every
// original byte is first kept in a quarantine copy next to the file, which
// Pi and discovery ignore (it is not .jsonl); the file is only shortened,
// never rewritten, and only if it is still exactly what was read.
//
// A terminal Pi takes no owner fence, so the census alone cannot exclude it
// from appending between the read and the truncation. A write lease does:
// it is refused while anyone else has the file open, and holds a later
// opener back until it is released, so nothing appended can be cut away.
func cutPartialTail(path string, uid int, id, cwd string, now time.Time) (quarantine string, removed int, err error) {
	f, err := os.OpenFile(path, os.O_RDWR|syscall.O_NOFOLLOW, 0)
	if err != nil {
		return "", 0, err
	}
	defer f.Close()
	if _, err := unix.FcntlInt(f.Fd(), unix.F_SETLEASE, unix.F_WRLCK); err != nil {
		return "", 0, errors.New("native Pi history open elsewhere")
	}
	// Closing the file releases the lease too.
	defer func() { _, _ = unix.FcntlInt(f.Fd(), unix.F_SETLEASE, unix.F_UNLCK) }()
	before, err := f.Stat()
	if err != nil || !before.Mode().IsRegular() || before.Size() < 1 {
		return "", 0, errors.New("native Pi history unavailable")
	}
	if owner, ok := fileOwner(before); !ok || owner != uid {
		return "", 0, errors.New("native Pi history owner mismatch")
	}
	// The lease holds every other writer off, so the file is read in a
	// stream, never held whole, and copied by a second stream below.
	counter := &countingReader{r: io.NewSectionReader(f, 0, before.Size())}
	native := decodeNativeStream(counter, path, nil)
	if counter.n != before.Size() {
		return "", 0, errors.New("native Pi history changed")
	}
	if !native.cutOff || native.state != "readable" || native.id != id || native.cwd != cwd {
		return "", 0, errors.New("native Pi history has no repairable tail")
	}
	end, err := lastNativeNewline(f, before.Size())
	if err != nil || end == 0 {
		return "", 0, errors.New("native Pi history has no repairable tail")
	}
	quarantine = path + ".partial-" + now.UTC().Format("20060102T150405.000000000Z")
	q, err := os.OpenFile(quarantine, os.O_WRONLY|os.O_CREATE|os.O_EXCL|syscall.O_NOFOLLOW, 0600)
	if err != nil {
		return "", 0, err
	}
	err = writeQuarantine(q, io.NewSectionReader(f, 0, before.Size()))
	if err == nil {
		err = q.Sync()
	}
	if closeErr := q.Close(); err == nil {
		err = closeErr
	}
	if err == nil {
		err = syncDir(filepath.Dir(path))
	}
	if err != nil {
		// An incomplete copy keeps nothing; the native file is untouched.
		_ = os.Remove(quarantine)
		return "", 0, err
	}
	after, err := f.Stat()
	if err != nil || after.Size() != before.Size() || !after.ModTime().Equal(before.ModTime()) {
		_ = os.Remove(quarantine)
		return "", 0, errors.New("native Pi history changed")
	}
	if err := f.Truncate(int64(end)); err != nil {
		return quarantine, 0, err
	}
	if err := f.Sync(); err != nil {
		return quarantine, 0, err
	}
	return quarantine, int(before.Size() - end), nil
}

func syncDir(dir string) error {
	d, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer d.Close()
	return d.Sync()
}

// readyNativeTail makes a proven native file safe for Pi to append to. It
// answers a start problem: "" when Pi may start, a storage reason when the
// quarantine copy could not be written, otherwise history_damaged/unproven.
func (c *ConversationController) readyNativeTail(path, id, cwd string) string {
	cutOff, err := reconciledNativeTail(path, c.cfg.UID, id, cwd)
	if errors.Is(err, errHistoryDamaged) {
		return "history_damaged"
	}
	if err != nil {
		return "unproven"
	}
	if !cutOff {
		return ""
	}
	log := diagnostic.New(os.Stderr, "daemon")
	var removed int
	for attempt := 0; ; attempt++ {
		// A history read of this daemon may hold the file open for a moment.
		_, removed, err = cutPartialTail(path, c.cfg.UID, id, cwd, time.Now())
		if err == nil || storageFailure(err) != "" || attempt == 4 {
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	if err != nil {
		if reason := storageFailure(err); reason != "" {
			log.Warn("native_history_tail", "outcome", "failed", "agent_id", "pi:"+id, "reason", reason)
			return reason
		}
		log.Warn("native_history_tail", "outcome", "failed", "agent_id", "pi:"+id, "reason", "unproven")
		return "unproven"
	}
	log.Warn("native_history_tail", "outcome", "quarantined", "agent_id", "pi:"+id, "removed_bytes", removed)
	return ""
}
