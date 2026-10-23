// Command tglogin logs a honeypot phone number into Telegram once and saves the MTProto session
// file the app uses (TR-2). It is interactive: Telegram sends a login code to the honeypot
// account's Telegram app (or SMS), and asks for the 2-step verification password if one is set.
//
//	go run ./cmd/tglogin -phone +60123456789               # log in, write the session file
//	go run ./cmd/tglogin -phone +60123456789 -persona 1    # ...and bind it to persona 1 in PostgreSQL
//
// Session files are secrets (they are a logged-in Telegram account). They are written with 0600
// permissions to BURU_TG_SESSION_DIR, which is git-ignored. Never commit or share them.
package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gotd/td/session"
	"github.com/gotd/td/telegram"
	"github.com/gotd/td/telegram/auth"
	"github.com/gotd/td/tg"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/term"

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
	phone := flag.String("phone", "", "honeypot phone number in international format, e.g. +60123456789")
	personaID := flag.Int64("persona", 0, "optional: persona id to bind this account to (inserts into honeypot_accounts)")
	dir := flag.String("session-dir", getenv("BURU_TG_SESSION_DIR", ".secrets/telegram"), "where to store the session file")
	flag.Parse()
	if *phone == "" || !strings.HasPrefix(*phone, "+") {
		return errors.New("-phone is required in international format, e.g. -phone +60123456789")
	}
	appID, err := strconv.Atoi(os.Getenv("BURU_TG_APP_ID"))
	appHash := os.Getenv("BURU_TG_APP_HASH")
	if err != nil || appID == 0 || appHash == "" {
		return errors.New("set BURU_TG_APP_ID and BURU_TG_APP_HASH (from https://my.telegram.org → API development tools) in .env")
	}

	ref := tgconn.SessionRef(*phone)
	path, err := tgconn.SessionPath(*dir, ref)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(*dir, 0o700); err != nil {
		return err
	}

	device := tgconn.DefaultDevice()
	if v := os.Getenv("BURU_TG_DEVICE_MODEL"); v != "" {
		device.DeviceModel = v
	}
	if v := os.Getenv("BURU_TG_SYSTEM_VERSION"); v != "" {
		device.SystemVersion = v
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	client := telegram.NewClient(appID, appHash, telegram.Options{
		SessionStorage: &session.FileStorage{Path: path},
		Device:         device,
		NoUpdates:      true,
	})
	var self *tg.User
	err = client.Run(ctx, func(ctx context.Context) error {
		flow := auth.NewFlow(terminalAuth{phone: *phone}, auth.SendCodeOptions{})
		if err := client.Auth().IfNecessary(ctx, flow); err != nil {
			return err
		}
		var err error
		self, err = client.Self(ctx)
		return err
	})
	if err != nil {
		return fmt.Errorf("telegram login: %w", err)
	}
	_ = os.Chmod(path, 0o600)

	handle := "(no username set: add one in Telegram settings so you can find it)"
	if self.Username != "" {
		handle = "@" + self.Username
	}
	fmt.Printf("\nLogged in as %s %s, %s (user id %d)\n", self.FirstName, self.LastName, handle, self.ID)
	fmt.Printf("Session saved to %s\nsession_ref: %s\n", path, ref)

	if *personaID == 0 {
		fmt.Printf("\nBind it to a persona with:\n  go run ./cmd/tglogin -phone %s -persona <id>\nor POST /internal/accounts {\"persona_id\":<id>,\"channel\":\"telegram\",\"phone\":%q,\"session_ref\":%q}\n", *phone, *phone, ref)
		return nil
	}
	return bind(ctx, *personaID, *phone, ref)
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

// terminalAuth prompts on the terminal for the login code and 2FA password.
type terminalAuth struct{ phone string }

func (a terminalAuth) Phone(context.Context) (string, error) { return a.phone, nil }

func (terminalAuth) Password(context.Context) (string, error) {
	fmt.Print("2-step verification password: ")
	b, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Println()
	return strings.TrimSpace(string(b)), err
}

func (terminalAuth) Code(context.Context, *tg.AuthSentCode) (string, error) {
	fmt.Print("Login code (sent to the honeypot account's Telegram app or by SMS): ")
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	return strings.TrimSpace(line), err
}

func (terminalAuth) AcceptTermsOfService(_ context.Context, tos tg.HelpTermsOfService) error {
	return &auth.SignUpRequired{TermsOfService: tos}
}

func (terminalAuth) SignUp(context.Context) (auth.UserInfo, error) {
	return auth.UserInfo{}, errors.New("this number has no Telegram account yet: install Telegram on the honeypot phone and sign up there first")
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
