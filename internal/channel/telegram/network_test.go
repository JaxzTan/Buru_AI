package telegram

import (
	"testing"

	"github.com/gotd/td/telegram"
)

func TestTestPhone(t *testing.T) {
	p, hint, err := TestPhone("+999662 1234", 2)
	if err != nil || p != "9996621234" || hint != "22222 (or 222222)" {
		t.Fatalf("TestPhone = %q %q %v", p, hint, err)
	}
	for _, bad := range []string{"+60123456789", "9996631234", "99966212345", "999662"} {
		if _, _, err := TestPhone(bad, 2); err == nil {
			t.Errorf("TestPhone(%q) should fail", bad)
		}
	}
}

func TestApplyNetwork(t *testing.T) {
	var o telegram.Options
	if err := ApplyNetwork(&o, 0); err != nil || o.DC != 0 || len(o.DCList.Options) != 0 {
		t.Fatalf("production must leave options untouched: %+v %v", o.DC, err)
	}
	if err := ApplyNetwork(&o, 2); err != nil || o.DC != 2 || len(o.DCList.Options) == 0 {
		t.Fatalf("test DC 2 not applied: dc=%d opts=%d err=%v", o.DC, len(o.DCList.Options), err)
	}
	if err := ApplyNetwork(&o, 7); err == nil {
		t.Fatal("DC 7 should be rejected")
	}
}
