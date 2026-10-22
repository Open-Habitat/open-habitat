// Package installationpolicy embeds the same neutral policy bytes that the
// release ships. Deliberate host preparation must not create a second version
// of files an external installation transport also authenticates and installs.
package installationpolicy

import _ "embed"

//go:embed systemd/open-habitat-proc.service
var ProcService string

//go:embed systemd/systemd-logind.service.d/open-habitat-proc.conf
var LogindDropIn string

//go:embed systemd/polkit.service.d/open-habitat-proc.conf
var PolkitDropIn string

//go:embed tmpfiles.d/open-habitat.conf
var Tmpfiles string

//go:embed systemd/open-habitat-storage.service
var StorageService string

//go:embed systemd/open-habitat-broker.socket
var BrokerSocket string

//go:embed systemd/open-habitat-broker.service
var BrokerService string

//go:embed systemd/open-habitat-daemon@.socket
var DaemonSocket string

//go:embed systemd/open-habitat-agent@.socket
var AgentSocket string

//go:embed systemd/open-habitat-binding@.service
var BindingService string
