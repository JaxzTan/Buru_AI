package telegram

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Account is one honeypot account and its gotd session file.
type Account struct {
	ID      string // honeypot account id ("a1"), as in demostore
	Session string // file name under Config.SessionDir
}

type Config struct {
	AppID      int
	AppHash    string // secret: never log it
	SessionDir string
	TestDC     bool
	Accounts   []Account
}

// FromEnv reads BURU_TG_APP_ID, BURU_TG_APP_HASH, BURU_TG_SESSION_DIR, BURU_TG_TEST_DC and BURU_TG_ACCOUNTS.
// The account → session mapping will later come from honeypot_accounts.session_ref in Postgres.
func FromEnv() (Config, error) {
	c := Config{AppHash: os.Getenv("BURU_TG_APP_HASH"), SessionDir: os.Getenv("BURU_TG_SESSION_DIR"),
		TestDC: os.Getenv("BURU_TG_TEST_DC") == "true"}
	if c.SessionDir == "" {
		c.SessionDir = "sessions"
	}
	id, err := strconv.Atoi(os.Getenv("BURU_TG_APP_ID"))
	if err != nil || id <= 0 || c.AppHash == "" {
		return c, fmt.Errorf("telegram: BURU_TG_APP_ID and BURU_TG_APP_HASH are required")
	}
	c.AppID = id
	if c.Accounts, err = ParseAccounts(os.Getenv("BURU_TG_ACCOUNTS")); err != nil {
		return c, err
	}
	return c, nil
}

// ParseAccounts parses "a1:a1.session,a2:a2.session".
func ParseAccounts(s string) ([]Account, error) {
	var out []Account
	seen := map[string]bool{}
	for _, part := range strings.Split(s, ",") {
		if part = strings.TrimSpace(part); part == "" {
			continue
		}
		id, file, ok := strings.Cut(part, ":")
		id, file = strings.TrimSpace(id), strings.TrimSpace(file)
		if !ok || id == "" || file == "" {
			return nil, fmt.Errorf("telegram: bad BURU_TG_ACCOUNTS entry %q (want id:file.session)", part)
		}
		// a plain file name keeps every session inside BURU_TG_SESSION_DIR
		if filepath.Base(file) != file || file == "." || file == ".." {
			return nil, fmt.Errorf("telegram: session %q for %s must be a file name, not a path", file, id)
		}
		if seen[id] {
			return nil, fmt.Errorf("telegram: account %s listed twice in BURU_TG_ACCOUNTS", id)
		}
		seen[id] = true
		out = append(out, Account{ID: id, Session: file})
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("telegram: BURU_TG_ACCOUNTS is empty")
	}
	return out, nil
}
