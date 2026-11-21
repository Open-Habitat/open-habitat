package jsoncheck

import "testing"

func TestNoDuplicates(t *testing.T) {
	for _, tc := range []struct {
		name, input string
		want        bool
	}{
		{"object", `{"a":1,"b":2}`, true},
		{"nested", `{"a":[{"x":1},{"x":2}],"b":{"x":3}}`, true},
		{"scalar", `null`, true},
		{"whitespace", " \n [true, false, 1, \"x\"] \t", true},
		{"duplicate", `{"a":1,"a":2}`, false},
		{"escaped duplicate", `{"a":1,"\u0061":2}`, false},
		{"nested duplicate", `[{"a":{"x":1,"x":2}}]`, false},
		{"empty", ``, false},
		{"trailing value", `{} []`, false},
		{"trailing junk", `{} x`, false},
		{"missing value", `{"a":}`, false},
		{"missing close", `[{"a":1}`, false},
		{"wrong close", `{"a":1]`, false},
		{"trailing comma", `[1,]`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := NoDuplicates([]byte(tc.input)); got != tc.want {
				t.Fatalf("NoDuplicates(%q) = %v, want %v", tc.input, got, tc.want)
			}
		})
	}
}
