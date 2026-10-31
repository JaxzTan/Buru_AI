// Command simchat lets you play the scammer against a persona without Telegram. It talks to the
// running app (SOCKABUS_MODE=live with the simulator on) over the operator API, so your messages go
// through the real pipeline: conversation workflow, LLM persona, extraction, stages, takeover.
//
//	make sim PERSONA=1               # chat with Auntie Mei as "scammer"
//	make sim PERSONA=1 AS=gold_mentor # another scammer name = a separate conversation
//
// Development tool only.
package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"time"
)

type client struct {
	base, token string
	http        *http.Client
}

func (c client) do(ctx context.Context, method, path string, body, out any) error {
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+path, rd)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		if res.StatusCode == http.StatusNotFound && strings.HasPrefix(path, "/internal/sim") {
			return errors.New("simulator is off: run the app with SOCKABUS_MODE=live and SOCKABUS_ENV=local (or SOCKABUS_SIM=1)")
		}
		return fmt.Errorf("%s %s: HTTP %d: %s", method, path, res.StatusCode, strings.TrimSpace(string(data)))
	}
	if out != nil {
		return json.Unmarshal(data, out)
	}
	return nil
}

type event struct {
	Seq  int64     `json:"seq"`
	Kind string    `json:"kind"`
	Text string    `json:"text"`
	At   time.Time `json:"at"`
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run() error {
	persona := flag.Int64("persona", 1, "persona id to chat with (make seed: 1 = Auntie Mei)")
	as := flag.String("as", "scammer", "your scammer name; a new name starts a separate conversation")
	base := flag.String("url", "", "app URL (default from SOCKABUS_HTTP_ADDR, e.g. http://localhost:8080)")
	flag.Parse()

	token := os.Getenv("SOCKABUS_OPERATOR_TOKEN")
	if token == "" {
		return errors.New("SOCKABUS_OPERATOR_TOKEN is not set (run through `make sim`, which loads .env)")
	}
	if *base == "" {
		addr := os.Getenv("SOCKABUS_HTTP_ADDR")
		if addr == "" {
			addr = ":8080"
		}
		if strings.HasPrefix(addr, ":") {
			addr = "localhost" + addr
		}
		*base = "http://" + addr
	}
	c := client{base: strings.TrimRight(*base, "/"), token: token, http: &http.Client{Timeout: 40 * time.Second}}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	var acct struct {
		AccountID     int64  `json:"account_id"`
		Persona       string `json:"persona"`
		PersonaStatus string `json:"persona_status"`
	}
	if err := c.do(ctx, http.MethodPost, "/internal/sim/accounts", map[string]int64{"persona_id": *persona}, &acct); err != nil {
		if errors.Is(err, context.Canceled) {
			return nil
		}
		return fmt.Errorf("%w\n(is `make run` running in another terminal?)", err)
	}
	if acct.PersonaStatus != "active" {
		fmt.Printf("Warning: %s is %q, so she will not reply. Activate her first:\n  curl -H \"Authorization: Bearer $SOCKABUS_OPERATOR_TOKEN\" -d '{\"status\":\"active\"}' %s/internal/personas/%d/status\n\n",
			acct.Persona, acct.PersonaStatus, c.base, *persona)
	}
	fmt.Printf("Chatting with %s as \"%s\" (simulated account %d). Replies take 10-45 s, like a real person.\n", acct.Persona, *as, acct.AccountID)
	fmt.Println("Type a message and press Enter. Ctrl+C to quit.")

	go poll(ctx, c, acct.AccountID, *as, acct.Persona)

	in := bufio.NewScanner(os.Stdin)
	fmt.Print("> ")
	for in.Scan() {
		text := strings.TrimSpace(in.Text())
		if text != "" {
			if err := c.do(ctx, http.MethodPost, "/internal/sim/messages", map[string]any{"account_id": acct.AccountID, "from": *as, "text": text}, nil); err != nil {
				fmt.Printf("send failed: %v\n", err)
			}
		}
		fmt.Print("> ")
	}
	return nil
}

func poll(ctx context.Context, c client, accountID int64, as, name string) {
	var after int64
	for ctx.Err() == nil {
		var evs []event
		q := url.Values{"account_id": {fmt.Sprint(accountID)}, "from": {as}, "after": {fmt.Sprint(after)}}
		if err := c.do(ctx, http.MethodGet, "/internal/sim/events?"+q.Encode(), nil, &evs); err != nil {
			if ctx.Err() == nil {
				fmt.Printf("\r(lost connection to the app: %v; retrying)\n> ", err)
				time.Sleep(3 * time.Second)
			}
			continue
		}
		for _, e := range evs {
			after = e.Seq
			ts := e.At.Local().Format("15:04:05")
			switch e.Kind {
			case "read":
				fmt.Printf("\r%s  ✓✓ seen\n> ", ts)
			case "typing":
				fmt.Printf("\r%s  %s is typing…\n> ", ts, name)
			case "message":
				fmt.Printf("\r%s  %s: %s\n> ", ts, name, e.Text)
			}
		}
	}
}
