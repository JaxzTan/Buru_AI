package telegram

import (
	"testing"
	"time"

	"github.com/gotd/td/tg"
	"github.com/gotd/td/tgerr"

	"github.com/JaxzTan/Buru_AI/internal/gateway"
)

func TestParseAccounts(t *testing.T) {
	got, err := ParseAccounts(" a1:a1.session , a2:other.session,")
	if err != nil {
		t.Fatal(err)
	}
	want := []Account{{"a1", "a1.session"}, {"a2", "other.session"}}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Fatalf("got %+v, want %+v", got, want)
	}
	for _, bad := range []string{"", "a1", "a1:", ":x.session", "a1:x.session,a1:y.session", "a1:../x.session", "a1:dir/x.session"} {
		if _, err := ParseAccounts(bad); err == nil {
			t.Errorf("ParseAccounts(%q): want error", bad)
		}
	}
}

func TestToInbound(t *testing.T) {
	at := time.Date(2026, 10, 24, 9, 0, 0, 0, time.UTC)
	msg := func(peer tg.PeerClass) *tg.Message {
		return &tg.Message{ID: 42, PeerID: peer, Message: "hi auntie", Date: int(at.Unix())}
	}
	users := map[int64]*tg.User{
		1: {ID: 1, Username: "lazada_task_hr", FirstName: "Lazada"},
		2: {ID: 2, FirstName: "Ali", LastName: "Bin Abu"},
		3: {ID: 3},
		4: {ID: 4, Bot: true, Username: "somebot"},
	}

	in, ok := toInbound("a1", msg(&tg.PeerUser{UserID: 1}), users)
	if !ok {
		t.Fatal("private message ignored")
	}
	want := gateway.InboundMessage{AccountID: "a1", Channel: gateway.Telegram, Peer: "1", Handle: "@lazada_task_hr",
		ExternalID: "42", Kind: gateway.Text, Text: "hi auntie", At: at.Local()}
	if in != want {
		t.Fatalf("got %+v\nwant %+v", in, want)
	}

	for peer, h := range map[int64]string{2: "Ali Bin Abu", 3: "3", 99: "99"} { // 99: not in entities
		if in, _ := toInbound("a1", msg(&tg.PeerUser{UserID: peer}), users); in.Handle != h {
			t.Errorf("peer %d: handle %q, want %q", peer, in.Handle, h)
		}
	}

	out := msg(&tg.PeerUser{UserID: 1})
	out.Out = true
	for name, m := range map[string]*tg.Message{
		"group":    msg(&tg.PeerChat{ChatID: 5}),
		"channel":  msg(&tg.PeerChannel{ChannelID: 6}),
		"bot":      msg(&tg.PeerUser{UserID: 4}),
		"outgoing": out,
		"service":  msg(&tg.PeerUser{UserID: serviceUserID}),
	} {
		if _, ok := toInbound("a1", m, users); ok {
			t.Errorf("%s message not ignored", name)
		}
	}
}

func TestKind(t *testing.T) {
	doc := func(attrs ...tg.DocumentAttributeClass) tg.MessageMediaClass {
		return &tg.MessageMediaDocument{Document: &tg.Document{Attributes: attrs}}
	}
	for want, media := range map[gateway.Kind]tg.MessageMediaClass{
		gateway.Text:     nil,
		gateway.Photo:    &tg.MessageMediaPhoto{},
		gateway.Voice:    doc(&tg.DocumentAttributeAudio{Voice: true}),
		gateway.Video:    doc(&tg.DocumentAttributeVideo{}),
		gateway.Sticker:  doc(&tg.DocumentAttributeVideo{}, &tg.DocumentAttributeSticker{}),
		gateway.Document: doc(&tg.DocumentAttributeFilename{FileName: "invoice.pdf"}),
	} {
		if got := kind(media); got != want {
			t.Errorf("kind = %s, want %s", got, want)
		}
	}
}

func TestBanned(t *testing.T) {
	for _, err := range []error{
		tgerr.New(401, "AUTH_KEY_UNREGISTERED"),
		tgerr.New(401, "USER_DEACTIVATED"),
		tgerr.New(420, "FROZEN_METHOD_INVALID"),
		errRestricted,
	} {
		if _, ok := banned(err); !ok {
			t.Errorf("%v: want banned", err)
		}
	}
	if _, ok := banned(tgerr.New(500, "INTERNAL")); ok {
		t.Error("server error treated as ban")
	}
}
