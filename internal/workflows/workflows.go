// Package workflows holds Temporal workflows. One ConversationWorkflow per scammer
// conversation will live here (TR-3, TR-5); Ping exists to prove the worker is wired.
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
}
