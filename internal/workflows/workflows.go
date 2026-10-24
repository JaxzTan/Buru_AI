// Package workflows holds Temporal workflows: one ConversationWorkflow per scammer conversation
// (TR-3, TR-5, conversation.go); Ping exists to prove the worker is wired. Activities live in
// internal/honeypot and are registered there by name.
package workflows

import (
	"go.temporal.io/sdk/worker"
	"go.temporal.io/sdk/workflow"
)

func Ping(_ workflow.Context, name string) (string, error) {
	return "pong " + name, nil
}

// Register adds every workflow and activity to the worker.
func Register(w worker.Worker) {
	w.RegisterWorkflow(Ping)
	w.RegisterWorkflow(ConversationWorkflow)
}
