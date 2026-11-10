//go:build linux

package daemon

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"

	"github.com/open-habitat/open-habitat/internal/transport"
	"golang.org/x/sys/unix"
)

const FirstRoutePath = "/api/v1/account/first-route"

// firstRouteMark exists once the person has walked their first-login route
// to its end. It is the person's own state, read and written only by their
// daemon; the gateway knows only what the sign-in that created the account
// did (its receipt), never whether the route was walked. The browser asks
// only when that sign-in seeded the site AI key, because then usable Pi
// credentials no longer say that onboarding is over.
var firstRouteMark = []string{".local", "state", "open-habitat"}

const firstRouteFile = "first-route-finished"

func readFirstRoute(home string) (bool, error) {
	dir, err := personalDir(home, false, firstRouteMark...)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	defer dir.Close()
	var st unix.Stat_t
	err = unix.Fstatat(int(dir.Fd()), firstRouteFile, &st, unix.AT_SYMLINK_NOFOLLOW)
	if errors.Is(err, unix.ENOENT) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if st.Mode&unix.S_IFMT != unix.S_IFREG || st.Uid != uint32(os.Geteuid()) {
		return false, errors.New("unsafe first-route mark")
	}
	return true, nil
}

// finishFirstRoute creates the mark; an existing one is kept as it is.
func finishFirstRoute(home string) error {
	dir, err := personalDir(home, true, firstRouteMark...)
	if err != nil {
		return err
	}
	defer dir.Close()
	fd, err := unix.Openat(int(dir.Fd()), firstRouteFile, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if errors.Is(err, unix.EEXIST) {
		if done, e := readFirstRoute(home); e != nil || !done {
			return errors.New("unsafe first-route mark")
		}
		return nil
	}
	if err != nil {
		return err
	}
	if err = unix.Fsync(fd); err != nil {
		unix.Close(fd)
		return err
	}
	if err = unix.Close(fd); err != nil {
		return err
	}
	return dir.Sync()
}

func FirstRouteHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		put := r.Method == http.MethodPut
		if r.URL.Path != FirstRoutePath || r.URL.EscapedPath() != FirstRoutePath || r.URL.RawQuery != "" || len(r.TransferEncoding) != 0 || (!put && r.Method != http.MethodGet) || (!put && r.ContentLength > 0) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		var finished bool
		var err error
		if put {
			if r.ContentLength < 2 || r.ContentLength > 64 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 {
				snapshotError(w, 400, "invalid_request")
				return
			}
			// Finishing is the only write: the mark is never taken back.
			var value struct {
				Finished bool `json:"finished"`
			}
			dec := json.NewDecoder(io.LimitReader(r.Body, 65))
			dec.DisallowUnknownFields()
			if dec.Decode(&value) != nil || !value.Finished || dec.Decode(new(any)) != io.EOF {
				snapshotError(w, 400, "invalid_request")
				return
			}
			err = finishFirstRoute(cfg.Home)
			finished = err == nil
		} else {
			finished, err = readFirstRoute(cfg.Home)
		}
		if err != nil {
			snapshotError(w, 503, "first_route_unavailable")
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "web_identity_id": opaque("wid_", cfg.Provider+":"+cfg.Subject), "finished": finished})
	})
}
