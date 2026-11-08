//go:build linux

package thumbnail

import (
	"image"
	"io"

	"golang.org/x/image/riff"
	"golang.org/x/image/vp8"
	"golang.org/x/image/vp8l"
)

// WebP DecodeConfig may return the VP8X canvas without reading the actual
// frame dimensions. Validate both before the decoder can allocate the frame.
func validWebPFrame(r io.Reader, canvas image.Config) bool {
	form, chunks, err := riff.NewReader(r)
	if err != nil || form != (riff.FourCC{'W', 'E', 'B', 'P'}) {
		return false
	}
	for {
		id, size, data, err := chunks.Next()
		if err != nil {
			return false
		}
		switch id {
		case riff.FourCC{'V', 'P', '8', ' '}:
			if size > maxInput {
				return false
			}
			decoder := vp8.NewDecoder()
			decoder.Init(data, int(size))
			frame, err := decoder.DecodeFrameHeader()
			return err == nil && frame.Width == canvas.Width && frame.Height == canvas.Height
		case riff.FourCC{'V', 'P', '8', 'L'}:
			frame, err := vp8l.DecodeConfig(data)
			return err == nil && frame.Width == canvas.Width && frame.Height == canvas.Height
		}
	}
}
