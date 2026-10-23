-- Application role (docs/TRD.md §7, NFR-8): INSERT + SELECT only on the append-only tables.
-- The app's login user is granted buru_app; migrations keep running as the schema owner.
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'buru_app') THEN
        CREATE ROLE buru_app NOLOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO buru_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO buru_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO buru_app;

REVOKE UPDATE, DELETE, TRUNCATE ON messages, entity_sightings, verifications FROM buru_app;
