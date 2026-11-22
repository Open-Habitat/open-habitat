//go:build linux

package browserhost

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"

	"golang.org/x/sys/unix"
)

// DefaultDownloadDirectory is the private initial destination for this profile.
// A person may choose a different destination in Chrome's native settings.
func DefaultDownloadDirectory(profile string) string {
	return filepath.Join(profile, "Downloads")
}

// preparePreferences runs under the host lock, before Chrome owns the profile.
// These are defaults, not managed policy: an existing choice (including a site
// exception) stays the person's. Linux policy directories are host-wide, not
// relative to --user-data-dir, so writing policy here would silently do nothing.
func preparePreferences(profile string) error {
	dir := filepath.Join(profile, "Default")
	downloads := DefaultDownloadDirectory(profile)
	for _, d := range []string{profile, dir, downloads} {
		if err := ownDir(d); err != nil {
			return err
		}
	}
	path := filepath.Join(dir, "Preferences")
	prefs := map[string]any{}
	f, err := os.OpenFile(path, os.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK, 0)
	if err == nil {
		defer f.Close()
		st, err := f.Stat()
		if err != nil {
			return err
		}
		if !st.Mode().IsRegular() || st.Size() > 16<<20 {
			return errors.New("unsafe browser preferences")
		}
		b, err := io.ReadAll(io.LimitReader(f, (16<<20)+1))
		if err != nil {
			return err
		}
		if len(b) > 16<<20 {
			return errors.New("browser preferences too large")
		}
		dec := json.NewDecoder(bytes.NewReader(b))
		dec.UseNumber() // Unrelated native values must not lose integer precision.
		if err := dec.Decode(&prefs); err != nil {
			return err
		}
		if prefs == nil {
			return errors.New("invalid browser preferences")
		}
		var trailing any
		if dec.Decode(&trailing) != io.EOF {
			return errors.New("invalid browser preferences")
		}
	} else if !os.IsNotExist(err) {
		return err
	}
	// Chrome represents choosing one of its own defaults by deleting the key.
	// Seed only once, or a later start would silently undo that user choice.
	if seeded, _ := prefs["open_habitat_site_defaults"].(bool); seeded {
		return nil
	}
	defaults := map[string]any{
		"session": map[string]any{"restore_on_startup": 1},
		"browser": map[string]any{"has_seen_welcome_page": true},
		"profile": map[string]any{
			"default_content_setting_values": map[string]any{
				"javascript": 1, "popups": 1, "automatic_downloads": 1,
				"notifications": 2,
			},
			"cookie_controls_mode": 0,
		},
		"credentials_enable_service":    false,
		"credentials_enable_autosignin": false,
		"download":                      map[string]any{"default_directory": downloads, "prompt_for_download": false},
		"plugins":                       map[string]any{"always_open_pdf_externally": false},
	}
	fillPreferenceDefaults(prefs, defaults)
	prefs["open_habitat_site_defaults"] = true
	b, err := json.Marshal(prefs)
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".Preferences-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err = tmp.Write(b); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err = tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

func fillPreferenceDefaults(prefs, defaults map[string]any) {
	for key, value := range defaults {
		existing, ok := prefs[key]
		if !ok {
			prefs[key] = value
			continue
		}
		child, childOK := existing.(map[string]any)
		fallback, fallbackOK := value.(map[string]any)
		if childOK && fallbackOK {
			fillPreferenceDefaults(child, fallback)
		}
	}
}
