//go:build linux

package host

import (
	"archive/tar"
	"bufio"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"io/fs"
	"os"
	"path"
	"strings"
	"syscall"
)

var ErrReleaseArchive = errors.New("release_archive_invalid: archive digest, inventory or safe file policy failed")
var ErrReleaseStage = errors.New("release_staging_failed: private staging unavailable; no activation was attempted")

// StageRelease writes only a new private child of an already-open, root-owned
// 0700 parent. It returns that child's relative name, never an active generation.
// The caller owns the operation lock, trusted parent ancestry, lifecycle/cleanup,
// and subsequent qualification. No input archive path is reopened after hashing.
// Build archives use USTAR/GNU encoding; PAX metadata and all links are refused.
// All selected archives are copied and authenticated, then all tar inventories
// preflighted, before the first payload file is extracted. On failure the new
// child is removed; no predecessor or service is touched. This is not a durable
// install transaction and its existence must never authorize activation.
func (r AuthenticatedRelease) StageRelease(ctx context.Context, profiles []string, parent *os.Root, open func(string) (io.ReadCloser, error)) (string, error) {
	if os.Geteuid() != 0 {
		return "", ErrTrust
	}
	return r.stageRelease(ctx, profiles, parent, open, 0)
}

func (r AuthenticatedRelease) stageRelease(ctx context.Context, profiles []string, parent *os.Root, open func(string) (io.ReadCloser, error), owner uint32) (name string, err error) {
	artifacts, err := r.Select(profiles)
	if err != nil {
		return "", err
	}
	if parent == nil || open == nil {
		return "", ErrReleaseStage
	}
	st, e := parent.Stat(".")
	if e != nil || !st.IsDir() || st.Mode().Perm() != 0700 {
		return "", ErrReleaseStage
	}
	uid, ok := st.Sys().(*syscall.Stat_t)
	if !ok || uid.Uid != owner {
		return "", ErrReleaseStage
	}
	name = "release-" + rand.Text()
	if parent.Mkdir(name, 0700) != nil {
		return "", ErrReleaseStage
	}
	stage, e := parent.OpenRoot(name)
	if e != nil {
		_ = parent.Remove(name)
		return "", ErrReleaseStage
	}
	defer stage.Close()
	// Keep descriptors alive throughout validation/extraction. Even root-side
	// pathname replacement cannot swap the bytes we authenticated for extraction.
	files := map[string]*os.File{}
	defer func() {
		for _, f := range files {
			_ = f.Close()
		}
		if err != nil {
			if parent.RemoveAll(name) != nil {
				err = ErrReleaseStage
			}
			name = ""
		}
	}()
	if stage.Mkdir("archives", 0700) != nil || stage.Mkdir("payloads", 0700) != nil {
		return name, ErrReleaseStage
	}
	for _, a := range artifacts {
		if ctx.Err() != nil {
			return name, ctx.Err()
		}
		src, e := open(a.Archive)
		if e != nil {
			if ctx.Err() != nil {
				return name, ctx.Err()
			}
			return name, ErrReleaseStage
		}
		f, e := stage.OpenFile("archives/"+a.Profile, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0600)
		if e != nil {
			_ = src.Close()
			return name, ErrReleaseStage
		}
		files[a.Profile] = f
		e = spoolReleaseArchive(ctx, f, src, a)
		closeErr := src.Close()
		if e != nil {
			return name, e
		}
		if closeErr != nil {
			return name, ErrReleaseStage
		}
	}
	for _, a := range artifacts {
		if e := walkReleaseTar(ctx, files[a.Profile], a, nil); e != nil {
			return name, e
		}
	}
	for _, a := range artifacts {
		dest := "payloads/" + a.Profile
		if stage.Mkdir(dest, 0755) != nil {
			return name, ErrReleaseStage
		}
		root, e := stage.OpenRoot(dest)
		if e != nil {
			return name, ErrReleaseStage
		}
		if root.Chmod(".", 0755) != nil {
			_ = root.Close()
			return name, ErrReleaseStage
		}
		e = walkReleaseTar(ctx, files[a.Profile], a, root)
		_ = root.Close()
		if e != nil {
			return name, e
		}
	}
	for _, f := range files {
		if f.Close() != nil {
			return name, ErrReleaseStage
		}
	}
	clear(files)
	if stage.RemoveAll("archives") != nil {
		return name, ErrReleaseStage
	}
	return name, nil
}

type contextReader struct {
	ctx context.Context
	r   io.Reader
}

func (r contextReader) Read(b []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	return r.r.Read(b)
}

func walkReleaseTar(ctx context.Context, f *os.File, a ReleaseArtifact, dest *os.Root) (err error) {
	// Cancellation can happen in the gzip header, tar body or trailer, not only
	// between archives. Preserve its identity across all read/extraction errors.
	defer func() {
		if err != nil && ctx.Err() != nil {
			err = ctx.Err()
		}
	}()
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if _, e := f.Seek(0, io.SeekStart); e != nil {
		return ErrReleaseStage
	}
	br := bufio.NewReader(contextReader{ctx, f})
	gz, e := gzip.NewReader(br)
	if e != nil {
		return ErrReleaseArchive
	}
	defer gz.Close()
	gz.Multistream(false)
	limited := &io.LimitedReader{R: gz, N: a.ExpandedSize + 1}
	tr := tar.NewReader(limited)
	seen := map[string]byte{}
	directories := map[string]bool{}
	count := 0
	inventory := closureFileMap(a.Closure)
	var npmLock []byte
	for {
		h, e := tr.Next()
		if e == io.EOF {
			break
		}
		if e != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return ErrReleaseArchive
		}
		count++
		if count > a.Entries {
			return ErrReleaseArchive
		}
		name := h.Name
		if h.Typeflag == tar.TypeDir {
			name = strings.TrimSuffix(name, "/")
		}
		if !fs.ValidPath(name) || len(name) > 4096 || strings.ContainsAny(name, "\\\x00\r\n") || name == "." || seen[name] != 0 || len(h.PAXRecords) != 0 || len(h.Xattrs) != 0 {
			return ErrReleaseArchive
		}
		if h.Typeflag != tar.TypeDir && h.Typeflag != tar.TypeReg {
			return ErrReleaseArchive
		}
		if h.Mode != 0755 && (h.Typeflag != tar.TypeReg || h.Mode != 0644) {
			return ErrReleaseArchive
		}
		if h.Size < 0 || h.Size > a.ExpandedSize || (h.Typeflag == tar.TypeDir && h.Size != 0) {
			return ErrReleaseArchive
		}
		for p := path.Dir(name); p != "."; p = path.Dir(p) {
			if seen[p] == tar.TypeReg {
				return ErrReleaseArchive
			}
			directories[p] = true
		}
		if h.Typeflag == tar.TypeReg && directories[name] {
			return ErrReleaseArchive
		}
		seen[name] = h.Typeflag
		var expected RuntimeFile
		if a.Closure != nil {
			var ok bool
			expected, ok = inventory[name]
			if !ok || h.Typeflag != tar.TypeReg || h.Mode != expected.Mode {
				return ErrReleaseArchive
			}
			delete(inventory, name)
			if h.Size == 0 {
				for _, c := range a.Closure.Components {
					for _, license := range c.LicenseFiles {
						if license == name {
							return ErrReleaseArchive
						}
					}
				}
			}
		}
		var content bytes.Buffer
		hash := sha256.New()
		var capture io.Writer = hash
		if a.Closure != nil && name == "runtime/package-lock.json" {
			if h.Size > MaxReleaseManifestBytes {
				return ErrReleaseArchive
			}
			capture = io.MultiWriter(hash, &content)
		}
		var payload io.Reader = tr
		if a.Closure != nil {
			payload = io.TeeReader(tr, capture)
		}
		var out *os.File
		if dest != nil {
			if makeReleaseDirs(dest, path.Dir(name)) != nil {
				return ErrReleaseStage
			}
			if h.Typeflag == tar.TypeDir {
				if makeReleaseDirs(dest, name) != nil {
					return ErrReleaseStage
				}
			} else {
				out, e = dest.OpenFile(name, os.O_CREATE|os.O_EXCL|os.O_WRONLY, fs.FileMode(h.Mode))
				if e != nil {
					return ErrReleaseStage
				}
			}
		}
		if out != nil {
			if out.Chmod(fs.FileMode(h.Mode)) != nil {
				_ = out.Close()
				return ErrReleaseStage
			}
			_, e = io.Copy(out, payload)
			ce := out.Close()
			if e != nil || ce != nil {
				return ErrReleaseStage
			}
		} else if _, e = io.Copy(io.Discard, payload); e != nil {
			return ErrReleaseArchive
		}
		if a.Closure != nil {
			if hex.EncodeToString(hash.Sum(nil)) != expected.SHA256 {
				return ErrReleaseArchive
			}
			if name == "runtime/package-lock.json" {
				npmLock = content.Bytes()
			}
		}
	}
	if a.Closure != nil {
		needsNPM := a.Profile == "core"
		for _, c := range a.Closure.Components {
			needsNPM = needsNPM || c.Kind == "npm"
		}
		if len(inventory) != 0 || (needsNPM && !verifyNPMLock(npmLock, a.Closure)) {
			return ErrReleaseArchive
		}
	}
	// tar stops at its end marker. Drain/validate gzip's checksum and allow only
	// zero tar padding, not a hidden second tar, gzip member or trailing payload.
	_, e = io.Copy(zeroPadding{}, limited)
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if e != nil || limited.N != 1 || count != a.Entries {
		return ErrReleaseArchive
	}
	if _, e = br.ReadByte(); e != io.EOF {
		return ErrReleaseArchive
	}
	return nil
}

type zeroPadding struct{}

func (zeroPadding) Write(b []byte) (int, error) {
	for _, v := range b {
		if v != 0 {
			return 0, ErrReleaseArchive
		}
	}
	return len(b), nil
}

// The maintenance process may use umask 077. Exact safe payload modes should
// not accidentally depend on that ambient setting. The tree is still behind
// the private stage parent and contains no links.
func makeReleaseDirs(root *os.Root, name string) error {
	if name == "." {
		return nil
	}
	current := ""
	for _, part := range strings.Split(name, "/") {
		current = path.Join(current, part)
		if err := root.MkdirAll(current, 0755); err != nil {
			return err
		}
		if err := root.Chmod(current, 0755); err != nil {
			return err
		}
	}
	return nil
}

func spoolReleaseArchive(ctx context.Context, dest io.Writer, src io.Reader, a ReleaseArtifact) error {
	h := sha256.New()
	n, err := io.Copy(io.MultiWriter(dest, h), io.LimitReader(contextReader{ctx, src}, a.Size+1))
	if ctx.Err() != nil {
		return ctx.Err()
	}
	// A failing source or full staging filesystem is an unavailable operation,
	// not evidence that the release bytes violate integrity policy.
	if err != nil {
		return ErrReleaseStage
	}
	if n != a.Size || hex.EncodeToString(h.Sum(nil)) != a.SHA256 {
		return ErrReleaseArchive
	}
	return nil
}
