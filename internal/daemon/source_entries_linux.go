//go:build linux

package daemon

import (
	"io"
	"os"

	"golang.org/x/sys/unix"
)

// eachSourceEntry bounds individual directory reads without treating batch size
// as a limit on the collection. Callers must not infer absence on a read error.
func eachSourceEntry(src int, visit func(os.DirEntry)) error {
	dup, err := unix.Dup(src)
	if err != nil {
		return err
	}
	f := os.NewFile(uintptr(dup), "src")
	defer f.Close()
	for {
		entries, err := f.ReadDir(512)
		for _, entry := range entries {
			visit(entry)
		}
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
	}
}
