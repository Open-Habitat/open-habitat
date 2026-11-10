// Package core contains authority-neutral application primitives.
package core

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/open-habitat/open-habitat/internal/gateway"
	"github.com/open-habitat/open-habitat/internal/transport"
	"io"
	"os"
	"path/filepath"
	"syscall"
)

// Component identifies one runtime role. The gateway never reads user homes;
// the daemon runs as the mapped Unix user and owns native process access.
type Component string

const (
	Gateway Component = "gateway"
	Daemon  Component = "daemon"
)

// Config is intentionally small until a product slice proves another setting.
type Config struct {
	EntryGate  string               `json:"entry_gate,omitempty"`
	Component  Component            `json:"component"`
	Listen     string               `json:"listen"`
	StaticDir  string               `json:"static_dir,omitempty"`
	OAuth      *gateway.OAuthConfig `json:"oauth,omitempty"`
	GatewayUID *int                 `json:"gateway_uid,omitempty"`
	TLSCert    string               `json:"tls_cert,omitempty"`
	TLSKey     string               `json:"tls_key,omitempty"`
	Handoff    *transport.Config    `json:"handoff,omitempty"`
	PiRuntime  *PiRuntimeConfig     `json:"pi_runtime,omitempty"`
}

// PiRuntimeConfig identifies an immutable root-owned installation. Mapped
// daemons take it from the separate installation-wide selector, not their
// broker-verified identity binding or a browser request.
type PiRuntimeConfig struct {
	Node     string `json:"node"`
	Entry    string `json:"entry"`
	Manifest string `json:"manifest"`
}

func LoadConfig(path string, expected Component) (Config, error) {
	if path == "" {
		return Config{}, errors.New("config path must not be empty")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return Config{}, fmt.Errorf("read config %q: %w", path, err)
	}
	var cfg Config
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&cfg); err != nil {
		return Config{}, fmt.Errorf("parse config %q: %w", path, err)
	}
	var trailing any
	if err := dec.Decode(&trailing); err != io.EOF {
		if err == nil {
			err = errors.New("multiple JSON values")
		}
		return Config{}, fmt.Errorf("parse trailing content in config %q: %w", path, err)
	}
	if cfg.EntryGate != "" && (expected != Gateway || cfg.EntryGate != "/etc/open-habitat/maintenance") {
		return Config{}, errors.New("invalid gateway entry gate")
	}
	if cfg.Component != expected {
		return Config{}, fmt.Errorf("config component %q does not match %q", cfg.Component, expected)
	}
	if cfg.Listen == "" && cfg.Handoff == nil {
		return Config{}, errors.New("config listen must not be empty")
	}
	if cfg.OAuth != nil || cfg.Handoff != nil || cfg.PiRuntime != nil {
		info, e := os.Lstat(path)
		if e == nil && (info.Mode()&os.ModeSymlink != 0 || !filepath.IsAbs(path) || filepath.Clean(path) != path) {
			return Config{}, errors.New("invalid trusted config")
		}
		for dir := filepath.Dir(path); e == nil && dir != "/"; dir = filepath.Dir(dir) {
			parent, pe := os.Lstat(dir)
			if pe != nil {
				return Config{}, errors.New("invalid trusted config")
			}
			owner, ownerOK := parent.Sys().(*syscall.Stat_t)
			if !ownerOK || owner.Uid != 0 || !parent.IsDir() || parent.Mode()&os.ModeSymlink != 0 || parent.Mode().Perm()&0022 != 0 {
				return Config{}, errors.New("invalid trusted config")
			}
		}
		if e != nil {
			return Config{}, errors.New("invalid trusted config")
		}
		stat, ok := info.Sys().(*syscall.Stat_t)
		if !ok || stat.Uid != 0 || info.Mode().Perm()&0022 != 0 || !info.Mode().IsRegular() {
			return Config{}, errors.New("invalid trusted config")
		}
	}
	if cfg.OAuth != nil && (expected != Gateway || cfg.TLSCert == "" || cfg.TLSKey == "" || cfg.Handoff != nil || cfg.GatewayUID == nil || *cfg.GatewayUID <= 0 || *cfg.GatewayUID != os.Geteuid()) {
		return Config{}, errors.New("invalid gateway auth config")
	}
	if cfg.Handoff != nil && (expected != Daemon || cfg.OAuth != nil || cfg.Listen != "" || cfg.GatewayUID != nil) {
		return Config{}, errors.New("invalid daemon handoff config")
	}
	if cfg.PiRuntime != nil && (expected != Daemon || cfg.Handoff == nil || cfg.PiRuntime.Node == "" || cfg.PiRuntime.Entry == "" || cfg.PiRuntime.Manifest == "") {
		return Config{}, errors.New("invalid daemon Pi runtime config")
	}
	return cfg, nil
}
