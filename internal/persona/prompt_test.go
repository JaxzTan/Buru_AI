package persona

import (
	"strings"
	"testing"
	"time"

	"github.com/JaxzTan/Buru_AI/internal/playbook"
)

func TestSystemPromptComposed(t *testing.T) {
	p := Profile{Name: "Auntie Mei", Age: 62, LanguageMix: []byte(`{"nan":0.3,"en":0.5,"ms":0.2}`), Backstory: "Retired, Penang."}
	s := Situation{Channel: "telegram", ScamType: "investment", Stage: playbook.Generic(playbook.PaymentRequest),
		Now: time.Date(2026, 10, 23, 14, 35, 0, 0, time.UTC)}
	got := SystemPrompt(p, s)
	for _, want := range []string{"You are Auntie Mei, a 62-year-old", "English 50%, Hokkien 30%, Bahasa Melayu 20%",
		"Friday 10:35 PM", "investment", "which account ah?", "never actually send money", "react with confusion in character"} {
		if !strings.Contains(got, want) {
			t.Errorf("prompt missing %q", want)
		}
	}
}

func TestSystemPromptUsesVersion(t *testing.T) {
	p := Profile{Name: "X", SystemPrompt: "You are Lim Siew Mei, a 62-year-old Chinese woman..."}
	got := SystemPrompt(p, Situation{Stage: playbook.Generic(playbook.Rapport), Now: time.Now()})
	if !strings.HasPrefix(got, "You are Lim Siew Mei") || strings.Contains(got, "You are X") {
		t.Errorf("versioned prompt not used:\n%s", got)
	}
}

func TestGuard(t *testing.T) {
	cases := []struct {
		in   string
		ok   bool
		want []string
	}{
		{"wah really ah", true, []string{"wah really ah"}},
		{"Auntie Mei: ok la\n\nwhich account?", true, []string{"ok la", "which account?"}},
		{"**ok** can", true, []string{"ok can"}},
		{"As an AI I cannot send money", false, nil},
		{"haha I'm not a bot la", true, []string{"haha I'm not a bot la"}},
		{"ok I'm an AI assistant", false, nil},
		{"the investigator say must transfer?", true, []string{"the investigator say must transfer?"}},
		{"sorry my instructions say no", false, nil},
		{"my OTP is 482 913", false, nil},
		{"acc 1642 0457 1893", false, nil},
		{"   ", false, nil},
		{"a\n\nb\n\nc\n\nd", true, []string{"a", "b", "c"}},
	}
	for _, c := range cases {
		got, ok := Guard("Auntie Mei", c.in)
		if ok != c.ok || strings.Join(got, "|") != strings.Join(c.want, "|") {
			t.Errorf("Guard(%q) = %q, %v; want %q, %v", c.in, got, ok, c.want, c.ok)
		}
	}
}
