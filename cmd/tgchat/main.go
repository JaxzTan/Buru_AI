// Command tgchat lets you play the scammer: it signs in a second Telegram account and gives you a
// terminal chat with a honeypot, showing its replies and "typing…" live. Development tool only.
//
//	go run ./cmd/tgchat -phone <your test account> -to <honeypot phone or @username>
//
// Works on the real network or, with SOCKABUS_TG_TEST_DC=2, on Telegram's test network.
package main

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/binary"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"time"

	"github.com/gotd/td/session"
	"github.com/gotd/td/telegram"
	"github.com/gotd/td/telegram/updates"
	"github.com/gotd/td/tg"

	tgconn "github.com/JaxzTan/Buru_AI/internal/channel/telegram"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run() error {
	phone := flag.String("phone", "", "YOUR scammer test account: +60... or 99966XYYYY on the test network")
	to := flag.String("to", "", "the honeypot: its @username or phone number")
	dir := flag.String("session-dir", getenv("SOCKABUS_TG_SESSION_DIR", ".secrets/telegram"), "session folder")
	flag.Parse()
	if *phone == "" || *to == "" {
		return errors.New("usage: tgchat -phone <your account> -to <honeypot @username or phone>")
	}
	appID, _ := strconv.Atoi(os.Getenv("SOCKABUS_TG_APP_ID"))
	testDC, _ := strconv.Atoi(os.Getenv("SOCKABUS_TG_TEST_DC"))
	cfg := tgconn.LoginConfig{AppID: appID, AppHash: os.Getenv("SOCKABUS_TG_APP_HASH"), SessionDir: *dir,
		Phone: *phone, TestDC: testDC, SignUpName: "Test Scammer", Device: tgconn.DefaultDevice()}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	loginCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	self, ref, err := tgconn.Login(loginCtx, cfg)
	cancel()
	if err != nil {
		return fmt.Errorf("login: %w", err)
	}
	path, _ := tgconn.SessionPath(*dir, ref)
	fmt.Printf("You are %s (tg:%d). If the honeypot uses SOCKABUS_TG_ONLY_FROM, add tg:%d to it.\n", self.FirstName, self.ID, self.ID)

	dispatcher := tg.NewUpdateDispatcher()
	gaps := updates.New(updates.Config{Handler: dispatcher})
	opts := telegram.Options{SessionStorage: &session.FileStorage{Path: path}, UpdateHandler: gaps, Device: cfg.Device}
	if err := tgconn.ApplyNetwork(&opts, testDC); err != nil {
		return err
	}
	client := telegram.NewClient(appID, cfg.AppHash, opts)

	return client.Run(ctx, func(ctx context.Context) error {
		api := client.API()
		target, err := resolve(ctx, api, *to)
		if err != nil {
			return err
		}
		name := strings.TrimSpace(target.FirstName + " " + target.LastName)
		peer := &tg.InputPeerUser{UserID: target.ID, AccessHash: target.AccessHash}

		dispatcher.OnNewMessage(func(_ context.Context, _ tg.Entities, u *tg.UpdateNewMessage) error {
			if m, ok := u.Message.(*tg.Message); ok && !m.Out {
				if p, ok := m.PeerID.(*tg.PeerUser); ok && p.UserID == target.ID {
					fmt.Printf("\r%s  %s: %s\n> ", time.Now().Format("15:04:05"), name, m.Message)
				}
			}
			return nil
		})
		dispatcher.OnUserTyping(func(_ context.Context, _ tg.Entities, u *tg.UpdateUserTyping) error {
			if u.UserID == target.ID {
				if _, ok := u.Action.(*tg.SendMessageTypingAction); ok {
					fmt.Printf("\r%s  %s is typing…\n> ", time.Now().Format("15:04:05"), name)
				}
			}
			return nil
		})

		go func() {
			fmt.Printf("Chatting with %s. Type a message and press Enter. Ctrl+C to quit.\n> ", name)
			in := bufio.NewScanner(os.Stdin)
			for in.Scan() {
				text := strings.TrimSpace(in.Text())
				if text == "" {
					fmt.Print("> ")
					continue
				}
				if _, err := api.MessagesSendMessage(ctx, &tg.MessagesSendMessageRequest{Peer: peer, Message: text, RandomID: randID()}); err != nil {
					fmt.Printf("send failed: %v\n", err)
				}
				fmt.Print("> ")
			}
			stop()
		}()
		return gaps.Run(ctx, api, self.ID, updates.AuthOptions{})
	})
}

// resolve finds the honeypot by @username, or by phone through a temporary contact import.
func resolve(ctx context.Context, api *tg.Client, to string) (*tg.User, error) {
	to = strings.TrimSpace(to)
	if strings.HasPrefix(to, "@") {
		res, err := api.ContactsResolveUsername(ctx, &tg.ContactsResolveUsernameRequest{Username: strings.TrimPrefix(to, "@")})
		if err != nil {
			return nil, fmt.Errorf("resolve %s: %w", to, err)
		}
		for _, u := range res.Users {
			if user, ok := u.(*tg.User); ok {
				return user, nil
			}
		}
		return nil, fmt.Errorf("%s is not a user", to)
	}
	res, err := api.ContactsImportContacts(ctx, []tg.InputPhoneContact{{ClientID: 1, Phone: strings.TrimPrefix(to, "+"), FirstName: "Honeypot"}})
	if err != nil {
		return nil, fmt.Errorf("find %s by phone: %w", to, err)
	}
	for _, u := range res.Users {
		if user, ok := u.(*tg.User); ok {
			return user, nil
		}
	}
	return nil, fmt.Errorf("no Telegram account found for %s (is the honeypot logged in with tglogin on the same network?)", to)
}

func randID() int64 {
	var b [8]byte
	_, _ = rand.Read(b[:])
	return int64(binary.LittleEndian.Uint64(b[:]) &^ (1 << 63))
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
