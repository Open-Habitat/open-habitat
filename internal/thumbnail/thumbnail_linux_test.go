//go:build linux

package thumbnail

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func TestGenerate(t *testing.T) {
	for _, format := range []string{"png", "jpeg", "gif", "partial-gif", "webp", "malformed", "oversized", "webp-mismatch"} {
		t.Run(format, func(t *testing.T) {
			var b bytes.Buffer
			img := image.NewRGBA(image.Rect(0, 0, 640, 400))
			switch format {
			case "png":
				_ = png.Encode(&b, img)
			case "jpeg":
				_ = jpeg.Encode(&b, img, nil)
			case "gif":
				_ = gif.Encode(&b, img, nil)
			case "partial-gif":
				frame := image.NewPaletted(image.Rect(10, 10, 60, 60), color.Palette{color.Black})
				_ = gif.EncodeAll(&b, &gif.GIF{Image: []*image.Paletted{frame}, Delay: []int{0}, Config: image.Config{Width: 640, Height: 400}})
			case "webp":
				data, err := os.ReadFile("testdata/gopher.webp")
				if err != nil {
					t.Fatal(err)
				}
				b.Write(data)
			case "webp-mismatch":
				b.Write(mismatchedWebP())
			case "malformed":
				b.WriteString("not an image")
			case "oversized":
				// GIF's logical dimensions alone are enough to refuse, before any pixels.
				b.Write([]byte{'G', 'I', 'F', '8', '9', 'a', 255, 255, 255, 255, 0, 0, 0})
			}
			p := filepath.Join(t.TempDir(), "image")
			if err := os.WriteFile(p, b.Bytes(), 0600); err != nil {
				t.Fatal(err)
			}
			f, err := os.Open(p)
			if err != nil {
				t.Fatal(err)
			}
			defer f.Close()
			data, err := Generate(context.Background(), f)
			if format == "malformed" || format == "oversized" || format == "webp-mismatch" {
				if err == nil {
					t.Fatal("accepted invalid image")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			cfg, outputFormat, err := image.DecodeConfig(bytes.NewReader(data))
			dimensionsOK := cfg.Width == 320 && cfg.Height == 200
			if format == "webp" {
				dimensionsOK = cfg.Width > 0 && cfg.Width <= 320 && cfg.Height > 0 && cfg.Height <= 320
			}
			if err != nil || outputFormat != "jpeg" || !dimensionsOK || len(data) > MaxBytes {
				t.Fatalf("invalid thumbnail: %v %s %v bytes=%d", cfg, format, err, len(data))
			}
		})
	}
}

func TestGenerateCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	f, err := os.Open("thumbnail_linux.go")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	if _, err := Generate(ctx, f); err == nil {
		t.Fatal("accepted cancelled request")
	}
}
