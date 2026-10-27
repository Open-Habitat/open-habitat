//go:build linux

package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
)

const fixtureAttachmentID = "33333333-3333-4333-8333-333333333333"

// seedImageHistory writes a native session where the person sent an image
// attachment and a tool returned a large image. Like a browser send, the
// person's message carries the reference, the host's path line and the
// image block Pi received; the attachment itself is in the home.
func seedImageHistory(path, home, cwd string) error {
	shot := image.NewRGBA(image.Rect(0, 0, 1600, 1000))
	for y := 0; y < 1000; y++ {
		for x := 0; x < 1600; x++ {
			shot.Set(x, y, color.RGBA{uint8(x * 255 / 1600), uint8(y * 255 / 1000), 160, 255})
		}
	}
	var encoded bytes.Buffer
	if e := png.Encode(&encoded, shot); e != nil {
		return e
	}
	data := encoded.Bytes()
	if e := os.MkdirAll(filepath.Join(home, "attachments"), 0700); e != nil {
		return e
	}
	if e := os.WriteFile(filepath.Join(home, "attachments", fixtureAttachmentID), data, 0600); e != nil {
		return e
	}
	payload := base64.StdEncoding.EncodeToString(data)
	text := "Katso kuvaa\n![screen.png](/api/v1/attachments/" + fixtureAttachmentID + ")\nAttachment path: " + filepath.Join(home, "attachments", fixtureAttachmentID)
	block := map[string]any{"type": "image", "data": payload, "mimeType": "image/png"}
	rows := []map[string]any{
		{"type": "session", "version": 3, "id": "11111111-1111-4111-8111-111111111111", "cwd": cwd},
		{"type": "message", "id": "img-user", "message": map[string]any{"role": "user", "content": []any{map[string]any{"type": "text", "text": text}, block}}},
		{"type": "message", "id": "img-call", "message": map[string]any{"role": "assistant", "stopReason": "toolUse", "content": []any{map[string]any{"type": "toolCall", "id": "shot1", "name": "screenshot", "arguments": map[string]any{}}}}},
		{"type": "message", "id": "img-result", "message": map[string]any{"role": "toolResult", "toolCallId": "shot1", "toolName": "screenshot", "content": []any{block}}},
		{"type": "message", "id": "img-reply", "message": map[string]any{"role": "assistant", "stopReason": "stop", "content": []any{map[string]any{"type": "text", "text": "Kuvakaappaus otettu."}}}},
	}
	f, e := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if e != nil {
		return e
	}
	defer f.Close()
	encode := json.NewEncoder(f)
	for _, row := range rows {
		if e := encode.Encode(row); e != nil {
			return e
		}
	}
	return f.Sync()
}
