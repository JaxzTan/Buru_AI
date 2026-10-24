package telegram

import (
	"strconv"
	"strings"
	"time"

	"github.com/gotd/td/tg"

	"github.com/JaxzTan/Buru_AI/internal/gateway"
)

// serviceUserID is Telegram's own notification account; it sends login codes, which must never reach the engine.
const serviceUserID = 777000

// toInbound maps a private message from a scammer to the gateway. ok is false for anything we ignore:
// groups, channels, our own outgoing messages, bots and Telegram's service account.
func toInbound(accountID string, m *tg.Message, users map[int64]*tg.User) (gateway.InboundMessage, bool) {
	p, ok := m.PeerID.(*tg.PeerUser)
	if !ok || m.Out || p.UserID == serviceUserID {
		return gateway.InboundMessage{}, false
	}
	u := users[p.UserID]
	if u != nil && (u.Bot || u.Self) {
		return gateway.InboundMessage{}, false
	}
	peer := strconv.FormatInt(p.UserID, 10)
	return gateway.InboundMessage{
		AccountID:  accountID,
		Channel:    gateway.Telegram,
		Peer:       peer,
		Handle:     handle(u, peer),
		ExternalID: strconv.Itoa(m.ID),
		Kind:       kind(m.Media),
		Text:       m.Message,
		At:         time.Unix(int64(m.Date), 0),
	}, true
}

// handle is the scammer_handle: @username, else display name, else numeric id.
func handle(u *tg.User, peer string) string {
	if u == nil {
		return peer
	}
	if u.Username != "" {
		return "@" + u.Username
	}
	for _, n := range u.Usernames { // accounts with only collectible (Fragment) usernames
		if n.Active {
			return "@" + n.Username
		}
	}
	if name := strings.TrimSpace(u.FirstName + " " + u.LastName); name != "" {
		return name
	}
	return peer
}

func kind(media tg.MessageMediaClass) gateway.Kind {
	switch md := media.(type) {
	case *tg.MessageMediaPhoto:
		return gateway.Photo
	case *tg.MessageMediaDocument:
		doc, ok := md.Document.(*tg.Document)
		if !ok {
			return gateway.Document
		}
		k := gateway.Document
		for _, a := range doc.Attributes {
			switch a := a.(type) {
			case *tg.DocumentAttributeSticker: // video stickers also carry a video attribute
				return gateway.Sticker
			case *tg.DocumentAttributeVideo:
				k = gateway.Video
			case *tg.DocumentAttributeAudio:
				if a.Voice {
					k = gateway.Voice
				}
			}
		}
		return k
	}
	return gateway.Text // plain text, link previews, and media we don't label
}
