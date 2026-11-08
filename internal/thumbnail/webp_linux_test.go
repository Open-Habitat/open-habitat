//go:build linux

package thumbnail

import (
	"bytes"
	"encoding/binary"
	"image"
	"testing"
)

func mismatchedWebP() []byte {
	var b bytes.Buffer
	b.WriteString("RIFF")
	_ = binary.Write(&b, binary.LittleEndian, uint32(36))
	b.WriteString("WEBPVP8X")
	_ = binary.Write(&b, binary.LittleEndian, uint32(10))
	b.Write(make([]byte, 10)) // declared 1x1 canvas
	b.WriteString("VP8L")
	_ = binary.Write(&b, binary.LittleEndian, uint32(5))
	b.WriteByte(0x2f)
	// Encoded lossless frame is 16384 x 16384, far above the pixel cap.
	_ = binary.Write(&b, binary.LittleEndian, uint32(0x0fffffff))
	b.WriteByte(0)
	return b.Bytes()
}

func TestWebPPreflightChecksFrameNotOnlyCanvas(t *testing.T) {
	data := mismatchedWebP()
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || format != "webp" || cfg.Width != 1 || cfg.Height != 1 {
		t.Fatalf("fixture config: %v %s %v", cfg, format, err)
	}
	if validWebPFrame(bytes.NewReader(data), cfg) {
		t.Fatal("accepted oversized actual frame")
	}
}
