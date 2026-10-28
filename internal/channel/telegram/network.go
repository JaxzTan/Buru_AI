package telegram

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/gotd/td/telegram"
	"github.com/gotd/td/telegram/dcs"
)

// Telegram's test network is separate from production: different servers, different accounts,
// and it is wiped from time to time. Test accounts use phone numbers 99966XYYYY, where X is the
// test DC (1-3), and the login code is X repeated (5 or 6 times; Telegram has changed the length).
//
// As of 2026 Telegram no longer auto-creates accounts for random test numbers on every setup
// (gotd/td notes PHONE_CODE_INVALID); a number that was registered before may be needed. Use the
// test network only for development, never for real honeypots.

var reTestPhone = regexp.MustCompile(`^99966([1-3])\d{4}$`)

// ApplyNetwork points client options at the test network when testDC is 1-3; 0 means production.
func ApplyNetwork(opts *telegram.Options, testDC int) error {
	if testDC == 0 {
		return nil
	}
	if testDC < 1 || testDC > 3 {
		return fmt.Errorf("telegram: SOCKABUS_TG_TEST_DC must be 1, 2 or 3, got %d", testDC)
	}
	opts.DC = testDC
	opts.DCList = dcs.Test()
	return nil
}

// TestPhone validates a test-network number and returns it without "+", plus its login code
// hint. The number's DC digit must match the configured test DC.
func TestPhone(phone string, testDC int) (normalized, codeHint string, err error) {
	p := strings.TrimPrefix(strings.ReplaceAll(phone, " ", ""), "+")
	m := reTestPhone.FindStringSubmatch(p)
	if m == nil {
		return "", "", fmt.Errorf("telegram: test network numbers look like 99966%dXXXX (got %q)", testDC, phone)
	}
	if m[1] != fmt.Sprint(testDC) {
		return "", "", fmt.Errorf("telegram: %s belongs to test DC %s but SOCKABUS_TG_TEST_DC=%d", p, m[1], testDC)
	}
	d := m[1]
	return p, strings.Repeat(d, 5) + " (or " + strings.Repeat(d, 6) + ")", nil
}
