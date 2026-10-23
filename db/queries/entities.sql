-- Entities, sightings, verifications and chain transfers (FR-6, FR-8, FR-9, FR-10, FR-11; TR-6, TR-8, TR-9, TR-10).
-- entity_sightings and verifications are append-only.

-- name: UpsertEntity :one
-- Dedupe on uq_entity (TR-6). Confidence only rises, and extraction can never set 'high' (FR-9).
INSERT INTO entities (type, value_normalized, bank_or_chain, confidence, first_seen, last_seen)
VALUES (
    sqlc.arg(type), sqlc.arg(value_normalized), sqlc.narg(bank_or_chain),
    LEAST(sqlc.arg(confidence)::confidence_level, 'medium'), now(), now()
)
ON CONFLICT ON CONSTRAINT uq_entity DO UPDATE
SET last_seen = now(),
    confidence = GREATEST(entities.confidence, LEAST(EXCLUDED.confidence, 'medium'))
RETURNING *;

-- name: InsertSighting :one
-- Records one sighting and bumps the denormalised count. Returns no row if this message was already counted.
WITH s AS (
    INSERT INTO entity_sightings (entity_id, conversation_id, message_id, extracted_at)
    VALUES ($1, $2, $3, now())
    ON CONFLICT (entity_id, message_id) DO NOTHING
    RETURNING *
), e AS (
    UPDATE entities SET sightings_count = sightings_count + 1 WHERE id = (SELECT entity_id FROM s)
)
SELECT * FROM s;

-- name: GetEntity :one
SELECT * FROM entities WHERE id = $1;

-- name: LookupEntity :one
-- Lookup API fallback when Redis misses (TR-10). Rejected entities never match.
SELECT * FROM entities
WHERE type = $1 AND value_normalized = $2 AND bank_or_chain IS NOT DISTINCT FROM sqlc.narg(bank_or_chain)
  AND status <> 'rejected';

-- name: LookupEntitiesBatch :many
-- Batch lookup, up to 100 per request (FR-10). Arrays are matched by position.
SELECT e.* FROM entities e
JOIN (
    -- types arrive as text[]: pgx cannot encode enum arrays without registering the type on each connection
    SELECT unnest(sqlc.arg(types)::text[])::entity_type AS type,
           unnest(sqlc.arg(values)::text[]) AS value,
           unnest(sqlc.arg(banks)::text[]) AS bank -- '' = no bank/chain
) AS q ON e.type = q.type AND e.value_normalized = q.value AND e.bank_or_chain IS NOT DISTINCT FROM NULLIF(q.bank, '')
WHERE e.status <> 'rejected';

-- name: EntityScamTypes :many
SELECT DISTINCT c.scam_type::scam_type AS scam_type
FROM entity_sightings s
JOIN conversations c ON c.id = s.conversation_id
WHERE s.entity_id = $1 AND c.scam_type IS NOT NULL;

-- name: ListEntities :many
-- Dashboard list with optional filters (TR-11). NULL filter = no filter.
SELECT e.* FROM entities e
WHERE (sqlc.narg(type)::entity_type IS NULL OR e.type = sqlc.narg(type))
  AND (sqlc.narg(status)::entity_status IS NULL OR e.status = sqlc.narg(status))
  AND (sqlc.narg(since)::timestamptz IS NULL OR e.last_seen >= sqlc.narg(since))
  AND (sqlc.narg(scam_type)::scam_type IS NULL OR EXISTS (
        SELECT 1 FROM entity_sightings s JOIN conversations c ON c.id = s.conversation_id
        WHERE s.entity_id = e.id AND c.scam_type = sqlc.narg(scam_type)))
ORDER BY e.last_seen DESC
LIMIT sqlc.arg(row_limit) OFFSET sqlc.arg(row_offset);

-- name: ListUnverifiedEntities :many
-- Verification queue (TR-9).
SELECT * FROM entities WHERE status = 'unverified' ORDER BY last_seen DESC LIMIT $1;

-- name: ListSightings :many
SELECT * FROM entity_sightings WHERE entity_id = $1 ORDER BY extracted_at;

-- name: VerifyEntity :one
-- Logs the decision (append-only) and applies it to the entity in one statement.
-- Verified -> confidence 'high'; rejected keeps confidence but status 'rejected' hides it from lookups.
WITH v AS (
    INSERT INTO verifications (entity_id, operator_id, decision, note, decided_at)
    VALUES (sqlc.arg(entity_id), sqlc.arg(operator_id), sqlc.arg(decision), sqlc.narg(note), now())
    RETURNING *
)
UPDATE entities e
SET status = v.decision::text::entity_status,
    confidence = CASE WHEN v.decision = 'verified' THEN 'high'::confidence_level ELSE e.confidence END
FROM v
WHERE e.id = v.entity_id
RETURNING e.*;

-- name: ListVerifications :many
SELECT * FROM verifications WHERE entity_id = $1 ORDER BY decided_at;

-- name: InsertChainTransfer :exec
INSERT INTO chain_transfers (wallet_entity_id, chain, token, tx_hash, log_index, from_wallet, to_wallet, amount, hop, to_label, ts)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
ON CONFLICT (chain, tx_hash, log_index, wallet_entity_id) DO NOTHING;

-- name: ListChainTransfers :many
SELECT * FROM chain_transfers WHERE wallet_entity_id = $1 ORDER BY hop, ts;

-- name: WeeklyEntityCounts :many
-- Trend chart (FR-11).
SELECT date_trunc('week', first_seen)::timestamptz AS week, type, count(*) AS entities
FROM entities
WHERE first_seen >= sqlc.arg(since) AND status <> 'rejected'
GROUP BY 1, 2
ORDER BY 1, 2;
