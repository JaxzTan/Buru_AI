DROP TRIGGER IF EXISTS verifications_no_truncate ON verifications;
DROP TRIGGER IF EXISTS verifications_append_only ON verifications;
DROP TRIGGER IF EXISTS entity_sightings_no_truncate ON entity_sightings;
DROP TRIGGER IF EXISTS entity_sightings_append_only ON entity_sightings;
DROP TRIGGER IF EXISTS messages_no_truncate ON messages;
DROP TRIGGER IF EXISTS messages_append_only ON messages;
DROP FUNCTION IF EXISTS buru_forbid_mutation();

DROP INDEX IF EXISTS messages_dedupe_key_uq;
ALTER TABLE messages DROP COLUMN IF EXISTS dedupe_key;

DROP INDEX IF EXISTS conversations_open_peer_idx;
ALTER TABLE conversations DROP COLUMN IF EXISTS scammer_peer_ref;

ALTER TABLE playbooks DROP CONSTRAINT IF EXISTS playbooks_scam_type_version_uq;

ALTER TABLE personas
    DROP COLUMN IF EXISTS demo_identifiers,
    DROP COLUMN IF EXISTS profile;
