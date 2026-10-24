// Package playbook holds the scam playbook stage machine (FR-4, TR-4):
// rapport → bait → payment_request → stall. Stages only move forward; the current stage is stored
// on conversations.stage, and the stage definitions (goal + example line) live in playbooks.stages.
package playbook

import (
	"encoding/json"
	"strings"
)

const (
	Rapport        = "rapport"
	Bait           = "bait"
	PaymentRequest = "payment_request"
	Stall          = "stall"
)

var order = map[string]int{Rapport: 0, Bait: 1, PaymentRequest: 2, Stall: 3}

// Stage is one entry of playbooks.stages (jsonb array, in order).
type Stage struct {
	Key     string `json:"key"`
	Name    string `json:"name"`
	Goal    string `json:"goal"`    // what the persona tries to achieve in this stage
	Example string `json:"example"` // in-voice example line; also the fallback reply when the LLM is unavailable
}

// ParseStages decodes playbooks.stages. Unknown keys are kept; callers look stages up by key.
func ParseStages(raw []byte) ([]Stage, error) {
	var stages []Stage
	if len(raw) == 0 {
		return nil, nil
	}
	if err := json.Unmarshal(raw, &stages); err != nil {
		return nil, err
	}
	return stages, nil
}

// Find returns the stage with key, or the first stage, or a generic stage when the playbook is empty.
func Find(stages []Stage, key string) Stage {
	for _, s := range stages {
		if s.Key == key {
			return s
		}
	}
	if len(stages) > 0 {
		return stages[0]
	}
	return Generic(key)
}

// Generic is used when a conversation has no playbook yet (scam type not classified).
func Generic(key string) Stage {
	switch key {
	case Bait:
		return Stage{Key: Bait, Name: "Bait", Goal: "Show interest and ask how it works; let them explain the offer in detail.", Example: "ok can explain again? how it works ah"}
	case PaymentRequest:
		return Stage{Key: PaymentRequest, Name: "Payment request", Goal: "Agree hesitantly and ask exactly where to send the money: bank name, account number and account holder name, or wallet address and network.", Example: "ok la.. which account ah? name what?"}
	case Stall:
		return Stage{Key: Stall, Name: "Stall", Goal: "Say the transfer failed or you are waiting for someone; ask for another account or wallet.", Example: "bank say cannot transfer to this one, got other account?"}
	default:
		return Stage{Key: Rapport, Name: "Rapport", Goal: "Be a friendly, slightly cautious real person; ask who they are and what this is about.", Example: "hello.. who is this ah?"}
	}
}

// Signals are what the workflow observed about the latest scammer message.
type Signals struct {
	InboundCount        int  // scammer messages so far in the conversation, including this one
	PaymentAsked        bool // scammer asked the persona to pay, deposit, transfer or top up
	PaymentDetailsFound bool // a bank account or wallet was extracted from the scammer's messages
}

// Next returns the next stage. It never moves backwards.
func Next(current string, s Signals) string {
	target := Rapport
	switch {
	case s.PaymentDetailsFound:
		target = Stall // got one account → stall to draw a second one
	case s.PaymentAsked:
		target = PaymentRequest
	case s.InboundCount >= 2:
		target = Bait
	}
	cur, ok := order[current]
	if !ok {
		cur = 0
		current = Rapport
	}
	if order[target] > cur {
		return target
	}
	return current
}

var paymentWords = []string{
	"transfer", "deposit", "top up", "topup", "top-up", "bank in", "bankin", "pay ", "payment", "send money",
	"send usdt", " fee ", " fees ", " fee.", " fee,", "activate", "activation", "account number", "your wallet",
	"bayar", "pindah", "masukkan duit", "yuran", "akaun", "transfer duit", "转账", "汇款", "付款", "过数",
}

// AsksForPayment reports whether a scammer message asks the persona to move money.
// Words about the scammer's own fake returns ("withdraw", "profit", "release") deliberately do not
// count: they are bait, not a payment request.
func AsksForPayment(text string) bool {
	t := " " + strings.ToLower(text) + " "
	for _, w := range paymentWords {
		if strings.Contains(t, w) {
			return true
		}
	}
	return false
}
