//go:build linux

package daemon

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"syscall"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

const EditorPreferencePath = "/api/v1/account/editor-preference"

type editorPreference struct {
	Engine string `json:"engine"`
}

func validEditorEngine(engine string) bool { return engine == "codemirror6" || engine == "vscode" }

func editorPreferenceDir(home string, create bool) (*os.File, error) {
	return personalDir(home, create, ".config", "open-habitat")
}

// personalDir opens home/<parts...>. Use the mapped home, not the gateway's
// environment or a browser-supplied path. Open each directory without
// following symlinks and hold it across rename.
func personalDir(home string, create bool, parts ...string) (*os.File, error) {
	fd, err := unix.Open(home, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, err
	}
	for _, part := range parts {
		if create {
			if err = unix.Mkdirat(fd, part, 0700); err != nil && !errors.Is(err, unix.EEXIST) {
				unix.Close(fd)
				return nil, err
			}
		}
		next, e := unix.Openat(fd, part, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
		unix.Close(fd)
		if e != nil {
			return nil, e
		}
		fd = next
		var st unix.Stat_t
		if e = unix.Fstat(fd, &st); e != nil || st.Uid != uint32(os.Geteuid()) || st.Mode&0022 != 0 {
			unix.Close(fd)
			return nil, errors.New("unsafe configuration directory")
		}
	}
	return os.NewFile(uintptr(fd), "configuration"), nil
}

func readEditorPreference(home string) (editorPreference, error) {
	result := editorPreference{Engine: "codemirror6"}
	dir, err := editorPreferenceDir(home, false)
	if errors.Is(err, os.ErrNotExist) {
		return result, nil
	}
	if err != nil {
		return result, err
	}
	defer dir.Close()
	fd, err := unix.Openat(int(dir.Fd()), "editor.json", unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if errors.Is(err, os.ErrNotExist) {
		return result, nil
	}
	if err != nil {
		return result, err
	}
	f := os.NewFile(uintptr(fd), "editor preference")
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return result, err
	}
	if !st.Mode().IsRegular() || st.Size() > 4096 || st.Mode().Perm()&0022 != 0 || st.Sys().(*syscall.Stat_t).Uid != uint32(os.Geteuid()) {
		return result, errors.New("unsafe configuration file")
	}
	result = editorPreference{}
	dec := json.NewDecoder(io.LimitReader(f, 4097))
	dec.DisallowUnknownFields()
	if err = dec.Decode(&result); err != nil {
		return result, err
	}
	if !validEditorEngine(result.Engine) || dec.Decode(new(any)) != io.EOF {
		return result, errors.New("invalid editor preference")
	}
	return result, nil
}

func saveEditorPreference(home string, value editorPreference) error {
	if !validEditorEngine(value.Engine) {
		return errors.New("invalid editor preference")
	}
	dir, err := editorPreferenceDir(home, true)
	if err != nil {
		return err
	}
	defer dir.Close()
	var random [16]byte
	if _, err = rand.Read(random[:]); err != nil {
		return err
	}
	name := ".editor-" + hex.EncodeToString(random[:])
	fd, err := unix.Openat(int(dir.Fd()), name, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if err != nil {
		return err
	}
	defer unix.Unlinkat(int(dir.Fd()), name, 0)
	f := os.NewFile(uintptr(fd), "editor preference")
	defer f.Close()
	if err = json.NewEncoder(f).Encode(value); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	if err = unix.Renameat(int(dir.Fd()), name, int(dir.Fd()), "editor.json"); err != nil {
		return err
	}
	return dir.Sync()
}

func EditorPreferenceHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		put := r.Method == http.MethodPut
		if r.URL.Path != EditorPreferencePath || r.URL.EscapedPath() != EditorPreferencePath || r.URL.RawQuery != "" || len(r.TransferEncoding) != 0 || (!put && r.Method != http.MethodGet) || (!put && r.ContentLength > 0) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		var value editorPreference
		var err error
		if put {
			if r.ContentLength < 2 || r.ContentLength > 128 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			dec := json.NewDecoder(io.LimitReader(r.Body, 129))
			dec.DisallowUnknownFields()
			if dec.Decode(&value) != nil || !validEditorEngine(value.Engine) || dec.Decode(new(any)) != io.EOF {
				snapshotError(w, 400, "invalid_request")
				return
			}
			err = saveEditorPreference(cfg.Home, value)
		} else {
			value, err = readEditorPreference(cfg.Home)
		}
		if err != nil {
			snapshotError(w, 503, "editor_preference_unavailable")
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "web_identity_id": opaque("wid_", cfg.Provider+":"+cfg.Subject), "engine": value.Engine})
	})
}
