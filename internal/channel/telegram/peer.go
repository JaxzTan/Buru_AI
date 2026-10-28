package telegram

import (
	"context"
	"fmt"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/gotd/td/tg"
)

// PeerRef encodes how to reach a Telegram user from one honeypot account:
// "tg:user:<user_id>:<access_hash>". The access hash is specific to the account that saw the user.
func PeerRef(userID, accessHash int64) string {
	return fmt.Sprintf("tg:user:%d:%d", userID, accessHash)
}

// ParsePeerRef is the inverse of PeerRef.
func ParsePeerRef(ref string) (*tg.InputPeerUser, error) {
	parts := strings.Split(ref, ":")
	if len(parts) != 4 || parts[0] != "tg" || parts[1] != "user" {
		return nil, fmt.Errorf("telegram: bad peer ref %q", ref)
	}
	id, err1 := strconv.ParseInt(parts[2], 10, 64)
	hash, err2 := strconv.ParseInt(parts[3], 10, 64)
	if err1 != nil || err2 != nil {
		return nil, fmt.Errorf("telegram: bad peer ref %q", ref)
	}
	return &tg.InputPeerUser{UserID: id, AccessHash: hash}, nil
}

var reSessionName = regexp.MustCompile(`^[A-Za-z0-9_.-]+\.json$`)

// SessionRef is the honeypot_accounts.session_ref for a phone: "file:tg_<digits>.json".
// The session file itself lives in SOCKABUS_TG_SESSION_DIR and must never be committed (TRD §7).
func SessionRef(phone string) string {
	var b strings.Builder
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return "file:tg_" + b.String() + ".json"
}

// SessionPath resolves a session_ref inside dir, refusing anything that could escape it.
func SessionPath(dir, ref string) (string, error) {
	name, ok := strings.CutPrefix(ref, "file:")
	if !ok || !reSessionName.MatchString(name) {
		return "", fmt.Errorf("telegram: unsupported session_ref %q (want file:<name>.json)", ref)
	}
	return filepath.Join(dir, name), nil
}

// userHashes stores user access hashes seen in updates (gotd updates.UserAccessHasher), so short
// updates without entities can still be answered.
type userHashes struct {
	mu sync.RWMutex
	m  map[[2]int64]int64
}

func newUserHashes() *userHashes { return &userHashes{m: map[[2]int64]int64{}} }

func (h *userHashes) SetUserAccessHash(_ context.Context, self, user, hash int64) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.m[[2]int64{self, user}] = hash
	return nil
}

func (h *userHashes) GetUserAccessHash(_ context.Context, self, user int64) (int64, bool, error) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	v, ok := h.m[[2]int64{self, user}]
	return v, ok, nil
}

// mediaText turns a media-only message into a short placeholder the persona can react to.
// Contact cards keep the shared phone number, because scammers use them to hand out "manager" numbers.
func mediaText(media tg.MessageMediaClass) string {
	switch m := media.(type) {
	case *tg.MessageMediaPhoto:
		return "[photo]"
	case *tg.MessageMediaContact:
		return strings.TrimSpace(fmt.Sprintf("[contact card] %s %s %s", m.FirstName, m.LastName, m.PhoneNumber))
	case *tg.MessageMediaGeo, *tg.MessageMediaGeoLive, *tg.MessageMediaVenue:
		return "[location]"
	case *tg.MessageMediaDocument:
		if doc, ok := m.Document.(*tg.Document); ok {
			for _, a := range doc.Attributes {
				switch attr := a.(type) {
				case *tg.DocumentAttributeAudio:
					if attr.Voice {
						return "[voice message]"
					}
					return "[audio]"
				case *tg.DocumentAttributeSticker:
					return "[sticker]"
				case *tg.DocumentAttributeVideo:
					if attr.RoundMessage {
						return "[video message]"
					}
					return "[video]"
				case *tg.DocumentAttributeFilename:
					return "[file] " + attr.FileName
				}
			}
		}
		return "[file]"
	case nil:
		return ""
	default:
		return "[attachment]"
	}
}
