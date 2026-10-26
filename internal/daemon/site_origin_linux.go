//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/url"

	"github.com/Open-Habitat/open-habitat/internal/core"
)

// SiteOriginPath is the site's public browser origin, published by host
// maintenance from the site declaration. It names no person, so every user may
// read it; only root may write it. It is display data for links the agent
// gives the person, never an identity or authorization input.
const SiteOriginPath = "/opt/open-habitat/site-origin.json"

var siteOriginPath = SiteOriginPath

// loadSiteOrigin returns the published origin, or an error when the file is
// missing, untrusted or not a bare https origin.
func loadSiteOrigin(path string) (string, error) {
	data, err := core.ReadOperatorFile(path, 4096)
	if err != nil {
		return "", err
	}
	return parseSiteOrigin(data)
}

func parseSiteOrigin(data []byte) (string, error) {
	var cfg struct {
		Origin string `json:"origin"`
	}
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if dec.Decode(&cfg) != nil || dec.Decode(new(any)) != io.EOF || !bareHTTPSOrigin(cfg.Origin) {
		return "", errors.New("invalid site origin")
	}
	return cfg.Origin, nil
}

func bareHTTPSOrigin(s string) bool {
	u, err := url.Parse(s)
	// Reassembling from the host alone rejects any path, query, fragment or
	// credentials the published value might carry.
	return err == nil && len(s) <= 255 && u.Scheme == "https" && u.Host != "" && u.User == nil && "https://"+u.Host == s
}

func agentSite() map[string]any {
	origin, err := loadSiteOrigin(siteOriginPath)
	if err != nil {
		return map[string]any{"state": "unavailable", "reason": "site_origin_unavailable", "source": "site_origin_file"}
	}
	return map[string]any{"state": "available", "origin": origin, "source": "site_origin_file"}
}
