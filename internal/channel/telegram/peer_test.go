package telegram

import (
	"testing"

	"github.com/gotd/td/tg"
)

func TestPeerRefRoundTrip(t *testing.T) {
	ref := PeerRef(123456789, -987654321)
	p, err := ParsePeerRef(ref)
	if err != nil || p.UserID != 123456789 || p.AccessHash != -987654321 {
		t.Fatalf("ParsePeerRef(%q) = %+v, %v", ref, p, err)
	}
	for _, bad := range []string{"", "tg:chat:1:2", "tg:user:x:2", "wa:user:1:2"} {
		if _, err := ParsePeerRef(bad); err == nil {
			t.Errorf("ParsePeerRef(%q) should fail", bad)
		}
	}
}

func TestSessionPath(t *testing.T) {
	if got := SessionRef("+60 12-345 6789"); got != "file:tg_60123456789.json" {
		t.Fatalf("SessionRef = %s", got)
	}
	p, err := SessionPath("/secrets/tg", "file:tg_60123456789.json")
	if err != nil || p != "/secrets/tg/tg_60123456789.json" {
		t.Fatalf("SessionPath = %s, %v", p, err)
	}
	for _, bad := range []string{"file:../../etc/passwd", "file:a/b.json", "vault:abc", "file:x.txt"} {
		if _, err := SessionPath("/secrets/tg", bad); err == nil {
			t.Errorf("SessionPath(%q) should fail", bad)
		}
	}
}

func TestMediaText(t *testing.T) {
	voice := &tg.MessageMediaDocument{Document: &tg.Document{Attributes: []tg.DocumentAttributeClass{&tg.DocumentAttributeAudio{Voice: true}}}}
	cases := map[string]tg.MessageMediaClass{
		"[photo]":                            &tg.MessageMediaPhoto{},
		"[voice message]":                    voice,
		"[contact card] Mr Tan +60123456789": &tg.MessageMediaContact{FirstName: "Mr", LastName: "Tan", PhoneNumber: "+60123456789"},
		"[location]":                         &tg.MessageMediaGeo{},
	}
	for want, media := range cases {
		if got := mediaText(media); got != want {
			t.Errorf("mediaText = %q, want %q", got, want)
		}
	}
}
