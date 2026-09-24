//go:build !linux

package cli

func brokerCommand(args []string) (any, error) {
	if len(args) != 1 || args[0] != "exec" {
		return nil, usage("expected broker exec")
	}
	return nil, system("unsupported_platform", "root broker requires Linux")
}
