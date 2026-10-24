-- Personas, prompt versions, playbooks and honeypot accounts (FR-1, FR-2, FR-4; TR-1, TR-4, TR-17).

-- name: CreatePersona :one
INSERT INTO personas (name, age, language_mix, backstory, wealth_profile)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetPersona :one
SELECT * FROM personas WHERE id = $1;

-- name: ListPersonas :many
SELECT * FROM personas ORDER BY id;

-- name: UpdatePersona :one
UPDATE personas
SET name = $2, age = $3, language_mix = $4, backstory = $5, wealth_profile = $6, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: SetPersonaStatus :one
UPDATE personas SET status = $2, updated_at = now() WHERE id = $1 RETURNING *;

-- name: CreatePromptVersion :one
-- Every prompt change is a new version (FR-1); version is the next number for this persona.
INSERT INTO persona_prompt_versions (persona_id, version, system_prompt, created_by)
SELECT sqlc.arg(persona_id), COALESCE(MAX(version), 0) + 1, sqlc.arg(system_prompt), sqlc.narg(created_by)
FROM persona_prompt_versions
WHERE persona_id = sqlc.arg(persona_id)
RETURNING *;

-- name: LatestPromptVersion :one
SELECT * FROM persona_prompt_versions
WHERE persona_id = $1
ORDER BY version DESC
LIMIT 1;

-- name: CreatePlaybook :one
INSERT INTO playbooks (scam_type, name, version, stages)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListPlaybooks :many
SELECT * FROM playbooks ORDER BY scam_type, version DESC;

-- name: PlaybookForScamType :one
SELECT * FROM playbooks WHERE scam_type = $1 ORDER BY version DESC LIMIT 1;

-- name: AttachPlaybook :exec
INSERT INTO persona_playbooks (persona_id, playbook_id) VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: ListPersonaPlaybooks :many
SELECT p.* FROM playbooks p
JOIN persona_playbooks pp ON pp.playbook_id = p.id
WHERE pp.persona_id = $1
ORDER BY p.scam_type;

-- name: CreateHoneypotAccount :one
INSERT INTO honeypot_accounts (persona_id, channel, phone, session_ref)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetHoneypotAccount :one
SELECT * FROM honeypot_accounts WHERE id = $1;

-- name: ListHoneypotAccounts :many
SELECT * FROM honeypot_accounts ORDER BY id;

-- name: ListActiveAccountsByChannel :many
SELECT * FROM honeypot_accounts WHERE channel = $1 AND status = 'active' ORDER BY id;

-- name: SetAccountStatus :one
-- TR-17: banned sets banned_at; cooldown needs cooldown_until.
UPDATE honeypot_accounts
SET status = sqlc.arg(status),
    banned_at = CASE WHEN sqlc.arg(status)::account_status = 'banned' THEN now() ELSE banned_at END,
    cooldown_until = sqlc.narg(cooldown_until)
WHERE id = sqlc.arg(id)
RETURNING *;
