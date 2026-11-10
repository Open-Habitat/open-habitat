//go:build linux

package daemon

import (
	"bytes"
	"net/http"
	"os"
	"time"

	"github.com/open-habitat/open-habitat/internal/thumbnail"
	"golang.org/x/sys/unix"
)

func serveOfferThumbnail(w http.ResponseWriter, r *http.Request, store int, id, rel string) {
	fd, err := open(unix.Openat2, store, id+"/files/"+rel, unix.O_RDONLY|unix.O_NONBLOCK, true)
	if err != nil {
		snapshotError(w, 404, "file_not_found")
		return
	}
	f := os.NewFile(uintptr(fd), "offered image")
	defer f.Close()
	serveThumbnail(w, r, f)
}

func serveThumbnail(w http.ResponseWriter, r *http.Request, f *os.File) {
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(35 * time.Second))
	data, err := thumbnail.Generate(r.Context(), f)
	if err != nil {
		snapshotError(w, 404, "thumbnail_unavailable")
		return
	}
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Content-Disposition", "inline")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, "", time.Time{}, bytes.NewReader(data))
}
