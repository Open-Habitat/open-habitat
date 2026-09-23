//go:build linux

package daemon

import (
	"github.com/maintainer/native-agent-host/internal/nativegh"
	"github.com/maintainer/native-agent-host/internal/transport"
)

// NewNativeHandoff binds the mapped daemon configuration to its native CLI
// adapter. The caller still supplies the systemd listener to ServeHTTP.
func NewNativeHandoff(cfg transport.Config) (*transport.Server, *nativegh.Adapter, error) {
	adapter, err := nativegh.New(cfg.Home, cfg.Subject, nil, nativegh.LinuxSecretService())
	if err != nil {
		return nil, nil, err
	}
	server, err := transport.NewServer(cfg, adapter.Consumer())
	if err != nil {
		return nil, nil, err
	}
	return server, adapter, nil
}
