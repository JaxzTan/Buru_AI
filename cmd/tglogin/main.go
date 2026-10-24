// Command tglogin logs a honeypot phone number into Telegram once and saves the MTProto session
// file the app uses (TR-2). It is interactive: Telegram sends a login code to the honeypot
// account's Telegram app (or SMS), and asks for the 2-step verification password if one is set.
//
//	go run ./cmd/tglogin -phone +60123456789               # log in, write the session file
//	go run ./cmd/tglogin -phone +60123456789 -persona 1    # ...and bind it to persona 1 in PostgreSQL
//
// With BURU_TG_TEST_DC=2 it uses Telegram's test network instead (numbers 99966 2 XXXX, code 22222).
//
// Session files are secrets (they are a logged-in Telegram account). They are written with 0600
// permissions to BURU_TG_SESSION_DIR, which is git-ignored. Never commit or share them.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	tgconn "github.com/JaxzTan/Buru_AI/internal/channel/telegram"
	"github.com/JaxzTan/Buru_AI/internal/db"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run() error {
	phone := flag.String("phone", "", "honeypot phone number: +60123456789, or 99966XYYYY on the test network")
	personaID := flag.Int64("persona", 0, "optional: persona id to bind this account to (inserts into honeypot_accounts)")
	dir := flag.String("session-dir", getenv("BURU_TG_SESSION_DIR", ".secrets/telegram"), "where to store the session file")
	flag.Parse()
	if *phone == "" {
		return errors.New("-phone is required, e.g. -phone +60123456789 (or 9996621234 with BURU_TG_TEST_DC=2)")
	}
	cfg, err := loginConfig(*phone, *dir)
	if err != nil {
		return err
	}
	if cfg.TestDC != 0 {
		fmt.Printf("Using Telegram's TEST network (DC %d). This account cannot talk to real Telegram users.\n", cfg.TestDC)
	}
	if *personaID != 0 && cfg.TestDC != 0 {
		cfg.SignUpName = personaName(*personaID)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	self, ref, err := tgconn.Login(ctx, cfg)
	if err != nil {
		return fmt.Errorf("telegram login: %w", err)
	}
	handle := "(no username set)"
	if self.Username != "" {
		handle = "@" + self.Username
	}
	fmt.Printf("\nLogged in as %s %s, %s (user id %d)\nsession_ref: %s\n", self.FirstName, self.LastName, handle, self.ID, ref)

	if *personaID == 0 {
		fmt.Printf("\nBind it to a persona with: make tglogin PHONE=%s PERSONA=<id>\n", *phone)
		return nil
	}
	phoneKey := *phone
	if cfg.TestDC != 0 {
		phoneKey, _, _ = tgconn.TestPhone(*phone, cfg.TestDC)
	}
	return bind(ctx, *personaID, phoneKey, ref)
}

func loginConfig(phone, dir string) (tgconn.LoginConfig, error) {
	appID, _ := strconv.Atoi(os.Getenv("BURU_TG_APP_ID"))
	testDC := 0
	if v := os.Getenv("BURU_TG_TEST_DC"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			return tgconn.LoginConfig{}, fmt.Errorf("BURU_TG_TEST_DC must be 1, 2 or 3")
		}
		testDC = n
	}
	device := tgconn.DefaultDevice()
	if v := os.Getenv("BURU_TG_DEVICE_MODEL"); v != "" {
		device.DeviceModel = v
	}
	if v := os.Getenv("BURU_TG_SYSTEM_VERSION"); v != "" {
		device.SystemVersion = v
	}
	return tgconn.LoginConfig{AppID: appID, AppHash: os.Getenv("BURU_TG_APP_HASH"), SessionDir: dir, Phone: phone,
		TestDC: testDC, Device: device}, nil
}

// personaName looks up the persona's name for a new test account (best effort).
func personaName(id int64) string {
	url := os.Getenv("BURU_POSTGRES_URL")
	if url == "" {
		return ""
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return ""
	}
	defer pool.Close()
	p, err := db.New(pool).GetPersona(ctx, id)
	if err != nil {
		return ""
	}
	return p.Name
}

func bind(ctx context.Context, personaID int64, phone, ref string) error {
	url := os.Getenv("BURU_POSTGRES_URL")
	if url == "" {
		return errors.New("BURU_POSTGRES_URL is not set; cannot bind the account")
	}
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return err
	}
	defer pool.Close()
	q := db.New(pool)
	p, err := q.GetPersona(ctx, personaID)
	if errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("persona %d does not exist (run make seed, then GET /internal/personas)", personaID)
	}
	if err != nil {
		return err
	}
	acct, err := q.CreateHoneypotAccount(ctx, db.CreateHoneypotAccountParams{PersonaID: personaID, Channel: db.ChannelTelegram, Phone: phone, SessionRef: ref})
	if err != nil {
		if strings.Contains(err.Error(), "honeypot_accounts_phone_key") {
			fmt.Println("\nThis phone is already bound to a honeypot account; nothing to do.")
			return nil
		}
		return err
	}
	fmt.Printf("\nBound honeypot account %d to persona %d (%s, status %s).\n", acct.ID, p.ID, p.Name, p.Status)
	if p.Status != db.PersonaStatusActive {
		fmt.Printf("Note: the persona is %s. Activate it so it replies:\n  POST /internal/personas/%d/status {\"status\":\"active\"}\n", p.Status, p.ID)
	}
	fmt.Println("Restart `make run` (or POST /internal/accounts/" + strconv.FormatInt(acct.ID, 10) + "/connect) to bring it online.")
	return nil
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
