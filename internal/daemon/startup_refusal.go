package daemon

import "errors"

// Startup refusal codes name which check made ServeHTTP return. The service
// journal carries the code next to server_failed; the wrapped error, which
// may hold native text, never reaches it. Each code is a fixed word so an
// operator can repair the right thing without the log naming a path, a home
// or a credential.
const (
	RefusalAdapterUnavailable = "adapter_unavailable"
	RefusalTransportConfig    = "transport_config_refused"
	RefusalPiRuntimeMissing   = "pi_runtime_missing"
	RefusalPiConfiguration    = "pi_configuration_refused"
	RefusalPiSelector         = "pi_selector_refused"
	RefusalPiRuntimeUntrusted = "pi_runtime_untrusted"
	RefusalPiRuntimeVersion   = "pi_runtime_version_unsupported"
	RefusalDaemonListener     = "daemon_listener_refused"
	RefusalDaemonServeEnded   = "daemon_serve_ended"
	RefusalAgentListener      = "agent_listener_refused"
	RefusalAgentServeEnded    = "agent_serve_ended"
	RefusalUnclassified       = "unclassified"
)

// StartupRefusal carries one of the codes above around the error that caused
// it.
type StartupRefusal struct {
	Code string
	err  error
}

func (e *StartupRefusal) Error() string { return e.err.Error() }
func (e *StartupRefusal) Unwrap() error { return e.err }

func refuse(code string, err error) error {
	if err == nil {
		return nil
	}
	return &StartupRefusal{Code: code, err: err}
}

// StartupRefusalCode returns the code of the check that refused, or
// "unclassified" for an error that ServeHTTP did not tag.
func StartupRefusalCode(err error) string {
	var r *StartupRefusal
	if errors.As(err, &r) {
		return r.Code
	}
	return RefusalUnclassified
}
