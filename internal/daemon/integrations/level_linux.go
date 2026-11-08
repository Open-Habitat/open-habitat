//go:build linux

package integrations

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

// Level is an account level a person chooses when connecting: one boundary
// that the provider itself enforces, so it holds against an agent running as
// the person. A Microsoft level is an Entra application whose consented
// permissions every token of it carries; a Dropbox level is the App folder
// application or a narrower scope request to the Full Dropbox one. The
// level an account has is always read from its grant (LevelEntry.Level),
// never from a record of what was chosen: an organisation may grant less.
type Level string

const (
	LevelFull Level = "full"
	// LevelNoSend is everything but sending mail: mail is read, organised
	// and drafted, and calendars, contacts and files are changed. A calendar
	// change still sends invitations and a file grant can still create a
	// sharing link, since Graph has no permission without them.
	LevelNoSend Level = "nosend"
	// LevelDrafts is mail read and drafted but never sent, and everything
	// else read only: the account sends nothing (no invitations, no links).
	LevelDrafts Level = "drafts"
	LevelRead   Level = "read"
	// LevelAppFolder is Dropbox's own folder for the application alone.
	LevelAppFolder Level = "app_folder"
)

// LevelOption is a level the entry shows and whether it can be chosen: the
// operator registered what it needs, or the provider offers it at all.
type LevelOption struct {
	ID        Level `json:"id"`
	Available bool  `json:"available"`
	// Reason says why a level is not available.
	Reason LevelReason `json:"reason,omitempty"`
}

// LevelReason is why a level cannot be chosen.
type LevelReason string

const (
	// LevelApplicationMissing is a level whose application the server's
	// administrator has not registered.
	LevelApplicationMissing LevelReason = "application_missing"
	// LevelNotOffered is a level the provider has no boundary for, such as
	// Gmail drafts without sending: shown so the choice is honest.
	LevelNotOffered LevelReason = "not_offered"
)

// appLevel is a level that needs an operator's application.
func appLevel(id Level, registered bool) LevelOption {
	if registered {
		return LevelOption{ID: id, Available: true}
	}
	return LevelOption{ID: id, Reason: LevelApplicationMissing}
}

// LevelEntry is a sign-in whose account level the person chooses.
type LevelEntry interface {
	LoginEntry
	// Levels are the entry's levels in the page's order.
	Levels(env Env) []LevelOption
	// StartLevelLogin signs in at level. An empty level renews an existing
	// account at the level its native configuration was signed in with, or
	// connects a new one at the broadest level available.
	StartLevelLogin(ctx context.Context, env Env, address string, level Level) (Login, error)
	// Level is the account's level read from its grant and the services'
	// access, or "" when the grant matches none of the levels.
	Level(env Env, address string, services []Service) Level
}

// revokeFirstEntry is a level entry whose provider ends every token of the
// application at once when one is revoked (Google), so a level change cannot
// revoke the replaced login after the new sign-in as Dropbox does: the old
// grant ends before the person signs in again. endLevel runs under the
// catalog's write lock with the account's sync stopped, before the sign-in
// starts. Where files would stop syncing both ways it first syncs them both
// ways once more with the old grant; if that fails, or the old grant cannot
// be revoked, nothing changes. A sign-in the person then abandons leaves the
// account signed out, which a renewal repairs.
type revokeFirstEntry interface {
	LevelEntry
	endLevel(ctx context.Context, env Env, address string, level Level) error
}

// levelAvailable reports whether level is one of options and available.
func levelAvailable(options []LevelOption, level Level) bool {
	for _, o := range options {
		if o.ID == level {
			return o.Available
		}
	}
	return false
}

// firstLevel is the broadest available level, or "" when none is.
func firstLevel(options []LevelOption) Level {
	for _, o := range options {
		if o.Available {
			return o.ID
		}
	}
	return ""
}

// mirrorEntry is a file entry that keeps a read-only grant's files as a
// one-way mirror instead of leaving them unsynced.
type mirrorEntry interface{ mirrorsRead() }

// A read-only grant cannot sync both ways, so its files are a one-way
// mirror: each pass makes the local copy equal to the cloud, and a local
// change is overwritten by the next pass. rclone's sync keeps no listings of
// its own, so after each successful pass the loop marks it in the work
// directory, where bisync would keep its listings. The marker's time is the
// end of the latest successful pass, read like bisync's listings.
const mirrorDone = "mirror.done"

// mirrorCommand is one mirror pass from remote into the home-relative dir.
func mirrorCommand(base Command, env Env, remote, dir string) Command {
	base.Args = append(base.Args, "sync", remote, filepath.Join(env.Home, dir), "--create-empty-src-dirs")
	return base
}

// mirrorReady reports whether a work directory holds a finished mirror pass.
func mirrorReady(home, work string) bool {
	_, ok := mirrorSynced(home, work)
	return ok
}

func mirrorSynced(home, work string) (time.Time, bool) {
	fd, err := openHomeDir(home, false, splitPath(work)...)
	if err != nil {
		return time.Time{}, false
	}
	defer unix.Close(fd)
	var st unix.Stat_t
	if unix.Fstatat(fd, mirrorDone, &st, unix.AT_SYMLINK_NOFOLLOW) != nil || st.Mode&unix.S_IFMT != unix.S_IFREG {
		return time.Time{}, false
	}
	return time.Unix(st.Mtim.Unix()), true
}

// markMirrored records a finished mirror pass in the work directory.
func markMirrored(home, work string) error {
	fd, err := openHomeDir(home, true, splitPath(work)...)
	if err != nil {
		return err
	}
	defer unix.Close(fd)
	return writeFileAt(fd, mirrorDone, nil, 0600)
}

// initialMirror is the person's explicitly chosen first mirror pass. A local
// file the cloud lacks or has otherwise is moved to backup, never deleted:
// before this choice the directory may hold the person's own files.
func initialMirror(ctx context.Context, env Env, c Command, work, backup, service string) error {
	for _, rel := range []string{work, backup} {
		fd, err := openHomeDir(env.Home, true, splitPath(rel)...)
		if err != nil {
			return err
		}
		unix.Close(fd)
	}
	// Whatever bisync left here describes the other direction.
	if err := clearWork(env, work); err != nil {
		return err
	}
	c.Args = append(c.Args, "--backup-dir", filepath.Join(env.Home, backup))
	if err := env.runInitialSync(ctx, c, service); err != nil {
		return err
	}
	return markMirrored(env.Home, work)
}

// unmarkMirrored removes a mirror's marker before a two-way first pass, so
// the work directory says only what bisync commits there.
func unmarkMirrored(env Env, work string) error {
	fd, err := openHomeDir(env.Home, false, splitPath(work)...)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	defer unix.Close(fd)
	if err := unix.Unlinkat(fd, mirrorDone, 0); err != nil && !errors.Is(err, unix.ENOENT) {
		return err
	}
	return nil
}

// clearWork removes a work directory's files: bisync's listings, logs and
// lock, or the mirror's marker. It never recurses or follows a link.
func clearWork(env Env, work string) error {
	names, fd, err := listHomeDir(env.Home, work)
	if err != nil || fd < 0 {
		return err
	}
	defer unix.Close(fd)
	for _, n := range names {
		if err := unix.Unlinkat(fd, n, 0); err != nil {
			return err
		}
	}
	return nil
}

// grantKey is the rclone remote option where the daemon keeps the scopes the
// sign-in's token response granted, next to the token they belong to. rclone
// keeps an option it does not know through its own rewrites. It is read to
// choose the files' sync direction without the network, and for Dropbox, the
// only grant its token can be read from; it is the provider's answer, not
// the person's choice.
const grantKey = "habitat_grant"

// grantLine is the grantKey line for granted scopes, valid ones only.
func grantLine(scopes []string) string {
	var kept []string
	for _, s := range scopes {
		if grantScope.MatchString(s) && len(kept) < 64 {
			kept = append(kept, s)
		}
	}
	return grantKey + " = " + strings.Join(kept, " ") + "\n"
}
