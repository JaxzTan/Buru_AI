package workflows

import (
	"testing"

	"go.temporal.io/sdk/testsuite"
)

func TestPing(t *testing.T) {
	var ts testsuite.WorkflowTestSuite
	env := ts.NewTestWorkflowEnvironment()
	env.ExecuteWorkflow(Ping, "sockabus")

	if !env.IsWorkflowCompleted() {
		t.Fatal("workflow did not complete")
	}
	var got string
	if err := env.GetWorkflowResult(&got); err != nil {
		t.Fatal(err)
	}
	if got != "pong sockabus" {
		t.Fatalf("result = %q", got)
	}
}
