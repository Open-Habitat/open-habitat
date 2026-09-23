// Package core contains authority-neutral application primitives.
package core

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
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
	Component Component `json:"component"`
	Listen    string    `json:"listen"`
	StaticDir string    `json:"static_dir,omitempty"`
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
	if cfg.Component != expected {
		return Config{}, fmt.Errorf("config component %q does not match %q", cfg.Component, expected)
	}
	if cfg.Listen == "" {
		return Config{}, errors.New("config listen must not be empty")
	}
	return cfg, nil
}
