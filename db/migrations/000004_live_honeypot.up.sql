-- Live honeypot (M1 + M2): Telegram routing, persona generator storage, message dedupe,
-- and database-level append-only enforcement (NFR-8, TRD §7).

-- ─────────────── Personas: generator output (persona generator skill, TRD §4 note) ───────────────

ALTER TABLE personas
    ADD COLUMN profile          jsonb, -- gender, ethnicity, city, occupation, digital, texting_style...
    ADD COLUMN demo_identifiers jsonb; -- masked demo-only values; never placed in a system prompt

-- ─────────────── Playbooks: one row per (scam_type, version) so seeds are idempotent ───────────────

ALTER TABLE playbooks ADD CONSTRAINT playbooks_scam_type_version_uq UNIQUE (scam_type, version);

-- ─────────────── Conversations: how to reach the scammer again on the channel ───────────────

-- Channel-specific, opaque reply address, e.g. Telegram "tg:user:<id>:<access_hash>".
-- Telegram needs the access hash to send, and it is only valid for the honeypot account that saw it.
ALTER TABLE conversations ADD COLUMN scammer_peer_ref varchar(255);
CREATE INDEX conversations_open_peer_idx ON conversations (account_id, scammer_peer_ref) WHERE status <> 'closed';

-- ─────────────── Messages: idempotent ingest ───────────────

-- Channels redeliver updates and Temporal retries activities; a stable key stops duplicates.
-- Inbound: "tg:<account_id>:<peer_id>:<message_id>". Outbound: "out:<conversation_id>:<random_id>".
ALTER TABLE messages ADD COLUMN dedupe_key varchar(128);
CREATE UNIQUE INDEX messages_dedupe_key_uq ON messages (dedupe_key);

-- ─────────────── Append-only enforcement (NFR-8) ───────────────

-- 000002 already stops buru_app from changing these tables. The triggers also stop the owner role
-- (local dev, ad-hoc psql sessions), so audit rows cannot be edited by accident.
CREATE FUNCTION buru_forbid_mutation() RETURNS trigger
    LANGUAGE plpgsql AS
$$
BEGIN
    RAISE EXCEPTION '% is append-only (NFR-8): % is not allowed', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER messages_append_only BEFORE UPDATE OR DELETE ON messages
    FOR EACH ROW EXECUTE FUNCTION buru_forbid_mutation();
CREATE TRIGGER messages_no_truncate BEFORE TRUNCATE ON messages
    FOR EACH STATEMENT EXECUTE FUNCTION buru_forbid_mutation();

CREATE TRIGGER entity_sightings_append_only BEFORE UPDATE OR DELETE ON entity_sightings
    FOR EACH ROW EXECUTE FUNCTION buru_forbid_mutation();
CREATE TRIGGER entity_sightings_no_truncate BEFORE TRUNCATE ON entity_sightings
    FOR EACH STATEMENT EXECUTE FUNCTION buru_forbid_mutation();

CREATE TRIGGER verifications_append_only BEFORE UPDATE OR DELETE ON verifications
    FOR EACH ROW EXECUTE FUNCTION buru_forbid_mutation();
CREATE TRIGGER verifications_no_truncate BEFORE TRUNCATE ON verifications
    FOR EACH STATEMENT EXECUTE FUNCTION buru_forbid_mutation();

-- The buru_app role and its INSERT/SELECT-only grants on these tables come from 000002_app_role.
