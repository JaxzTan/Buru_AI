-- Initial schema (docs/TRD_V3.md §4, db/schema.dbml). PostgreSQL 15+.
-- messages, entity_sightings and verifications are append-only (NFR-8): the app role gets INSERT + SELECT only.

-- ─────────────── Enums ───────────────

CREATE TYPE operator_role AS ENUM ('operator', 'admin');
CREATE TYPE persona_status AS ENUM ('draft', 'active', 'paused', 'retired');
CREATE TYPE channel AS ENUM ('telegram', 'whatsapp');
CREATE TYPE account_status AS ENUM ('active', 'banned', 'cooldown');
CREATE TYPE scam_type AS ENUM ('job', 'investment', 'romance', 'parcel', 'impersonation', 'loan', 'other');
CREATE TYPE conversation_status AS ENUM ('bot', 'human', 'closed');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE sender_type AS ENUM ('scammer', 'persona', 'operator');
CREATE TYPE entity_type AS ENUM ('bank_account', 'wallet', 'phone', 'url', 'handle');
CREATE TYPE entity_status AS ENUM ('unverified', 'verified', 'rejected');
CREATE TYPE confidence_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE verification_decision AS ENUM ('verified', 'rejected');
CREATE TYPE chain AS ENUM ('tron', 'ethereum');
CREATE TYPE customer_type AS ENUM ('bank', 'ewallet', 'exchange');
CREATE TYPE key_status AS ENUM ('active', 'revoked');
CREATE TYPE delivery_status AS ENUM ('pending', 'delivered', 'failed');

-- ─────────────── Operators ───────────────

CREATE TABLE operators (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email           varchar(255)  NOT NULL UNIQUE,
    role            operator_role NOT NULL DEFAULT 'operator',
    totp_secret_ref varchar(255)  NOT NULL, -- pointer to secret store, never the raw secret
    created_at      timestamptz   NOT NULL DEFAULT now()
);

-- ─────────────── Personas & honeypot accounts ───────────────

CREATE TABLE personas (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name           varchar(100)   NOT NULL,
    age            smallint,
    language_mix   jsonb          NOT NULL, -- e.g. {"en":0.5,"ms":0.3,"zh":0.2}
    backstory      text,
    wealth_profile jsonb,
    status         persona_status NOT NULL DEFAULT 'draft',
    created_at     timestamptz    NOT NULL DEFAULT now(),
    updated_at     timestamptz    NOT NULL DEFAULT now()
);

CREATE TABLE persona_prompt_versions (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    persona_id    bigint      NOT NULL REFERENCES personas (id),
    version       int         NOT NULL,
    system_prompt text        NOT NULL,
    created_by    bigint      REFERENCES operators (id),
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (persona_id, version) -- TR-1
);

CREATE TABLE playbooks (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    scam_type  scam_type    NOT NULL,
    name       varchar(100) NOT NULL,
    version    int          NOT NULL DEFAULT 1,
    stages     jsonb        NOT NULL, -- ordered stage machine: rapport -> bait -> payment_request -> stall (TR-4)
    created_at timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE persona_playbooks (
    persona_id  bigint NOT NULL REFERENCES personas (id),
    playbook_id bigint NOT NULL REFERENCES playbooks (id),
    PRIMARY KEY (persona_id, playbook_id)
);

CREATE TABLE honeypot_accounts (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    persona_id     bigint         NOT NULL REFERENCES personas (id),
    channel        channel        NOT NULL,
    phone          varchar(32)    NOT NULL UNIQUE,
    session_ref    varchar(255)   NOT NULL, -- pointer to session file in secret store
    status         account_status NOT NULL DEFAULT 'active',
    banned_at      timestamptz,
    cooldown_until timestamptz,
    created_at     timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX ON honeypot_accounts (status, channel); -- TR-17

-- ─────────────── Conversations ───────────────

CREATE TABLE conversations (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id           bigint              NOT NULL REFERENCES honeypot_accounts (id),
    playbook_id          bigint              REFERENCES playbooks (id),
    temporal_workflow_id varchar(128)        NOT NULL UNIQUE,
    scammer_handle       varchar(255)        NOT NULL,
    scam_type            scam_type, -- null until classifier runs (TR-7)
    stage                varchar(32)         NOT NULL DEFAULT 'rapport',
    status               conversation_status NOT NULL DEFAULT 'bot',
    started_at           timestamptz         NOT NULL,
    last_message_at      timestamptz,
    closed_at            timestamptz
);
CREATE INDEX ON conversations (account_id, scammer_handle);
CREATE INDEX ON conversations (status, last_message_at);

CREATE TABLE messages (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id bigint            NOT NULL REFERENCES conversations (id),
    direction       message_direction NOT NULL,
    sender_type     sender_type       NOT NULL,
    operator_id     bigint            REFERENCES operators (id), -- set when an operator sent it after takeover
    body_ciphertext bytea             NOT NULL, -- envelope-encrypted (TR-14)
    dek_ref         varchar(255)      NOT NULL, -- wrapped data key reference
    sent_at         timestamptz       NOT NULL
);
CREATE INDEX ON messages (conversation_id, sent_at);

-- ─────────────── Intelligence ───────────────

CREATE TABLE entities (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type             entity_type      NOT NULL,
    value_normalized varchar(512)     NOT NULL,
    bank_or_chain    varchar(32), -- bank code (MBB, CIMB...) or chain; NULL when not applicable
    confidence       confidence_level NOT NULL DEFAULT 'low', -- only operator verification sets 'high'
    status           entity_status    NOT NULL DEFAULT 'unverified',
    sightings_count  int              NOT NULL DEFAULT 0, -- denormalised for fast lookup
    first_seen       timestamptz      NOT NULL,
    last_seen        timestamptz      NOT NULL,
    CONSTRAINT uq_entity UNIQUE NULLS NOT DISTINCT (type, value_normalized, bank_or_chain)
);
CREATE INDEX ON entities (status, last_seen);

CREATE TABLE entity_sightings (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entity_id       bigint      NOT NULL REFERENCES entities (id),
    conversation_id bigint      NOT NULL REFERENCES conversations (id),
    message_id      bigint      NOT NULL REFERENCES messages (id),
    extracted_at    timestamptz NOT NULL,
    UNIQUE (entity_id, message_id)
);
CREATE INDEX ON entity_sightings (conversation_id);

CREATE TABLE verifications (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entity_id   bigint                NOT NULL REFERENCES entities (id),
    operator_id bigint                NOT NULL REFERENCES operators (id),
    decision    verification_decision NOT NULL,
    note        text,
    decided_at  timestamptz           NOT NULL
);
CREATE INDEX ON verifications (entity_id, decided_at);

CREATE TABLE chain_transfers (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wallet_entity_id bigint         NOT NULL REFERENCES entities (id), -- the scam wallet this trace started from
    chain            chain          NOT NULL,
    token            varchar(16)    NOT NULL DEFAULT 'USDT',
    tx_hash          varchar(128)   NOT NULL,
    log_index        int            NOT NULL DEFAULT 0, -- one tx can contain several transfers
    from_wallet      varchar(128)   NOT NULL,
    to_wallet        varchar(128)   NOT NULL,
    amount           numeric(38, 18) NOT NULL,
    hop              smallint       NOT NULL CHECK (hop IN (1, 2)), -- TR-8
    to_label         varchar(128), -- e.g. Binance deposit
    ts               timestamptz    NOT NULL,
    UNIQUE (chain, tx_hash, log_index, wallet_entity_id)
);
CREATE INDEX ON chain_transfers (wallet_entity_id);
CREATE INDEX ON chain_transfers (to_wallet);

-- ─────────────── Customers ───────────────

CREATE TABLE customers (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name               varchar(255)  NOT NULL,
    type               customer_type NOT NULL,
    webhook_url        varchar(512),
    webhook_secret_ref varchar(255), -- HMAC signing secret (TR-12)
    watch_rules        jsonb, -- e.g. {"entity_types":["bank_account"],"banks":["MBB"]}
    created_at         timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE customer_users (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id   bigint       NOT NULL REFERENCES customers (id),
    email         varchar(255) NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL,
    created_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE api_keys (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id        bigint       NOT NULL REFERENCES customers (id),
    key_prefix         varchar(16)  NOT NULL, -- shown in UI to identify the key
    key_hash           varchar(255) NOT NULL UNIQUE,
    status             key_status   NOT NULL DEFAULT 'active',
    rate_limit_per_min int          NOT NULL DEFAULT 600,
    created_at         timestamptz  NOT NULL DEFAULT now(),
    revoked_at         timestamptz
);

CREATE TABLE lookup_logs (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id bigint      NOT NULL REFERENCES customers (id),
    api_key_id  bigint      NOT NULL REFERENCES api_keys (id),
    entity_type entity_type NOT NULL,
    matched     boolean     NOT NULL,
    latency_ms  int         NOT NULL,
    ts          timestamptz NOT NULL -- does not store the looked-up value (FR-13)
);
CREATE INDEX ON lookup_logs (customer_id, ts);

CREATE TABLE webhook_deliveries (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id        bigint          NOT NULL REFERENCES customers (id),
    entity_id          bigint          NOT NULL REFERENCES entities (id),
    event_type         varchar(64)     NOT NULL DEFAULT 'entity.verified',
    payload            jsonb           NOT NULL,
    status             delivery_status NOT NULL DEFAULT 'pending',
    attempts           int             NOT NULL DEFAULT 0,
    last_response_code smallint,
    created_at         timestamptz     NOT NULL DEFAULT now(),
    delivered_at       timestamptz
);
CREATE INDEX ON webhook_deliveries (customer_id, created_at);
CREATE INDEX ON webhook_deliveries (status);
