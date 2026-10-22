// Package extraction pulls scam intelligence (bank accounts, phones, wallets, URLs) out of chat text (TR-6, TR-7).
package extraction

import (
	"bytes"
	"crypto/sha256"
	"math/big"
	"regexp"
	"strings"
)

type Found struct {
	Type       string  `json:"type"`              // bank_account | wallet | phone | url
	Value      string  `json:"value"`             // normalized, used for dedupe + lookup
	Display    string  `json:"display,omitempty"` // human-friendly
	Bank       string  `json:"bank,omitempty"`    // bank code or chain
	Raw        string  `json:"raw"`               // exact text matched, for highlighting
	Confidence float64 `json:"confidence"`
}

var (
	reURL   = regexp.MustCompile(`(?i)(?:https?://)?(?:[a-z0-9-]+\.)+(?:com|my|top|xyz|net|org|cc|vip|shop|site|online|link|info|app|icu|co)(?:/[^\s]*)?`)
	rePhone = regexp.MustCompile(`(?:\+60|\b60|\b0)\s?1\d[-\s]?\d{3,4}[-\s]?\d{4}\b`)
	reTron  = regexp.MustCompile(`\bT[1-9A-HJ-NP-Za-km-z]{33}\b`)
	reEth   = regexp.MustCompile(`\b0x[a-fA-F0-9]{40}\b`)
	reDigit = regexp.MustCompile(`\b\d(?:[ -]?\d){9,15}\b`)
)

// bank code -> keywords and valid account lengths (TRD TR-6: length per bank)
var banks = []struct {
	Code string
	Keys []string
	Lens []int
}{
	{"MBB", []string{"maybank", "mbb", "m2u"}, []int{10, 12}},
	{"CIMB", []string{"cimb"}, []int{10}},
	{"PBB", []string{"public bank", "pbb"}, []int{10}},
	{"RHB", []string{"rhb"}, []int{14}},
	{"HLB", []string{"hong leong", "hlb"}, []int{11}},
	{"BIMB", []string{"bank islam"}, []int{14}},
	{"AMB", []string{"ambank"}, []int{13}},
	{"BSN", []string{"bsn"}, []int{16}},
	{"UOB", []string{"uob"}, []int{10}},
	{"OCBC", []string{"ocbc"}, []int{10}},
}

// Extract returns every entity found in text. Spans already claimed (URL, phone, wallet) are blanked
// so that digits inside them are not re-read as bank accounts.
func Extract(text string) []Found {
	var out []Found
	work := text
	claim := func(re *regexp.Regexp, fn func(raw string) *Found) {
		work = re.ReplaceAllStringFunc(work, func(raw string) string {
			if f := fn(raw); f != nil {
				out = append(out, *f)
			}
			return strings.Repeat(" ", len(raw))
		})
	}
	claim(reURL, func(raw string) *Found {
		raw = strings.TrimRight(raw, ".,;)")
		return &Found{Type: "url", Value: normURL(raw), Raw: raw, Confidence: 0.75}
	})
	claim(rePhone, func(raw string) *Found {
		d := digits(raw)
		if strings.HasPrefix(d, "0") {
			d = "60" + d[1:]
		}
		if len(d) < 11 || len(d) > 12 {
			return nil
		}
		disp := "+" + d[:2] + " " + d[2:4] + "-" + d[4:len(d)-4] + " " + d[len(d)-4:]
		return &Found{Type: "phone", Value: "+" + d, Display: disp, Raw: raw, Confidence: 0.85}
	})
	claim(reTron, func(raw string) *Found {
		if !validTron(raw) {
			return nil
		}
		return &Found{Type: "wallet", Value: raw, Display: short(raw), Bank: "TRON", Raw: raw, Confidence: 0.9}
	})
	claim(reEth, func(raw string) *Found {
		return &Found{Type: "wallet", Value: strings.ToLower(raw), Display: short(raw), Bank: "ETH", Raw: raw, Confidence: 0.85}
	})

	lower := strings.ToLower(work)
	for _, loc := range reDigit.FindAllStringIndex(work, -1) {
		raw := work[loc[0]:loc[1]]
		d := digits(raw)
		code := bankNear(lower, loc[0], loc[1])
		conf := 0.6 // no bank named: plausible but unconfirmed
		if code != "" {
			if !lenOK(code, len(d)) {
				continue // validator rejects wrong length for that bank
			}
			conf = 0.92
		}
		out = append(out, Found{Type: "bank_account", Value: d, Display: group4(d), Bank: code, Raw: raw, Confidence: conf})
	}
	return out
}

var rules = []struct {
	Type string
	Keys []string
}{
	{"parcel", []string{"parcel", "pos laju", "customs", "delivery", "courier", "kastam"}},
	{"job", []string{"part-time", "part time", "reviewer", "per day", "commission", "task", "job"}},
	{"investment", []string{"invest", "usdt", "profit", "weekly", "crypto", "returns", "trading"}},
	{"impersonation", []string{"police", "pdrm", "bank negara", "bnm", "court", "macau", "lhdn", "mahkamah"}},
	{"romance", []string{"darling", "my love", "sayang", "lonely", "visit you", "gift box"}},
}

// Classify labels a conversation by keyword score (FR-7). Production: LLM classifier on a summary (TR-7).
func Classify(text string) string {
	t, best, bestN := strings.ToLower(text), "other", 0
	for _, r := range rules {
		n := 0
		for _, k := range r.Keys {
			n += strings.Count(t, k)
		}
		if n > bestN {
			best, bestN = r.Type, n
		}
	}
	return best
}

func bankNear(lower string, a, b int) string {
	lo, hi := max(0, a-60), min(len(lower), b+30)
	win := lower[lo:hi]
	for _, bk := range banks {
		for _, k := range bk.Keys {
			if strings.Contains(win, k) {
				return bk.Code
			}
		}
	}
	return ""
}

func lenOK(code string, n int) bool {
	for _, bk := range banks {
		if bk.Code == code {
			for _, l := range bk.Lens {
				if l == n {
					return true
				}
			}
		}
	}
	return false
}

func digits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func group4(d string) string {
	var parts []string
	for len(d) > 4 {
		parts, d = append(parts, d[:4]), d[4:]
	}
	return strings.Join(append(parts, d), " ")
}

func short(a string) string { return a[:6] + "…" + a[len(a)-7:] }

func normURL(u string) string {
	u = strings.ToLower(u)
	u = strings.TrimPrefix(strings.TrimPrefix(u, "https://"), "http://")
	return strings.TrimRight(u, "/")
}

const b58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

// validTron checks Base58Check: 0x41 prefix + 20-byte hash + 4-byte double-SHA256 checksum.
func validTron(addr string) bool {
	n := big.NewInt(0)
	for _, c := range addr {
		i := strings.IndexRune(b58, c)
		if i < 0 {
			return false
		}
		n.Mul(n, big.NewInt(58))
		n.Add(n, big.NewInt(int64(i)))
	}
	b := n.Bytes()
	if len(b) != 25 || b[0] != 0x41 {
		return false
	}
	h := sha256.Sum256(b[:21])
	h = sha256.Sum256(h[:])
	return bytes.Equal(h[:4], b[21:])
}
