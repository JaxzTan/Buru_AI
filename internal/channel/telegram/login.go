package telegram

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/gotd/td/session"
	"github.com/gotd/td/telegram"
	"github.com/gotd/td/telegram/auth"
	"github.com/gotd/td/tg"
	"golang.org/x/term"
)

// LoginConfig is used by the cmd/tglogin and cmd/tgchat terminal tools.
type LoginConfig struct {
	AppID      int
	AppHash    string
	SessionDir string
	Phone      string // +60123456789, or 99966XYYYY on the test network
	TestDC     int
	SignUpName string // test network only: name for a brand-new test account
	Device     telegram.DeviceConfig
}

// Login signs in interactively (code, then 2FA password if set) and saves the session file.
// It returns the signed-in user and the session_ref to store on honeypot_accounts.
func Login(ctx context.Context, cfg LoginConfig) (*tg.User, string, error) {
	if cfg.AppID == 0 || cfg.AppHash == "" {
		return nil, "", errors.New("set BURU_TG_APP_ID and BURU_TG_APP_HASH (https://my.telegram.org → API development tools) in .env")
	}
	phone, codeHint := cfg.Phone, ""
	if cfg.TestDC != 0 {
		var err error
		if phone, codeHint, err = TestPhone(cfg.Phone, cfg.TestDC); err != nil {
			return nil, "", err
		}
	} else if !strings.HasPrefix(phone, "+") {
		return nil, "", errors.New("phone must be in international format, e.g. +60123456789")
	}
	ref := SessionRef(phone)
	path, err := SessionPath(cfg.SessionDir, ref)
	if err != nil {
		return nil, "", err
	}
	if err := os.MkdirAll(cfg.SessionDir, 0o700); err != nil {
		return nil, "", err
	}
	if cfg.Device.DeviceModel == "" {
		cfg.Device = DefaultDevice()
	}
	opts := telegram.Options{SessionStorage: &session.FileStorage{Path: path}, Device: cfg.Device, NoUpdates: true}
	if err := ApplyNetwork(&opts, cfg.TestDC); err != nil {
		return nil, "", err
	}

	client := telegram.NewClient(cfg.AppID, cfg.AppHash, opts)
	var self *tg.User
	err = client.Run(ctx, func(ctx context.Context) error {
		ta := terminalAuth{phone: phone, codeHint: codeHint, test: cfg.TestDC != 0, name: cfg.SignUpName}
		if err := client.Auth().IfNecessary(ctx, auth.NewFlow(ta, auth.SendCodeOptions{})); err != nil {
			return err
		}
		var err error
		self, err = client.Self(ctx)
		return err
	})
	if err != nil {
		if cfg.TestDC != 0 && strings.Contains(err.Error(), "PHONE_CODE_INVALID") {
			return nil, "", fmt.Errorf("%w\n\nTelegram rejected the test code. Try the other code length (5 vs 6 digits). "+
				"If both fail, this test number is not provisioned: Telegram's 2026 change applies, so use a prepaid SIM on the real network", err)
		}
		return nil, "", err
	}
	_ = os.Chmod(path, 0o600)
	return self, ref, nil
}

// terminalAuth prompts on the terminal for the login code and 2FA password.
type terminalAuth struct {
	phone, codeHint, name string
	test                  bool
}

func (a terminalAuth) Phone(context.Context) (string, error) { return a.phone, nil }

func (terminalAuth) Password(context.Context) (string, error) {
	fmt.Print("2-step verification password: ")
	b, err := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Println()
	return strings.TrimSpace(string(b)), err
}

func (a terminalAuth) Code(context.Context, *tg.AuthSentCode) (string, error) {
	if a.codeHint != "" {
		fmt.Printf("Login code (test network: %s): ", a.codeHint)
	} else {
		fmt.Print("Login code (sent to that account's Telegram app or by SMS): ")
	}
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	return strings.TrimSpace(line), err
}

func (a terminalAuth) AcceptTermsOfService(_ context.Context, tos tg.HelpTermsOfService) error {
	if a.test {
		return nil // test accounts only
	}
	return &auth.SignUpRequired{TermsOfService: tos}
}

func (a terminalAuth) SignUp(context.Context) (auth.UserInfo, error) {
	if a.test {
		first, last, _ := strings.Cut(strings.TrimSpace(a.name), " ")
		if first == "" {
			first = "Test"
		}
		return auth.UserInfo{FirstName: first, LastName: last}, nil
	}
	return auth.UserInfo{}, errors.New("this number has no Telegram account yet: install Telegram on the phone and sign up there first")
}
