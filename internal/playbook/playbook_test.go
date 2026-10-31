package playbook

import "testing"

func TestNext(t *testing.T) {
	cases := []struct {
		name, cur string
		s         Signals
		want      string
	}{
		{"first message", Rapport, Signals{InboundCount: 1}, Rapport},
		{"second message", Rapport, Signals{InboundCount: 2}, Bait},
		{"asked to pay", Bait, Signals{InboundCount: 3, PaymentAsked: true}, PaymentRequest},
		{"asked to pay early", Rapport, Signals{InboundCount: 1, PaymentAsked: true}, PaymentRequest},
		{"account shared", PaymentRequest, Signals{InboundCount: 4, PaymentDetailsFound: true}, Stall},
		{"never backwards", Stall, Signals{InboundCount: 9}, Stall},
		{"unknown stage resets to rapport", "weird", Signals{InboundCount: 1}, Rapport},
	}
	for _, c := range cases {
		if got := Next(c.cur, c.s); got != c.want {
			t.Errorf("%s: Next(%s, %+v) = %s, want %s", c.name, c.cur, c.s, got, c.want)
		}
	}
}

func TestAsksForPayment(t *testing.T) {
	yes := []string{"First task need deposit RM150", "Sila bayar yuran RM50", "pls TRANSFER now", "请先转账"}
	no := []string{"Hi Auntie, how are you", "our company hiring part-time reviewer",
		"our USDT plan give 8% weekly, my student already withdraw 3 times"}
	for _, s := range yes {
		if !AsksForPayment(s) {
			t.Errorf("AsksForPayment(%q) = false", s)
		}
	}
	for _, s := range no {
		if AsksForPayment(s) {
			t.Errorf("AsksForPayment(%q) = true", s)
		}
	}
}

func TestParseAndFind(t *testing.T) {
	stages, err := ParseStages([]byte(`[{"key":"rapport","name":"Rapport","goal":"g1","example":"e1"},{"key":"stall","name":"Stall","goal":"g4","example":"e4"}]`))
	if err != nil {
		t.Fatal(err)
	}
	if Find(stages, Stall).Example != "e4" || Find(stages, "missing").Key != Rapport || Find(nil, Bait).Key != Bait {
		t.Error("Find lookup")
	}
}
