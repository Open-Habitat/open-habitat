//go:build linux

package daemon

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/url"

	"github.com/open-habitat/open-habitat/internal/core"
)

// SiteOriginPath holds the site's public facts, published by host maintenance
// from the site declaration: the browser origin and whether views are
// configured. It names no person, so every user may read it; only root may
// write it. It is display data for what the agent tells the person, never an
// identity or authorization input.
const SiteOriginPath = "/opt/open-habitat/site-origin.json"

var siteOriginPath = SiteOriginPath

// siteFacts is the published file. Views says whether the site declares a
// view origin; without one the browser shows no view cards.
type siteFacts struct {
	Origin string
	Views  bool
}

// loadSite returns the published facts, or an error when the file is missing,
// untrusted or malformed.
func loadSite(path string) (siteFacts, error) {
	data, err := core.ReadOperatorFile(path, 4096)
	if err != nil {
		return siteFacts{}, err
	}
	return parseSite(data)
}

func parseSite(data []byte) (siteFacts, error) {
	var cfg struct {
		Origin string `json:"origin"`
		Views  *bool  `json:"views"`
	}
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if dec.Decode(&cfg) != nil || dec.Decode(new(any)) != io.EOF || !bareHTTPSOrigin(cfg.Origin) || cfg.Views == nil {
		return siteFacts{}, errors.New("invalid site facts")
	}
	return siteFacts{Origin: cfg.Origin, Views: *cfg.Views}, nil
}

func bareHTTPSOrigin(s string) bool {
	u, err := url.Parse(s)
	// Reassembling from the host alone rejects any path, query, fragment or
	// credentials the published value might carry.
	return err == nil && len(s) <= 255 && u.Scheme == "https" && u.Host != "" && u.User == nil && "https://"+u.Host == s
}

func agentSite() map[string]any {
	site, err := loadSite(siteOriginPath)
	if err != nil {
		return map[string]any{"state": "unavailable", "reason": "site_origin_unavailable", "source": "site_origin_file"}
	}
	return map[string]any{"state": "available", "origin": site.Origin, "views": site.Views, "source": "site_origin_file"}
}
