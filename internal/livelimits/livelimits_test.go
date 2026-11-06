package livelimits

import "testing"

func TestParseIsStrictAndEncodeCanonical(t *testing.T) {
	f, err := Parse([]byte(`{"people":{"2101":40,"2100":4},"default":12,"version":1}`))
	if err != nil || f.Default != 12 || f.People[2101] != 40 || f.People[2100] != 4 {
		t.Fatal(f, err)
	}
	b, err := Encode(f)
	if err != nil || string(b) != `{"version":1,"default":12,"people":{"2100":4,"2101":40}}`+"\n" {
		t.Fatalf("%q %v", b, err)
	}
	if n, s := f.For(2100); n != 4 || s != SourceOwn {
		t.Fatal(n, s)
	}
	if n, s := f.For(7); n != 12 || s != SourceInstallation {
		t.Fatal(n, s)
	}
	if n, s := (File{}).For(7); n != HostDefault || s != SourceDefault {
		t.Fatal(n, s)
	}
	for _, bad := range []string{
		`{"version":2}`,
		`{"version":1,"default":0}`,
		`{"version":1,"default":129}`,
		`{"version":1,"people":{"0":3}}`,
		`{"version":1,"people":{"01":3}}`,
		`{"version":1,"people":{"x":3}}`,
		`{"version":1,"people":{"5":null}}`,
		`{"version":1,"other":1}`,
		`{"version":1}{}`,
	} {
		if _, err := Parse([]byte(bad)); err == nil {
			t.Errorf("accepted %s", bad)
		}
	}
}
