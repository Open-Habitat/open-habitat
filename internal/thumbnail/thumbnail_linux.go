//go:build linux

// Package thumbnail decodes untrusted images in a disposable, same-UID child.
package thumbnail

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/draw"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"io"
	"os"
	"os/exec"
	"time"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
	"golang.org/x/sys/unix"
)

const workerArg = "--open-habitat-thumbnail-worker"
const MaxBytes = 128 << 10
const maxInput = 64 << 20
const maxPixels = 16_000_000

// A process, rather than a goroutine, lets cancellation stop the decoder itself.
// No path or identity is accepted: the parent passes an already authorized fd.
func init() {
	if len(os.Args) != 2 || os.Args[1] != workerArg {
		return
	}
	if unix.Setrlimit(unix.RLIMIT_AS, &unix.Rlimit{Cur: 2 << 30, Max: 2 << 30}) != nil ||
		unix.Setrlimit(unix.RLIMIT_CPU, &unix.Rlimit{Cur: 3, Max: 3}) != nil {
		os.Exit(1)
	}
	f := os.NewFile(3, "image")
	if f == nil {
		os.Exit(1)
	}
	data, err := render(f)
	if err != nil {
		os.Exit(1)
	}
	if _, err = os.Stdout.Write(data); err != nil {
		os.Exit(1)
	}
	os.Exit(0)
}

var slots = make(chan struct{}, 2)
var unavailable = errors.New("thumbnail unavailable")

// Generate bounds concurrent work, input, pixels, output, CPU, address space and
// wall time. No cache is needed: only the small JPEG crosses the connection.
func Generate(ctx context.Context, f *os.File) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	select {
	case slots <- struct{}{}:
		defer func() { <-slots }()
	case <-ctx.Done():
		return nil, unavailable
	}
	ctx, stopDecode := context.WithTimeout(ctx, 4*time.Second)
	defer stopDecode()
	exe, err := os.Executable()
	if err != nil {
		return nil, unavailable
	}
	cmd := exec.CommandContext(ctx, exe, workerArg)
	cmd.Env = []string{"GOMEMLIMIT=128MiB", "GOMAXPROCS=1"}
	cmd.ExtraFiles = []*os.File{f}
	var out boundedOutput
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil || out.Len() == 0 {
		return nil, unavailable
	}
	return out.Bytes(), nil
}

type boundedOutput struct{ bytes.Buffer }

func (b *boundedOutput) Write(p []byte) (int, error) {
	if b.Len()+len(p) > MaxBytes {
		return 0, unavailable
	}
	return b.Buffer.Write(p)
}

func render(f *os.File) ([]byte, error) {
	st, err := f.Stat()
	if err != nil || !st.Mode().IsRegular() || st.Size() > maxInput {
		return nil, unavailable
	}
	cfg, format, err := image.DecodeConfig(io.NewSectionReader(f, 0, 1<<20))
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 || cfg.Width > maxPixels/cfg.Height {
		return nil, unavailable
	}
	if format == "webp" && !validWebPFrame(io.NewSectionReader(f, 0, maxInput), cfg) {
		return nil, unavailable
	}
	img, _, err := image.Decode(io.NewSectionReader(f, 0, maxInput))
	if err != nil || img.Bounds().Dx() > cfg.Width || img.Bounds().Dy() > cfg.Height {
		return nil, unavailable
	}
	w, h := cfg.Width, cfg.Height
	if w > 320 || h > 320 {
		if w >= h {
			h = max(1, h*320/w)
			w = 320
		} else {
			w = max(1, w*320/h)
			h = 320
		}
	}
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.Draw(dst, dst.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
	// GIF frames may occupy only part of the logical canvas.
	xdraw.BiLinear.Scale(dst, dst.Bounds(), img, image.Rect(0, 0, cfg.Width, cfg.Height), draw.Over, nil)
	var out boundedOutput
	if err := jpeg.Encode(&out, dst, &jpeg.Options{Quality: 75}); err != nil {
		return nil, unavailable
	}
	return out.Bytes(), nil
}
