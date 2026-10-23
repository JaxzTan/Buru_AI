-- Operators (TRD §7: email + TOTP, operator/admin roles).

-- name: CreateOperator :one
INSERT INTO operators (email, role, totp_secret_ref) VALUES ($1, $2, $3) RETURNING *;

-- name: GetOperatorByEmail :one
SELECT * FROM operators WHERE email = $1;

-- name: GetOperator :one
SELECT * FROM operators WHERE id = $1;
