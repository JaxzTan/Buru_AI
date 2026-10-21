-- Initial schema from docs/TRD.md §4.
-- Tables marked append-only must never receive UPDATE or DELETE from application code (NFR-8).

CREATE TABLE operator (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  totp_secret   VARBINARY(255) NULL,
  role          ENUM('operator','admin') NOT NULL DEFAULT 'operator',
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE persona (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  age            SMALLINT UNSIGNED NOT NULL,
  language_mix   JSON NOT NULL,
  backstory      TEXT NOT NULL,
  wealth_profile VARCHAR(255) NOT NULL,
  playbook_ids   JSON NOT NULL,
  status         ENUM('draft','active','retired') NOT NULL DEFAULT 'draft',
  created_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

CREATE TABLE honeypot_account (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  persona_id  BIGINT UNSIGNED NOT NULL,
  channel     ENUM('telegram','whatsapp') NOT NULL,
  phone       VARCHAR(32) NOT NULL,
  session_ref VARCHAR(255) NOT NULL COMMENT 'pointer into secret store, never the session itself',
  status      ENUM('active','banned','cooldown') NOT NULL DEFAULT 'active',
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_channel_phone (channel, phone),
  CONSTRAINT fk_account_persona FOREIGN KEY (persona_id) REFERENCES persona (id)
);

CREATE TABLE conversation (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_id       BIGINT UNSIGNED NOT NULL,
  scammer_handle   VARCHAR(255) NOT NULL,
  scam_type        ENUM('parcel','job','investment','impersonation','romance','other') NULL,
  stage            ENUM('rapport','bait','payment_request','stall') NOT NULL DEFAULT 'rapport',
  status           ENUM('bot','human','closed') NOT NULL DEFAULT 'bot',
  workflow_id      VARCHAR(255) NOT NULL UNIQUE,
  started_at       DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_conversation_account (account_id),
  CONSTRAINT fk_conversation_account FOREIGN KEY (account_id) REFERENCES honeypot_account (id)
);

-- Append-only.
CREATE TABLE message (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT UNSIGNED NOT NULL,
  direction       ENUM('inbound','outbound') NOT NULL,
  body            VARBINARY(65000) NOT NULL COMMENT 'envelope-encrypted (TR-14)',
  sent_at         DATETIME(3) NOT NULL,
  KEY idx_message_conversation (conversation_id, sent_at),
  CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES conversation (id)
);

CREATE TABLE entity (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type             ENUM('bank_account','wallet','phone','url','handle') NOT NULL,
  value_normalized VARCHAR(512) NOT NULL,
  bank_or_chain    VARCHAR(32) NOT NULL DEFAULT '',
  confidence       DECIMAL(4,3) NOT NULL DEFAULT 0,
  status           ENUM('unverified','verified','rejected') NOT NULL DEFAULT 'unverified',
  first_seen       DATETIME(3) NOT NULL,
  last_seen        DATETIME(3) NOT NULL,
  UNIQUE KEY uq_entity_value (type, bank_or_chain, value_normalized),
  KEY idx_entity_status (status, last_seen)
);

-- Append-only.
CREATE TABLE entity_sighting (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id       BIGINT UNSIGNED NOT NULL,
  conversation_id BIGINT UNSIGNED NOT NULL,
  message_id      BIGINT UNSIGNED NOT NULL,
  extracted_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_sighting_entity (entity_id),
  CONSTRAINT fk_sighting_entity FOREIGN KEY (entity_id) REFERENCES entity (id),
  CONSTRAINT fk_sighting_conversation FOREIGN KEY (conversation_id) REFERENCES conversation (id),
  CONSTRAINT fk_sighting_message FOREIGN KEY (message_id) REFERENCES message (id)
);

-- Append-only.
CREATE TABLE verification (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id   BIGINT UNSIGNED NOT NULL,
  operator_id BIGINT UNSIGNED NOT NULL,
  decision    ENUM('verified','rejected') NOT NULL,
  note        TEXT NULL,
  decided_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_verification_entity (entity_id),
  CONSTRAINT fk_verification_entity FOREIGN KEY (entity_id) REFERENCES entity (id),
  CONSTRAINT fk_verification_operator FOREIGN KEY (operator_id) REFERENCES operator (id)
);

CREATE TABLE chain_transfer (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id   BIGINT UNSIGNED NOT NULL COMMENT 'wallet entity being traced',
  from_wallet VARCHAR(128) NOT NULL,
  to_wallet   VARCHAR(128) NOT NULL,
  chain       ENUM('tron','ethereum') NOT NULL,
  token       VARCHAR(16) NOT NULL,
  amount      DECIMAL(38,6) NOT NULL,
  tx_hash     VARCHAR(128) NOT NULL,
  ts          DATETIME(3) NOT NULL,
  to_label    VARCHAR(255) NULL,
  UNIQUE KEY uq_transfer (chain, tx_hash, from_wallet, to_wallet),
  KEY idx_transfer_entity (entity_id),
  CONSTRAINT fk_transfer_entity FOREIGN KEY (entity_id) REFERENCES entity (id)
);

CREATE TABLE customer (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  type        ENUM('bank','ewallet','exchange') NOT NULL,
  webhook_url VARCHAR(2048) NULL,
  webhook_secret VARBINARY(255) NULL COMMENT 'HMAC key (TR-12)',
  watch_rules JSON NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE api_key (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  key_hash    CHAR(64) NOT NULL UNIQUE COMMENT 'sha256 hex; raw key shown once',
  status      ENUM('active','revoked') NOT NULL DEFAULT 'active',
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_apikey_customer FOREIGN KEY (customer_id) REFERENCES customer (id)
);

CREATE TABLE lookup_log (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT UNSIGNED NOT NULL,
  entity_type ENUM('bank_account','wallet','phone','url','handle') NOT NULL,
  matched     BOOLEAN NOT NULL,
  latency_ms  INT UNSIGNED NOT NULL,
  ts          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_lookup_customer_ts (customer_id, ts)
);
