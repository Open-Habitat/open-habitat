//go:build linux

package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"
)

// realisticToken is as long as the token Entra issues a work account: the
// token line of each root in a pilot's config was about 4,760 bytes.
func realisticToken(access string, expiry time.Time) []byte {
	token, _ := json.Marshal(map[string]any{"access_token": access + strings.Repeat("A", 3600-len(access)), "token_type": "Bearer", "refresh_token": "refresh-secret" + strings.Repeat("R", 1000), "expiry": expiry.UTC().Format(time.RFC3339)})
	return token
}

func testTeamID(i int) string { return fmt.Sprintf("%08x-0000-4000-8000-%012x", i+1, i+1) }

// manyTeams answers Graph as a tenant where the person follows one site and
// has joined len(libraries) teams, team i with libraries[i] libraries whose
// drive IDs are as long as Graph's. It records the Graph paths asked.
func manyTeams(t *testing.T, libraries []int) (*microsoft, *[]string) {
	t.Helper()
	m := syntheticMicrosoft(t, "person@example.test", "")
	base := m.client.Transport
	var asked []string
	var mu sync.Mutex
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		mu.Lock()
		asked = append(asked, r.URL.Path)
		mu.Unlock()
		body := ""
		switch {
		case r.URL.Path == "/"+testTenant+"/oauth2/v2.0/token":
			// The sign-in's grant includes the team list.
			body = `{"access_token":"access-secret","refresh_token":"refresh-secret","expires_in":3600,"scope":"User.Read Files.ReadWrite.All Sites.ReadWrite.All Team.ReadBasic.All"}`
		case r.URL.Path == "/v1.0/me/joinedTeams":
			var teams []string
			for i := range libraries {
				teams = append(teams, fmt.Sprintf(`{"id":%q,"displayName":"Contoso-tiimi %02d"}`, testTeamID(i), i+1))
			}
			body = `{"value":[` + strings.Join(teams, ",") + `]}`
		case strings.HasPrefix(r.URL.Path, "/v1.0/groups/"):
			i := -1
			for j := range libraries {
				if strings.Contains(r.URL.Path, testTeamID(j)) {
					i = j
				}
			}
			body = fmt.Sprintf(`{"id":"contoso.sharepoint.com,%s,%s","displayName":"Contoso-tiimi %02d","webUrl":"https://contoso.sharepoint.com/sites/contoso-tiimi-%02d"}`, testTeamID(i), testTeamID(i), i+1, i+1)
		case strings.HasPrefix(r.URL.Path, "/v1.0/sites/contoso.sharepoint.com,") && strings.HasSuffix(r.URL.Path, "/drives") && !strings.Contains(r.URL.Path, "2C712604"):
			var drives []string
			for j := range libraries {
				if !strings.Contains(r.URL.Path, testTeamID(j)) {
					continue
				}
				for k := 0; k < libraries[j]; k++ {
					drives = append(drives, fmt.Sprintf(`{"id":"b!%s%04d%04d","name":"Jaetut asiakirjat %d","driveType":"documentLibrary"}`, strings.Repeat("x", 56), j, k, k+1))
				}
			}
			body = `{"value":[` + strings.Join(drives, ",") + `]}`
		default:
			return base.RoundTrip(r)
		}
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}, nil
	})
	return m, &asked
}

var testManyTeamsScopes = map[string]bool{"Files.ReadWrite.All": true, "Sites.ReadWrite.All": true, "Team.ReadBasic.All": true}

func manyTeamsLogin(m *microsoft, token []byte) *microsoftLogin {
	return &microsoftLogin{entry: m, address: "person@example.test", app: MicrosoftApp{ClientID: "00000000-0000-0000-0000-000000000001", TenantID: testTenant}, token: token, granted: []string{"Files.ReadWrite.All", "Sites.ReadWrite.All", "Team.ReadBasic.All"}}
}

// writeConfig keeps config as the account's rclone config.
func writeConfig(t *testing.T, env Env, address string, config []byte) string {
	t.Helper()
	dir := filepath.Join(env.Home, microsoftDir)
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, address+".conf")
	if err := os.WriteFile(path, config, 0600); err != nil {
		t.Fatal(err)
	}
	return path
}

// With real token sizes, a person in thirty teams is offered all of them:
// the token is written once, not once per library.
func TestMicrosoftOneTokenFitsManyRoots(t *testing.T) {
	m, _ := manyTeams(t, slices.Repeat([]int{1}, 30))
	l := manyTeamsLogin(m, realisticToken("access-secret", time.Now().Add(time.Hour)))
	if err := l.discover(context.Background(), "access-secret", testManyTeamsScopes); err != nil {
		t.Fatal(err)
	}
	if l.teamsLeftOut == teamsTooMany || len(l.teamsNotOffered) != 0 {
		t.Fatal("teams left out", l.teamsNotOffered)
	}
	if n := strings.Count(string(l.config), "\ntoken = "); n != 1 {
		t.Fatal("tokens in the config:", n)
	}
	env := microsoftEnv(t)
	writeConfig(t, env, l.address, l.config)
	roots, legacy, err := microsoftReadRoots(env, l.address)
	if err != nil || len(legacy) != 0 || len(roots) != 32 {
		t.Fatal(len(roots), legacy, err)
	}
	for _, r := range roots {
		if !r.Writable || r.Label == "" || !microsoftDriveID.MatchString(r.DriveID) {
			t.Fatalf("root %+v", r)
		}
	}
}

// Teams beyond the remote bound are named, and Graph is not asked about
// them once nothing more can fit. The bound is the count of roots, not the
// file: 64 roots with real token and name sizes fit the file.
func TestMicrosoftTeamsBeyondTheBoundAreNamed(t *testing.T) {
	m, asked := manyTeams(t, slices.Repeat([]int{1}, 70))
	l := manyTeamsLogin(m, realisticToken("access-secret", time.Now().Add(time.Hour)))
	if err := l.discover(context.Background(), "access-secret", testManyTeamsScopes); err != nil {
		t.Fatal(err)
	}
	if strings.Count(string(l.config), "\n[sp-") != maxMicrosoftRemotes-1 || len(l.config) > maxMicrosoftConfig {
		t.Fatal(strings.Count(string(l.config), "\n[sp-"), len(l.config))
	}
	// OneDrive and the followed library come first: 62 teams fit.
	var want []string
	for i := 63; i <= 70; i++ {
		want = append(want, fmt.Sprintf("Contoso-tiimi %02d", i))
	}
	if l.teamsLeftOut != teamsTooMany || !slices.Equal(l.teamsNotOffered, want) || l.teamsOmitted != 8 || !slices.Equal(l.bounds, []string{microsoftRemoteLimit}) {
		t.Fatal(l.teamsLeftOut, l.teamsNotOffered, l.teamsOmitted, l.bounds)
	}
	for _, p := range *asked {
		if strings.Contains(p, testTeamID(69)) {
			t.Fatal("asked Graph about a team that could not fit", p)
		}
	}
}

// A team that does not fit the file is left out whole and named, and a
// later team that fits is still offered.
func TestMicrosoftTeamThatDoesNotFitDoesNotStopTheRest(t *testing.T) {
	probe, _ := manyTeams(t, []int{1})
	p := manyTeamsLogin(probe, nil)
	if err := p.discover(context.Background(), "access-secret", testManyTeamsScopes); err != nil {
		t.Fatal(err)
	}
	// A token that leaves room for one small team after the account's roots.
	m, _ := manyTeams(t, []int{10, 1})
	l := manyTeamsLogin(m, []byte(strings.Repeat("t", maxMicrosoftConfig-len(p.config))))
	if err := l.discover(context.Background(), "access-secret", testManyTeamsScopes); err != nil {
		t.Fatal(err)
	}
	config := string(l.config)
	if strings.Contains(config, "x00000000") || !strings.Contains(config, "x00010000") || len(config) > maxMicrosoftConfig {
		t.Fatalf("whole first team out, second in:\n%d", len(config))
	}
	if !slices.Equal(l.teamsNotOffered, []string{"Contoso-tiimi 01"}) || !slices.Equal(l.bounds, []string{microsoftConfigLimit}) {
		t.Fatal(l.teamsNotOffered, l.bounds)
	}
}

// The folder step names the teams left out, and the journal says which
// bound fired and how many, never their names.
func TestMicrosoftTeamsLeftOutReachTheViewAndTheJournal(t *testing.T) {
	env := microsoftEnv(t)
	m, _ := manyTeams(t, slices.Repeat([]int{1}, 66))
	var logs lockedBuffer
	c := New(env, []Entry{m}, slog.New(slog.NewJSONHandler(&logs, nil)), WithQuota(func() Room { return Room{Free: 1 << 40, OK: true} }))
	h := c.Handler(allow)
	if code, _, _ := call(t, h, "POST", LoginPath, ownerA, map[string]any{"action": "start", "provider": "microsoft"}); code != 200 {
		t.Fatal(code)
	}
	defer func() { c.relay.cancelAll(); c.sync.stopAll() }()
	v := waitState(t, h, ownerA, "choose_folders")
	names, _ := json.Marshal(v["teams_not_offered"])
	if v["teams_left_out"] != teamsTooMany || string(names) != `["Contoso-tiimi 63","Contoso-tiimi 64","Contoso-tiimi 65","Contoso-tiimi 66"]` {
		t.Fatal(v["teams_left_out"], string(names))
	}
	journal := logs.String()
	if !strings.Contains(journal, `"reason":"teams_left_out","bound":"remote_limit","teams_left_out":4`) || strings.Contains(journal, "Contoso-tiimi") {
		t.Fatal(journal)
	}
}

type lockedBuffer struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (l *lockedBuffer) Write(p []byte) (int, error) {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.b.Write(p)
}

func (l *lockedBuffer) String() string {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.b.String()
}

// legacyConfig is a config as earlier releases wrote it: each root its own
// rclone remote with its own copy of the token. tokens are each root's.
func legacyConfig(address string, grant func(i int) string, tokens ...[]byte) string {
	config := microsoftConfigHeader + microsoftDiscoveryFixed
	for i, token := range tokens {
		name, dir, drive, kind := fmt.Sprintf("sp-%024x", i), fmt.Sprintf("cloud/sharepoint/contoso--%s/site/library-%d", address, i), fmt.Sprintf("b!%s%04d", strings.Repeat("x", 60), i), "documentLibrary"
		if i == 0 {
			name, dir, kind = "onedrive", "cloud/onedrive/"+address, "business"
		}
		config += fmt.Sprintf("[%s]\ntype = onedrive\nclient_id = 00000000-0000-0000-0000-000000000001\nregion = global\ntenant = %s\ndrive_id = %s\ndrive_type = %s\ndescription = %s\n%s = %s\n", name, testTenant, drive, kind, dir, microsoftLabelKey, "VGVhbXMgwrcgS2lyamFzdG8")
		if i == 2 {
			config += microsoftRecoverySelected + " = true\n"
		}
		config += "token = " + string(token) + "\n" + grant(i) + "\n"
	}
	return config
}

// A config of the earlier form, near the read bound as a pilot's was,
// becomes one account remote with the newest token at the next start; the
// roots keep their paths, names, choices and sync direction, and their
// listings continue under the alias's name, so no pair starts over.
func TestMicrosoftConfigWithATokenPerRootMigratesAtStart(t *testing.T) {
	env := microsoftEnv(t)
	address := "person@example.test"
	now := time.Now()
	var tokens [][]byte
	for i := 0; i < 11; i++ {
		tokens = append(tokens, realisticToken(fmt.Sprintf("access-%d", i), now.Add(time.Duration(i%5)*time.Minute)))
	}
	tokens[7] = realisticToken("access-newest", now.Add(time.Hour))
	old := legacyConfig(address, func(int) string { return grantLine([]string{"Files.ReadWrite.All", "Sites.ReadWrite.All"}) }, tokens...)
	if len(old) < 55000 || len(old) > maxMicrosoftConfigRead {
		t.Fatal("fixture size", len(old))
	}
	writeConfig(t, env, address, []byte(old))
	before, legacy, err := microsoftReadRoots(env, address)
	if err != nil || len(legacy) != 11 {
		t.Fatal(legacy, err)
	}
	// OneDrive and one library sync both ways; their listings carry the
	// root's own remote name, as rclone named them.
	for _, r := range before[:2] {
		work := filepath.Join(env.Home, microsoftWork(address, r.Name))
		os.MkdirAll(work, 0700)
		for _, f := range []string{".path1.lst", ".path2.lst", ".path1.lst-old"} {
			os.WriteFile(filepath.Join(work, "home_person_"+r.Name+".."+r.Name+"_"+f), []byte("native listing\n"), 0600)
		}
	}
	// A pass killed before it ended left its expired lock: it moves with the
	// listings and names the new session, so rclone still distrusts them.
	oneDriveWork := filepath.Join(env.Home, microsoftWork(address, "onedrive"))
	oldSession := filepath.Join(oneDriveWork, "home_person_onedrive..onedrive_")
	os.WriteFile(oldSession+".lck", []byte(`{"Session":"`+oldSession+`","PID":"0","TimeExpires":"2001-01-01T00:00:00Z"}`), 0600)
	var logs lockedBuffer
	c := New(env, []Entry{&microsoft{}}, slog.New(slog.NewJSONHandler(&logs, nil)), WithQuota(func() Room { return Room{Free: 1 << 30, OK: true} }), WithResumeTiming(20*time.Millisecond, 20*time.Millisecond, 80*time.Millisecond))
	ctx, cancel := context.WithCancel(context.Background())
	defer func() { cancel(); c.Stop() }()
	c.Start(ctx)
	waitFor(t, "migration", func() bool { return strings.Contains(logs.String(), `"msg":"integration_config_migration"`) })
	if !strings.Contains(logs.String(), `"outcome":"completed"`) {
		t.Fatal(logs.String())
	}
	data, _ := os.ReadFile(filepath.Join(env.Home, microsoftDir, address+".conf"))
	config := string(data)
	if strings.Count(config, "\ntoken = ") != 1 || !strings.Contains(config, "access-newest") || !strings.Contains(config, microsoftDiscoveryFixed) || strings.Count(config, grantKey+" = ") != 1 {
		t.Fatal(config)
	}
	after, legacy, err := microsoftReadRoots(env, address)
	if err != nil || len(legacy) != 0 || !slices.Equal(after, before) {
		t.Fatalf("%v %v\n%+v\n%+v", legacy, err, after, before)
	}
	newSession := filepath.Join(oneDriveWork, "home_person_onedrive.."+microsoftAccount+"_")
	if lock, err := os.ReadFile(newSession + ".lck"); err != nil || !strings.Contains(string(lock), `"Session":"`+newSession+`"`) || !strings.Contains(string(lock), "2001-01-01") {
		t.Fatal("lock not moved with its session", string(lock), err)
	}
	os.Remove(newSession + ".lck")
	for _, r := range before[:2] {
		names, _ := filepath.Glob(filepath.Join(env.Home, microsoftWork(address, r.Name), "*"))
		if len(names) != 3 {
			t.Fatal(names)
		}
		for _, n := range names {
			if !strings.Contains(filepath.Base(n), "home_person_"+r.Name+".."+microsoftAccount+"_.") {
				t.Fatal("listing not continued under the alias", n)
			}
		}
		if !microsoftReady(env, address, after[slices.IndexFunc(after, func(x microsoftRemote) bool { return x.Name == r.Name })]) {
			t.Fatal("pair no longer ready", r.Name)
		}
	}
	if microsoftMigrationNeeded(env, address) {
		t.Fatal("migrated account still needs migrating")
	}
}

// Roots that recorded different grants keep their own, so no root changes
// its sync direction; a pass in progress defers the migration.
func TestMicrosoftMigrationKeepsDirectionsAndWaitsForPasses(t *testing.T) {
	env := microsoftEnv(t)
	address := "person@example.test"
	tokens := [][]byte{realisticToken("a", time.Now()), realisticToken("b", time.Now()), realisticToken("c", time.Now())}
	// The library written before grants were recorded syncs both ways; the
	// others were signed in with a read grant and are mirrors.
	read := grantLine([]string{"Files.Read.All", "Sites.Read.All"})
	old := legacyConfig(address, func(i int) string {
		if i == 1 {
			return ""
		}
		return read
	}, tokens...)
	writeConfig(t, env, address, []byte(old))
	before, _, err := microsoftReadRoots(env, address)
	if err != nil || before[0].Writable || !before[1].Writable || before[2].Writable {
		t.Fatalf("fixture %+v %v", before, err)
	}
	work := filepath.Join(env.Home, microsoftWork(address, before[1].Name))
	os.MkdirAll(work, 0700)
	lock := filepath.Join(work, "x.."+before[1].Name+"_.lck")
	os.WriteFile(lock, []byte(`{"Session":"x","PID":"1","TimeExpires":"2999-01-01T00:00:00Z"}`), 0600)
	m := &microsoft{}
	if err := m.migrate(env, address); err != microsoftRecoveryBusy {
		t.Fatal("migrated beside a pass", err)
	}
	os.Remove(lock)
	if err := m.migrate(env, address); err != nil {
		t.Fatal(err)
	}
	after, legacy, err := microsoftReadRoots(env, address)
	if err != nil || len(legacy) != 0 || !slices.Equal(after, before) {
		t.Fatalf("%+v\n%+v %v", after, before, err)
	}
	data, _ := os.ReadFile(filepath.Join(env.Home, microsoftDir, address+".conf"))
	if strings.Count(string(data), "\ntoken = ") != 1 {
		t.Fatal(string(data))
	}
}

// A new sign-in over a config of the earlier form continues the roots'
// pairs: their listings move to the alias's name with the new config.
func TestMicrosoftSignInOverATokenPerRootConfigContinuesPairs(t *testing.T) {
	env := microsoftEnv(t)
	address := "person@example.test"
	old := strings.Replace(legacyConfig(address, func(int) string { return grantLine(strings.Fields(microsoftScopes)) }, realisticToken("old", time.Now())), "drive_id = b!"+strings.Repeat("x", 60)+"0000", "drive_id = primary-drive", 1)
	writeConfig(t, env, address, []byte(old))
	work := filepath.Join(env.Home, microsoftWork(address, "onedrive"))
	os.MkdirAll(work, 0700)
	for _, side := range []string{"path1", "path2"} {
		os.WriteFile(filepath.Join(work, "local..onedrive_."+side+".lst"), []byte("native listing\n"), 0600)
	}
	l := msLogin(t, syntheticMicrosoft(t, address, ""), env, address)
	if _, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil }); err != nil {
		t.Fatal(err)
	}
	if err := l.Commit(context.Background(), address); err != nil {
		t.Fatal(err)
	}
	for _, side := range []string{"path1", "path2"} {
		if _, err := os.Stat(filepath.Join(work, "local.."+microsoftAccount+"_."+side+".lst")); err != nil {
			t.Fatal("listing not moved", err)
		}
	}
	if microsoftMigrationNeeded(env, address) {
		t.Fatal("signed-in account still needs migrating")
	}
}

// A real rclone refreshing an expired token through any root writes it
// once, into the account's section, and keeps the roots and the daemon's
// own keys. Graph itself is never reached: requests other than the local
// token endpoint go to a closed proxy.
func TestMicrosoftTokenRefreshRewritesOneToken(t *testing.T) {
	rclone := os.Getenv("OH_TEST_RCLONE")
	if rclone == "" {
		t.Skip("requires the pinned rclone (OH_TEST_RCLONE)")
	}
	var refreshes int
	var mu sync.Mutex
	endpoint := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		mu.Lock()
		refreshes++
		mu.Unlock()
		if r.Form.Get("grant_type") != "refresh_token" || !strings.HasPrefix(r.Form.Get("refresh_token"), "refresh-secret") {
			t.Errorf("refresh form %v", r.Form)
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"access_token":"refreshed-%s","refresh_token":"refresh-secret-2","token_type":"Bearer","expires_in":3600}`, strings.Repeat("N", 4000))
	}))
	defer endpoint.Close()

	m, _ := manyTeams(t, slices.Repeat([]int{1}, 22))
	l := manyTeamsLogin(m, realisticToken("expired", time.Now().Add(-time.Hour)))
	if err := l.discover(context.Background(), "access-secret", testManyTeamsScopes); err != nil {
		t.Fatal(err)
	}
	env := microsoftEnv(t)
	path := writeConfig(t, env, l.address, l.config)
	before, _, err := microsoftReadRoots(env, l.address)
	if err != nil || len(before) != 24 {
		t.Fatal(len(before), err)
	}
	for _, r := range []microsoftRemote{before[0], before[23]} {
		cmd := exec.Command(rclone, "--config", path, "about", r.Name+":", "--contimeout", "2s", "--timeout", "5s", "--low-level-retries", "1", "--retries", "1")
		cmd.Env = []string{"HOME=" + env.Home, "PATH=/usr/bin:/bin", "RCLONE_CONFIG_MICROSOFT_TOKEN_URL=" + endpoint.URL + "/token", "HTTPS_PROXY=http://127.0.0.1:9", "HTTP_PROXY=http://127.0.0.1:9", "NO_PROXY=127.0.0.1"}
		// Graph is unreachable, so the command fails after the refresh.
		_ = cmd.Run()
	}
	data, _ := os.ReadFile(path)
	config := string(data)
	if refreshes != 1 || strings.Count(config, "\ntoken = ") != 1 || strings.Count(config, "refreshed-") != 1 || strings.Contains(config, "expired") {
		t.Fatalf("%d refreshes:\n%s", refreshes, config)
	}
	if !strings.Contains(config, microsoftDiscoveryFixed) || strings.Contains(config, "token_url") {
		t.Fatal("rclone dropped the marker or kept the test endpoint", config)
	}
	after, legacy, err := microsoftReadRoots(env, l.address)
	if err != nil || len(legacy) != 0 || !slices.Equal(after, before) {
		t.Fatal("refresh changed the roots", err)
	}
}

// An alias whose listings still carry its own remote's name, as a stop in
// the middle of a migration leaves them, does not sync until they move.
func TestMicrosoftUnmovedListingsWaitForTheMigration(t *testing.T) {
	env := microsoftEnv(t)
	address := "person@example.test"
	writeConfig(t, env, address, []byte(testMicrosoftRoots("onedrive", "cloud/onedrive/"+address, "sp-0123456789abcdef01234567", "cloud/sharepoint/t--"+address+"/site/docs")))
	for remote, session := range map[string]string{"onedrive": "local..microsoft_", "sp-0123456789abcdef01234567": "local..sp-0123456789abcdef01234567_"} {
		work := filepath.Join(env.Home, microsoftWork(address, remote))
		os.MkdirAll(work, 0700)
		for _, side := range []string{".path1.lst", ".path2.lst"} {
			os.WriteFile(filepath.Join(work, session+side), []byte("native listing\n"), 0600)
		}
	}
	m := &microsoft{}
	c, ok := m.SyncCommand(env, address)
	if !ok || strings.Contains(strings.Join(c.Args, " "), "sp-0123456789abcdef01234567:") || !strings.Contains(strings.Join(c.Args, " "), "onedrive:") {
		t.Fatal("unmoved pair synced", c.Args)
	}
	if !microsoftMigrationNeeded(env, address) {
		t.Fatal("unmoved listings not migrated")
	}
	if err := m.migrate(env, address); err != nil {
		t.Fatal(err)
	}
	if c, _ := m.SyncCommand(env, address); !strings.Contains(strings.Join(c.Args, " "), "sp-0123456789abcdef01234567:") {
		t.Fatal("moved pair still left out", c.Args)
	}
}
