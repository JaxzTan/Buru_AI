-- Live honeypot queries (FR-2 routing, persona generator, operator console) that build on the
-- core queries in conversations.sql, entities.sql and personas.sql. Uses columns from
-- migration 000004 (scammer_peer_ref, dedupe_key, personas.profile/demo_identifiers).

-- name: FindOpenConversationByPeer :one
-- Routes an inbound message to its open conversation by channel reply address (FR-2).
SELECT * FROM conversations
WHERE account_id = $1 AND scammer_peer_ref = $2 AND status <> 'closed'
ORDER BY started_at DESC
LIMIT 1;

-- name: CreateConversationForPeer :one
INSERT INTO conversations (account_id, playbook_id, temporal_workflow_id, scammer_handle, scammer_peer_ref, started_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: SetConversationPlaybook :exec
UPDATE conversations SET playbook_id = $2 WHERE id = $1;

-- name: ListConversationsWithPersona :many
-- Operator console list; NULL status = all.
SELECT c.*, a.persona_id, a.channel, p.name AS persona_name
FROM conversations c
JOIN honeypot_accounts a ON a.id = c.account_id
JOIN personas p ON p.id = a.persona_id
WHERE (sqlc.narg(status)::conversation_status IS NULL OR c.status = sqlc.narg(status))
ORDER BY COALESCE(c.last_message_at, c.started_at) DESC
LIMIT sqlc.arg(row_limit);

-- name: InsertMessageDeduped :one
-- Like InsertMessage, but idempotent on dedupe_key: returns no row when the key already exists
-- (a redelivered channel update or a retried send). Also bumps conversations.last_message_at.
WITH m AS (
    INSERT INTO messages (conversation_id, direction, sender_type, operator_id, body_ciphertext, dek_ref, sent_at, dedupe_key)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING *
), c AS (
    UPDATE conversations SET last_message_at = (SELECT sent_at FROM m) WHERE id = (SELECT conversation_id FROM m)
)
SELECT * FROM m;

-- name: GetMessage :one
SELECT * FROM messages WHERE id = $1;

-- name: ListRecentMessages :many
-- Newest first; callers reverse into chronological order.
SELECT * FROM messages
WHERE conversation_id = $1
ORDER BY sent_at DESC, id DESC
LIMIT $2;

-- name: CountInboundMessages :one
SELECT count(*) FROM messages WHERE conversation_id = $1 AND direction = 'inbound';

-- name: FirstInboundMessageID :one
SELECT id FROM messages
WHERE conversation_id = $1 AND direction = 'inbound'
ORDER BY sent_at, id
LIMIT 1;

-- name: ListConversationEntities :many
SELECT DISTINCT e.* FROM entities e
JOIN entity_sightings s ON s.entity_id = e.id
WHERE s.conversation_id = $1
ORDER BY e.id;

-- name: CreatePersonaWithProfile :one
-- Full insert used by the operator API and the persona generator.
INSERT INTO personas (name, age, language_mix, backstory, wealth_profile, status, profile, demo_identifiers)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: ListPersonasForDedupe :many
-- Dedup memory for the persona generator: every persona not retired.
SELECT name, age, profile FROM personas WHERE status <> 'retired' ORDER BY id;

-- name: DetachPlaybooks :exec
DELETE FROM persona_playbooks WHERE persona_id = $1;

-- name: GetPlaybook :one
SELECT * FROM playbooks WHERE id = $1;
