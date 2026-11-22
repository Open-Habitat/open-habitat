//go:build linux

package cli

import (
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"unicode/utf8"
)

func readBoundedBrowserInput(r io.Reader) ([]byte, error) {
	b, err := io.ReadAll(io.LimitReader(r, (64<<10)+1))
	if err != nil {
		return nil, system("input_unavailable", "cannot read browser input")
	}
	if len(b) > 64<<10 || !utf8.Valid(b) {
		return nil, usage("browser text must be UTF-8 and at most 64 KiB")
	}
	return b, nil
}

// Filenames are caller-chosen, never taken from untrusted HTTP headers. O_EXCL
// refuses existing files and symlinks; partial outputs are removed on error.
func saveBrowserFile(dir, name string, b []byte) (string, error) {
	if !filepath.IsAbs(dir) {
		return "", fmt.Errorf("default download directory unavailable")
	}
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", fmt.Errorf("cannot create download directory")
	}
	root, err := os.OpenRoot(dir)
	if err != nil {
		return "", fmt.Errorf("cannot open download directory")
	}
	defer root.Close()
	f, err := root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		return "", fmt.Errorf("cannot create output; choose an unused --name")
	}
	_, err = f.Write(b)
	closeErr := f.Close()
	if err != nil || closeErr != nil {
		root.Remove(name)
		return "", fmt.Errorf("could not save complete output")
	}
	return filepath.Join(dir, name), nil
}

// Use Chrome's network stack and the attached page's frame: the original
// response, with the person's cookies, never a printed PDF viewer. No cookie
// extraction, new browser context, or Go-side authenticated HTTP client.
func (c *browserCDP) download(tab, url, dir, name string) (any, error) {
	var tree struct {
		Tree struct{ Frame struct{ ID string } } `json:"frameTree"`
	}
	if err := c.call("Page.getFrameTree", map[string]any{}, &tree); err != nil {
		return nil, err
	}
	var out struct {
		Resource struct {
			Success        bool
			HTTPStatusCode int
			Stream         string
		}
	}
	if err := c.call("Network.loadNetworkResource", map[string]any{"frameId": tree.Tree.Frame.ID, "url": url, "options": map[string]bool{"disableCache": false, "includeCredentials": true}}, &out); err != nil {
		return nil, err
	}
	r := out.Resource
	if r.Stream != "" {
		defer c.call("IO.close", map[string]any{"handle": r.Stream}, nil)
	}
	if !r.Success || r.HTTPStatusCode < 200 || r.HTTPStatusCode >= 300 || r.Stream == "" {
		return nil, fmt.Errorf("original download unavailable (HTTP %d); inspect sign-in and the source URL", r.HTTPStatusCode)
	}
	var data []byte
	for {
		var chunk struct {
			Data               string
			Base64Encoded, EOF bool
		}
		if err := c.call("IO.read", map[string]any{"handle": r.Stream, "size": 65536}, &chunk); err != nil {
			return nil, err
		}
		b := []byte(chunk.Data)
		if chunk.Base64Encoded {
			var err error
			b, err = base64.StdEncoding.DecodeString(chunk.Data)
			if err != nil {
				return nil, err
			}
		}
		if len(data)+len(b) > 64<<20 {
			return nil, fmt.Errorf("download exceeds 64 MiB limit")
		}
		data = append(data, b...)
		if chunk.EOF {
			break
		}
	}
	path, err := saveBrowserFile(dir, name, data)
	if err != nil {
		return nil, err
	}
	return map[string]any{"tab": tab, "path": path, "bytes": len(data), "http_status": r.HTTPStatusCode}, nil
}
