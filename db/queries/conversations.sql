-- Conversations and messages (FR-3, FR-4, FR-5; TR-3, TR-5, TR-14). messages is append-only.

-- name: CreateConversation :one
INSERT INTO conversations (account_id, playbook_id, temporal_workflow_id, scammer_handle, started_at)
VALUES ($1, $2, $3, $4, now())
RETURNING *;

-- name: GetConversation :one
SELECT * FROM conversations WHERE id = $1;

-- name: GetConversationByHandle :one
-- Routes an inbound message to its open conversation (FR-2).
SELECT * FROM conversations
WHERE account_id = $1 AND scammer_handle = $2 AND status <> 'closed'
ORDER BY started_at DESC
LIMIT 1;

-- name: ListConversationsByStatus :many
SELECT * FROM conversations
WHERE status = $1
ORDER BY last_message_at DESC NULLS LAST
LIMIT $2;

-- name: SetConversationStage :exec
UPDATE conversations SET stage = $2 WHERE id = $1;

-- name: SetConversationScamType :exec
UPDATE conversations SET scam_type = $2 WHERE id = $1;

-- name: SetConversationStatus :one
-- bot <-> human is takeover (FR-5); closed also sets closed_at.
UPDATE conversations
SET status = sqlc.arg(status),
    closed_at = CASE WHEN sqlc.arg(status)::conversation_status = 'closed' THEN now() ELSE closed_at END
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: InsertMessage :one
-- Also bumps conversations.last_message_at in the same statement.
WITH m AS (
    INSERT INTO messages (conversation_id, direction, sender_type, operator_id, body_ciphertext, dek_ref, sent_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
), c AS (
    UPDATE conversations SET last_message_at = (SELECT sent_at FROM m) WHERE id = (SELECT conversation_id FROM m)
)
SELECT * FROM m;

-- name: ListMessages :many
SELECT * FROM messages WHERE conversation_id = $1 ORDER BY sent_at, id;
