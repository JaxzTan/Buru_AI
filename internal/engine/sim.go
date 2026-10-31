package engine

import (
	"context"
	"fmt"
	"strconv"
	"os"
	"time"

	"github.com/JaxzTan/Buru_AI/internal/demostore"
)

// Scripted scammers stand in for real inbound traffic until the Telegram/WhatsApp connectors exist.
// Every line goes through the real pipeline: extraction, classification, stage machine, persona reply.
var scripts = []struct {
	Scammer, Channel string
	Lines            []string
}{
	{"@lazada_task_hr", "TG", []string{
		"Hi Auntie, our company hiring part-time reviewer, RM300 per day only click like 👍",
		"Yes can! First task need deposit RM150 to activate account, after that we return RM450",
		"Ok send RM150 to Maybank 1642 0457 1893 name Lim Ah Seng",
		"Any problem call my manager +60 12-777 4410 quickly, task expire today",
		"Bank cannot? Use CIMB 7012345678 can, or check status at http://lazada-task-claim.top/verify"}},
	{"@gold_usdt_mentor", "WA", []string{
		"Good morning 🌸 our USDT plan give 8% weekly, my student already withdraw 3 times",
		"Start small 500 USDT, profit very stable, no risk",
		"Send to TUiNnd7ic6yCmaLmyuE7g7ZF5XYURYLBwR TRC20 only",
		"Join our group to see returns https://usdt-profit-club.xyz/join",
		"If wallet problem use second one TFBr3yb2N8JMpEzwfSqTWodTzQSwLxuRxo"}},
	{"@inspector_ali_pdrm", "TG", []string{
		"This is Inspector Ali from PDRM Bukit Aman. Your IC linked to money laundering case, court will issue warrant",
		"Do not tell anyone. Bank Negara need to verify your savings, cooperate or you get arrested",
		"Transfer savings to safe account CIMB 7099 8800 12 under Bank Negara custody",
		"Confirm after transfer, call investigator +60 11-3321 5566"}},
}

// RunSimulator starts a new scripted scammer conversation every SOCKABUS_SIM_EVERY seconds (SOCKABUS_SIM_MAX total).
func (e *Engine) RunSimulator(ctx context.Context) {
	gap, every := secs("SOCKABUS_SIM_GAP", 14), secs("SOCKABUS_SIM_EVERY", 25)
	max := 6
	if n, err := strconv.Atoi(os.Getenv("SOCKABUS_SIM_MAX")); err == nil {
		max = n
	}
	personas := e.St.Personas()
	for n := 0; n < max; n++ {
		sc := scripts[n%len(scripts)]
		pid := "p1"
		if len(personas) > 0 {
			pid, _ = personas[n%len(personas)]["id"].(string)
		}
		id := fmt.Sprintf("s%d", n+1)
		e.St.AddConvo(demostore.Convo{ID: id, Scammer: sc.Scammer, Persona: pid, Channel: sc.Channel,
			Scam: "other", Stage: "rapport", Status: "bot", Time: hhmm()})
		e.Inbound(id, sc.Lines[0]) // first message immediately so the chat list never shows an empty thread
		go func() {
			for _, line := range sc.Lines[1:] {
				select {
				case <-ctx.Done():
					return
				case <-time.After(gap):
				}
				if !e.Inbound(id, line) {
					return
				}
			}
		}()
		select {
		case <-ctx.Done():
			return
		case <-time.After(every):
		}
	}
}
