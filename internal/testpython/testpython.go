// Package testpython gives tests the Python that runs the repository's
// contract validator. The validator needs jsonschema and referencing at the
// versions pinned in requirements-ci.txt; a host's system python3 often lacks
// them, and a bare ModuleNotFoundError in a schema check reads like a product
// failure. scripts/test-focused.sh and scripts/ci-local.sh export $PYTHON as
// a venv with those pins.
package testpython

import (
	"os"
	"os/exec"
	"sync"
	"testing"
)

var probe = sync.OnceValues(func() (string, error) {
	python := os.Getenv("PYTHON")
	if python == "" {
		python = "python3"
	}
	out, err := exec.Command(python, "-c", "import jsonschema, referencing").CombinedOutput()
	if err != nil {
		return python, &missing{python: python, out: string(out), err: err}
	}
	return python, nil
})

type missing struct {
	python, out string
	err         error
}

func (m *missing) Error() string {
	return m.python + " cannot import jsonschema/referencing (" + m.err.Error() + "): " + m.out +
		"run Go tests through ./scripts/test-focused.sh --area go, or set PYTHON to a Python with requirements-ci.txt installed"
}

// Validator returns the Python to run scripts/validate-contracts.py with, or
// fails the test with directions when it lacks the pinned modules.
func Validator(t testing.TB) string {
	t.Helper()
	python, err := probe()
	if err != nil {
		t.Fatal(err)
	}
	return python
}
